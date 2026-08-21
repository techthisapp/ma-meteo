/* Le relief lunaire de l'écran La lune.

   Une carte du disque visible est dessinée une seule fois : la Lune montre
   toujours la même face, il n'y a donc rien à faire tourner. L'éclairage, lui,
   dépend de la phase et se recalcule pixel par pixel quand elle change, ce qui
   n'arrive qu'au rendu de l'écran, jamais dans une boucle d'animation.

   La loi employée est celle de Lommel et Seeliger, mu0 sur mu0 plus mu : elle
   rend la pleine Lune plate jusqu'au bord, ce que fait la vraie Lune. Avec
   Lambert, la pleine Lune aurait l'air d'une boule de billard. */

const COTE = 320;
const RAYON = 150;

/* ---------- La carte du disque visible ---------- */

function carteLune() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = COTE;
  const x = cv.getContext("2d");
  const c = COTE / 2;

  let graine = 1969072016;
  const alea = () => (graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296;

  /* Raccourci de sphère : un accident vu près du bord se présente de biais et
     paraît écrasé dans le sens du rayon. Sans cela, le disque se lirait comme
     un carrelage plat, et la Lune comme un jeton. */
  const poser = (fx, fy, dessin) => {
    const r = Math.hypot(fx, fy);
    if (r > 0.995) return;
    const ecrase = Math.sqrt(1 - r * r);
    x.save();
    x.translate(c + fx * RAYON, c + fy * RAYON);
    x.rotate(Math.atan2(fy, fx));
    x.scale(ecrase, 1);
    dessin();
    x.restore();
  };

  // Régolithe : un gris clair, à peine chaud.
  x.beginPath(); x.arc(c, c, RAYON, 0, Math.PI * 2); x.clip();
  x.fillStyle = "#B9B4AB";
  x.fillRect(0, 0, COTE, COTE);

  /* Les mers, à leur place approximative : c'est elle qui rend la Lune
     reconnaissable. Chacune est faite de trois lobes décalés, une ellipse nette
     donnerait une tache d'encre là où les vraies mers ont des côtes. */
  const MERS = [
    [-0.28, -0.44, 0.34, 0.26],   // Imbrium
    [-0.64, -0.06, 0.30, 0.50],   // Oceanus Procellarum
    [-0.50, 0.36, 0.22, 0.22],    // Humorum
    [0.08, -0.34, 0.20, 0.18],    // Serenitatis
    [0.22, -0.04, 0.24, 0.22],    // Tranquillitatis
    [0.30, 0.24, 0.15, 0.15],     // Nectaris
    [0.64, -0.30, 0.13, 0.11],    // Crisium
    [-0.08, 0.04, 0.14, 0.12],    // Vaporum
    [-0.30, 0.14, 0.13, 0.14],    // Cognitum
    [0.02, -0.62, 0.13, 0.10],    // Frigoris
  ];
  for (const [mx, my, rx, ry] of MERS) {
    for (let lobe = 0; lobe < 3; lobe++) {
      const dx = (alea() - 0.5) * rx * 0.7;
      const dy = (alea() - 0.5) * ry * 0.7;
      const ex = rx * (0.62 + alea() * 0.42);
      const ey = ry * (0.62 + alea() * 0.42);
      poser(mx + dx, my + dy, () => {
        const R = Math.max(ex, ey) * RAYON;
        const g = x.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, "rgba(100,99,102,.72)");
        g.addColorStop(0.62, "rgba(108,107,110,.58)");
        g.addColorStop(0.88, "rgba(126,124,124,.22)");
        g.addColorStop(1, "rgba(150,148,144,0)");
        x.fillStyle = g;
        x.beginPath();
        x.ellipse(0, 0, ex * RAYON, ey * RAYON, alea() * Math.PI, 0, Math.PI * 2);
        x.fill();
      });
    }
  }

  // Grain du régolithe : des variations larges et douces, jamais un bruit fin.
  for (let k = 0; k < 220; k++) {
    const a = alea() * Math.PI * 2, r = Math.sqrt(alea()) * 0.98;
    poser(Math.cos(a) * r, Math.sin(a) * r, () => {
      const t = 6 + alea() * 30;
      const clair = alea() > 0.5;
      const g = x.createRadialGradient(0, 0, 0, 0, 0, t);
      g.addColorStop(0, clair ? "rgba(255,252,244,.09)" : "rgba(84,82,82,.09)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, t, 0, Math.PI * 2); x.fill();
    });
  }

  /* Cratères. Le creux vient du couple fond sombre et rempart clair, non d'une
     tache. À la taille où la Lune se voit, quatre-vingt-treize points, ils ne
     sont qu'une texture : seules les mers portent le dessin. */
  for (let k = 0; k < 120; k++) {
    const a = alea() * Math.PI * 2;
    const r = Math.sqrt(alea()) * 0.98;
    const grand = alea() > 0.9;
    const t = grand ? 9 + alea() * 9 : 1.4 + Math.pow(alea(), 2.4) * 7;
    const force = grand ? 0.22 + alea() * 0.20 : 0.07 + alea() * 0.15;
    poser(Math.cos(a) * r, Math.sin(a) * r, () => {
      const g = x.createRadialGradient(0, 0, t * 0.06, 0, 0, t);
      g.addColorStop(0, `rgba(94,92,92,${(force * 0.55).toFixed(3)})`);
      g.addColorStop(0.62, `rgba(118,116,116,${(force * 0.26).toFixed(3)})`);
      g.addColorStop(0.88, `rgba(226,222,214,${(force * 0.34).toFixed(3)})`);
      g.addColorStop(1, "rgba(226,222,214,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, t, 0, Math.PI * 2); x.fill();
    });
  }

  /* Traînées de Tycho, au sud : le trait le plus reconnaissable de la pleine
     Lune. Elles partent d'un point et traversent tout le disque. */
  const tx = c - 0.10 * RAYON, ty = c + 0.62 * RAYON;
  x.save();
  x.globalAlpha = 0.30;
  for (let k = 0; k < 22; k++) {
    const a = alea() * Math.PI * 2;
    const long = (0.5 + alea() * 1.6) * RAYON;
    const g = x.createLinearGradient(tx, ty, tx + Math.cos(a) * long, ty + Math.sin(a) * long);
    g.addColorStop(0, "rgba(246,243,236,.34)");
    g.addColorStop(0.3, "rgba(246,243,236,.12)");
    g.addColorStop(1, "rgba(246,243,236,0)");
    x.strokeStyle = g;
    x.lineWidth = 1.2 + alea() * 3;
    x.beginPath();
    x.moveTo(tx, ty);
    x.lineTo(tx + Math.cos(a) * long, ty + Math.sin(a) * long);
    x.stroke();
  }
  x.restore();
  poser(-0.10, 0.62, () => {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 10);
    g.addColorStop(0, "rgba(104,102,100,.65)");
    g.addColorStop(0.72, "rgba(148,146,144,.30)");
    g.addColorStop(1, "rgba(250,247,240,.62)");
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, 10, 0, Math.PI * 2); x.fill();
  });

  /* Un voile de flou fond les accidents entre eux. Sans lui la carte se lit
     comme un collage de formes nettes. Le flou de toile manque à quelques
     navigateurs : la carte tient sans lui. */
  try {
    const net = document.createElement("canvas");
    net.width = net.height = COTE;
    net.getContext("2d").drawImage(cv, 0, 0);
    const y = cv.getContext("2d");
    y.filter = "blur(1.6px)";
    if (y.filter !== "none") {
      y.clearRect(0, 0, COTE, COTE);
      y.save();
      y.beginPath(); y.arc(c, c, RAYON, 0, Math.PI * 2); y.clip();
      y.drawImage(net, 0, 0);
      y.restore();
      y.filter = "none";
    }
  } catch { /* le flou n'est pas indispensable */ }

  return cv;
}

