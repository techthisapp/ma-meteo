/* Les deux écritures. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Les deux écritures";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet } = T;
  // L'état de départ : « Heure par heure ».
  await onglet("temps");
  /* Le sélecteur se tient sur la ligne du titre : c'est ce qui remonte le ruban
     et la table en haut de la page. */
  ok("le sélecteur d'écriture est sur la ligne du titre",
    await pg.locator(".titre-ecran .te-ligne .seg-menu").count() === 1);
  ok("le sélecteur ne propose que le ruban et la table",
    await pg.locator(".seg-menu [data-ecriture]").count() === 2,
    (await pg.locator(".seg-menu [data-ecriture]").allInnerTexts()).join(" | "));
  ok("le sélecteur reste plus étroit que la moitié de la largeur", await pg.evaluate(() => {
    const g = document.querySelector(".seg-menu");
    return g.getBoundingClientRect().width < window.innerWidth * 0.5;
  }));
  /* Le premier chiffre du ruban doit se voir sans défiler : c'est la raison
     d'être du déplacement. */
  ok("le ruban commence au-dessus de la ligne de flottaison", await pg.evaluate(() => {
    const c = document.querySelector("#ecran .carte");
    return c.getBoundingClientRect().top < 200;
  }, ));
  await pg.locator('[data-ecriture="liste"]').click();
  await pg.waitForTimeout(420);
  ok("la liste porte treize colonnes", await pg.locator(".hh thead th").count() === 13,
    String(await pg.locator(".hh thead th").count()));
  ok("la liste porte vingt-quatre lignes", await pg.locator(".hh tbody tr").count() === 24,
    String(await pg.locator(".hh tbody tr").count()));
  const h1 = await pg.locator(".hh tbody tr").first().locator("td").first().innerText();
  ok("la première ligne est l'heure en cours", h1.trim() === "09 h", h1);
  await pg.locator('[data-ecriture="ruban"]').click();
  await pg.waitForTimeout(420);
};
