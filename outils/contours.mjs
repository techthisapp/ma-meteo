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

/* La topologie des départements.

   Un anneau de département se découpe en arcs. Deux départements voisins
   partagent leurs arcs communs, stockés une seule fois. Chaque département garde
   la suite d'arcs qui referme chacun de ses anneaux, avec le sens de parcours.

   Cette forme sert deux besoins d'un seul jeu de points. Le tracé lit les arcs :
   un arc porté par un seul département est une côte ou une frontière, un arc
   porté par deux est une limite intérieure. Le remplissage lit les suites : la
   teinte d'un département épouse exactement son trait, parce que les deux
   viennent des mêmes points.

   Mesuré le 7 septembre 2026 : 818 arcs et 6818 points, contre 10344 points
   quand les lignes intérieures étaient stockées à part. */

// Les points se quantifient d'abord : deux voisins doivent partager les mêmes.
const qp = ([x, y]) => `${Math.round(x / PAS)},${Math.round(y / PAS)}`;
const depsBruts = [];
for (const f of g1.features) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  // Seul l'anneau extérieur compte : aucun département n'a de trou.
  const rings = polys.map(p => p[0].map(qp)).filter(r => r.length >= 4);
  if (rings.length) depsBruts.push({ code: f.properties.code, rings });
}

/* Dans combien d'anneaux chaque point paraît. Un point de jonction est celui
   dont le compte diffère de celui de son voisin : c'est là que deux
   départements cessent de se suivre. */
const compte = new Map();
for (const d of depsBruts) {
  for (const r of d.rings) {
    for (const p of new Set(r)) compte.set(p, (compte.get(p) || 0) + 1);
  }
}

const arcs = new Map();          // clé de l'arc vers son rang
const usage = [];                // nombre de départements qui portent l'arc
const cleArc = pts => pts.join(";");
const poserArc = a => {
  const c = cleArc(a), ci = cleArc(a.slice().reverse());
  if (arcs.has(c)) { usage[arcs.get(c)]++; return arcs.get(c); }
  if (arcs.has(ci)) { usage[arcs.get(ci)]++; return ~arcs.get(ci); }
  const i = arcs.size;
  arcs.set(c, i);
  usage[i] = 1;
  return i;
};

const departements = [];
for (const d of depsBruts) {
  const anneaux = [];
  for (const r of d.rings) {
    const n = r.length - 1;      // le dernier point répète le premier
    const jonction = i => compte.get(r[i]) !== compte.get(r[(i + 1) % n])
      || compte.get(r[i]) !== compte.get(r[(i - 1 + n) % n]);
    let depart = 0;
    while (depart < n && !jonction(depart)) depart++;
    if (depart === n) { anneaux.push([poserArc(r.slice(0, n + 1))]); continue; }
    const suite = [];
    let i = depart;
    do {
      const a = [r[i]];
      let j = (i + 1) % n;
      a.push(r[j]);
      while (!jonction(j)) { j = (j + 1) % n; a.push(r[j]); }
      suite.push(poserArc(a));
      i = j;
    } while (i !== depart);
    anneaux.push(suite);
  }
  departements.push({ code: d.code, anneaux });
}

// Les arcs simplifiés, dans l'ordre de leur rang.
const arcsPts = [...arcs.keys()].map(c => {
  const brut = c.split(";").map(t => t.split(",").map(Number).map(v => v * PAS));
  return simplifier(brut, TOL_FR);
});

/* Le tracé garde ses deux couches, dérivées de l'usage des arcs. Un arc porté
   par un seul département est une côte ou une frontière ; un arc porté par deux
   est une ligne administrative, dessinée d'un trait plus faible. */
const fr = arcsPts.filter((_, i) => usage[i] === 1);
const frInt = arcsPts.filter((_, i) => usage[i] > 1);

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

const eArcs = encoder(arcsPts);
const eTerre = encoder(terre), eBornes = encoder(bornes);
const poids = s => zlib.gzipSync(Buffer.from(s)).length;

/* L'index des départements : pour chacun, le nombre d'anneaux, puis pour chaque
   anneau le nombre d'arcs, puis les rangs signés. Un rang négatif se lit
   `~rang` et veut dire que l'arc se parcourt à l'envers. */
