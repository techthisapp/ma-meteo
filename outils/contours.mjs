/* Fabrique `src/geographie.js` à partir de deux sources publiques.

   À relancer seulement si les contours changent, ce qui n'arrive pas plus d'une
   fois par décennie. Les fichiers sources ne sont pas gardés dans le dépôt : ils
   se téléchargent, se simplifient et s'encodent ici, et c'est le résultat qui est
   versionné.

       node outils/contours.mjs

   Deux sources, deux licences citées dans l'application :
   - les départements français, d'après ADMIN EXPRESS de l'IGN, licence ouverte ;
   - les côtes et les frontières d'Europe, Natural Earth, domaine public.

   Pourquoi un fond dessiné plutôt que des tuiles. Mesuré le 5 septembre 2026 sur
   la Géoplateforme de l'IGN : une tuile de plan pèse de 42 à 70 kilooctets, et
   une vue de téléphone en demande une douzaine, soit six cents kilooctets à un
   mégaoctet par écran, à chaque déplacement. Toute la prévision horaire de
   l'application en pèse cinq. Les contours embarqués coûtent une trentaine de
   kilooctets une fois pour toutes, se dessinent hors ligne, suivent les deux
   thèmes et ne demandent aucune attribution en surimpression. */

import fs from "node:fs";
import zlib from "node:zlib";

const SOURCES = {
  departements: "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson",
  terre: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson",
  bornes: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_boundary_lines_land.geojson",
};

/* La fenêtre que la carte peut montrer : la France métropolitaine et ce qui
   l'entoure. Au delà, rien ne se dessine jamais, et le garder coûterait des
   octets pour des côtes qu'on ne verra pas. */
const FENETRE = { o: -7, e: 13, s: 40, n: 53 };

/* Le pas de la grille, en degrés. Deux millièmes valent cent cinquante mètres en
   longitude à cette latitude, soit un pixel et demi au zoom le plus fort que la
   carte accepte. */
const PAS = 0.002;

/* La tolérance de simplification, en degrés. Huit millièmes valent six cents
   mètres, soit un pixel et demi au zoom 8 : la ligne reste juste là où on la
   regarde, et le fichier perd le quart de ses points. */
const TOL_FR = 0.008;
const TOL_EUROPE = 0.01;

/* La distance en deçà de laquelle une ligne d'Europe double une ligne de France.
   Les deux sources ne s'accordent pas au mètre près : sans cette coupe, la côte
   et les frontières se dessineraient deux fois, à deux kilomètres l'une de
   l'autre. */
const DOUBLON = 0.03;

