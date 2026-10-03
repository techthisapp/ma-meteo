/* La carte.

   Un fond dessiné, pas de tuiles. La décision tient à une mesure faite le
   5 septembre 2026 sur la Géoplateforme de l'IGN : une tuile de plan pèse de 42
   à 70 kilooctets, et une vue de téléphone en demande une douzaine, soit de six
   cents kilooctets à un mégaoctet par écran et autant à chaque déplacement.
   Toute la prévision horaire de l'application en pèse cinq. Les contours
   embarqués coûtent trente-trois kilooctets une fois pour toutes, se dessinent
   hors ligne, suivent les deux thèmes, et n'imposent aucune mention en
   surimpression permanente.

   Ce que le fond montre est ce qu'une carte de pluie demande : la côte, les
   frontières, les limites de départements, et les lieux qu'on suit. Les routes
   et les noms de rue n'apprennent rien d'une averse.

   Le tracé se refait à la demande, non trente fois par seconde : une carte ne
   bouge que sous le doigt. C'est ce qui la distingue des trois autres toiles du
   dépôt, le feu, le relief et le temps, qui animent une matière. */

import { contours, anneauxDe, codesDepartements } from "./geographie.js";
import * as Fond from "./fond.js";
import { isolignes as NappeIso } from "./nappe.js";

/* La projection vit dans src/projection.js, que la pluie dans l'heure charge
   dès le lancement ; elle est réexportée ici pour les modules de la carte. */
import { ZMIN, ZMAX, ZDEFAUT, TUILE, mx, my, lonDe, latDe, echelle } from "./projection.js";
export { ZMIN, ZMAX, ZDEFAUT, mx, my, lonDe, latDe, echelle };

/* La place d'un point sur l'écran, en pixels depuis le coin haut gauche. La vue
   porte son centre et son zoom ; la toile porte sa largeur et sa hauteur. */
export function surEcran(vue, lat, lon, l, h) {
  const e = echelle(vue.z);
  return {
    x: (mx(lon) - mx(vue.lon)) * e + l / 2,
    y: (my(lat) - my(vue.lat)) * e + h / 2,
  };
}

// Le chemin inverse : un point de l'écran vers un point du globe.
export function depuisEcran(vue, x, y, l, h) {
  const e = echelle(vue.z);
  return {
    lat: latDe(my(vue.lat) + (y - h / 2) / e),
    lon: lonDe(mx(vue.lon) + (x - l / 2) / e),
  };
}

/* La boîte de chaque ligne, calculée une fois. Une ligne hors du cadre ne se
   dessine pas : au zoom le plus fort, la fenêtre porte deux départements sur
   quatre-vingt-seize, et parcourir les dix mille points de tout le pays à
   chaque geste serait le seul calcul lourd du tracé. */
let boites = null;
function couches() {
  const c = contours();
  if (!boites) {
    boites = {};
    for (const [nom, lignes] of Object.entries(c)) {
      boites[nom] = lignes.map(l => {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (let i = 0; i < l.length; i += 2) {
          if (l[i] < x0) x0 = l[i];
          if (l[i] > x1) x1 = l[i];
          if (l[i + 1] < y0) y0 = l[i + 1];
          if (l[i + 1] > y1) y1 = l[i + 1];
        }
        return [x0, y0, x1, y1];
      });
    }
  }
  return c;
}

/* Les couleurs viennent de la feuille de style, non du module : le thème sombre
   et le thème clair ne se décident pas ici, et une couleur écrite dans le code
   échapperait au thème comme elle échapperait au contrôle de contraste. */
const couleurs = cv => {
  const s = getComputedStyle(cv);
  const v = n => s.getPropertyValue(n).trim();
  return {
    fond: v("--ca-fond"), contour: v("--ca-contour"),
    departements: v("--ca-dep"), etranger: v("--ca-etranger"),
    vg2: v("--ca-vg2"), vg3: v("--ca-vg3"), vg4: v("--ca-vg4"),
    /* Les couleurs vives des niveaux, celles des symboles du panneau de
       vigilance : le liseré est un trait, il prend la couleur du trait. */
    vt2: v("--v2"), vt3: v("--v3"), vt4: v("--v4"),
    /* Les restrictions d'eau, jalon 18 : une palette à elles, du sable pâle au
       violet sombre, pour ne pas se lire comme une vigilance météo. */
    ve1: v("--ca-ve1"), ve2: v("--ca-ve2"), ve3: v("--ca-ve3"), ve4: v("--ca-ve4"),
    /* Le fond enrichi, jalon 19. */
    riviere: v("--ca-riviere"), ville: v("--ca-ville"), villePoint: v("--ca-ville-point"),
  };
};