/* La carte se calcule au premier besoin, non au chargement du module : un
   écran qui ne montre pas la Lune n'a pas à payer sa texture. */
let CARTE = null;
const carte = () => (CARTE || (CARTE = carteLune()));

/* ---------- L'éclairage ---------- */

const RAD = Math.PI / 180;

/* `angleI` est l'angle de phase en degrés, zéro à la pleine Lune et cent
   quatre-vingts à la nouvelle. `angle` est l'inclinaison du limbe éclairé,
   comptée depuis le zénith. */
function eclairer(angleI, angle, eclairee) {
  const src = carte().getContext("2d").getImageData(0, 0, COTE, COTE);
  const out = new ImageData(COTE, COTE);
  const c = COTE / 2;

  const ux = Math.sin(angle), uy = -Math.cos(angle);
  const sx = Math.sin(angleI * RAD) * ux;
  const sy = Math.sin(angleI * RAD) * uy;
  const sz = Math.cos(angleI * RAD);

  /* La part sombre n'est pas noire : la Terre l'éclaire, d'autant plus que le
     croissant est fin, la Terre étant alors presque pleine vue de la Lune. */
  const cendree = 0.020 + 0.075 * Math.pow(1 - eclairee, 1.6);

  for (let j = 0; j < COTE; j++) {
    for (let i = 0; i < COTE; i++) {
      const k = (j * COTE + i) * 4;
      const a = src.data[k + 3];
      if (!a) continue;
      const nx = (i - c) / RAYON, ny = (j - c) / RAYON;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);

      const mu0 = nx * sx + ny * sy + nz * sz;
      let e;
      if (mu0 <= 0) e = cendree;
      else {
        const l = mu0 / (mu0 + nz);
        // Adoucissement du terminateur : la ligne n'est pas un couperet.
        const bord = Math.min(1, mu0 / 0.06);
        e = cendree + (1 - cendree) * Math.min(1, l * 2) * bord;
      }
      // La part cendrée est plus froide que la part éclairée.
      const froid = mu0 <= 0 ? 1.12 : 1;
      out.data[k] = Math.min(255, src.data[k] * e);
      out.data[k + 1] = Math.min(255, src.data[k + 1] * e);
      out.data[k + 2] = Math.min(255, src.data[k + 2] * e * froid);
      out.data[k + 3] = a;
    }
  }

  const cv = document.createElement("canvas");
  cv.width = cv.height = COTE;
  cv.getContext("2d").putImageData(out, 0, 0);
  return cv;
}

