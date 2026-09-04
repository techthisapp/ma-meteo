/* Les activités, et quand les faire.

   Six questions ordinaires, chacune avec ses seuils nommés et documentés. Les
   nombres vivent ici et non dans la vue : ce sont eux que les contrôles
   éprouvent, et une valeur posée au milieu d'un gabarit ne se contrôle pas.

   Le moteur est le même pour toutes : il balaye les heures de la fenêtre, garde
   celles que l'activité accepte, et rend la première suite assez longue. La
   première et non la meilleure : on demande quand on peut y aller, non quel
   serait le moment idéal de la semaine.

   Une activité sans créneau le dit et ne propose rien. Rendre le premier
   créneau à défaut ferait conseiller de courir sous la pluie. */

import { heureTxt, jourCourt, nombreFr } from "./horloge.js";
import { SEUILS } from "./conseils.js";
import * as Ensemble from "./ensemble.js";
import * as Air from "./air.js";

/* La fenêtre. Quarante-huit heures : assez long pour qu'une activité trouve
   presque toujours un créneau, assez court pour que la prévision horaire tienne,
   la dispersion des scénarios valant déjà cinq degrés à deux jours. */
export const FENETRE = 48;

/* La lame qui mouille. Le même dixième de millimètre que la règle de mention
   unique des conseils : en deçà, il ne tombe rien qui se sente. */
const SEC = SEUILS.lame;

export const SEUILS_ACT = {
  /* Courir. En dessous de zéro le sol gèle et l'air brûle la gorge, au-dessus de
     vingt-quatre degrés ressentis l'effort devient une épreuve. L'indice
     ultraviolet reprend le seuil des conseils, sept, au delà duquel
     l'exposition est à limiter. */
  courirFroid: 0,
  courirChaud: 24,
  courirUv: SEUILS.uv,

  /* Les heures où l'on sort de son propre chef, pour courir comme pour rouler.
     Sans elles, une nuit calme et sèche donnait « 17 h à 03 h » : c'est vrai du
     vent, et personne ne roule à trois heures du matin. Le lavage de la voiture
     n'en a pas besoin, la lumière du jour le borne déjà. */
  effort: [6, 22],

  /* Vélo. Le vent décide avant la pluie : une averse se traverse, une rafale de
     quarante kilomètres par heure déporte. Les deux seuils sont ceux des
     conseils, rafale et vent moyen, repris et non recopiés. */
  veloRafale: SEUILS.rafale,
  veloVent: SEUILS.ventMoyen,

  /* Étendre le linge. L'évapotranspiration horaire est la vitesse à laquelle
     l'eau s'en va, radiation, vent et déficit de vapeur compris. Un cinquième
     de millimètre par heure est atteint environ la moitié des heures de jour à
     la fin de l'été : le seuil sépare donc les bonnes heures des tièdes. Trois
     heures d'affilée, une lessive ne sèche pas en une. */
  sechage: 0.20,
  sechageHeures: 3,

  /* Aérer pour rafraîchir. L'intérieur ordinaire vaut vingt degrés, et trois
     degrés d'écart sont ce qui vaut la peine d'ouvrir : en deçà, l'air entrant
     ne rafraîchit rien de mesurable. L'air du dehors doit aussi être
     respirable, le seuil venant de `air.js` et non d'ici : ouvrir en grand sur
     un air dégradé fait entrer ce qu'on voulait éviter.

     La règle ne parle que les jours où l'intérieur va devenir plus chaud que le
     dehors. Sans cette réserve elle se déclencherait tout l'hiver, où il fait
     toujours plus frais dehors que dedans, et cesserait d'être lue. */
  interieur: 20,
  ecartAerer: 3,
  eveil: [6, 23],

  /* Arroser. Le bilan se lit sur sept journées écoulées : moins, une seule
     averse le renverse ; plus, la mémoire du sol n'est plus celle d'une plante
     en pot. Le déficit qui vaut un arrosage est de huit millimètres, soit deux
     journées d'été d'évaporation sans pluie. L'arrosage se conseille aux heures
     où l'eau ne repart pas aussitôt, tôt le matin ou le soir. */
  arrosageJours: 7,
  deficit: 8,
  arrosageHeures: [19, 22],

  /* Laver la voiture. Douze heures sans pluie après le lavage : en deçà, la
     première averse défait le travail. */
  lavageSec: 12,
};

const S = SEUILS_ACT;

