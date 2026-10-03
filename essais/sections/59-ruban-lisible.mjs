/* Le ruban lisible au doigt. Section écrite le 3 octobre 2026 après l'examen
   du ruban dans le simulateur ; elle part d'un état neuf préparé par
   essais/banc.mjs. */

export const titre = "Le ruban lisible";
export const avecPage = true;

export default async T => {
  const { pg, ok, ouvrirLeTemps, reposer } = T;
  await ouvrirLeTemps(pg); await reposer(pg, 1500);

  /* Un appui long sur le ruban ne sélectionne rien : ni loupe, ni poignées,
     ni menu du système. */
  const sel = await pg.evaluate(() => [".mg-s", ".mg-bd", ".mg-t", ".mg-r"].map(q => {
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
    await pg.locator('[data-glisse="24"]').click(); await reposer(pg, 800);
  }
  ok("l'axe du haut n'écrit que des libellés entiers, au format des heures de l'application",
    coupes.length === 0, coupes.join(" | "));

  /* Le trait de minuit s'arrête aux tracés : aucun ne passe sous un titre. */
  const croise = await pg.evaluate(() => {
    const titres = [...document.querySelectorAll(".mg-t, .mg-l")].map(e => e.getBoundingClientRect());
    return [...document.querySelectorAll(".mg-mp")].filter(l => {
      const b = l.getBoundingClientRect();
      return titres.some(t => b.left >= t.left && b.left <= t.right && b.top < t.bottom && b.bottom > t.top);
    }).length;
  });
  ok("le trait de minuit ne traverse ni les titres ni les phrases des voies", croise === 0, String(croise));
};
