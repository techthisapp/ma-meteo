/* L'horizon et le choix du jour. Section de la suite des contrôles, sortie de
   essais/controle.mjs le 2 octobre 2026 ; elle part d'un état neuf préparé par
   essais/banc.mjs. Depuis le jalon 21, lot 2, du 3 octobre 2026, des boutons
   de jour remplacent les deux sauts et le glissement de côté. */

export const titre = "L'horizon glissant";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet, CADRE } = T;
  // L'état de départ : « Heure par heure ».
  await onglet("temps");
  /* La fenêtre porte vingt-quatre heures sur la largeur en portrait, et le dessin
     court au delà, d'une fenêtre de part et d'autre : c'est la réserve que le
     glissement découvre sans avoir à tout redessiner. */
  const choix = () => pg.evaluate(() => {
    const c = document.querySelector("#ecran .carte").getBoundingClientRect();
    const j = [...document.querySelectorAll(".mg-jours .mg-j")];
    return { n: j.length, on: j.filter(b => b.classList.contains("mg-j-on")).map(b => b.getAttribute("aria-label")),
      dedans: j.every(b => { const r = b.getBoundingClientRect(); return r.left >= c.left && r.right <= c.right && r.width >= 40; }),
      /* Le nom du jour le plus à gauche de l'axe. */
      gauche: [...document.querySelectorAll(".mg-bd text.mg-bj")]
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0]?.textContent || "",
      lu: document.querySelector(".mg-lu-h")?.textContent || "" };
  });
  const depart = await choix();
  ok("le choix du jour porte « Maint. » et un bouton par jour, tous visibles sans défiler",
    depart.n >= 6 && depart.dedans && depart.on.join() === "Maintenant" && depart.lu === "Maintenant", JSON.stringify(depart));
  ok("aucun saut ni glissement ne reste", await pg.locator("[data-glisse], .mg-fenl").count() === 0);
  ok("la fenêtre calée garde le passé récent derrière elle", await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
    const l = svg.querySelector(".mg-ici");
    if (!l) return "aucun repère dans le cadre";
    const r = svg.querySelector("defs clipPath rect");
    const f = (Number(l.getAttribute("x1")) - Number(r.getAttribute("x")))
      / Number(r.getAttribute("width"));
    return Math.abs(f - 1 / 6) < 0.02 ? "" : `repère au ${(f * 100).toFixed(0)} centième`;
  }) === "");
  /* Le repère porte une gaine à la couleur de la carte : sans elle il se perdait
     dans les aires pleines et les lavis de nuit qu'il traverse. */
  ok("le repère est gainé et l'axe le nomme d'une pastille", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="t"]');
    if (v.querySelectorAll(".mg-ici-g").length !== 1) return "aucune gaine";
    const g = getComputedStyle(v.querySelector(".mg-ici-g")).strokeWidth;
    const t = getComputedStyle(v.querySelector(".mg-ici")).strokeWidth;
    if (parseFloat(g) <= parseFloat(t)) return `gaine ${g} contre trait ${t}`;
    return document.querySelector(".mg-bd .mg-ici-p") ? "" : "aucune pastille sur l'axe";
  }) === "");
  ok("la fenêtre porte vingt-quatre heures", await pg.evaluate(`(() => {
  const a = document.querySelector(".mg-bd");
  const c = ${CADRE}(a);
  const t = [...a.querySelectorAll("text.mg-bh")].filter(e => {
    const x = e.getBoundingClientRect().left;
    return x >= c.gauche - 1 && x <= c.droite;
  }).map(e => e.textContent);
  /* Une heure toutes les trois heures, minuit portant le nom du jour : six à
     huit dans vingt-quatre heures, selon les bords. */
  return t.length >= 6 && t.length <= 8 ? "" : t.length + " heures : " + t.join("/");
})()`) === "", await pg.evaluate(`(() => {
  const a = document.querySelector(".mg-bd");
  const c = ${CADRE}(a);
  return [...a.querySelectorAll("text.mg-bh")].filter(e => {
    const x = e.getBoundingClientRect().left;
    return x >= c.gauche - 1 && x <= c.droite;
  }).map(e => e.textContent).join("/");
})()`));
  ok("le dessin s'arrête à la fenêtre, à une heure près de chaque côté", await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
    const pl = svg.querySelector("polyline");
    const b = pl.getBBox(), r = svg.querySelector("defs clipPath rect");
    const large = Number(r.getAttribute("width"));
    return b.width <= large * 1.12 ? "" : `tracé de ${b.width.toFixed(0)} pour un cadre de ${large}`;
  }) === "");

  ok("le passé est tracé et mis en retrait",
    await pg.locator('.mg-v[data-cle="t"] .mg-passe').count() === 1);
  ok("l'heure en cours porte son repère",
    await pg.locator('.mg-v[data-cle="t"] .mg-ici').count() === 1);

  /* Un jour choisi cale la fenêtre sur son minuit ; la bulle y lit midi. */
  const echelleDe = () => pg.evaluate(() =>
    [...document.querySelectorAll('.mg-v[data-cle="t"] text.mg-g')]
      .map(e => e.textContent).join("/"));
  const ech0 = await echelleDe();
  await pg.locator(".mg-jours [data-jour]").first().click();
  await pg.waitForTimeout(420);
  const demain = await choix();
  ok("le bouton du lendemain cale la fenêtre sur son minuit et lit son midi",
    /^Demain, /.test(demain.on[0] || "") && demain.gauche === "Demain" && demain.lu === "Demain, 12 h", JSON.stringify(demain));
  ok("l'heure en cours ne se repère pas dans une fenêtre qui ne la contient pas",
    await pg.evaluate(() => {
      const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
      const l = svg.querySelector(".mg-ici");
      if (!l) return "";
      const r = svg.querySelector("defs clipPath rect");
      const g = Number(r.getAttribute("x")), w = Number(r.getAttribute("width"));
      const x = Number(l.getAttribute("x1"));
      return x < g || x > g + w ? "" : `repère à ${x.toFixed(0)} dans le cadre ${g} à ${g + w}`;
    }) === "");
  ok("le passé n'est plus voilé hors de sa journée",
    await pg.locator('.mg-v[data-cle="t"] .mg-passe').count() === 0);
  ok("l'échelle ne bouge pas quand la fenêtre change de jour",
    (await echelleDe()) === ech0, `${ech0} puis ${await echelleDe()}`);

  await pg.locator(".mg-jours [data-jour]").nth(1).click();
  await pg.waitForTimeout(420);
  const loin = await choix();
  ok("au delà de demain, le jour se nomme en entier, sur l'axe comme dans la bulle",
    loin.gauche === "Jeudi 20" && loin.lu === "Jeudi 20, 12 h",
    JSON.stringify(loin));
  ok("la lecture de droite parle de la fenêtre, non de l'horizon", await pg.evaluate(() => {
    const r = document.querySelector('.mg-v[data-cle="t"] .mg-r').textContent;
    const m = r.match(/^(-?\d+) à (-?\d+)°$/);
    if (!m) return r;
    return Number(m[2]) - Number(m[1]) <= 20 ? "" : `amplitude ${m[2] - m[1]}`;
  }) === "", await txt('.mg-v[data-cle="t"] .mg-r'));

  /* Le dernier bouton porte encore une journée entière : l'horizon de la
     charge va jusqu'à son minuit suivant. */
  await pg.locator(".mg-jours [data-jour]").last().click();
  await pg.waitForTimeout(420);
  ok("le dernier jour proposé tient une journée entière dans l'horizon", await pg.evaluate(async () => {
    const R = await import("/src/ruban.js");
    const s = R.serieCourante(), d = R.decalageCourant();
    return s.heure[d] === 0 && d + R.fenetre() <= s.n ? "" : `début ${s.heure[d]} h, ${s.n - d} heures restantes`;
  }) === "");

  /* L'écriture d'échelle ne bouge pas avec le dessin : elle nomme une
     hauteur, laquelle ne dépend pas de l'heure regardée. */
  ok("les noms de seuil et les chiffres restent hors du groupe mobile",
    await pg.evaluate(() => {
      const svg = document.querySelector('.mg-v[data-cle="v"] svg.mg-s');
      const dedans = [...svg.querySelectorAll("text.mg-bn, text.mg-g")]
        .filter(e => e.closest("g.mg-mob"));
      return dedans.length ? `${dedans.length} écritures dans le groupe mobile` : "";
    }) === "");

  await pg.locator(".mg-jours [data-maintenant]").click();
  await pg.waitForTimeout(420);
  const retour = await choix();
  ok("« Maint. » ramène la fenêtre et la lecture à l'heure en cours",
    retour.on.join() === "Maintenant" && retour.lu === "Maintenant" && retour.gauche === "Aujourd'hui", JSON.stringify(retour));

  /* En paysage, la fenêtre double : la densité de points par heure le permet, et
     le ruban n'est pas bridé à la largeur de lecture. */
  await pg.setViewportSize({ width: 844, height: 390 });
  await pg.waitForTimeout(600);
  ok("l'écran du ruban n'est pas bridé", await pg.evaluate(() =>
    document.querySelector("#ecran").classList.contains("ecran-large")
    && getComputedStyle(document.querySelector("#ecran")).maxWidth === "none"));
  ok("le ruban prend la largeur en paysage", await pg.evaluate(() => {
    const w = document.querySelector("#ecran .carte").getBoundingClientRect().width;
    return w > 700 ? "" : `carte de ${w.toFixed(0)} points`;
  }) === "", await pg.evaluate(() =>
    document.querySelector("#ecran .carte").getBoundingClientRect().width.toFixed(0)));
  const fen = () => pg.evaluate(async () => (await import("/src/ruban.js")).fenetre());
  ok("en paysage la fenêtre porte quarante-huit heures", (await fen()) === 48, String(await fen()));
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.waitForTimeout(600);
  ok("de retour en portrait, la fenêtre reprend vingt-quatre heures", (await fen()) === 24, String(await fen()));
};