const lire = async (nom, url) => {
  const cache = `/tmp/contours-${nom}.geojson`;
  if (!fs.existsSync(cache)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${nom} : ${r.status}`);
    fs.writeFileSync(cache, await r.text());
  }
  return JSON.parse(fs.readFileSync(cache, "utf8"));
};

const dedans = ([x, y]) =>
  x >= FENETRE.o - 1 && x <= FENETRE.e + 1 && y >= FENETRE.s - 1 && y <= FENETRE.n + 1;

/* Découpe une suite de points en morceaux dont au moins un point est dans la
   fenêtre, en gardant un point de part et d'autre pour que la ligne sorte du
   cadre au lieu de s'arrêter net. */
function couper(ligne, garde = dedans) {
  const out = [];
  let cur = [];
  for (let i = 0; i < ligne.length; i++) {
    const proche = garde(ligne[i])
      || (i > 0 && garde(ligne[i - 1]))
      || (i + 1 < ligne.length && garde(ligne[i + 1]));
    if (proche) cur.push(ligne[i]);
    else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out.filter(l => l.length >= 2);
}

function lignesDe(g, avecAnneaux) {
  const out = [];
  for (const f of g.features) {
    const t = f.geometry.type, c = f.geometry.coordinates;
    const brut = [];
    if (t === "LineString") brut.push(c);
    else if (t === "MultiLineString") brut.push(...c);
    else if (avecAnneaux && t === "Polygon") brut.push(...c);
    else if (avecAnneaux && t === "MultiPolygon") for (const p of c) brut.push(...p);
    for (const l of brut) out.push(...couper(l));
  }
  return out;
}

/* Douglas-Peucker. Un anneau fermé se coupe en deux avant d'être simplifié : ses
   deux bouts sont le même point, et la droite qui les joint est de longueur
   nulle, ce qui rendrait toutes les distances nulles et l'anneau vide. */
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const garde = new Array(pts.length).fill(false);
  garde[0] = garde[pts.length - 1] = true;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop();
    let pire = 0, k = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2 - x1, dy = y2 - y1;
    const den = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i];
      const d = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / den;
      if (d > pire) { pire = d; k = i; }
    }
    if (pire > tol && k > 0) { garde[k] = true; pile.push([a, k], [k, b]); }
  }
  return pts.filter((_, i) => garde[i]);
}

function simplifier(ligne, tol) {
  const n = ligne.length;
  const ferme = n > 3 && ligne[0][0] === ligne[n - 1][0] && ligne[0][1] === ligne[n - 1][1];
  if (!ferme) return dp(ligne, tol);
  let k = 1, pire = -1;
  for (let i = 1; i < n - 1; i++) {
    const d = Math.hypot(ligne[i][0] - ligne[0][0], ligne[i][1] - ligne[0][1]);
    if (d > pire) { pire = d; k = i; }
  }
  return dp(ligne.slice(0, k + 1), tol).concat(dp(ligne.slice(k), tol).slice(1));
}

const varint = (n, out) => {
  let v = n < 0 ? (-n << 1) | 1 : n << 1;
  do { const b = v & 0x7f; v >>>= 7; out.push(v ? b | 0x80 : b); } while (v);
};

function encoder(lignes) {
  const gardees = [];
  for (const l of lignes) {
    const q = l.map(([x, y]) => [Math.round(x / PAS), Math.round(y / PAS)]);
    const u = q.filter((p, i) => i === 0 || p[0] !== q[i - 1][0] || p[1] !== q[i - 1][1]);
    if (u.length >= 2) gardees.push(u);
  }
  const out = [];
  varint(gardees.length, out);
  for (const u of gardees) {
    varint(u.length, out);
    let px = 0, py = 0;
    for (const [x, y] of u) { varint(x - px, out); varint(y - py, out); px = x; py = y; }
  }
  return {
    b64: Buffer.from(out).toString("base64"),
    lignes: gardees.length,
    points: gardees.reduce((a, u) => a + u.length, 0),
  };
}

// Point dans un des anneaux, par la règle pair-impair.
function dansUn(anneaux, x, y) {
  for (const a of anneaux) {
    let d = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i], [xj, yj] = a[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
    }
    if (d) return true;
  }
  return false;
}

// Distance d'un point au segment le plus proche d'un jeu de lignes.
function pres(lignes, x, y, seuil) {
  const s2 = seuil * seuil;
  for (const l of lignes) {
    for (let i = 1; i < l.length; i++) {
      const [x1, y1] = l[i - 1], [x2, y2] = l[i];
      if (Math.min(x1, x2) - seuil > x || Math.max(x1, x2) + seuil < x) continue;
      if (Math.min(y1, y2) - seuil > y || Math.max(y1, y2) + seuil < y) continue;
      const dx = x2 - x1, dy = y2 - y1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
      const ex = x1 + t * dx - x, ey = y1 + t * dy - y;
      if (ex * ex + ey * ey <= s2) return true;
    }
  }
  return false;
}

const g1 = await lire("departements", SOURCES.departements);
const anneauxFr = lignesDe(g1, true);

/* Le contour du pays et les limites intérieures ne se dessinent pas du même
   trait : l'un est une côte ou une frontière, l'autre une ligne administrative.
   Un segment partagé par deux départements est intérieur, un segment vu une
   seule fois est extérieur. Le partage se lit sur les coordonnées d'origine :
   la simplification, faite département par département, ne rendrait plus les
   mêmes points de part et d'autre. */
const cleSeg = (a, b) => {
  const p = `${a[0].toFixed(6)},${a[1].toFixed(6)}`;
  const q = `${b[0].toFixed(6)},${b[1].toFixed(6)}`;
  return p < q ? `${p}|${q}` : `${q}|${p}`;
};
const vus = new Map();
for (const l of anneauxFr) {
  for (let i = 1; i < l.length; i++) {
    const c = cleSeg(l[i - 1], l[i]);
    vus.set(c, (vus.get(c) || 0) + 1);
  }
}

/* Chaque anneau se coupe en suites d'un même genre. Une suite intérieure est
   parcourue deux fois, une par département voisin : la seconde est écartée par
   sa clé, laquelle ne dépend pas du sens de parcours. */
const dejaVues = new Set();
const contour = [], interieur = [];
const cleSuite = suite => {
  const t = suite.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`);
  const env = t.slice().reverse();
  return (t.join(";") < env.join(";") ? t : env).join(";");
};
for (const l of anneauxFr) {
  let cur = [l[0]], dedansAvant = null;
  for (let i = 1; i < l.length; i++) {
    const int = (vus.get(cleSeg(l[i - 1], l[i])) || 0) > 1;
    if (dedansAvant !== null && int !== dedansAvant) {
      (dedansAvant ? interieur : contour).push(cur);
      cur = [l[i - 1]];
    }
    cur.push(l[i]);
    dedansAvant = int;
  }
  if (cur.length >= 2) (dedansAvant ? interieur : contour).push(cur);
}
const dedupe = suites => suites.filter(s => {
  const c = cleSuite(s);
  if (dejaVues.has(c)) return false;
  dejaVues.add(c);
  return true;
});
const fr = dedupe(contour).map(l => simplifier(l, TOL_FR));
const frInt = dedupe(interieur).map(l => simplifier(l, TOL_FR));

