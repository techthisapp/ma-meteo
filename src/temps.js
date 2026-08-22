/* Le temps qu'il fait, peint sur une toile.

   Le ciel de l'accueil porte la prévision plutôt qu'un décor : la couverture
   nuageuse donne les nuages, le code de temps sensible donne la précipitation
   et le brouillard, la lame d'eau donne l'intensité, le vent donne la dérive.

   Deux familles de nuages, parce que ce sont deux objets et non deux réglages
   du même. Les cumulus sont des masses isolées qui passent devant le ciel. La
   nappe est une couche continue vue par en dessous, dont seule la base se voit.
   Un ciel couvert n'est pas un ciel qui aurait beaucoup de cumulus.

   La toile se pose devant celle de l'astre : un nuage passe devant le Soleil,
   non derrière. Elle suit le même contrat que `feu.js` et `relief.js`, une
   toile animée à la fois, trente images par seconde, arrêt hors écran. */

const melangeRVB = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
const rgba = (v, a) => `rgba(${v[0]},${v[1]},${v[2]},${a})`;
const borne = (v, a, b) => Math.max(a, Math.min(b, v));

const NOIR = [14, 18, 26];
const NUIT_CLAIR = [66, 77, 100];
const NUIT_SOMBRE = [29, 34, 48];

/* ---------- De la prévision aux grandeurs du dessin ---------- */

const NEIGE = [71, 73, 75, 77, 85, 86];
const AVERSE = [80, 81, 82];
const ORAGE = [95, 96, 99];

/* La couverture nuageuse manque à la charge de secours, qui ne porte que le
   code. Chaque code en implique une, faute de quoi une pluie tomberait d'un
   ciel vide. */
function couvertureDe(code) {
  if (code === 0) return 5;
  if (code === 1 || code === 2) return 42;
  if (code === 3) return 95;
  if (code === 45 || code === 48) return 85;
  if (ORAGE.includes(code)) return 96;
  if (AVERSE.includes(code)) return 72;
  if (NEIGE.includes(code)) return 88;
  if (code >= 51 && code <= 67) return 92;
  return 60;
}

/* La couverture décide seule de la forme du ciel. La nappe prend le relais des
   cumulus passé les deux tiers : au-delà, les masses isolées se rejoignent en
   couche, et celles qui subsistent passent dessous. */
export function depuis(code, nua, mm) {
  const n = borne((nua ?? couvertureDe(code)) / 100, 0, 1);
  const brouillard = code === 45 || code === 48 ? 0.85 : 0;
  const neige = NEIGE.includes(code);
  const orage = ORAGE.includes(code);
  const mouille = orage || neige || AVERSE.includes(code) || (code >= 51 && code <= 67);

  /* Sous une couche fermée il ne reste aucune masse isolée : le plafond est
     continu, et ce qui subsistait se lisait comme un ballon suspendu devant
     lui. Les cumulus s'éteignent donc exactement là où la nappe se ferme. */
  const nappe = borne((n - 0.62) / 0.30, 0, 1);
  const cumulus = Math.min(1, n * 1.15) * (1 - nappe);
  /* Le code annonce la pluie pour l'heure en cours, la lame peut y valoir zéro :
     un ciel de pluie sans une goutte se lirait comme un défaut. */
  const lame = mouille ? borne((mm ?? 0) * 1.6, 1.2, 10) : 0;

  return {
    cumulus, nappe, lame, brouillard, orage,
    genre: mouille ? (neige ? "neige" : "pluie") : "",
  };
}

/* Ce que la couche cache de l'astre. Sous une nappe fermée le Soleil ne se voit
   plus du tout : le laisser pâle suspendrait un disque au travers du plafond.
   Au-delà de ce seuil, la vue ne dessine plus l'astre et seule reste la lueur
   peinte dans la couche. */
export const SEUIL_VOILE = 0.8;
export const voileDe = p => Math.min(0.96, p.nappe * 0.92 + p.brouillard * 0.78);

/* Écrit les grandeurs sur la toile. La toile porte tout ce qu'il faut pour se
   peindre : la boucle n'a pas d'état à retenir entre deux rendus d'écran. */