const octetsIndex = [];
varint(departements.length, octetsIndex);
for (const d of departements) {
  varint(d.anneaux.length, octetsIndex);
  for (const a of d.anneaux) {
    varint(a.length, octetsIndex);
    for (const r of a) varint(r, octetsIndex);
  }
}
const indexB64 = Buffer.from(octetsIndex).toString("base64");
const codesTxt = departements.map(d => d.code).join(",");
const usageUn = usage.filter(u => u === 1).length;

/* Le premier morceau n'a pas de « plus » devant lui : un plus unaire en tête
   ferait un nombre de la chaîne, et la suite se concaténerait à « NaN ». */
const decoupe = s => (s.match(/.{1,96}/g) || [])
  .map((l, i) => `  ${i ? "+ " : ""}"${l}"`).join("\n");

const sortie = `/* Les contours de la carte, dessinés à partir de points embarqués.

   Fabriqué par \`outils/contours.mjs\`, à relancer seulement si les contours
   changent. Deux sources publiques : les départements d'après ADMIN EXPRESS de
   l'IGN sous licence ouverte, les côtes et frontières d'Europe d'après Natural
   Earth, domaine public. Les deux sont citées dans les réglages.

   Le fond est dessiné parce qu'un fond en tuiles coûte trop cher. Mesuré le
   5 septembre 2026 sur la Géoplateforme : une tuile de plan pèse de 42 à
   70 kilooctets, et une vue de téléphone en demande une douzaine, soit de six
   cents kilooctets à un mégaoctet par écran, à chaque déplacement. Toute la
   prévision horaire de l'application en pèse cinq.

   Ce fichier pèse ${eArcs.b64.length + indexB64.length + eTerre.b64.length + eBornes.b64.length} octets de données, une fois pour toutes, et se sert
   avec la coque hors ligne.

   Les coordonnées sont des entiers au pas de ${PAS} degré, encodés en différences
   successives sur des entiers de longueur variable, puis en base 64. Le pas vaut
   cent cinquante mètres en longitude à cette latitude, soit un pixel et demi au
   zoom le plus fort que la carte accepte.

   Les limites des départements forment une topologie. Deux départements voisins
   partagent leurs arcs communs, stockés une seule fois, et chaque département
   garde la suite d'arcs qui referme chacun de ses anneaux. Le tracé et le
   remplissage lisent donc les mêmes points : la teinte d'un département épouse
   exactement son trait.

   Ce qui doublait la France a été retiré de l'Europe : les deux sources ne
   s'accordent pas au mètre près, et sans cette coupe la côte et les frontières
   se dessineraient deux fois, à deux kilomètres l'une de l'autre. */

// Le pas de la grille, en degrés.
export const PAS = ${PAS};

/* Les arcs des limites de départements, ${eArcs.lignes} arcs, ${eArcs.points} points. ${usageUn} ne
   sont portés que par un département : ce sont la côte et la frontière. */
const ARCS =
${decoupe(eArcs.b64)};

/* Pour chaque département, le nombre d'anneaux, puis pour chaque anneau le
   nombre d'arcs et leurs rangs signés. Un rang négatif se lit \`~rang\` et veut
   dire que l'arc se parcourt à l'envers. */
const INDEX =
${decoupe(indexB64)};

// Les codes des ${departements.length} départements, dans l'ordre de l'index.
const CODES = "${codesTxt}";

/* Les côtes d'Europe autour de la France, ${eTerre.lignes} morceaux, ${eTerre.points} points. */
const TERRE =
${decoupe(eTerre.b64)};

/* Les frontières des pays voisins, ${eBornes.lignes} morceaux, ${eBornes.points} points. */
const BORNES =
${decoupe(eBornes.b64)};

/* Décodage. Chaque ligne devient un tableau plat de longitudes et de latitudes
   alternées, en degrés : c'est la forme que le tracé consomme, sans objet
   intermédiaire par point. */
function lecteur(b64) {
  const bin = atob(b64);
  let i = 0;
  return () => {
    let v = 0, d = 0, b;
    do { b = bin.charCodeAt(i++); v |= (b & 0x7f) << d; d += 7; } while (b & 0x80);
    return (v & 1) ? -(v >>> 1) : (v >>> 1);
  };
}

function decoder(b64) {
  const suivant = lecteur(b64);
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

/* Les couches, décodées une seule fois. Le décodage de ${eArcs.points + eTerre.points + eBornes.points} points prend
   quelques millisecondes, et la carte se redessine à chaque geste : le refaire à
   chaque image serait le seul calcul lourd du tracé. */
let jeu = null;
function charger() {
  if (jeu) return jeu;
  const arcs = decoder(ARCS);
  const suivant = lecteur(INDEX);
  const codes = CODES.split(",");
  const deps = new Map();
  const usage = new Int8Array(arcs.length);
  const n = suivant();
  for (let k = 0; k < n; k++) {
    const anneaux = [];
    const na = suivant();
    for (let a = 0; a < na; a++) {
      const nr = suivant();
      const suite = new Int32Array(nr);
      for (let r = 0; r < nr; r++) {
        const v = suivant();
        suite[r] = v;
        const rang = v < 0 ? ~v : v;
        if (usage[rang] < 2) usage[rang]++;
      }
      anneaux.push(suite);
    }
    deps.set(codes[k], anneaux);
  }
  jeu = { arcs, deps, usage,
    terre: decoder(TERRE), bornes: decoder(BORNES) };
  return jeu;
}

/* Les quatre couches du tracé. Le contour porte les arcs qu'un seul département
   touche, les limites intérieures ceux que deux départements partagent. */
let couches = null;
export function contours() {
  if (!couches) {
    const j = charger();
    couches = {
      contour: j.arcs.filter((_, i) => j.usage[i] === 1),
      departements: j.arcs.filter((_, i) => j.usage[i] > 1),
      terre: j.terre,
      bornes: j.bornes,
    };
  }
  return couches;
}

/* Les anneaux d'un département, en tableaux plats de longitudes et de latitudes.
   Le premier point de chaque arc répète le dernier du précédent : il se saute,
   sans quoi le tracé reviendrait sur lui-même à chaque jonction. */
const anneauxCache = new Map();
export function anneauxDe(code) {
  if (anneauxCache.has(code)) return anneauxCache.get(code);
  const j = charger();
  const suites = j.deps.get(code);
  if (!suites) { anneauxCache.set(code, null); return null; }
  const out = suites.map(suite => {
    const pts = [];
    for (const v of suite) {
      const a = j.arcs[v < 0 ? ~v : v];
      const m = a.length / 2;
      if (v < 0) {
        for (let k = m - 1; k >= 0; k--) {
          if (k === m - 1 && pts.length) continue;
          pts.push(a[k * 2], a[k * 2 + 1]);
        }
      } else {
        for (let k = 0; k < m; k++) {
          if (k === 0 && pts.length) continue;
          pts.push(a[k * 2], a[k * 2 + 1]);
        }
      }
    }
    return Float64Array.from(pts);
  });
  anneauxCache.set(code, out);
  return out;
}

// Les codes des départements portés par le fichier.
export const codesDepartements = () => [...charger().deps.keys()];
`;

fs.writeFileSync(new URL("../src/geographie.js", import.meta.url), sortie);
console.log(`Arcs    : ${eArcs.lignes} arcs, ${eArcs.points} points, ${eArcs.b64.length} octets, ${poids(eArcs.b64)} compressés`);
console.log(`  dont ${usageUn} portés par un seul département, ${eArcs.lignes - usageUn} partagés`);
console.log(`Index   : ${departements.length} départements, ${indexB64.length} octets, ${poids(indexB64)} compressés`);
console.log(`Terre   : ${eTerre.lignes} lignes, ${eTerre.points} points, ${eTerre.b64.length} octets, ${poids(eTerre.b64)} compressés`);
console.log(`Bornes  : ${eBornes.lignes} lignes, ${eBornes.points} points, ${eBornes.b64.length} octets, ${poids(eBornes.b64)} compressés`);
console.log(`src/geographie.js écrit, ${fs.statSync(new URL("../src/geographie.js", import.meta.url)).size} octets`);
