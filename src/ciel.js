/* La carte du ciel.

   Elle place les étoiles, les figures des constellations et leurs noms sur la
   voûte, telle qu'on la voit depuis la commune à un instant donné.

   Ce que le fichier de données porte, préparé le 20 septembre 2026 :

   - 5070 étoiles jusqu'à la magnitude 6, ce qu'un œil exercé distingue sous un
     ciel noir. Depuis une ville, on ne dépasse guère quatre ; la carte sert
     aussi en campagne, d'où ce choix. Source : catalogue HYG version 4.1, qui
     réunit Hipparcos, Yale Bright Star et Gliese, sous licence Creative
     Commons Attribution et partage dans les mêmes conditions. Le Soleil y
     figure, à l'origine des coordonnées : il a été retiré, sa place sur le ciel
     se calculant à l'heure dite par `astres.js`.
   - 88 figures de constellations, 150 segments et 893 points, et leurs noms en
     français avec la position où poser l'étiquette. Source : d3-celestial
     d'Olaf Frohn, sous licence BSD à trois clauses.

   Le tout pèse 241 kilooctets, 81 une fois comprimé. Il se charge quand l'écran
   des étoiles s'ouvre, non dans la coquille de départ : c'est un poids que ne
   doit pas payer qui ne regarde jamais le ciel.

   Les limites officielles de l'Union astronomique internationale, qui découpent
   le ciel entier en 88 zones jointives, ne sont pas embarquées. Elles répondent
   à la question de savoir dans quelle constellation se trouve un astre, au prix
   d'un quadrillage de 257 tracés sur une carte déjà dense. À ajouter si l'usage
   la pose.

   La projection est stéréographique, centrée sur la direction visée. Elle
   conserve les angles, donc la forme des constellations, ce qu'une projection
   qui étalerait les distances ne ferait pas : une Grande Ourse déformée ne se
   reconnaît plus. */

import { jourJulien, horizon } from "./astres.js";

export const FICHIER = "./donnees/ciel.json";

let donnees = null;
let enCours = null;

/* Le chargement, une seule fois. Un second appel pendant le premier rend la
   même promesse plutôt que de demander le fichier deux fois. */
export async function charger(fetcheur = fetch) {
  if (donnees) return donnees;
  if (enCours) return enCours;
  enCours = (async () => {
    const r = await fetcheur(FICHIER);
    if (!r.ok) throw new Error(`ciel ${r.status}`);
    donnees = await r.json();
    return donnees;
  })();
  try { return await enCours; } finally { enCours = null; }
}

export const chargees = () => donnees;

/* Ce qui s'affiche, au choix, mesuré le 21 septembre 2026 sur le fichier :
   les plus visibles, 523 étoiles jusqu'à la magnitude 4, ce qu'on voit depuis
   une ville ; toutes, 5070 jusqu'à la magnitude 6, un ciel noir de campagne ;
   les constellations, les 749 étoiles qui portent les figures, marquées dans
   le fichier. Les plus visibles par défaut, décidé le même jour : la carte
   entière était trop dense pour se lire. */
export const AFFICHAGES = [
  ["visibles", "Visibles", "Les étoiles les plus visibles"],
  ["toutes", "Toutes", "Toutes les étoiles"],
  ["constellations", "Constellations", "Les étoiles des constellations"],
];
export function retenue(affichage, mag, figure) {
  if (affichage === "visibles") return mag <= 4;
  if (affichage === "constellations") return figure === 1;
  return mag <= 6;
}
export function oublier() { donnees = null; enCours = null; }

/* Hauteur et azimut d'un point du ciel, en réutilisant le calcul d'horizon déjà
   écrit pour le Soleil et la Lune. Celui-ci travaille en degrés, comme tout
   `astres.js` ; le fichier porte l'ascension droite en heures, d'où le facteur
   quinze, appliqué ici une fois pour toutes. */
const DEG_EN_RAD = Math.PI / 180;

export function surHorizon(ra, dec, jj, lat, lon) {
  return horizon({ ascension: ra * 15, declinaison: dec }, jj, lat, lon);
}

/* La projection stéréographique. Le centre de la vue est donné par son azimut
   et sa hauteur ; un point du ciel y est placé en coordonnées d'écran, l'unité
   valant le rayon du champ.

   Rend `null` pour un point situé à plus de quatre-vingt-dix degrés du centre,
   qui est derrière l'observateur. */
export function projeter(az, haut, azCentre, hautCentre, champ = 60) {
  const a = az * DEG_EN_RAD, h = haut * DEG_EN_RAD;
  const a0 = azCentre * DEG_EN_RAD, h0 = hautCentre * DEG_EN_RAD;
  const cosC = Math.sin(h0) * Math.sin(h)
    + Math.cos(h0) * Math.cos(h) * Math.cos(a - a0);
  if (cosC <= 0) return null;
  const k = 2 / (1 + cosC);
  const x = k * Math.cos(h) * Math.sin(a - a0);
  const y = k * (Math.cos(h0) * Math.sin(h) - Math.sin(h0) * Math.cos(h) * Math.cos(a - a0));
  /* Le facteur du bord du champ, pour que `champ` degrés tiennent dans le
     rayon : la même formule appliquée à un point situé à cette distance. */
  const r = 2 * Math.sin(champ * DEG_EN_RAD) / (1 + Math.cos(champ * DEG_EN_RAD));
  return { x: x / r, y: -y / r };
}

