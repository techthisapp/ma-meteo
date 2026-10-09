/* La prévision immédiate de la pluie de Météo-France, PIAF, version 186,
   demande de Jérôme du 9 octobre 2026.

   PIAF, « prévision immédiate agrégée fusionnée », donne la lame d'eau sur
   la France métropolitaine au kilomètre, refaite toutes les cinq minutes,
   par pas de cinq minutes jusqu'à trois heures et quart. La mosaïque radar y
   est déplacée par un champ de mouvement propre à chaque région, puis fondue
   dans AROME-PI, le modèle fin de Météo-France pour les heures qui viennent,
   qui fait naître et mourir les averses quand l'extrapolation ne suffit plus.

   Le service demande une clé, gratuite, attachée à un compte du portail de
   Météo-France. La clé se saisit dans les réglages et reste sur l'appareil.
   Relevé le 9 octobre 2026 avec la clé de Jérôme :

   | Point | Constat |
   |---|---|
   | Adresse | `api.meteofrance.fr/pro/piaf/1.0`, l'en-tête d'origine ouvert à toute page |
   | Clé | admise dans l'adresse, `apikey=`, ce qui laisse une image se charger comme une autre |
   | Limite | 50 requêtes par minute et par clé |
   | Carte, WMS | une image PNG par échéance, en latitude et longitude, style coloré comme un radar ; sans heure de prévision, le service prend la dernière |
   | Point, WCS | une requête par échéance ; cumul en millimètres sur 5 minutes, 15 minutes ou une heure, en TIFF de nombres à virgule sur 64 bits, non compressé |
   | Retard | la dernière prévision servie au point date d'environ un quart d'heure ; l'image de carte, de cinq à dix minutes |

   Les requêtes passent par un compteur qui en laisse partir 45 par minute au
   plus : une animation de la carte en demande 36. */

import { chercherEn } from "./horloge.js";
import { mx, my, echelle } from "./projection.js";
import * as Reglages from "./reglages.js";

export const SERVICE = "https://api.meteofrance.fr/pro/piaf/1.0";
export const WMS = `${SERVICE}/wms/MF-NWP-HIGHRES-PIAF-001-FRANCE-WMS/GetMap`;
export const WCS = `${SERVICE}/wcs/MF-NWP-HIGHRES-PIAF-001-FRANCE-WCS/GetCoverage`;
export const COUCHE = "TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE";
export const STYLE = "PRECIP__GROUND__RADAR_SHADING";
/* L'emprise du produit et l'image de la carte : une seule image par
   échéance pour toute la France, qui sert à tous les déplacements et à tous
   les zooms sans nouvelle requête. 990 points sur 630, un point pour un
   kilomètre et demi environ. */
export const BORNES = { S: 41, N: 51.5, O: -6, E: 10.5 };
export const LARGEUR = 990, HAUTEUR = 630;
export const PAS = 5;              // minutes entre deux échéances
export const HORIZON = 175;        // minutes après maintenant, sous les 195 du produit
export const PAR_MINUTE = 45;

export const actif = () => Reglages.clePiaf() !== null;
const iso = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

/* Le compteur : chaque requête attend son tour dans la minute glissante. */
const envois = [];
export async function tour(maintenant = () => Date.now()) {
  for (;;) {
    const t = maintenant();
    while (envois.length && t - envois[0] > 60000) envois.shift();
    if (envois.length < PAR_MINUTE) { envois.push(t); return; }
    await new Promise(r => setTimeout(r, Math.min(1000, 60000 - (t - envois[0]) + 50)));
  }
}

/* ---------- La carte ---------- */

/* La clé se place en tête de l'adresse. Relevé le 10 octobre 2026 : en
   dernière place, la passerelle du portail l'ôte en abîmant le paramètre
   qui la précède, et le service répond que l'heure est mal écrite. */