export function attributs(p, ciel, vent, astre) {
  const a = {
    "data-cumulus": p.cumulus.toFixed(3),
    "data-nappe": p.nappe.toFixed(3),
    "data-lame": p.lame.toFixed(2),
    "data-genre": p.genre,
    "data-brouillard": p.brouillard.toFixed(2),
    "data-orage": p.orage ? "1" : "",
    "data-vent": Math.round(vent),
    "data-bas": ciel.basRVB.join(","),
    "data-haut": ciel.hautRVB.join(","),
    "data-nuit": ciel.nuit.toFixed(3),
    "data-chaud": ciel.chaud.toFixed(3),
    "data-astre": astre ? astre.sorte : "",
    "data-ax": astre ? astre.x.toFixed(4) : "",
    "data-ay": astre ? astre.y.toFixed(4) : "",
  };
  return Object.entries(a).map(([c, v]) => `${c}="${v}"`).join(" ");
}

function lire(cv) {
  const d = cv.dataset;
  const rvb = s => (s || "0,0,0").split(",").map(Number);
  return {
    cumulus: Number(d.cumulus) || 0,
    nappe: Number(d.nappe) || 0,
    lame: Number(d.lame) || 0,
    genre: d.genre || "",
    brouillard: Number(d.brouillard) || 0,
    orage: d.orage === "1",
    vent: Number(d.vent) || 0,
    ciel: {
      basRVB: rvb(d.bas), hautRVB: rvb(d.haut),
      nuit: Number(d.nuit) || 0, chaud: Number(d.chaud) || 0,
    },
    astre: d.astre ? { sorte: d.astre, x: Number(d.ax), y: Number(d.ay) } : null,
  };
}

/* ---------- Couleurs ---------- */

/* Un nuage n'a pas de couleur propre : il prend celle du ciel, plus clair
   dessus, plus sombre dessous, d'autant plus gris que le ciel se couvre et
   d'autant plus plombé que la lame d'eau est forte. */
function couleurs(ciel, couv, sombreur) {
  const blanc = [255, 255, 255];
  const n = ciel.nuit;
  let clair = melangeRVB(ciel.basRVB, blanc, Math.max(0, 0.88 - 0.28 * couv));
  let sombre = melangeRVB(ciel.hautRVB, blanc, Math.max(0, 0.16 - 0.10 * couv));

  /* De nuit le nuage ne prend plus sa couleur du ciel : il reste plus clair que
     lui, éclairé par en dessous. Sans ce renversement, une nuit couverte ne
     serait qu'un rectangle noir. */
  if (n > 0) {
    clair = melangeRVB(clair, NUIT_CLAIR, n);
    sombre = melangeRVB(sombre, NUIT_SOMBRE, n);
  }

  /* Au ras de l'horizon la lumière est rousse, et c'est le dessous des nuages
     qu'elle prend en premier : un nuage blanc froid sur un ciel de couchant se
     lit comme un décalque. */
  if (ciel.chaud > 0 && n < 1) {
    clair = melangeRVB(clair, [255, 198, 146], ciel.chaud * 0.34 * (1 - n));
    sombre = melangeRVB(sombre, [196, 132, 116], ciel.chaud * 0.40 * (1 - n));
  }

  // La nuit a déjà tout assombri : la lame d'eau n'y ajoute presque rien.
  const s = sombreur * (1 - 0.72 * n);
  if (s > 0) {
    clair = melangeRVB(clair, NOIR, s * 0.72);
    sombre = melangeRVB(sombre, NOIR, s * 0.78);
  }

  // Ce qui reste de lumière : les crêtes ne brillent que s'il y en a.
  return { clair, sombre, lumiere: (1 - 0.82 * s) * (1 - 0.5 * n) };
}

/* Le ciel d'un lieu réduit à deux couleurs, tel qu'il paraîtrait en fond
   d'accueil. Sans couche, le ciel reste le ciel, à peine grisé par les cumulus.
   Sous une couche fermée, c'est la couche qu'on voit, sombre au zénith et claire
   vers l'horizon : c'est elle qui donne les deux couleurs. Un ciel couvert n'est
   pas un ciel bleu avec un nuage dessus. */
