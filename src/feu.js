/* La boule de feu de l'écran Le soleil.

   Tout est peint sur une toile. Le disque reçoit d'abord ses tons sombres,
   puis la matière chaude est ajoutée par-dessus en lumière : un bruit gris
   posé en incrustation délave la couleur, un bruit teinté ajouté en lumière
   la garde et donne le rougeoiement.

   Coût : les motifs coûteux sont dessinés une seule fois hors écran et gardés
   par pas de teinte ; chaque image ne fait plus que composer des images déjà
   prêtes, à trente par seconde. La boucle s'arrête dès que la toile quitte le
   document ou que l'écran passe en arrière-plan, et ne démarre pas du tout
   sous mouvement réduit, où une seule image est rendue. */

const sombrir = (v, k) => v.map(x => Math.round(x * k));

/* Palette du feu. Le Soleil bas est rougi par l'atmosphère, le Soleil haut
   tire vers le clair. Les couches ajoutées en lumière portent peu de bleu :
   là où elles se cumulent jusqu'à saturation, la couleur monte vers le jaune,
   non vers le blanc bleuté. `chaud` vaut un à l'horizon, zéro au delà de
   vingt-cinq degrés. */
export function palette(chaud) {
  const m = (haut, bas) => haut.map((v, k) => Math.round(v + (bas[k] - v) * chaud));
  return {
    corpsCoeur: m([255, 214, 132], [255, 168, 62]),
    corpsBord: m([238, 138, 46], [196, 78, 20]),
    matiere1: m([255, 246, 206], [255, 226, 154]),
    matiere2: m([255, 214, 118], [255, 168, 62]),
    matiere3: m([255, 158, 48], [242, 112, 26]),
    coeur: m([255, 250, 226], [255, 222, 160]),
    couronne1: m([255, 224, 150], [255, 186, 92]),
    couronne2: m([255, 170, 62], [236, 118, 34]),
    ombre: m([176, 74, 18], [120, 40, 8]),
  };
}

// Rayon du disque, en fraction du côté de la toile.
export const RAYON = 0.19;

/* ---------- Bruit ----------

   Bruit de valeur périodique, sommé sur cinq octaves puis creusé pour faire
   ressortir des filaments. Périodique pour que la texture se raccorde à
   elle-même quand elle tourne. Rendu en blanc, l'opacité portant la valeur :
   la couleur est posée ensuite, une fois par teinte. */

function bruitFractal(cote) {
  let graine = 20260821;
  const alea = () => (graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296;

  const grille = n => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) g[i] = alea();
    return g;
  };

  const octaves = [4, 8, 16, 32, 64].map(n => ({ n, g: grille(n) }));

  const valeur = (o, x, y) => {
    const n = o.n, g = o.g;
    const xf = x * n, yf = y * n;
    const x0 = Math.floor(xf) % n, y0 = Math.floor(yf) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const fx = xf - Math.floor(xf), fy = yf - Math.floor(yf);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    const h1 = a + (b - a) * sx, h2 = c + (d - c) * sx;
    return h1 + (h2 - h1) * sy;
  };

  const cv = document.createElement("canvas");
  cv.width = cv.height = cote;
  const x = cv.getContext("2d");
  const img = x.createImageData(cote, cote);
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) {
      let v = 0, amp = 1, som = 0;
      for (const o of octaves) { v += valeur(o, i / cote, j / cote) * amp; som += amp; amp *= 0.55; }
      v /= som;
      // Creusement : les crêtes deviennent des filaments, les creux du vide.
      const filament = 1 - Math.abs(2 * v - 1);
      let f = 0.55 * v + 0.45 * filament * filament;
      f = Math.max(0, Math.min(1, (f - 0.34) * 1.9));
      const k = (j * cote + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(Math.pow(f, 1.25) * 255);
    }
  }
  x.putImageData(img, 0, 0);
  return cv;
}

/* Le bruit se calcule au premier besoin, non au chargement du module : un
   écran qui ne montre pas le Soleil n'a pas à payer sa texture. */
let TEX_BRUIT = null;
const bruit = () => (TEX_BRUIT || (TEX_BRUIT = bruitFractal(256)));

/* ---------- Motifs ---------- */

const toile = cote => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = cote;
  return cv;
};

// Le flou de toile manque à quelques navigateurs : le dessin tient sans lui.
function flouPossible(x) {
  try { x.filter = "blur(2px)"; const bon = x.filter !== "none"; x.filter = "none"; return bon; }
  catch { return false; }
}

