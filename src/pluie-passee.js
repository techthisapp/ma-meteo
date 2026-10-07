/* La pluie tombée, version 179, demande de Jérôme du 7 octobre 2026 : les
   cumuls des 48 et des 72 dernières heures sur la carte.

   Les mêmes 380 points que les autres grilles de la carte, `src/nappe.js`.
   Open-Meteo rend les heures passées de son modèle par `past_hours` : c'est
   une estimation du modèle, recalé sur les observations, et non une mesure
   de pluviomètre ni une lame d'eau radar. Mesuré le 7 octobre 2026 : 72
   heures pour deux points en une requête, la dernière étant l'heure
   présente. Une seule grandeur, la précipitation, soit 27 360 valeurs : la
   réponse reste légère.

   La grille ne part que si l'une des deux nappes est choisie, et se garde
   une heure en mémoire, comme la grille prévue. */

import { chercher, chercherEn } from "./horloge.js";
import { points, COLS, RANGS } from "./nappe.js";

const SERVICE = "https://api.open-meteo.com/v1/forecast";
export const HEURES = 72;
export const GARDE = 3600 * 1000;

export function adresse() {
  const p = points();
  const q = new URLSearchParams();
  q.set("latitude", p.map(x => x[0].toFixed(2)).join(","));
  q.set("longitude", p.map(x => x[1].toFixed(2)).join(","));
  q.set("hourly", "precipitation");
  q.set("past_hours", String(HEURES));
  q.set("forecast_hours", "0");
  q.set("timeformat", "unixtime");
  return `${SERVICE}?${q}`;
}

/* Les cumuls des 48 et des 72 dernières heures en chaque point, en
   millimètres. Une heure manquante ne compte pas ; un point sans aucune
   heure reste vide. */
export function lire(d) {
  if (!Array.isArray(d) || d.length !== COLS * RANGS) return null;
  const n = COLS * RANGS;
  const pluie48 = new Float32Array(n).fill(NaN);
  const pluie72 = new Float32Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const v = d[i]?.hourly?.precipitation;
    if (!Array.isArray(v) || !v.length) continue;
    const somme = xs => xs.filter(Number.isFinite).reduce((s, x) => s + x, 0);
    if (!v.some(Number.isFinite)) continue;
    pluie72[i] = somme(v.slice(-72));
    pluie48[i] = somme(v.slice(-48));
  }
  return { pluie48, pluie72, t: d[0]?.hourly?.time?.at(-1) ?? null };
}

let garde = null;
export async function charger(fetcheur = chercher) {
  const t = Date.now();
  if (garde && t < garde.exp) return garde.d;
  let d = null;
  try {
    const r = await (fetcheur === chercher ? chercherEn(20000) : fetcheur)(adresse());
    if (r.ok) d = lire(await r.json());
  } catch { d = null; }
  garde = { d, exp: t + (d ? GARDE : 60 * 1000) };
  return d;
}
export function oublier() { garde = null; }
