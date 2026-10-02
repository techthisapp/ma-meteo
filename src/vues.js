/* Les écrans et les feuilles. Depuis le 2 octobre 2026, chaque écran vit
   dans son fichier sous src/vues/ ; ce module ne fait que relayer les noms
   que l'application et les contrôles importent. docs/plan-decoupage-vues.md. */

export { vueTemps } from "./vues/heures.js";
export { basculerSemaine, semaineEstEtendue, etendreQuotidien, vueSemaine, grapheSemaine, phraseConfiance } from "./vues/avenir.js";
export { vueVigilance } from "./vues/vigilance.js";
export { astresVus, soleilVu, bandeauAccueil, bandesLum, vueSoleil, vueLune, nuitCivile, nuitNoire } from "./vues/astres.js";
export { viseeDe, cielDeLaNuit, luneDeLaNuit, ESSAIMS, prochainEssaim, aVoirCeSoir, vueEtoiles, vueCiel } from "./vues/etoiles.js";
export { vueCarte } from "./vues/carte.js";
export { vueCommunes, vueAjout } from "./vues/lieux.js";
export { vueParapluie, vueActivites, vueAir, vueBeauTemps, vueRessenti, vueReglages } from "./vues/feuilles.js";
export { grapheLieux, grapheComparaison, vueClimat } from "./vues/climat.js";
export { vueNeige, vuePlage, vueEau } from "./vues/loisirs.js";
