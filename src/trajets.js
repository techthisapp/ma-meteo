/* Les durées de route en voiture, par le service public de calcul
   d'itinéraire OSRM : une seule requête pour toute une liste de destinations.
   Le serveur public est une démonstration à la charge limitée ; les modules
   qui l'emploient gardent ses réponses et ne l'interrogent qu'une fois par
   commune. Écrit pour les plages, jalon 15 ; la neige, jalon 16, s'en sert
   aussi depuis le 2 octobre 2026. Depuis le même jour, la proximité entière
   vit ici, présélection, durées et garde de trente jours : la neige et les
   plages la recopiaient à l'identique, audit du 1er octobre 2026, constat 6.9.

   Une destination est proche à une heure de route au plus, décidé par Jérôme
   le 28 septembre 2026. Les destinations à moins de cent kilomètres à vol
   d'oiseau sont présélectionnées, quatre-vingts au plus : dans les Alpes, les
   quarante plus proches à vol d'oiseau pouvaient écarter des stations à moins
   d'une heure par la route, et le serveur public d'OSRM accepte cent points
   par requête. Sans réponse, une estimation à vol d'oiseau, 55 kilomètres pour
   une heure, marquée comme telle et jamais gardée. */

import { chercher, distanceKm, elaguer } from "./horloge.js";

const OSRM = "https://router.project-osrm.org/table/v1/driving/";

export function adresseOsrm(g, pts) {
  const liste = [[g.lon, g.lat], ...pts.map(p => [p.lon, p.lat])]
    .map(([lo, la]) => `${lo.toFixed(5)},${la.toFixed(5)}`).join(";");
  return `${OSRM}${liste}?sources=0&annotations=duration`;
}

/* La durée en minutes vers chaque destination, null si la route manque. Lève
   une erreur si le service ne répond pas. */
export async function dureesMinutes(g, pts, fetcheur = chercher) {
  const r = await fetcheur(adresseOsrm(g, pts));
  if (!r.ok) throw new Error(`osrm ${r.status}`);
  const d = await r.json();
  const durees = d?.durations?.[0];
  if (d?.code !== "Ok" || !Array.isArray(durees)) throw new Error("osrm sans durées");
  return pts.map((_, k) => (durees[k + 1] == null ? null : Math.round(durees[k + 1] / 60)));
}

export const RAYON_KM = 100;
export const MINUTES_MAX = 60;
export const KM_PAR_HEURE_ESTIMEE = 55;
export const CANDIDATES_MAX = 80;
export const GARDE_PROCHES = 30 * 24 * 3600 * 1000;

/* Les destinations d'une liste à moins de cent kilomètres, dépliées par
   `deplier`, les plus proches d'abord. */
export function candidatesDe(g, liste, deplier) {
  return liste.map(deplier)
    .map(p => ({ ...p, vol: distanceKm(g.lat, g.lon, p.lat, p.lon) }))
    .filter(p => p.vol <= RAYON_KM)
    .sort((a, b) => a.vol - b.vol)
    .slice(0, CANDIDATES_MAX);
}

/* Les candidates à une heure au plus, avec leur durée en minutes, les plus
   proches d'abord ; sans réponse d'OSRM, l'estimation à vol d'oiseau. */
export async function prochesDe(g, cands, fetcheur = chercher) {
  if (!cands.length) return [];
  try {
    const m = await dureesMinutes(g, cands, fetcheur);
    return cands.map((p, k) => ({ ...p, minutes: m[k], estime: false }))
      .filter(p => p.minutes !== null && p.minutes <= MINUTES_MAX)
      .sort((a, b) => a.minutes - b.minutes);
  } catch {
    return cands.filter(p => p.vol <= KM_PAR_HEURE_ESTIMEE)
      .map(p => ({ ...p, minutes: Math.round((p.vol / KM_PAR_HEURE_ESTIMEE) * 60), estime: true }));
  }
}

/* Les proches d'une commune, gardés trente jours sous la clé `cache`. Une
   estimation ne se garde pas : la prochaine ouverture retentera OSRM. */
export async function gardees(cache, g, lire) {
  const cle = `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
  try {
    const e = JSON.parse(localStorage.getItem(cache) || "{}")[cle];
    if (e && Date.now() - e.t < GARDE_PROCHES && !e.estime) return e.l;
  } catch { /* cache indisponible */ }
  const l = await lire();
  try {
    const c = JSON.parse(localStorage.getItem(cache) || "{}");
    c[cle] = { t: Date.now(), l, estime: l.some(p => p.estime) };
    localStorage.setItem(cache, JSON.stringify(elaguer(c, GARDE_PROCHES)));
  } catch { /* plein */ }
  return l;
}
