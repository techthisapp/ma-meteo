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
const GRANDEURS = ["temperature_2m", "precipitation"];
const JOURS = 7;
const CACHE = "mameteo.ensemble.v1";

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
function reduire(h) {
  if (!Array.isArray(h?.time)) return null;
  const membres = c => Object.keys(h)
    .filter(x => x === c || x.startsWith(`${c}_member`))
    .map(x => h[x]).filter(Array.isArray);

  const tm = membres("temperature_2m");
  const pm = membres("precipitation");
  if (tm.length < 3) return null;

  const n = h.time.length;
  const out = {
    time: h.time.slice(), membres: tm.length,
    mini: [], bas: [], med: [], haut: [], maxi: [], pluie: [],
  };
  for (let i = 0; i < n; i++) {
    const v = [];
    for (const s of tm) {
      const x = s[i];
      if (x !== null && x !== undefined) v.push(x);
    }
    if (!v.length) {
      out.mini.push(null); out.bas.push(null); out.med.push(null);
      out.haut.push(null); out.maxi.push(null); out.pluie.push(null);
      continue;
    }
    v.sort((a, b) => a - b);
    const r = x => Math.round(x * 10) / 10;
    out.mini.push(r(v[0]));
    out.bas.push(r(quantile(v, 0.25)));
    out.med.push(r(quantile(v, 0.5)));
    out.haut.push(r(quantile(v, 0.75)));
    out.maxi.push(r(v[v.length - 1]));

    /* La part des scénarios qui font tomber quelque chose à cette heure. Elle ne
       sert pas encore, le comptage des scénarios venant avec le lot suivant,
       mais elle est réduite ici : garder les quarante séries de pluie pour la
       calculer plus tard reviendrait à garder la charge brute. */
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
  const cle = `${lat},${lon}|${MODELE}|${JOURS}j`;
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
      + `&timezone=Europe%2FParis&hourly=${GRANDEURS.join(",")}`
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
  const out = { mini: [], bas: [], med: [], haut: [], maxi: [], pluie: [],
    membres: charge.membres, n: 0 };
  for (let k = 0; k < serie.n; k++) {
    const h = String(serie.heure[k]).padStart(2, "0");
    const i = rang.get(`${serie.jour[k]}T${h}:00`);
    for (const c of ["mini", "bas", "med", "haut", "maxi", "pluie"]) {
      out[c].push(i === undefined ? null : charge[c][i]);
    }
    if (i !== undefined) out.n++;
  }
  return out.n ? out : null;
}

/* La dispersion d'une heure, en degrés, ou `null`. C'est l'étendue des
   scénarios : ce que l'écran écrira si elle vaut la peine d'être dite. */
export function dispersion(quand = new Date()) {
  if (!charge) return null;
  const i = charge.time.indexOf(cleHeure(quand));
  if (i < 0 || charge.mini[i] === null) return null;
  return {
    mini: charge.mini[i], bas: charge.bas[i], med: charge.med[i],
    haut: charge.haut[i], maxi: charge.maxi[i],
    etendue: Math.round((charge.maxi[i] - charge.mini[i]) * 10) / 10,
    membres: charge.membres,
  };
}

export function oublier() {
  charge = null;
  cleChargee = null;
  try { localStorage.removeItem(CACHE); } catch { /* rien à faire */ }
}