export function fond(ciel, p) {
  const couv = Math.max(p.cumulus, p.nappe);
  /* Le plomb est de moitié : sur une bande de soixante points il n'y a ni base
     claire ni horizon pour le compenser, et un ciel de pluie y virait au noir. */
  const sombreur = Math.min(1, p.nappe * 0.92 + p.lame / 28) * (1 - 0.85 * p.brouillard) * 0.5;
  const c = couleurs(ciel, couv, sombreur);
  const k = p.nappe;
  const rvb = v => `rgb(${v[0]},${v[1]},${v[2]})`;
  /* Le mélange est plus clair que dans le bandeau : sur une bande de soixante
     points, le sommet sombre d'une couche occupe la moitié de la hauteur, là où
     il n'en occupe qu'un tiers sur trois cents. Repris tel quel, un ciel couvert
     y virait au noir. */
  return {
    haut: rvb(melangeRVB(melangeRVB(ciel.hautRVB, c.sombre, 0.22 * (1 - k)),
      melangeRVB(c.clair, c.sombre, 0.60), k)),
    bas: rvb(melangeRVB(melangeRVB(ciel.basRVB, c.clair, 0.30 * (1 - k)),
      melangeRVB(c.clair, c.sombre, 0.06), k)),
  };
}

/* ---------- Silhouettes ---------- */

// Le flou de toile manque à quelques navigateurs : le dessin tient sans lui.
function flouPossible(x) {
  try { x.filter = "blur(2px)"; const bon = x.filter !== "none"; x.filter = "none"; return bon; }
  catch { return false; }
}

/* Un nuage est une masse, pas un tas de bulbes. Les formes pleines s'unissent
   donc sans se compter, un flou adoucit le pourtour, une seconde passe
   resserrée raffermit l'intérieur, et la couleur vient à la fin d'un seul tenant
   sur la silhouette obtenue. Superposer des dégradés translucides rendrait
   chaque bulbe visible et saturerait toute la vignette. */
function masse(L, H, tracer, modeler, flou, haut, bas, y0, y1, deborde) {
  const D = deborde || 0;
  const mq = document.createElement("canvas");
  mq.width = L + D * 2; mq.height = H;
  const q = mq.getContext("2d");
  q.translate(D, 0);
  q.fillStyle = "#FFFFFF";
  tracer(q);

  /* Le flou se pose sur le masque entier, débord compris, et la découpe vient
     après, sans filtre. Un `drawImage` filtré découpe sa source avant de la
     flouter : le débord ne servait alors à rien, le bord de la couche était
     flouté contre du vide, et son raccord sautait de six points à chaque
     répétition, une couture verticale en plein ciel. */
  const fl = document.createElement("canvas");
  fl.width = mq.width; fl.height = H;
  const fx = fl.getContext("2d");
  const ok = flouPossible(fx);
  if (ok) fx.filter = `blur(${flou}px)`;
  fx.drawImage(mq, 0, 0);
  if (ok) {
    fx.filter = `blur(${(flou * 0.45).toFixed(2)}px)`;
    fx.globalCompositeOperation = "lighter";
    fx.globalAlpha = 0.9;
    fx.drawImage(mq, 0, 0);
    fx.filter = "none";
    fx.globalAlpha = 1;
  }

  const cv = document.createElement("canvas");
  cv.width = L; cv.height = H;
  const x = cv.getContext("2d");
  x.drawImage(fl, D, 0, L, H, 0, 0, L, H);

  x.globalCompositeOperation = "source-in";
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(haut, 1));
  g.addColorStop(0.46, rgba(melangeRVB(haut, bas, 0.14), 1));
  g.addColorStop(0.72, rgba(melangeRVB(haut, bas, 0.44), 1));
  g.addColorStop(0.92, rgba(melangeRVB(haut, bas, 0.86), 1));
  g.addColorStop(1, rgba(bas, 1));
  x.fillStyle = g;
  x.fillRect(0, 0, L, H);

  /* L'union efface les bords intérieurs : la masse serait un ballon. Le modelé
     les rend, un ventre sombre et une crête claire par bourgeon, en dégradés qui
     s'éteignent avant leur bord et découpés sur la silhouette, de sorte
     qu'aucun contour de bulbe ne ressorte. */
  if (modeler) {
    x.globalCompositeOperation = "source-atop";
    modeler(x);
  }
  return cv;
}

/* La masse doit tenir dans sa vignette, marge comprise : le flou serait tranché
   au bord. Elle est donc ramenée à l'échelle et posée sur la ligne basse,
   quelles que soient les formes tirées. */
