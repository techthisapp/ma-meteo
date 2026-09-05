/* Codes de temps sensible de l'Organisation météorologique mondiale, et les
   dessins qui vont avec. */

import { esc } from "./horloge.js";

const TEMPS = [
  [[0], "Ciel clair", "soleil"],
  [[1, 2], "Éclaircies", "soleil_nuage"],
  [[3], "Couvert", "nuage"],
  [[45, 48], "Brouillard", "brume"],
  [[51, 53, 55, 56, 57], "Bruine", "pluie"],
  [[61, 63, 65, 66, 67], "Pluie", "pluie"],
  [[71, 73, 75, 77, 85, 86], "Neige", "neige"],
  [[80, 81, 82], "Averses", "averse"],
  [[95, 96, 99], "Orage", "orage"],
];

export const tempsDe = c => TEMPS.find(t => t[0].includes(c)) || [[], "Temps variable", "nuage"];

/* Les symboles de temps se dessinent en deux groupes : `ic-a` porte la masse,
   `ic-b` porte l'accent. Rendus par `icoTemps`, ils prennent deux couleurs ;
   rendus par `ico`, ils restent monochromes. Une couleur ne porte jamais seule
   l'information, le libellé la double toujours. */
const D = {
  soleil: '<g class="ic-b"><circle cx="12" cy="12" r="4.6"/>'
    + '<path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22'
    + 'M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9"/></g>',
  soleil_nuage: '<g class="ic-b"><circle cx="9" cy="9" r="3.4"/>'
    + '<path d="M9 2.6v1.8M2.6 9h1.8M4.8 4.8l1.3 1.3M13.2 4.8l-1.3 1.3"/></g>'
    + '<g class="ic-a"><path d="M8.4 19.4h9.2a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2 3 3 0 0 0 .1 6z"/></g>',
  nuage: '<g class="ic-a"><path d="M7.4 19.4h9.2a3.8 3.8 0 0 0 .3-7.6 5.3 5.3 0 0 0-10.1 1.3 3.2 3.2 0 0 0 .6 6.3z"/></g>',
  brume: '<g class="ic-a"><path d="M7.4 15.4h9.2a3.8 3.8 0 0 0 .3-7.6A5.3 5.3 0 0 0 6.8 9.1a3.2 3.2 0 0 0 .6 6.3z"/></g>'
    + '<g class="ic-b"><path d="M4 18.6h16M6.5 21.4h11"/></g>',
  pluie: '<g class="ic-a"><path d="M7.4 15h9.2a3.8 3.8 0 0 0 .3-7.6A5.3 5.3 0 0 0 6.8 8.7a3.2 3.2 0 0 0 .6 6.3z"/></g>'
    + '<g class="ic-b"><path d="M9 18.4l-.9 2.6M13 18.4l-.9 2.6M17 18.4l-.9 2.6"/></g>',
  averse: '<g class="ic-a"><path d="M7.4 14.2h9.2a3.8 3.8 0 0 0 .3-7.6A5.3 5.3 0 0 0 6.8 7.9a3.2 3.2 0 0 0 .6 6.3z"/></g>'
    + '<g class="ic-b"><path d="M9.4 17.4l-1.2 3.4M13.4 17.4l-1.2 3.4"/>'
    + '<path d="M17.4 17.4l-2.6 2.4h2.6l-2.6 2"/></g>',
  orage: '<g class="ic-a"><path d="M7.4 13.6h9.2a3.8 3.8 0 0 0 .3-7.6A5.3 5.3 0 0 0 6.8 7.3a3.2 3.2 0 0 0 .6 6.3z"/></g>'
    + '<g class="ic-b"><path d="M13.4 16l-3.4 4.2h3l-2 3.4" stroke-linejoin="round"/></g>',
  neige: '<g class="ic-a"><path d="M7.4 14.6h9.2a3.8 3.8 0 0 0 .3-7.6A5.3 5.3 0 0 0 6.8 8.3a3.2 3.2 0 0 0 .6 6.3z"/></g>'
    + '<g class="ic-b"><path d="M9 18v3.4M7.4 18.9l3.2 1.6M10.6 18.9l-3.2 1.6'
    + 'M16 18v3.4M14.4 18.9l3.2 1.6M17.6 18.9l-3.2 1.6"/></g>',
  goutte: '<path d="M12 3.4c4.2 4.8 6.6 8.2 6.6 11.2a6.6 6.6 0 0 1-13.2 0c0-3 2.4-6.4 6.6-11.2z"/>',
  /* Le pollen : une tige et trois folioles, alternées. Un grain de pollen
     dessiné en rond radiant se serait lu comme un soleil, lequel a déjà son
     symbole à deux pas dans la même liste de faits. */
  pollen: '<path d="M12 21.4V8.6"/>'
    + '<path d="M12 8.6c0-2.7 1.5-4.7 4.4-5.4.3 2.8-1.2 4.8-4.4 5.4z"/>'
    + '<path d="M12 13c-2.6-.5-4-2.2-4.2-4.9 2.6.3 4 1.9 4.2 4.9z"/>'
    + '<path d="M12 17.2c2.4-.5 3.7-2 3.9-4.5-2.4.3-3.7 1.6-3.9 4.5z"/>',
  arc: '<path d="M3 18h18"/><path d="M6.2 18a5.8 5.8 0 0 1 11.6 0"/><path d="M12 6.4V4M5.2 9.2L3.6 7.6M18.8 9.2l1.6-1.6"/>',
  /* La course du jour : cinq moments qui se distinguent d'un coup d'œil. La
     lueur n'a qu'un demi-soleil, le lever une flèche montante, le coucher une
     flèche descendante, le midi un soleil complet. */
  lueur: '<path d="M2.6 18.4h18.8"/><path d="M8 18.4a4 4 0 0 1 8 0"/>'
    + '<path d="M12 8.6V6.4M6.6 11l-1.5-1.5M17.4 11l1.5-1.5"/>',
  lever: '<path d="M2.6 19.4h18.8"/><path d="M8 15.4a4 4 0 0 1 8 0"/>'
    + '<path d="M12 3.2v6M9.2 6l2.8-2.8L14.8 6" stroke-linejoin="round"/>',
  midi: '<circle cx="12" cy="12" r="4.4"/>'
    + '<path d="M12 2.4v2.6M12 19v2.6M2.4 12H5M19 12h2.6'
    + 'M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8"/>',
  coucher: '<path d="M2.6 19.4h18.8"/><path d="M8 15.4a4 4 0 0 1 8 0"/>'
    + '<path d="M12 9.2v-6M9.2 6.4L12 9.2l2.8-2.8" stroke-linejoin="round"/>',
  /* Le passage au méridien : la ligne nord-sud que l'astre franchit, et la
     course qui la coupe à son sommet. */
  meridien: '<path d="M12 2.6v18.8"/><path d="M4.4 16.6a7.6 7.6 0 0 1 15.2 0"/>',
  // La culmination, sans rayons : elle vaut pour la Lune comme pour le Soleil.
  culmination: '<path d="M2.6 19.4h18.8"/><path d="M6 19.4a6 6 0 0 1 12 0"/>'
    + '<path d="M12 13.4V9.6"/>',
  alerte: '<path d="M12 3.6 21.4 20H2.6z" stroke-linejoin="round"/><path d="M12 9.6v4.6M12 17.2v.1"/>',
  vent: '<path d="M3 8.4h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17.6h8"/>',
  lune: '<g class="ic-b"><path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/></g>',
  lune_nuage: '<g class="ic-b"><path d="M12.9 9.1A5 5 0 0 1 6.5 2.7a5 5 0 1 0 6.4 6.4z"/></g>'
    + '<g class="ic-a"><path d="M8.4 19.4h9.2a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2 3 3 0 0 0 .1 6z"/></g>',
  thermo: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9.5v5.8"/>',
  horloge: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  semaine: '<rect x="3.4" y="5" width="17.2" height="15.6" rx="2.4"/><path d="M3.4 9.8h17.2M8.4 3.4v3.2M15.6 3.4v3.2"/>',
  jauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4.4-5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  moins: '<path d="M5 12h14"/>',
  /* Lecture et pause : deux formes pleines, seules du jeu. Un triangle en trait
     et une paire de barres en trait ne se distinguent plus à vingt points. */
  lecture: '<path d="M8 5.4l10 6.6-10 6.6z" fill="currentColor" stroke-linejoin="round"/>',
  pause: '<path d="M8.6 5.6h2.6v12.8H8.6zM12.8 5.6h2.6v12.8h-2.6z" fill="currentColor"/>',
  chevron_bas: '<path d="M6 9.5l6 6 6-6"/>',
  coche: '<path d="M4.5 12.6l4.8 4.8L19.5 7.2"/>',
  cible: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.4"/><path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3"/>',
  maison: '<path d="M3.4 10.6 12 3.8l8.6 6.8V19a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z" '
    + 'stroke-linejoin="round"/><path d="M9.6 20.6v-6h4.8v6"/>',
  /* La carte pliée : trois volets, deux plis. Une punaise aurait redit le
     symbole du lieu, lequel sert déjà à la porte du beau temps. */
  carte: '<path d="M9 4.4 3.4 6.7v12.9L9 17.3l6 2.3 5.6-2.3V4.4L15 6.7z" '
    + 'stroke-linejoin="round"/><path d="M9 4.4v12.9M15 6.7v12.9"/>',
  lieu: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" stroke-linejoin="round"/>'
    + '<circle cx="12" cy="10" r="2.6"/>',
  sans_reseau: '<path d="M2.6 8.8a15 15 0 0 1 6-3.4M15.4 5.4a15 15 0 0 1 6 3.4"/>'
    + '<path d="M6.4 12.6a9.6 9.6 0 0 1 3-1.8M14.6 10.8a9.6 9.6 0 0 1 3 1.8"/>'
    + '<path d="M9.8 16.2a4.6 4.6 0 0 1 4.4 0"/><path d="M12 20v.1"/><path d="M3 3l18 18"/>',
  /* Le parapluie et la capuche, pour le jeton du rappel. Deux dessins distincts
     et non un seul teinté : la couleur ne porte jamais seule l'information. */
  parapluie: '<path d="M12 3.2v1.4"/>'
    + '<path d="M2.8 13.4a9.2 9.2 0 0 1 18.4 0z" stroke-linejoin="round"/>'
    + '<path d="M12 13.4v5.6a2 2 0 0 1-4 0"/>',
  capuche: '<path d="M5 20.4V13a7 7 0 0 1 14 0v7.4"/>'
    + '<path d="M8.6 20.4a3.4 3.4 0 0 1 6.8 0"/>'
    + '<path d="M9.4 7.4a5.6 5.6 0 0 1 5.2 0"/>',
};

