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

/* La portée demandée à la source. Elle entre dans la clé du cache : le jour où
   elle change, la charge gardée sous l'ancienne forme cesse d'être servie
   d'elle-même.

   Sans cela, une charge écrite par la version d'avant, qui ne demandait que
   deux jours d'heures, restait servie jusqu'à la fin de l'heure en cours. Le
   nouveau code tournait sur l'ancienne donnée, et la semaine ne s'ouvrait que
   sur ses deux premières journées. */
const JOURS = 7;
const JOURS_AROME = 3;

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
  const cle = `${lat},${lon}|${JOURS}j|${JOURS_AROME}a`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && c.cle === cle && c.h === heureCle() && Date.now() - c.t < TTL) {
      charge = c.d; heureCharge = c.h; return charge;
    }
  } catch { /* cache indisponible */ }

  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&timezone=Europe%2FParis`;
  /* Les heures portent sur les sept jours, comme la charge quotidienne : c'est
     d'elles que la semaine tire ses moments. Le surcoût est de deux kilooctets
     compressés, une fois par heure, gardés en cache.

     AROME ne va pas au delà d'environ soixante-neuf heures. Le lui demander sur
     sept jours ne rendrait que des colonnes vides : sa requête reste à trois
     jours, et la fusion laisse le modèle global au delà. */
  const uq = `${base}&daily=${QUOTIDIEN}&past_days=${PASSE}&forecast_days=${JOURS}`;
  const uh = `${base}&hourly=${HORAIRE}&forecast_days=${JOURS}`;
  const ua = `${base}&hourly=${HORAIRE}&forecast_days=${JOURS_AROME}`
    + `&models=${AROME.join(",")}`;

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

/* ---------- Aperçu des communes suivies ----------

   Open-Meteo accepte plusieurs couples de coordonnées dans un seul appel et rend
   un tableau dans le même ordre. Dix communes suivies coûtent donc une requête,
   non dix. Le résultat est gardé un quart d'heure, et le dernier connu reste
   servi hors ligne : une liste sans température vaut moins qu'une température
   d'il y a dix minutes, à condition de ne pas la faire passer pour l'instant. */

const CACHE_APERCUS = "mameteo.apercus.v1";
const TTL_APERCUS = 15 * 60 * 1000;

const lireApercus = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_APERCUS) || "null"); }
  catch { return null; }
};

export async function apercus(lieux) {
  const liste = (lieux || []).filter(l => l && l.lat !== null && l.lon !== null);
  if (!liste.length) return { par: {}, age: 0 };

  const cle = liste.map(l => `${l.lat},${l.lon}`).join(";");
  const c = lireApercus();
  if (c && c.cle === cle && Date.now() - c.t < TTL_APERCUS) {
    return { par: c.par, age: Date.now() - c.t };
  }

  const u = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${liste.map(l => l.lat).join(",")}`
    + `&longitude=${liste.map(l => l.lon).join(",")}`
    + "&current=temperature_2m,weather_code,is_day"
    + "&daily=temperature_2m_max,temperature_2m_min"
    + "&timezone=Europe%2FParis&forecast_days=1";

  const d = await prendre(u, 1);
  if (!d) {
    // Hors ligne : le dernier aperçu connu, avec son âge, ou rien.
    return c ? { par: c.par, age: Date.now() - c.t } : { par: {}, age: null };
  }

  // Un seul lieu rend un objet, plusieurs rendent un tableau.
  const tab = Array.isArray(d) ? d : [d];
  const par = {};
  liste.forEach((l, k) => {
    const x = tab[k];
    if (!x?.current) return;
    par[`${l.lat},${l.lon}`] = {
      t: x.current.temperature_2m,
      code: x.current.weather_code,
      jour: x.current.is_day === 1,
      tn: x.daily?.temperature_2m_min?.[0] ?? null,
      tx: x.daily?.temperature_2m_max?.[0] ?? null,
    };
  });

  try {
    localStorage.setItem(CACHE_APERCUS, JSON.stringify({ cle, t: Date.now(), par }));
  } catch { /* quota atteint */ }
  return { par, age: 0 };
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
/* La fenêtre part de l'heure en cours, décalée de `depart` heures, et court sur
   `duree` heures. Les valeurs par défaut donnent les vingt-quatre heures à
   venir, qui servent au ruban et à la table des moments. L'accueil s'en sert
   aussi pour la fin de la journée en cours et pour les deux journées suivantes,
   d'où le minimum réglable : quatre heures avant minuit sont une fenêtre
   légitime, alors qu'un ruban de quatre heures n'en est pas une. */
