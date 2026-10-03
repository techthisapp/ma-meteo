/* Les restrictions d'eau par zone d'alerte, jalon 19, lot 6, décision de
   Jérôme du 2 octobre 2026 : par département à l'échelle du pays, par zone
   d'alerte à partir du zoom d'un département.

   VigiEau publie chaque jour les zones et leurs arrêtés en vigueur en tuiles
   vectorielles, dans une seule archive PMTiles lue par plages d'octets, ouverte
   aux autres sites. Mesuré le 2 octobre 2026 : 92 Mo en tout, du zoom 4 au
   zoom 12 ; une vue de département coûte de 40 à 160 Ko. Chaque zone porte son
   niveau, son type de ressource et son nom.

   Le lecteur tient ici, sans bibliothèque : l'en-tête et les répertoires de
   l'archive, puis le décodage des tuiles au format Mapbox Vector Tile. Les
   répertoires et les tuiles se décompressent par `DecompressionStream`.

   L'archive se refait chaque jour à la même adresse : ses positions changent.
   L'en-tête se relit donc toutes les heures, et une tuile illisible fait relire
   l'en-tête. */

import { chercherEn } from "./horloge.js";

export const ADRESSE = "https://regleau.s3.gra.perf.cloud.ovh.net/pmtiles/zones_arretes_en_vigueur.pmtiles";
export const GARDE = 3600 * 1000;
/* Le zoom à partir duquel les zones remplacent les départements : celui d'un
   département, comme pour les cours d'eau de Hub'eau. */
export const ZOOM_ZONES = 7.5;
const lire = chercherEn(15000);

/* ---------- Octets ---------- */

async function octets(debut, longueur, fetcheur = lire) {
  const r = await fetcheur(ADRESSE, { headers: { Range: `bytes=${debut}-${debut + longueur - 1}` } });
  if (!r.ok) throw new Error(`zones ${r.status}`);
  const b = await r.arrayBuffer();
  /* Un serveur qui ignore la plage rend tout le fichier : la plage se coupe. */
  return r.status === 206 ? b : b.slice(debut, debut + longueur);
}

async function degonfler(b, compression) {
  if (compression !== 2) return b;
  const flux = new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(flux).arrayBuffer();
}

/* Les entiers de longueur variable des répertoires. */
function lecteurVarint(u8) {
  let i = 0;
  return () => {
    let v = 0, mul = 1, b;
    do { b = u8[i++]; v += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80);
    return v;
  };
}

export function lireRepertoire(u8) {
  const suivant = lecteurVarint(u8);
  const n = suivant();
  const e = Array.from({ length: n }, () => ({ id: 0, run: 0, long: 0, pos: 0 }));
  let id = 0;
  for (const x of e) { id += suivant(); x.id = id; }
  for (const x of e) x.run = suivant();
  for (const x of e) x.long = suivant();
  e.forEach((x, k) => {
    const v = suivant();
    x.pos = v === 0 && k > 0 ? e[k - 1].pos + e[k - 1].long : v - 1;
  });
  return e;
}

const u64 = (dv, o) => dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296;
export function lireEntete(b) {
  const dv = new DataView(b);
  const magie = String.fromCharCode(...new Uint8Array(b, 0, 7));
  if (magie !== "PMTiles" || dv.getUint8(7) !== 3) throw new Error("archive inconnue");
  return {
    racine: [u64(dv, 8), u64(dv, 16)], feuilles: [u64(dv, 40), u64(dv, 48)], donnees: [u64(dv, 56), u64(dv, 64)],
    compression: dv.getUint8(97), compressionTuiles: dv.getUint8(98), type: dv.getUint8(99),
    zmin: dv.getUint8(100), zmax: dv.getUint8(101),
  };
}

/* Le rang d'une tuile dans l'archive : les tuiles des zooms inférieurs, puis la
   courbe de Hilbert du zoom. */
export function rangTuile(z, x, y) {
  let acc = 0;
  for (let t = 0; t < z; t++) acc += 4 ** t;
  const n = 2 ** z;
  let d = 0;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = n - 1 - x; y = n - 1 - y; }
      [x, y] = [y, x];
    }
  }
  return acc + d;
}

function chercherEntree(e, id) {
  let a = 0, b = e.length - 1;
  while (a <= b) {
    const m = (a + b) >> 1;
    if (e[m].id < id) a = m + 1; else if (e[m].id > id) b = m - 1; else return e[m];
  }
  if (b >= 0 && (e[b].run === 0 || id - e[b].id < e[b].run)) return e[b];
  return null;
}

/* ---------- Tuiles vectorielles ----------

   Le format est un message protobuf : des couches, chacune avec ses clés, ses
   valeurs et ses objets ; chaque objet porte des étiquettes, un type et une
   géométrie en commandes de tracé. Seuls les polygones servent ici. */
function protobuf(u8) {
  let i = 0;
  const varint = () => { let v = 0, mul = 1, b; do { b = u8[i++]; v += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80); return v; };
  return {
    fin: () => i >= u8.length,
    cle: () => { const k = varint(); return [Math.floor(k / 8), k & 7]; },
    varint,
    octets: () => { const n = varint(); const s = u8.subarray(i, i + n); i += n; return s; },
    /* La longueur se lit avant d'avancer : `i += varint()` lisait `i` avant
       que la lecture de la longueur ne l'avance, et perdait un octet. */
    sauter: t => {
      if (t === 0) varint();
      else if (t === 1) i += 8;
      else if (t === 2) { const n = varint(); i += n; }
      else if (t === 5) i += 4;
    },
    double: () => { const v = new DataView(u8.buffer, u8.byteOffset + i, 8).getFloat64(0, true); i += 8; return v; },
    flottant: () => { const v = new DataView(u8.buffer, u8.byteOffset + i, 4).getFloat32(0, true); i += 4; return v; },
  };
}
const texte = u8 => new TextDecoder().decode(u8);
const paquet = u8 => { const p = protobuf(u8), out = []; while (!p.fin()) out.push(p.varint()); return out; };

