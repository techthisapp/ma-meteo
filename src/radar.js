/* La couche de pluie observée.

   RainViewer publie un index des images radar du monde entier et sert leurs
   tuiles sans clé ni compte. L'index dit où sont les images et à quelle heure
   elles ont été prises ; les tuiles suivent la projection de Mercator, celle du
   fond dessiné, et se posent donc dessus sans transformation.

   Deux mesures ont décidé de la forme, faites le 5 septembre 2026 sur une vue
   de téléphone, trois cent quatre-vingt-dix points sur six cent soixante :

   1. La taille de tuile. Une vue demande douze tuiles. En deux cent cinquante-
      six points, la chronologie entière pèse de deux cents à six cent cinquante
      kilooctets selon la pluie du moment ; en cinq cent douze, de quatre cents
      kilooctets à un mégaoctet neuf. La couche est une nappe de couleur aux
      bords déjà lissés, non du texte : la densité n'y ajoute rien de lisible.
      Deux cent cinquante-six.

   2. Le nombre d'images chargées à l'ouverture. Une seule, la dernière
      observée, seize kilooctets, ce que coûte un écran de prévision. Les douze
      autres n'arrivent que si la chronologie est mise en marche : ouvrir la
      carte pour voir où il pleut ne doit pas payer une animation que personne
      n'a demandée.

   Le schéma de couleur est celui du service, et il n'y en a qu'un : les neuf
   codes documentés rendent tous la même image, à l'octet près. */

import { ZMIN, ZMAX, mx, my, echelle } from "./carte.js";

export const INDEX = "https://api.rainviewer.com/public/weather-maps.json";

// L'index se régénère toutes les dix minutes ; le garder cinq est sans risque.
export const GARDE = 5 * 60 * 1000;

export const TAILLE = 256;
export const SCHEMA = 2;
/* Lissage et neige montrée. Sans lissage, la nappe paraît en damier de pixels
   de un kilomètre, ce qui donne à une averse une précision qu'elle n'a pas. */
export const OPTIONS = "1_1";

/* Le cache de tuiles. Une vue en demande douze, une chronologie treize fois
   douze, et un déplacement en ajoute autant : sans borne le cache tiendrait
   toute la France en mémoire. Les plus anciennes partent les premières. */
export const CACHE_MAX = 260;

let vu = null;
let quand = 0;

/* L'index, gardé cinq minutes. Il rend les images observées, de la plus
   ancienne à la plus récente, puis les images extrapolées s'il y en a.

   Le service en publie parfois aucune : le champ d'extrapolation était vide aux
   deux relevés du 5 septembre. La couche ne l'invente pas et s'arrête alors à
   la dernière image observée. */
export async function charger(fetcheur = fetch) {
  const t = Date.now();
  if (vu && t - quand < GARDE) return vu;
  const r = await fetcheur(INDEX, { cache: "no-store" });
  if (!r.ok) throw new Error(`radar ${r.status}`);
  const d = await r.json();
  const hote = d.host || "";
  const rad = d.radar || {};
  const suite = [
    ...(rad.past || []).map(i => ({ ...i, futur: false })),
    ...(rad.nowcast || []).map(i => ({ ...i, futur: true })),
  ].filter(i => i && typeof i.time === "number" && i.path);
  vu = {
    hote,
    images: suite.map(i => ({ t: i.time * 1000, chemin: i.path, futur: i.futur })),
  };
  quand = t;
  return vu;
}

// Pour les contrôles : l'index gardé se jette.
export function oublier() { vu = null; quand = 0; cache.clear(); }

/* Le rang de la dernière image observée. C'est là que la chronologie s'ouvre et
   là que le bouton de retour ramène : l'observé est ce qu'on sait, l'extrapolé
   ce qu'on suppose. */
export function rangCourant(images) {
  let k = -1;
  for (let i = 0; i < images.length; i++) if (!images[i].futur) k = i;
  return k < 0 ? 0 : k;
}

/* Les tuiles que la vue recouvre. Le zoom d'une tuile est entier, celui de la
   vue ne l'est pas pendant un pincement : la tuile se pose alors à l'échelle,
   et la carte reste juste au lieu de sauter d'un cran à l'autre. */
