/* Le plein ciel. Section écrite le 5 octobre 2026, version 172, demande de
   Jérôme : un toucher sur le Soleil ou la Lune les ouvre en plein écran,
   l'astre grandi sur le bord gauche, les informations clés à droite. Elle part
   d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Le plein ciel";
export const avecPage = true;

const NORM = t => (t || "").replace(/[  ]/g, " ");

export default async T => {
  const { pg, ok, onglet, ecranCiel, reposer } = T;

  /* Le haut du disque : sur l'accueil, le grand chiffre peut couvrir son
     centre, et un bouton passe devant l'astre. */
  const toucher = async (id, part) => {
    const r = await pg.locator(id).boundingBox();
    await pg.mouse.click(r.x + r.width / 2, r.y + r.height / 2 - r.width * part * 0.7);
    await pg.waitForTimeout(1300);
  };
  const etat = () => pg.evaluate(() => {
    const c = document.querySelector(".pc");
    const t = s => (c && c.querySelector(s) ? c.querySelector(s).textContent.replace(/[  ]/g, " ") : "");
    return c ? {
      sorte: c.classList.contains("pc-lune") ? "lune" : "soleil",
      ouvert: c.classList.contains("pc-ouvert"),
      role: c.getAttribute("role"),
      lbl: t(".pc-lbl"), grand: t(".pc-grand"), sous: t(".pc-haut em"),
      lignes: [...c.querySelectorAll(".pc-ligne span")].map(s => s.firstChild.textContent),
      duo: [...c.querySelectorAll(".pc-duo div")].map(d => d.textContent.replace(/[  ]/g, " ")),
      focus: document.activeElement && document.activeElement.classList.contains("pc-fermer"),
    } : null;
  });
  const cacheSoleil = () => pg.evaluate(() => document.getElementById("ciFeu")?.style.visibility || "");
  const fermerParCroix = async () => { await pg.locator(".pc-fermer").click(); await pg.waitForTimeout(1100); };

  await ecranCiel(pg, "soleil"); await reposer(pg, 1500);
  await toucher("#ciFeu", 0.19);
  const s = await etat();
  ok("un toucher sur le Soleil de l'écran Le ciel l'ouvre en plein ciel",
    s && s.sorte === "soleil" && s.ouvert && s.role === "dialog" && (await cacheSoleil()) === "hidden",
    s ? `${s.sorte}, ouvert ${s.ouvert}, rôle ${s.role}` : "rien d'ouvert");

  /* L'astre ouvert est le dessin de l'application, `feu.js` sur sa propre
     toile, avec la teinte du panneau ; son rayon vaut le cinquième de la
     hauteur, son centre est près du bord gauche, à mi-hauteur. */
  const g = await pg.evaluate(() => {
    const cv = document.querySelector(".pc-astre");
    const src = document.getElementById("ciFeu");
    const r = cv.getBoundingClientRect();
    const x = cv.getContext("2d");
    const centre = x.getImageData(Math.round(cv.width / 2), Math.round(cv.height / 2), 1, 1).data;
    return { chaud: cv.dataset.chaud, chaudSrc: src.dataset.chaud,
      cx: r.left + r.width / 2, cy: r.top + r.height / 2, rayon: r.width * 0.19,
      W: innerWidth, H: innerHeight, plein: centre[3], dense: cv.width / cv.clientWidth };
  });
  ok("l'astre ouvert est celui de l'application, grandi sur le bord gauche",
    g.chaud === g.chaudSrc && g.plein > 200 && Math.abs(g.rayon - g.H * 0.21) < 3
    && Math.abs(g.cx + g.rayon - g.W * 0.42) < 3 && Math.abs(g.cy - g.H / 2) < 3,
    `teinte ${g.chaud}/${g.chaudSrc}, opacité ${g.plein}, rayon ${g.rayon.toFixed(1)}, centre ${g.cx.toFixed(1)} ${g.cy.toFixed(1)}`);
  ok("le Soleil ouvert se dessine à densité bornée", g.dense <= 1.51, `densité ${g.dense}`);

  /* À 9 h le 18 août à Fain : midi solaire 13 h 50, heure dorée 20 h 05,
     coucher 20 h 50, heure bleue 21 h 05, dans l'ordre où elles se vivent. */
  const hauteur = await pg.evaluate(async () => {
    const A = await import("/src/astres.js");
    return Math.round(A.position("soleil", new Date(), 47.5, 4.3).hauteur);
  });
  ok("le plein ciel dit la hauteur, la journée et les heures du Soleil dans leur ordre",
    s && s.lbl === "Maintenant, 09 h" && s.grand.startsWith(`${hauteur}`) && /au-dessus de l'horizon/.test(s.sous)
    && s.lignes.join("|") === "Midi solaire|Heure dorée|Coucher|Heure bleue"
    && s.duo.some(d => /^UV \d/.test(d)) && s.focus,
    s && `${s.lbl} | ${s.grand} | ${s.sous} | ${s.lignes.join(", ")} | ${s.duo.join(" ; ")} | focus ${s.focus}`);

  ok("l'heure dorée et l'heure bleue tombent à leur hauteur",
    await pg.evaluate(async () => {
      const A = await import("/src/astres.js");
      const PC = await import("/src/vues/plein-ciel.js");
      const d = new Date();
      const doree = A.passages(d, 47.5, 4.3, PC.DOREE, true).soir;
      const bleue = A.passages(d, 47.5, 4.3, PC.BLEUE[0], true).soir;
      const coucher = A.evenements("soleil", d, 47.5, 4.3).coucher;
      const h = x => A.position("soleil", x, 47.5, 4.3).hauteur;
      if (Math.abs(h(doree) - 6) > 0.05) return `heure dorée à ${h(doree).toFixed(2)}°`;
      if (Math.abs(h(bleue) + 4) > 0.05) return `heure bleue à ${h(bleue).toFixed(2)}°`;
      if (!(doree < coucher && coucher < bleue)) return "ordre faux";
      return "";
    }) === "");

  await fermerParCroix();
  ok("la croix referme et rend le Soleil à sa place",
    (await pg.locator(".pc").count()) === 0 && (await cacheSoleil()) === "",
    `${await pg.locator(".pc").count()} cadre, visibilité « ${await cacheSoleil()} »`);

  await toucher("#ciFeu", 0.19);
  await pg.mouse.move(300, 380); await pg.mouse.down();
  await pg.mouse.move(300, 470, { steps: 4 }); await pg.mouse.move(300, 560, { steps: 4 });
  await pg.mouse.up(); await pg.waitForTimeout(1100);
  ok("un glissement vers le bas referme", (await pg.locator(".pc").count()) === 0);

  await toucher("#ciFeu", 0.19);
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(1100);
  ok("la touche Échap referme", (await pg.locator(".pc").count()) === 0);

  /* Un toucher dans le ciel loin de l'astre n'ouvre rien. */
  const libre = await pg.evaluate(() => {
    const ci = document.querySelector("#ecran .ci").getBoundingClientRect();
    const cv = document.getElementById("ciFeu").getBoundingClientRect();
    const x = cv.left + cv.width / 2 < ci.width / 2 ? ci.right - 40 : ci.left + 40;
    return { x, y: ci.top + 110 };
  });
  await pg.mouse.click(libre.x, libre.y); await pg.waitForTimeout(800);
  ok("un toucher dans le ciel loin de l'astre n'ouvre rien", (await pg.locator(".pc").count()) === 0);

  await pg.locator("#ptSoleil").click(); await pg.waitForTimeout(1300);
  const v = await etat();
  ok("la vignette de la sous-ligne ouvre aussi le Soleil", v && v.sorte === "soleil");
  if (v) await fermerParCroix();

  /* Le bouton caché porte le geste pour VoiceOver et le clavier. */
  await pg.locator('[data-plein-ciel="soleil"]').focus();
  await pg.keyboard.press("Enter"); await pg.waitForTimeout(1300);
  const b = await etat();
  ok("le bouton caché ouvre le Soleil au clavier", b && b.sorte === "soleil" && b.focus,
    b ? `focus ${b.focus}` : "rien d'ouvert");
  if (b) await fermerParCroix();

  await onglet("accueil"); await reposer(pg, 1500);
  await toucher("#ciFeu", 0.19);
  const a = await etat();
  ok("le Soleil du ciel de l'accueil s'ouvre aussi", a && a.sorte === "soleil" && a.ouvert);
  if (a) await fermerParCroix();

  await ecranCiel(pg, "lune"); await reposer(pg, 1500);
  await toucher("#ciLune", 0.155);
  const l = await etat();
  const pct = await pg.evaluate(async () => {
    const A = await import("/src/astres.js");
    return Math.round(A.phase(new Date()).eclairee * 100);
  });
  ok("la Lune s'ouvre en plein ciel avec sa part éclairée, son passage et ses phases",
    l && l.sorte === "lune" && NORM(l.grand).startsWith(`${pct}`)
    && l.lignes.includes("Passage au méridien") && l.duo.some(d => /pleine lune/.test(d)),
    l && `${l.grand} | ${l.sous} | ${l.lignes.join(", ")} | ${l.duo.join(" ; ")}`);
  if (l) await fermerParCroix();
};