/* Le rayon d'une étoile à l'écran, en points, selon sa magnitude. L'échelle des
   magnitudes est logarithmique et inversée : plus le nombre est petit, plus
   l'étoile est brillante. Une magnitude 6 donne un point à peine visible, une
   magnitude négative un disque net. */
export function rayon(mag, gros = 1) {
  const r = 0.5 + (6 - Math.min(mag, 6)) * 0.42;
  return Math.max(0.5, r) * gros;
}

/* La couleur d'une étoile selon son indice de couleur, la différence entre sa
   magnitude en bleu et en visible. Négatif pour une étoile chaude et bleue,
   positif pour une froide et rouge. Le Soleil vaut 0,65. La teinte reste très
   pâle : l'œil ne voit presque pas la couleur des étoiles, et une carte trop
   colorée ne ressemble plus au ciel. */
export function couleur(ci) {
  const c = Math.max(-0.4, Math.min(2, Number(ci) || 0));
  if (c < 0.3) return "#cddcf5";
  if (c < 0.6) return "#e6eefc";
  if (c < 0.9) return "#fdf6e6";
  if (c < 1.4) return "#fbe3c2";
  return "#f7cfae";
}

/* Les étoiles visibles dans le champ, prêtes à peindre. Rend leurs positions
   d'écran en unités du rayon, à charge de l'appelant de les mettre à l'échelle.
   Une étoile sous l'horizon est écartée : la voûte s'arrête au sol. */
/* Sous l'horizon, décidé le 21 septembre 2026, les étoiles se voient à travers
   une étendue d'eau, pâlies et floutées. Le module les rend alors aussi,
   marquées `sous`, quand on le lui demande ; sans cette demande, le contrat
   reste celui d'origine et la voûte s'arrête au sol. */
export function etoilesVues(date, lat, lon, azCentre, hautCentre, champ = 60,
  affichage = "toutes", bords = [1.2, 1.2], sousHorizon = false) {
  if (!donnees) return [];
  const jj = jourJulien(date);
  const out = [];
  for (const [ra, dec, mag, ci, nom, bf, con, figure] of donnees.etoiles) {
    if (!retenue(affichage, mag, figure)) continue;
    const { hauteur, azimut } = surHorizon(ra, dec, jj, lat, lon);
    if (hauteur < 0 && !sousHorizon) continue;
    const p = projeter(azimut, hauteur, azCentre, hautCentre, champ);
    if (!p || Math.abs(p.x) > bords[0] || Math.abs(p.y) > bords[1]) continue;
    out.push({ x: p.x, y: p.y, hauteur, mag, ci, nom, bf, con, figure, sous: hauteur < 0 });
  }
  return out;
}

/* Les segments des figures, coupés à l'horizon. Un trait dont une extrémité est
   sous le sol n'est pas tracé : le prolonger dessinerait une constellation à
   moitié enterrée. */
export function figuresVues(date, lat, lon, azCentre, hautCentre, champ = 60,
  sousHorizon = false) {
  if (!donnees) return [];
  const jj = jourJulien(date);
  const out = [];
  for (const [sigle, segments] of Object.entries(donnees.figures)) {
    for (const seg of segments) {
      /* Sous l'eau demandée, un trait se coupe en tronçons de part et d'autre
         de l'horizon, chacun marqué ; le point de passage appartient aux deux,
         pour que le trait ne se brise pas à la surface. */
      let courant = [], sous = null;
      for (const [ra, dec] of seg) {
        const { hauteur, azimut } = surHorizon(ra, dec, jj, lat, lon);
        const dessous = hauteur < 0;
        const p = dessous && !sousHorizon ? null
          : projeter(azimut, hauteur, azCentre, hautCentre, champ);
        if (!p) {
          if (courant.length > 1) out.push({ sigle, points: courant, sous: !!sous });
          courant = []; sous = null; continue;
        }
        if (sous !== null && dessous !== sous) {
          if (courant.length > 1) out.push({ sigle, points: courant, sous });
          courant = [courant[courant.length - 1]];
        }
        sous = dessous;
        courant.push(p);
      }
      if (courant.length > 1) out.push({ sigle, points: courant, sous: !!sous });
    }
  }
  return out;
}

/* Les noms de constellations à poser, à la place que la source indique. Un nom
   dont la place est sous l'horizon ne s'écrit pas. */
export function nomsVus(date, lat, lon, azCentre, hautCentre, champ = 60,
  bords = [1, 1]) {
  if (!donnees) return [];
  const jj = jourJulien(date);
  const out = [];
  for (const [sigle, [nom, ra, dec]] of Object.entries(donnees.noms)) {
    const { hauteur, azimut } = surHorizon(ra, dec, jj, lat, lon);
    if (hauteur < 0) continue;
    const p = projeter(azimut, hauteur, azCentre, hautCentre, champ);
    if (!p || Math.abs(p.x) > bords[0] || Math.abs(p.y) > bords[1]) continue;
    out.push({ sigle, nom, x: p.x, y: p.y });
  }
  return out;
}

