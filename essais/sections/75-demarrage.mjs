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
  await c.close();
};