// Le blanc du bruit prend les couleurs chaudes, son opacité est conservée.
function texMatiere(p) {
  const cote = bruit().width;
  const cv = toile(cote);
  const x = cv.getContext("2d");
  x.drawImage(bruit(), 0, 0);
  x.globalCompositeOperation = "source-in";
  const g = x.createLinearGradient(0, 0, cote, cote);
  g.addColorStop(0, `rgb(${p.matiere1.join(",")})`);
  g.addColorStop(0.45, `rgb(${p.matiere2.join(",")})`);
  g.addColorStop(1, `rgb(${p.matiere3.join(",")})`);
  x.fillStyle = g;
  x.fillRect(0, 0, cote, cote);
  return cv;
}

/* Couronne : vingt-quatre rayons fins et peu marqués. Fins et nombreux, ils
   se lisent comme un halo qui bouge ; larges et rares, ils se comptaient. */
function texCouronne(cote, p) {
  const cv = toile(cote);
  const x = cv.getContext("2d");
  const c = cote / 2, R = cote * RAYON;
  x.translate(c, c);
  if (flouPossible(x)) x.filter = "blur(3px)";
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const long = R * (1.35 + ((k * 7) % 5) * 0.19);
    const large = R * (0.055 + ((k * 3) % 4) * 0.022);
    x.save();
    x.rotate(a);
    const g = x.createLinearGradient(R * 0.96, 0, long, 0);
    g.addColorStop(0, `rgba(${p.couronne1.join(",")},.40)`);
    g.addColorStop(0.4, `rgba(${p.couronne2.join(",")},.17)`);
    g.addColorStop(1, `rgba(${p.couronne2.join(",")},0)`);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(R * 0.96, -large);
    x.quadraticCurveTo(long * 0.7, -large * 0.4, long, 0);
    x.quadraticCurveTo(long * 0.7, large * 0.4, R * 0.96, large);
    x.closePath();
    x.fill();
    x.restore();
  }
  return cv;
}

// Protubérance : une langue de feu au limbe.
function texFlamme(cote, p) {
  const cv = toile(cote);
  const x = cv.getContext("2d");
  const g = x.createRadialGradient(cote / 2, cote * 0.66, 0, cote / 2, cote * 0.66, cote * 0.46);
  g.addColorStop(0, `rgba(${p.matiere1.join(",")},.80)`);
  g.addColorStop(0.3, `rgba(${p.matiere2.join(",")},.46)`);
  g.addColorStop(0.62, `rgba(${p.matiere3.join(",")},.18)`);
  g.addColorStop(1, `rgba(${p.matiere3.join(",")},0)`);
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(cote / 2, cote * 0.58, cote * 0.26, cote * 0.42, 0, 0, Math.PI * 2);
  x.fill();
  return cv;
}

// Fond du disque : les tons sombres du feu. La matière chaude vient dessus.
function texDisque(cote, p) {
  const cv = toile(cote);
  const x = cv.getContext("2d");
  const c = cote / 2;
  const g = x.createRadialGradient(c * 0.9, c * 0.86, 0, c, c, c);
  g.addColorStop(0, `rgb(${p.corpsCoeur.join(",")})`);
  g.addColorStop(0.55, `rgb(${p.corpsBord.join(",")})`);
  g.addColorStop(1, `rgb(${sombrir(p.ombre, 0.94).join(",")})`);
  x.fillStyle = g;
  x.beginPath(); x.arc(c, c, c, 0, Math.PI * 2); x.fill();
  return cv;
}

/* Assombrissement du bord : c'est lui qui fait la sphère. Doux, sinon le
   disque prend l'air d'une bille vernie. */
function texLimbe(cote, p) {
  const cv = toile(cote);
  const x = cv.getContext("2d");
  const c = cote / 2;
  const g = x.createRadialGradient(c, c, c * 0.30, c, c, c);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.74, `rgba(${sombrir(p.ombre, 0.62).join(",")},.20)`);
  g.addColorStop(1, `rgba(${sombrir(p.ombre, 0.42).join(",")},.54)`);
  x.fillStyle = g;
  x.beginPath(); x.arc(c, c, c, 0, Math.PI * 2); x.fill();
  return cv;
}

// Cœur : la tache claire ajoutée en lumière, qui bat lentement.
function texCoeur(cote, p) {
  const cv = toile(cote);
  const x = cv.getContext("2d");
  const c = cote / 2;
  const g = x.createRadialGradient(c * 0.92, c * 0.88, 0, c, c, c * 0.9);
  g.addColorStop(0, `rgba(${p.coeur.join(",")},.52)`);
  g.addColorStop(0.42, `rgba(${p.matiere2.join(",")},.20)`);
  g.addColorStop(1, `rgba(${p.matiere3.join(",")},0)`);
  x.fillStyle = g;
  x.beginPath(); x.arc(c, c, c, 0, Math.PI * 2); x.fill();
  return cv;
}

