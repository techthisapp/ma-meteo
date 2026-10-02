/* Le fond enrichi de la carte, jalon 19, lot 2, demande de Jérôme du
   2 octobre 2026 : le relief, les cours d'eau et leurs noms, les villes et
   leurs noms selon le zoom.

   Trois fichiers embarqués, fabriqués par `outils/construire-fond.mjs` et
   gardés dans la coque hors ligne. Ils ne se lisent qu'à la première ouverture
   de la carte, environ cinq cents kilooctets compressés pour les trois, puis
   la carte se redessine :
   - `donnees/relief.webp` et `relief.json`, l'ombrage du terrain d'après les
     altitudes publiques Terrarium, en gris autour du gris moyen ;
   - `donnees/rivieres.json`, 4445 cours d'eau d'importance 1 à 4 de la BD
     TOPO de l'IGN ;
   - `donnees/villes.json`, les communes de 2000 habitants et plus.

   Le relief se pose sous les nappes, les cours d'eau entre les nappes et les
   traits, les noms au-dessus de tout ce que la toile dessine. Les étiquettes
   du document, repères des lieux et prévisions, restent au-dessus de la
   toile ; les noms évitent les places qu'elles prennent. */

import { mx, my, echelle } from "./projection.js";

export const FICHIERS = ["./donnees/relief.webp", "./donnees/relief.json",
  "./donnees/rivieres.json", "./donnees/villes.json"];

let relief = null, rivieres = null, villes = null, attente = null;

/* Les lignes au même pas et dans la même écriture que les contours. */
function lecteur(b64) {
  const bin = atob(b64);
  let i = 0;
  return () => {
    let v = 0, d = 0, b;
    do { b = bin.charCodeAt(i++); v |= (b & 0x7f) << d; d += 7; } while (b & 0x80);
    return (v & 1) ? -(v >>> 1) : (v >>> 1);
  };
}

/* Chaque cours d'eau garde ses tracés en coordonnées de monde, déjà projetées,
   et sa boîte : le tracé de chaque image ne fait plus que des multiplications. */
function decoderRivieres(d) {
  const suivant = lecteur(d.b64);
  return d.noms.map((nom, k) => {
    const n = suivant();
    const traces = [];
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (let t = 0; t < n; t++) {
      const m = suivant();
      const l = new Float64Array(m * 2);
      let x = 0, y = 0;
      for (let j = 0; j < m; j++) {
        x += suivant(); y += suivant();
        const wx = mx(x * d.pas), wy = my(y * d.pas);
        l[j * 2] = wx; l[j * 2 + 1] = wy;
        if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
        if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
      }
      traces.push(l);
    }
    return { nom, imp: Number(d.imp[k]), traces, boite: [x0, y0, x1, y1] };
  });
}

/* La lecture des trois fichiers, une seule fois. Une lecture manquée, hors
   connexion avant que la coque les ait gardés, laisse le fond nu, comme avant
   le jalon 19. */
export function charger() {
  if (attente) return attente;
  const json = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const image = new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = "./donnees/relief.webp";
  });
  attente = Promise.all([image, json("./donnees/relief.json"), json("./donnees/rivieres.json"),
    json("./donnees/villes.json")]).then(([im, meta, riv, vil]) => {
    if (im && meta) {
      const n = 2 ** meta.z;
      relief = { im, x0: meta.x0 / n, y0: meta.y0 / n, x1: (meta.x0 + meta.nx) / n, y1: (meta.y0 + meta.ny) / n };
    }
    if (riv) rivieres = decoderRivieres(riv);
    if (vil) {
      villes = vil.v.map(([nom, lat, lon, pop]) => ({ nom, wx: mx(lon), wy: my(lat), pop: pop * (vil.unite || 1) }));
    }
    return { relief: !!relief, rivieres: rivieres?.length || 0, villes: villes?.length || 0 };
  });
  return attente;
}
export const pret = () => !!(relief || rivieres || villes);

/* Les contrôles qui lisent la couleur d'une nappe en un point ouvrent la
   carte sans le fond, par ce drapeau posé avant le chargement : un nom de
   ville ou une rivière tombait sur leurs points. */
const suspendu = () => globalThis.__sansFond === true;

/* Le passage du monde à l'écran pour une vue. */
const repere = (vue, l, h) => {
  const e = echelle(vue.z), cx = mx(vue.lon), cy = my(vue.lat);
  return { e, X: wx => (wx - cx) * e + l / 2, Y: wy => (wy - cy) * e + h / 2,
    fo: cx - l / 2 / e, fe: cx + l / 2 / e, fn: cy - h / 2 / e, fs: cy + h / 2 / e };
};

