/* D'où vient la pluie, et à quelle allure.

   Le service radar publie son champ extrapolé vide : relevé les 5, 6, 7 et 8
   septembre 2026, il n'y a rien après l'instant présent. Rien ne se prévoit donc
   à partir des images. Ce qui se mesure, c'est le passé : le déplacement de la
   masse entre deux images observées, par corrélation croisée.

   Le partage des rôles est net. Météo-France dit quand la pluie arrive et à
   quelle force, avec un vrai produit de prévision immédiate qui assimile le
   radar. Cette mesure dit d'où elle vient et à quelle vitesse, ce que ce produit
   ne donne pas. Aucune heure d'arrivée n'est calculée ici : elle contredirait le
   panneau, et deux réponses à la même question sont le défaut que ce dépôt
   connaît le mieux.

   Mesuré le 8 septembre 2026 à 22 h 50 UTC, sur une France arrosée à trente-cinq
   pour cent :

   | Grandeur | Valeur |
   |---|---|
   | Déplacement trouvé | six pixels de zoom cinq en trente minutes, 46 km/h |
   | Provenance | 243 degrés, ouest-sud-ouest |
   | Accord des quadrants | de 240 à 261 degrés, de 37 à 56 km/h |
   | Corrélation au pic | 0,660, contre 0,569 sans décalage |
   | Vent à 700 hPa au même endroit | 31 km/h de 249 degrés |
   | Vent à 10 mètres | 0,5 km/h de 315 degrés |

   Le vent de surface ne dit rien du déplacement des masses : il était nul quand
   la pluie filait à 46 kilomètres par heure. Le vent à 700 hPa donne la
   direction à six degrés près mais sous-estime la vitesse d'un tiers. La mesure
   sur les images reste donc la seule source. */

import { mx, my } from "./carte.js";
import { duCardinal } from "./previsions.js";
import { TAILLE, SCHEMA, OPTIONS, adresse } from "./radar.js";

/* Le zoom de la mesure ne suit pas la carte : le déplacement est une grandeur
   régionale, et une vue serrée verrait la masse sortir du cadre entre deux
   images. Au zoom cinq, une tuile couvre plus de mille kilomètres et un pixel
   vaut environ 3,4 kilomètres à la latitude de la France. */
export const ZOOM = 5;

/* Trois pas de dix minutes. Sur dix minutes, le déplacement ne fait qu'un pixel
   ou deux et l'arrondi domine ; au delà d'une heure, la masse s'est déformée et
   les deux images ne se ressemblent plus. */
export const PAS_ECART = 3;

/* Le rayon exploré vaut vingt pixels, soit 68 kilomètres en trente minutes,
   c'est-à-dire 136 kilomètres par heure : au delà, ce n'est plus une masse
   pluvieuse qui se déplace. */
export const RAYON = 20;

/* Les trois conditions pour parler. Une tuile presque sèche ne porte pas de
   forme à suivre ; une corrélation faible veut dire que les deux images ne se
   ressemblent pas ; et un pic qui ne dépasse pas le décalage nul ne dit rien de
   plus qu'une masse immobile. */
export const COUVERTURE_MIN = 0.02;
export const SCORE_MIN = 0.35;
export const GAIN_MIN = 0.03;

/* Sous cette vitesse, la pluie ne vient de nulle part : elle stagne, et c'est
   un fait utile, une averse qui ne bouge pas dure. */
export const STAGNE = 10;

export const GARDE = 10 * 60 * 1000;

/* La tuile qui contient un point, au zoom de la mesure. */
export function tuileDe(lat, lon, z = ZOOM) {
  const n = Math.pow(2, z);
  return {
    z,
    x: Math.max(0, Math.min(n - 1, Math.floor(mx(lon) * n))),
    y: Math.max(0, Math.min(n - 1, Math.floor(my(lat) * n))),
  };
}

/* Les mètres qu'un pixel couvre, à la latitude du point. */
export const metresParPixel = (lat, z = ZOOM) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / (Math.pow(2, z) * (TAILLE / 256));

/* Une image de tuile devient un champ scalaire : la luminance pondérée par
   l'opacité. La palette du service va du bleu pâle au rouge, et c'est la forme
   des taches qui se suit, non leur couleur exacte. La moyenne est retirée une
   fois pour toutes, ce qui réduit chaque comparaison à un produit scalaire. */
export function champDe(donnees, n = TAILLE) {
  const v = new Float32Array(n * n);
  let pleins = 0, somme = 0;
  for (let i = 0; i < v.length; i++) {
    const k = i * 4, al = donnees[k + 3];
    if (al < 16) { v[i] = 0; continue; }
    v[i] = (0.2126 * donnees[k] + 0.7152 * donnees[k + 1] + 0.0722 * donnees[k + 2]) * (al / 255);
    somme += v[i];
    pleins++;
  }
  const m = somme / v.length;
  for (let i = 0; i < v.length; i++) v[i] -= m;
  return { v, n, couverture: pleins / v.length };
}

/* Le score d'un décalage : la corrélation des deux champs sur leur partie
   commune, calculée un pixel sur `pas`. */
