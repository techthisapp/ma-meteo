/* Les textes et les sources. Section écrite le 3 octobre 2026 pour le jalon
   20, lot 1 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Les textes et les sources";
export const avecPage = true;

/* Les noms de sources qui ne doivent plus se lire sur les écrans : ils vivent
   dans la carte « Sources » des réglages. La carte garde son bouton des
   sources, que les licences demandent. */
const NOMS = ["Open-Meteo", "AROME", "ERA5", "Hub'eau", "OpenSkiMap", "HYG", "d3-celestial", "Atmo France",
  "Agence européenne", "OSRM", "data.gouv", "Copernicus", "BRGM"];

export default async T => {
  const { pg, ok, onglet, ecranCiel, reposer } = T;
  const lire = () => pg.evaluate(() => {
    const f = document.getElementById("feuille");
    return (f && !f.hidden ? document.getElementById("feuille-corps") : document.getElementById("ecran")).textContent;
  });
  const vus = {};
  await onglet("accueil"); await reposer(pg, 1200); vus.accueil = await lire();
  await onglet("semaine"); await reposer(pg, 1200); vus.avenir = await lire();
  for (const c of ["soleil", "lune", "etoiles"]) { await ecranCiel(pg, c); await reposer(pg, 1500); vus[c] = await lire(); }
  await onglet("accueil"); await reposer(pg, 1000);
  for (const f of ["air", "climat"]) {
    const porte = pg.locator(`.porte[data-feuille="${f}"]`).first();
    if (!await porte.count()) continue;
    await porte.click(); await reposer(pg, 2000);
    vus[f] = await lire();
    await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(400);
  }
  const cites = Object.entries(vus).flatMap(([e, t]) => NOMS.filter(n => t.includes(n)).map(n => `${e}:${n}`));
  ok("aucun écran ne cite plus de source, l'accueil, À venir, le ciel, l'air et le climat compris",
    Object.keys(vus).length >= 7 && cites.length === 0, JSON.stringify({ ecrans: Object.keys(vus), cites }));

  /* Les explications sont derrière le « i », fermées à l'arrivée ; un appui
     les ouvre. */
  await onglet("semaine"); await reposer(pg, 1200);
  const aide = await pg.evaluate(async () => {
    const d = [...document.querySelectorAll("#ecran details.aide")];
    const fermees = d.every(x => !x.open);
    const t = d[0]?.querySelector(".aide-txt");
    /* Chromium mesure le texte d'un élément fermé sans l'afficher : la
       visibilité se demande au navigateur. */
    const avant = t ? t.checkVisibility() : null;
    d[0]?.querySelector("summary").click();
    await new Promise(r => setTimeout(r, 200));
    return { n: d.length, fermees, avant,
      apresVu: t ? t.checkVisibility() : null, ouvert: d[0]?.open === true, cible: Math.round(d[0]?.querySelector("summary").getBoundingClientRect().height || 0) };
  });
  ok("les explications attendent derrière le bouton « i », qu'un appui ouvre",
    aide.n >= 1 && aide.fermees && aide.avant === false && aide.apresVu === true && aide.ouvert && aide.cible >= 44,
    JSON.stringify(aide));

  /* La carte des sources des réglages les nomme toutes, et la section du
     rappel automatique sur iPhone n'y est plus. */
  await onglet("accueil"); await reposer(pg, 800);
  await pg.locator("#btnReglages").click(); await reposer(pg, 1200);
  const reglages = await pg.evaluate(() => {
    const c = [...document.querySelectorAll("#feuille-corps .carte")].find(x => x.querySelector("h3")?.textContent === "Sources");
    return { sources: c?.textContent || "", tout: document.getElementById("feuille-corps").textContent };
  });
  const manquent = NOMS.filter(n => !reglages.sources.includes(n));
  await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(400);
  ok("la carte des sources des réglages nomme toutes les sources retirées des écrans",
    manquent.length === 0 && !/Rappel automatique/.test(reglages.tout), JSON.stringify({ manquent }));
};
