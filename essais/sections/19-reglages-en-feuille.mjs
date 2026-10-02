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

  /* Audit du 1er octobre 2026, constat 4.6 : le focus au clavier. La feuille
     ouverte prend le focus et rend le reste de la page inerte ; un réglage qui
     refait la feuille garde le focus sur son bouton ; Échap rend le focus au
     bouton qui avait ouvert la feuille. */
  await pg.locator("#btnReglages").focus();
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(500);
  const ouvert = await pg.evaluate(() => ({
    dans: document.getElementById("feuille").contains(document.activeElement),
    inerte: document.getElementById("ecran").inert && document.getElementById("onglets").inert,
  }));
  const ecritures = await pg.locator("#feuille-corps [data-ecriture]").count();
  let garde = "aucun bouton d'écriture";
  if (ecritures) {
    const cle = await pg.locator("#feuille-corps [data-ecriture]").last().getAttribute("data-ecriture");
    await pg.locator(`#feuille-corps [data-ecriture="${cle}"]`).focus();
    await pg.keyboard.press("Enter");
    await pg.waitForTimeout(300);
    /* Une sélection qui refait la feuille : le dernier menu d'heure d'alerte. */
    await pg.evaluate(() => {
      const m = document.querySelector("#feuille-corps .rg-h");
      if (m) { m.focus(); m.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    await pg.waitForTimeout(300);
    garde = await pg.evaluate(() => {
      const a = document.activeElement;
      return a && a !== document.body && document.getElementById("feuille").contains(a) ? "" : `focus sur ${a?.tagName || "rien"}`;
    });
  }
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(500);
  const ferme = await pg.evaluate(() => ({
    retour: document.activeElement?.id || document.activeElement?.tagName,
    inerte: document.getElementById("ecran").inert,
  }));
  ok("au clavier, la feuille prend le focus, le garde aux rendus et le rend à son bouton",
    ouvert.dans && ouvert.inerte && garde === "" && ferme.retour === "btnReglages" && !ferme.inerte,
    JSON.stringify({ ...ouvert, garde, ...ferme }));
};
