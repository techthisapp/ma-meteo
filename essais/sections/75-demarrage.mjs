/* Le démarrage sans à-coups, version 204, signalé par Jérôme le 14 octobre
   2026 : l'accueil semblait sauter plusieurs fois au démarrage, l'image
   animée du ciel surtout. Section écrite le 14 octobre 2026 ; elle part d'un
   état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Le démarrage sans à-coups";
export const avecPage = false;

export default async T => {
  const { nav, ok, brancherRoutes, ouvrirPage, reposer } = T;
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c.addInitScript(amorceGardee(FAIN, FIGE));
  /* Le journal des rendus de l'écran, posé avant le premier. */
  await c.addInitScript(() => {
    window.__rendus = 0;
    document.addEventListener("DOMContentLoaded", () => {
      const ec = document.getElementById("ecran");
      new MutationObserver(m => { if (m.some(x => x.target === ec && x.addedNodes.length)) window.__rendus++; })
        .observe(ec, { childList: true });
    });
  });
  await brancherRoutes(c);
  await c.route(/api\.rainviewer\.com/, r => r.abort());
  const p = await c.newPage();
  await ouvrirPage(p);
  await reposer(p, 3000);

  /* Les arrivées des sources se regroupent : neuf rendus en deux secondes
     avant la version 204, trois depuis. */
  const rendus = await p.evaluate(() => window.__rendus);
  ok("au démarrage, les arrivées des sources se regroupent en quelques rendus de l'accueil",
    rendus >= 2 && rendus <= 4, `${rendus} rendus`);

  /* Un rendu qui ne change pas le ciel garde la même toile, et son
     animation continue. */
  await p.evaluate(() => { window.__toile = document.getElementById("ciTemps"); });
  await p.waitForTimeout(1200);
  await p.locator("#btnReglages").click(); await p.waitForTimeout(500);
  await p.locator('[data-heures-accueil="moments"]').click(); await p.waitForTimeout(400);
  await p.locator('[data-heures-accueil="bande"]').click(); await p.waitForTimeout(400);
  await p.locator("#feuille-fermer").click(); await p.waitForTimeout(500);
  const ciel = await p.evaluate(async () => {
    const T = await import("/src/temps.js");
    const t = document.getElementById("ciTemps");
    return { meme: !!t && t === window.__toile && t.isConnected, age: Math.round(T.ageAnimation() * 10) / 10 };
  });
  /* Plus de deux secondes et demie d'animation : la toile tourne depuis
     avant les trois rendus des réglages, posés en un peu plus d'une seconde. */
  ok("un rendu qui garde la forme du ciel garde l'image animée, sans la reprendre de zéro",
    ciel.meme && ciel.age > 2.5, JSON.stringify(ciel));

  /* Version 214 : le ciel se met en pause le temps du glissement, puis
     reprend de l'instant atteint. */
  const pause = await p.evaluate(async () => {
    const T = await import("/src/temps.js");
    const avant = T.ageAnimation();
    window.scrollTo(0, 120); window.dispatchEvent(new Event("scroll"));
    await new Promise(r => setTimeout(r, 60));
    const pendant = T.anime();
    await new Promise(r => setTimeout(r, 450));
    const apres = T.anime(), age = T.ageAnimation();
    window.scrollTo(0, 0);
    return { avant: Math.round(avant * 10) / 10, pendant, apres, age: Math.round(age * 10) / 10 };
  });
  ok("le ciel se met en pause pendant le glissement et reprend de l'instant atteint",
    !pause.pendant && pause.apres && pause.age >= pause.avant, JSON.stringify(pause));

  /* Le ciel grandit avec ce qu'il porte, version 206 : une réponse de trois
     lignes et la mesure de la station restent sous la barre de tête, et le
     grand chiffre reste dans le ciel. */
  const haut = await p.evaluate(async () => {
    const rep = document.querySelector(".pt-rep");
    const l = rep.querySelector(".pt-l");
    rep.append(l.cloneNode(true), l.cloneNode(true));
    const m = document.createElement("p"); m.className = "bd-mesure"; m.textContent = "21° mesurés à la station, il y a 7 min";
    document.querySelector(".bd-etat").append(m);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const nav = document.getElementById("nav").getBoundingClientRect();
    const r = rep.getBoundingClientRect(), ci = document.querySelector(".plein-accueil > .ci").getBoundingClientRect();
    const deg = document.querySelector(".bd-deg").getBoundingClientRect();
    return { nav: Math.round(nav.bottom), rep: Math.round(r.top), ciel: Math.round(ci.bottom), chiffre: Math.round(deg.bottom) };
  });
  ok("le ciel de l'accueil grandit avec une longue réponse du matin, qui reste sous la barre de tête",
    haut.rep >= haut.nav && haut.chiffre <= haut.ciel, JSON.stringify(haut));
  /* Version 207 : un astre bas, dans la moitié du ciel qui porte le texte,
     s'adoucit ; haut, il garde son éclat. */
  const astres = await p.evaluate(async () => {
    const A = await import("/src/vues/astres.js"), Te = await import("/src/temps.js");
    const g = { lat: 47.5, lon: 4.3 };
    const p = Te.depuis(0, 0, 0);
    const soir = A.bandeauAccueil(g, new Date("2026-08-18T19:30:00+02:00"), p, 0).ciel;
    const midi = A.bandeauAccueil(g, new Date("2026-08-18T13:30:00+02:00"), p, 0).ciel;
    return { soir: /ci-astre[^"]* derriere/.test(soir), midi: /ci-astre[^"]* derriere/.test(midi), seuil: A.SEUIL_TEXTE };
  });
  ok("un astre bas, derrière le texte de l'accueil, s'adoucit ; haut, il garde son éclat",
    astres.soir && !astres.midi, JSON.stringify(astres));
  await c.close();

  /* Une version plus récente publiée, version 207 : l'avis flottant
     recharge la page, signalé par Jérôme le 16 octobre 2026, et les réglages
     disent la version sur sa ligne, le bouton dessous. */
  const c2 = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c2.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(c2);
  await c2.route(/api\.rainviewer\.com/, r => r.abort());
  await c2.route(/\/sw\.js\?v=/, r => r.fulfill({ status: 200, contentType: "text/javascript", body: 'const VERSION = "ma-meteo-v999";' }));
  const p2 = await c2.newPage();
  await ouvrirPage(p2);
  await p2.waitForFunction(() => { const e = document.getElementById("majAvis"); return !!e && !e.hidden; }, null, { timeout: 9000 }).catch(() => {});
  await p2.evaluate(() => { window.__avant = 1; });
  const avis = await p2.evaluate(() => document.getElementById("majAvis")?.textContent || "");
  await Promise.all([p2.waitForEvent("load", { timeout: 9000 }).catch(() => null),
    p2.locator('#majAvis [data-action="recharger"]').click({ timeout: 3000 }).catch(() => {})]);
  const recharge = await p2.evaluate(() => window.__avant === undefined).catch(() => false);
  ok("l'avis d'une version plus récente recharge la page",
    /La version 999 est disponible/.test(avis) && recharge, JSON.stringify({ avis, recharge }));
  await reposer(p2, 2000);
  await p2.locator("#btnReglages").click(); await p2.waitForTimeout(600);
  await p2.locator("#rgChercher").click();
  await p2.waitForFunction(() => /disponible/.test(document.getElementById("rgMaj")?.textContent || ""), null, { timeout: 6000 }).catch(() => {});
  const maj = await p2.evaluate(() => {
    const t = document.querySelector("#rgMaj span")?.getBoundingClientRect(), b = document.getElementById("rgRecharger")?.getBoundingClientRect();
    const ch = document.getElementById("rgChercher").getBoundingClientRect();
    return { texte: document.querySelector("#rgMaj span")?.textContent || "", sousChercher: t ? t.top >= ch.bottom - 1 : false,
      boutonDessous: t && b ? b.top >= t.bottom - 1 : false };
  });
  ok("les réglages disent la version disponible sous la recherche, le bouton de rechargement dessous",
    maj.texte === "La version 999 est disponible." && maj.sousChercher && maj.boutonDessous, JSON.stringify(maj));
  await c2.close();

  /* Version 219 : une prévision lente arrive quand même. Le 17 octobre 2026,
     Open-Meteo mettait jusqu'à dix secondes à calculer les journées, et
     l'accueil restait sur « Prévision indisponible ». La réponse des journées
     est ici retenue douze secondes. */
  const c3 = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c3.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(c3);
  await c3.route(/api\.rainviewer\.com/, r => r.abort());
  await c3.route(/api\.open-meteo\.com\/v1\/forecast\?.*daily=/, async r => {
    await new Promise(z => setTimeout(z, 12000));
    await r.fallback().catch(() => {});
  });
  const p3 = await c3.newPage();
  await ouvrirPage(p3);
  const lente = await p3.waitForFunction(() => {
    const d = document.querySelector(".plein-titre .bd-deg");
    return d && /^\d+/.test(d.textContent.trim()) && !/indisponible/i.test(document.getElementById("ecran").textContent);
  }, null, { timeout: 25000 }).then(() => true).catch(() => false);
  const texte = await p3.evaluate(() => document.getElementById("ecran").textContent.slice(0, 120));
  ok("une prévision lente de douze secondes arrive quand même à l'accueil", lente, texte);
  await c3.close();
};
