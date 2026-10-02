/* La politique de sécurité du contenu. Section écrite le 2 octobre 2026 pour le
   constat 2.5 de l'audit ; elle part d'un état neuf préparé par
   essais/banc.mjs. */

export const titre = "La politique de sécurité du contenu";
export const avecPage = false;

export default async T => {
  const { nav, ok, brancherRoutes, ouvrirPage, reposer, RACINE_HTTP } = T;
  const { FAIN, amorce } = await import("../faux-services.mjs");

  /* La lecture du code : toute adresse appelée par un module de la coque figure
     dans la politique. Les liens, `href`, sont des navigations, que la
     politique ne règle pas. Une source ajoutée sans mise à jour de la balise
     serait coupée sans bruit. */
  const html = await (await fetch(`${RACINE_HTTP}index.html`)).text();
  const politique = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] || "";
  const directive = nom => (new RegExp(`(?:^|;)\\s*${nom} ([^;]+)`).exec(politique)?.[1] || "").split(/\s+/);
  const permises = new Set([...directive("connect-src"), ...directive("img-src")]);
  /* Les adresses de liens construites dans le code, posées ensuite en `href` :
     des navigations, que la politique ne règle pas. */
  const LIENS = new Set(["https://vigilance.meteofrance.fr", "https://baignades.sante.gouv.fr"]);
  const sw = await (await fetch(`${RACINE_HTTP}sw.js`)).text();
  const modules = [...sw.matchAll(/"\.\/(src\/[^"]+\.js)"/g)].map(m => m[1]);
  const manquantes = new Set();
  for (const m of modules) {
    const code = (await (await fetch(`${RACINE_HTTP}${m}`)).text()).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const x of code.matchAll(/(href=["'`]?)?(https:\/\/[a-z0-9.-]+\.[a-z]+)/g)) {
      if (x[1] || LIENS.has(x[2])) continue;
      if (!permises.has(x[2])) manquantes.add(`${x[2]} (${m})`);
    }
  }
  ok("la politique de sécurité autorise toute source que le code appelle, et seulement le site pour les scripts",
    politique !== "" && manquantes.size === 0 && directive("script-src").join(" ") === "'self'",
    [...manquantes].join(" ; ") || politique.slice(0, 80));

  /* Le parcours : les écrans, la carte toutes couches allumées, le ciel plein
     écran et trois feuilles ne déclenchent aucun refus de la politique. */
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c.addInitScript(amorce(FAIN));
  await c.addInitScript(() => {
    window.__refus = [];
    document.addEventListener("securitypolicyviolation", e =>
      window.__refus.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  await brancherRoutes(c);
  const p = await c.newPage();
  await ouvrirPage(p);
  await reposer(p, 1500);
  const refus = [];
  const relever = async () => refus.push(...await p.evaluate(() => window.__refus.splice(0)));
  for (const cle of ["semaine", "ciel", "carte"]) {
    await p.locator(`[data-onglet="${cle}"]`).click();
    await reposer(p, 1500);
  }
  await p.locator("#caCouches").click();
  await p.waitForTimeout(200);
  for (const id of ["#caPluie", "#caVent", "#caVigi", "#caFoudre", "#caNuages", "#caFeux", "#caPrevi", "#caAir"]) {
    const b = p.locator(id);
    if (await b.getAttribute("aria-checked") !== "true") await b.click();
    await p.waitForTimeout(150);
  }
  await reposer(p, 2500);
  await relever();
  await p.locator('[data-onglet="ciel"]').click();
  await reposer(p, 1500);
  if (await p.locator('[data-ciel="etoiles"]').count()) {
    await p.locator('[data-ciel="etoiles"]').click();
    await reposer(p, 2000);
    if (await p.locator("#ciBandeau").count()) {
      await p.locator("#ciBandeau").click();
      await p.waitForTimeout(600);
      await p.locator("#ciFermer").click();
    }
  }
  await p.locator('[data-onglet="accueil"]').click();
  await reposer(p, 1000);
  for (const f of ["#btnReglages", '.porte[data-feuille="air"]', '.porte[data-feuille="beautemps"]']) {
    if (!await p.locator(f).count()) { refus.push(`porte absente ${f}`); continue; }
    await p.locator(f).first().click();
    await reposer(p, 1500);
    await p.locator("#feuille-fermer").click();
    await p.waitForTimeout(400);
  }
  await relever();
  await c.close();
  ok("aucun écran ne déclenche de refus de la politique de sécurité", refus.length === 0,
    [...new Set(refus)].slice(0, 5).join(" ; "));
};
