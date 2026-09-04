/* L'air qu'on respire.

   Un second point d'entrée de la même source, sans compte ni clé : les analyses
   européennes de Copernicus, servies par Open-Meteo. Un seul appel porte
   l'indice européen, les quatre polluants qui le composent, et les six pollens.
   Mesuré à Fain-lès-Moutiers le 3 septembre 2026 : 1505 octets compressés pour
   quatre-vingt-seize heures.

   La portée est de quatre jours, celle des pollens, la plus courte des deux.
   L'air seul irait à sept, mais deux requêtes de portées différentes pour un
   même écran coûteraient un appel de plus pour trois journées dont la feuille ne
   parle pas.

   Aucun seuil n'est inventé ici. Les six niveaux sont ceux de l'indice européen,
   par pas de vingt. Les deux seuils de chaque pollen sont ceux que le service de
   pollens de Copernicus emploie lui-même pour délimiter la saison et le pic. */

import { cleHeure } from "./horloge.js";

const SERVICE = "https://air-quality-api.open-meteo.com/v1/air-quality";
const JOURS = 4;
const CACHE = "mameteo.air.v1";

/* Trois heures de garde. Les analyses sont publiées une fois par jour et leur
   sortie horaire ne bouge pas entre deux publications : les relire à chaque
   heure, comme la prévision déterministe, coûterait plusieurs fois la bande
   passante pour la même donnée. C'est la garde des scénarios, pour la même
   raison. */
const GARDE = 3 * 3600 * 1000;

/* Les quatre polluants qui composent l'indice, dans l'ordre où ils se lisent.
   Les particules d'abord, ce sont elles qui décident le plus souvent ; l'ozone
   ensuite, qui décide l'été ; le dioxyde d'azote enfin, qui est un polluant de
   trafic et reste bas hors des villes. */
export const POLLUANTS = [
  ["pm25", "Particules fines", "pm2_5", "PM2,5"],
  ["pm10", "Particules", "pm10", "PM10"],
  ["o3", "Ozone", "ozone", "O₃"],
  ["no2", "Dioxyde d'azote", "nitrogen_dioxide", "NO₂"],
];

/* Les six pollens de la source, avec les deux seuils qu'elle emploie
   elle-même : au premier, la saison est ouverte ; au second, elle est à son
   pic. Aulne, bouleau, olivier et armoise ouvrent à dix grains par mètre cube
   et culminent à cent ; graminées et ambroisie, dont quelques grains suffisent
   à gêner, ouvrent à trois et culminent à cinquante.

   Les six sont demandés, quel que soit le profil : le profil décide de ce qui
   remonte sur l'accueil, non de ce que la source rend. Filtrer la requête
   ferait voyager une donnée de santé. */
export const POLLENS = [
  { cle: "aulne", nom: "Aulne", colonne: "alder_pollen", saison: 10, pic: 100 },
  { cle: "bouleau", nom: "Bouleau", colonne: "birch_pollen", saison: 10, pic: 100 },
  { cle: "graminees", nom: "Graminées", colonne: "grass_pollen", saison: 3, pic: 50 },
  { cle: "armoise", nom: "Armoise", colonne: "mugwort_pollen", saison: 10, pic: 100 },
  { cle: "olivier", nom: "Olivier", colonne: "olive_pollen", saison: 10, pic: 100 },
  { cle: "ambroisie", nom: "Ambroisie", colonne: "ragweed_pollen", saison: 3, pic: 50 },
];

/* Les six niveaux de l'indice européen. La borne est la valeur à partir de
   laquelle le niveau s'applique ; l'indice dépasse cent quand l'air est
   extrêmement mauvais, et n'a pas de plafond. */
export const NIVEAUX = [
  [0, "bon"],
  [20, "moyen"],
  [40, "dégradé"],
  [60, "mauvais"],
  [80, "très mauvais"],
  [100, "extrêmement mauvais"],
];

/* Le seuil au delà duquel l'air cesse d'être une donnée de fond et devient un
   fait. Il sert deux fois, et c'est le même nombre pour la même raison : une
   ligne paraît dans ce qui est à savoir, et l'heure cesse d'être une heure où
   l'on ouvre en grand. Quarante est l'entrée du niveau dégradé. */
export const DEGRADE = 40;

export const niveauDe = i => {
  if (!Number.isFinite(i)) return null;
  let n = NIVEAUX[0];
  for (const x of NIVEAUX) if (i >= x[0]) n = x;
  return { seuil: n[0], nom: n[1], rang: NIVEAUX.indexOf(n) };
};

/* L'état d'un pollen à une concentration donnée. Trois états et non une échelle
   continue : la source ne publie que deux bornes, et inventer des paliers
   intermédiaires donnerait une précision que la donnée n'a pas. */
export const etatPollen = (p, v) => {
  if (!Number.isFinite(v) || v < p.saison) return null;
  return v >= p.pic ? "pic" : "saison";
};

let charge = null;
let cleChargee = null;
export const chargeCourante = () => charge;

const nombre = (v, k) => {
  const x = Array.isArray(v) ? v[k] : null;
  return x === null || x === undefined ? null : x;
};

