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

import { cleHeure, chercher } from "./horloge.js";

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
export async function charger({ lat, lon }, fetcheur = chercher) {
  if (lat === null || lat === undefined) { charge = null; cleChargee = null; return null; }
  const cle = `${lat},${lon}|${MODELES.icon.id}+${MODELES.ecmwf.id}`;
  /* Les scénarios de la commune précédente sont oubliés dès la demande, et une
     réponse arrivée après un changement de commune est ignorée : audit du
     1er octobre 2026, constat 1.2. La confiance d'un lieu se lisait sinon sous
     le nom d'un autre. */
  if (cleChargee !== cle) { charge = null; cleChargee = cle; }
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && c.cle === cle && Date.now() - c.t < GARDE) {
      charge = c.d; cleChargee = cle; return charge;
    }
  } catch { /* cache indisponible */ }
  const { icon, ecmwf } = await lireModeles(lat, lon, fetcheur).catch(() => ({ icon: null, ecmwf: null }));
  if (cleChargee !== cle) return null;
  if (!icon && !ecmwf) return charge;
  charge = { icon, ecmwf, h: cleHeure() };
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

/* La tendance au-delà de la confiance calculée, jalon 17, demandé par Jérôme le
   28 septembre 2026 : pousser La semaine au plus loin que les données portent.
   Le modèle américain GFS donne 31 scénarios sur 35 jours, remplis jusqu'au
   trente-quatrième ; ICON s'arrête à sept, ECMWF à quinze, la prévision à
   seize. Au-delà de quinze jours, un seul modèle ne donne plus qu'une
   indication : chaque journée se résume par la médiane des scénarios pour les
   températures, la moyenne pour la pluie et la part des scénarios où il tombe
   au moins un millimètre, sans mot de confiance. La tendance n'est lue qu'au
   premier « Voir plus » : l'ouverture de l'application n'en paie pas le prix. */
const CACHE_TENDANCE = "mameteo.tendance.v1";
const GARDE_TENDANCE = 6 * 3600 * 1000;
let tendance = null, cleTendance = null, echecTendance = null;
const cleDe = ({ lat, lon }) => `${lat},${lon}|gfs_seamless|35`;

export function reduireTendance(daily) {
  const tx = reduire(daily, "temperature_2m_max"), tn = reduire(daily, "temperature_2m_min"),
    mm = reduire(daily, "precipitation_sum");
  if (!tx || !tn || !mm) return [];
  return tx.time.map((t, k) => {
    const a = tx.membres[k], b = tn.membres[k], p = mm.membres[k];
    if (a.length < 5 || b.length < 5 || !p.length) return null;
    return { date: t, tx: quantile(a, 0.5), tn: quantile(b, 0.5), n: a.length,
      mm: Math.round(p.reduce((s, v) => s + v, 0) / p.length * 10) / 10,
      pb: Math.round(p.filter(v => v >= 1).length / p.length * 100) };
  }).filter(Boolean);
}

export async function chargerTendance(g, fetcheur = chercher) {
  if (!Number.isFinite(g?.lat)) return null;
  const cle = cleDe(g);
  if (tendance && cleTendance === cle) return tendance;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_TENDANCE) || "null");
    if (c && c.cle === cle && Date.now() - c.t < GARDE_TENDANCE) { tendance = c.d; cleTendance = cle; return tendance; }
  } catch { /* cache indisponible */ }
  try {
    const u = `${SERVICE}?latitude=${g.lat}&longitude=${g.lon}`
      + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=gfs_seamless&forecast_days=35&timezone=Europe%2FParis`;
    const r = await fetcheur(u);
    if (!r.ok) throw new Error(`tendance ${r.status}`);
    tendance = reduireTendance((await r.json()).daily);
    cleTendance = cle; echecTendance = null;
    try { localStorage.setItem(CACHE_TENDANCE, JSON.stringify({ cle, t: Date.now(), d: tendance })); } catch { /* plein */ }
    return tendance;
  } catch { echecTendance = cle; return null; }
}

export const tendancePour = g => (Number.isFinite(g?.lat) && cleTendance === cleDe(g) ? tendance : null);
export const tendanceEnEchec = g => Number.isFinite(g?.lat) && echecTendance === cleDe(g);
