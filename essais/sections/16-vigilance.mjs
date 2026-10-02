/* Vigilance. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Vigilance";
export const avecPage = true;

export default async T => {
  const { pg, etat, ok, txt, onglet, nav, brancherRoutes, ouvrirPage, reposer } = T;
  await onglet("accueil");
  await pg.waitForTimeout(500);

  /* Le panneau ne paraît que s'il y a quelque chose à signaler, et il paraît alors
     en premier : une vigilance orange ne se lit pas après la température. */
  ok("le panneau de vigilance paraît", await pg.locator("#ecran .vg").count() === 1);
  ok("il vient avant tout le reste du corps", await pg.evaluate(() => {
    const c = document.querySelector("#ecran .ecran-corps");
    return c && c.firstElementChild && c.firstElementChild.classList.contains("vg");
  }));
  /* Le panneau porte son titre lui-même : un titre de section au-dessus d'une
     carte qui dit déjà « soyez attentif » annonçait deux fois la même chose et
     repoussait le bloc du jour hors de la première vue. */
  ok("il écrit le niveau en toutes lettres, non par la seule couleur",
    /Vigilance orange/i.test(await txt("#ecran .vg-txt b")), await txt("#ecran .vg-txt b"));
  ok("le mot vigilance ne s'écrit qu'une fois dans la tête",
    ((await txt("#ecran .vg-txt")).toLowerCase().match(/vigilance/g) || []).length === 1,
    await txt("#ecran .vg-txt"));
  ok("le panneau ne porte pas de titre de section au-dessus de lui",
    await pg.locator("#ecran .vg h2").count() === 0);

  /* Quel bulletin le panneau porte se lisait dans la feuille seulement. Un
     panneau ouvert le matin ne se distinguait pas d'un panneau de la veille. La
     publication se faisant à 06 h et à 16 h, l'heure ronde suffit à dire lequel
     des deux est en main ; la minute exacte de la révision reste dans la
     feuille. */
  ok("la tête dit quel bulletin elle porte",
    /bulletin de 06 h/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));
  ok("les faits d'horloge tiennent leur propre ligne sous la conduite",
    /^jusqu'à 20 h, bulletin de 06 h$/.test((await txt("#ecran .vg-q")).trim()),
    await txt("#ecran .vg-q"));

  /* Le panneau prend la tête de l'écran : ce qui le suit doit rester visible sans
     défiler. C'est le bloc du jour et ses quatre mesures, non ses faits, qui doit
     tenir au-dessus de la barre d'onglets.

     Une enveloppe de cent cinquante points a longtemps gardé ce budget. Elle a
     cédé quand la tête a pris sa ligne d'horloge, « jusqu'à 20 h, bulletin de
     06 h » : le panneau mesure alors cent soixante et un points et le bloc du
     jour garde cinquante-six points de dégagement. Le nombre gardait une
     conséquence, c'est elle qu'on mesure désormais, avec un plafond large pour
     arrêter un emballement que l'écran de huit cent quarante-quatre points ne
     verrait pas. */
  /* Jalon 10, le 23 septembre 2026 : sous un avis, c'est la bande horaire qui
     doit rester dans le premier écran, puisqu'elle porte l'évolution du jour ;
     les chiffres du jour la suivent. Les trois gardes qui suivent mesuraient le
     bloc des chiffres et mesurent désormais la bande, heures, trait et vent. */
  ok("le panneau de vigilance ne repousse pas la bande horaire hors de la vue",
    await pg.evaluate(() => {
      const m = document.querySelector("#ecran #bande .bande-defil");
      const o = document.getElementById("onglets");
      if (!m || !o) return "élément manquant";
      const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
      const h = document.querySelector("#ecran .vg").getBoundingClientRect().height;
      if (h > 180) return `panneau de ${h.toFixed(0)} points`;
      return reste >= 0 ? "" : `${reste.toFixed(0)} points sous la bande`;
    }) === "", await pg.evaluate(() =>
      `${document.querySelector("#ecran .vg").getBoundingClientRect().height.toFixed(0)} points`));

  ok("la bande horaire tient dans la première vue malgré la vigilance",
    await pg.evaluate(() => {
      const m = document.querySelector("#ecran #bande .bande-defil");
      const o = document.getElementById("onglets");
      if (!m || !o) return "élément manquant";
      const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
      return reste >= 0 ? "" : `${reste.toFixed(0)} points sous la bande`;
    }) === "", await pg.evaluate(() => {
      const m = document.querySelector("#ecran #bande .bande-defil");
      const o = document.getElementById("onglets");
      return m && o
        ? `${(o.getBoundingClientRect().top - m.getBoundingClientRect().bottom).toFixed(0)} points`
        : "élément manquant";
    }));
  ok("il porte la conduite à tenir",
    /vigilant/i.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));
  /* La borne de la tête est la fin du phénomène qui va le plus loin, non la fin de
     validité du bulletin. Les orages tiennent jusqu'à 20 h, le bulletin jusqu'à
     minuit : écrire « jusqu'à demain 00 h » au-dessus d'une ligne qui dit
     « jusqu'à 20 h » se contredit, et « bulletin valable jusqu'à » est de
     l'administration. */
  ok("la borne de la tête est celle du phénomène, non celle du bulletin",
    /jusqu'à 20 h/.test(await txt("#ecran .vg-txt"))
    && !/00 h/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));
  /* Le numéro de département ne se lit pas : « Côte-d'Or » dit ce que « 21 » cache. */
  ok("il nomme le département plutôt que de le numéroter",
    /Côte-d'Or/.test(await txt("#ecran .vg-txt"))
    && !/Département 21/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));

  /* La garde du bulletin se cale sur la publication, à 06 h et à 16 h en heure
     locale, non sur une durée fixe. Un quart d'heure relisait quarante fois dans
     une journée qui ne bougeait pas, et servait encore le bulletin de la veille
     un quart d'heure après la publication du matin.

     Les cinq cas se lisent sur la fonction elle-même : le rendu ne saurait les
     montrer, l'horloge des contextes étant figée. */
  const gardeV = await pg.evaluate(async () => {
    const V = await import("/src/vigilance.js");
    const t = (j, h, m = 0) => new Date(2026, 7, j, h, m, 0, 0).getTime();
    const bul = (maj, fin) => ({ update_time: maj / 1000, end_validity_time: fin / 1000 });
    return {
      matin: V.jusqua(bul(t(18, 6, 4), t(19, 0)), t(18, 9)) === t(18, 16),
      soir: V.jusqua(bul(t(18, 16, 4), t(20, 0)), t(18, 17)) === t(19, 6),
      validite: V.jusqua(bul(t(18, 6, 4), t(18, 12)), t(18, 9)) === t(18, 12),
      remplace: V.jusqua(bul(t(18, 5, 50), t(19, 0)), t(18, 9)) === t(18, 9) + 5 * 60000,
      muet: V.jusqua(null, t(18, 9)) === t(18, 9) + 15 * 60000,
    };
  });
  ok("une charge lue le matin est gardée jusqu'à la publication de 16 h", gardeV.matin);
  ok("une charge lue le soir est gardée jusqu'à celle de 06 h", gardeV.soir);
  ok("une fin de validité plus proche que la borne ferme la garde plus tôt", gardeV.validite);
  ok("un bulletin révisé avant la dernière borne franchie ne tient que le plancher",
    gardeV.remplace);
  ok("un service muet garde son quart d'heure", gardeV.muet);
  /* Un chargement d'écran ne demande chaque échéance qu'une fois. La garde est
     posée par échéance : sans elle, ou avec deux lectures déclenchées au
     démarrage, la source recevrait le double. */
  ok("un chargement ne demande chaque échéance qu'une fois",
    etat.appelsVig.length === 2 && etat.appelsVig.includes("21|J0") && etat.appelsVig.includes("21|J1"),
    etat.appelsVig.join(" "));

  /* Chaque phénomène signalé se décrit : son nom, son niveau écrit, sa fenêtre.
     Le vert n'est pas une vigilance et ne doit pas remonter. */
  const vgA = await pg.locator("#ecran .vg-a").allInnerTexts();
  ok("les deux phénomènes signalés sont décrits", vgA.length === 2, vgA.join(" | "));
  ok("le plus grave passe devant", /Orages/.test(vgA[0] || ""), vgA.join(" | "));
  ok("chaque ligne écrit son niveau et sa fenêtre",
    vgA.every(t => /(jaune|orange|rouge)/.test(t) && /\d+ h/.test(t)), vgA.join(" | "));
  ok("les phénomènes au vert ne remontent pas",
    !vgA.some(t => /(Pluie|Neige|Canicule)/.test(t)), vgA.join(" | "));
  /* Deux plages contiguës de même couleur ne font qu'une : la source les découpe
     sur ses propres bornes, qui ne sont pas celles du phénomène. */
  ok("les plages contiguës de même couleur sont fondues",
    /de 14 h à 18 h/.test(vgA.find(t => /Vent/.test(t)) || ""), vgA.join(" | "));

  await pg.locator("#ecran .vg-c").click(); await pg.waitForTimeout(500);
  ok("le panneau ouvre le détail", (await txt("#feuille-titre")).startsWith("Vigilance"));
  const lien = pg.locator("#feuille-corps a.lien-plein");
  ok("un lien plein est proposé", await lien.count() === 1);
  const href = await lien.getAttribute("href");
  ok("il pointe vers la page du département sur Météo-France",
    href === "https://vigilance.meteofrance.fr/fr/cote-d-or", href);
  ok("il s'ouvre hors de l'application", await lien.getAttribute("target") === "_blank"
    && /noopener/.test(await lien.getAttribute("rel") || ""));
  ok("le détail reprend les phénomènes", await pg.locator("#feuille-corps .vg-r").count() === 2);
  ok("le détail nomme sa source",
    /Météo-France/.test(await txt("#feuille-corps")));
  ok("le détail nomme le département",
    /Côte-d'Or/.test(await txt("#feuille-titre")), await txt("#feuille-titre"));

  ok("la feuille courte prend l'accroche intermédiaire",
    await pg.locator("#feuille.moyenne").count() === 1);

  /* Audit du 1er octobre 2026, constat 2.6 : le jeton public de Météo-France
     révoqué. Le service répond 401 à tout. Le panneau reste absent, comme un
     jour calme, mais le pied de l'accueil, les réglages et la légende de la
     carte disent la vigilance non lue ; la pluie dans l'heure passe au repli
     d'un modèle et le dit. */
  const { FAIN, amorce } = await import("../faux-services.mjs");
  const ctxMuet = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxMuet.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxMuet);
  await ctxMuet.route(/webservice\.meteofrance\.com/, r => r.fulfill({ status: 401, contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" }, body: '{"code":"401","message":"Invalid token"}' }));
  etat.profilRepli = "debut";
  const pgMuet = await ctxMuet.newPage();
  await ouvrirPage(pgMuet);
  await reposer(pgMuet, 2500);
  const muetDit = await pgMuet.evaluate(() => ({
    panneau: document.querySelectorAll("#ecran .vg").length,
    pied: document.querySelector(".pied-vig")?.textContent || "",
    repli: document.querySelector(".pp-repli")?.textContent || "",
  }));
  await pgMuet.locator("#btnReglages").click();
  await pgMuet.waitForTimeout(500);
  const sourcesDit = await pgMuet.evaluate(() => [...document.querySelectorAll("#feuille-corps .rangee")]
    .find(r => /^Vigilance/.test(r.querySelector(".rangee-txt")?.textContent || ""))?.querySelector(".rangee-val")?.textContent || "");
  await pgMuet.locator("#feuille-fermer").click();
  await pgMuet.waitForTimeout(400);
  await pgMuet.locator('[data-onglet="carte"]').click();
  await reposer(pgMuet, 1500);
  await pgMuet.locator("#caCouches").click();
  await pgMuet.waitForTimeout(200);
  if (await pgMuet.locator("#caVigi").getAttribute("aria-checked") !== "true") await pgMuet.locator("#caVigi").click();
  await reposer(pgMuet, 1500);
  const legendeDit = await pgMuet.evaluate(() => document.getElementById("caCredit")?.textContent || "");
  await ctxMuet.close();
  etat.profilRepli = "sec";
  ok("un service de Météo-France muet se dit à l'accueil, dans les réglages et sur la carte, et la pluie dit son repli",
    muetDit.panneau === 0 && /Vigilance Météo-France non lue.*le service ne répond pas/.test(muetDit.pied)
    && /non lue/.test(sourcesDit) && /Vigilance Météo-France indisponible/.test(legendeDit)
    && /Estimation d'un modèle/.test(muetDit.repli),
    JSON.stringify({ ...muetDit, sourcesDit, legendeDit }));
  ok("un service qui répond ne fait rien dire de tel",
    await pg.locator(".pied-vig").count() === 0);
};
