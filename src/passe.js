/* Le temps passé sur la carte, versions 179 et 180, demandes de Jérôme du
   7 octobre 2026 : la pluie tombée, la neige tombée, les plus fortes rafales
   et les températures extrêmes, sur une période choisie au curseur, de
   24 heures à 60 jours.

   Deux lectures d'Open-Meteo, chacune gardée une heure en mémoire.

   Les trois premiers pas, 24, 48 et 72 heures, se lisent heure par heure sur
   les 420 points des autres grilles de la carte, `src/nappe.js`, par
   `past_hours`. Mesuré le 7 octobre 2026 : 72 heures pour deux points en une
   requête, la dernière étant l'heure présente.

   Les pas suivants, 7, 14, 30 et 60 jours, se lisent jour par jour par
   `past_days`, sur une grille deux fois plus lâche, 110 points, puis
   s'étalent sur la grille entière. Le service compte une requête de plus de deux
   semaines comme plusieurs appels, et chaque point comme un appel : 420
   points sur 60 jours en coûteraient environ 1800 sur les 10 000 du jour,
   110 points environ 470. Mesuré le 7 octobre 2026 sur cent points : 42
   kilooctets, quatre secondes. Les jours vont jusqu'à la veille ; le jour présent, à moitié
   prévu, est laissé de côté.

   Ce sont des estimations du modèle recalé sur les observations, et non des
   mesures de stations. La seconde lecture ne part que lorsque le curseur
   atteint une semaine. */

import { chercher, chercherEn } from "./horloge.js";
import { points, COLS, RANGS } from "./nappe.js";

const SERVICE = "https://api.open-meteo.com/v1/forecast";
export const HEURES = 72;
export const JOURS = 60;
export const GARDE = 3600 * 1000;

/* Les pas du curseur, en jours. */
export const PAS = [
  { cle: "24h", jours: 1, nom: "24 h" }, { cle: "48h", jours: 2, nom: "48 h" }, { cle: "72h", jours: 3, nom: "72 h" },
  { cle: "7j", jours: 7, nom: "7 jours" }, { cle: "14j", jours: 14, nom: "14 jours" },
  { cle: "30j", jours: 30, nom: "30 jours" }, { cle: "60j", jours: 60, nom: "60 jours" },
];
export const pasDe = cle => PAS.find(p => p.cle === cle) || PAS[1];
export const parJours = cle => pasDe(cle).jours * 24 > HEURES;

/* La grille lâche : à peu près un rang sur deux et une colonne sur deux,
   les bords compris pour que l'étalement couvre toute la carte. Sur les 21
   colonnes et 20 rangs de `src/nappe.js`, 11 colonnes et 10 rangs, 110
   points. */
const lache = n => {
  const m = Math.ceil(n / 2);
  return Array.from({ length: m }, (_, k) => Math.round(k * (n - 1) / (m - 1)));
};
export const RANGS_L = lache(RANGS);
export const COLS_L = lache(COLS);
export function pointsLaches() {
  const p = points();
  return RANGS_L.flatMap(r => COLS_L.map(c => p[r * COLS + c]));
}

const requete = (p, plus) => {
  const q = new URLSearchParams();
  q.set("latitude", p.map(x => x[0].toFixed(2)).join(","));
  q.set("longitude", p.map(x => x[1].toFixed(2)).join(","));
  for (const [k, v] of plus) q.set(k, v);
  q.set("timeformat", "unixtime");
  return `${SERVICE}?${q}`;
};
export const adresseHeures = () => requete(points(), [["hourly", "precipitation,snowfall,wind_gusts_10m,temperature_2m"],
  ["past_hours", String(HEURES)], ["forecast_hours", "0"]]);
export const adresseJours = () => requete(pointsLaches(), [
  ["daily", "precipitation_sum,snowfall_sum,wind_gusts_10m_max,temperature_2m_max,temperature_2m_min"],
  ["past_days", String(JOURS)], ["forecast_days", "1"], ["timezone", "Europe/Paris"]]);

/* Les grandeurs d'une période en un point : les cumuls de pluie et de neige,
   la plus forte rafale, le plus haut et le plus bas des températures. Une
   valeur manquante ne compte pas ; une grandeur sans aucune valeur reste
   vide. */
