/* La météo des neiges, jalon 16. Lot 2 : les stations proches.

   Une station est proche si elle est à une heure de route au plus de la
   commune, décidé par Jérôme le 28 septembre 2026. Les stations à moins de
   100 kilomètres à vol d'oiseau sont présélectionnées dans la liste embarquée ;
   une seule requête au service public de calcul d'itinéraire OSRM donne
   ensuite la durée en voiture vers chacune. Le serveur public d'OSRM est une
   démonstration à la charge limitée : il n'est interrogé qu'une fois par
   commune, et le résultat se garde trente jours, puisqu'une route ne change
   pas d'un jour à l'autre. S'il ne répond pas, une estimation à vol d'oiseau
   prend le relais, 55 kilomètres valant environ une heure de route, et le
   résultat le dit. */

import { STATIONS } from "./stations.js";
import { distanceKm } from "./postes.js";

export const RAYON_KM = 100;
export const MINUTES_MAX = 60;
export const KM_PAR_HEURE_ESTIMEE = 55;
/* Quatre-vingts candidates : dans les Alpes, les quarante plus proches à vol
   d'oiseau pouvaient écarter des stations à moins d'une heure par la route. Le
   serveur public d'OSRM accepte cent points par requête. */
const CANDIDATES_MAX = 80;
const OSRM = "https://router.project-osrm.org/table/v1/driving/";
const CACHE = "mameteo.neige.proches.v1";
const GARDE = 30 * 24 * 3600 * 1000;

const deStation = s => ({ nom: s[0], pays: s[1], lat: s[2], lon: s[3], pied: s[4], sommet: s[5], km: s[6] });

/* Les stations à moins de cent kilomètres à vol d'oiseau, les plus proches
   d'abord, quatre-vingts au plus. */
export function candidates(g, liste = STATIONS) {
  return liste.map(deStation)
    .map(s => ({ ...s, vol: distanceKm(g.lat, g.lon, s.lat, s.lon) }))
    .filter(s => s.vol <= RAYON_KM)
    .sort((a, b) => a.vol - b.vol)
    .slice(0, CANDIDATES_MAX);
}

export function adresseOsrm(g, cands) {
  const pts = [[g.lon, g.lat], ...cands.map(s => [s.lon, s.lat])]
    .map(([lo, la]) => `${lo.toFixed(5)},${la.toFixed(5)}`).join(";");
  return `${OSRM}${pts}?sources=0&annotations=duration`;
}

/* Les stations à une heure au plus, avec leur durée en minutes, les plus
   proches d'abord. Sans réponse d'OSRM, l'estimation à vol d'oiseau, marquée
   comme telle. */
export async function proches(g, liste = STATIONS, fetcheur = fetch) {
  const cands = candidates(g, liste);
  if (!cands.length) return [];
  try {
    const r = await fetcheur(adresseOsrm(g, cands));
    if (!r.ok) throw new Error(`osrm ${r.status}`);
    const d = await r.json();
    const durees = d?.durations?.[0];
    if (d.code !== "Ok" || !Array.isArray(durees)) throw new Error("osrm sans durées");
    return cands.map((s, k) => ({ ...s, minutes: durees[k + 1] == null ? null : Math.round(durees[k + 1] / 60), estime: false }))
      .filter(s => s.minutes !== null && s.minutes <= MINUTES_MAX)
      .sort((a, b) => a.minutes - b.minutes);
  } catch {
    return cands.filter(s => s.vol <= KM_PAR_HEURE_ESTIMEE)
      .map(s => ({ ...s, minutes: Math.round((s.vol / KM_PAR_HEURE_ESTIMEE) * 60), estime: true }));
  }
}

/* Les stations proches d'une commune, gardées trente jours. */
export async function prochesGardees(g, fetcheur = fetch) {
  const cle = `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "{}");
    const e = c[cle];
    if (e && Date.now() - e.t < GARDE && !e.estime) return e.l;
  } catch { /* cache indisponible */ }
  const l = await proches(g, STATIONS, fetcheur);
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "{}");
    /* Une estimation ne se garde pas : la prochaine ouverture retentera OSRM. */
    c[cle] = { t: Date.now(), l, estime: l.some(s => s.estime) };
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch { /* plein */ }
  return l;
}
