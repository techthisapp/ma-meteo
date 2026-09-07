/* Les nappes de la carte : une grille de points, une valeur par point, une
   couleur étalée entre les points.

   La source est celle de la prévision, interrogée sur plusieurs coordonnées en
   un seul appel. Mesuré le 7 septembre 2026 sur 380 points et quatre colonnes :
   13 840 octets compressés, 5977 octets d'adresse, moins d'une seconde de
   réponse. Le pas de 0,55 degré de latitude et 0,80 de longitude fait une maille
   de soixante et un kilomètres de côté, carrée à la latitude de la France.

   Le pas ne descend pas plus bas : à 45 kilomètres, l'adresse dépasse ce que le
   service accepte et rend une erreur 414. Une nappe interpolée n'a de toute
   façon pas besoin d'être fine, elle dit une tendance régionale ; le chiffre
   d'un lieu se lit sur les écrans du temps.

   L'emprise couvre la France et ses abords. La vue peut aller plus loin, jusqu'à
   13 degrés est : la nappe s'y arrête, ce qui est exact, elle ne sait rien
   au delà. */

export const S = 41.0, N = 51.4, O = -5.6, E = 10.0;
export const PAS_LAT = 0.55, PAS_LON = 0.80;
export const COLS = Math.round((E - O) / PAS_LON) + 1;   // 20
export const RANGS = Math.round((N - S) / PAS_LAT) + 1;  // 19

const SERVICE = "https://api.open-meteo.com/v1/forecast";

/* Les colonnes des trois nappes, demandées ensemble. Une couche allumée après
   l'autre ne coûte alors rien de plus : le service rend les trois grandeurs pour
   le même prix d'adresse, et la lecture est gardée. */
export const COLONNES = ["temperature_2m", "wind_speed_10m", "wind_direction_10m", "uv_index"];

/* Le produit se refait au quart d'heure, ce que le service annonce lui-même par
   son champ `interval`. La garde suit cette cadence. */
export const GARDE = 15 * 60 * 1000;

let garde = null;

export function points() {
  const p = [];
  for (let r = 0; r < RANGS; r++) {
    for (let c = 0; c < COLS; c++) p.push([S + r * PAS_LAT, O + c * PAS_LON]);
  }
  return p;
}

export function adresse() {
  const p = points();
  const q = new URLSearchParams();
  q.set("latitude", p.map(x => x[0].toFixed(2)).join(","));
  q.set("longitude", p.map(x => x[1].toFixed(2)).join(","));
  q.set("current", COLONNES.join(","));
  return `${SERVICE}?${q}`;
}

/* Le tableau rendu suit l'ordre demandé, rangée par rangée depuis le sud. Les
   coordonnées rendues sont celles de la grille du modèle, non celles qui ont été
   demandées : la valeur se pose sur la maille demandée, l'écart valant moins
   d'un demi-pas de modèle. */
export function lire(d) {
  if (!Array.isArray(d) || d.length !== COLS * RANGS) return null;
  const n = COLS * RANGS;
  const out = {
    temp: new Float32Array(n), vent: new Float32Array(n),
    dir: new Float32Array(n), uv: new Float32Array(n), maj: null,
  };
  for (let i = 0; i < n; i++) {
    const c = d[i] && d[i].current;
    if (!c) return null;
    out.temp[i] = Number.isFinite(c.temperature_2m) ? c.temperature_2m : NaN;
    out.vent[i] = Number.isFinite(c.wind_speed_10m) ? c.wind_speed_10m : NaN;
    out.dir[i] = Number.isFinite(c.wind_direction_10m) ? c.wind_direction_10m : NaN;
    out.uv[i] = Number.isFinite(c.uv_index) ? c.uv_index : NaN;
    if (!out.maj && typeof c.time === "string") out.maj = c.time;
  }
  return out;
}

export async function charger(fetcheur = fetch) {
  const t = Date.now();
  if (garde && t < garde.exp) return garde.d;
  let d = null;
  try {
    const r = await fetcheur(adresse());
    if (r.ok) d = lire(await r.json());
  } catch { d = null; }
  garde = { d, exp: t + (d ? GARDE : 60 * 1000) };
  return d;
}

export function oublier() { garde = null; }

/* La valeur en un point quelconque, par interpolation bilinéaire sur les quatre
   mailles voisines. Hors de l'emprise, rien : une nappe qui prolongerait sa
   dernière valeur jusqu'au bord de la vue inventerait une donnée. */
export function valeurA(champ, lat, lon) {
  if (!champ) return null;
  const x = (lon - O) / PAS_LON, y = (lat - S) / PAS_LAT;
  if (x < 0 || y < 0 || x > COLS - 1 || y > RANGS - 1) return null;
  const c0 = Math.min(COLS - 2, Math.floor(x)), r0 = Math.min(RANGS - 2, Math.floor(y));
  const fx = x - c0, fy = y - r0;
  const v = (r, c) => champ[r * COLS + c];
  const a = v(r0, c0), b = v(r0, c0 + 1), c = v(r0 + 1, c0), e = v(r0 + 1, c0 + 1);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(e)) return null;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + e * fx * fy;
}

/* Ce que la carte a besoin de savoir pour peindre : l'emprise, le nombre de
   colonnes, la valeur en un point et la teinte d'une valeur. La carte ne sait
   pas ce qu'elle peint, la nappe ne sait rien de la projection. */
export function couche(champ, teinte) {
  if (!champ) return null;
  return { S, N, O, E, cols: COLS, teinte, valeurA: (lat, lon) => valeurA(champ, lat, lon) };
}

/* Les bornes d'un champ, pour la légende. */
export function bornes(champ) {
  let mn = Infinity, mx = -Infinity;
  for (const v of champ) {
    if (!Number.isFinite(v)) continue;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return mn <= mx ? { mn, mx } : null;
}