/* La charge gardée ne porte que ce qui se lit : l'indice, les quatre polluants,
   les six pollens. Les colonnes sont renommées à la lecture, une fois pour
   toutes, pour que le reste du dépôt ne connaisse pas les noms de la source. */
function reduire(h) {
  if (!Array.isArray(h?.time)) return null;
  const r1 = x => (x === null ? null : Math.round(x * 10) / 10);
  const out = { time: h.time.slice(), aqi: [], pollens: {} };
  for (const [cle] of POLLUANTS) out[cle] = [];
  for (const p of POLLENS) out.pollens[p.cle] = [];
  for (let i = 0; i < h.time.length; i++) {
    const a = nombre(h.european_aqi, i);
    out.aqi.push(a === null ? null : Math.round(a));
    for (const [cle, , colonne] of POLLUANTS) out[cle].push(r1(nombre(h[colonne], i)));
    for (const p of POLLENS) out.pollens[p.cle].push(r1(nombre(h[p.colonne], i)));
  }
  // Une charge sans une seule valeur d'indice ne vaut pas d'être gardée : hors
  // d'Europe, la source rend ses colonnes vides plutôt qu'une erreur.
  return out.aqi.some(v => v !== null) ? out : null;
}

/* Lit l'air pour un point, ou rend `null`. Une lecture qui échoue ne prive de
   rien : le temps qu'il fait est déjà à l'écran, et la porte de l'air dit
   simplement que la source est muette. */
export async function charger({ lat, lon }) {
  if (lat === null || lat === undefined) { charge = null; cleChargee = null; return null; }
  const colonnes = ["european_aqi", ...POLLUANTS.map(p => p[2]), ...POLLENS.map(p => p.colonne)];
  const cle = `${lat},${lon}|${JOURS}j|${colonnes.join("+")}`;
  /* L'air de la commune précédente ne vaut pas pour la nouvelle : il est oublié
     avant la requête, sans quoi l'indice d'un lieu se lirait sous le nom d'un
     autre le temps d'un aller-retour. */
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
      + `&timezone=Europe%2FParis&hourly=${colonnes.join(",")}&forecast_days=${JOURS}`);
    if (r.ok) d = reduire((await r.json()).hourly);
  } catch { d = null; }
  charge = d;
  if (d) {
    try { localStorage.setItem(CACHE, JSON.stringify({ cle, t: Date.now(), d })); }
    catch { /* quota atteint, la garde n'est pas indispensable */ }
  }
  return d;
}

/* L'air aligné sur une série horaire, dans son ordre et sur sa longueur. Les
   heures que la charge ne couvre pas valent `null` : sa portée est de quatre
   jours quand la prévision en porte sept, et une heure inconnue n'est pas une
   heure propre.

   Rend `null` quand aucune heure n'est couverte, ce qui évite aux appelants de
   distinguer l'absence du silence. */
export function alignerSur(serie) {
  if (!charge || !Array.isArray(serie?.jour) || !serie.n) return null;
  const rang = new Map(charge.time.map((t, i) => [t, i]));
  const out = { aqi: [], pollens: {}, n: 0 };
  for (const [cle] of POLLUANTS) out[cle] = [];
  for (const p of POLLENS) out.pollens[p.cle] = [];
  for (let k = 0; k < serie.n; k++) {
    const h = String(serie.heure[k]).padStart(2, "0");
    const i = rang.get(`${serie.jour[k]}T${h}:00`);
    out.aqi.push(i === undefined ? null : charge.aqi[i]);
    for (const [cle] of POLLUANTS) out[cle].push(i === undefined ? null : charge[cle][i]);
    for (const p of POLLENS) {
      out.pollens[p.cle].push(i === undefined ? null : charge.pollens[p.cle][i]);
    }
    if (i !== undefined) out.n++;
  }
  return out.n ? out : null;
}

/* Le pire moment de la fenêtre, avec son rang. Il ne se dit que s'il dépasse le
   moment présent : « au plus haut, dégradé vers 15 h » n'apprend rien quand
   c'est déjà le cas maintenant. */
export function pire(air) {
  if (!air?.aqi?.length) return null;
  let k = -1;
  for (let i = 0; i < air.aqi.length; i++) {
    if (air.aqi[i] === null) continue;
    if (k < 0 || air.aqi[i] > air.aqi[k]) k = i;
  }
  return k < 0 ? null : { k, indice: air.aqi[k] };
}

/* Les pollens en saison sur la fenêtre, du plus fort au moins fort. Un taxon
   hors saison ne rend rien plutôt qu'une ligne à zéro : trois des six sont
   plats à zéro pendant des mois, et une file de zéros occuperait la moitié de
   l'écran pour ne rien dire. */
export function enSaison(air) {
  if (!air?.pollens) return [];
  const out = [];
  for (const p of POLLENS) {
    const v = air.pollens[p.cle] || [];
    let k = -1;
    for (let i = 0; i < v.length; i++) {
      if (v[i] === null) continue;
      if (k < 0 || v[i] > v[k]) k = i;
    }
    if (k < 0) continue;
    const etat = etatPollen(p, v[k]);
    if (!etat) continue;
    out.push({ ...p, k, valeur: v[k], etat });
  }
  return out.sort((a, b) => b.valeur / b.pic - a.valeur / a.pic);
}
