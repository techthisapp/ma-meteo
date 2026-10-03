/* La grille prévue de la carte, jalon 19, lot 5, demandes de Jérôme des 2 et
   3 octobre 2026 : le vent et les rafales, le cumul de pluie et de neige, la
   limite pluie-neige, la pression, le gel de la nuit, le ciel de la nuit et
   le brouillard du matin.

   Les mêmes 380 points que la grille du moment, `src/nappe.js`, mais heure par
   heure sur trente-six heures et dix grandeurs. Mesuré le 3 octobre 2026 :
   1,26 Mo bruts, environ 300 Ko compressés, trois secondes de réponse ; le
   service compte une requête par point, comme la grille du moment. Elle ne
   part que si une nappe qui en vit est choisie, et se garde une heure en
   mémoire. Elle n'est pas gardée sur l'appareil : 136 800 valeurs dépassent
   ce qu'il est raisonnable d'écrire dans le stockage local.

   Les heures sont demandées en secondes Unix : le service ne sait pas rendre
   l'heure de Paris pour plusieurs coordonnées à la fois, et une heure absolue
   se lit sans recalage. */

import { chercher, chercherEn, cleHeure } from "./horloge.js";
import { points, COLS, RANGS } from "./nappe.js";

const SERVICE = "https://api.open-meteo.com/v1/forecast";
export const HEURES = 36;
export const GARDE = 3600 * 1000;
export const GRANDEURS = [
  ["temp", "temperature_2m"], ["pluie", "precipitation"], ["neige", "snowfall"],
  ["vent", "wind_speed_10m"], ["dir", "wind_direction_10m"], ["rafales", "wind_gusts_10m"],
  ["pression", "pressure_msl"], ["nuages", "cloud_cover"], ["visibilite", "visibility"],
  ["isotherme", "freezing_level_height"],
];

export function adresse() {
  const p = points();
  const q = new URLSearchParams();
  q.set("latitude", p.map(x => x[0].toFixed(2)).join(","));
  q.set("longitude", p.map(x => x[1].toFixed(2)).join(","));
  q.set("hourly", GRANDEURS.map(g => g[1]).join(","));
  q.set("forecast_hours", String(HEURES));
  q.set("timeformat", "unixtime");
  return `${SERVICE}?${q}`;
}

/* L'heure de Paris d'un instant Unix, et sa date. */
const heureParis = t => Number(cleHeure(new Date(t * 1000)).slice(11, 13));
const jourParis = t => cleHeure(new Date(t * 1000)).slice(0, 10);

/* Les fenêtres des nappes de la nuit et du matin, en rangs d'heures à partir
   de maintenant.
   - La nuit va de 18 h à 10 h le lendemain : celle qui vient, ou celle qui
     court si l'on est avant 6 h, comptée alors de maintenant à 10 h.
   - Le ciel de la nuit se lit de 22 h à 2 h, sur cette même nuit.
   - Le brouillard se lit au matin qui vient, de 5 h à 10 h : celui du jour
     avant 7 h, sinon celui du lendemain. */
export function fenetres(temps) {
  const h = temps.map(heureParis), j = temps.map(jourParis);
  const K = temps.length;
  const lendemain = j.find(x => x !== j[0]) ?? null;
  const nuit = [], ciel = [], matin = [];
  if (h[0] < 6) {
    for (let k = 0; k < K && !(j[k] === j[0] && h[k] >= 10); k++) nuit.push(k);
    for (let k = 0; k < K && j[k] === j[0] && h[k] < 2; k++) ciel.push(k);
  } else {
    const soir = h[0] >= 18 ? 0 : h.findIndex((x, k) => j[k] === j[0] && x >= 18);
    if (soir >= 0) {
      for (let k = soir; k < K && !(j[k] === lendemain && h[k] >= 10); k++) nuit.push(k);
      for (let k = soir; k < K && !(j[k] === lendemain && h[k] >= 2); k++) if (j[k] === lendemain || h[k] >= 22) ciel.push(k);
    }
  }
  const jourMatin = h[0] < 7 ? j[0] : lendemain;
  for (let k = 0; k < K; k++) if (j[k] === jourMatin && h[k] >= 5 && h[k] < 10) matin.push(k);
  return { nuit, ciel, matin };
}

/* La lecture : chaque grandeur en une suite de tranches, une par heure, et les
   champs fixes tirés des fenêtres. Le rang zéro est l'heure présente. */
export function lire(d, maintenant = Date.now()) {
  if (!Array.isArray(d) || d.length !== COLS * RANGS) return null;
  const n = COLS * RANGS;
  const temps = d[0]?.hourly?.time;
  if (!Array.isArray(temps) || !temps.length) return null;
  const heure = Math.floor(maintenant / 3600000) * 3600;
  const debut = Math.max(0, temps.findIndex(t => t >= heure));
  const T = temps.slice(debut);
  const H = T.length;
  const serie = {};
  for (const [cle, col] of GRANDEURS) {
    const a = new Float32Array(n * H);
    for (let i = 0; i < n; i++) {
      const v = d[i]?.hourly?.[col];
      for (let k = 0; k < H; k++) {
        const x = Array.isArray(v) ? v[debut + k] : null;
        a[k * n + i] = Number.isFinite(x) ? x : NaN;
      }
    }
    serie[cle] = a;
  }
  const f = fenetres(T);
  const fixe = (cle, rangs, choisir) => {
    const a = new Float32Array(n).fill(NaN);
    if (!rangs.length) return a;
    for (let i = 0; i < n; i++) {
      const xs = rangs.map(k => serie[cle][k * n + i]).filter(Number.isFinite);
      if (xs.length) a[i] = choisir(xs);
    }
    return a;
  };
  const somme = xs => xs.reduce((s, x) => s + x, 0);
  const vingtQuatre = Array.from({ length: Math.min(24, H) }, (_, k) => k);
  return {
    t0: T[0], heures: H, temps: T, n, serie,
    fixes: {
      pluie24: fixe("pluie", vingtQuatre, somme),
      neige24: fixe("neige", vingtQuatre, somme),
      /* La limite pluie-neige se tient environ trois cents mètres sous
         l'isotherme zéro ; la plus basse des vingt-quatre heures. */
      limite: fixe("isotherme", vingtQuatre, xs => Math.max(0, Math.min(...xs) - 300)),
      gel: fixe("temp", f.nuit, xs => Math.min(...xs)),
      cielNuit: fixe("nuages", f.ciel, xs => somme(xs) / xs.length),
      brouillard: fixe("visibilite", f.matin, xs => Math.min(...xs)),
    },
    fenetres: f,
  };
}

/* La vue d'une heure : chaque grandeur à ce rang, et les champs fixes. C'est
   ce que les nappes lisent par leur nom de champ. */
export function vue(d, k = 0) {
  if (!d) return null;
  const r = Math.max(0, Math.min(d.heures - 1, k));
  const out = { ...d.fixes, rang: r, t: d.temps[r] };
  for (const [cle] of GRANDEURS) out[cle] = d.serie[cle].subarray(r * d.n, (r + 1) * d.n);
  return out;
}

let garde = null;
export async function charger(fetcheur = chercher) {
  const t = Date.now();
  if (garde && t < garde.exp) return garde.d;
  let d = null;
  try {
    const r = await (fetcheur === chercher ? chercherEn(20000) : fetcheur)(adresse());
    if (r.ok) d = lire(await r.json(), t);
  } catch { d = null; }
  garde = { d, exp: t + (d ? GARDE : 60 * 1000) };
  return d;
}
export function oublier() { garde = null; }