export function serieHoraire(depart = 0, duree = 24, minimum = 8) {
  const i = iHeure() + depart;
  const h = charge?.hourly;
  if (i < 0 || !h?.wind_gusts_10m) return null;
  const n = Math.min(duree, h.time.length - i);
  if (n < minimum) return null;

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

  /* La lame de secours vient d'AROME, qui ne porte que sur trois jours. Au delà
     de sa portée elle n'existe pas, et la compter pour zéro ferait dire aux deux
     modèles qu'ils se contredisent alors qu'un seul parle. La série de secours
     s'arrête donc là où AROME s'arrête. */
  const mmS = (() => {
    const b = charge.horaireSecours;
    if (!Array.isArray(b?.precipitation) || !Array.isArray(b?.time)) return null;
    const r = new Map(b.time.map((t, k) => [t, k]));
    const out = [];
    for (const t of h.time.slice(i, i + n)) {
      const k = r.get(t);
      if (k === undefined) break;
      const v = b.precipitation[k];
      out.push(v === null || v === undefined ? 0 : v);
    }
    return out.length ? out : null;
  })();

  return {
    n,
    /* L'indice de l'heure en cours dans la fenêtre. Négatif quand la fenêtre
       commence après elle, ce qui n'arrive pas aujourd'hui mais dirait la
       vérité si cela arrivait. Le ruban s'en sert pour poser son repère. */
    ici: iHeure() - i,
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

/* L'horizon entier, de minuit du jour en cours jusqu'où porte la charge. C'est
   la série du ruban, dont la fenêtre glisse dessus : le passé de la journée y
   figure, et les sept jours annoncés aussi. La table des moments, elle, garde
   ses vingt-quatre heures à venir. */
export function serieHorizon() {
  const i = iHeure();
  if (i < 0 || !charge?.hourly) return null;
  return serieHoraire(-i, charge.hourly.time.length, 8);
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
/* Les quatre moments d'une journée civile : nuit, matin, après-midi, soirée,
   par tranches de six heures. Mêmes bornes que les moments de l'accueil.

   Rend `null` dès qu'une tranche n'est pas complète. Un après-midi résumé de
   trois heures sur six dirait autre chose que ce qu'il montre, et la journée
   ne doit alors pas s'ouvrir du tout. */
export function momentsJour(date) {
  const h = charge?.hourly;
  if (!Array.isArray(h?.time)) return null;

  const lots = [[], [], [], []];
  h.time.forEach((t, j) => {
    if (t.slice(0, 10) !== date) return;
    lots[Math.floor(Number(t.slice(11, 13)) / 6)].push(j);
  });
  if (lots.some(l => l.length !== 6)) return null;

  const val = (c, j) => {
    const v = (h[c] || [])[j];
    return v === null || v === undefined ? null : v;
  };

  const out = [];
  for (let q = 0; q < 4; q++) {
    const k = lots[q];
    const t = k.map(j => val("temperature_2m", j)).filter(v => v !== null);
    if (t.length < k.length) return null;
    out.push({
      q, h0: q * 6, h1: q * 6 + 6,
      tn: Math.min(...t), tx: Math.max(...t),
      mm: k.reduce((a, j) => a + (val("precipitation", j) || 0), 0),
      pb: Math.max(...k.map(j => val("precipitation_probability", j) || 0)),
      raf: Math.max(...k.map(j => val("wind_gusts_10m", j) || 0)),
      clair: k.some(j => val("is_day", j) === 1),
      code: k.reduce((a, j) => {
        const c = val("weather_code", j);
        return c !== null && graviteCiel(c) > graviteCiel(a) ? c : a;
      }, 0),
    });
  }
  return out;
}

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
    /* Les maximums de la journée civile. L'accueil les préfère aux valeurs de
       l'heure en cours : « indice UV 0 » à dix heures du soir ne dit rien de la
       journée, et un vent de onze kilomètres par heure relevé à cet instant
       n'annonce pas les quatre-vingts de l'après-midi. */
    v: Math.max(...k.map(j => val("wind_speed_10m", j) || 0)),
    hum: Math.max(...k.map(j => val("relative_humidity_2m", j) || 0)),
    uv: Math.max(...k.map(j => val("uv_index", j) || 0)),
    res: Math.max(...k.map(j => {
      const v = val("apparent_temperature", j);
      return v === null ? -99 : v;
    })),
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