export function tuilesVues(vue, l, h) {
  const z = Math.max(ZMIN, Math.min(ZMAX, Math.round(vue.z)));
  const n = Math.pow(2, z);
  const cote = echelle(vue.z) / n;
  const cx = mx(vue.lon) * n, cy = my(vue.lat) * n;
  const x0 = Math.floor(cx - (l / 2) / cote), x1 = Math.ceil(cx + (l / 2) / cote);
  const y0 = Math.floor(cy - (h / 2) / cote), y1 = Math.ceil(cy + (h / 2) / cote);
  const out = [];
  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1; y++) {
      if (y < 0 || y >= n) continue;
      out.push({
        z, x: ((x % n) + n) % n, y, cote,
        px: (x - cx) * cote + l / 2,
        py: (y - cy) * cote + h / 2,
      });
    }
  }
  return out;
}

export const adresse = (hote, chemin, t) =>
  `${hote}${chemin}/${TAILLE}/${t.z}/${t.x}/${t.y}/${SCHEMA}/${OPTIONS}.png`;

const cache = new Map();

/* Une tuile. Le cache rend la même image à la même adresse : une chronologie
   parcourue deux fois ne redemande rien, et un aller-retour de zoom non plus.
   Une tuile qui a échoué est retenue comme telle et n'est pas redemandée à
   chaque tracé, ce qui ferait douze requêtes par image sur un réseau coupé. */
export function tuile(hote, chemin, t, surPret) {
  const cle = adresse(hote, chemin, t);
  let e = cache.get(cle);
  if (e) {
    // Remise en tête : le cache jette les plus anciennes d'usage.
    cache.delete(cle); cache.set(cle, e);
    /* Une tuile déjà demandée mais pas encore arrivée doit prévenir ce
       second appelant aussi : sans cela, une tuile lancée par la préparation
       de la lecture n'entraîne aucun tracé quand elle arrive. */
    if (surPret && !e.pret && !e.echoue) {
      e.img.addEventListener("load", surPret, { once: true });
    }
    return e;
  }
  e = { pret: false, echoue: false, img: new Image() };
  e.img.crossOrigin = "anonymous";
  e.img.decoding = "async";
  e.img.addEventListener("load", () => { e.pret = true; if (surPret) surPret(); });
  e.img.addEventListener("error", () => { e.echoue = true; });
  e.img.src = cle;
  cache.set(cle, e);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return e;
}

/* Le tracé de la couche. Il se pose entre le fond et les traits : une frontière
   recouverte par la pluie ne dit plus de quel côté de la Manche on regarde.

   Une tuile absente laisse le fond visible plutôt qu'un rectangle vide, et le
   tracé se refait quand elle arrive. */
export function peindre(ctx, vue, l, h, hote, chemin, surPret) {
  if (!hote || !chemin) return 0;
  let posees = 0;
  ctx.imageSmoothingEnabled = true;
  for (const t of tuilesVues(vue, l, h)) {
    const e = tuile(hote, chemin, t, surPret);
    if (!e.pret) continue;
    /* Un demi-pixel de recouvrement : à l'échelle fractionnaire, deux tuiles
       voisines laissent sinon un fil de fond entre elles. */
    ctx.drawImage(e.img, t.px, t.py, t.cote + 0.5, t.cote + 0.5);
    posees++;
  }
  return posees;
}

/* Toutes les tuiles d'une image, promises. La lecture automatique attend
   celle-ci avant de montrer l'image suivante : une animation qui saute les
   images non chargées montre une pluie qui bondit au lieu d'avancer. */
export function preparer(vue, l, h, hote, chemin) {
  const attentes = tuilesVues(vue, l, h).map(t => {
    const e = tuile(hote, chemin, t);
    if (e.pret || e.echoue) return Promise.resolve();
    return new Promise(ok => {
      e.img.addEventListener("load", ok, { once: true });
      e.img.addEventListener("error", ok, { once: true });
    });
  });
  return Promise.all(attentes);
}
