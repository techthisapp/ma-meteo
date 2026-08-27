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

/* Les grandeurs résumées, sous la clé de la voie qui les porte. Toutes ne se
   prêtent pas aux scénarios, et la source a été interrogée avant de choisir.

   La rafale et le vent moyen ont la dispersion la plus parlante après la
   température : seize kilomètres par heure d'étendue sur la rafale à trente-six
   heures d'échéance, contre cinq degrés sur la température.

   L'indice ultraviolet n'a pas de scénarios du tout, la source rendant ses
   colonnes vides : il se calcule de la position du Soleil et de la couverture
   nuageuse, il n'a pas de dispersion propre. La couverture nuageuse en a une de
   soixante-dix points sur une échelle de cent, où la bande remplirait la voie.
   Le point de rosée partage la voie de la température et redirait la même
   chose. */
const GRANDEURS = {
  t: "temperature_2m",
  v: "wind_speed_10m",
  raf: "wind_gusts_10m",
  mm: "precipitation",
};

/* Résumer n'est pas encadrer. La pluie est résumée comme les autres, mais sa
   voie ne porte pas de bande : ses scénarios sont presque tous à zéro et
   quelques-uns à quelques dixièmes, et une bande de zéro à un demi-millimètre
   est muette. Ce qu'elle a à dire tient en mots, la part des scénarios mouillés
   et l'étalement des quantités, ce que la probabilité affichée ne sait pas
   dire : relevé à Brest le 29 août à six heures, la source annonçait
   quatre-vingt-trois pour cent et un virgule un millimètre quand la médiane des
   scénarios donnait un virgule cinq et le plus arrosé quatre virgule six. */
export const ENCADREES = ["t", "v", "raf"];
const PLUIE = GRANDEURS.mm;
const DEMANDEES = Object.values(GRANDEURS);

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

/* Ce que les scénarios disent d'une journée civile, ou `null` quand ils ne la
   couvrent pas entière. L'ensemble porte sept jours annoncés et aucun jour
   écoulé : la table de la semaine lui demande neuf journées et n'en obtient
   qu'une partie, ce qui est normal et se dit par l'absence.

   `etendue` est la dispersion moyenne sur les heures de la journée, non celle
   d'une heure prise au hasard : une nuit calme sous un après-midi indécis ne
   doit pas passer pour une journée sûre. Les bornes du maximum, elles, disent
   la fourchette du chiffre que la table affiche. */
export function journee(date) {
  if (!charge?.q?.t) return null;
  const q = charge.q.t;
  const k = [];
  charge.time.forEach((t, i) => { if (t.slice(0, 10) === date) k.push(i); });
  if (k.length < 24) return null;
  const bons = k.filter(i => q.mini[i] !== null && q.maxi[i] !== null);
  if (bons.length < 24) return null;
  const somme = bons.reduce((a, i) => a + (q.maxi[i] - q.mini[i]), 0);
  /* L'heure la plus chaude au sens des scénarios, celle dont la médiane monte
     le plus haut : c'est le maximum de la journée que la table affiche. */
  let kx = bons[0];
  for (const i of bons) if (q.med[i] > q.med[kx]) kx = i;
  return {
    etendue: Math.round((somme / bons.length) * 10) / 10,
    mini: q.mini[kx], med: q.med[kx], maxi: q.maxi[kx],
    membres: charge.membres,
  };
}

/* Trois mots pour dire l'accord des scénarios sur une journée, et les seuils qui
   les séparent. Mesurés sur la source : la dispersion vaut environ deux degrés
   à un jour, cinq à deux jours et six à sept jours. Les seuils tombent donc à
   trois et six, où ils séparent le lendemain du reste de la semaine. */
export const ACCORDS = [
  [0, "bonne", "les scénarios s'accordent"],
  [3, "moyenne", "les scénarios s'écartent un peu"],
  [6, "faible", "les scénarios sont partagés"],
];
export function accordDe(etendue) {
  let a = ACCORDS[0];
  for (const x of ACCORDS) if (etendue >= x[0]) a = x;
  return { nom: a[1], phrase: a[2] };
}

export function oublier() {
  charge = null;
  cleChargee = null;
  try { localStorage.removeItem(CACHE); } catch { /* rien à faire */ }
}
