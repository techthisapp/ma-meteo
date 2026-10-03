/* L'horizon glissant. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "L'horizon glissant";
export const avecPage = true;

export default async T => {
  const { pg, nav, ok, txt, onglet, CADRE } = T;
  // L'état de départ : « Heure par heure ».
  await onglet("temps");
  /* La fenêtre porte vingt-quatre heures sur la largeur en portrait, et le dessin
     court au delà, d'une fenêtre de part et d'autre : c'est la réserve que le
     glissement découvre sans avoir à tout redessiner. */
  ok("la barre de commande porte ses deux sauts et son libellé",
    await pg.locator(".mg-nav [data-glisse]").count() === 2
    && await pg.locator(".mg-nav .mg-fen").count() === 1);
  ok("le libellé dit la fenêtre lue", (await txt(".mg-fenl")) === "05 h à demain 05 h",
    await txt(".mg-fenl"));

  /* Calée sur maintenant, la fenêtre ne commence pas à l'heure en cours mais un
     sixième avant. Les heures qui viennent de passer sont le premier repère qu'on
     cherche, et le repère de l'heure en cours a besoin de tomber dans le cadre
     pour se voir : collé au bord gauche, il se lisait comme un filet de cadre. */
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
  ok("le dessin déborde le cadre et la découpe le retient", await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
    /* Le groupe mobile, sous un groupe fixe qui porte la découpe. */
    const mob = svg.querySelector("g[clip-path] > g.mg-mob");
    if (!mob) return "aucun groupe découpé";
    const pl = svg.querySelector("polyline");
    const b = pl.getBBox(), r = svg.querySelector("defs clipPath rect");
    const large = Number(r.getAttribute("width"));
    return b.width > large * 2 ? "" : `tracé de ${b.width.toFixed(0)} pour un cadre de ${large}`;
  }) === "");

  /* Le passé est tracé, en retrait, et l'heure en cours porte son repère. La série
     ne commence plus à minuit du jour en cours mais deux journées plus tôt : le
     saut arrière traverse hier, puis avant-hier, et s'arrête au premier jour
     chargé. */
  await pg.locator('.mg-nav [data-glisse="-24"]').click();
  await pg.waitForTimeout(420);
  ok("le saut arrière passe la veille sans buter sur minuit",
    (await txt(".mg-fenl")) === "hier 05 h à 05 h", await txt(".mg-fenl"));
  ok("le passé est tracé et mis en retrait",
    await pg.locator('.mg-v[data-cle="t"] .mg-passe').count() === 1);
  /* Une fenêtre entièrement écoulée est voilée de bout en bout : le voile part du
     début de la bande dessinée et court jusqu'à l'heure en cours, laquelle tombe
     au delà du cadre. */
  ok("une fenêtre entièrement écoulée est voilée sur toute sa largeur",
    await pg.evaluate(() => {
      const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
      const p = svg.querySelector(".mg-passe"), r = svg.querySelector("defs clipPath rect");
      if (!p) return "aucun voile";
      const g = Number(r.getAttribute("x")), w = Number(r.getAttribute("width"));
      const x = Number(p.getAttribute("x")), lg = Number(p.getAttribute("width"));
      return x <= g + 0.5 && x + lg >= g + w - 0.5 ? ""
        : `voile de ${x.toFixed(0)} à ${(x + lg).toFixed(0)} pour un cadre de ${g} à ${g + w}`;
    }) === "");
  /* Le repère existe encore dans le dessin, la bande débordant le cadre d'une
     fenêtre de part et d'autre, mais il tombe hors du cadre et la découpe le
     retient. Compter les éléments ne dirait rien, c'est son abscisse qui parle. */
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
  await pg.locator('.mg-nav [data-glisse="-24"]').click();
  await pg.waitForTimeout(420);
  ok("le saut arrière atteint l'avant-veille, qui se nomme",
    (await txt(".mg-fenl")) === "avant-hier 05 h à hier 05 h", await txt(".mg-fenl"));
  await pg.locator('.mg-nav [data-glisse="-24"]').click();
  await pg.waitForTimeout(420);
  ok("le saut arrière s'arrête au premier jour chargé",
    (await txt(".mg-fenl")) === "avant-hier 00 h à hier 00 h", await txt(".mg-fenl"));
  ok("au début de l'horizon, le saut arrière s'éteint",
    await pg.locator('.mg-nav [data-glisse="-24"]').isDisabled());
  ok("le libellé propose de revenir à maintenant",
    await pg.locator('.mg-fen[data-maintenant]').count() === 1);

  /* Revenu sur la journée en cours, le repère reparaît là où il doit tomber :
     une fenêtre partie de minuit le pose à sa neuvième heure, l'horloge des essais
     étant figée à neuf heures. */
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(420);
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(420);
  ok("deux sauts avant ramènent à minuit du jour en cours",
    (await txt(".mg-fenl")) === "00 h à demain 00 h", await txt(".mg-fenl"));
  ok("l'heure en cours porte son repère",
    await pg.locator('.mg-v[data-cle="t"] .mg-ici').count() === 1);
  ok("le repère tombe à la neuvième heure de la fenêtre", await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
    const l = svg.querySelector(".mg-ici"), r = svg.querySelector("defs clipPath rect");
    const g = Number(r.getAttribute("x")), w = Number(r.getAttribute("width"));
    const f = (Number(l.getAttribute("x1")) - g) / w;
    return Math.abs(f - 9 / 24) < 0.02 ? "" : `repère à ${(f * 24).toFixed(1)} h`;
  }) === "");

  /* L'échelle est commune à tout l'horizon : recalée à chaque glissement, la
     courbe se serait déformée sous le doigt et deux journées n'auraient plus été
     comparables. */
  const echelleDe = () => pg.evaluate(() =>
    [...document.querySelectorAll('.mg-v[data-cle="t"] text.mg-g')]
      .map(e => e.textContent).join("/"));
  const ech0 = await echelleDe();
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(420);
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(420);
  ok("le saut avant avance de deux journées",
    (await txt(".mg-fenl")) === "après-demain 00 h à ven 00 h", await txt(".mg-fenl"));
  ok("l'échelle ne bouge pas quand la fenêtre glisse",
    (await echelleDe()) === ech0, `${ech0} puis ${await echelleDe()}`);
  ok("au delà d'après-demain, le jour se nomme",
    /\b(lun|mar|mer|jeu|ven|sam|dim) 00 h$/.test(await txt(".mg-fenl")), await txt(".mg-fenl"));
  ok("le passé n'est plus voilé hors de sa journée",
    await pg.locator('.mg-v[data-cle="t"] .mg-passe').count() === 0);
  ok("la lecture de droite parle de la fenêtre, non de l'horizon", await pg.evaluate(() => {
    const r = document.querySelector('.mg-v[data-cle="t"] .mg-r').textContent;
    const m = r.match(/^(-?\d+) à (-?\d+)°$/);
    if (!m) return r;
    // La fenêtre d'après-demain ne peut pas porter les bornes des sept jours.
    return Number(m[2]) - Number(m[1]) <= 20 ? "" : `amplitude ${m[2] - m[1]}`;
  }) === "", await txt('.mg-v[data-cle="t"] .mg-r'));

  /* L'horizon du ruban est celui de la charge, sept jours, non les vingt-quatre
     heures de la table : c'est ce qui donne sa course au glissement. */
  let sauts = 0;
  while (!(await pg.locator('.mg-nav [data-glisse="24"]').isDisabled()) && sauts < 12) {
    await pg.locator('.mg-nav [data-glisse="24"]').click();
    await pg.waitForTimeout(240);
    sauts++;
  }
  ok("le glissement court jusqu'au dernier jour chargé",
    sauts === 4, `${sauts} sauts depuis après-demain`);
  ok("l'horizon s'arrête au dernier jour de la charge",
    (await txt(".mg-fenl")) === "lun 00 h à mar 00 h", await txt(".mg-fenl"));
  ok("au bout de l'horizon, le saut avant s'éteint",
    await pg.locator('.mg-nav [data-glisse="24"]').isDisabled());
  await pg.locator('.mg-fen[data-maintenant]').click();
  await pg.waitForTimeout(420);
  await pg.locator('.mg-nav [data-glisse="-24"]').click();
  await pg.waitForTimeout(420);
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(420);
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(420);

  /* L'écriture d'échelle ne glisse pas avec le dessin : elle nomme une hauteur,
     laquelle ne dépend pas de l'heure regardée. */
  ok("les noms de seuil et les chiffres restent hors du groupe mobile",
    await pg.evaluate(() => {
      const svg = document.querySelector('.mg-v[data-cle="v"] svg.mg-s');
      const dedans = [...svg.querySelectorAll("text.mg-bn, text.mg-g")]
        .filter(e => e.closest("g.mg-mob"));
      return dedans.length ? `${dedans.length} écritures dans le groupe mobile` : "";
    }) === "");

  // Le libellé ramène à l'heure en cours d'un seul appui.
  await pg.locator('.mg-fen[data-maintenant]').click();
  await pg.waitForTimeout(420);
  ok("le libellé ramène la fenêtre à maintenant",
    (await txt(".mg-fenl")) === "05 h à demain 05 h", await txt(".mg-fenl"));
  ok("revenue à maintenant, la fenêtre n'a plus où ramener",
    await pg.locator('.mg-fen[data-maintenant]').count() === 0);

  // Un glissement horizontal franc déplace la fenêtre, à l'heure entière.
  const bt = await pg.locator('.mg-v[data-cle="t"] .mg-s').boundingBox();
  await pg.mouse.move(bt.x + bt.width * 0.7, bt.y + bt.height * 0.5);
  await pg.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await pg.mouse.move(bt.x + bt.width * 0.7 - k * 12, bt.y + bt.height * 0.5 + k);
  }
  ok("le glissement déporte les sept voies ensemble", await pg.evaluate(() => {
    const t = [...document.querySelectorAll(".mg-v g.mg-mob")]
      .map(e => e.getAttribute("transform") || "");
    const pose = t.filter(v => v.startsWith("translate("));
    return pose.length === t.length && new Set(pose).size === 1 ? "" : pose.join(" | ");
  }) === "");
  await pg.mouse.up();
  await pg.waitForTimeout(500);
  ok("le glissement horizontal avance la fenêtre",
    (await txt(".mg-fenl")).startsWith("12 h à demain 12 h")
    || (await txt(".mg-fenl")).startsWith("13 h à demain 13 h"), await txt(".mg-fenl"));
  ok("le glissement calé, le déport est repris par le dessin", await pg.evaluate(() =>
    [...document.querySelectorAll(".mg-v g.mg-mob")]
      .every(e => !(e.getAttribute("transform") || "").startsWith("translate("))));
  await pg.locator('.mg-fen[data-maintenant]').click();
  await pg.waitForTimeout(420);

  /* En paysage, la fenêtre double : la densité de points par heure le permet, et
     le ruban n'est pas bridé à la largeur de lecture, sa lisibilité tenant à cette
     densité. */
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
  ok("en paysage la fenêtre porte quarante-huit heures",
    (await txt(".mg-fenl")) === "01 h à après-demain 01 h", await txt(".mg-fenl"));
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.waitForTimeout(600);
  ok("de retour en portrait, la fenêtre reprend vingt-quatre heures",
    (await txt(".mg-fenl")) === "05 h à demain 05 h", await txt(".mg-fenl"));
};
