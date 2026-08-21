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
  chevron_bas: '<path d="M6 9.5l6 6 6-6"/>',
  coche: '<path d="M4.5 12.6l4.8 4.8L19.5 7.2"/>',
  cible: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.4"/><path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3"/>',
  maison: '<path d="M3.4 10.6 12 3.8l8.6 6.8V19a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z" '
    + 'stroke-linejoin="round"/><path d="M9.6 20.6v-6h4.8v6"/>',
  lieu: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" stroke-linejoin="round"/>'
    + '<circle cx="12" cy="10" r="2.6"/>',
  sans_reseau: '<path d="M2.6 8.8a15 15 0 0 1 6-3.4M15.4 5.4a15 15 0 0 1 6 3.4"/>'
    + '<path d="M6.4 12.6a9.6 9.6 0 0 1 3-1.8M14.6 10.8a9.6 9.6 0 0 1 3 1.8"/>'
    + '<path d="M9.8 16.2a4.6 4.6 0 0 1 4.4 0"/><path d="M12 20v.1"/><path d="M3 3l18 18"/>',
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
export const icoTemps = (n, cls = "bd-ic") =>
  `<svg class="${esc(cls)} ict ict-${esc(n)}" viewBox="0 0 24 24" aria-hidden="true" `
  + `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">`
  + `${D[n] || ""}</svg>`;
