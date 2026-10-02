/* La destination Le ciel. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "La destination Le ciel";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet } = T;
  /* Le soleil et la lune sont deux écrans d'une même destination depuis le
     3 septembre 2026. Le sélecteur se pose en tête du contenu, sous le ciel : ces
     deux écrans portent leur titre peint dans le ciel et non dans la coque, où le
     sélecteur de la page « Heure par heure » se range. */
  await pg.locator('[data-onglet="ciel"]').click();
  await pg.waitForTimeout(500);
  /* Trois écrans depuis le 20 septembre 2026 : le Soleil, la Lune et les
     étoiles. */
  ok("la destination porte trois écrans, un seul courant",
    await pg.locator("#ecran [data-ciel]").count() === 3
    && await pg.locator('#ecran [data-ciel][aria-current="true"]').count() === 1,
    `${await pg.locator("#ecran [data-ciel]").count()} segments`);
  ok("le sélecteur ouvre le contenu, sous le ciel",
    await pg.evaluate(() => {
      const seg = document.querySelector("#ecran [data-ciel]")?.closest(".seg");
      const corps = document.querySelector("#ecran .ecran-corps");
      const ciel = document.querySelector("#ecran .plein");
      if (!seg || !corps || !ciel) return "un élément manque";
      if (seg.parentElement !== corps) return "le sélecteur n'est pas dans le contenu";
      if (corps.firstElementChild !== seg) return "le sélecteur n'ouvre pas le contenu";
      if (seg.getBoundingClientRect().top < ciel.getBoundingClientRect().bottom - 0.5) {
        return "le sélecteur passe sur le ciel";
      }
      return "";
    }) === "");
  await pg.locator('[data-ciel="lune"]').click();
  await pg.waitForTimeout(500);
  ok("le sélecteur ouvre l'autre écran",
    await pg.locator("#ecran #ptLune").count() === 1
    && await pg.locator("#ecran #ptSoleil").count() === 0,
    `${await pg.locator("#ecran #ptLune").count()} lune, `
    + `${await pg.locator("#ecran #ptSoleil").count()} soleil`);

  /* Le choix se garde, comme l'écriture de la page « Heure par heure » : revenir sur Le ciel
     rend l'écran qu'on regardait, non le premier des deux. */
  await onglet("accueil");
  await pg.locator('[data-onglet="ciel"]').click();
  await pg.waitForTimeout(500);
  ok("le choix se garde d'une visite à l'autre",
    await pg.locator("#ecran #ptLune").count() === 1,
    await txt("#ecran .plein-titre"));
  ok("et il est gardé sur l'appareil",
    await pg.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").ciel === "lune"));
  await pg.locator('[data-ciel="soleil"]').click();
  await pg.waitForTimeout(500);
};
