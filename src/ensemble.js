/* Les scénarios.

   Une prévision est un nombre, et ce nombre cache une marge. La même source
   rend, sous un autre point d'entrée, quarante scénarios issus d'états initiaux
   légèrement différents : leur dispersion est la marge, et elle s'élargit avec
   l'échéance. C'est ce que l'application peint sous la courbe et écrit en clair.

   ICON en version « seamless » est retenu : quarante membres, fin sur la France
   aux courtes échéances, sept jours de portée. ECMWF en porte cinquante et un et
   vaut mieux au delà de trois jours, mais sa maille est plus grossière près du
   sol et sa charge plus lourde ; les fondre aurait demandé deux requêtes pour
   affiner une marge, ce qui n'est pas le bon endroit où dépenser.

   La charge brute est lourde, soixante-quinze kilooctets pour deux grandeurs sur
   sept jours. Elle n'est ni gardée ni transportée telle quelle : les quarante
   séries sont réduites en quantiles dès la lecture, ce qui la ramène à quelques
   kilooctets. La requête ne porte que sur la commune affichée, jamais sur
   l'aperçu des lieux suivis. */

import { cleHeure } from "./horloge.js";

const SERVICE = "https://ensemble-api.open-meteo.com/v1/ensemble";
const MODELE = "icon_seamless";
const JOURS = 7;
const CACHE = "mameteo.ensemble.v1";

/* Les grandeurs encadrées, sous la clé de la voie qui les porte. Toutes ne s'y
   prêtent pas, et la source a été interrogée avant de choisir.

   La rafale et le vent moyen ont la dispersion la plus parlante après la
   température : seize kilomètres par heure d'étendue sur la rafale à trente-six
   heures d'échéance, contre cinq degrés sur la température.

   L'indice ultraviolet n'a pas de scénarios du tout, la source rendant ses
   colonnes vides : il se calcule de la position du Soleil et de la couverture
   nuageuse, il n'a pas de dispersion propre. La couverture nuageuse en a une de
   soixante-dix points sur une échelle de cent, où la bande remplirait la voie.
   Le point de rosée partage la voie de la température et redirait la même
   chose. Et la pluie ne s'encadre pas : ses scénarios sont presque tous à zéro
   et quelques-uns à quelques dixièmes, une bande de zéro à un demi-millimètre
   est muette là où le comptage des scénarios mouillés parle. */
const GRANDEURS = {
  t: "temperature_2m",
  v: "wind_speed_10m",
  raf: "wind_gusts_10m",
};
const PLUIE = "precipitation";
const DEMANDEES = [...Object.values(GRANDEURS), PLUIE];

/* Trois heures de garde. L'ensemble d'ICON tourne toutes les trois heures et sa
   dispersion bouge lentement : la relire à chaque heure comme la prévision
   déterministe coûterait quatre fois la bande passante pour la même marge. */
const GARDE = 3 * 3600 * 1000;

let charge = null;
let cleChargee = null;
export const chargeCourante = () => charge;

// Le seuil de lame au-dessus duquel un scénario compte comme pluvieux.
export const LAME = 0.1;

/* Les quantiles d'une série de valeurs, la série étant déjà triée. La méthode
   est celle du plus proche rang, sans interpolation : avec quarante membres,
   interpoler entre deux scénarios inventerait un scénario qui n'existe pas. */
const quantile = (tri, p) => tri[Math.min(tri.length - 1, Math.floor(p * tri.length))];

/* Réduit les quarante séries en cinq nombres par heure. Ce sont eux qui sont
   gardés et transportés, jamais les membres.

   `bas` et `haut` sont les quartiles, `mini` et `maxi` l'étendue, `med` la
   médiane. La bande interquartile porte la moitié des scénarios, l'étendue les
   porte tous : la première dit ce qui est probable, la seconde ce qui est
   possible. */
export const BORNES = ["mini", "bas", "med", "haut", "maxi"];

