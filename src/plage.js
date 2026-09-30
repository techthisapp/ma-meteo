/* La météo des plages, jalon 15. Lot 2 : les plages proches.

   Une plage est proche si elle est à une heure de route au plus de la
   commune, décidé par Jérôme le 28 septembre 2026, comme les stations de ski.
   Les plages à moins de 100 kilomètres à vol d'oiseau sont présélectionnées,
   quatre-vingts au plus ; OSRM donne la durée en voiture vers chacune. Sans
   réponse, une estimation à vol d'oiseau, 55 kilomètres pour une heure,
   marquée comme telle et jamais gardée. Le résultat se garde trente jours par
   commune. */

import { PLAGES } from "./plages.js";
import { distanceKm } from "./postes.js";
import { dureesMinutes } from "./trajets.js";

export const RAYON_KM = 100;
export const MINUTES_MAX = 60;
export const KM_PAR_HEURE_ESTIMEE = 55;
const CANDIDATES_MAX = 80;
const CACHE = "mameteo.plage.proches.v1";
const GARDE = 30 * 24 * 3600 * 1000;

const dePlage = p => ({ nom: p[0], pays: p[1], lat: p[2], lon: p[3], commune: p[4] ?? null, departement: p[5] ?? null });

export function candidates(g, liste = PLAGES) {
  return liste.map(dePlage)
    .map(p => ({ ...p, vol: distanceKm(g.lat, g.lon, p.lat, p.lon) }))
    .filter(p => p.vol <= RAYON_KM)
    .sort((a, b) => a.vol - b.vol)
    .slice(0, CANDIDATES_MAX);
}

export async function proches(g, liste = PLAGES, fetcheur = fetch) {
  const cands = candidates(g, liste);
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

export async function prochesGardees(g, fetcheur = fetch) {
  const cle = `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
  try {
    const e = JSON.parse(localStorage.getItem(CACHE) || "{}")[cle];
    if (e && Date.now() - e.t < GARDE && !e.estime) return e.l;
  } catch { /* cache indisponible */ }
  const l = await proches(g, PLAGES, fetcheur);
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "{}");
    c[cle] = { t: Date.now(), l, estime: l.some(p => p.estime) };
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch { /* plein */ }
  return l;
}
