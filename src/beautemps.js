/* Où est le beau temps.

   Le reste de l'application dit ce qu'il fait ici. Cette feuille répond à
   l'autre question, celle qu'on se pose un samedi matin sous un ciel bas : où
   faut-il aller pour avoir mieux, aujourd'hui ou demain.

   Deux échelles. Les lieux suivis d'abord, qui sont ceux qu'on connaît et où
   l'on va déjà. Cent kilomètres à la ronde ensuite, à la demande : la grille
   coûte une requête de quatre kilooctets, et elle ne répond qu'à une question
   qu'on ne pose pas à chaque ouverture.

   L'ensoleillement porte le score. Mesuré sur la grille réelle autour de
   Fain-lès-Moutiers, l'ensoleillement du lendemain allait de 4,4 à 10,6 heures
   d'un point à l'autre, la température maximale de 20,6 à 27 degrés et la pluie
   de 0 à 10 millimètres : à quelques dizaines de kilomètres, c'est le soleil qui
   sépare, la température très peu. La pluie et l'écart à une température
   agréable ne font que corriger. */

import { nombreFr } from "./horloge.js";
import { versCardinal } from "./previsions.js";
import { ecart } from "./reglages.js";

export const SEUILS_BEAU = {
  /* Les trois poids du score, sur cent. Soixante pour l'ensoleillement : c'est
     lui qui décide, et deux points qui ne diffèrent que par le soleil se
     classent dans son ordre quoi que disent les deux autres termes. */
  poidsSoleil: 60,
  poidsPluie: 25,
  poidsDouceur: 15,

  /* La pluie qui annule sa part. Cinq millimètres sur une journée sont une
     journée mouillée ; au delà, il n'y a plus de degré dans la punition, il
     pleut. */
  pluieMax: 5,

  /* La température agréable, et l'écart au delà duquel sa part est nulle.
     Vingt-deux degrés au maximum de la journée, dix degrés d'écart : douze
     degrés comme trente-deux sont également loin d'une journée agréable. */
  agreable: 22,
  ecartMax: 10,

  /* La grille. Cent kilomètres est la distance qu'on accepte de faire pour une
     journée, vingt-deux kilomètres le pas : soixante-neuf points, un seul appel
     de 3,9 kilooctets compressés, et aucun endroit du disque n'est à plus de
     seize kilomètres d'un point de la grille. */
  rayon: 100,
  pas: 22,

  /* Les points montrés. Au delà de cinq, la liste cesse d'être une réponse et
     redevient une carte, que cette application ne porte pas. */
  montres: 5,

  /* La distance minimale entre deux points montrés, deux pas de grille. Les
     cinq premiers du classement sont sinon cinq mailles voisines du même coin :
     mesuré sur la grille d'essai, les cinq tenaient entre 88 et 99 kilomètres
     dans la même direction, à deux dixièmes d'heure de soleil près. C'est un
     seul endroit écrit cinq fois, et la liste cesse d'offrir un choix. */
  ecartMontres: 44,

  /* L'écart de score en deçà duquel le voyage ne vaut pas d'être fait. Huit
     points valent environ une heure trois quarts d'ensoleillement sur une
     journée d'août, ou deux millimètres de pluie en moins. */
  ecartUtile: 8,
};

const S = SEUILS_BEAU;

/* Le score d'une journée en un point, de zéro à cent.

   L'ensoleillement compte en part de la durée du jour, non en heures : cinq
   heures de soleil sont une belle journée en décembre et une journée grise en
   juin. La durée du jour est demandée à la source point par point, ce qui coûte
   257 octets compressés sur la grille entière et évite d'aller la chercher
   ailleurs.

   Rend `null` quand une des trois grandeurs manque : un point à demi renseigné
   se classerait sur un score amputé, donc trop bas, et disparaîtrait du haut du
   classement sans que rien ne le dise. */
export function score(j) {
  if (!j || !Number.isFinite(j.soleil) || !Number.isFinite(j.jour) || j.jour <= 0) return null;
  if (!Number.isFinite(j.pluie) || !Number.isFinite(j.tmax)) return null;
  const soleil = Math.max(0, Math.min(1, j.soleil / j.jour));
  const sec = 1 - Math.min(1, Math.max(0, j.pluie) / S.pluieMax);
  const doux = 1 - Math.min(1, Math.abs(j.tmax - S.agreable) / S.ecartMax);
  return S.poidsSoleil * soleil + S.poidsPluie * sec + S.poidsDouceur * doux;
}

/* La distance en kilomètres. La projection plate de `reglages.js` sert ici sur
   cent kilomètres et non sur quelques-uns : comparée à la formule de haversine
   sur tout le disque, elle s'en écarte de deux mètres au pire, ce qui est sans
   rapport avec un pas de vingt-deux kilomètres. */
export const km = (a, b) => ecart(a, b) / 1000;

/* L'azimut du second point vu du premier, en degrés depuis le nord. Sur cette
   étendue, la même projection plate suffit : c'est un cap à donner en huitièmes
   de tour, non une route à suivre. */
