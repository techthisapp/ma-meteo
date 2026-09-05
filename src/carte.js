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

import { contours } from "./geographie.js";

/* Les bornes de zoom. Cinq montre le pays entier sur un téléphone, dix montre
   une commune et ses alentours. Au delà, le pas de la grille des contours, cent
   cinquante mètres, se verrait. */
export const ZMIN = 5;
export const ZMAX = 10;
export const ZDEFAUT = 8;

const TUILE = 256;

/* La projection de Mercator, en coordonnées de monde entre zéro et un. C'est
   celle de toutes les tuiles matricielles, et la couche de pluie, elle, viendra
   bien en tuiles : les deux doivent se superposer sans transformation. */
export const mx = lon => (lon + 180) / 360;
export const my = lat => {
  const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
export const lonDe = x => x * 360 - 180;
export const latDe = y => 90 - (360 * Math.atan(Math.exp((y - 0.5) * 2 * Math.PI))) / Math.PI;

// L'échelle, en pixels par tour de monde.
export const echelle = z => TUILE * Math.pow(2, z);

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
  };
};

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

export function dessiner(cv, vue) {
  const ctx = cv.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const l = cv.clientWidth || 320, h = cv.clientHeight || 320;
  if (cv.width !== Math.round(l * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(l * dpr);
    cv.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = couleurs(cv);
  ctx.fillStyle = c.fond || "#eef2f6";
  ctx.fillRect(0, 0, l, h);

  const jeux = couches();
  const e = echelle(vue.z);
  const cx = mx(vue.lon), cy = my(vue.lat);
  // La fenêtre en coordonnées de monde, élargie d'un peu pour les traits épais.
  const marge = 4 / e;
  const fo = cx - (l / 2) / e - marge, fe = cx + (l / 2) / e + marge;
  const fs = cy - (h / 2) / e - marge, fn = cy + (h / 2) / e + marge;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const gros = 1 + (vue.z - ZMIN) / (ZMAX - ZMIN);

  for (const [nom, teinte, epais] of TRAITS) {
    const lignes = jeux[nom];
    if (!lignes) continue;
    ctx.strokeStyle = c[teinte] || "#8895a6";
    ctx.lineWidth = epais * gros;
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
    ctx.stroke();
  }
}

/* La vue bornée. Le zoom reste entre ses deux bornes, et le centre dans la
   fenêtre des contours : sans cela, un glissement appuyé emmène la carte au
   milieu de l'Atlantique, où il n'y a rien à voir et d'où rien ne ramène. */
export const BORNES = { o: -7, e: 13, s: 40, n: 53 };
export function borner(vue) {
  return {
    z: Math.max(ZMIN, Math.min(ZMAX, vue.z)),
    lat: Math.max(BORNES.s, Math.min(BORNES.n, vue.lat)),
    lon: Math.max(BORNES.o, Math.min(BORNES.e, vue.lon)),
  };
}

/* Le geste. Un doigt déplace, deux doigts zooment autour de leur milieu, un
   double appui zoome d'un cran sur le point touché.

   La toile ne rend pas la main au défilement : l'écran de la carte ne défile
   pas, il n'y a donc rien à lui disputer. C'est ce qui distingue ce geste de
   celui du ruban, lequel partage la page avec le reste de l'écran.

   Le tracé est appelé au plus une fois par image : un doigt qui glisse produit
   des dizaines d'évènements par seconde, et redessiner à chacun ferait le même
   travail plusieurs fois pour la même image. */
export function poser(cv, vue, surVue) {
  const points = new Map();
  let depart = null;
  let attendu = null;
  let dernierAppui = 0;

  const redessiner = () => {
    if (attendu !== null) return;
    attendu = requestAnimationFrame(() => {
      attendu = null;
      dessiner(cv, vue);
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
    /* Le double appui : deux appuis brefs au même endroit, à moins de trois
       cents millisecondes l'un de l'autre. */
    const t = Date.now();
    if (points.size === 1 && t - dernierAppui < 300) {
      const l = cv.clientWidth, h = cv.clientHeight;
      const sous = depuisEcran(vue, ev.offsetX, ev.offsetY, l, h);
      const apres = borner({ ...vue, z: vue.z + 1 });
      /* Le point touché reste sous le doigt : le centre se déplace de ce qu'il
         faut pour cela, faute de quoi zoomer sur un coin ramène au centre. */
      Object.assign(vue, recentrer(apres, sous, ev.offsetX, ev.offsetY, l, h));
      redessiner();
      dernierAppui = 0;
    } else if (points.size === 1) {
      dernierAppui = t;
    }
  });

  cv.addEventListener("pointermove", ev => {
    if (!points.has(ev.pointerId)) return;
    points.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
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
    points.delete(ev.pointerId);
    if (points.size) poserDepart(); else depart = null;
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
