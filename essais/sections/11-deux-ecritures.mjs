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
  /* Depuis le jalon 20, lot 4 : les heures se rangent par moment, une ligne
     par heure, le détail en touchant la ligne. */
  const groupes = await pg.locator(".hl-moment h2").allTextContents();
  ok("la liste range ses heures par moment", groupes.join("/") === "Ce matin/Cet après-midi/Ce soir/Cette nuit/Demain matin",
    groupes.join("/"));
  ok("la liste porte vingt-quatre lignes", await pg.locator(".hl").count() === 24, String(await pg.locator(".hl").count()));
  const h1 = await pg.locator(".hl .hl-h").first().innerText();
  ok("la première ligne est l'heure en cours", h1.trim() === "Maint.", h1);
  /* Une ligne dit l'heure, le ciel et la température ; la pluie seulement
     quand il pleut ; le reste s'ouvre en la touchant. */
  const lignes = await pg.evaluate(() => [...document.querySelectorAll(".hl")].map(d => ({
    pluie: d.querySelector(".hl-p")?.textContent || "", t: d.querySelector(".hl-t")?.textContent || "",
    ouvert: d.open, ic: !!d.querySelector("summary svg") })));
  const pluvieuses = lignes.filter(l => l.pluie).length;
  ok("chaque ligne porte le ciel et la température, la pluie seulement quand il pleut, et reste fermée",
    lignes.every(l => /^-?\d+°$/.test(l.t) && l.ic && !l.ouvert) && pluvieuses > 0 && pluvieuses < 24
    && lignes.filter(l => l.pluie).every(l => /^\d+(,\d)? mm$/.test(l.pluie)), JSON.stringify(lignes.slice(17, 21)));
  await pg.locator(".hl summary").nth(3).click();
  const detail = await pg.evaluate(() => {
    const d = document.querySelectorAll(".hl")[3];
    return { ouvert: d.open, noms: [...d.querySelectorAll(".hl-d dt")].map(x => x.textContent) };
  });
  ok("toucher une heure ouvre le ressenti, la rosée, le vent et l'humidité",
    detail.ouvert && ["Ressenti", "Rosée", "Vent", "Rafales", "Humidité"].every(n => detail.noms.includes(n)), JSON.stringify(detail));
  await pg.locator('[data-ecriture="ruban"]').click();
  await pg.waitForTimeout(420);
};