/* Le ciel clair et les éclaircies ne se dessinent pas de la même façon selon
   l'heure : un soleil sur une nuit se lit comme une erreur. */
export const icoCiel = (code, jour) => {
  const n = tempsDe(code)[2];
  if (jour) return n;
  return n === "soleil" ? "lune" : n === "soleil_nuage" ? "lune_nuage" : n;
};

export const ico = (n, cls = "bd-ic") =>
  `<svg class="${esc(cls)}" viewBox="0 0 24 24" aria-hidden="true" fill="none" `
  + `stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${D[n] || ""}</svg>`;

/* Symbole de temps en deux tons. Réservé aux endroits qui décrivent le ciel :
   le bandeau, la table de la semaine, la liste des communes. Ailleurs, un
   symbole coloré au milieu d'un texte détournerait le regard. */
/* La taille passe par des attributs, non par la feuille de style : dans un SVG
   imbriqué dans un autre SVG, WebKit ignore `width` et `height` venus du CSS et
   déploie le dessin sur toute la hauteur du parent. Le symbole du ciel occupait
   alors la voie entière et débordait de la carte. */
export const icoTemps = (n, cls = "bd-ic", px = 0) =>
  `<svg class="${esc(cls)} ict ict-${esc(n)}" viewBox="0 0 24 24" aria-hidden="true" `
  + (px ? `width="${px}" height="${px}" ` : "")
  + `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">`
  + `${D[n] || ""}</svg>`;

