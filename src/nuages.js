/* La couche de nuages, vue du satellite.

   EUMETSAT sert sur EUMETView l'imagerie du Meteosat de troisième génération.
   Quatre couches ont été mesurées le 13 puis le 18 septembre 2026, sur une
   tuile de la France au zoom cinq :

   | Couche                  | Poids   | Jour  | Nuit  |
   |-------------------------|---------|-------|-------|
   | Infrarouge 10,5         |  32 ko  | oui   | oui   |
   | Visible 0,6             |  64 ko  | oui   | non   |
   | Couleurs vraies         | 146 ko  | oui   | non   |
   | Type de nuage           | 156 ko  | oui   | non   |

   L'infrarouge est retenu : c'est le seul qui voie la nuit, et le plus léger.
   Mesuré à deux heures du matin, le visible rend une image noire, luminance
   moyenne de 1,5 sur 255 et écart type de 0,5 ; l'infrarouge garde à la même
   heure une luminance de 71 et un écart type de 33. Les deux couches lourdes
   sont hors de portée pour une application qui charge quelques tuiles par vue.

   La tuile arrive opaque : le service ne rend aucun pixel transparent, quel que
   soit le style demandé, et poser l'image telle quelle couvrirait la carte
   entière. La transparence est donc calculée ici, à l'arrivée de chaque tuile,
   à partir de la luminance : en infrarouge, le sommet d'un nuage est froid donc
   clair, le sol est chaud donc sombre. Le ciel dégagé s'efface et le nuage
   reste. Coût mesuré : une milliseconde par tuile, payée une fois à l'arrivée
   et non à chaque tracé, six millisecondes pour une vue de téléphone.

   Le seuil et la plage viennent d'un essai sur la France : au-dessous de
   soixante-dix de luminance il ne reste rien de lisible, au-dessus de
   cent quatre-vingt-dix le nuage est plein. Ils sont exposés pour être repris
   si une saison donne une image trop pleine ou trop vide.

   La lecture des pixels exige que le service rende l'origine, ce qu'il fait ;
   c'est la même contrainte que le radar, dont le déplacement se mesure de la
   même façon. */

import { tuilesVues } from "./radar.js";

export const CAPACITES = "https://view.eumetsat.int/geoserver/mtg_fd/ir105_hrfi/ows"
  + "?service=WMS&version=1.3.0&request=GetCapabilities";
export const CARTE = "https://view.eumetsat.int/geoserver/mtg_fd/ir105_hrfi/ows";
export const COUCHE = "mtg_fd:ir105_hrfi";

export const PAS = 10 * 60 * 1000;
export const GARDE = 5 * 60 * 1000;
export const TAILLE = 256;
export const ZMAX_TUILE = 6;
export const CACHE_MAX = 120;

// Les bornes de la mise en transparence, en luminance sur 255.
export const SEUIL = 70;
export const PLAGE = 120;

let vu = null;
let quand = 0;

export function dernierDe(xml) {
  const m = /<Dimension[^>]*name="time"[^>]*default="([^"]+)"/i.exec(xml || "");
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? t : null;
}

export async function charger(fetcheur = fetch) {
  const t = Date.now();
  if (vu && t - quand < GARDE) return vu;
  const r = await fetcheur(CAPACITES, { cache: "no-store" });
  if (!r.ok) throw new Error(`nuages ${r.status}`);
  const dernier = dernierDe(await r.text());
  if (dernier === null) throw new Error("nuages sans pas");
  vu = { dernier };
  quand = t;
  return vu;
}

export function oublier() { vu = null; quand = 0; cache.clear(); }

export function pasProche(t, dernier) {
  const p = Math.round(t / PAS) * PAS;
  return Math.min(p, dernier);
}

const RAYON = 6378137;
export function bornes(t) {
  const n = Math.pow(2, t.z);
  const tour = 2 * Math.PI * RAYON;
  const x0 = (t.x / n - 0.5) * tour, x1 = ((t.x + 1) / n - 0.5) * tour;
  const y0 = (0.5 - (t.y + 1) / n) * tour, y1 = (0.5 - t.y / n) * tour;
  return [x0, y0, x1, y1].map(v => v.toFixed(1)).join(",");
}

export const heureService = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

export const adresse = (t, temps) =>
  `${CARTE}?service=WMS&version=1.3.0&request=GetMap&layers=${COUCHE}`
  + `&styles=&format=image/png&transparent=true&crs=EPSG:3857`
  + `&bbox=${bornes(t)}&width=${TAILLE}&height=${TAILLE}&time=${heureService(temps)}`;

/* La mise en transparence, écrite à part pour être éprouvée sans navigateur.
   Modifie le tableau reçu et le rend. */
export function transparence(d, seuil = SEUIL, plage = PLAGE) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
    let a = (lum - seuil) / plage;
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    d[i + 3] = Math.round(a * 255);
  }
  return d;
}

const cache = new Map();

/* Une tuile, rendue transparente à son arrivée. L'image du service sert de
   source à une toile hors écran, dont les pixels sont réécrits une fois ; c'est
   cette toile que le tracé pose ensuite. Une tuile dont les pixels ne peuvent
   pas être lus, faute d'origine rendue, est abandonnée plutôt que posée
   opaque : mieux vaut pas de nuages qu'une carte couverte. */
export function tuile(t, temps, surPret) {
  const cle = adresse(t, temps);
  let e = cache.get(cle);
  if (e) {
    cache.delete(cle); cache.set(cle, e);
    if (surPret && !e.pret && !e.echoue) e.attend.push(surPret);
    return e;
  }
  e = { pret: false, echoue: false, toile: null, attend: surPret ? [surPret] : [] };
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.addEventListener("load", () => {
    try {
      const c = document.createElement("canvas");
      c.width = TAILLE; c.height = TAILLE;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, TAILLE, TAILLE);
      const d = ctx.getImageData(0, 0, TAILLE, TAILLE);
      transparence(d.data);
      ctx.putImageData(d, 0, 0);
      e.toile = c;
      e.pret = true;
    } catch { e.echoue = true; }
    for (const f of e.attend) f();
    e.attend = [];
  });
  img.addEventListener("error", () => { e.echoue = true; e.attend = []; });
  img.src = cle;
  cache.set(cle, e);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return e;
}

export const tuilesNuages = (vue, l, h) => tuilesVues(vue, l, h, ZMAX_TUILE);

export function peindre(ctx, vue, l, h, temps, surPret) {
  if (!temps) return 0;
  let posees = 0;
  ctx.imageSmoothingEnabled = true;
  for (const t of tuilesNuages(vue, l, h)) {
    const e = tuile(t, temps, surPret);
    if (!e.pret || !e.toile) continue;
    ctx.drawImage(e.toile, t.px, t.py, t.cote + 0.5, t.cote + 0.5);
    posees++;
  }
  return posees;
}
