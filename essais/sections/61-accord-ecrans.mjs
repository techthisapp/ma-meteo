/* L'accord des écrans. Section écrite le 3 octobre 2026 après le relevé des
   incohérences, décisions de Jérôme : les tuiles portent sur les heures à
   venir jusqu'à minuit et le disent, un seul seuil de rafale, une seule
   échelle d'indice UV, une seule règle de tendance de la pression. Elle part
   d'un état neuf préparé par essais/banc.mjs. */

import { FAIN } from "../faux-services.mjs";

export const titre = "L'accord des écrans";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ouvrirLeTemps, reposer, ctxReponse, etat, METEO_NUE, ouvrirCarte, appuiLong } = T;
  await onglet("accueil"); await reposer(pg, 2000);
  const tuile = nom => pg.evaluate(n => {
    const e = [...document.querySelectorAll(".bd-m")].find(x => x.querySelector("i")?.textContent.trim() === n);
    return e ? { v: e.querySelector("b").textContent.replace(/[  ]/g, " ").trim(),
      sous: e.querySelector("em")?.textContent.replace(/[  ]/g, " ").trim() } : null;
  }, nom);

  /* La tuile de la pluie dit le plus fort risque des heures à venir jusqu'à
     minuit : celui que la série de ces heures porte. */
  const attendu = await pg.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const s = P.serieHoraire(0, 24 - new Date().getHours(), 1);
    return { pb: Math.round(Math.max(...s.pb)), uv: Math.round(Math.max(...s.uv)), pres: Math.round(s.pres[0]),
      tend: P.tendancePression(s.pres, 0) };
  });
  const pluie = await tuile("Pluie"), uv = await tuile("Indice UV"), pres = await tuile("Pression");
  /* Un risque de 90 % à 3 h du matin, heure passée à 9 h : la tuile ne le
     compte pas. */
  const [ctxNuit, pgNuit] = await ctxReponse(() => {
    const d = METEO_NUE();
    d.hourly.time.forEach((t, k) => {
      if (t.startsWith("2026-08-18T03")) { d.hourly.precipitation_probability[k] = 90; d.hourly.precipitation[k] = 0; }
    });
    return d;
  });
  await reposer(pgNuit, 2000);
  const pluieNuit = await pgNuit.evaluate(() => [...document.querySelectorAll(".bd-m")]
    .find(x => x.querySelector("i")?.textContent.trim() === "Pluie")?.querySelector("b")?.textContent.replace(/[\u00A0\u202F]/g, " "));
  await ctxNuit.close();
  ok("la tuile de la pluie dit le plus fort risque d'ici minuit, et le dit",
    pluie.v === `${attendu.pb} %` && pluie.sous === "de risque d'ici minuit" && pluieNuit !== "90 %",
    JSON.stringify({ pluie, attendu, pluieNuit }));

  /* L'indice UV se nomme sur l'échelle du ruban, la pression et sa tendance
     sont celles du ruban. */
  await ouvrirLeTemps(pg); await reposer(pg, 1500);
  const ruban = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll(".mg-v")]
    .map(v => [v.dataset.cle, v.querySelector(".mg-r")?.textContent.replace(/[  ]/g, " ") || ""])));
  const motUv = await pg.evaluate(async v => (await import("/src/previsions.js")).motUV(v), attendu.uv);
  ok("la tuile de l'indice UV et le ruban emploient la même échelle de mots",
    uv.sous === `${motUv} d'ici minuit` && ruban.uv.endsWith(motUv), JSON.stringify({ uv, ruban: ruban.uv, motUv }));
  ok("la tuile de la pression et le ruban disent la même valeur et la même tendance",
    pres.v === `${attendu.pres} hPa` && pres.sous === attendu.tend && ruban.pres === `${attendu.pres} hPa, ${attendu.tend}`,
    JSON.stringify({ pres, ruban: ruban.pres, attendu }));

  /* Un seul seuil de rafale : la bande, le tableau des heures et les conseils
     la disent à partir de 40 km/h. */
  const rafales = await pg.evaluate(async () => {
    const B = await import("/src/bande.js"), C = await import("/src/conseils.js"), P = await import("/src/previsions.js");
    const E = await import("/src/ecritures.js");
    const h = Array.from({ length: 24 }, (_, k) => (13 + k) % 24);
    const s = r => ({ n: 24, heure: h, jour: h.map((x, k) => (13 + k < 24 ? 0 : 1)), t: h.map(() => 20), mm: h.map(() => 0),
      hum: h.map(() => 60), raf: h.map(() => r), v: h.map(() => 10), uv: h.map(() => 0), code: h.map(() => 1),
      clair: h.map(() => 1), pb: h.map(() => 0) });
    const tableau = r => /raf\. /.test(E.moments(s(r)));
    const semaine = r => C.grandesLignes([{ nom: "samedi", tn: 10, tx: 20, mm: 0, raf: r, vent: 20 },
      { nom: "dimanche", tn: 10, tx: 20, mm: 0, raf: 10, vent: 10 }]).some(l => /Vent fort/.test(l.t || l.texte || JSON.stringify(l)));
    return { seuils: [B.SEUIL_RAFALES, C.SEUILS.rafale, P.SEUIL_RAFALE], t39: tableau(39), t41: tableau(41), s39: semaine(39), s41: semaine(41) };
  });
  ok("un seul seuil de rafale, 40 km/h, pour la bande, le tableau, la semaine et les conseils",
    rafales.seuils.every(v => v === 40) && !rafales.t39 && rafales.t41 && !rafales.s39 && rafales.s41, JSON.stringify(rafales));

  /* La porte de l'air dit l'indice de l'heure en cours, celui de la feuille :
     un matin dégradé, l'air de minuit était bon. */
  etat.profilAir = "matin";
  const [ctxAir, pgAir] = await ctxReponse(() => METEO_NUE());
  await reposer(pgAir, 2500);
  const air = await pgAir.evaluate(async () => {
    const A = await import("/src/air.js"), P = await import("/src/previsions.js");
    const al = A.alignerSur(P.serieHoraire(0, 24 - new Date().getHours(), 1));
    return { attendu: A.niveauDe(al.aqi[0])?.nom, minuit: A.niveauDe(A.chargeCourante()?.aqi?.[0])?.nom,
      porte: document.querySelector('[data-info="air"]')?.textContent || "" };
  });
  await ctxAir.close();
  etat.profilAir = "base";
  ok("la porte de l'air dit l'indice de l'heure en cours", air.attendu && air.attendu !== air.minuit
    && air.porte.startsWith(`Air ${air.attendu}`), JSON.stringify(air));

  /* Second lot. À venir : la rafale du jour se lit sur les heures, dans la
     rangée comme dans le graphique, même quand la charge quotidienne en dit
     une autre. */
  const [ctxRaf, pgRaf] = await ctxReponse(() => {
    const d = METEO_NUE();
    d.daily.wind_gusts_10m_max = d.daily.time.map(() => 99);
    return d;
  });
  await reposer(pgRaf, 1500);
  await pgRaf.locator('[data-onglet="semaine"]').click(); await reposer(pgRaf, 1500);
  const graphe = await pgRaf.evaluate(() => [...document.querySelectorAll(".sg text")].map(e => e.textContent).join(" "));
  await ctxRaf.close();
  ok("les rafales du graphique d'À venir viennent des heures, comme la rangée", graphe.length > 0 && !/\b99\b/.test(graphe),
    graphe.slice(0, 200));

  /* La bande écrit le cumul comme le reste de l'application. */
  const cumul = await pg.evaluate(async () => {
    const B = await import("/src/bande.js");
    const heure = Array.from({ length: 24 }, (_, k) => (9 + k) % 24);
    const s = { n: 24, heure, mm: heure.map(h => (h >= 3 && h <= 5 ? 4.11 : 0)), pb: heure.map(() => 80),
      raf: heure.map(() => 10), t: heure.map(() => 15), v: heure.map(() => 10), code: heure.map(() => 61), clair: heure.map(() => 1) };
    return B.phraseBande(s).replace(/[\u00A0\u202F]/g, " ");
  });
  ok("la bande écrit le cumul de pluie comme le reste de l'application", /, 12 mm/.test(cumul), cumul);

  /* La bulle de la carte, au lieu affiché, dit la température de l'accueil. */
  const tAccueil = await pg.evaluate(async () => Math.round((await import("/src/previsions.js")).serieHoraire(0, 1, 1).t[0]));
  /* La carte s'ouvre centrée sur le lieu, de près : le centre de la toile
     est le lieu affiché. */
  const [, pc] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false,
    vuecarte: { lat: FAIN.lat, lon: FAIN.lon, z: 12 } }, 0, { sansFond: true });
  await reposer(pc, 1500);
  const bc = await pc.locator("#caToile").boundingBox();
  /* En bas à gauche du lieu, hors de son étiquette, qui prend les appuis. */
  const cx = bc.x + bc.width / 2 - 30, cy = bc.y + bc.height / 2 + 30;
  await appuiLong(pc, cx, cy);
  await pc.waitForTimeout(800); await reposer(pc, 1500);
  const tBulle = await pc.evaluate(() => (document.querySelector("#caBulle .cb-temps b")?.textContent || "").replace("°", ""));
  ok("la bulle de la carte, au lieu affiché, dit la température de l'accueil", tBulle === String(tAccueil),
    JSON.stringify({ tBulle, tAccueil }));
};
