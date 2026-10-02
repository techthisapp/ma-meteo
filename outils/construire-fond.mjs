/* Les fonds embarqués de la carte, jalon 19, lot 2 : les cours d'eau, les
   villes et le relief. À relancer seulement si l'on veut rafraîchir ces
   données, qui changent peu : `node outils/construire-fond.mjs`, quelques
   minutes, réseau requis.

   - Les cours d'eau viennent de la BD CARTO de l'IGN, service WFS de la
     Géoplateforme, licence ouverte Etalab : les cours d'eau nommés d'au moins
     vingt kilomètres, de la Seine jusqu'à l'Armançon ou la Brenne. Leur rang
     vient de leur longueur, la base ne portant pas d'importance. La BD TOPO,
     essayée d'abord, porte une importance, mais ses cours d'eau n'y sont que
     des fragments : six bouts pour la Saône. Les tracés sont simplifiés selon
     le rang, puis écrits au pas de 0,002 degré, celui des contours, en
     différences successives.
   - Les villes viennent de geo.api.gouv.fr : les communes de 2000 habitants
     et plus, avec leur centre et leur population.
   - Le relief vient des tuiles d'altitude Terrarium, données publiques
     d'Amazon et de Mapzen d'après SRTM, GMTED et ETOPO1, au zoom 7, soit
     1,2 kilomètre par point. L'ombrage est calculé ici et écrit en image
     grise WebP, la mer au gris moyen : la carte la pose en lumière douce, où
     le gris moyen ne change rien.

   Le décodage et l'encodage des images passent par le Chromium de
   Playwright, faute de bibliothèque d'image dans le Python du poste. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DONNEES = path.resolve(ICI, "..", "donnees");
const PAS = 0.002;

/* ---------- Cours d'eau ---------- */

const WFS = "https://data.geopf.fr/wfs/ows";
/* Le rang d'un cours d'eau selon sa longueur en kilomètres, et la tolérance
   de simplification de chaque rang, en mètres : un grand fleuve se voit de
   loin, un affluent seulement de près. */
const LONGUEUR_MIN = 20;
const rangDe = km => (km >= 250 ? 1 : km >= 80 ? 2 : km >= 30 ? 3 : 4);
const TOLERANCE = { 1: 450, 2: 400, 3: 320, 4: 280 };