/* Ce que le tracé des noms doit savoir de l'écran qui porte la carte : les
   places déjà prises par les étiquettes du document, les noms de villes que
   d'autres étiquettes portent, et à qui rendre la liste des noms posés. */
const reglages = new WeakMap();
/* Ce que le dernier tracé a montré du fond, pour les contrôles. */
export const dernierFond = { relief: true, rivieres: true };
export const reglerFond = (cv, o) => reglages.set(cv, o);

/* Les trois traits, du plus fort au plus faible. Le contour du pays porte la
   côte et la frontière, les départements portent une limite administrative,
   l'étranger n'est qu'un repère : trois rôles, trois épaisseurs. Elles
   s'épaississent un peu avec le zoom, sans quoi la carte de près paraîtrait
   plus maigre que la carte de loin. */
const TRAITS = [
  ["terre", "etranger", 0.8],
  ["bornes", "etranger", 0.7],
  ["departements", "departements", 0.7],
  ["contour", "contour", 1.1],
];

/* Le tracé. Des couches se glissent entre le fond et les traits : c'est la place
   de la vigilance et de la pluie, qui couvrent le fond sans couvrir les
   frontières. Elles se peignent dans l'ordre reçu. Le module de la carte ne sait
   pas ce qu'il peint là, et les couches ne savent rien du fond. */
