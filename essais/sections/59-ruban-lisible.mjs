/* Le ruban lisible au doigt. Section écrite le 3 octobre 2026 après l'examen
   du ruban dans le simulateur ; elle part d'un état neuf préparé par
   essais/banc.mjs. */

export const titre = "Le ruban lisible";
export const avecPage = true;

export default async T => {
  const { pg, ok, ouvrirVoie, reposer } = T;
  /* La vue ciblée de la température, version 232 : le ruban ne se dessine
     plus que voie par voie. */
  await ouvrirVoie(pg, "t"); await reposer(pg, 1500);

  /* Un appui long sur le ruban ne sélectionne rien : ni loupe, ni poignées,
     ni menu du système. */
  const sel = await pg.evaluate(() => [".mg-s", ".mg-bd", ".mg-lu"].map(q => {
    const e = document.querySelector(q);
    const cs = e ? getComputedStyle(e) : null;
    return cs ? `${q}:${cs.webkitUserSelect || cs.userSelect}:${cs.webkitTouchCallout ?? "none"}` : `${q}:absent`;
  }));
  ok("le ruban ne se sélectionne pas, l'appui long n'y ouvre ni loupe ni menu",
    sel.every(x => /:none:none$/.test(x)), sel.join(" "));

  /* L'axe du haut n'écrit que des libellés entiers, sur plusieurs fenêtres. */
  const coupes = [];
  for (let n = 0; n < 4; n++) {
    coupes.push(...await pg.evaluate(() => {
      const svg = document.querySelector(".mg-bd");
      const r = svg.querySelector("defs clipPath rect");
      const m = svg.getScreenCTM();
      const g = m.a * Number(r.getAttribute("x")) + m.e, d = g + m.a * Number(r.getAttribute("width"));
      const libres = [...svg.querySelectorAll("text")].filter(t => {
        const b = t.getBoundingClientRect();
        return b.left < g - 1 || b.right > d + 1;
      }).map(t => t.textContent);
      const heures = [...svg.querySelectorAll(".mg-bh")].map(t => t.textContent);
      return [...libres, ...heures.filter(h => !/^\d{2} h$/.test(h)).map(h => `format:${h}`)];
    }));
    /* Les fenêtres se choisissent par jour depuis le jalon 21, lot 2. */
    await pg.locator(".mg-jours [data-jour]").nth(n).click(); await reposer(pg, 800);
  }
  ok("l'axe du haut n'écrit que des libellés entiers, au format des heures de l'application",
    coupes.length === 0, coupes.join(" | "));

  /* La voie de la pluie ne se dessine que s'il pleut dans la fenêtre ; sans
     pluie, elle le dit en une ligne. */
  await pg.locator('.hh-puce[data-grandeur="mm"]').click(); await reposer(pg, 600);
  const pluies = [];
  for (const sel of ['.mg-jours [data-maintenant]', ...Array.from({ length: 6 }, (_, k) => `.mg-jours [data-jour] >> nth=${k}`)]) {
    if (!await pg.locator(sel).count()) continue;
    await pg.locator(sel).click(); await reposer(pg, 600);
    pluies.push(await pg.evaluate(() => {
      const v = document.querySelector('.mg-v[data-cle="mm"]');
      return { vide: !!v?.classList.contains("mg-vide"), trace: !!v?.querySelector(".mg-s") };
    }));
  }
  ok("la voie de la pluie se replie sur une fenêtre sans pluie et se dessine dès qu'il pleut",
    pluies.every(p => p.trace !== p.vide) && pluies.some(p => p.trace) && pluies.some(p => !p.trace), JSON.stringify(pluies));
};
