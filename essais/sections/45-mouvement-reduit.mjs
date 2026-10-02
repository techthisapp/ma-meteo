/* Mouvement réduit. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { METEO } from "../faux-services.mjs";

export const titre = "Mouvement réduit";
export const avecPage = false;

export default async T => {
  const { nav, ok, ouvrirPage } = T;
  const ctx2 = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    reducedMotion: "reduce",
  });
  await ctx2.addInitScript(`{
  localStorage.setItem("mameteo.reglages.v1", JSON.stringify({
    commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
    ecriture: "ruban", poste: null
  }));
}`);
  await ctx2.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    if (u.includes("hourly=")) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hourly: d.hourly }) }); return; }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  const pg2 = await ctx2.newPage();
  await ouvrirPage(pg2);
  await pg2.waitForTimeout(600);
  ok("les transitions sont neutralisées", await pg2.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector(".nav")).transitionDuration) < 0.001));
  await ctx2.close();
};