/* ---------- Les rampes de couleur ----------

   Une couleur ne sert que si elle dit quelque chose. Deux grandeurs seulement
   portent une échelle que tout le monde lit d'un coup d'œil, la température et
   l'indice ultraviolet : elles ont leur rampe. Les autres restent à l'encre du
   texte, et se distinguent par leur forme, leurs symboles et leurs seuils
   nommés.

   La couleur double la valeur, elle ne la remplace jamais : le chiffre et le
   mot sont toujours écrits à côté. */

/* Teinte d'une température, du bleu froid au rouge chaud. Saturation et clarté
   restent constantes pour que la rampe se tienne sur les deux thèmes. */
const ARRETS_T = [[-5, 214], [4, 196], [11, 158], [18, 52], [25, 30], [33, 8]];

const rampe = (arrets, v) => {
  if (v === null || !Number.isFinite(v)) return null;
  let h = arrets[arrets.length - 1][1];
  if (v <= arrets[0][0]) h = arrets[0][1];
  else {
    for (let k = 0; k < arrets.length - 1; k++) {
      const [a0, h0] = arrets[k], [a1, h1] = arrets[k + 1];
      if (v >= a0 && v <= a1) { h = h0 + ((v - a0) / (a1 - a0)) * (h1 - h0); break; }
    }
  }
  return h;
};

export const couleurT = t => {
  const h = rampe(ARRETS_T, t);
  return h === null ? "var(--etiquette-3)" : `hsl(${h.toFixed(0)} 54% 47%)`;
};

/* L'indice ultraviolet suit l'échelle de l'Organisation mondiale de la Santé,
   du vert au rouge. Elle s'arrête au violet à onze ; la métropole n'y monte
   pas, la rampe s'arrête donc au rouge. */
const ARRETS_UV = [[0, 132], [3, 54], [6, 32], [8, 14], [11, 0]];

export const couleurUV = v => {
  const h = rampe(ARRETS_UV, v);
  return h === null ? "var(--etiquette-3)" : `hsl(${h.toFixed(0)} 62% 46%)`;
};
