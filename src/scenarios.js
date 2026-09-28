/* Les scénarios quotidiens de deux modèles, pour la confiance de La semaine.

   Jalon 13, lot 2, demandé par Jérôme le 28 septembre 2026 : employer les deux
   modèles de scénarios disponibles, pour comparer, avec une confiance mixte là
   où ils se recouvrent. ICON donne 40 membres sur sept jours, ECMWF 51 sur
   quinze. Le service rend directement le maximum et le minimum de chaque
   membre pour chaque journée : la charge reste légère, sans les heures.

   Le module horaire, ensemble.js, reste celui du ruban, dont il nourrit les
   enveloppes heure par heure ; celui-ci ne sert qu'aux journées.

   Mesure du 28 septembre 2026 sur Montbard, Paris, Lecci et Brest, du dixième
   au quatre-vingt-dixième centile du maximum : les deux modèles se dispersent
   de 1,8 à 2,7 degrés jusqu'à quatre jours et de 3,2 à 4,4 à cinq et six jours ;
   réunis, de 2,3 à 4,4, plus large là où leurs médianes divergent ; ECMWF seul,
   de 5,4 à 7,9 de sept à quatorze jours. */

import { cleHeure } from "./horloge.js";

const SERVICE = "https://ensemble-api.open-meteo.com/v1/ensemble";
/* Les deux modèles se demandent dans une seule requête : le service les rend
   côte à côte, chaque colonne suffixée par son modèle, et ICON vide au-delà de
   ses sept jours. Deux requêtes coûtaient une ouverture de connexion de plus,
   ce que les gardes du réseau ont relevé. */
export const MODELES = {
  icon: { id: "icon_seamless", suffixe: "icon_seamless_eps", nom: "ICON" },
  ecmwf: { id: "ecmwf_ifs025", suffixe: "ecmwf_ifs025_ensemble", nom: "ECMWF" },
};
const JOURS = 15;
const CACHE = "mameteo.scenarios.v1";
/* Trois heures de garde, comme les scénarios horaires : les deux ensembles
   tournent toutes les six heures au mieux. */
const GARDE = 3 * 3600 * 1000;

let charge = null;
let cleChargee = null;

/* Les membres d'une journée, pour une grandeur quotidienne : une colonne par
   membre dans la réponse, `temperature_2m_max` puis `_member01` et suivants. */
export function reduire(daily, grandeur, suffixe = null) {
  if (!daily?.time) return null;
  const cols = Object.keys(daily).filter(k => (suffixe
    ? k.startsWith(grandeur) && k.endsWith(`_${suffixe}`)
    : k === grandeur || k.startsWith(`${grandeur}_member`)));
  if (!cols.length) return null;
  return {
    time: daily.time,
    membres: daily.time.map((_, i) => cols.map(k => daily[k][i]).filter(Number.isFinite)),
  };
}

export function quantile(v, p) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const x = p * (s.length - 1), a = Math.floor(x);
  return s[a] + (s[Math.min(a + 1, s.length - 1)] - s[a]) * (x - a);
}

const resume = v => (v && v.length >= 5
  ? { n: v.length, p10: quantile(v, 0.1), med: quantile(v, 0.5), p90: quantile(v, 0.9) } : null);

/* Ce que les deux modèles disent du maximum d'une journée : la fourchette de
   chacun, celle des membres réunis, et l'écart entre leurs médianes. La
   dispersion retenue pour la confiance est celle des membres réunis là où les
   deux modèles couvrent la journée, celle du seul qui la couvre ailleurs. */
export function jour(date, c = charge) {
  if (!c) return null;
  const de = m => {
    const r = c[m]; if (!r) return null;
    const i = r.time.indexOf(date);
    return i < 0 ? null : r.membres[i];
  };
  const vi = de("icon"), ve = de("ecmwf");
  const icon = resume(vi), ecmwf = resume(ve);
  if (!icon && !ecmwf) return null;
  const reunis = resume([...(icon ? vi : []), ...(ecmwf ? ve : [])]);
  return {
    icon, ecmwf, reunis,
    etendue: Math.round((reunis.p90 - reunis.p10) * 10) / 10,
    ecart: icon && ecmwf ? Math.round(Math.abs(icon.med - ecmwf.med) * 10) / 10 : null,
    source: icon && ecmwf ? "mixte" : icon ? "icon" : "ecmwf",
  };
}

async function lireModeles(lat, lon, fetcheur) {
  const u = `${SERVICE}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max`
    + `&models=${MODELES.icon.id},${MODELES.ecmwf.id}&forecast_days=${JOURS}&timezone=Europe%2FParis`;
  const r = await fetcheur(u);
  if (!r.ok) throw new Error(`scénarios ${r.status}`);
  const daily = (await r.json()).daily;
  const un = m => {
    const x = reduire(daily, "temperature_2m_max", MODELES[m].suffixe);
    return x && x.membres.some(v => v.length) ? x : null;
  };
  return { icon: un("icon"), ecmwf: un("ecmwf") };
}

/* La charge des deux modèles pour une commune. Un modèle muet ne prive pas
   l'autre : chacun se lit à part, et la confiance se contente de celui qui a
   répondu. Rend null si aucun n'a répondu. */
export async function charger({ lat, lon }, fetcheur = fetch) {
  if (lat === null || lat === undefined) { charge = null; cleChargee = null; return null; }
  const cle = `${lat},${lon}|${MODELES.icon.id}+${MODELES.ecmwf.id}`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && c.cle === cle && Date.now() - c.t < GARDE) {
      charge = c.d; cleChargee = cle; return charge;
    }
  } catch { /* cache indisponible */ }
  const { icon, ecmwf } = await lireModeles(lat, lon, fetcheur).catch(() => ({ icon: null, ecmwf: null }));
  if (!icon && !ecmwf) return cleChargee === cle ? charge : null;
  charge = { icon, ecmwf, h: cleHeure() };
  cleChargee = cle;
  try { localStorage.setItem(CACHE, JSON.stringify({ cle, t: Date.now(), d: charge })); } catch { /* plein */ }
  return charge;
}

export const chargee = () => charge;

/* Trois mots pour la dispersion quotidienne, du dixième au quatre-vingt-
   dixième centile du maximum. Les seuils de l'ensemble horaire, trois et six,
   étaient mesurés sur une autre grandeur, la dispersion moyenne des heures ;
   appliqués ici, ils tombaient au milieu des valeurs ordinaires des quatre
   premiers jours. Mesurés le 28 septembre 2026 : de 2,3 à 3,5 degrés jusqu'à
   quatre jours, de 3,3 à 4,4 à cinq et six jours, de 5,4 à 7,9 au-delà. Les
   seuils tombent donc à quatre et à sept. */
export const ACCORDS = [
  [0, "bonne"],
  [4, "moyenne"],
  [7, "faible"],
];
export function accordDe(etendue) {
  let a = ACCORDS[0];
  for (const x of ACCORDS) if (etendue >= x[0]) a = x;
  return a[1];
}

/* Pour les contrôles : poser une charge connue. */
export const poser = c => { charge = c; };
