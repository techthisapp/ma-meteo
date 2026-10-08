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
   fait conclure à tort que le service ne sert rien.

   La période, version 180, demande de Jérôme du 7 octobre 2026 : elle se
   choisit au curseur, de 24 heures à un an, et se demande en une plage de
   dates, `time=début/fin`, que le service accepte. Mesuré le 7 octobre 2026
   sur la tuile de la France au zoom cinq : 5,6 kilooctets pour deux jours,
   83 pour un an. Les surfaces brûlées de la même période, couche `nrt.ba`,
   se posent sous les foyers : 0,8 kilooctet pour deux jours, 10 pour un an. */

import { tuilesVues } from "./radar.js";

export const CARTE = "https://maps.effis.emergency.copernicus.eu/gwis";
export const COUCHE = "viirs.hs";
export const BRULE = "nrt.ba";

// Les pas du curseur ; sept jours au départ depuis la version 182.
export const FENETRE = 7;
export const PAS = [
  { cle: "1j", jours: 1, nom: "24 h" }, { cle: "2j", jours: 2, nom: "48 h" }, { cle: "7j", jours: 7, nom: "7 jours" },
  { cle: "30j", jours: 30, nom: "30 jours" }, { cle: "90j", jours: 90, nom: "3 mois" }, { cle: "1an", jours: 365, nom: "1 an" },
];
/* La teinte des foyers. Le service colore chaque foyer selon son âge : rouge
   sous 24 heures, orange sur la semaine, bleu sur le mois, vert au delà.
   Relevé sur sa légende le 8 octobre 2026. Sur une période longue, la carte
   se couvrait de vert, couleur qui ne dit pas le feu : les foyers sont
   repeints d'une seule teinte, celle de la légende. Les surfaces brûlées,
   rouges et orange chez le service, se confondaient alors avec eux : elles
   passent au bordeaux. Sur trois mois et un an, les foyers couvrent presque
   toute la France ; ils s'éclaircissent pour laisser voir le fond et les
   surfaces. */
export const TEINTE = "#e8442a";
export const TEINTE_BRULE = "#8e1b3a";
export const opaciteFoyers = n => (n > 30 ? 0.5 : n > 7 ? 0.75 : 1);
export const pasDe = cle => PAS.find(p => p.cle === cle) || PAS[1];

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

/* La plage de la période : du premier jour au jour même, bornes comprises. */
export const plage = (fin = Date.now(), n = FENETRE) => `${jourDe(fin - (n - 1) * 86400000)}/${jourDe(fin)}`;

export const adresse = (t, temps, couche = COUCHE) =>
  `${CARTE}?service=WMS&version=1.3.0&request=GetMap&layers=${couche}`
  + `&styles=&format=image/png&transparent=true&crs=EPSG:3857`
  + `&bbox=${bornes(t)}&width=${TAILLE}&height=${TAILLE}&time=${temps}`;

const cache = new Map();
export function oublier() { cache.clear(); }

export function tuile(t, temps, surPret, couche = COUCHE) {
  const cle = adresse(t, temps, couche);
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
  e.img.addEventListener("load", () => {
    e.peinte = teindre(e.img, couche === COUCHE ? TEINTE : TEINTE_BRULE);
    e.pret = true;
    if (surPret) surPret();
  });
  e.img.addEventListener("error", () => { e.echoue = true; });
  e.img.src = cle;
  cache.set(cle, e);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return e;
}

/* Une image repeinte d'une seule teinte, la transparence gardée. */
export function teindre(img, teinte = TEINTE) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || TAILLE;
  c.height = img.naturalHeight || TAILLE;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = teinte;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

export const tuilesFeux = (vue, l, h) => tuilesVues(vue, l, h, ZMAX_TUILE);

/* Le tracé : chaque tuile de la vue reçoit les surfaces brûlées puis les
   foyers de la période. Une tuile absente ne peint rien. Rend le nombre de
   tuiles posées. */
export function peindre(ctx, vue, l, h, fin, surPret, n = FENETRE) {
  let posees = 0;
  ctx.imageSmoothingEnabled = true;
  const temps = plage(fin || Date.now(), n);
  for (const t of tuilesFeux(vue, l, h)) {
    for (const couche of [BRULE, COUCHE]) {
      const e = tuile(t, temps, surPret, couche);
      if (!e.pret) continue;
      ctx.globalAlpha = couche === COUCHE ? opaciteFoyers(n) : 1;
      ctx.drawImage(e.peinte || e.img, t.px, t.py, t.cote + 0.5, t.cote + 0.5);
      ctx.globalAlpha = 1;
      posees++;
    }
  }
  return posees;
}
