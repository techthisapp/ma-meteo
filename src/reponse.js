/* La réponse du matin.

   Une phrase qui tranche ce qu'il y a à faire, posée dans le ciel de l'accueil.
   Elle ne redit pas ce qui est déjà écrit ailleurs : les conseils disent ce que
   le temps fait, elle dit ce qu'il faut faire, et c'est le seul endroit de
   l'application qui donne une instruction.

   Elle ne parle jamais du parapluie. C'est l'affaire du jeton, qui vit dans la
   barre de tête et porte déjà cette réponse sur les cinq écrans ; la redire ici
   la mettrait deux fois sur le même écran.

   Le silence est l'état par défaut. Une journée sans instruction à donner laisse
   le ciel nu. */

import { heureTxt } from "./horloge.js";
import * as Ensemble from "./ensemble.js";

/* L'échelle d'habillement, en degrés ressentis. Les bornes sont celles auxquelles
   on change de vêtement, non des paliers réguliers : entre neuf et quinze degrés
   on met une veste, et cet intervalle est plus large que celui du manteau parce
   que le froid vif se subdivise moins. */
export const TENUES = [
  [-99, "Manteau et bonnet"],
  [2, "Manteau"],
  [9, "Veste"],
  [15, "Pull léger"],
  [21, "Manches courtes"],
  [28, "Tenue légère"],
];

export const tenueDe = t => {
  let n = TENUES[0][1];
  for (const [seuil, nom] of TENUES) if (t >= seuil) n = nom;
  return n;
};

/* L'intérieur ordinaire, et l'écart qui vaut la peine d'ouvrir une fenêtre.
   Trois degrés : en deçà, l'air entrant ne rafraîchit rien de mesurable et le
   conseil serait un réflexe et non un fait. */
export const INTERIEUR = 20;
export const ECART = 3;

/* Les heures où l'on ouvre une fenêtre. Conseiller d'aérer à quatre heures du
   matin n'a pas d'objet. */
export const EVEIL = [6, 23];

// Au delà, les scénarios sont partagés et la phrase le dit.
export const CONFIANCE_BASSE = 6;

// La borne du biais personnel. Trois degrés couvrent l'écart entre deux
// personnes ; au delà, ce n'est plus un réglage mais une autre échelle.
export const BIAIS_MAX = 3;

const cleJour = d => `${d.getFullYear()}-`
  + `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Les heures de la journée en cours qui restent à venir. Une instruction pour
   une heure passée n'a pas d'objet, et le matin sort de la fenêtre à mesure
   qu'il s'écoule. */
function reste(serie, maintenant) {
  const jour = cleJour(maintenant);
  const h0 = maintenant.getHours();
  const k = [];
  for (let i = 0; i < serie.n; i++) {
    if (serie.jour[i] === jour && serie.heure[i] >= h0) k.push(i);
  }
  return k;
}

/* L'habillement. Deux moments comptent, le plus frais et le plus chaud de ce
   qui reste : c'est la question qu'on se pose en s'habillant le matin, et une
   seule valeur y répondrait mal un jour à quinze degrés d'amplitude.

   Le biais personnel déplace la tenue, non les degrés écrits. Le chiffre vient
   de la source et doit s'accorder au ruban et à la table des moments, que trois
   contrôles gardent au degré ; c'est le conseil qui se règle sur la personne. */
export function habillement(serie, k, biais = 0) {
  if (!k.length) return null;
  let kf = k[0], kc = k[0];
  for (const i of k) {
    if (serie.res[i] < serie.res[kf]) kf = i;
    if (serie.res[i] > serie.res[kc]) kc = i;
  }
  const nomF = tenueDe(serie.res[kf] + biais);
  const nomC = tenueDe(serie.res[kc] + biais);

  /* Une journée qui tient dans une seule tenue ordinaire ne se dit pas : il n'y
     a rien à décider, et la phrase se lirait une semaine puis ne se lirait plus.
     Les deux tenues extrêmes font exception, le grand froid et la forte chaleur
     étant des instructions à eux seuls. */
  if (nomF === nomC) {
    const extreme = nomF === TENUES[0][1] || nomF === TENUES[TENUES.length - 1][1];
    if (!extreme) return null;
    return { cle: "tenue",
      texte: `${nomF}, ${Math.round(serie.res[kf])} à ${Math.round(serie.res[kc])}° ressentis.` };
  }

  /* Les deux moments dans l'ordre où ils viennent, non du plus froid au plus
     chaud : une journée qui se rafraîchit se dit dans l'autre sens, et on
     s'habille pour le premier des deux. */
  const [a, b] = kf <= kc ? [kf, kc] : [kc, kf];
  const nomA = a === kf ? nomF : nomC;
  const nomB = b === kf ? nomF : nomC;
  return { cle: "tenue",
    texte: `${nomA}, ${Math.round(serie.res[a])}°, puis ${nomB.toLowerCase()} `
      + `vers ${heureTxt(serie.heure[b])}, ${Math.round(serie.res[b])}°.` };
}

/* L'aération. Elle ne parle que les jours où l'intérieur va devenir plus chaud
   que le dehors, faute de quoi la règle se déclencherait tout l'hiver, où il
   fait toujours plus frais dehors que dedans, et cesserait d'être lue.

   La fenêtre est la première suite d'heures assez fraîches et sans pluie. */
export function aeration(serie, k) {
  if (!k.length) return null;
  const chaud = Math.max(...k.map(i => serie.t[i]));
  if (chaud < INTERIEUR + ECART) return null;
  let debut = null, fin = null, frais = null;
  for (const i of k) {
    const h = serie.heure[i];
    const bon = h >= EVEIL[0] && h < EVEIL[1]
      && serie.t[i] <= INTERIEUR - ECART && (serie.mm[i] || 0) === 0;
    if (bon) {
      if (debut === null) { debut = h; frais = serie.t[i]; }
      fin = h + 1;
      frais = Math.min(frais, serie.t[i]);
    } else if (debut !== null) break;
  }
  if (debut === null) return null;
  return { cle: "aerer",
    texte: `Aérer de ${heureTxt(debut)} à ${heureTxt(fin)}, ${Math.round(frais)}° dehors.` };
}

/* La réponse du jour, ou `null`. L'habillement passe devant l'aération : on
   s'habille avant d'ouvrir une fenêtre, et c'est la question que l'on se pose
   en se levant.

   La confiance ne s'écrit que lorsqu'elle est mauvaise. Une mention à chaque
   fois se lirait une semaine, puis ne se lirait plus. */
export function repondre(serie, maintenant = new Date(), opts = {}) {
  if (!serie || !Array.isArray(serie.res)) return null;
  const k = reste(serie, maintenant);
  const r = habillement(serie, k, opts.biais || 0) || aeration(serie, k);
  if (!r) return null;
  const j = Ensemble.journee(cleJour(maintenant));
  const partages = !!j && j.etendue >= CONFIANCE_BASSE;
  return { ...r, texte: partages ? `${r.texte} Scénarios partagés.` : r.texte, partages };
}