const somme = xs => (xs.some(Number.isFinite) ? xs.filter(Number.isFinite).reduce((s, x) => s + x, 0) : NaN);
const plus = xs => (xs.some(Number.isFinite) ? Math.max(...xs.filter(Number.isFinite)) : NaN);
const moins = xs => (xs.some(Number.isFinite) ? Math.min(...xs.filter(Number.isFinite)) : NaN);
const CHAMPS = ["pluie", "neige", "rafales", "chaud", "froid"];
const vide = n => Object.fromEntries(CHAMPS.map(c => [c, new Float32Array(n).fill(NaN)]));

export function lireHeures(d, jours) {
  if (!Array.isArray(d) || d.length !== COLS * RANGS) return null;
  const n = COLS * RANGS, h = jours * 24, g = vide(n);
  for (let i = 0; i < n; i++) {
    const x = d[i]?.hourly;
    if (!x) continue;
    const de = k => (Array.isArray(x[k]) ? x[k].slice(-h) : []);
    g.pluie[i] = somme(de("precipitation"));
    g.neige[i] = somme(de("snowfall"));
    g.rafales[i] = plus(de("wind_gusts_10m"));
    g.chaud[i] = plus(de("temperature_2m"));
    g.froid[i] = moins(de("temperature_2m"));
  }
  return g;
}

/* Les jours lus sur la grille lâche, sans le jour présent, puis étalés. */
export function lireJours(d, jours) {
  const nl = RANGS_L.length * COLS_L.length;
  if (!Array.isArray(d) || d.length !== nl) return null;
  const l = vide(nl);
  for (let i = 0; i < nl; i++) {
    const x = d[i]?.daily;
    if (!x) continue;
    const de = k => (Array.isArray(x[k]) ? x[k].slice(0, -1).slice(-jours) : []);
    l.pluie[i] = somme(de("precipitation_sum"));
    l.neige[i] = somme(de("snowfall_sum"));
    l.rafales[i] = plus(de("wind_gusts_10m_max"));
    l.chaud[i] = plus(de("temperature_2m_max"));
    l.froid[i] = moins(de("temperature_2m_min"));
  }
  return Object.fromEntries(CHAMPS.map(c => [c, etaler(l[c])]));
}

/* L'étalement de la grille lâche sur les 420 points, linéaire entre les
   rangs et les colonnes retenus. Un voisin vide laisse la place aux autres ;
   un point dont les quatre voisins sont vides reste vide. */
const encadrer = (liste, k) => {
  let j = 0;
  while (j < liste.length - 2 && liste[j + 1] < k) j++;
  const a = liste[j], b = liste[j + 1];
  return [j, b === a ? 0 : (k - a) / (b - a)];
};
export function etaler(l) {
  const out = new Float32Array(COLS * RANGS).fill(NaN);
  const nc = COLS_L.length;
  for (let r = 0; r < RANGS; r++) {
    const [jr, fr] = encadrer(RANGS_L, r);
    for (let c = 0; c < COLS; c++) {
      const [jc, fc] = encadrer(COLS_L, c);
      let s = 0, w = 0;
      for (const [dr, dc, p] of [[0, 0, (1 - fr) * (1 - fc)], [0, 1, (1 - fr) * fc], [1, 0, fr * (1 - fc)], [1, 1, fr * fc]]) {
        const v = l[(jr + dr) * nc + jc + dc];
        if (p > 0 && Number.isFinite(v)) { s += v * p; w += p; }
      }
      if (w > 0) out[r * COLS + c] = s / w;
    }
  }
  return out;
}

/* Les deux lectures brutes, gardées une heure, et partagées entre deux
   appels proches : un curseur glissé ne lance qu'une requête. */
const gardes = { heures: null, jours: null };
async function brut(quoi, fetcheur) {
  const t = Date.now();
  const g = gardes[quoi];
  if (g && t < g.exp) return g.p;
  const p = (async () => {
    try {
      const adr = quoi === "heures" ? adresseHeures() : adresseJours();
      const r = await (fetcheur === chercher ? chercherEn(30000) : fetcheur)(adr);
      return r.ok ? await r.json() : null;
    } catch { return null; }
  })();
  gardes[quoi] = { p, exp: t + GARDE };
  const d = await p;
  if (!d) gardes[quoi] = { p, exp: t + 60 * 1000 };
  return d;
}

/* Les grandeurs de la période `cle` sur les 420 points, ou null sans réseau. */
export async function charger(cle = "48h", fetcheur = chercher) {
  const pas = pasDe(cle);
  if (parJours(cle)) return lireJours(await brut("jours", fetcheur), pas.jours);
  return lireHeures(await brut("heures", fetcheur), pas.jours);
}
export function oublier() { gardes.heures = null; gardes.jours = null; }
