/* Les moments de l'accueil. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Les moments de l'accueil";
export const avecPage = true;

export default async T => {
  const { pg, ok } = T;
  /* Les moments racontent la journée qui vient, ce qui est l'affaire de
     l'accueil. Ils en ferment le contenu, la vigilance et la source formant la
     clôture. */
  const moTitres = await pg.locator("#ecran .mt-t b").allInnerTexts();
  ok("l'accueil porte les moments", moTitres.length >= 3, moTitres.join(" | "));
  ok("les moments ferment le contenu de l'accueil", await pg.evaluate(() => {
    const mo = document.querySelector("#ecran .mt");
    const re = document.querySelector("#ecran .retenir");
    const pied = document.querySelector("#ecran .pied");
    if (!mo || !re || !pied) return false;
    const apresRetenir = re.compareDocumentPosition(mo) & Node.DOCUMENT_POSITION_FOLLOWING;
    const avantPied = mo.compareDocumentPosition(pied) & Node.DOCUMENT_POSITION_FOLLOWING;
    return Boolean(apresRetenir) && Boolean(avantPied);
  }));

  /* Le nom se dit comme on le dirait à l'oral tant qu'on est dans la journée en
     cours. La nuit qui vient porte la date du lendemain dès minuit passé : elle
     s'appelle pourtant « cette nuit ». Les colonnes suivantes prennent le nom
     court, l'ordre du temps et les heures les situant déjà. */
  ok("les moments du jour se disent au démonstratif",
    moTitres.some(t => /^(Ce matin|Cet après-midi|Ce soir|Cette nuit)$/.test(t)),
    moTitres.join(" | "));
  ok("les moments du lendemain prennent le nom court",
    moTitres.slice(1).every(t =>
      /^(nuit|matin|après-midi|soirée|Cette nuit|Ce matin|Cet après-midi|Ce soir)$/.test(t)),
    moTitres.join(" | "));
  ok("aucun moment ne dit « demain »",
    !moTitres.some(t => /demain/i.test(t)), moTitres.join(" | "));
  ok("la nuit qui vient s'appelle cette nuit",
    moTitres.includes("Cette nuit"), moTitres.join(" | "));

  // Les heures situent la tranche, sous son nom, dans la même colonne.
  ok("chaque moment porte ses heures", await pg.evaluate(() => {
    const e = [...document.querySelectorAll("#ecran .mt-t")];
    return e.length >= 3 && e.every(x => /\d\d-\d\d\s?h/.test(x.textContent));
  }));

  /* Le libellé s'écrit une fois. C'était le défaut du bloc par moment : quatre
     fois « Température », cinq fois « Vent », et six cents points de haut. */
  ok("chaque mesure n'est nommée qu'une fois", await pg.evaluate(() => {
    const l = [...document.querySelectorAll("#ecran .mt-l")]
      .map(e => e.textContent.trim()).filter(Boolean);
    return l.length >= 3 && l.length === new Set(l).size;
  }), (await pg.locator("#ecran .mt-l").allInnerTexts()).join("/"));

  ok("le tableau porte une case par mesure et par moment", await pg.evaluate(() => {
    const t = document.querySelector("#ecran .mt");
    const n = document.querySelectorAll("#ecran .mt-t").length;
    const lignes = document.querySelectorAll("#ecran .mt-l").length;
    // Entête, ciel, puis une ligne par mesure. La ligne du ciel porte un libellé vide.
    return t.children.length === (n + 1) * (lignes + 1);
  }));

  /* Une ligne ne paraît que si un moment au moins a quelque chose à y dire. Une
     ligne entièrement creuse serait un libellé pour rien. */
  ok("aucune ligne n'est creuse de bout en bout", await pg.evaluate(() => {
    const t = document.querySelector("#ecran .mt");
    const n = document.querySelectorAll("#ecran .mt-t").length;
    const cases = [...t.children].slice((n + 1) * 2);
    for (let k = 0; k < cases.length; k += n + 1) {
      const ligne = cases.slice(k + 1, k + 1 + n);
      if (ligne.every(c => c.classList.contains("mt-creux"))) {
        return `${cases[k].textContent} vide`;
      }
    }
    return "";
  }) === "", await pg.evaluate(() => {
    const t = document.querySelector("#ecran .mt");
    const n = document.querySelectorAll("#ecran .mt-t").length;
    const cases = [...t.children].slice((n + 1) * 2);
    const maux = [];
    for (let k = 0; k < cases.length; k += n + 1) {
      if (cases.slice(k + 1, k + 1 + n).every(c => c.classList.contains("mt-creux"))) {
        maux.push(cases[k].textContent);
      }
    }
    return maux.join(" ");
  }));

  // Le tableau tient dans sa carte, sans défilement latéral.
  ok("le tableau des moments tient dans sa carte", await pg.evaluate(() => {
    const t = document.querySelector("#ecran .mt");
    return t.scrollWidth <= t.clientWidth + 1;
  }));

  /* À cinquante points de large, un nom de tranche qui passe à la ligne décale
     toute la ligne d'entête : « après-midi » s'abrège. */
  ok("aucun nom de moment ne passe à la ligne", await pg.evaluate(() =>
    [...document.querySelectorAll("#ecran .mt-t b")]
      .every(e => e.scrollWidth <= e.clientWidth + 1)),
    (await pg.locator("#ecran .mt-t b").allInnerTexts()).join("/"));

  /* Les deux bornes se séparent par une espace, non par un trait : « 13-15° » se
     lit encore, « -3--1° » ne se lit plus. */
  ok("les bornes de température ne se collent pas par un trait", await pg.evaluate(() =>
    [...document.querySelectorAll("#ecran .mt-v")]
      .every(e => !/\d\s*-\s*\d/.test(e.textContent))),
    (await pg.locator("#ecran .mt-v").allInnerTexts()).slice(0, 5).join("/"));

  /* La carte remplaçait cinq blocs de six cents points. Ce contrôle garde le
     gain : elle ne doit pas regrossir sans qu'on s'en aperçoive. */
  ok("la journée qui vient tient sous quatre cents points", await pg.evaluate(() => {
    const c = document.querySelector("#ecran .mt").closest(".carte");
    return c.getBoundingClientRect().height < 400;
  }), String(await pg.evaluate(() =>
    Math.round(document.querySelector("#ecran .mt").closest(".carte").getBoundingClientRect().height))));
};