const metres = (a, b) => {
  const cos = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * 111320 * cos, (a[1] - b[1]) * 110540);
};
function ecart(p, a, b) {
  const cos = Math.cos(p[1] * Math.PI / 180);
  const ax = a[0] * 111320 * cos, ay = a[1] * 110540;
  const bx = b[0] * 111320 * cos - ax, by = b[1] * 110540 - ay;
  const px = p[0] * 111320 * cos - ax, py = p[1] * 110540 - ay;
  const l2 = bx * bx + by * by;
  const t = l2 ? Math.max(0, Math.min(1, (px * bx + py * by) / l2)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}
function simplifier(l, tol) {
  if (l.length < 3) return l;
  const garde = new Uint8Array(l.length);
  garde[0] = garde[l.length - 1] = 1;
  const pile = [[0, l.length - 1]];
  while (pile.length) {
    const [i, j] = pile.pop();
    let max = 0, k = -1;
    for (let m = i + 1; m < j; m++) {
      const d = ecart(l[m], l[i], l[j]);
      if (d > max) { max = d; k = m; }
    }
    if (max > tol) { garde[k] = 1; pile.push([i, k], [k, j]); }
  }
  return l.filter((_, k) => garde[k]);
}

/* Un nom de cours d'eau sans article, et rien pour les noms de service que
   la base donne aux fossés et aux bras sans nom. */
function nomCourt(t) {
  if (!t) return "";
  if (/^(Cours d'Eau|Fossé|Bras|Canal|Bief|Rigole|Ru|Ruisseau|Affluent|Dérivation)\s+\d/i.test(t)) return "";
  if (/\d{2}\s+de\s/.test(t)) return "";
  return t.replace(/^(le |la |les |l')/i, "").replace(/^./, c => c.toUpperCase());
}

async function coursDEau() {
  const sortie = [];
  let points = 0, lus = 0;
  for (let debut = 0; ; debut += 5000) {
    const q = new URLSearchParams({ SERVICE: "WFS", VERSION: "2.0.0", REQUEST: "GetFeature",
      TYPENAMES: "BDCARTO_V5:cours_d_eau", SRSNAME: "EPSG:4326", OUTPUTFORMAT: "application/json",
      PROPERTYNAME: "toponyme,geometrie", COUNT: "5000", STARTINDEX: String(debut), SORTBY: "cleabs" });
    let d = null;
    for (let essai = 0; essai < 4 && !d; essai++) {
      try {
        const r = await fetch(`${WFS}?${q}`);
        if (r.ok) d = await r.json();
      } catch { /* nouvel essai */ }
      if (!d) await new Promise(r => setTimeout(r, 3000));
    }
    if (!d) throw new Error(`cours d'eau à ${debut} illisibles`);
    for (const f of d.features) {
      const g = f.geometry;
      const nom = nomCourt(f.properties.toponyme);
      if (!g || !nom) continue;
      const lignes = g.type === "MultiLineString" ? g.coordinates : [g.coordinates];
      let km = 0;
      for (const l of lignes) for (let k = 1; k < l.length; k++) km += metres(l[k - 1], l[k]) / 1000;
      if (km < LONGUEUR_MIN) continue;
      const rang = rangDe(km);
      const tracés = [];
      for (const l of lignes) {
        const s = simplifier(l, TOLERANCE[rang]);
        const q2 = [];
        let px = null, py = null;
        for (const [lon, lat] of s) {
          const x = Math.round(lon / PAS), y = Math.round(lat / PAS);
          if (x === px && y === py) continue;
          q2.push(x, y); px = x; py = y;
        }
        if (q2.length < 4) continue;
        const delta = [q2[0], q2[1]];
        for (let k = 2; k < q2.length; k += 2) delta.push(q2[k] - q2[k - 2], q2[k + 1] - q2[k - 1]);
        tracés.push(delta);
        points += q2.length / 2;
      }
      if (tracés.length) sortie.push([nom, rang, tracés, km]);
    }
    lus += d.features.length;
    process.stdout.write(`lus : ${lus}, gardés : ${sortie.length}\r`);
    if (d.features.length < 5000) break;
  }
  console.log();
  /* Les plus longs d'abord : à rang égal, le nom du plus long passe le
     premier quand deux noms se disputent la place. */
  sortie.sort((a, b) => b[3] - a[3]);
  /* L'écriture compacte des contours, `src/geographie.js` : entiers
     variables en zigzag, en base 64. Par cours d'eau, le nombre de tracés,
     puis pour chacun le nombre de points et leurs différences. Le nom et
     l'importance vont dans deux listes à part. */
  const octets = [];
  const ecrire = v => {
    let z = v < 0 ? ((-v) << 1) | 1 : v << 1;
    do { let b = z & 0x7f; z >>>= 7; if (z) b |= 0x80; octets.push(b); } while (z);
  };
  for (const [, , tracés] of sortie) {
    ecrire(tracés.length);
    for (const t of tracés) { ecrire(t.length / 2); for (const v of t) ecrire(v); }
  }
  const texte = JSON.stringify({ pas: PAS, source: "BD CARTO IGN",
    noms: sortie.map(r => r[0]), imp: sortie.map(r => r[1]).join(""),
    b64: Buffer.from(octets).toString("base64") });
  fs.writeFileSync(path.join(DONNEES, "rivieres.json"), texte);
  console.log(`cours d'eau : ${sortie.length}, ${points} points, ${texte.length} octets`);
}

/* ---------- Villes ---------- */

async function villes() {
  const r = await fetch("https://geo.api.gouv.fr/communes?fields=nom,centre,population&format=json");
  if (!r.ok) throw new Error(`communes ${r.status}`);
  const l = (await r.json())
    .filter(c => c.population >= 2000 && c.centre?.coordinates)
    .sort((a, b) => b.population - a.population)
    .map(c => [c.nom, +c.centre.coordinates[1].toFixed(3), +c.centre.coordinates[0].toFixed(3),
      Math.round(c.population / 100)]);
  const texte = JSON.stringify({ source: "geo.api.gouv.fr", unite: 100, v: l });
  fs.writeFileSync(path.join(DONNEES, "villes.json"), texte);
  console.log(`villes : ${l.length}, ${texte.length} octets`);
}

/* ---------- Relief ---------- */

const Z = 7;
const EMPRISE = { o: -5.6, e: 10.2, s: 41.2, n: 51.4 };
const tx = lon => Math.floor((lon + 180) / 360 * 2 ** Z);
const ty = lat => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** Z);
};

async function relief() {
  const x0 = tx(EMPRISE.o), x1 = tx(EMPRISE.e), y0 = ty(EMPRISE.n), y1 = ty(EMPRISE.s);
  const tuiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
    if (!r.ok) throw new Error(`tuile ${x},${y} : ${r.status}`);
    tuiles.push({ x: x - x0, y: y - y0, b64: Buffer.from(await r.arrayBuffer()).toString("base64") });
  }
  const nav = await chromium.launch();
  const p = await nav.newPage();
  const res = await p.evaluate(async ({ tuiles, nx, ny, y0 }) => {
    const L = nx * 256, H = ny * 256;
    const cv = new OffscreenCanvas(L, H);
    const c = cv.getContext("2d");
    for (const t of tuiles) {
      const b = await createImageBitmap(await (await fetch(`data:image/png;base64,${t.b64}`)).blob());
      c.drawImage(b, t.x * 256, t.y * 256);
    }
    const d = c.getImageData(0, 0, L, H).data;
    const alt = new Float32Array(L * H);
    for (let i = 0; i < L * H; i++) alt[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    /* L'ombrage de Horn, lumière du nord-ouest à quarante-cinq degrés. Le
       pas au sol d'un point vaut 1,2 kilomètre à l'équateur, réduit par le
       cosinus de la latitude ; l'altitude est exagérée trois fois, sans
       quoi le Massif central ne se verrait pas à cette échelle. */
    const out = c.createImageData(L, H);
    const az = 315 * Math.PI / 180, ze = (90 - 45) * Math.PI / 180;
    for (let y = 0; y < H; y++) {
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y0 * 256 + y + 0.5) / (256 * 2 ** 7))));
      const pas = 156543.03 / 2 ** 7 * Math.cos(lat);
      for (let x = 0; x < L; x++) {
        const a = (i, j) => alt[Math.min(H - 1, Math.max(0, j)) * L + Math.min(L - 1, Math.max(0, i))];
        const dzdx = ((a(x + 1, y - 1) + 2 * a(x + 1, y) + a(x + 1, y + 1)) - (a(x - 1, y - 1) + 2 * a(x - 1, y) + a(x - 1, y + 1))) / (8 * pas) * 3;
        const dzdy = ((a(x - 1, y + 1) + 2 * a(x, y + 1) + a(x + 1, y + 1)) - (a(x - 1, y - 1) + 2 * a(x, y - 1) + a(x + 1, y - 1))) / (8 * pas) * 3;
        const pente = Math.atan(Math.hypot(dzdx, dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);
        const lum = Math.cos(ze) * Math.cos(pente) + Math.sin(ze) * Math.sin(pente) * Math.cos(az - aspect);
        /* Le plat donne cos(45°), environ 0,71 : il est ramené au gris moyen. */
        const plat = Math.cos(ze);
        let g = 128 + (lum - plat) * 300;
        if (alt[y * L + x] <= 0) g = 128;
        g = Math.max(0, Math.min(255, Math.round(g)));
        const k = (y * L + x) * 4;
        out.data[k] = out.data[k + 1] = out.data[k + 2] = g; out.data[k + 3] = 255;
      }
    }
    c.putImageData(out, 0, 0);
    const blob = await cv.convertToBlob({ type: "image/webp", quality: 0.7 });
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192));
    return { b64: btoa(s), L, H };
  }, { tuiles, nx: x1 - x0 + 1, ny: y1 - y0 + 1, y0 });
  await nav.close();
  fs.writeFileSync(path.join(DONNEES, "relief.webp"), Buffer.from(res.b64, "base64"));
  const meta = { z: Z, x0, y0, nx: x1 - x0 + 1, ny: y1 - y0 + 1 };
  fs.writeFileSync(path.join(DONNEES, "relief.json"), JSON.stringify(meta));
  console.log(`relief : ${res.L} sur ${res.H}, ${fs.statSync(path.join(DONNEES, "relief.webp")).size} octets`, meta);
}

const quoi = process.argv.slice(2);
if (!quoi.length || quoi.includes("villes")) await villes();
if (!quoi.length || quoi.includes("relief")) await relief();
if (!quoi.length || quoi.includes("rivieres")) await coursDEau();