/* Une suite d'heures acceptées, assez longue. Les heures sont des indices dans
   la série, lesquels se suivent : une rupture de rang est une rupture de
   créneau. */
function premierCreneau(serie, k, accepte, duree) {
  let debut = -1, fin = -1;
  for (const i of k) {
    if (accepte(i)) {
      if (debut < 0 || i !== fin) debut = i;   // rupture de rang : suite nouvelle
      fin = i + 1;
    } else {
      if (debut >= 0 && fin - debut >= duree) return [debut, fin];
      debut = -1;
    }
  }
  return debut >= 0 && fin - debut >= duree ? [debut, fin] : null;
}

// Les indices de la fenêtre, à partir de l'heure en cours.
const fenetre = serie => {
  const k = [];
  for (let i = 0; i < serie.n && i < FENETRE; i++) k.push(i);
  return k;
};

const sec = (serie, i) => (serie.mm[i] || 0) < SEC;
const dansEffort = (serie, i) =>
  serie.heure[i] >= S.effort[0] && serie.heure[i] < S.effort[1];

/* Les six activités. Chacune rend un créneau ou `null`, et porte sa propre
   phrase de refus : « aucun créneau » ne dit pas pourquoi, et la raison est ce
   qui permet de décider autrement. */
export const ACTIVITES = [
  {
    cle: "courir", nom: "Courir", symbole: "thermo",
    sans: "Trop chaud, trop froid ou trop mouillé sur les deux jours",
    creneau(serie, k) {
      return premierCreneau(serie, k, i => sec(serie, i) && dansEffort(serie, i)
        && serie.res[i] >= S.courirFroid && serie.res[i] <= S.courirChaud
        && serie.uv[i] < S.courirUv, 1);
    },
    dit: (serie, [a]) => `${Math.round(serie.res[a])}° ressentis`,
  },
  {
    cle: "velo", nom: "Rouler à vélo", symbole: "vent",
    sans: "Vent ou pluie sur les deux jours",
    creneau(serie, k) {
      return premierCreneau(serie, k, i => sec(serie, i) && dansEffort(serie, i)
        && serie.raf[i] < S.veloRafale && serie.v[i] < S.veloVent, 1);
    },
    dit: (serie, [a, b]) => {
      let raf = 0;
      for (let i = a; i < b; i++) raf = Math.max(raf, serie.raf[i]);
      return `rafales ${Math.round(raf)} km/h`;
    },
  },
  {
    cle: "linge", nom: "Étendre le linge", symbole: "soleil",
    sans: "Rien qui sèche assez vite sur les deux jours",
    creneau(serie, k) {
      return premierCreneau(serie, k,
        i => sec(serie, i) && serie.et0[i] >= S.sechage, S.sechageHeures);
    },
    dit: (serie, [a, b]) => {
      let e = 0;
      for (let i = a; i < b; i++) e += serie.et0[i];
      return `${nombreFr(e)} mm d'eau partis`;
    },
  },
  {
    cle: "aerer", nom: "Aérer pour rafraîchir", symbole: "maison",
    sans: "L'intérieur ne va pas se réchauffer, ou l'air du dehors est dégradé",
    creneau(serie, k) { return creneauAerer(serie, k); },
    dit: (serie, [a, b]) => {
      let t = Infinity;
      for (let i = a; i < b; i++) t = Math.min(t, serie.t[i]);
      return `${Math.round(t)}° dehors`;
    },
  },
  {
    cle: "arroser", nom: "Arroser", symbole: "goutte",
    sans: "",   // l'arrosage porte sa propre phrase, voir `arrosage`
    creneau(serie, k) {
      return premierCreneau(serie, k, i => sec(serie, i)
        && serie.heure[i] >= S.arrosageHeures[0]
        && serie.heure[i] < S.arrosageHeures[1], 1);
    },
    dit: () => "avant la nuit",
  },
  {
    cle: "voiture", nom: "Laver la voiture", symbole: "coche",
    sans: "De la pluie dans les douze heures qui suivent, sur les deux jours",
    creneau(serie, k) {
      /* Une heure ne convient que si les douze qui la suivent sont sèches. Au
         bout de la fenêtre la question ne se tranche plus : la charge s'arrête,
         et une heure dont la suite est inconnue n'est pas une heure sèche. */
      const suiteSeche = i => {
        if (i + S.lavageSec >= serie.n) return false;
        for (let j = i; j <= i + S.lavageSec; j++) if (!sec(serie, j)) return false;
        return true;
      };
      return premierCreneau(serie, k, i => serie.clair[i] === 1 && suiteSeche(i), 1);
    },
    dit: () => `${S.lavageSec} heures au sec ensuite`,
  },
];