function valeur(u8) {
  const p = protobuf(u8);
  let v = null;
  while (!p.fin()) {
    const [f, t] = p.cle();
    if (f === 1) v = texte(p.octets());
    else if (f === 2) v = p.flottant();
    else if (f === 3) v = p.double();
    else if (f === 4 || f === 5) v = p.varint();
    else if (f === 6) { const z = p.varint(); v = z % 2 ? -(z + 1) / 2 : z / 2; }
    else if (f === 7) v = p.varint() !== 0;
    else p.sauter(t);
  }
  return v;
}

/* Les anneaux d'un polygone, en coordonnées de monde entre zéro et un. */
function anneaux(cmds, z, x, y, etendue) {
  const n = 2 ** z, out = [];
  let px = 0, py = 0, cur = null, i = 0;
  const zz = v => (v % 2 ? -(v + 1) / 2 : v / 2);
  while (i < cmds.length) {
    const c = cmds[i++], id = c & 7, nb = c >> 3;
    if (id === 7) { if (cur) out.push(cur); cur = null; continue; }
    for (let k = 0; k < nb; k++) {
      px += zz(cmds[i++]); py += zz(cmds[i++]);
      const w = [(x + px / etendue) / n, (y + py / etendue) / n];
      if (id === 1) { if (cur) out.push(cur); cur = [w]; } else if (cur) cur.push(w);
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function decoderTuile(b, z, x, y) {
  const p = protobuf(new Uint8Array(b));
  const zones = [];
  while (!p.fin()) {
    const [f, t] = p.cle();
    if (f !== 3) { p.sauter(t); continue; }
    const c = protobuf(p.octets());
    const cles = [], vals = [], objets = [];
    let etendue = 4096;
    while (!c.fin()) {
      const [g, tg] = c.cle();
      if (g === 2) objets.push(c.octets());
      else if (g === 3) cles.push(texte(c.octets()));
      else if (g === 4) vals.push(valeur(c.octets()));
      else if (g === 5) etendue = c.varint();
      else c.sauter(tg);
    }
    for (const o of objets) {
      const q = protobuf(o);
      let tags = [], type = 0, geo = [];
      while (!q.fin()) {
        const [h, th] = q.cle();
        if (h === 2) tags = paquet(q.octets());
        else if (h === 3) type = q.varint();
        else if (h === 4) geo = paquet(q.octets());
        else q.sauter(th);
      }
      if (type !== 3) continue;
      const props = {};
      for (let k = 0; k + 1 < tags.length; k += 2) props[cles[tags[k]]] = vals[tags[k + 1]];
      zones.push({ niveau: props.niveauGravite || null, type: props.type || null, nom: props.nom || "",
        anneaux: anneaux(geo, z, x, y, etendue) });
    }
  }
  return zones;
}

/* ---------- L'archive ---------- */

let archive = null;
const tuiles = new Map();
const MAX_TUILES = 64;

async function ouvrir(fetcheur) {
  if (archive && Date.now() < archive.exp) return archive;
  const tete = lireEntete(await octets(0, 16384, fetcheur));
  const racine = lireRepertoire(new Uint8Array(await degonfler(await octets(...tete.racine, fetcheur), tete.compression)));
  archive = { tete, racine, feuilles: new Map(), exp: Date.now() + GARDE };
  tuiles.clear();
  return archive;
}

/* Les zones d'une tuile, gardées ; `null` si la tuile n'existe pas. */
export async function zonesTuile(z, x, y, fetcheur = lire) {
  const cle = `${z}/${x}/${y}`;
  if (tuiles.has(cle)) return tuiles.get(cle);
  for (let essai = 0; essai < 2; essai++) {
    try {
      const a = await ouvrir(fetcheur);
      const id = rangTuile(z, x, y);
      let e = chercherEntree(a.racine, id), profondeur = 0;
      while (e && e.run === 0 && profondeur++ < 3) {
        const k = `${e.pos}/${e.long}`;
        if (!a.feuilles.has(k)) {
          const b = await octets(a.tete.feuilles[0] + e.pos, e.long, fetcheur);
          a.feuilles.set(k, lireRepertoire(new Uint8Array(await degonfler(b, a.tete.compression))));
        }
        e = chercherEntree(a.feuilles.get(k), id);
      }
      let zones = null;
      if (e && e.run > 0) {
        const b = await octets(a.tete.donnees[0] + e.pos, e.long, fetcheur);
        zones = decoderTuile(await degonfler(b, a.tete.compressionTuiles), z, x, y);
      }
      if (tuiles.size >= MAX_TUILES) tuiles.delete(tuiles.keys().next().value);
      tuiles.set(cle, zones);
      return zones;
    } catch {
      archive = null;
    }
  }
  return null;
}

export const bornesZoom = () => (archive ? [archive.tete.zmin, archive.tete.zmax] : [4, 12]);
export async function ouvrirArchive(fetcheur = lire) { return (await ouvrir(fetcheur)).tete; }
export function oublier() { archive = null; tuiles.clear(); }