/* Les disques éclairés se gardent par pas de phase et d'inclinaison : deux
   degrés de phase et cinq d'inclinaison ne se voient pas, et le calcul ne se
   refait qu'au changement réel. La réserve est bornée, un écran laissé ouvert
   une nuit ne doit pas accumuler des toiles. */
const DISQUES = new Map();
const MAX_DISQUES = 24;

function disque(angleI, angle, eclairee) {
  const pi = Math.round(angleI / 2) * 2;
  const pa = Math.round(angle / (5 * RAD)) * 5 * RAD;
  const cle = `${pi}:${pa.toFixed(3)}`;
  if (DISQUES.has(cle)) return DISQUES.get(cle);
  const t = eclairer(pi, pa, eclairee);
  if (DISQUES.size >= MAX_DISQUES) DISQUES.delete(DISQUES.keys().next().value);
  DISQUES.set(cle, t);
  return t;
}

/* ---------- Dessin ---------- */

/* La Lune ne bouillonne pas. Ce qui vit ici, c'est le halo, qui respire, la
   pâleur du jour, qui la mange, et le rougissement près de l'horizon. */
export function dessiner(cv, t) {
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
  const R = cote * 0.155;
  const angleI = Number(cv.dataset.phase);
  const angle = Number(cv.dataset.angle);
  const eclairee = Number(cv.dataset.eclairee);
  const clarte = Number(cv.dataset.clarte);
  const chaud = Number(cv.dataset.chaud);

  // 1. Halo. Il ne se voit que sur un ciel sombre, et suit la part éclairée.
  const force = (1 - clarte) * (0.25 + 0.75 * eclairee);
  if (force > 0.02) {
    const e = 1 + 0.10 * Math.sin(t * 0.5);
    const g = x.createRadialGradient(c, c, R * 0.9, c, c, R * 3.4 * e);
    g.addColorStop(0, `rgba(214,224,244,${(0.30 * force).toFixed(3)})`);
    g.addColorStop(0.28, `rgba(198,212,238,${(0.13 * force).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(180,198,232,${(0.035 * force).toFixed(3)})`);
    g.addColorStop(1, "rgba(180,198,232,0)");
    x.save();
    x.globalCompositeOperation = "lighter";
    x.globalAlpha = 0.82 + 0.18 * Math.sin(t * 0.5);
    x.fillStyle = g;
    x.fillRect(0, 0, cote, cote);
    x.restore();
  }

  // 2. Le disque peint.
  x.drawImage(disque(angleI, angle, eclairee), c - R, c - R, R * 2, R * 2);

  // 3. Basse sur l'horizon, l'atmosphère la rougit, comme le Soleil.
  if (chaud > 0.02) {
    x.save();
    x.globalCompositeOperation = "source-atop";
    x.globalAlpha = chaud * 0.42;
    x.fillStyle = "rgb(226,150,86)";
    x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.fill();
    x.restore();
  }

  // 4. De jour, le ciel la mange : elle pâlit, comme la Lune de l'après-midi.
  if (clarte > 0.02) {
    x.save();
    x.globalCompositeOperation = "destination-out";
    x.globalAlpha = clarte * 0.42;
    x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.fill();
    x.restore();
  }
}

/* ---------- Boucle ----------

   Même contrat que le module du feu : une seule toile animée à la fois, trente
   images par seconde, arrêt hors écran et sous mouvement réduit. */

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
  dessiner(toileActive, (ms - debut) / 1000);
}

export function poser(cv) {
  arreter();
  toileActive = cv || null;
  if (!toileActive) return;
  if (figee()) { dessiner(toileActive, 3.1); return; }
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
    debut = null;
    boucle = requestAnimationFrame(image);
  }
});