function reduire(h) {
  if (!Array.isArray(h?.time)) return null;
  const membres = c => Object.keys(h)
    .filter(x => x === c || x.startsWith(`${c}_member`))
    .map(x => h[x]).filter(Array.isArray);

  const series = {};
  for (const [cle, nom] of Object.entries(GRANDEURS)) series[cle] = membres(nom);
  const pm = membres(PLUIE);
  /* Une grandeur que la source ne peuple pas ne remonte pas : l'indice
     ultraviolet rend ses colonnes vides, et une voie sans scénarios doit se
     dessiner sans eux plutôt que sur des bandes plates. */
  const tenues = Object.entries(series).filter(([, s]) => s.length >= 3);
  if (!tenues.length) return null;

  const n = h.time.length;
  const out = { time: h.time.slice(), membres: tenues[0][1].length, q: {}, pluie: [] };
  for (const [cle] of tenues) {
    out.q[cle] = {};
    for (const b of BORNES) out.q[cle][b] = [];
  }
  const r = x => Math.round(x * 10) / 10;

  for (let i = 0; i < n; i++) {
    for (const [cle, ser] of tenues) {
      const v = [];
      for (const s of ser) {
        const x = s[i];
        if (x !== null && x !== undefined) v.push(x);
      }
      const q = out.q[cle];
      if (!v.length) {
        for (const b of BORNES) q[b].push(null);
        continue;
      }
      v.sort((a, b) => a - b);
      q.mini.push(r(v[0]));
      q.bas.push(r(quantile(v, 0.25)));
      q.med.push(r(quantile(v, 0.5)));
      q.haut.push(r(quantile(v, 0.75)));
      q.maxi.push(r(v[v.length - 1]));
    }

    /* La part des scénarios qui font tomber quelque chose à cette heure. La
       pluie ne s'encadre pas : ses scénarios sont presque tous à zéro, et une
       bande de zéro à un demi-millimètre serait muette là où le comptage
       parle. */
    let mouilles = 0, comptes = 0;
    for (const s of pm) {
      const x = s[i];
      if (x === null || x === undefined) continue;
      comptes++;
      if (x >= LAME) mouilles++;
    }
    out.pluie.push(comptes ? Math.round((mouilles / comptes) * 100) : null);
  }
  return out;
}

/* Lit les scénarios pour un point, ou rend `null`. Une lecture qui échoue ne
   prive de rien : la prévision déterministe est déjà à l'écran, et l'enveloppe
   ne paraît simplement pas. */
export async function charger({ lat, lon }) {
  if (lat === null || lat === undefined) { charge = null; cleChargee = null; return null; }
  const cle = `${lat},${lon}|${MODELE}|${JOURS}j|${DEMANDEES.join("+")}`;
  /* Les scénarios de la commune précédente ne valent pas pour la nouvelle : ils
     sont oubliés avant la requête, sans quoi l'enveloppe d'un lieu se serait
     peinte sous la courbe d'un autre le temps d'un aller-retour. */
  if (cleChargee !== cle) { charge = null; cleChargee = cle; }
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && c.cle === cle && Date.now() - c.t < GARDE && c.d?.time?.includes(cleHeure())) {
      charge = c.d; return charge;
    }
  } catch { /* cache indisponible */ }

  let d = null;
  try {
    const r = await fetch(`${SERVICE}?latitude=${lat}&longitude=${lon}`
      + `&timezone=Europe%2FParis&hourly=${DEMANDEES.join(",")}`
      + `&models=${MODELE}&forecast_days=${JOURS}`);
    if (r.ok) d = reduire((await r.json()).hourly);
  } catch { d = null; }
  charge = d;
  if (d) {
    try { localStorage.setItem(CACHE, JSON.stringify({ cle, t: Date.now(), d })); }
    catch { /* quota atteint, la garde n'est pas indispensable */ }
  }
  return d;
}

/* Les quantiles alignés sur une série horaire, dans son ordre et sur sa
   longueur. L'ensemble ne porte pas les journées écoulées et s'arrête où il
   s'arrête : les heures qu'il ne couvre pas valent `null`, et le tracé les
   saute plutôt que de les coudre à zéro.

   Rend `null` quand aucune heure de la série n'est couverte, ce qui évite aux
   appelants d'avoir à distinguer l'absence du silence. */
export function alignerSur(serie) {
  if (!charge || !Array.isArray(serie?.jour) || !serie.n) return null;
  const rang = new Map(charge.time.map((t, i) => [t, i]));
  const out = { q: {}, pluie: [], membres: charge.membres, n: 0 };
  for (const cle of Object.keys(charge.q)) {
    out.q[cle] = {};
    for (const b of BORNES) out.q[cle][b] = [];
  }
  for (let k = 0; k < serie.n; k++) {
    const h = String(serie.heure[k]).padStart(2, "0");
    const i = rang.get(`${serie.jour[k]}T${h}:00`);
    for (const cle of Object.keys(out.q)) {
      for (const b of BORNES) {
        out.q[cle][b].push(i === undefined ? null : charge.q[cle][b][i]);
      }
    }
    out.pluie.push(i === undefined ? null : charge.pluie[i]);
    if (i !== undefined) out.n++;
  }
  return out.n ? out : null;
}

export function oublier() {
  charge = null;
  cleChargee = null;
  try { localStorage.removeItem(CACHE); } catch { /* rien à faire */ }
}