export function azimut(a, b) {
  const rad = Math.PI / 180;
  const dx = (b.lon - a.lon) * Math.cos((a.lat + b.lat) / 2 * rad);
  const dy = b.lat - a.lat;
  return (Math.atan2(dx, dy) / rad + 360) % 360;
}

/* La grille des points à interroger, centre compris.

   Le centre en fait partie et n'est pas un cas à part : c'est lui qui donne le
   score d'ici, mesuré par la même source, sur la même journée et avec les mêmes
   colonnes que les autres points. Le comparer à un score venu de la charge
   principale ferait comparer deux lectures différentes.

   Le pas est constant en kilomètres, non en degrés : un pas en degrés de
   longitude vaudrait quinze kilomètres au nord de la France et vingt-trois au
   sud de l'Europe. */
export function grille(centre, rayon = S.rayon, pas = S.pas) {
  if (!centre || !Number.isFinite(centre.lat) || !Number.isFinite(centre.lon)) return [];
  const R = 6371, rad = Math.PI / 180;
  const n = Math.floor(rayon / pas);
  const dLat = (pas / R) / rad;
  const arrondi = v => Math.round(v * 1000) / 1000;
  const pts = [];
  for (let i = -n; i <= n; i++) {
    const lat = centre.lat + i * dLat;
    const dLon = (pas / (R * Math.cos(lat * rad))) / rad;
    for (let j = -n; j <= n; j++) {
      const p = { lat: arrondi(lat), lon: arrondi(centre.lon + j * dLon) };
      p.km = km(centre, p);
      if (p.km > rayon) continue;
      p.cap = azimut(centre, p);
      p.ici = i === 0 && j === 0;
      pts.push(p);
    }
  }
  return pts;
}

/* Le classement d'une liste de points sur une journée. Chaque entrée porte son
   point, sa journée et son score, à plat : la vue lit `soleil`, `tmax` et `km`
   sans avoir à savoir d'où chacun vient.

   Les points sans donnée sortent du classement plutôt que de tomber en bas :
   ils ne sont pas mauvais, ils sont inconnus. */
export function classer(points, journees, j) {
  const out = [];
  points.forEach((p, k) => {
    const d = journees?.[k]?.[j];
    const s = score(d);
    if (s === null) return;
    out.push({ ...p, ...d, score: s });
  });
  return out.sort((a, b) => b.score - a.score);
}

/* Les points à montrer, pris dans l'ordre du classement et assez éloignés les
   uns des autres. Le premier est toujours le meilleur : la distance ne déplace
   pas la tête de liste, elle écarte seulement les voisins de ceux qui sont déjà
   retenus. */
export function retenir(classement, n = S.montres, ecart = S.ecartMontres) {
  const pris = [];
  for (const l of classement) {
    if (pris.length >= n) break;
    if (pris.some(p => km(p, l) < ecart)) continue;
    pris.push(l);
  }
  return pris;
}

/* Le meilleur point, s'il vaut le déplacement. Un classement rend toujours un
   premier, y compris les jours où tout se vaut : sans cet écart minimum, la
   feuille enverrait à trente kilomètres pour un quart d'heure de soleil. */
export function mieuxQuIci(classement, ici) {
  if (!classement.length || !ici) return null;
  const m = classement[0];
  if (m === ici) return null;
  return m.score - ici.score >= S.ecartUtile ? m : null;
}

/* Le point qui est ici : celui qui a été marqué, non le plus proche du centre.
   Les deux se confondent sur la grille, dont le centre est le lieu courant ; le
   marquage tient encore sur la liste des lieux suivis, où le lieu courant n'est
   pas forcément le premier. */
export const iciDans = classement => classement.find(l => l.ici) || null;

// La durée d'ensoleillement seule. Sa légende est celle de la colonne, et elle
// est écrite une fois pour toutes dans la vue.
export const soleilTxt = h => `${nombreFr(h)} h`;

/* La position d'un point par rapport à ici, dite comme on la dirait : « à 34 km
   au nord-est ». En deçà du pas de la grille, la direction n'apprend rien. */
export const loinTxt = l => (l.km < 1 ? "ici"
  : l.km < S.pas ? `à ${Math.round(l.km)} km`
    : `à ${Math.round(l.km)} km ${versCardinal(l.cap)}`);

/* Ce qui reste à dire d'une journée une fois le soleil écrit à part : la
   température du maximum, et la pluie seulement s'il en tombe. Une journée sèche
   n'a pas à porter « 0 mm », qui se lit comme une mesure alors que c'est une
   absence ; et la rangée porte déjà sa distance, sa direction et son symbole de
   ciel, qui tiennent sur une ligne tant qu'on ne l'allonge pas. */
export const journeeTxt = l =>
  `${Math.round(l.tmax)}°${l.pluie >= 0.1 ? `, ${nombreFr(l.pluie)} mm` : ""}`;