/* ---------- La fiche d'une constellation ----------

   Elle s'ouvre d'un toucher bref en plein écran, décidé le 21 septembre 2026.
   Un appui long est moins découvert sur iPhone et entre en conflit avec les
   gestes du système ; le toucher bref ne gêne rien, le glissement tournant la
   vue et le toucher sans mouvement désignant. */

/* La constellation désignée par un toucher, en unités de projection : celle
   dont un trait passe au plus près, puis à défaut celle dont le nom est le plus
   proche. Les limites officielles ne servent pas ici : on touche une figure, non
   une zone du ciel. */
const distanceSegment = (x, y, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
};
export function designee(x, y, figures, noms, seuilTrait = 0.08, seuilNom = 0.16) {
  let proche = null;
  for (const f of figures) {
    for (let k = 1; k < f.points.length; k++) {
      const d = distanceSegment(x, y, f.points[k - 1], f.points[k]);
      if (!proche || d < proche.d) proche = { sigle: f.sigle, d };
    }
  }
  if (proche && proche.d <= seuilTrait) return proche.sigle;
  let nom = null;
  for (const n of noms) {
    const d = Math.hypot(x - n.x, y - n.y);
    if (!nom || d < nom.d) nom = { sigle: n.sigle, d };
  }
  return nom && nom.d <= seuilNom ? nom.sigle : null;
}

/* La lettre grecque d'une désignation de Bayer, telle que le catalogue l'écrit
   en trois lettres latines. */
const GRECQUES = { Alp: "α", Bet: "β", Gam: "γ", Del: "δ", Eps: "ε", Zet: "ζ", Eta: "η",
  The: "θ", Iot: "ι", Kap: "κ", Lam: "λ", Mu: "μ", Nu: "ν", Xi: "ξ", Omi: "ο", Pi: "π",
  Rho: "ρ", Sig: "σ", Tau: "τ", Ups: "υ", Phi: "φ", Chi: "χ", Psi: "ψ", Ome: "ω" };
export function lettreDe(bf) {
  const m = /(Alp|Bet|Gam|Del|Eps|Zet|Eta|The|Iot|Kap|Lam|Mu|Nu|Xi|Omi|Pi|Rho|Sig|Tau|Ups|Phi|Chi|Psi|Ome)/.exec(bf || "");
  return m ? GRECQUES[m[1]] : null;
}

/* Les faits de la fiche, tous calculés : noms français et latin, hauteur et
   direction à l'instant, heures où la constellation passe au-dessus de dix
   degrés pendant la nuit noire, étoile la plus brillante, et mois où elle
   culmine à minuit. Ce mois est celui où le Soleil se tient à l'opposé, à douze
   heures d'ascension droite : il avance de deux heures par mois depuis
   l'équinoxe de mars. Pas de récit mythologique, qui demanderait 88 textes à
   écrire ou à reprendre d'une source protégée. */
export function fiche(sigle, date, lat, lon, nuit = null) {
  const n = donnees?.noms?.[sigle];
  if (!n) return null;
  const [nom, ra, dec, latin] = n;
  const { hauteur, azimut } = surHorizon(ra, dec, jourJulien(date), lat, lon);
  let visible = null;
  if (nuit) {
    let premiere = null, derniere = null, total = 0, dessus = 0;
    for (let t = nuit.debut.getTime(); t <= nuit.fin.getTime(); t += 20 * 60000) {
      total++;
      if (surHorizon(ra, dec, jourJulien(new Date(t)), lat, lon).hauteur > 10) {
        dessus++;
        if (premiere === null) premiere = t;
        derniere = t;
      }
    }
    visible = dessus === 0 ? { jamais: true }
      : dessus === total ? { toute: true }
      : { debut: new Date(premiere), fin: new Date(derniere) };
  }
  const siennes = donnees.etoiles.filter(e => e[6] === sigle).sort((a, b) => a[2] - b[2]);
  const b = siennes[0];
  /* Une étoile ne se lève jamais quand sa hauteur au passage au méridien,
     quatre-vingt-dix degrés moins l'écart entre la latitude et sa déclinaison,
     reste négative : Achernar, la plus brillante de l'Éridan, à moins
     cinquante-sept degrés, ne paraît jamais au-dessus de la France. */
  const brillante = b ? { nom: b[4] || null, lettre: lettreDe(b[5]), mag: b[2],
    jamais: 90 - Math.abs(lat - b[1]) < 0 } : null;
  const jours = (((ra - 12) % 24) + 24) % 24 / 24 * 365.25;
  const culmine = new Date(date.getFullYear(), 2, 21 + Math.round(jours));
  return { sigle, nom, latin, hauteur, azimut, visible, brillante, moisCulmine: culmine.getMonth() };
}
