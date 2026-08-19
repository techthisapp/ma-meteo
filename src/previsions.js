/* Prévision Open-Meteo.

   Trois requêtes, mises en cache une heure. Le quotidien garde la sélection
   automatique de modèle : elle seule couvre les sept jours, là où AROME s'arrête
   à deux. L'horaire est demandé deux fois, une fois en sélection automatique et
   une fois avec les deux modèles de Météo-France forcés, la seconde étant posée
   par-dessus la première.

   Rien de ce qui est au-dessus de ce module ne sait qu'il existe deux modèles. */

import { cleJour, cleHeure, heureCle } from "./horloge.js";

const CACHE = "mameteo.previsions.v1";
const TTL = 3600 * 1000;

/* AROME France HD tient la maille la plus fine, 1,5 km, mais ne publie qu'une
   sélection réduite de variables. Les grandeurs qu'il ne porte pas retombaient
   sur la sélection automatique, c'est-à-dire possiblement sur un modèle allemand
   ou sur ARPEGE à onze kilomètres, alors qu'AROME France les publie à 2,5 km.
   Les deux sont demandés dans un seul appel, ce qui ne coûte pas de requête de
   plus. */
const AROME = ["meteofrance_arome_france_hd", "meteofrance_arome_france"];

const QUOTIDIEN = [
  "weather_code", "temperature_2m_max", "temperature_2m_min",
  "precipitation_sum", "precipitation_probability_max", "wind_speed_10m_max",
  "sunrise", "sunset", "daylight_duration",
].join(",");

const HORAIRE = [
  "temperature_2m", "apparent_temperature", "dew_point_2m",
  "relative_humidity_2m", "precipitation", "precipitation_probability",
  "weather_code", "cloud_cover", "pressure_msl", "wind_speed_10m",
  "wind_gusts_10m", "wind_direction_10m", "uv_index", "is_day",
].join(",");

/* Quatorze jours d'antériorité. « Mon jardin » en demandait trente, calés sur la
   mise en route du réservoir de son bilan hydrique. Sans lui, quatorze suffisent
   à comparer la pluie mesurée au poste et la pluie annoncée. */
const PASSE = 14;

let charge = null;
let heureCharge = null;

export const chargeCourante = () => charge;

/* Superposition d'une série sur une autre, colonne par colonne. Une colonne
   entièrement vide chez le modèle du dessus est ignorée et la série de secours
   reste seule ; dans une colonne renseignée, une heure vide se replie sur la
   valeur de secours. */
function fondre(fond, dessus) {
  if (!fond?.time || !Array.isArray(dessus?.time)) return fond;
  const rang = new Map(dessus.time.map((t, i) => [t, i]));
  const venues = [];
  const out = { time: fond.time, aromeColonnes: venues };
  for (const c of Object.keys(fond)) {
    if (c === "time" || c === "aromeColonnes" || !Array.isArray(fond[c])) { out[c] = fond[c]; continue; }
    const src = dessus[c];
    if (!Array.isArray(src) || src.every(v => v === null || v === undefined)) { out[c] = fond[c]; continue; }
    venues.push(c);
    out[c] = fond[c].map((v, i) => {
      const j = rang.get(fond.time[i]);
      const w = j === undefined ? null : src[j];
      return w === null || w === undefined ? v : w;
    });
  }
  return out;
}

/* Une réponse à plusieurs modèles porte ses colonnes suffixées du nom du modèle,
   une réponse à un seul les porte nues. Les deux formes sont acceptées : le
   comportement réel n'a jamais pu être observé, le chemin de l'API étant fermé
   aux robots. La fonction rend une série par modèle, du plus grossier au plus
   fin, si bien que le plus fin est appliqué en dernier et l'emporte. */
function separerModeles(brut, modeles) {
  const suffixes = modeles.map(m => `_${m}`);
  const nu = Object.keys(brut).some(c => c !== "time" && !suffixes.some(x => c.endsWith(x)));
  if (nu) return [brut];
  const series = modeles.map(m => {
    const suf = `_${m}`;
    const out = { time: brut.time };
    let porte = false;
    for (const c of Object.keys(brut)) {
      if (c === "time" || !c.endsWith(suf)) continue;
      out[c.slice(0, -suf.length)] = brut[c];
      porte = true;
    }
    return porte ? out : null;
  }).filter(Boolean);
  return series.reverse();
}

/* La dernière série horaire connue, reprise du cache quand la requête échoue.
   Elle ne sert que si elle couvre encore l'heure en cours : une série de la
   veille rendrait une fenêtre entièrement passée. */
function horaireRepris(cle) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (!c || c.cle !== cle || !c.d?.hourly) return null;
    return c.d.hourly.time.includes(cleHeure()) ? c.d.hourly : null;
  } catch { return null; }
}