const avecCle = (base, cle) => `${base}?apikey=${encodeURIComponent(cle || "")}`;
export const adresseImage = (t, cle = Reglages.clePiaf()) =>
  `${avecCle(WMS, cle)}&service=WMS&version=1.3.0&layers=${COUCHE}&styles=${STYLE}&crs=EPSG:4326`
  + `&format=image/png&bbox=${BORNES.S},${BORNES.O},${BORNES.N},${BORNES.E}`
  + `&width=${LARGEUR}&height=${HAUTEUR}&transparent=true&time=${iso(t)}`;

/* Les images, gardées dix minutes : une prévision plus récente les
   remplace. Une image qui échoue se retient comme telle. */
const images = new Map();
export function image(t, surPret) {
  const cle = Reglages.clePiaf();
  if (!cle) return null;
  const k = adresseImage(t, cle);
  let e = images.get(k);
  if (e && Date.now() - e.quand > 10 * 60000) { images.delete(k); e = null; }
  if (e) {
    if (surPret && !e.pret && !e.echoue) e.attente.push(surPret);
    return e;
  }
  e = { pret: false, echoue: false, quand: Date.now(), img: new Image(), attente: surPret ? [surPret] : [] };
  e.img.crossOrigin = "anonymous";
  e.img.decoding = "async";
  e.img.addEventListener("load", () => { e.pret = true; for (const f of e.attente.splice(0)) f(); });
  e.img.addEventListener("error", () => { e.echoue = true; for (const f of e.attente.splice(0)) f(); });
  images.set(k, e);
  while (images.size > 48) images.delete(images.keys().next().value);
  tour().then(() => { e.img.src = k; });
  return e;
}
export const preparer = t => new Promise(ok => {
  const e = image(t, ok);
  if (!e || e.pret || e.echoue) ok();
});
export function oublierImages() { images.clear(); }

/* Le tracé : l'image est en latitude et longitude, la carte en Mercator.
   L'image se pose par bandes horizontales, chacune à la hauteur que la
   projection donne à ses deux bords ; à quatre-vingts bandes, l'écart
   restant tient sous le point d'écran. */
export const BANDES = 80;
export function peindre(ctx, vue, l, h, t, surPret) {
  const e = image(t, surPret);
  if (!e || !e.pret) return 0;
  const k = echelle(vue.z);
  const X = lon => (mx(lon) - mx(vue.lon)) * k + l / 2;
  const Y = lat => (my(lat) - my(vue.lat)) * k + h / 2;
  const x0 = X(BORNES.O), x1 = X(BORNES.E);
  const W = e.img.naturalWidth || LARGEUR, H = e.img.naturalHeight || HAUTEUR;
  ctx.imageSmoothingEnabled = true;
  let posees = 0;
  for (let b = 0; b < BANDES; b++) {
    const haut = BORNES.N - (b * (BORNES.N - BORNES.S)) / BANDES;
    const bas = BORNES.N - ((b + 1) * (BORNES.N - BORNES.S)) / BANDES;
    const y0 = Y(haut), y1 = Y(bas);
    if (y1 < 0 || y0 > h) continue;
    ctx.drawImage(e.img, 0, (b * H) / BANDES, W, H / BANDES, x0, y0, x1 - x0, y1 - y0 + 0.5);
    posees++;
  }
  return posees;
}

/* ---------- Le point ---------- */

/* La lecture d'un TIFF non compressé de nombres à virgule, celui que rend le
   service : largeur, hauteur, bandes de données. Rien d'autre n'est lu. */