export function score(a, b, dx, dy, pas) {
  const n = a.n;
  let num = 0, da = 0, db = 0, vus = 0;
  for (let y = 0; y < n; y += pas) {
    const yb = y + dy;
    if (yb < 0 || yb >= n) continue;
    for (let x = 0; x < n; x += pas) {
      const xb = x + dx;
      if (xb < 0 || xb >= n) continue;
      const u = a.v[y * n + x], w = b.v[yb * n + xb];
      num += u * w; da += u * u; db += w * w; vus++;
    }
  }
  return vus < 200 || da <= 0 || db <= 0 ? null : num / Math.sqrt(da * db);
}

/* La recherche se fait en deux temps, une grille lâche puis un balayage serré
   autour du meilleur. Mesuré sur le cas réel du 8 septembre : dix-sept
   millisecondes contre sept cent trente-six pour la recherche complète, et un
   pixel d'écart sur le résultat, soit sept kilomètres par heure. */
export function chercher(a, b, rayon = RAYON) {
  let bon = null;
  for (let dy = -rayon; dy <= rayon; dy += 4) {
    for (let dx = -rayon; dx <= rayon; dx += 4) {
      const s = score(a, b, dx, dy, 4);
      if (s !== null && (!bon || s > bon.s)) bon = { dx, dy, s };
    }
  }
  if (!bon) return null;
  const c = { ...bon };
  for (let dy = c.dy - 4; dy <= c.dy + 4; dy++) {
    for (let dx = c.dx - 4; dx <= c.dx + 4; dx++) {
      const s = score(a, b, dx, dy, 2);
      if (s !== null && s > bon.s) bon = { dx, dy, s };
    }
  }
  return bon;
}

/* Le déplacement en grandeurs physiques. `dx` va vers l'est, `dy` vers le sud :
   la provenance est la direction opposée, comptée depuis le nord dans le sens
   des aiguilles, comme le vent se donne partout ailleurs. */
export function depuisDecalage(dx, dy, minutes, lat) {
  const m = Math.hypot(dx, dy) * metresParPixel(lat);
  const kmh = (m / 1000) / (minutes / 60);
  const provenance = ((Math.atan2(-dx, dy) * 180) / Math.PI + 360) % 360;
  return { kmh, provenance, dx, dy };
}

/* La mesure complète. `images` est la liste des observations de l'index, la plus
   récente en dernier. Rien n'est rendu si les conditions de lecture ne sont pas
   réunies : une direction inventée serait pire que pas de direction. */
export async function mesurer(lat, lon, hote, images, charge = chargerTuile) {
  if (!hote || !Array.isArray(images) || images.length <= PAS_ECART) return null;
  const derniere = images[images.length - 1];
  const avant = images[images.length - 1 - PAS_ECART];
  if (!derniere || !avant) return null;
  const t = tuileDe(lat, lon);
  /* Les images viennent de l'index du radar, dans sa forme : un chemin et un
     horodatage en millisecondes. */
  const [da, db] = await Promise.all([
    charge(adresse(hote, avant.chemin, t)),
    charge(adresse(hote, derniere.chemin, t)),
  ]);
  if (!da || !db) return null;
  const a = champDe(da), b = champDe(db);
  if (a.couverture < COUVERTURE_MIN || b.couverture < COUVERTURE_MIN) return null;
  const bon = chercher(a, b);
  if (!bon || bon.s < SCORE_MIN) return null;
  const nul = score(a, b, 0, 0, 2);
  if (nul !== null && bon.s - nul < GAIN_MIN) return null;
  const minutes = (derniere.t - avant.t) / 60000;
  if (!(minutes > 0)) return null;
  return { ...depuisDecalage(bon.dx, bon.dy, minutes, lat), score: bon.s, minutes };
}

/* Le chargement d'une tuile en champ de pixels. Le service sert ses images avec
   l'origine ouverte, ce qui a été mesuré : sans cet en-tête la toile serait
   souillée et la lecture des pixels refusée. */
export function chargerTuile(url) {
  return new Promise(ok => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener("load", () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = TAILLE; cv.height = TAILLE;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, TAILLE, TAILLE);
        ok(ctx.getImageData(0, 0, TAILLE, TAILLE).data);
      } catch { ok(null); }
    }, { once: true });
    img.addEventListener("error", () => ok(null), { once: true });
    img.src = url;
  });
}

/* La garde tient la mesure entre deux lectures : le radar se refait toutes les
   dix minutes, la mesurer plus souvent rendrait le même chiffre. */
let garde = null;

export async function lire(lat, lon, hote, images, charge = chargerTuile) {
  const cle = `${lat.toFixed(2)},${lon.toFixed(2)},${images && images.length ? images[images.length - 1].t : 0}`;
  const t = Date.now();
  if (garde && garde.cle === cle && t < garde.exp) return garde.d;
  const d = await mesurer(lat, lon, hote, images, charge);
  garde = { cle, d, exp: t + GARDE };
  return d;
}

export function oublier() { garde = null; }

/* La phrase du panneau. Elle dit d'où et à quelle allure, jamais quand : l'heure
   d'arrivée est celle du produit de Météo-France, juste au-dessus. */
export function phrase(d) {
  if (!d) return "";
  if (d.kmh < STAGNE) return "Elle bouge peu.";
  return `Elle vient ${duCardinal(d.provenance)}, environ ${Math.round(d.kmh / 5) * 5} km/h.`;
}

export const SCHEMA_TUILE = { TAILLE, SCHEMA, OPTIONS };
