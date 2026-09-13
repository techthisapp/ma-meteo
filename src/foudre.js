/* La couche de foudre observée.

   L'imageur de foudre du Meteosat de troisième génération voit l'émission
   optique des éclairs au sommet des nuages, éclairs intra-nuage compris.
   EUMETSAT en publie la surface cumulée par pixel de deux kilomètres et par
   cinq minutes sur son service de cartes EUMETView, sans clé ni compte, avec
   l'origine ouverte, et sert la couche dans la projection de Mercator, celle
   du fond dessiné.

   Trois mesures ont décidé de la forme, le 10 et le 11 septembre 2026 :

   1. La source. Le réseau communautaire Blitzortung réserve son flux à ses
      propres pages et sert des images en région fixe, hors Mercator, sans
      origine ouverte. Le satellite et le réseau montraient les mêmes orages
      aux mêmes endroits le 10 septembre à 18 h ; pour dire où l'orage est,
      les deux se valent, et seul le satellite se pose sur la carte.

   2. La fenêtre. Un pas de cinq minutes clignote : la foudre d'une cellule
      vient et s'en va d'un pas à l'autre. Sur l'Europe le 11 septembre à
      6 h, un pas couvrait 1517 pixels, trois 2585, quatre 2878, six 2986.
      Six pas, trente minutes, doublent la trace et la lissent ; au delà de
      vingt minutes l'apport est faible. La plage `time=début/fin` du service
      ne cumule pas, elle rend le premier pas de la plage : le cumul se fait
      ici, en posant les pas l'un sur l'autre, le plus récent dessus.

   3. La borne de zoom. Le pixel fait deux kilomètres, ce qu'une tuile du
      zoom six porte déjà à la latitude de la France : les tuiles s'arrêtent
      à six et s'agrandissent au delà, ce qui divise par quatre les requêtes
      d'une vue de près par rapport au radar.

   Ce que coûte la couche : trois à quatre kilooctets par tuile quand il y a
   de la foudre, quelques centaines d'octets sinon ; six tuiles par tuile de
   vue, une par pas. Le dernier pas publié se lit dans les capacités du
   service restreintes à la couche, sept kilooctets, et non dans celles du
   service entier, deux cent quatre-vingts.

   Un pas que le service ne sert pas encore rend un XML d'exception en
   HTTP 200 et non une image : la tuile échoue comme une tuile absente et
   ne peint rien. */

import { tuilesVues } from "./radar.js";

export const CAPACITES = "https://view.eumetsat.int/geoserver/mtg_fd/li_afa/ows"
  + "?service=WMS&version=1.3.0&request=GetCapabilities";
export const CARTE = "https://view.eumetsat.int/geoserver/mtg_fd/li_afa/ows";
export const COUCHE = "mtg_fd:li_afa";

// Le pas du service, et la garde de sa lecture.
export const PAS = 5 * 60 * 1000;
export const GARDE = 5 * 60 * 1000;

// Le nombre de pas posés l'un sur l'autre : trente minutes.
export const FENETRE = 6;

export const TAILLE = 256;
export const ZMAX_TUILE = 6;
export const CACHE_MAX = 260;

let vu = null;
let quand = 0;

/* Le dernier pas publié, lu dans l'attribut `default` de la dimension de
   temps des capacités. Le service publie un pas dix à quinze minutes après
   l'heure qu'il porte : demander l'heure courante rendrait une exception. */
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
  if (!r.ok) throw new Error(`foudre ${r.status}`);
  const dernier = dernierDe(await r.text());
  if (dernier === null) throw new Error("foudre sans pas");
  vu = { dernier };
  quand = t;
  return vu;
}

// Pour les contrôles : le pas gardé se jette.
export function oublier() { vu = null; quand = 0; cache.clear(); }

/* Le pas le plus proche d'un instant, sans dépasser le dernier publié : la
   chronologie de la pluie entraîne la foudre, et ses images sont au pas de
   dix minutes quand la foudre est au pas de cinq. */
export function pasProche(t, dernier) {
  const p = Math.round(t / PAS) * PAS;
  return Math.min(p, dernier);
}

/* Les pas de la fenêtre, du plus ancien au plus récent : le tracé les pose
   dans cet ordre et le plus récent reste dessus. */
export function fenetre(fin, n = FENETRE) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) out.push(fin - k * PAS);
  return out;
}

/* Les bornes d'une tuile en mètres de Mercator, ce que le service attend en
   `crs=EPSG:3857`. Le fond calcule ses positions en fractions du monde ; le
   rayon terrestre les ramène en mètres. */
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

const cache = new Map();

/* Une tuile, à un pas. Même cache que le radar : une adresse déjà vue rend la
   même image, et une tuile qui a échoué n'est pas redemandée à chaque tracé. */
export function tuile(t, temps, surPret) {
  const cle = adresse(t, temps);
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

export const tuilesFoudre = (vue, l, h) => tuilesVues(vue, l, h, ZMAX_TUILE);

/* Le tracé : chaque tuile de la vue reçoit les pas de la fenêtre, du plus
   ancien au plus récent. Une tuile absente ne peint rien et le tracé se refait
   quand elle arrive. Rend le nombre de tuiles posées. */
export function peindre(ctx, vue, l, h, fin, surPret) {
  if (!fin) return 0;
  let posees = 0;
  ctx.imageSmoothingEnabled = true;
  const temps = fenetre(fin);
  for (const t of tuilesFoudre(vue, l, h)) {
    for (const tp of temps) {
      const e = tuile(t, tp, surPret);
      if (!e.pret) continue;
      ctx.drawImage(e.img, t.px, t.py, t.cote + 0.5, t.cote + 0.5);
      posees++;
    }
  }
  return posees;
}