/* Ce qui double la France est retiré de l'Europe : les points à l'intérieur du
   territoire, et ceux qui longent la côte ou la frontière. */
const horsFrance = ([x, y]) => !dansUn(anneauxFr, x, y) && !pres(fr, x, y, DOUBLON);
const europeDe = async (nom, url, avecAnneaux) => {
  const brut = lignesDe(await lire(nom, url), avecAnneaux);
  const coupe = [];
  for (const l of brut) coupe.push(...couper(l, p => dedans(p) && horsFrance(p)));
  return coupe.map(l => simplifier(l, TOL_EUROPE));
};

const terre = await europeDe("terre", SOURCES.terre, true);
const bornes = await europeDe("bornes", SOURCES.bornes, false);

const eFr = encoder(fr), eFrInt = encoder(frInt);
const eTerre = encoder(terre), eBornes = encoder(bornes);
const poids = s => zlib.gzipSync(Buffer.from(s)).length;

/* Le premier morceau n'a pas de « plus » devant lui : un plus unaire en tête
   ferait un nombre de la chaîne, et la suite se concaténerait à « NaN ». */
const decoupe = s => (s.match(/.{1,96}/g) || [])
  .map((l, i) => `  ${i ? "+ " : ""}"${l}"`).join("\n");

const sortie = `/* Les contours de la carte, dessinés et non chargés.

   Fabriqué par \`outils/contours.mjs\`, à relancer seulement si les contours
   changent. Deux sources publiques : les départements d'après ADMIN EXPRESS de
   l'IGN sous licence ouverte, les côtes et frontières d'Europe d'après Natural
   Earth, domaine public. Les deux sont citées dans les réglages.

   Le fond est dessiné parce qu'un fond en tuiles coûte trop cher. Mesuré le
   5 septembre 2026 sur la Géoplateforme : une tuile de plan pèse de 42 à
   70 kilooctets, et une vue de téléphone en demande une douzaine, soit de six
   cents kilooctets à un mégaoctet par écran, à chaque déplacement. Toute la
   prévision horaire de l'application en pèse cinq.

   Ce fichier pèse ${eFr.b64.length + eFrInt.b64.length + eTerre.b64.length + eBornes.b64.length} octets de données, une fois pour toutes, et se sert avec
   la coque hors ligne.

   Les coordonnées sont des entiers au pas de ${PAS} degré, encodés en différences
   successives sur des entiers de longueur variable, puis en base 64. Le pas vaut
   cent cinquante mètres en longitude à cette latitude, soit un pixel et demi au
   zoom le plus fort que la carte accepte.

   Ce qui doublait la France a été retiré de l'Europe : les deux sources ne
   s'accordent pas au mètre près, et sans cette coupe la côte et les frontières
   se dessineraient deux fois, à deux kilomètres l'une de l'autre. */

// Le pas de la grille, en degrés.
export const PAS = ${PAS};

/* Le contour du pays, ${eFr.lignes} morceaux, ${eFr.points} points : la côte et la frontière,
   c'est-à-dire les segments qu'un seul département porte. */
const CONTOUR =
${decoupe(eFr.b64)};

/* Les limites entre départements, ${eFrInt.lignes} morceaux, ${eFrInt.points} points : les segments que
   deux départements partagent. Elles se dessinent d'un trait plus faible, une
   ligne administrative n'étant pas une côte. */
const DEPARTEMENTS =
${decoupe(eFrInt.b64)};

/* Les côtes d'Europe autour de la France, ${eTerre.lignes} morceaux, ${eTerre.points} points. */
const TERRE =
${decoupe(eTerre.b64)};

/* Les frontières des pays voisins, ${eBornes.lignes} morceaux, ${eBornes.points} points. */
const BORNES =
${decoupe(eBornes.b64)};

/* Décodage. Chaque ligne devient un tableau plat de longitudes et de latitudes
   alternées, en degrés : c'est la forme que le tracé consomme, sans objet
   intermédiaire par point. */
function decoder(b64) {
  const bin = atob(b64);
  let i = 0;
  const suivant = () => {
    let v = 0, d = 0, b;
    do { b = bin.charCodeAt(i++); v |= (b & 0x7f) << d; d += 7; } while (b & 0x80);
    return (v & 1) ? -(v >>> 1) : (v >>> 1);
  };
  const lignes = [];
  const n = suivant();
  for (let k = 0; k < n; k++) {
    const m = suivant();
    const l = new Float64Array(m * 2);
    let x = 0, y = 0;
    for (let j = 0; j < m; j++) {
      x += suivant(); y += suivant();
      l[j * 2] = x * PAS; l[j * 2 + 1] = y * PAS;
    }
    lignes.push(l);
  }
  return lignes;
}

/* Les quatre couches, décodées une seule fois. Le décodage de ${eFr.points + eFrInt.points + eTerre.points + eBornes.points} points
   prend quelques millisecondes, et la carte se redessine à chaque geste : le
   refaire à chaque image serait le seul calcul lourd du tracé. */
let couches = null;
export function contours() {
  if (!couches) {
    couches = {
      contour: decoder(CONTOUR),
      departements: decoder(DEPARTEMENTS),
      terre: decoder(TERRE),
      bornes: decoder(BORNES),
    };
  }
  return couches;
}
`;

fs.writeFileSync(new URL("../src/geographie.js", import.meta.url), sortie);
console.log(`Contour : ${eFr.lignes} lignes, ${eFr.points} points, ${eFr.b64.length} octets, ${poids(eFr.b64)} compressés`);
console.log(`Départ. : ${eFrInt.lignes} lignes, ${eFrInt.points} points, ${eFrInt.b64.length} octets, ${poids(eFrInt.b64)} compressés`);
console.log(`Terre   : ${eTerre.lignes} lignes, ${eTerre.points} points, ${eTerre.b64.length} octets, ${poids(eTerre.b64)} compressés`);
console.log(`Bornes  : ${eBornes.lignes} lignes, ${eBornes.points} points, ${eBornes.b64.length} octets, ${poids(eBornes.b64)} compressés`);
console.log(`src/geographie.js écrit, ${fs.statSync(new URL("../src/geographie.js", import.meta.url)).size} octets`);