/* Aérer pour rafraîchir. Écrite à part parce que la réponse du matin s'en sert
   aussi : deux règles pour la même question finiraient par se contredire sur le
   même écran.

   L'air entre dans la règle comme une condition de plus, non comme un choix du
   meilleur moment : les six activités rendent le premier créneau qui convient,
   et celle-ci ne va pas se mettre à chercher le moment idéal quand les cinq
   autres ne le font pas. Une heure dont l'air est inconnu reste acceptable,
   l'absence de donnée n'étant pas une raison de refuser. */
export function creneauAerer(serie, k) {
  if (!k.length) return null;
  let chaud = -Infinity;
  for (const i of k) if (serie.jour[i] === serie.jour[k[0]]) chaud = Math.max(chaud, serie.t[i]);
  if (chaud < S.interieur + S.ecartAerer) return null;
  const air = Air.alignerSur(serie);
  const respirable = i => !air || air.aqi[i] === null || air.aqi[i] < Air.DEGRADE;
  return premierCreneau(serie, k, i => sec(serie, i) && respirable(i)
    && serie.heure[i] >= S.eveil[0] && serie.heure[i] < S.eveil[1]
    && serie.t[i] <= S.interieur - S.ecartAerer, 1);
}

/* L'arrosage ne demande pas quand mais s'il faut. Le bilan des journées écoulées
   décide, et le créneau ne se cherche qu'ensuite. */
export function arrosage(bilan) {
  if (!bilan) return null;
  const manque = -bilan.bilan;
  return {
    utile: manque >= S.deficit,
    chiffre: manque >= S.deficit
      ? `${nombreFr(manque)} mm de déficit sur ${bilan.jours} jours`
      : `${nombreFr(Math.max(0, bilan.bilan))} mm d'excédent sur ${bilan.jours} jours`,
  };
}

/* Le nom d'un créneau, dit comme on le dirait. La journée se nomme par rapport
   à celle de l'heure en cours, non par sa date : « demain 07 h à 09 h ». */
export function quandTxt(serie, [a, b]) {
  const jour = serie.jour[a];
  const ecart = Math.round(
    (Date.parse(`${jour}T12:00`) - Date.parse(`${serie.jour[0]}T12:00`)) / 86400000);
  const mot = ecart === 0 ? "" : ecart === 1 ? "demain " : `${jourCourt(jour)} `;
  return `${mot}${heureTxt(serie.heure[a])} à ${heureTxt(serie.heure[b - 1] + 1)}`;
}

/* La confiance, écrite seulement quand elle est mauvaise, comme dans la réponse
   du matin. Une mention à chaque fois se lirait une semaine, puis ne se lirait
   plus. */
export const partages = (serie, [a]) => {
  const j = Ensemble.journee(serie.jour[a]);
  return !!j && j.etendue >= 6;
};

/* Les six réponses, dans l'ordre des activités. `bilan` vient de la charge
   quotidienne et ne concerne que l'arrosage. */
export function repondre(serie, bilan) {
  if (!serie || !Array.isArray(serie.heure)) return [];
  const k = fenetre(serie);
  return ACTIVITES.map(a => {
    const nu = { cle: a.cle, nom: a.nom, symbole: a.symbole, creneau: null, partages: false };
    const eau = a.cle === "arroser" ? arrosage(bilan) : null;
    if (eau && !eau.utile) return { ...nu, quand: "Pas nécessaire", detail: eau.chiffre };

    const c = a.creneau(serie, k);
    /* L'arrosage a besoin d'une soirée sèche. N'en trouver aucune sur deux
       journées veut dire qu'il pleut : le jardin est arrosé, et le déficit des
       journées écoulées reste la raison à donner. */
    if (!c && eau) return { ...nu, quand: "La pluie s'en charge", detail: eau.chiffre };
    if (!c) return { ...nu, quand: "Aucun créneau", detail: a.sans };

    return {
      cle: a.cle, nom: a.nom, symbole: a.symbole, creneau: c,
      quand: quandTxt(serie, c),
      detail: eau ? eau.chiffre : a.dit(serie, c),
      partages: partages(serie, c),
    };
  });
}