/* Sur un réseau à une barre, une seule requête qui échoue suffisait à vider la
   feuille. L'horaire est donc réessayé une fois, AROME part après le premier
   couple plutôt qu'avec lui, et une série qui manque est reprise de la dernière
   charge connue tant qu'elle couvre l'heure en cours. */
async function prendre(url, essais) {
  for (let k = 0; k <= essais; k++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* réseau indisponible, on retente */ }
  }
  return null;
}

export async function charger({ lat, lon }) {
  if (lat === null || lat === undefined) { charge = null; return null; }
  const cle = `${lat},${lon}`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && c.cle === cle && c.h === heureCle() && Date.now() - c.t < TTL) {
      charge = c.d; heureCharge = c.h; return charge;
    }
  } catch { /* cache indisponible */ }

  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&timezone=Europe%2FParis`;
  const uq = `${base}&daily=${QUOTIDIEN}&past_days=${PASSE}&forecast_days=7`;
  const uh = `${base}&hourly=${HORAIRE}&forecast_days=2`;
  const ua = `${uh}&models=${AROME.join(",")}`;

  try {
    const [q, h] = await Promise.all([prendre(uq, 1), prendre(uh, 1)]);
    if (!q?.daily) throw new Error("quotidien indisponible");
    charge = q;
    charge.hourly = h?.hourly || horaireRepris(cle);
    /* La série de secours est gardée entière à côté de la série fondue : c'est
       elle qui permet de dire, plus tard, que les deux modèles ne s'accordent
       pas sur la pluie. */
    charge.horaireSecours = charge.hourly || null;
    if (charge.hourly && h?.hourly) {
      const av = await prendre(ua, 0);
      if (av?.hourly) {
        for (const serie of separerModeles(av.hourly, AROME)) {
          charge.hourly = fondre(charge.hourly, serie);
        }
      }
    }
    heureCharge = heureCle();
    try {
      localStorage.setItem(CACHE, JSON.stringify({ cle, t: Date.now(), h: heureCharge, d: charge }));
    } catch { /* quota atteint, le cache n'est pas indispensable */ }
    return charge;
  } catch {
    charge = null;
    return null;
  }
}

// Index du jour en cours dans la série quotidienne.
export const iJour = () => (charge?.daily ? charge.daily.time.indexOf(cleJour(new Date())) : -1);

// Index de l'heure en cours dans la série horaire.
export const iHeure = () => (charge?.hourly ? charge.hourly.time.indexOf(cleHeure()) : -1);

/* Les vingt-quatre heures à venir, à partir de l'heure en cours. La fenêtre
   traverse minuit : le soir, la journée écoulée n'apprend plus rien.

   Rend `null` quand les rafales manquent, ce qui arrive avec une charge
   enregistrée par une version antérieure, ou quand la fenêtre porte moins de
   huit heures. Les appelants doivent traiter le cas. */
export function serieHoraire() {
  const i = iHeure();
  const h = charge?.hourly;
  if (i < 0 || !h?.wind_gusts_10m) return null;
  const n = Math.min(24, h.time.length - i);
  if (n < 8) return null;

  /* Un trou dans la charge n'est pas une valeur nulle. Zéro degré en août
     déclenchait « gel probable », un indice UV nul à midi ouvrait un créneau en
     plein soleil, un jour marqué nuit dessinait une lune à quatorze heures. Les
     grandeurs continues reprennent la valeur connue la plus proche, avant ou
     après. Une lame de pluie vaut bien zéro quand rien n'est annoncé :
     interpoler y inventerait de l'eau. */
  const p = (c, cumul) => {
    const b = (h[c] || []).slice(i, i + n).map(v => (v === null || v === undefined ? null : v));
    if (cumul) return b.map(v => (v === null ? 0 : v));
    let der = null;
    const out = b.map(v => (v === null ? der : (der = v)));
    let suiv = null;
    for (let k = n - 1; k >= 0; k--) {
      if (b[k] !== null) suiv = b[k];
      else if (out[k] === null) out[k] = suiv;
    }
    return out.map(v => (v === null ? 0 : v));
  };

  const mmS = (() => {
    const b = charge.horaireSecours;
    if (!Array.isArray(b?.precipitation) || !Array.isArray(b?.time)) return null;
    const r = new Map(b.time.map((t, k) => [t, k]));
    return h.time.slice(i, i + n).map(t => {
      const k = r.get(t);
      const v = k === undefined ? null : b.precipitation[k];
      return v === null || v === undefined ? 0 : v;
    });
  })();

  return {
    n,
    heure: h.time.slice(i, i + n).map(t => Number(t.slice(11, 13))),
    jour: h.time.slice(i, i + n).map(t => t.slice(0, 10)),
    t: p("temperature_2m"), res: p("apparent_temperature"), ros: p("dew_point_2m"),
    hum: p("relative_humidity_2m"), mm: p("precipitation", true),
    pb: p("precipitation_probability"), code: p("weather_code"),
    nua: p("cloud_cover"), pres: p("pressure_msl"),
    v: p("wind_speed_10m"), raf: p("wind_gusts_10m"), dir: p("wind_direction_10m"),
    uv: p("uv_index"), clair: p("is_day"),
    mmS,
  };
}

/* Deux modèles chargés, un seul qui annonce la pluie : la prévision est alors
   incertaine, et le dire vaut mieux que trancher en silence. Le seuil est décidé
   par ce qui change une décision : un millimètre d'un côté et rien de l'autre.
   C'est le rapport qui décide, un contre quatre, avec un plancher d'un
   millimètre pour que des dixièmes ne parlent pas. */
export function divergencePluie(s) {
  if (!s?.mmS) return null;
  const a = s.mm.reduce((x, y) => x + y, 0);
  const b = s.mmS.reduce((x, y) => x + y, 0);
  const haut = Math.max(a, b), bas = Math.min(a, b);
  if (haut < 1 || bas > haut / 4) return null;
  return { haut, bas, arome: a > b };
}

// Sévérité d'un code de temps, pour retenir le ciel dominant d'une tranche.
export const graviteCiel = c => (c >= 95 ? 100 : c >= 80 ? 90 : c >= 71 ? 80 : c >= 51 ? 70 : c);

/* Ce qu'une journée civile vaut d'après la série horaire.

   La table de la semaine lisait la charge quotidienne, qui vient de la sélection
   automatique, quand les heures viennent d'AROME. Le même dimanche y portait
   vingt-neuf degrés et trente-deux, « orage » et « couvert » : deux sources pour
   un seul jour font des contradictions dans une même feuille. La table prend
   donc les heures là où elles couvrent la journée entière, et la charge
   quotidienne au-delà. Une journée trouée ne se résume pas et rend la main. */
export function jourHoraire(date) {
  const h = charge?.hourly;
  if (!Array.isArray(h?.time)) return null;
  const k = [];
  h.time.forEach((t, j) => { if (t.slice(0, 10) === date) k.push(j); });
  if (k.length < 24) return null;
  const val = (c, j) => {
    const v = (h[c] || [])[j];
    return v === null || v === undefined ? null : v;
  };
  const t = k.map(j => val("temperature_2m", j)).filter(v => v !== null);
  if (t.length < k.length) return null;
  const ih = iHeure();
  return {
    tx: Math.max(...t), tn: Math.min(...t),
    mm: k.reduce((a, j) => a + (val("precipitation", j) || 0), 0),
    /* Ce qui est déjà tombé dans la journée en cours. La table donne la journée
       civile, les heures partent de maintenant : trois millimètres tombés à
       trois heures du matin manquaient à l'appel sans que rien ne le dise. */
    passe: ih < 0 ? 0
      : k.filter(j => j < ih).reduce((a, j) => a + (val("precipitation", j) || 0), 0),
    pb: Math.max(...k.map(j => val("precipitation_probability", j) || 0)),
    raf: Math.max(...k.map(j => val("wind_gusts_10m", j) || 0)),
    code: k.reduce((a, j) => {
      const c = val("weather_code", j);
      return c !== null && graviteCiel(c) > graviteCiel(a) ? c : a;
    }, 0),
  };
}

// Les plages d'heures consécutives qui vérifient une condition.
export function plagesDe(n, test) {
  const out = [];
  for (let k = 0; k < n;) {
    if (!test(k)) { k++; continue; }
    let j = k;
    while (j < n && test(j)) j++;
    out.push([k, j - 1]);
    k = j;
  }
  return out;
}

/* La feuille promet une relecture toutes les heures. Le cache la permettait,
   rien ne la déclenchait : le retour au premier plan la relit quand l'heure a
   changé, et pas plus souvent. */
export function surRetourAuPremierPlan(rappel) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (heureCharge === null || heureCharge === heureCle()) return;
    rappel();
  });
}

const CARDINAUX = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
export const CARD_ABR = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const iCard = d => Math.round((((d % 360) + 360) % 360) / 45) % 8;
export const cardinal = d => CARDINAUX[iCard(d)];
// « de est » et « de ouest » ne se disent pas.
export const dCardinal = d => {
  const c = cardinal(d);
  return (c[0] === "e" || c[0] === "o" ? "d'" : "de ") + c;
};