/* Le relief, en lumière douce : le gris moyen ne change rien, le clair
   éclaire le versant au soleil, le sombre assombrit l'autre. Il s'efface un
   peu aux zooms forts, où l'image, faite à 1,2 kilomètre par point, devient
   floue. */
export function peindreRelief(ctx, vue, l, h, force = 1) {
  if (!relief || suspendu()) return;
  const r = repere(vue, l, h);
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  /* La force dépasse un sur le fond clair, où une seule passe en lumière
     douce se voyait à peine : la passe se répète, la dernière en partie. */
  const f = force * (vue.z <= 8 ? 1 : Math.max(0.3, 1 - (vue.z - 8) * 0.25));
  for (let k = 0; k < f; k++) {
    ctx.globalAlpha = Math.min(1, f - k);
    ctx.drawImage(relief.im, r.X(relief.x0), r.Y(relief.y0),
      (relief.x1 - relief.x0) * r.e, (relief.y1 - relief.y0) * r.e);
  }
  ctx.restore();
}

/* Le zoom à partir duquel un cours d'eau paraît, et celui à partir duquel il
   porte son nom, par rang. Le rang vient de la longueur : 1 au-delà de
   250 kilomètres, 2 au-delà de 80, 3 au-delà de 30, 4 au-delà de 20. Au zoom
   du pays, seuls les fleuves ; au zoom d'un département, les rivières comme
   l'Armançon et la Brenne ; au plus près, leurs affluents. */
export const ZOOM_TRACE = { 1: 5, 2: 5.8, 3: 7, 4: 8.2 };
export const ZOOM_NOM = { 1: 6.2, 2: 7.4, 3: 8.4, 4: 9.2 };

const visibles = (vue, r) => rivieres.filter(v => vue.z >= ZOOM_TRACE[v.imp]
  && v.boite[2] >= r.fo && v.boite[0] <= r.fe && v.boite[3] >= r.fn && v.boite[1] <= r.fs);

