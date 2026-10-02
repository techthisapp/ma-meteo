/* Sources coupées. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Sources coupées";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt } = T;
  ok("aucune ligne de vigilance sur l'accueil", await pg.locator(".al.v-2, .al.v-3, .al.v-4").count() === 0);
  ok("l'application reste utilisable", await pg.locator(".bd-deg").count() === 1);
  ok("l'accueil ne parle pas de mesure au poste",
    !(await txt("#ecran")).toLowerCase().includes("pluie mesurée"));
};
