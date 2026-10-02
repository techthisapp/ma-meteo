/* Réglages en feuille. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Réglages en feuille";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt } = T;
  await pg.locator("#btnReglages").click(); await pg.waitForTimeout(500);
  ok("la feuille des réglages s'ouvre", (await txt("#feuille-titre")).startsWith("Réglages"));
  ok("la feuille longue prend toute la hauteur",
    await pg.locator("#feuille.moyenne").count() === 0);
  ok("les réglages ne portent plus la commune", await pg.locator("#rgQ").count() === 0);
  ok("une seule rangée de liste dans toute l'application",
    await pg.locator(".rg-l, .lum-l").count() === 0
    && await pg.locator("#feuille-corps .rangee").count() >= 3);
  await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
};
