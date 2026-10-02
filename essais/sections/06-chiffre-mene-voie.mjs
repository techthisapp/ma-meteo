/* Un chiffre mène à sa voie. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Un chiffre mène à sa voie";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet } = T;
  /* Huit tuiles depuis le jalon 11 : sept vers une voie du ruban, celle de l'air
     vers sa feuille. */
  /* Depuis le 30 septembre 2026, la neuvième, l'eau, mène elle aussi à sa feuille. */
  ok("chaque mesure de l'accueil porte une destination",
    await pg.locator(".bd-m[data-detail]").count() === 7
    && await pg.locator(".bd-m[data-feuille]").count() === 2);
  ok("le grand chiffre et le ciel en portent une aussi",
    await pg.locator(".bd-deg[data-detail]").count() === 1
    && await pg.locator(".bd-ciel[data-detail]").count() === 1);

  await pg.locator('.bd-m[data-detail="uv"]').click();
  await pg.waitForTimeout(900);
  ok("l'écran du temps s'ouvre", (await txt(".titre-ecran h1")) === "Heure par heure", await txt(".titre-ecran h1"));
  ok("l'écriture retenue est le ruban",
    (await pg.locator('.seg [data-ecriture="ruban"]').getAttribute("class") || "").includes("actif"));
  ok("la voie visée est dépliée",
    await pg.locator('.mg-v[data-cle="uv"].mg-grand').count() === 1);
  ok("aucune autre voie n'est dépliée", await pg.locator(".mg-grand").count() === 1);
  ok("la page s'est placée sur la voie", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="uv"]');
    const b = v.getBoundingClientRect();
    return b.top < window.innerHeight && b.bottom > 0;
  }));

  await onglet("accueil");
  await pg.locator(".bd-deg").click();
  await pg.waitForTimeout(900);
  ok("le grand chiffre mène à la température",
    await pg.locator('.mg-v[data-cle="t"].mg-grand').count() === 1);
};
