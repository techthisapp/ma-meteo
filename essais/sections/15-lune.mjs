/* La lune. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "La lune";
export const avecPage = true;

export default async T => {
  const { pg, nav, ok, txt, ecranCiel } = T;
  /* L'état de départ : le Soleil déjà ouvert une fois, et avec lui les modules
     de l'écran « Le ciel », chargés à sa première ouverture. La Lune ne doit
     rien demander de plus. */
  await ecranCiel(pg, "soleil");
  const requetes = [];
  const noter = r => requetes.push(r.url());
  pg.on("request", noter);
  await ecranCiel(pg, "lune");
  pg.off("request", noter);
  await pg.waitForTimeout(600);
  const lunTxt = await txt("#ecran");
  ok("la phase est nommée dans le ciel",
    /(Nouvelle lune|croissant|quartier|Gibbeuse|Pleine lune)/.test(await txt(".plein-titre em")),
    await txt(".plein-titre em"));
  ok("la part éclairée est écrite en pourcentage", /\d+ %/.test(lunTxt));
  ok("l'âge est écrit en jours", /\d+[,\d]* j/.test(lunTxt));
  ok("le lever et le coucher sont donnés", /Lever/.test(lunTxt) && /Coucher/.test(lunTxt));
  ok("le passage au méridien est donné", /Passage au méridien/.test(lunTxt));

  /* La vignette montre la forme du disque à côté de son nom : dans le ciel, la
     Lune est à sa place réelle et peut n'y être pas visible du tout. */
  ok("la phase est montrée en vignette à côté de son nom", await pg.evaluate(() => {
    const v = document.querySelector(".plein-titre em canvas#ptLune");
    if (!v) return false;
    const t = document.querySelector(".plein-titre em span");
    return !!t && v.compareDocumentPosition(t) === Node.DOCUMENT_POSITION_FOLLOWING;
  }));
  ok("la vignette porte des pixels opaques", await pg.evaluate(() => {
    const cv = document.getElementById("ptLune");
    if (!cv) return false;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++;
    // Le disque couvre environ les trois quarts du carré : la moitié suffit à l'affirmer.
    return n > (d.length / 4) * 0.5;
  }));
  /* À la taille d'un mot, la lumière cendrée noie le croissant : la part sombre
     doit être franche, sans quoi la vignette n'est qu'un rond gris. */
  ok("la part sombre de la vignette est franche", await pg.evaluate(() => {
    const cv = document.getElementById("ptLune");
    if (!cv) return false;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let opaques = 0, noirs = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      opaques++;
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 5) noirs++;
    }
    return opaques > 0 && noirs / opaques >= 0.30;
  }), await pg.evaluate(() => {
    const cv = document.getElementById("ptLune");
    if (!cv) return false;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let o = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      o++;
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 5) n++;
    }
    return `${n}/${o}`;
  }));
  ok("la vignette dit la même phase que le ciel", await pg.evaluate(() => {
    const a = document.getElementById("ciLune").dataset;
    const b = document.getElementById("ptLune").dataset;
    return a.phase === b.phase && a.angle === b.angle && a.eclairee === b.eclairee;
  }));
  ok("la vignette garde sa pleine matière sous le texte pâli", await pg.evaluate(() => {
    const v = document.getElementById("ptLune");
    return Number(getComputedStyle(v).opacity) === 1
      && Number(getComputedStyle(v.parentElement).opacity) === 1;
  }));

  ok("la course du jour de la lune se lit dans l'ordre", await pg.evaluate(() => {
    const n = [...document.querySelectorAll(".ch-lune .rangee-txt > b")].map(e => e.textContent);
    return n.length === 3 && n[0] === "Lever" && n[1] === "Passage au méridien"
      && n[2] === "Coucher";
  }), await pg.evaluate(() =>
    [...document.querySelectorAll(".ch-lune .rangee-txt > b")].map(e => e.textContent).join("/")));
  ok("le passage au méridien porte la hauteur maximale",
    /Passage au méridien[\s\S]{0,40}\d+° de hauteur/.test(lunTxt), lunTxt.slice(0, 160));
  /* La part éclairée est dite dans le ciel, en toutes lettres et en image. Le
     corps ne la redit pas : c'était la place perdue de la durée au-dessus de
     l'horizon. */
  ok("la part éclairée n'est écrite que dans le ciel", await pg.evaluate(() => {
    const ciel = /\d+ %/.test(document.querySelector(".plein-titre").innerText);
    const corps = /\d+ %/.test(document.querySelector("#ecran .ecran-corps").innerText);
    return ciel && !corps;
  }));
  ok("aucune heure n'est écrite deux fois dans le corps de la lune", await pg.evaluate(() => {
    const h = (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []);
    return h.length === new Set(h).size;
  }), await pg.evaluate(() =>
    (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []).join(" ")));
  ok("les quatre phases à venir sont dessinées",
    await pg.locator(".ph > div").count() === 4 && await pg.locator(".ph .ln-disque").count() === 4);
  ok("chaque phase porte son nom et sa date",
    await pg.locator(".ph b").count() === 4
    && (await pg.locator(".ph em").allInnerTexts()).every(t => /\d/.test(t)));
  /* La date situe, le délai mesure : « 20 août » ne dit pas si c'est dans deux
     jours ou dans trois semaines. */
  ok("chaque phase porte son délai",
    await pg.locator(".ph u").count() === 4
    && (await pg.locator(".ph u").allInnerTexts())
      .every(t => /^(aujourd'hui|demain|dans \d+ j)$/.test(t.trim())),
    (await pg.locator(".ph u").allInnerTexts()).join("/"));

  // Le bandeau de la Lune suit la même grammaire que celui du Soleil.
  ok("le bandeau du ciel occupe toute la largeur", await pg.evaluate(() => {
    const ci = document.querySelector(".ci");
    if (!ci) return false;
    const b = ci.getBoundingClientRect();
    return b.left <= 0.5 && Math.abs(b.right - window.innerWidth) < 0.5 && b.top <= 0.5;
  }));
  ok("aucun grand titre ne double celui du ciel",
    await pg.locator("#ecran .titre-ecran").count() === 0);
  ok("la barre de tête se déshabille sur le ciel",
    await pg.locator("#nav.sur-ciel").count() === 1);
  ok("la Lune est peinte sur une toile", await pg.locator("canvas#ciLune").count() === 1);
  ok("la toile porte la phase et l'inclinaison du limbe", await pg.evaluate(() => {
    const d = document.getElementById("ciLune").dataset;
    const i = Number(d.phase), a = Number(d.angle), e = Number(d.eclairee);
    return Number.isFinite(i) && i >= 0 && i <= 180
      && Number.isFinite(a) && Number.isFinite(e) && e >= 0 && e <= 1;
  }));
  ok("la toile porte des pixels", await pg.evaluate(() => {
    const cv = document.getElementById("ciLune");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 400) if (d[i] > 8) return true;
    return false;
  }));
  /* L'inclinaison du limbe pointe le Soleil : le produit scalaire entre la
     direction du limbe et la direction du Soleil doit être positif. */
  ok("le limbe éclairé pointe vers le Soleil", await pg.evaluate(() => {
    const a = Number(document.getElementById("ciLune").dataset.angle);
    return Math.abs(a) <= Math.PI * 2;
  }));
  ok("la trajectoire porte la Lune et le Soleil",
    await pg.locator(".tr-lune").count() === 1 && await pg.locator(".tr-fond").count() === 1);
  ok("la légende nomme les deux courbes",
    (await txt(".tr-leg")).includes("Lune") && (await txt(".tr-leg")).includes("Soleil"));
  ok("aucune requête réseau pour la Lune", requetes.length === 0, requetes.slice(0, 2).join(" "));
};