function ajuster(formes, L, H, marge) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of formes) {
    x0 = Math.min(x0, s[0] - s[2]); x1 = Math.max(x1, s[0] + s[2]);
    y0 = Math.min(y0, s[1] - s[3]); y1 = Math.max(y1, s[1] + s[3]);
  }
  const k = Math.min(1, (L - 2 * marge) / (x1 - x0), (H - 2 * marge) / (y1 - y0));
  const dx = L / 2 - ((x0 + x1) / 2) * k;
  const dy = (H - marge) - y1 * k;
  return { haut: y0 * k + dy,
    formes: formes.map(s => [s[0] * k + dx, s[1] * k + dy, s[2] * k, s[3] * k]) };
}

/* Huit cumulus et une nappe, dessinés une fois par teinte. Les motifs coûteux
   se gardent : chaque image ne fait que composer des images prêtes. */
const MOTIFS = new Map();
const MARGE = 16;

function motifs(cle, c) {
  if (MOTIFS.has(cle)) return MOTIFS.get(cle);
  let graine = 20260821;
  const alea = () => (graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296;

  const cumulus = [];
  for (let k = 0; k < 8; k++) {
    const L = 360, H = 240;
    // Étalé et plat, ou étroit et bourgeonnant : la variété tient à cela.
    const etale = alea();
    const etendue = L * (0.46 + etale * 0.40);
    const relief = 0.24 + (1 - etale) * 0.36;
    const assise = H * 0.80;
    const formes = [];

    const bulbes = 5 + Math.floor(alea() * 5);
    for (let b = 0; b < bulbes; b++) {
      const p = b / (bulbes - 1);
      const bx = L * 0.5 + (p - 0.5) * etendue + (alea() - 0.5) * L * 0.05;
      const haut = Math.pow(Math.sin(p * Math.PI), 0.5) * (0.45 + alea() * 0.55);
      const r = H * (0.11 + haut * relief);
      /* Chaque bourgeon repose sur la ligne de base, il ne la traverse pas :
         c'est ce qui donne au cumulus son dessous plat. La ligne ondule
         légèrement, une droite d'un bord à l'autre se verrait. */
      const base = assise + (alea() - 0.5) * H * 0.045;
      formes.push([bx, base - r * 0.97, r * (0.9 + alea() * 0.25), r]);
    }
    // Les nuages étroits bourgeonnent : un second étage les fait monter.
    if (etale < 0.5) {
      const combien = 1 + Math.floor(alea() * 3);
      for (let b = 0; b < combien; b++) {
        const r = H * (0.08 + alea() * 0.10);
        formes.push([L * 0.5 + (alea() - 0.5) * etendue * 0.6,
          assise - H * (0.30 + alea() * 0.22) - r * 0.3, r, r]);
      }
    }
    // Le plancher : quatre galettes qui comblent les creux entre bourgeons.
    for (let b = 0; b < 4; b++) {
      const ry = H * (0.045 + alea() * 0.03);
      formes.push([L * 0.5 + (alea() - 0.5) * etendue * 0.62,
        assise - ry * 0.94, etendue * (0.16 + alea() * 0.13), ry]);
    }

    const a = ajuster(formes, L, H, MARGE);
    const tetes = a.formes.slice(0, bulbes);
    cumulus.push(masse(L, H, q => {
      for (const [fx, fy, rx, ry] of a.formes) {
        q.beginPath(); q.ellipse(fx, fy, rx, ry, 0, 0, Math.PI * 2); q.fill();
      }
    }, x => {
      /* Chaque bourgeon est modelé dans son propre repère : le dégradé est tracé
         en cercle puis aplati à la forme du bourgeon. */
      const lobe = (fx, fy, rx, ry, dy, r, arrets) => {
        x.save();
        x.translate(fx, fy + ry * dy); x.scale(1, ry / rx); x.translate(-fx, -(fy + ry * dy));
        const g = x.createRadialGradient(fx, fy + ry * dy, 0, fx, fy + ry * dy, rx * r);
        for (const [p, coul] of arrets) g.addColorStop(p, coul);
        x.fillStyle = g;
        x.beginPath(); x.arc(fx, fy + ry * dy, rx * r, 0, Math.PI * 2); x.fill();
        x.restore();
      };
      for (const [fx, fy, rx, ry] of tetes) {
        lobe(fx, fy, rx, ry, 0.34, 1.15, [
          [0, rgba(c.sombre, 0.46)], [0.46, rgba(c.sombre, 0.24)],
          [0.78, rgba(c.sombre, 0.07)], [1, rgba(c.sombre, 0)]]);
        const cl = c.lumiere;
        lobe(fx, fy, rx, ry, -0.52, 1.30, [
          [0, `rgba(255,255,255,${(0.32 * cl).toFixed(3)})`],
          [0.44, `rgba(255,255,255,${(0.16 * cl).toFixed(3)})`],
          [1, "rgba(255,255,255,0)"]]);
      }
      // L'ombre portée sous la masse : elle assied la base sur sa ligne.
      const bas = H - MARGE;
      const ob = x.createLinearGradient(0, bas - H * 0.17, 0, bas);
      ob.addColorStop(0, rgba(c.sombre, 0));
      ob.addColorStop(1, rgba(c.sombre, 0.34));
      x.fillStyle = ob;
      x.fillRect(0, bas - H * 0.17, L, H * 0.17);
    }, 6, c.clair, c.sombre, a.haut, H - MARGE));
  }

  /* La nappe. Sa base ondule sur trois périodes et s'alourdit de lobes ; les
     trois périodes se referment sur la largeur, la couche défile donc sans
     couture. Le masque déborde de part et d'autre pour que le flou ne laisse pas
     une couture claire au raccord. */
  const NL = 720, NH = 300, ND = 72;
  /* Cinq périodes d'amplitude décroissante, qui se referment toutes sur la
     largeur. Une couche vue par en dessous n'a pas d'arches : son bord est une
     ligne irrégulière et molle. Dix lobes ronds posés dessus en faisaient une
     frise de cercles, que l'œil comptait un à un. */
  const base = u => NH * 0.72
    + Math.sin(u * Math.PI * 2 + 0.4) * NH * 0.050
    + Math.sin(u * Math.PI * 6 + 1.1) * NH * 0.030
    + Math.sin(u * Math.PI * 10 + 2.2) * NH * 0.020
    + Math.sin(u * Math.PI * 18 + 0.7) * NH * 0.012
    + Math.sin(u * Math.PI * 30 + 3.4) * NH * 0.006;

  /* Les lobes ne bombent plus le bord, ils l'épaississent. Larges, plats,
     nombreux et chevauchants, ils se fondent en une lisière irrégulière.

     Leur hauteur varie autant que leur largeur : posés tous à la même profondeur
     sous la base, vingt-deux lobes alignaient leur crête et rendaient au ciel la
     ligne droite qu'on venait de lui retirer. */
  const lobes = [];
  for (let b = 0; b < 22; b++) {
    const u = (b + 0.5) / 22 + (alea() - 0.5) * 0.045;
    const rx = NH * (0.09 + alea() * 0.12);
    const ry = rx * (0.24 + alea() * 0.16);
    lobes.push([u, rx, ry, (alea() - 0.35) * rx * 0.45]);
  }

  /* Quelques taches larges et molles dans le corps de la couche. Un plafond
     n'est pas une teinte plate : il est marbré, sans arêtes. */
  const taches = [];
  for (let b = 0; b < 6; b++) {
    taches.push([alea(), NH * (0.16 + alea() * 0.24), NH * (0.20 + alea() * 0.30)]);
  }

  const nappe = masse(NL, NH, q => {
    q.beginPath();
    q.moveTo(-ND - 4, -60); q.lineTo(NL + ND + 4, -60);
    for (let i = NL + ND + 4; i >= -ND - 4; i -= 4) q.lineTo(i, base(((i / NL) % 1 + 1) % 1));
    q.closePath(); q.fill();
    for (const [u, rx, ry, dy] of lobes) {
      for (const t of [-1, 0, 1]) {
        const bx = (u + t) * NL;
        if (bx < -ND - rx || bx > NL + ND + rx) continue;
        q.beginPath();
        q.ellipse(bx, base(u) - ry * 0.55 + dy, rx, ry, 0, 0, Math.PI * 2);
        q.fill();
      }
    }
  }, x => {
    /* Les lobes se creusent par dessous : c'est ce qui donne son épaisseur à la
       couche, qui autrement se lirait comme un simple bandeau. Le modelé suit
       leur forme aplatie, et reste léger : ils sont deux fois plus nombreux
       qu'avant et se superposent. */
    const ombre = (cx, cy, rx, ry, a0, a1) => {
      x.save();
      x.translate(cx, cy);
      x.scale(1, Math.max(0.14, ry / rx));
      const g = x.createRadialGradient(0, 0, 0, 0, 0, rx * 1.15);
      g.addColorStop(0, rgba(c.sombre, a0));
      g.addColorStop(0.55, rgba(c.sombre, a1));
      g.addColorStop(1, rgba(c.sombre, 0));
      x.fillStyle = g;
      x.fillRect(-rx * 1.2, -rx * 1.2, rx * 2.4, rx * 2.4);
      x.restore();
    };

    for (const [u, rx, ry, dy] of lobes) {
      for (const t of [-1, 0, 1]) {
        const bx = (u + t) * NL, by = base(u) - ry * 0.55 + dy;
        if (bx < -rx * 2 || bx > NL + rx * 2) continue;
        ombre(bx, by + ry * 0.5, rx, ry, 0.26, 0.13);
      }
    }

    // Le marbré du plafond, très large et très faible.
    for (const [u, rx, ry] of taches) {
      for (const t of [-1, 0, 1]) {
        const bx = (u + t) * NL;
        if (bx < -rx * 2 || bx > NL + rx * 2) continue;
        ombre(bx, NH * (0.30 + u * 0.28), rx, ry, 0.10, 0.05);
      }
    }

    // Le ventre de la couche s'assombrit vers son bord.
    const g = x.createLinearGradient(0, NH * 0.40, 0, NH * 0.90);
    g.addColorStop(0, rgba(c.sombre, 0));
    g.addColorStop(1, rgba(c.sombre, 0.30));
    x.fillStyle = g;
    x.fillRect(0, NH * 0.40, NL, NH * 0.50);

    /* Le bord bas se dilue. Une couche n'a pas de découpe nette par en dessous,
       et de nuit, où elle est plus claire que le ciel, une découpe nette
       dessinait tout le contour au trait. */
    x.save();
    x.globalCompositeOperation = "destination-out";
    const f = x.createLinearGradient(0, NH * 0.60, 0, NH * 0.93);
    f.addColorStop(0, "rgba(0,0,0,0)");
    f.addColorStop(1, "rgba(0,0,0,0.45)");
    x.fillStyle = f;
    x.fillRect(0, NH * 0.60, NL, NH * 0.33);
    x.restore();
  }, 9, melangeRVB(c.clair, c.sombre, 0.86), melangeRVB(c.clair, c.sombre, 0.28),
    0, NH * 0.78, ND);

  const out = { cumulus, nappe };
  if (MOTIFS.size > 6) MOTIFS.delete(MOTIFS.keys().next().value);
  MOTIFS.set(cle, out);
  return out;
}

/* ---------- Le dessin ---------- */

/* Trois plans. Le plus proche est grand, opaque et rapide, le plus lointain
   petit, pâle et lent : c'est la parallaxe qui donne la profondeur. */
const PLANS = [
  { y: 0.47, ech: 0.47, vit: 1.00, alpha: 0.97, n: 4 },
  { y: 0.31, ech: 0.31, vit: 0.58, alpha: 0.86, n: 6 },
  { y: 0.17, ech: 0.20, vit: 0.32, alpha: 0.64, n: 8 },
];

// Suite déterministe : le même ciel à chaque rendu.
const bruit = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

const GOUTTES = [];
for (let k = 0; k < 300; k++) {
  GOUTTES.push({ x: bruit(k + 1), y: bruit(k + 91), v: 0.7 + bruit(k + 181) * 0.6,
    l: 0.5 + bruit(k + 271) * 0.9, p: bruit(k + 361) * Math.PI * 2 });
}

export function dessiner(cv, t) {
  const L = cv.clientWidth, H = cv.clientHeight;
  if (!L || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(L * dpr)) {
    cv.width = Math.round(L * dpr); cv.height = Math.round(H * dpr);
  }
  const x = cv.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, L, H);

  const d = lire(cv);
  const ciel = d.ciel;
  const couv = Math.max(d.cumulus, d.nappe);
  /* Le plomb vient de la couche et de la lame d'eau. Le brouillard l'annule :
     une brume est laiteuse, elle éclaire au lieu d'assombrir. */
  const sombreur = Math.min(1, d.nappe * 0.92 + d.lame / 28) * (1 - 0.85 * d.brouillard);
  const c = couleurs(ciel, couv, sombreur);
  const cle = `${Math.round(couv * 8)}:${Math.round(sombreur * 8)}:`
    + `${Math.round(ciel.nuit * 6)}:${Math.round(ciel.chaud * 6)}`;
  const m = motifs(cle, c);

  /* Le vent donne la dérive : cent kilomètres par heure traversent le ciel en
     une vingtaine de secondes, ce qui se voit sans agiter. */
  const derive = 6 + d.vent * 1.9;

  const posePlan = p => {
    const plan = PLANS[p];
    /* Jamais une seule masse sur un plan : isolée au milieu du ciel, elle se
       lit comme un objet posé là plutôt que comme un nuage qui passe. Un plan
       porte donc deux masses au moins, ou aucune. */
    const brut = plan.n * d.cumulus;
    const combien = brut < 0.6 ? 0 : Math.max(2, Math.round(brut));
    if (!combien) return;
    const large = L * 0.9 * plan.ech;
    const pas = (L + large * 1.3) / combien;
    x.save();
    x.globalAlpha = plan.alpha;
    for (let k = 0; k < combien; k++) {
      /* Chaque masse a sa taille propre : sans quoi le ciel se lirait comme une
         frise du même motif répété. */
      const ech = large * (0.72 + bruit(p * 17 + k + 41) * 0.56);
      const dep = k * pas + bruit(p * 31 + k + 7) * pas * 0.6;
      const xx = ((dep + t * derive * plan.vit) % (L + ech)) - ech;
      const yy = H * plan.y - ech * 0.28 + (bruit(p * 53 + k + 3) - 0.5) * H * 0.14;
      const sp = m.cumulus[(p * 3 + k) % m.cumulus.length];
      x.drawImage(sp, xx, yy, ech, ech * (sp.height / sp.width));
    }
    x.restore();
  };

  posePlan(2);
  posePlan(1);

  /* La nappe passe devant les plans lointains et derrière le plan proche : les
     lambeaux bas courent sous la couche, c'est ce qui la situe en hauteur. */
  if (d.nappe > 0) {
    const np = m.nappe;
    const haut = H * 0.98;
    const larg = haut * (np.width / np.height);
    const yy = -H * 0.06;
    const dx = ((t * derive * 0.34) % larg) - larg;
    x.save();
    x.globalAlpha = d.nappe;
    for (let i = 0; i < 3; i++) x.drawImage(np, dx + larg * i, yy, larg, haut);
    x.restore();
  }

  /* La lumière de l'astre traversant la couche. Sous une couche fermée on ne
     voit plus le Soleil, on voit l'endroit où il est. */
  const voile = voileDe(d);
  if (d.astre && voile > 0.2) {
    const ax = d.astre.x * L, ay = d.astre.y * H;
    const nuit = d.astre.sorte === "lune";
    const r = Math.max(L, H) * (0.42 + 0.34 * voile);
    const teinte = nuit
      ? [206, 220, 244]
      : melangeRVB([255, 250, 232], [255, 214, 158], ciel.chaud);
    const force = (nuit ? 0.13 : 0.22) * voile * (1 - 0.42 * sombreur);
    const g = x.createRadialGradient(ax, ay, 0, ax, ay, r);
    g.addColorStop(0, rgba(teinte, force));
    g.addColorStop(0.42, rgba(teinte, force * 0.40));
    g.addColorStop(1, rgba(teinte, 0));
    x.save();
    x.globalCompositeOperation = "lighter";
    x.fillStyle = g;
    x.fillRect(0, 0, L, H);
    x.restore();
  }

  posePlan(0);

  // Brouillard : deux bandes molles qui passent, et un voile d'ensemble.
  if (d.brouillard) {
    const v = d.brouillard;
    for (const [vit, haut] of [[0.35, 0.62], [0.2, 0.80]]) {
      const g = x.createLinearGradient(0, H * haut - H * 0.24, 0, H * haut + H * 0.24);
      g.addColorStop(0, rgba(c.clair, 0));
      g.addColorStop(0.5, rgba(c.clair, 0.5 * v));
      g.addColorStop(1, rgba(c.clair, 0));
      x.save();
      x.translate(((t * derive * vit) % (L * 2)) - L, 0);
      x.fillStyle = g;
      x.fillRect(0, 0, L * 2, H);
      x.restore();
    }
    const gv = x.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0, rgba(c.clair, 0.16 * v));
    gv.addColorStop(1, rgba(c.clair, 0.40 * v));
    x.fillStyle = gv;
    x.fillRect(0, 0, L, H);
  }

  /* Précipitation sur deux plans : un tiers des traits tombe devant, plus long,
     plus vif et plus rapide. Tous naissent au bas de la couche. */
  if (d.lame > 0 && d.genre) {
    const n = Math.min(GOUTTES.length, Math.round(46 + d.lame * 24));
    const pente = borne(d.vent / 95, -0.5, 0.5);
    x.save();
    if (d.genre === "pluie") {
      x.strokeStyle = rgba(melangeRVB(c.clair, [216, 234, 250], 0.7), 1);
      x.lineCap = "round";
      for (let k = 0; k < n; k++) {
        const g = GOUTTES[k];
        const proche = k % 3 === 0;
        const chute = ((g.y + t * g.v * (proche ? 0.80 : 0.52)) % 1.3) - 0.16;
        const px = ((((g.x + chute * pente * 0.7) % 1) + 1) % 1) * L;
        const py = chute * H;
        const lg = H * (proche ? 0.046 : 0.026) * g.l;
        x.globalAlpha = (proche ? 0.50 : 0.28) * borne(py / (H * 0.16) + 0.15, 0, 1);
        x.lineWidth = proche ? 1.4 : 0.9;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + lg * pente, py + lg); x.stroke();
      }
    } else {
      x.fillStyle = "rgb(246,250,255)";
      for (let k = 0; k < n; k++) {
        const g = GOUTTES[k];
        const proche = k % 3 === 0;
        const chute = ((g.y + t * g.v * (proche ? 0.19 : 0.12)) % 1.25) - 0.14;
        const oscille = Math.sin(t * (proche ? 0.8 : 0.5) + g.p) * (proche ? 0.045 : 0.028);
        const px = ((((g.x + oscille + chute * pente * 0.5) % 1) + 1) % 1) * L;
        const py = chute * H;
        x.globalAlpha = (proche ? 0.86 : 0.46) * borne(py / (H * 0.16) + 0.15, 0, 1);
        x.beginPath();
        x.arc(px, py, (proche ? 1.5 : 0.8) + g.l * (proche ? 1.1 : 0.5), 0, Math.PI * 2);
        x.fill();
      }
    }
    x.restore();
  }

  /* Éclair : bref, rare, et redoublé une fois, comme le sont les vrais. Il
     éclaire la couche plus que le bas du ciel. */
  if (d.orage) {
    const phase = t % 7.5;
    let force = 0;
    if (phase < 0.24) force = phase < 0.07 ? phase / 0.07 : 1 - (phase - 0.07) / 0.17;
    else if (phase > 0.38 && phase < 0.52) force = 0.55 * (1 - Math.abs(phase - 0.45) / 0.07);
    if (force > 0) {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(228,240,255,${(0.44 * force).toFixed(3)})`);
      g.addColorStop(0.62, `rgba(226,238,255,${(0.30 * force).toFixed(3)})`);
      g.addColorStop(1, "rgba(226,238,255,0)");
      x.save();
      x.globalCompositeOperation = "lighter";
      x.fillStyle = g;
      x.fillRect(0, 0, L, H);
      x.restore();
    }
  }
}

/* ---------- Boucle ----------

   Même contrat que le feu et le relief : une seule toile animée à la fois,
   trente images par seconde, arrêt dès que la toile quitte le document ou que
   l'onglet passe en arrière-plan. */

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

/* Pose la toile à animer. `null` arrête la boucle : c'est ce que fait tout
   rendu d'écran avant de remplacer le contenu. */
export function poser(cv) {
  arreter();
  toileActive = cv || null;
  if (!toileActive) return;
  if (figee()) { dessiner(toileActive, 4.2); return; }
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
