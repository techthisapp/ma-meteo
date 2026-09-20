/* La couche des feux.

   Le système européen d'information sur les feux de forêt publie les foyers
   actifs relevés par les instruments VIIRS des satellites en orbite polaire.
   Le service est ouvert, sans clé, rend l'origine demandée et sert en Mercator,
   comme celui du radar et de la foudre.

   Ce qu'un foyer est, et ce qu'il n'est pas. Le satellite voit un point chaud,
   non un incendie déclaré : un brûlage agricole, une torchère industrielle ou
   une fausse détection en produisent aussi. Le nom donné à la couche et sa
   légende le disent, faute de quoi elle promettrait ce qu'elle ne sait pas.

   La fenêtre, mesurée le 20 septembre 2026 sur la tuile de la France au zoom
   cinq. Les satellites ne passent que deux fois par jour, si bien qu'un jour
   seul montre la moitié de ce qui brûle : 455 points pour le jour même, 1334
   avec la veille, 1656 avec l'avant-veille, puis moins de dix pour cent par
   jour ajouté. Deux jours sont retenus, soit quatre passages : c'est le pas où
   la couverture triple, et au delà la couche montrerait des foyers déjà
   éteints. Chaque jour coûte environ deux kilooctets par tuile.

   Le piège de cette source, à connaître avant de la croire muette : la
   dimension de temps est obligatoire et sa valeur par défaut est le
   1er janvier 2020. Une tuile demandée sans date rend une image vide, ce qui
   fait conclure à tort que le service ne sert rien. */

import { tuilesVues } from "./radar.js";

export const CARTE = "https://maps.effis.emergency.copernicus.eu/gwis";
export const COUCHE = "viirs.hs";

// Le nombre de jours posés l'un sur l'autre, du plus ancien au plus récent.
export const FENETRE = 2;

export const TAILLE = 256;
export const ZMAX_TUILE = 7;
export const CACHE_MAX = 160;

const RAYON = 6378137;
export function bornes(t) {
  const n = Math.pow(2, t.z);
  const tour = 2 * Math.PI * RAYON;
  const x0 = (t.x / n - 0.5) * tour, x1 = ((t.x + 1) / n - 0.5) * tour;
  const y0 = (0.5 - (t.y + 1) / n) * tour, y1 = (0.5 - t.y / n) * tour;
  return [x0, y0, x1, y1].map(v => v.toFixed(1)).join(",");
}

export const jourDe = t => {
  const d = new Date(t);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* Les jours de la fenêtre, du plus ancien au plus récent : le tracé les pose
   dans cet ordre et le jour même reste dessus. */
export function jours(fin = Date.now(), n = FENETRE) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) out.push(jourDe(fin - k * 86400000));
  return out;
}

export const adresse = (t, jour) =>
  `${CARTE}?service=WMS&version=1.3.0&request=GetMap&layers=${COUCHE}`
  + `&styles=&format=image/png&transparent=true&crs=EPSG:3857`
  + `&bbox=${bornes(t)}&width=${TAILLE}&height=${TAILLE}&time=${jour}`;

const cache = new Map();
export function oublier() { cache.clear(); }

export function tuile(t, jour, surPret) {
  const cle = adresse(t, jour);
  let e = cache.get(cle);
  if (e) {
    cache.delete(cle); cache.set(cle, e);
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

export const tuilesFeux = (vue, l, h) => tuilesVues(vue, l, h, ZMAX_TUILE);

/* Le tracé : chaque tuile de la vue reçoit les jours de la fenêtre, du plus
   ancien au plus récent. Une tuile absente ne peint rien. Rend le nombre de
   tuiles posées. */
export function peindre(ctx, vue, l, h, fin, surPret) {
  let posees = 0;
  ctx.imageSmoothingEnabled = true;
  const liste = jours(fin || Date.now());
  for (const t of tuilesFeux(vue, l, h)) {
    for (const j of liste) {
      const e = tuile(t, j, surPret);
      if (!e.pret) continue;
      ctx.drawImage(e.img, t.px, t.py, t.cote + 0.5, t.cote + 0.5);
      posees++;
    }
  }
  return posees;
}
