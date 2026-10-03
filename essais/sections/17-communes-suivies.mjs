/* Communes suivies. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Communes suivies";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet, reposer } = T;
  await onglet("accueil");

  // Premier geste : le titre d'écran.
  await pg.locator("#navLieu").click();
  await pg.waitForTimeout(900);
  ok("le titre d'écran ouvre la feuille des lieux",
    (await txt("#feuille-titre")).startsWith("Mes lieux"), await txt("#feuille-titre"));
  ok("la commune courante est suivie", await pg.locator(".co:not(.co-pos)").count() === 1);
  ok("la commune courante porte une coche",
    await pg.locator('.co-l[aria-current="true"] .co-coche').count() === 1);
  ok("chaque rangée porte la température du moment",
    /^\d+°$/.test((await txt(".co:not(.co-pos) .co-d")).trim()), await txt(".co:not(.co-pos) .co-d"));
  ok("chaque rangée porte les bornes du jour",
    /\d+° à \d+°/.test(await txt(".co:not(.co-pos) .co-t em")), await txt(".co:not(.co-pos) .co-t em"));
  ok("chaque rangée porte un symbole de ciel",
    await pg.locator(".co:not(.co-pos) .co-ic svg").count() === 1);

  // Ma position tient la tête de liste et ne se retire pas.
  ok("Ma position est épinglée en tête", await pg.locator(".co-liste .co").first()
    .evaluate(e => e.classList.contains("co-pos")));
  ok("Ma position ne se retire pas", await pg.locator(".co-pos .co-x").count() === 0);
  ok("sans relevé, la cible tient la place du symbole",
    await pg.locator(".co-pos .co-ic svg").count() === 1
    && await pg.locator(".co-pos .co-cible").count() === 0);
  ok("sans relevé, Ma position invite à le prendre",
    (await txt(".co-pos .co-t em")).includes("Relever"), await txt(".co-pos .co-t em"));
  ok("le bouton de position redondant a disparu", await pg.locator("#rgGeo").count() === 0);

  /* Chaque rangée porte le ciel de son lieu : la même image qu'en fond d'accueil
     là-bas, un bleu contre un gris. */
  ok("chaque rangée porte le ciel de son lieu", await pg.evaluate(() => {
    const co = [...document.querySelectorAll(".co:not([data-plat])")];
    return co.length > 0 && co.every(e => {
      const f = e.style.getPropertyValue("--co-haut").trim();
      return /^rgb\(\d+,\d+,\d+\)$/.test(f);
    });
  }));
  ok("le ciel d'une rangée n'est pas le fond de la carte", await pg.evaluate(() => {
    const l = document.querySelector(".co:not([data-plat]) .co-l");
    return l && getComputedStyle(l).backgroundImage.includes("gradient");
  }));

  /* Ajouter ne vit plus au bas de la liste : c'est une action, elle se range dans
     la tête de feuille, à droite du titre. */
  ok("l'ajout se range derrière un bouton dans la tête",
    await pg.locator("#feuille-action .feuille-plus").count() === 1);
  ok("le champ d'ajout n'encombre plus la liste",
    await pg.locator("#feuille-corps #rgQ").count() === 0);
  await pg.locator("#feuille-action .feuille-plus").click();
  await pg.waitForTimeout(700);
  ok("le bouton pousse la feuille d'ajout",
    (await txt("#feuille-titre")).startsWith("Ajouter"), await txt("#feuille-titre"));
  ok("le retour ramène à Mes lieux", await pg.locator("#feuille-retour:visible").count() === 1);

  ok("le champ de commune porte une étiquette visible",
    await pg.locator('label[for="rgQ"]:visible').count() === 1);
  await pg.locator("#rgQ").fill("Zzzz");
  await pg.waitForTimeout(900);
  ok("l'erreur paraît sous le champ, non dans la liste",
    await pg.locator("#rgErr:visible").count() === 1
    && await pg.locator("#rgRes button").count() === 0);
  ok("le champ est marqué invalide", await pg.getAttribute("#rgQ", "aria-invalid") === "true");
  await pg.locator("#rgQ").fill("Grenoble");
  await pg.waitForTimeout(900);
  ok("l'erreur disparaît à la correction", await pg.locator("#rgErr:visible").count() === 0);
  ok("la recherche propose la commune", await pg.locator("#rgRes button").count() === 1);

  // Ajouter une commune la rend courante et ferme la feuille.
  await pg.locator("#rgRes button").first().click();
  await reposer(pg, 1800);
  ok("l'ajout ferme la feuille", await pg.locator("#feuille:visible").count() === 0);
  ok("la commune ajoutée devient courante",
    (await txt("#navLieuNom")) === "Grenoble", await txt("#navLieuNom"));

  // Deuxième passage : deux communes, bascule en deux gestes.
  await pg.locator("#navLieu").click();
  await pg.waitForTimeout(900);
  ok("les deux communes sont suivies", await pg.locator(".co:not(.co-pos)").count() === 2,
    String(await pg.locator(".co:not(.co-pos)").count()));
  const nomsCo = (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",");
  ok("la dernière choisie est en tête", nomsCo.startsWith("Grenoble"), nomsCo);

  /* Réordonner. Au clavier d'abord, qui est le chemin d'un lecteur d'écran, puis
     au doigt par appui long. L'ordre tient au rechargement : il est écrit. */
  const avantOrdre = (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",");
  ok("deux lieux avant de réordonner", (await pg.locator(".co:not(.co-pos)").count()) === 2,
    avantOrdre);
  ok("chaque lieu porte de quoi monter et descendre",
    await pg.locator(".co:not(.co-pos) [data-monter]").count() === 2
    && await pg.locator(".co:not(.co-pos) [data-descendre]").count() === 2);
  ok("les commandes d'ordre ne se voient qu'au focus", await pg.evaluate(() => {
    const o = document.querySelector(".co-ordre");
    return parseFloat(getComputedStyle(o).opacity) === 0;
  }));
  await pg.locator(".co:not(.co-pos)").nth(1).locator("[data-monter]").focus();
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(700);
  const apresOrdre = (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",");
  ok("monter échange les deux lieux",
    apresOrdre === avantOrdre.split(",").reverse().join(","), `${avantOrdre} -> ${apresOrdre}`);
  ok("le nouvel ordre est écrit", await pg.evaluate(nom => {
    const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
    return (g.suivies[0].commune || "").startsWith(nom);
  }, apresOrdre.split(",")[0].slice(0, 5)));
  /* Le premier lieu ne peut pas monter, le dernier ne peut pas descendre : la
     commande ne fait rien plutôt que de sortir de la liste. */
  await pg.locator(".co:not(.co-pos)").first().locator("[data-monter]").focus();
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(500);
  ok("le premier lieu ne sort pas de la liste par le haut",
    (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",") === apresOrdre);
  ok("Ma position ne se réordonne pas",
    await pg.locator(".co-pos .co-ordre").count() === 0);
  await pg.locator(".co:not(.co-pos)").first().locator("[data-descendre]").focus();
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(700);
  ok("descendre rétablit l'ordre",
    (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",") === avantOrdre);

  /* L'appui long soulève la rangée. Un déplacement avant la fin du délai annule
     la prise, sans quoi le glissement de retrait n'aurait plus son geste. */
  const bRang = await pg.locator(".co:not(.co-pos)").first().boundingBox();
  await pg.mouse.move(bRang.x + 120, bRang.y + bRang.height / 2);
  await pg.mouse.down();
  await pg.waitForTimeout(450);
  ok("l'appui long soulève la rangée",
    await pg.locator(".co-prise").count() === 1);
  await pg.mouse.move(bRang.x + 120, bRang.y + bRang.height * 1.7, { steps: 8 });
  await pg.waitForTimeout(200);
  /* La rangée prise suit le doigt au lieu de sauter de place en place : son
     milieu reste sous le pointeur, à quelques points près. */
  const suitDoigt = await pg.evaluate(y => {
    const e = document.querySelector(".co-prise");
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { ecart: Math.round(Math.abs(b.top + b.height / 2 - y)), transforme: /translateY/.test(e.style.transform) };
  }, bRang.y + bRang.height * 1.7);
  ok("la rangée prise suit le doigt", suitDoigt && suitDoigt.transforme && suitDoigt.ecart <= 24, JSON.stringify(suitDoigt));
  ok("le déplacement change l'ordre en direct",
    (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",")
      === avantOrdre.split(",").reverse().join(","),
    (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(","));
  await pg.mouse.up();
  await pg.waitForTimeout(700);
  ok("le lâcher repose la rangée", await pg.locator(".co-prise").count() === 0);
  ok("l'appui long n'a pas basculé de lieu",
    await pg.locator("#feuille:visible").count() === 1);
  ok("l'ordre déplacé au doigt est écrit", await pg.evaluate(() => {
    const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
    return g.suivies.length === 2;
  }));
  // L'ordre rétabli, la suite des contrôles repart de la même liste.
  await pg.locator(".co:not(.co-pos)").nth(1).locator("[data-monter]").focus();
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(600);
  ok("l'ordre est rétabli pour la suite",
    (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",") === avantOrdre);

  await pg.locator(".co:not(.co-pos)").nth(1).locator(".co-l").click();
  await reposer(pg, 1800);
  ok("un appui sur une rangée bascule de commune",
    (await txt("#navLieuNom")).includes("Fain"), await txt("#navLieuNom"));
  ok("la bascule ferme la feuille", await pg.locator("#feuille:visible").count() === 0);

  /* Renommer, version 147, demande de Jérôme : le nom choisi remplace la
     commune dans la barre de tête et la liste, la commune reste écrite
     dessous ; un nom vide rend le nom de la commune. La saisie passe par la
     boîte du système, remplacée ici. */
  await pg.locator("#navLieu").click();
  await pg.waitForTimeout(900);
  const renommer = async v => {
    await pg.evaluate(v => { window.prompt = () => v; }, v);
    const cle = await pg.evaluate(() => [...document.querySelectorAll(".co:not(.co-pos)")]
      .find(e => /Fain|Maison/.test(e.querySelector(".co-t b").textContent))?.dataset.cle);
    await pg.locator(`.co[data-cle="${cle}"] .co-r`).focus();
    await pg.keyboard.press("Enter");
    await reposer(pg, 1200);
    return pg.evaluate(async () => {
      const R = await import("/src/reglages.js");
      const co = [...document.querySelectorAll(".co:not(.co-pos)")].find(e => /Fain|Maison/.test(e.querySelector(".co-t b").textContent));
      return { tete: document.getElementById("navLieuNom").textContent, rangee: co?.querySelector(".co-t b").textContent,
        sous: co?.querySelector(".co-t em").textContent, nom: R.lire().nom, suivie: R.suivies().find(l => /Fain/.test(l.commune))?.nom };
    });
  };
  const renomme = await renommer("  Maison  ");
  const rendu = await renommer("");
  await pg.locator("#feuille-fermer").click();
  await pg.waitForTimeout(500);
  ok("un lieu se renomme, sa commune restant écrite dessous, et un nom vide rend celui de la commune",
    renomme.tete === "Maison" && renomme.rangee === "Maison" && /Fain-lès-Moutiers/.test(renomme.sous)
    && renomme.nom === "Maison" && renomme.suivie === "Maison"
    && rendu.tete === "Fain-lès-Moutiers" && rendu.rangee === "Fain-lès-Moutiers" && rendu.suivie === null,
    JSON.stringify({ renomme, rendu }));

  // Retrait : le bouton reste atteignable au clavier, sous la rangée.
  await pg.locator("#navLieu").click();
  await pg.waitForTimeout(900);
  ok("le retrait est atteignable sans glissement",
    await pg.locator(".co-x").count() === 2);
  ok("le retrait se tient sous la rangée, non à côté", await pg.evaluate(() => {
    const co = document.querySelector(".co:not(.co-pos)");
    const l = co.querySelector(".co-l").getBoundingClientRect();
    const x = co.querySelector(".co-x").getBoundingClientRect();
    return x.right <= l.right + 1 && x.left >= l.left;
  }));
  /* Le bouton se tient sous la rangée : le clavier l'atteint, et le focus
     découvre la rangée. C'est le chemin qu'emprunte un lecteur d'écran. */
  await pg.locator('.co[data-cle^="45.18"] .co-x').focus();
  await pg.waitForTimeout(300);
  ok("le focus découvre la rangée", await pg.evaluate(() => {
    const l = document.querySelector('.co[data-cle^="45.18"] .co-l');
    return /translate/.test(l.style.transform || "");
  }));
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(900);
  ok("la commune retirée quitte la liste", await pg.locator(".co:not(.co-pos)").count() === 1);
  ok("la commune courante n'a pas changé",
    (await txt("#navLieuNom")).includes("Fain"), await txt("#navLieuNom"));

  ok("l'état désactivé neutralise le contrôle", await pg.evaluate(() => {
    const b = document.getElementById("coPos");
    b.disabled = true;
    const s = getComputedStyle(b);
    const r = s.pointerEvents === "none" && parseFloat(s.opacity) < 1;
    b.disabled = false;
    return r;
  }));
};