export function peindreRivieres(ctx, vue, l, h, couleur) {
  if (!rivieres || suspendu()) return 0;
  const r = repere(vue, l, h);
  const gros = 0.7 + (vue.z - 5) * 0.12;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = couleur;
  ctx.globalAlpha = 0.85;
  let n = 0;
  for (const imp of [4, 3, 2, 1]) {
    ctx.beginPath();
    for (const v of visibles(vue, r)) {
      if (v.imp !== imp) continue;
      for (const t of v.traces) {
        for (let j = 0; j < t.length; j += 2) {
          const x = r.X(t[j]), y = r.Y(t[j + 1]);
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      n++;
    }
    ctx.lineWidth = gros * ({ 1: 1.6, 2: 1.1, 3: 0.8, 4: 0.6 }[imp]);
    ctx.stroke();
  }
  ctx.restore();
  return n;
}

/* La population minimale d'une ville nommée, selon le zoom : les métropoles
   sur le pays entier, les bourgs de deux mille habitants au zoom le plus
   fort. Les noms qui se chevauchent cèdent la place aux villes plus grandes. */
export function popMin(z) {
  if (z < 5.6) return 200000;
  if (z < 6.4) return 80000;
  if (z < 7.2) return 30000;
  if (z < 8) return 12000;
  if (z < 8.8) return 5000;
  if (z < 9.5) return 3000;
  return 2000;
}

const chevauche = (b, pris) => pris.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);

/* Les noms des villes et des cours d'eau. `pris` porte les rectangles déjà
   occupés à l'écran, repères des lieux et étiquettes ; `taire` les noms de
   villes que d'autres étiquettes portent déjà, comme les prévisions. Rend la
   liste des noms posés, que le résumé lu reprend. */
export function peindreNoms(ctx, vue, l, h, style, pris = [], taire = new Set()) {
  const poses = [];
  if ((!villes && !rivieres) || suspendu()) return poses;
  const r = repere(vue, l, h);
  const occupe = pris.map(p => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 }));
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const police = (taille, graisse) => `${graisse} ${taille}px -apple-system, system-ui, sans-serif`;

  /* Les noms se posent par ordre d'importance : les grandes villes, les
     grands cours d'eau, les autres villes, les autres cours d'eau. Une
     première version posait toutes les villes d'abord, et les bourgs
     prenaient la place de la Seine ou de la Saône. */
  const min = popMin(vue.z);
  const nommerVilles = grandes => {
    if (!villes) return;
    for (const v of villes) {
      if (v.pop < min) break;
      const grande = v.pop >= min * 6;
      if (grande !== grandes) continue;
      if (v.wx < r.fo || v.wx > r.fe || v.wy < r.fn || v.wy > r.fs) continue;
      if (taire.has(v.nom)) continue;
      const x = r.X(v.wx), y = r.Y(v.wy);
      const taille = grande ? 13 : 11.5;
      ctx.font = police(taille, grande ? 600 : 500);
      const w = ctx.measureText(v.nom).width;
      /* Le nom à droite du point, ou à gauche près du bord droit. */
      const gauche = x + 5 + w > l - 6;
      const tx = gauche ? x - 5 - w : x + 5;
      const b = { x0: Math.min(x - 3, tx) - 2, x1: Math.max(x + 3, tx + w) + 2, y0: y - taille / 2 - 2, y1: y + taille / 2 + 2 };
      if (b.x0 < 2 || b.y0 < 2 || b.x1 > l - 2 || b.y1 > h - 2 || chevauche(b, occupe)) continue;
      occupe.push(b);
      ctx.fillStyle = style.point;
      ctx.beginPath(); ctx.arc(x, y, grande ? 2.6 : 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = style.halo; ctx.lineWidth = 3;
      ctx.strokeText(v.nom, tx, y);
      ctx.fillStyle = style.ville;
      ctx.fillText(v.nom, tx, y);
      poses.push({ type: "ville", nom: v.nom, b });
    }
  };

  /* Les cours d'eau, le long de leur tracé, en italique, de la couleur de
     l'eau. Le texte reste à l'endroit. */
  const deja = new Set();
  const nommerRivieres = (de, a) => {
    if (!rivieres) return;
    const tries = visibles(vue, r).filter(v => v.nom && v.imp >= de && v.imp <= a && vue.z >= ZOOM_NOM[v.imp]);
    for (const v of tries) {
      if (deja.has(v.nom)) continue;
      ctx.font = `italic ${police(v.imp <= 2 ? 12 : 11, 500)}`;
      const w = ctx.measureText(v.nom).width;
      /* La place du nom : un point du tracé où la corde d'une longueur de
         nom reste presque droite, le plus près du milieu de la partie
         visible. Les tracés simplifiés ont des segments plus courts qu'un
         nom : un seul segment ne suffisait presque jamais. */
      let mieux = null;
      for (const t of v.traces) {
        const pts = [];
        for (let j = 0; j < t.length; j += 2) pts.push([r.X(t[j]), r.Y(t[j + 1])]);
        const cum = [0];
        for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        const total = cum[cum.length - 1];
        if (total < w + 10) continue;
        const a = d => {
          let k = 1;
          while (k < cum.length - 1 && cum[k] < d) k++;
          const u = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
          return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u];
        };
        for (let d = w / 2 + 4; d <= total - w / 2 - 4; d += 14) {
          const p0 = a(d - w / 2), p1 = a(d + w / 2), c = a(d);
          if (c[0] < w / 2 + 6 || c[0] > l - w / 2 - 6 || c[1] < 12 || c[1] > h - 12) continue;
          const corde = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          if (corde < w * 0.82) continue;
          const milieu = Math.hypot(c[0] - l / 2, c[1] - h / 2);
          if (!mieux || milieu < mieux.milieu) {
            mieux = { milieu, x: c[0], y: c[1], a: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) };
          }
        }
      }
      if (!mieux) continue;
      let a = mieux.a;
      if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
      const dx = Math.abs(Math.cos(a)) * w / 2 + 6, dy = Math.abs(Math.sin(a)) * w / 2 + 7;
      const b = { x0: mieux.x - dx, x1: mieux.x + dx, y0: mieux.y - dy, y1: mieux.y + dy };
      if (chevauche(b, occupe)) continue;
      occupe.push(b);
      deja.add(v.nom);
      ctx.save();
      ctx.translate(mieux.x, mieux.y);
      ctx.rotate(a);
      ctx.textAlign = "center";
      ctx.strokeStyle = style.halo; ctx.lineWidth = 3;
      ctx.strokeText(v.nom, 0, -1);
      ctx.fillStyle = style.riviere;
      ctx.fillText(v.nom, 0, -1);
      ctx.restore();
      poses.push({ type: "riviere", nom: v.nom, b });
    }
  };

  nommerVilles(true);
  nommerRivieres(1, 2);
  nommerVilles(false);
  nommerRivieres(3, 4);
  ctx.restore();
  derniers = { poses, pris: occupe.slice(0, pris.length) };
  return poses;
}
/* Les derniers noms posés et les places qu'ils devaient éviter, pour les
   contrôles. */
let derniers = { poses: [], pris: [] };
export const derniersNoms = () => derniers;

/* Les données décodées, pour les prévisions des villes, la bulle d'un point
   et les contrôles. */
export const villesChargees = () => villes;
export const rivieresChargees = () => rivieres;
