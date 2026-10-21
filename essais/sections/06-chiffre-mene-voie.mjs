/* Un chiffre mène à sa voie. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Un chiffre mène à sa voie";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet } = T;
  /* Huit tuiles depuis le jalon 11 : sept vers une voie du ruban, celle de l'air
     vers sa feuille. */
  /* Du 30 septembre au 12 octobre 2026, une neuvième, l'eau, menait elle
     aussi à sa feuille ; depuis la version 194, l'eau est une porte. */
  ok("chaque mesure de l'accueil porte une destination",
    await pg.locator(".bd-m[data-detail]").count() === 7
    && await pg.locator(".bd-m[data-feuille]").count() === 1);
  ok("le grand chiffre et le ciel en portent une aussi",
    await pg.locator(".bd-deg[data-detail]").count() === 1
    && await pg.locator(".bd-ciel[data-detail]").count() === 1);

  await pg.locator('.bd-m[data-detail="uv"]').click();
  await pg.waitForTimeout(900);
  /* La vue ciblée, version 232 : le titre de la grandeur, sa seule voie. */
  ok("l'écran du temps s'ouvre sur la vue ciblée de la grandeur", (await txt(".hh-grand")) === "Indice UV"
    && await pg.locator('.hh-page[data-vue="ciblee"]').count() === 1, await txt(".hh-grand"));
  ok("la voie visée est dessinée en grand",
    await pg.locator('.mg-v[data-cle="uv"].mg-grand').count() === 1);
  ok("aucune autre voie n'est dessinée", await pg.locator(".mg-v").count() === 1);
  ok("la page s'est placée sur la voie", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="uv"]');
    const b = v.getBoundingClientRect();
    return b.top < window.innerHeight && b.bottom > 0;
  }));

  await onglet("accueil");
  await pg.locator(".bd-deg").click();
  await pg.waitForTimeout(900);
  ok("le grand chiffre mène à la température",
    await pg.locator('.mg-v[data-cle="t"].mg-grand').count() === 1);

  /* Le conseil sur la bascule du ciel mène au ciel, version 238. */
  const ciel = await pg.evaluate(async () => {
    const C = await import("/src/conseils.js");
    const n = 8, h = Array.from({ length: n }, (_, k) => 9 + k);
    const s = { n, heure: h, jour: h.map(() => "2026-08-18"), t: h.map(() => 20), res: h.map(() => 20), mm: h.map(() => 0),
      pb: h.map(() => 0), code: h.map(() => 1), nua: h.map((_, k) => (k < 3 ? 10 : 95)), hum: h.map(() => 60),
      raf: h.map(() => 10), v: h.map(() => 5), uv: h.map(() => 0), pres: h.map(() => 1015), clair: h.map(() => 1), dir: h.map(() => 0) };
    const couvre = C.conseils(s, { aujourdhui: "2026-08-18" }).find(x => /Le ciel se couvre/.test(x.t));
    s.nua = s.nua.map(v => 100 - v);
    const degage = C.conseils(s, { aujourdhui: "2026-08-18" }).find(x => /Le ciel se dégage/.test(x.t));
    return { couvre: couvre?.d, degage: degage?.d, html: C.conseilsHTML([couvre].filter(Boolean)) };
  });
  ok("les conseils sur la bascule du ciel ouvrent le ciel heure par heure",
    ciel.couvre === "nua" && ciel.degage === "nua" && /data-detail="nua" data-heure="\d+"/.test(ciel.html), JSON.stringify(ciel));

  /* Un conseil mène à la plage de son événement, version 233, demande de
     Jérôme du 21 octobre 2026 : la page repart de maintenant, se cale sur le
     jour de l'événement s'il le faut, le redit en tête et en lave les heures
     dans le dessin et dans la liste. */
  await onglet("accueil");
  const porte = pg.locator('.cj-porte[data-detail="mm"]').first();
  const vise = { de: Number(await porte.getAttribute("data-heure")), a: Number(await porte.getAttribute("data-fin")),
    phrase: await porte.getAttribute("data-phrase") };
  await porte.click();
  await pg.waitForTimeout(900);
  const ouvert = await pg.evaluate(() => ({
    jour: document.querySelector(".mg-j-on")?.getAttribute("aria-label") || "",
    retenir: document.querySelector(".hh-retenir")?.textContent || "",
    mis: [...document.querySelectorAll(".hh-mis .hh-h")].map(e => e.textContent),
    marque: !!document.querySelector(".mg-v .mg-porte"),
  }));
  ok("un conseil ouvre la vue sur la plage de son événement, mise en avant",
    /^Demain, /.test(ouvert.jour) && ouvert.retenir === vise.phrase && ouvert.marque
    && ouvert.mis.length === vise.a - vise.de + 1, JSON.stringify({ vise, ouvert }));
  /* La mise en avant est jaune depuis la version 238 : la teinte de
     l'encadré, de la plage du dessin et des heures de la liste. */
  const teintes = await pg.evaluate(() => {
    const teinte = c => {
      const m = (c || "").match(/\d+(\.\d+)?/g)?.map(Number) || [];
      if (m.length < 3) return -1;
      const [r, g, b] = m.map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx === mn) return -1;
      const h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      return Math.round(((h * 60) + 360) % 360);
    };
    return { encadre: teinte(getComputedStyle(document.querySelector(".hh-retenir")).borderLeftColor),
      plage: teinte(getComputedStyle(document.querySelector(".mg-porte")).fill),
      heures: teinte(getComputedStyle(document.querySelector(".hh-mis")).backgroundColor) };
  });
  ok("la mise en avant d'un conseil est jaune", Object.values(teintes).every(h => h >= 38 && h <= 58), JSON.stringify(teintes));
  await pg.locator('.hh-puce[data-grandeur="v"]').click();
  await pg.waitForTimeout(400);
  ok("changer de grandeur efface la mise en avant",
    await pg.locator(".hh-retenir, .hh-mis, .mg-porte").count() === 0);

  /* Une porte sans heure repart de maintenant, quel que soit le jour choisi
     à la visite précédente. */
  await pg.locator(".mg-jours [data-jour]").last().click();
  await pg.waitForTimeout(400);
  await onglet("accueil");
  await pg.locator('.bd-m[data-detail="v"]').click();
  await pg.waitForTimeout(900);
  ok("une porte sans heure repart de maintenant, non du dernier jour choisi",
    await pg.locator(".mg-j-on").getAttribute("aria-label") === "Maintenant",
    await pg.locator(".mg-j-on").getAttribute("aria-label"));
};