export function lireTiff(buf) {
  const v = new DataView(buf);
  const petit = v.getUint16(0) === 0x4949;
  const u16 = o => v.getUint16(o, petit), u32 = o => v.getUint32(o, petit);
  if (u16(2) !== 42) return null;
  const ifd = u32(4), n = u16(ifd);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + 12 * i;
    const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    const taille = { 3: 2, 4: 4 }[type];
    if (!taille) continue;
    const o = taille * cnt <= 4 ? e + 8 : u32(e + 8);
    tags[tag] = Array.from({ length: cnt }, (_, k) => (type === 3 ? u16(o + 2 * k) : u32(o + 4 * k)));
  }
  const w = tags[256]?.[0], h = tags[257]?.[0], bits = tags[258]?.[0] || 64;
  if (!w || !h || (tags[259]?.[0] || 1) !== 1 || !tags[273] || !tags[279]) return null;
  const octets = bits / 8, valeurs = new Float64Array(w * h);
  let k = 0;
  for (let s = 0; s < tags[273].length && k < valeurs.length; s++) {
    for (let o = tags[273][s], fin = o + tags[279][s]; o + octets <= fin && k < valeurs.length; o += octets) {
      valeurs[k++] = bits === 32 ? v.getFloat32(o, petit) : v.getFloat64(o, petit);
    }
  }
  return { largeur: w, hauteur: h, valeurs };
}

/* La dernière prévision servie au point, cherchée de cinq en cinq minutes
   en remontant d'un quart d'heure à trois quarts d'heure, et gardée cinq
   minutes. */
const idRef = t => iso(t).replace(/:/g, ".");
let refGardee = null;
export async function reference(fetcheur, maintenant = Date.now()) {
  if (refGardee && maintenant - refGardee.quand < 5 * 60000) return refGardee.t;
  const cle = Reglages.clePiaf();
  const base = Math.floor(maintenant / 300000) * 300000;
  for (let k = 2; k <= 9; k++) {
    const t = base - k * 300000;
    await tour();
    try {
      const r = await fetcheur(`${avecCle(WCS.replace("GetCoverage", "DescribeCoverage"), cle)}&service=WCS&version=2.0.1`
        + `&coverageID=${COUCHE}___${idRef(t)}_PT15M`);
      if (r.ok) { refGardee = { t, quand: maintenant }; return t; }
    } catch { /* la suivante */ }
  }
  return null;
}
export function oublier() { refGardee = null; envois.length = 0; images.clear(); }

/* La pluie au point, au pas du quart d'heure, de `debut` à `fin` : le cumul
   en millimètres de chaque quart d'heure, moyen sur un carré de trois
   kilomètres environ autour du point. Chaque pas porte l'heure de son début,
   comme la suite des modèles. */
export const DEMI_COTE = 0.015;
export async function suite(lat, lon, debut, fin, fetcheur = chercherEn(15000)) {
  const cle = Reglages.clePiaf();
  if (!cle || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ref = await reference(fetcheur);
  if (ref === null) return null;
  const pas = [];
  for (let t = Math.ceil((debut + 15 * 60000) / 900000) * 900000; t <= Math.min(fin, ref + 195 * 60000); t += 900000) {
    if (t >= ref + 15 * 60000) pas.push(t);
  }
  const lus = await Promise.all(pas.map(async T => {
    await tour();
    try {
      const r = await fetcheur(`${avecCle(WCS, cle)}&service=WCS&version=2.0.1&coverageid=${COUCHE}___${idRef(ref)}_PT15M`
        + `&subset=long(${(lon - DEMI_COTE).toFixed(3)},${(lon + DEMI_COTE).toFixed(3)})`
        + `&subset=lat(${(lat - DEMI_COTE).toFixed(3)},${(lat + DEMI_COTE).toFixed(3)})`
        + `&subset=time(${iso(T)})&format=image/tiff`);
      if (!r.ok) return null;
      const g = lireTiff(await r.arrayBuffer());
      if (!g) return null;
      const v = [...g.valeurs].filter(x => Number.isFinite(x) && x >= 0 && x < 1e6);
      return v.length ? { t: T - 15 * 60000, mm: v.reduce((s, x) => s + x, 0) / v.length } : null;
    } catch { return null; }
  }));
  const ok = lus.filter(Boolean);
  return ok.length ? ok : null;
}
