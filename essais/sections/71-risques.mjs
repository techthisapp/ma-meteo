/* Les risques de la commune, Géorisques. Section écrite le 11 octobre 2026,
   version 191. Elle part d'un état neuf préparé par essais/banc.mjs ; le faux
   service est décrit dans `faux-services.mjs`, au voisinage de
   `GEORISQUES`. Tout point y est à Grenoble. */
import { FIGE, FAIN, amorceGardee, GEORISQUES } from "../faux-services.mjs";

export const titre = "Les risques de la commune";
export const avecPage = false;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, reposer } = T;
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(c);
  await c.route(/api\.rainviewer\.com/, r => r.abort());
  const p = await c.newPage();
  await ouvrirPage(p);
  await reposer(p, 2500);

  ok("les risques se lisent par familles, les arrêtés par type et du plus récent, le sol par classes",
    await p.evaluate(async G => {
      const R = await import("/src/risques.js");
      const f = R.lireRisques(G.risques), c = R.lireCatnat(G.catnat);
      return [f.map(x => `${x.nom}(${x.details.length})`).join(","), c.n, c.parType["Inondations et/ou Coulées de Boue"],
        c.derniers.map(x => x.debut).join(","), R.lireSeisme(G.seisme), R.lireRadon(G.radon), R.lireArgiles(G.rga),
        String(R.lireArgiles(null)), R.resume({ risques: f, seisme: 4 })].join(" | ");
    }, GEORISQUES) === "Inondation(2),Séisme(0),Transport de marchandises dangereuses(0) | 3 | 2 | 2022-04-01,2018-01-21,2001-07-06"
      + " | 4 | 1 | 2 | null | Inondation, Transport de marchandises dangereuses, sismicité moyenne");

  /* La porte de l'accueil se complète à l'arrivée des risques. */
  const porte = await p.evaluate(() => document.querySelector('[data-feuille="risques"] [data-info="risques"] .porte-txt')?.textContent || "");
  const jauge = await p.evaluate(() => { const j = document.querySelector('[data-feuille="risques"] [data-info="risques"] .jg');
    return j ? `${j.querySelectorAll("i.jg-on").length}/${j.querySelectorAll("i").length} ${j.textContent}` : ""; });
  const appels = etat.appelsGeorisques.map(u => u.replace(/^.*\/api\/v1\//, "").replace(/\?.*$/, "")).sort().join(",");
  ok("une porte de l'accueil mène aux risques, et dit les premiers",
    porte === "Inondation, Transport de marchandises dangereuses, sismicité moyenne" && appels === "gaspar/catnat,gaspar/risques,radon,rga,zonage_sismique"
    && etat.appelsGeorisques.every(u => /code_insee=38185|latlon=4\.3,47\.5/.test(u)),
    `${porte} ; ${appels} ; ${etat.appelsGeorisques.join(" ")}`);
  /* Version 196 : la porte porte la jauge de la zone sismique, à son arrivée. */
  ok("la porte des risques porte la jauge de la zone sismique, quatre cases pleines sur cinq à Grenoble",
    jauge === "4/5 séisme", jauge);

  /* La feuille, sans nouvelle requête. */
  const avant = etat.appelsGeorisques.length;
  await p.locator('[data-feuille="risques"]').click();
  await reposer(p, 1500);
  const feuille = await p.evaluate(() => ({
    titre: document.getElementById("feuille-titre")?.textContent || document.querySelector("#feuille h2")?.textContent || "",
    texte: document.getElementById("feuille-corps").textContent.replace(/\s+/g, " ") }));
  ok("la feuille des risques porte les familles, les catastrophes naturelles et le sol, sans relire",
    /Inondation\s*Par une crue à débordement lent de cours d'eau ; Par une crue torrentielle/.test(feuille.texte)
    && /3 arrêtés de catastrophe naturelle depuis 1982 : inondations et\/ou coulées de boue, 2 ; sécheresse, 1\./.test(feuille.texte)
    && /Séisme\s*zone 4 sur 5, moyenne/.test(feuille.texte) && /exposition moyenne/.test(feuille.texte)
    && /potentiel faible, 1 sur 3/.test(feuille.texte) && etat.appelsGeorisques.length === avant,
    `${etat.appelsGeorisques.length - avant} requêtes ; ${feuille.texte.slice(0, 600)}`);
  await c.close();
};