export function dessiner(cv, vue, nappes) {
  const ctx = cv.getContext("2d");
  /* Densité plafonnée à 2, comme les toiles du ciel : à 3, une carte plein écran
     d'iPhone pesait 2,5 millions de pixels par toile au lieu de 1,1. Audit du
     1er octobre 2026, constat 5.7. */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const l = cv.clientWidth || 320, h = cv.clientHeight || 320;
  if (cv.width !== Math.round(l * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(l * dpr);
    cv.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = couleurs(cv);
  ctx.fillStyle = c.fond || "#eef2f6";
  ctx.fillRect(0, 0, l, h);
  /* Le fond adaptatif, version 154, demande de Jérôme du 3 octobre 2026 : le
     relief et les cours d'eau ne paraissent qu'avec les couches qui en
     parlent. L'écran qui porte la carte le dit ; sans lui, tout paraît. */
  const o = reglages.get(cv);
  const montre = o?.fond ? o.fond() : { relief: true, rivieres: true };
  dernierFond.relief = montre.relief; dernierFond.rivieres = montre.rivieres;
  /* Le relief, sous tout le reste : les nappes le laissent paraître. */
  const force = parseFloat(getComputedStyle(cv).getPropertyValue("--ca-relief"));
  if (montre.relief) Fond.peindreRelief(ctx, vue, l, h, Number.isFinite(force) ? force : 1);

  /* Chaque couche rend ce qu'elle a posé. Zéro partout veut dire fond nu, et les
     traits se suffisent alors à eux-mêmes.

     Une couche dit aussi si elle veut la gaine des traits, sous la forme
     `{ peindre, gaine: false }`. Une couche pâle et tachetée comme la pluie la
     demande, une nappe de couleur continue la refuse : un liseré clair le long
     des quatre-vingt-seize limites ferait lire une mosaïque de départements là
     où la donnée est continue et ignore les départements. */
  let posees = 0, gainees = 0;
  for (const n of [].concat(nappes || [])) {
    const f = typeof n === "function" ? n : n && n.peindre;
    if (typeof f !== "function") continue;
    const k = f(ctx, vue, l, h) || 0;
    posees += k;
    if (typeof n === "function" || n.gaine !== false) gainees += k;
  }

  const jeux = couches();
  const e = echelle(vue.z);
  const cx = mx(vue.lon), cy = my(vue.lat);
  // La fenêtre en coordonnées de monde, élargie d'un peu pour les traits épais.
  const marge = 4 / e;
  const fo = cx - (l / 2) / e - marge, fe = cx + (l / 2) / e + marge;
  const fs = cy - (h / 2) / e - marge, fn = cy + (h / 2) / e + marge;

  /* Les cours d'eau, au-dessus des nappes et sous les limites. */
  if (montre.rivieres) Fond.peindreRivieres(ctx, vue, l, h, c.riviere || "#5b9bd5");

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const gros = 1 + (vue.z - ZMIN) / (ZMAX - ZMIN);

  for (const [nom, teinte, epais] of TRAITS) {
    const lignes = jeux[nom];
    if (!lignes) continue;
    ctx.beginPath();
    lignes.forEach((ligne, k) => {
      const [x0, y0, x1, y1] = boites[nom][k];
      // La boîte est en degrés, la fenêtre en coordonnées de monde : la
      // comparaison se fait sur les degrés, moins chers à convertir une fois.
      if (mx(x1) < fo || mx(x0) > fe || my(y0) < fs || my(y1) > fn) return;
      for (let i = 0; i < ligne.length; i += 2) {
        const px = (mx(ligne[i]) - cx) * e + l / 2;
        const py = (my(ligne[i + 1]) - cy) * e + h / 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    });
    /* La gaine. Les couleurs de trait sont réglées sur le fond de la carte ; une
       couche posée dessus peut être de n'importe quelle teinte, et une limite de
       département gris clair disparaît sous une averse jaune. Un trait plus
       large de la couleur du fond, glissé sous le trait, rend le contraste quel
       que soit ce qu'il y a dessous. Il ne se paie que quand la couche est là,
       et le chemin ne se construit qu'une fois pour les deux passes.

       Elle se déclenche dès qu'une couche a posé quelque chose, donc sur toute
       la carte, alors que la pluie ne couvre que 19 % de la vue au zoom cinq :
       quatre limites sur cinq étaient gainées sans rien avoir à traverser, et
       la carte paraissait quadrillée de blanc dès qu'il pleuvait quelque part.
       La gaine est passée le 19 septembre 2026 de trois points de large à 1,4
       et de neuf dixièmes d'opacité à cinq. Assombrir le trait au lieu de le
       gainer a été essayé et écarté : les limites devenaient plus visibles que
       la pluie.

       Ces deux valeurs ne sont tenues par aucune garde, et il faut le savoir
       avant d'y toucher. La garde « un trait posé sur la couche garde son écart
       de clarté » mesure l'écart entre le trait et son entourage ; cet écart
       vient du trait lui-même, non de sa gaine, et la garde passe encore avec
       une gaine réduite à deux dixièmes de point et huit centièmes d'opacité.
       Comparées en image, la gaine réduite et l'absence complète de gaine se
       distinguent à peine : elle est gardée comme filet pour le cas d'une
       averse très claire sous un trait clair, non parce qu'elle serait
       nécessaire. */
    if (gainees) {
      ctx.strokeStyle = c.fond || "#eef2f6";
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = epais * gros + 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = c[teinte] || "#8895a6";
    ctx.lineWidth = epais * gros;
    ctx.stroke();
  }

  /* Les noms des villes et des cours d'eau, au-dessus de tout le tracé. */
  const poses = Fond.peindreNoms(ctx, vue, l, h,
    { halo: c.fond || "#eef2f6", ville: c.ville || "#3c4654", point: c.villePoint || "#5d6875",
      riviere: c.riviere || "#5b9bd5", rivieres: montre.rivieres },
    o?.pris ? o.pris(l, h) : [], o?.taire ? o.taire() : new Set());
  if (o?.noms) o.noms(poses);
}

/* La vue bornée. Le zoom reste entre ses deux bornes, et le centre dans la
   fenêtre des contours : sans cela, un glissement appuyé emmène la carte au
   milieu de l'Atlantique, où il n'y a rien à voir et d'où rien ne ramène. */
export const BORNES = { o: -7, e: 13, s: 40, n: 53 };

/* La France métropolitaine, Corse comprise. Ces bornes servent au cadrage
   d'ouverture de la carte. */
export const FRANCE = { o: -5.15, e: 9.56, s: 41.33, n: 51.09 };

export function borner(vue) {
  return {
    z: Math.max(ZMIN, Math.min(ZMAX, vue.z)),
    lat: Math.max(BORNES.s, Math.min(BORNES.n, vue.lat)),
    lon: Math.max(BORNES.o, Math.min(BORNES.e, vue.lon)),
  };
}

/* Le remplissage des départements.

   Les anneaux viennent de la même topologie que les traits : la teinte épouse
   donc exactement le trait, sans décalage à fort zoom.

   `teintes` associe un code de département à un rang de niveau. Un département
   absent de la table reste au fond nu : le vert n'est pas une vigilance, et
   teinter tout le pays en vert ferait du bruit sans rien apprendre. */
export function peindreDepartements(cv, ctx, vue, l, h, teintes, style = {}) {
  if (!teintes || !teintes.size) return 0;
  const c = couleurs(cv);
  const e = echelle(vue.z);
  const cx = mx(vue.lon), cy = my(vue.lat);
  let posees = 0;
  for (const [code, rang] of teintes) {
    const teinte = c[`${style.palette || (style.trait ? "vt" : "vg")}${rang}`];
    if (!teinte) continue;
    const anneaux = anneauxDe(code);
    if (!anneaux) continue;
    ctx.fillStyle = teinte;
    ctx.strokeStyle = teinte;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (const a of anneaux) {
      const n = a.length / 2;
      for (let i = 0; i < n; i++) {
        const px = (mx(a[i * 2]) - cx) * e + l / 2;
        const py = (my(a[i * 2 + 1]) - cy) * e + h / 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    /* Deux façons de dire la même alerte. Le remplissage quand la carte laisse
       voir son fond, le liseré quand une nappe pleine le couvre : une teinte
       posée sous une nappe opaque ne se verrait pas, et une teinte posée dessus
       fausserait la couleur qu'on y lit. */
    if (style.trait) ctx.stroke(); else ctx.fill();
    posees++;
  }
  return posees;
}

/* La nappe de valeurs.

   La grille source est régulière en degrés, la carte est en Mercator : une
   simple mise à l'échelle décalerait la nappe du fond de plusieurs kilomètres au
   nord du pays. La trame intermédiaire est donc échantillonnée en Mercator, une
   ligne tous les quelques pixels de monde, et le navigateur fait le reste de
   l'étalement en agrandissant l'image.

   Peindre point par point sur toute la toile coûterait deux cent mille couleurs
   composées à chaque tracé, et le tracé se refait à chaque glissement. La trame
   en coûte mille deux cent quatre-vingts.

   `teinte` rend le nombre de degrés de roue d'une valeur, ou `null` : la rampe
   vit dans `icones.js`, où le ruban et la table de la semaine la prennent déjà. */
const TRAME = 64;
let tramePot = null;

export function peindreNappe(ctx, vue, l, h, couche, style = {}) {
  if (!couche) return 0;
  const { S, N, O, E, cols, valeurA, teinte } = couche;
  /* La saturation et la clarté sont un nombre pour la plupart des nappes, une
     fonction de la valeur pour celle de l'indice ultraviolet, dont la rampe
     monte en intensité avec l'indice. */
  const sat = style.sat ?? 0.54, clarte = style.clarte ?? 0.47;
  const satDe = typeof sat === "function" ? sat : () => sat;
  const clarteDe = typeof clarte === "function" ? clarte : () => clarte;
  if (!tramePot) tramePot = document.createElement("canvas");
  if (tramePot.width !== cols || tramePot.height !== TRAME) {
    tramePot.width = cols;
    tramePot.height = TRAME;
  }
  const tc = tramePot.getContext("2d");
  const img = tc.createImageData(cols, TRAME);
  const yS = my(S), yN = my(N);
  let vus = 0;
  for (let k = 0; k < TRAME; k++) {
    /* La ligne k porte la latitude dont l'ordonnée de Mercator tombe à sa
       hauteur : c'est ce qui aligne la nappe sur le fond. */
    const lat = latDe(yN + ((yS - yN) * k) / (TRAME - 1));
    for (let c = 0; c < cols; c++) {
      const v = valeurA(lat, O + ((E - O) * c) / (cols - 1));
      const t = v === null ? null : teinte(v);
      const p = (k * cols + c) * 4;
      if (t === null) { img.data[p + 3] = 0; continue; }
      const [r, g, b] = deTeinte(t, satDe(v), clarteDe(v));
      img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255;
      vus++;
    }
  }
  if (!vus) return 0;
  tc.putImageData(img, 0, 0);
  const e = echelle(vue.z);
  const cx = mx(vue.lon), cy = my(vue.lat);
  const x0 = (mx(O) - cx) * e + l / 2, x1 = (mx(E) - cx) * e + l / 2;
  const y0 = (yN - cy) * e + h / 2, y1 = (yS - cy) * e + h / 2;
  ctx.save();
  /* La nappe de la mer, jalon 19, lot 5b, se découpe à l'inverse : tout sauf
     la France, par la règle pair-impair sur le cadre et les départements. */
  const mer = style.mer === true;
  /* La nappe s'arrête au pays. Son emprise est un rectangle, et un rectangle de
     couleur posé sur la mer et sur les pays voisins donnerait un bord droit là
     où il n'y a pas de frontière. Le chemin de découpe est celui des anneaux des
     départements, ceux-là mêmes qui portent la teinte de la vigilance. */
  ctx.beginPath();
  if (mer) ctx.rect(-10, -10, l + 20, h + 20);
  for (const code of codesDepartements()) {
    for (const a of anneauxDe(code)) {
      const n = a.length / 2;
      for (let i = 0; i < n; i++) {
        const px = (mx(a[i * 2]) - cx) * e + l / 2;
        const py = (my(a[i * 2 + 1]) - cy) * e + h / 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  /* La pluie prévue, lot 5c, ne s'arrête pas au pays : le radar non plus. */
  if (style.libre) ctx.beginPath(), ctx.rect(-10, -10, l + 20, h + 20);
  ctx.clip(mer ? "evenodd" : "nonzero");
  ctx.globalAlpha = style.opacite ?? 0.55;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tramePot, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
  return 1;
}

/* Les isolignes d'une nappe, jalon 19, lot 5 : un trait par niveau, et le
   niveau écrit une fois, au plus près du centre de la vue. `niveaux` est une
   liste, ou se tire d'un pas et d'une base dans les bornes du champ. Rend le
   nombre de traits posés. */
export const derniersTraits = { n: 0, niveaux: [] };
export function peindreIsolignes(ctx, vue, l, h, champ, regle, style = {}) {
  if (!champ) return 0;
  let niveaux = regle.niveaux;
  if (!niveaux) {
    let mn = Infinity, mxv = -Infinity;
    for (const x of champ) if (Number.isFinite(x)) { if (x < mn) mn = x; if (x > mxv) mxv = x; }
    niveaux = [];
    if (mn <= mxv) {
      for (let v = regle.base + Math.ceil((mn - regle.base) / regle.pas) * regle.pas; v <= mxv; v += regle.pas) niveaux.push(v);
    }
  }
  const e = echelle(vue.z), cx = mx(vue.lon), cy = my(vue.lat);
  const X = lon => (mx(lon) - cx) * e + l / 2, Y = lat => (my(lat) - cy) * e + h / 2;
  let n = 0;
  const poses = [];
  ctx.save();
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const niv of niveaux) {
    const segs = NappeIso(champ, niv);
    if (!segs.length) continue;
    ctx.beginPath();
    let mieux = null;
    for (const [la0, lo0, la1, lo1] of segs) {
      const x0 = X(lo0), y0 = Y(la0), x1 = X(lo1), y1 = Y(la1);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (xm < 30 || xm > l - 30 || ym < 20 || ym > h - 20) continue;
      const d = Math.hypot(xm - l / 2, ym - h / 2);
      if (!mieux || d < mieux.d) mieux = { d, x: xm, y: ym };
    }
    ctx.strokeStyle = style.halo || "#fff"; ctx.globalAlpha = 0.6; ctx.lineWidth = (style.epais || 1.2) + 2;
    ctx.stroke();
    ctx.strokeStyle = style.trait || "#334"; ctx.globalAlpha = 1; ctx.lineWidth = style.epais || 1.2;
    ctx.stroke();
    if (mieux) poses.push({ ...mieux, t: `${Math.round(niv)}${style.unite || ""}` });
    n++;
  }
  ctx.font = "600 11px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const p of poses) {
    ctx.strokeStyle = style.halo || "#fff"; ctx.lineWidth = 3; ctx.strokeText(p.t, p.x, p.y);
    ctx.fillStyle = style.trait || "#334"; ctx.fillText(p.t, p.x, p.y);
  }
  ctx.restore();
  derniersTraits.n = n; derniersTraits.niveaux = niveaux;
  return n;
}

/* Une teinte de roue en composantes, à saturation et clarté données : celles de
   la rampe écrite, que la nappe partage avec le ruban. */
function deTeinte(t, sat, clarte) {
  const k = n => (n + t / 30) % 12;
  const a = sat * Math.min(clarte, 1 - clarte);
  const f = n => clarte - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/* La vue qui fait tenir des bornes dans un cadre, avec une marge.

   Le zoom se calcule au lieu d'être écrit en dur. Un téléphone en portrait, le
   même en paysage et une tablette n'ont pas le même rapport de côtés : un zoom
   fixe couperait la Bretagne sur l'un et laisserait du vide sur l'autre. */
export function vueSur(b, l, h, marge = 0.06) {
  const x0 = mx(b.o), x1 = mx(b.e);
  const y0 = my(b.n), y1 = my(b.s);
  const dx = Math.max(1e-9, x1 - x0), dy = Math.max(1e-9, y1 - y0);
  const e = Math.min(l / dx, h / dy) * (1 - marge);
  return borner({
    z: Math.log2(Math.max(1, e) / TUILE),
    lat: latDe((y0 + y1) / 2),
    lon: lonDe((x0 + x1) / 2),
  });
}

/* Le geste. Un doigt déplace, deux doigts zooment autour de leur milieu, un
   double appui zoome d'un cran sur le point touché. Depuis le 3 octobre 2026,
   demande de Jérôme, le geste de Plans d'Apple s'y ajoute : un double appui
   dont le second doigt reste posé puis glisse zoome d'un seul doigt, vers le
   bas pour grossir, vers le haut pour réduire, autour du point touché.

   La toile ne rend pas la main au défilement : l'écran de la carte ne défile
   pas, il n'y a donc rien à lui disputer. C'est ce qui distingue ce geste de
   celui du ruban, lequel partage la page avec le reste de l'écran.

   Le tracé est appelé au plus une fois par image : un doigt qui glisse produit
   des dizaines d'évènements par seconde, et redessiner à chacun ferait le même
   travail plusieurs fois pour la même image. */
export function poser(cv, vue, surVue, nappes, { surAppui } = {}) {
  const points = new Map();
  let depart = null;
  let attendu = null;
  let dernierAppui = 0;
  /* Le zoom d'un doigt : le second appui d'un double appui, tant qu'il est
     posé. `bouge` dit s'il a glissé ; sans glissement, le lâcher fait le
     cran de zoom du double appui ordinaire. */
  let zoomDoigt = null;
  const PX_PAR_CRAN = 90;
  /* L'appui long, version 154 : un doigt posé une demi-seconde sans bouger
     ouvre la bulle du point. Le toucher bref du lot 4 l'ouvrait au moindre
     geste qui commençait un déplacement ou un pincement, relevé par Jérôme
     le 3 octobre 2026. Un second doigt, un glissement de plus de six points
     ou un doigt levé avant le délai annulent l'appui. */
  const DELAI_APPUI = 500, TOLERANCE_APPUI = 6;
  let appui = null;
  const annulerAppui = () => { if (appui) clearTimeout(appui.minuteur); appui = null; };

  const redessiner = () => {
    if (attendu !== null) return;
    attendu = requestAnimationFrame(() => {
      attendu = null;
      dessiner(cv, vue, nappes);
      if (surVue) surVue(vue);
    });
  };

  const milieu = () => {
    const l = [...points.values()];
    if (l.length < 2) return null;
    return {
      x: (l[0].x + l[1].x) / 2, y: (l[0].y + l[1].y) / 2,
      d: Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y),
    };
  };

  const poserDepart = () => {
    const l = cv.clientWidth, h = cv.clientHeight;
    const m = milieu();
    const un = [...points.values()][0];
    depart = {
      vue: { ...vue },
      x: m ? m.x : un.x, y: m ? m.y : un.y,
      d: m ? m.d : 0,
      /* Le point du globe sous le doigt au départ : c'est lui qui reste sous le
         doigt pendant tout le geste, déplacement comme pincement. Sans cette
         ancre, la carte glisse sous les doigts au lieu de les suivre. */
      ancre: depuisEcran(vue, m ? m.x : un.x, m ? m.y : un.y, l, h),
    };
  };

  cv.addEventListener("pointerdown", ev => {
    cv.setPointerCapture(ev.pointerId);
    points.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
    poserDepart();
    annulerAppui();
    if (points.size === 1 && surAppui) {
      const a = { x: ev.offsetX, y: ev.offsetY };
      a.minuteur = setTimeout(() => {
        if (appui !== a) return;
        appui = null;
        /* Le geste en cours s'arrête : le doigt qui reste posé ne déplace
           pas la carte sous la bulle. */
        depart = null;
        surAppui(a.x, a.y);
      }, DELAI_APPUI);
      appui = a;
    }
    /* Le double appui : deux appuis brefs au même endroit, à moins de trois
       cents millisecondes l'un de l'autre. */
    const t = Date.now();
    if (points.size === 1 && t - dernierAppui < 300) {
      const l = cv.clientWidth, h = cv.clientHeight;
      annulerAppui();
      depart = null;
      zoomDoigt = { x: ev.offsetX, y: ev.offsetY, z: vue.z, vue: { ...vue }, bouge: false,
        sous: depuisEcran(vue, ev.offsetX, ev.offsetY, l, h) };
      dernierAppui = 0;
    } else if (points.size === 1) {
      dernierAppui = t;
    }
  });

  cv.addEventListener("pointermove", ev => {
    if (!points.has(ev.pointerId)) return;
    points.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
    if (appui && (points.size > 1 || Math.hypot(ev.offsetX - appui.x, ev.offsetY - appui.y) > TOLERANCE_APPUI)) annulerAppui();
    if (zoomDoigt && points.size === 1) {
      const dy = ev.offsetY - zoomDoigt.y;
      if (!zoomDoigt.bouge && Math.abs(dy) <= TOLERANCE_APPUI) return;
      zoomDoigt.bouge = true;
      const l = cv.clientWidth, h = cv.clientHeight;
      const apres = borner({ ...zoomDoigt.vue, z: zoomDoigt.z + dy / PX_PAR_CRAN });
      Object.assign(vue, recentrer(apres, zoomDoigt.sous, zoomDoigt.x, zoomDoigt.y, l, h));
      redessiner();
      return;
    }
    if (zoomDoigt) zoomDoigt = null;
    if (!depart) return;
    const l = cv.clientWidth, h = cv.clientHeight;
    const m = milieu();
    let z = depart.vue.z;
    let x = ev.offsetX, y = ev.offsetY;
    if (m) {
      x = m.x; y = m.y;
      if (depart.d > 8) z = depart.vue.z + Math.log2(m.d / depart.d);
    }
    const bornee = borner({ ...depart.vue, z });
    Object.assign(vue, recentrer(bornee, depart.ancre, x, y, l, h));
    redessiner();
  });

  const relacher = ev => {
    /* Le second appui levé sans avoir glissé : le cran du double appui. Le
       point touché reste sous le doigt : le centre se déplace de ce qu'il
       faut pour cela, faute de quoi zoomer sur un coin ramène au centre. */
    if (zoomDoigt && ev.type === "pointerup" && !zoomDoigt.bouge) {
      const l = cv.clientWidth, h = cv.clientHeight;
      const apres = borner({ ...vue, z: vue.z + 1 });
      Object.assign(vue, recentrer(apres, zoomDoigt.sous, zoomDoigt.x, zoomDoigt.y, l, h));
      redessiner();
    }
    zoomDoigt = null;
    points.delete(ev.pointerId);
    if (points.size) poserDepart(); else depart = null;
    annulerAppui();
  };
  cv.addEventListener("pointerup", relacher);
  cv.addEventListener("pointercancel", relacher);

  return { redessiner };
}

/* Une vue déplacée pour qu'un point du globe tombe sur un point de l'écran.
   C'est l'opération commune au pincement et au double appui : on connaît le
   point qu'on veut garder sous le doigt et l'endroit où le doigt se trouve. */
export function recentrer(vue, point, x, y, l, h) {
  const e = echelle(vue.z);
  return borner({
    z: vue.z,
    lon: lonDe(mx(point.lon) - (x - l / 2) / e),
    lat: latDe(my(point.lat) - (y - h / 2) / e),
  });
}

/* La distance qu'un pixel couvre au sol, en mètres, au centre de la vue. Elle
   sert à l'échelle écrite sous la carte : une carte sans échelle ne dit pas si
   l'averse est à dix kilomètres ou à cent. */
export const metresParPixel = vue =>
  (40075016.686 * Math.cos(vue.lat * Math.PI / 180)) / echelle(vue.z);

/* Les longueurs rondes d'une barre d'échelle. La barre prend la plus grande qui
   tient dans le quart de la largeur : un nombre rond se lit, une longueur
   quelconque ne se lit pas. */
export const RONDS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
export function echelleBarre(vue, large) {
  const mpp = metresParPixel(vue);
  const max = (large / 4) * mpp;
  let km = RONDS[0];
  for (const r of RONDS) if (r * 1000 <= max) km = r;
  return { km, px: (km * 1000) / mpp };
}
