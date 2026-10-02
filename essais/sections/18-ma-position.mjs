/* Ma position. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Ma position";
export const avecPage = true;

export default async T => {
  const { pg, ok, appelsTous, txt, reposer } = T;
  // L'état de départ : la feuille des lieux ouverte.
  await pg.locator("#navLieu").click();
  await pg.waitForTimeout(900);
  // L'appareil se tient à Grenoble : le relevé doit y mener et la feuille se fermer.
  const avantPos = appelsTous.length;
  await pg.locator("#coPos").click();
  await reposer(pg, 2250);
  ok("l'appui sur Ma position ferme la feuille",
    await pg.locator("#feuille:visible").count() === 0);
  ok("la position devient le lieu courant",
    (await txt("#navLieuNom")) === "Grenoble", await txt("#navLieuNom"));
  ok("la barre de tête porte la cible en mode position",
    await pg.locator("#navPos:visible").count() === 1);
  /* Depuis la version 123, le lieu courant porte la position arrondie au
     centième de degré, et le relevé précis reste sur l'appareil. */
  ok("la prévision est relue pour la position", await pg.evaluate(() => {
    const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
    return g.auto === true && g.lat === 45.19 && Math.abs(g.releve?.lat - 45.1885) < 0.001;
  }));
  /* Audit du 1er octobre 2026, constat 2.2 : les services ne reçoivent que la
     position arrondie, au kilomètre pour la prévision, à cent mètres pour le
     service d'adresses ; le relevé précis ne part jamais. Le faux service
     d'adresses place la commune de Grenoble aux mêmes coordonnées que le relevé :
     une commune choisie garde ses coordonnées, qui sont publiques. Le contrôle
     juge donc les seules requêtes du lieu courant parties après l'appui sur
     Ma position : prévision, ensemble, air et nom de la position. */
  const duLieu = appelsTous.slice(avantPos).filter(u => (/api\.open-meteo\.com\/v1\/forecast/.test(u) && /&(daily|hourly)=/.test(u))
    || /ensemble-api|air-quality-api/.test(u) || /api-adresse\.data\.gouv\.fr\/reverse/.test(u));
  ok("les services ne reçoivent que la position arrondie",
    duLieu.some(u => u.includes("open-meteo.com") && u.includes("latitude=45.19&"))
    && duLieu.some(u => u.includes("/reverse/") && u.includes("lat=45.189&"))
    && !duLieu.some(u => /45\.1885|5\.7245/.test(u)),
    duLieu.filter(u => /45\.18/.test(u)).map(u => u.slice(0, 90)).slice(0, 4).join(" "));

  await pg.locator("#navLieu").click();
  await reposer(pg, 1800);
  ok("Ma position porte la coche",
    await pg.locator('.co-pos .co-l[aria-current="true"]').count() === 1);
  ok("aucune autre rangée ne porte la coche",
    await pg.locator('.co-l[aria-current="true"]').count() === 1);
  ok("Ma position porte la température du moment",
    /^\d+°$/.test((await txt(".co-pos .co-d")).trim()), await txt(".co-pos .co-d"));
  /* Le symbole de ciel de la liste est monochrome : posé sur un ciel peint, un
     dessin bicolore ne se détacherait plus. */
  ok("le relevé pris, la cible passe dans le titre",
    await pg.locator(".co-pos .co-cible").count() === 1
    && await pg.locator(".co-pos .co-ic svg").count() === 1
    && await pg.locator(".co-pos .co-ic .ict").count() === 0);
  ok("Ma position nomme la commune relevée",
    (await txt(".co-pos .co-t em")).includes("Grenoble"), await txt(".co-pos .co-t em"));
  ok("le relevé n'ajoute pas de commune suivie",
    await pg.locator(".co:not(.co-pos)").count() === 1,
    String(await pg.locator(".co:not(.co-pos)").count()));

  // Choisir une commune quitte le mode position : les deux ne peuvent pas tenir ensemble.
  await pg.locator(".co:not(.co-pos) .co-l").first().click();
  await reposer(pg, 1800);
  ok("choisir une commune quitte le mode position",
    await pg.locator("#navPos:visible").count() === 0);
  ok("la commune choisie redevient courante",
    (await txt("#navLieuNom")).includes("Fain"), await txt("#navLieuNom"));

  await pg.locator("#navLieu").click();
  await reposer(pg, 1800);
  ok("le dernier relevé reste servi hors mode position",
    (await txt(".co-pos .co-t em")).includes("Grenoble"), await txt(".co-pos .co-t em"));
  ok("Ma position ne porte plus la coche",
    await pg.locator('.co-pos .co-l[aria-current="true"]').count() === 0);
  await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
};