function texAureole(cote, p) {
  const cv = toile(cote);
  const x = cv.getContext("2d");
  const c = cote / 2;
  const g = x.createRadialGradient(c, c, cote * RAYON * 0.9, c, c, c);
  g.addColorStop(0, `rgba(${p.couronne1.join(",")},.40)`);
  g.addColorStop(0.3, `rgba(${p.couronne2.join(",")},.20)`);
  g.addColorStop(0.62, `rgba(${p.couronne2.join(",")},.06)`);
  g.addColorStop(1, `rgba(${p.couronne2.join(",")},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, cote, cote);
  return cv;
}

/* Les motifs colorés se gardent par pas de teinte : les redessiner à chaque
   image coûterait plus que tout le reste réuni. Treize jeux au plus. */
const MOTIFS = new Map();
function motifs(chaud) {
  const cle = Math.round(Math.max(0, Math.min(1, chaud)) * 12);
  if (MOTIFS.has(cle)) return MOTIFS.get(cle);
  const p = palette(cle / 12);
  const m = {
    p,
    matiere: texMatiere(p),
    couronne: texCouronne(400, p),
    flamme: texFlamme(140, p),
    disque: texDisque(220, p),
    limbe: texLimbe(220, p),
    coeur: texCoeur(220, p),
    aureole: texAureole(400, p),
  };
  MOTIFS.set(cle, m);
  return m;
}

/* ---------- Dessin ---------- */

const FORCE = { matiere: 0.52, vitesse: 1.25, flammes: 4, ampleur: 0.6, battement: 0.18, coeur: 0.42 };

/* Le corps de l'astre seul : fond sombre, matière chaude ajoutée en deux
   passes contraires, cœur qui bat, limbe assombri, le tout découpé au disque.
   Il est écrit à part parce que la vignette n'a que lui à peindre, la couronne
   et les jets débordant d'une tuile de la taille d'un mot. */
function corps(x, c, R, m, t, f) {
  x.save();
  x.beginPath();
  x.arc(c, c, R, 0, Math.PI * 2);
  x.clip();
  x.drawImage(m.disque, c - R, c - R, R * 2, R * 2);

  const matiere = (sens, vit, ech, op, phase) => {
    x.save();
    x.globalCompositeOperation = "lighter";
    x.globalAlpha = op;
    x.translate(c, c);
    x.rotate(sens * t * vit * f.vitesse);
    const cote2 = R * 2 * ech;
    // Dérive lente : la matière ne fait pas que tourner, elle bouillonne.
    const dx = Math.sin(t * 0.19 * f.vitesse + phase) * R * 0.22;
    const dy = Math.cos(t * 0.15 * f.vitesse + phase) * R * 0.22;
    x.drawImage(m.matiere, -cote2 / 2 + dx, -cote2 / 2 + dy, cote2, cote2);
    x.restore();
  };
  matiere(1, 0.085, 1.30, f.matiere, 0);
  matiere(-1, 0.055, 2.10, f.matiere * 0.7, 2.1);

  // Cœur : il bat, sans jamais s'éteindre.
  x.save();
  x.globalCompositeOperation = "lighter";
  x.globalAlpha = f.coeur + f.battement * Math.sin(t * 1.9 * f.vitesse);
  x.drawImage(m.coeur, c - R, c - R, R * 2, R * 2);
  x.restore();

  x.save();
  x.globalCompositeOperation = "multiply";
  x.drawImage(m.limbe, c - R, c - R, R * 2, R * 2);
  x.restore();
  x.restore();
}

/* ---------- La vignette ----------

   Le disque seul, sans couronne ni jets, à la taille d'un mot, comme la
   vignette de la Lune est un disque peint et non un symbole. Les deux écrans
   jumeaux portent alors le même genre d'objet devant leur sous-ligne, et leurs
   textes commencent au même endroit.

   Elle ne s'anime pas et ne passe pas par la boucle : c'est une image, non une
   scène. Les motifs viennent de la même réserve que le grand disque, à la même
   teinte : la vignette ne coûte donc aucun calcul de plus.

   Aucun cerne ne la borne, à la différence de celle de la Lune : une Lune
   nouvelle n'est qu'une lueur cendrée et se perdrait sans lui, le Soleil est
   toujours vif. */
export function vignette(cv, chaud = 0) {
  if (!cv) return;
  const cote = cv.clientWidth || 22;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.max(1, Math.round(cote * dpr));
  if (cv.width !== px) { cv.width = px; cv.height = px; }

  const x = cv.getContext("2d");
  if (!x) return;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, cote, cote);

  /* Un instant fixe, celui que le mouvement réduit emploie déjà pour le grand
     disque : la vignette est une image, elle n'a pas d'horloge. */
  const teinte = Number.isFinite(chaud) ? Math.max(0, Math.min(1, chaud)) : 0;
  corps(x, cote / 2, cote * 0.47, motifs(teinte), 6.2, FORCE);
}

/* Une image. `t` est en secondes depuis le début de la boucle, `chaud` la
   teinte tirée de la hauteur du Soleil. */
export function dessiner(cv, t, chaud) {
  const cote = cv.clientWidth || 300;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(cote * dpr);
  if (!px) return;
  if (cv.width !== px) { cv.width = px; cv.height = px; }

  const x = cv.getContext("2d");
  if (!x) return;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, cote, cote);

  const c = cote / 2;
  const R = cote * RAYON;
  const m = motifs(chaud);
  const f = FORCE;

  // 1. Couronne, deux copies en sens contraires.
  x.save();
  x.globalCompositeOperation = "lighter";
  for (const [sens, vit, ech, op] of [[1, 0.10, 1, 0.62], [-1, 0.066, 1.14, 0.40]]) {
    x.save();
    x.translate(c, c);
    x.rotate(sens * t * vit * f.vitesse);
    const e = ech * (1 + 0.05 * Math.sin(t * 0.75 * f.vitesse + sens));
    x.globalAlpha = op * (0.74 + 0.26 * Math.sin(t * 1.15 * f.vitesse + sens * 2));
    x.drawImage(m.couronne, -c * e, -c * e, cote * e, cote * e);
    x.restore();
  }
  x.restore();

  // 2. Auréole, qui respire.
  x.save();
  x.globalCompositeOperation = "lighter";
  const eA = 1 + 0.09 * Math.sin(t * 0.55 * f.vitesse);
  x.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.55 * f.vitesse);
  x.drawImage(m.aureole, c - c * eA, c - c * eA, cote * eA, cote * eA);
  x.restore();

  // 3. Protubérances : elles naissent au limbe, montent et retombent.
  x.save();
  x.globalCompositeOperation = "lighter";
  for (let k = 0; k < f.flammes; k++) {
    const periode = 4.6 + k * 1.3;
    const p = (((t * f.vitesse) / periode) + k * 0.37) % 1;
    const vie = Math.sin(p * Math.PI);
    if (vie <= 0.02) continue;
    const angle = k * 1.87 + Math.sin(k * 3.1) * 0.9 + t * 0.06 * f.vitesse;
    const taille = R * (0.6 + 1.5 * vie * f.ampleur);
    x.save();
    x.translate(c, c);
    x.rotate(angle);
    x.globalAlpha = vie * 0.85;
    // Jets étroits : la largeur reste bien inférieure à la hauteur.
    x.drawImage(m.flamme, -taille * 0.34, -R - taille * 0.58, taille * 0.68, taille);
    x.restore();
  }
  x.restore();

  // 4. Le disque : fond sombre, matière chaude ajoutée, bord assombri.
  corps(x, c, R, m, t, f);

  // 5. Débordement du limbe : la matière brûle un peu au delà du bord.
  x.save();
  x.globalCompositeOperation = "lighter";
  const gb = x.createRadialGradient(c, c, R * 0.92, c, c, R * 1.28);
  gb.addColorStop(0, `rgba(${m.p.couronne1.join(",")},0)`);
  gb.addColorStop(0.22, `rgba(${m.p.couronne1.join(",")},.34)`);
  gb.addColorStop(1, `rgba(${m.p.couronne2.join(",")},0)`);
  x.globalAlpha = 0.7 + 0.3 * Math.sin(t * 1.4 * f.vitesse);
  x.fillStyle = gb;
  x.beginPath(); x.arc(c, c, R * 1.3, 0, Math.PI * 2); x.fill();
  x.restore();
}

/* ---------- Boucle ----------

   Une seule toile est animée à la fois, celle de l'écran courant. Trente
   images par seconde suffisent à une matière lente et coûtent moitié moins
   que soixante. */

const PAS = 33;

let toileActive = null;
let boucle = null;
let debut = null;
let derniere = 0;

const figee = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function image(ms) {
  if (!toileActive || !toileActive.isConnected) { arreter(); return; }
  boucle = requestAnimationFrame(image);
  if (debut === null) debut = ms;
  if (ms - derniere < PAS) return;
  derniere = ms;
  dessiner(toileActive, (ms - debut) / 1000, Number(toileActive.dataset.chaud));
}

/* Pose la toile à animer. `null` arrête la boucle : c'est ce que fait tout
   rendu d'écran avant de remplacer le contenu. */
export function poser(cv) {
  arreter();
  toileActive = cv || null;
  if (!toileActive) return;
  if (figee()) { dessiner(toileActive, 6.2, Number(toileActive.dataset.chaud)); return; }
  debut = null;
  derniere = 0;
  boucle = requestAnimationFrame(image);
}

export function arreter() {
  if (boucle !== null) { cancelAnimationFrame(boucle); boucle = null; }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) arreter();
  else if (toileActive && toileActive.isConnected && !figee()) {
    // La reprise repart de l'instant courant : le feu ne saute pas.
    debut = null;
    boucle = requestAnimationFrame(image);
  }
});
