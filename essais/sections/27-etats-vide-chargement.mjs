/* États vide et chargement. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FAIN, amorce } from "../faux-services.mjs";

export const titre = "États vide et chargement";
export const avecPage = true;

export default async T => {
  const { nav, ok, brancherRoutes, ouvrirPage, RACINE_HTTP, onglet, reposer } = T;
  const ctxVide = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  const pgVide = await ctxVide.newPage();
  await ouvrirPage(pgVide);
  await pgVide.waitForTimeout(500);
  ok("l'état vide porte un symbole, un titre, une phrase et une action",
    await pgVide.locator(".etat-vide > svg").count() === 1
    && await pgVide.locator(".etat-vide h2").count() === 1
    && await pgVide.locator(".etat-vide p").count() === 1
    && await pgVide.locator(".etat-vide .bouton-plein").count() === 1);
  ok("l'état vide propose une action secondaire",
    await pgVide.locator('.etat-vide .bouton-borde[data-action="geo"]').count() === 1);
  await ctxVide.close();

  /* Le changement d'heure, vérifié le 1er octobre 2026 : Open-Meteo écrit toute
     une réponse avec le décalage du moment de la requête, vingt-quatre heures
     par jour. Une prévision lue en heure d'été autour du 25 octobre se lit à
     l'heure de Paris, l'heure en double retirée ; lue en heure d'hiver autour du
     28 mars 2027, elle porte vingt-trois heures ce jour-là et ses quatre moments
     s'ouvrent. La température vaut le rang de l'heure dans la réponse : midi le
     26 octobre, à l'heure d'hiver, est la heure écrite 13 h, rang 61. */
  const ctxHeure = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxHeure.route(/api\.open-meteo\.com/, route => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("models")) { route.fulfill({ status: 404, body: "" }); return; }
    const ete = u.searchParams.get("latitude") === "45.5";
    const jours = ete ? ["2026-10-24", "2026-10-25", "2026-10-26"] : ["2027-03-27", "2027-03-28", "2027-03-29"];
    const d = { utc_offset_seconds: ete ? 7200 : 3600 };
    const colonnes = nom => (u.searchParams.get(nom) || "").split(",").filter(Boolean);
    if (colonnes("daily").length) d.daily = { time: jours, ...Object.fromEntries(colonnes("daily").map(c => [c, jours.map(() => 1)])) };
    if (colonnes("hourly").length) {
      const time = jours.flatMap(j => Array.from({ length: 24 }, (_, h) => `${j}T${String(h).padStart(2, "0")}:00`));
      d.hourly = { time, ...Object.fromEntries(colonnes("hourly").map(c => [c, time.map((_, i) => i)])) };
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  const pgHeure = await ctxHeure.newPage();
  await ouvrirPage(pgHeure);
  const heureDit = await pgHeure.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const h = (await P.charger({ lat: 45.5, lon: 5 }))?.hourly;
    const oct25 = h ? h.time.filter(t => t.startsWith("2026-10-25")).length : -1;
    const midi26 = h ? h.temperature_2m[h.time.indexOf("2026-10-26T12:00")] : null;
    const m = (await P.charger({ lat: 46.5, lon: 5 }))?.hourly;
    const mars28 = m ? m.time.filter(t => t.startsWith("2027-03-28")).length : -1;
    return { oct25, midi26, mars28, moments: P.momentsJour("2027-03-28")?.length ?? null };
  });
  ok("une prévision lue en heure d'été se lit à l'heure de Paris après le passage à l'heure d'hiver",
    heureDit.oct25 === 24 && heureDit.midi26 === 61, JSON.stringify(heureDit));
  ok("le jour du passage à l'heure d'été porte vingt-trois heures et ouvre ses quatre moments",
    heureDit.mars28 === 23 && heureDit.moments === 4, JSON.stringify(heureDit));
  await ctxHeure.close();

  /* Audit du 1er octobre 2026, lot B. Une fausse prévision construite autour du
     jour réel, rapide, lente ou en panne selon `modeLieux`. Le lieu A, latitude
     45,5, porte des températures à partir de 100 ; le lieu B, à partir de 200.
     La page n'a pas de commune : seul le contrôle demande des prévisions. */
  let modeLieux = "ok";
  const jourParis = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const ctxLotB = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxLotB.route(/open-meteo\.com/, async route => {
    const u = new URL(route.request().url());
    if (modeLieux === "panne" || u.searchParams.get("models")?.startsWith("meteofrance")) { route.abort(); return; }
    const a = u.searchParams.get("latitude") === "45.5";
    if (!a) {
      if (!u.hostname.startsWith("api.")) { route.fulfill({ status: 500, body: "" }); return; }
    } else if (modeLieux === "lent") await new Promise(r => setTimeout(r, 1500));
    const base = a ? 100 : 200;
    const j0 = new Date(`${jourParis()}T12:00:00Z`);
    const jours = [-1, 0, 1].map(k => new Date(j0.getTime() + k * 864e5).toISOString().slice(0, 10));
    const colonnes = nom => (u.searchParams.get(nom) || "").split(",").filter(Boolean);
    const membres = c => (u.hostname.startsWith("ensemble") ? [c, `${c}_member01`, `${c}_member02`, `${c}_member03`] : [c]);
    const d = {};
    if (colonnes("daily").length) d.daily = { time: jours, ...Object.fromEntries(colonnes("daily").map(c => [c, jours.map(() => base)])) };
    if (colonnes("hourly").length) {
      const time = jours.flatMap(j => Array.from({ length: 24 }, (_, h) => `${j}T${String(h).padStart(2, "0")}:00`));
      d.hourly = { time, ...Object.fromEntries(colonnes("hourly").flatMap(membres).map(c => [c, time.map((_, i) => base + i)])) };
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  const pgLotB = await ctxLotB.newPage();
  await ouvrirPage(pgLotB);

  /* Constat 1.1 : hors connexion, après un changement d'heure, la dernière
     prévision gardée pour le lieu reste servie. La page rechargée n'a plus rien
     en mémoire : seule la prévision gardée peut répondre. */
  await pgLotB.evaluate(async () => {
    const P = await import("/src/previsions.js");
    await P.charger({ lat: 45.5, lon: 5 });
    const c = JSON.parse(localStorage.getItem("mameteo.previsions.v1"));
    c.h = "2000-01-01T00";
    localStorage.setItem("mameteo.previsions.v1", JSON.stringify(c));
  });
  modeLieux = "panne";
  await pgLotB.reload(); await pgLotB.waitForTimeout(400);
  const gardeeDit = await pgLotB.evaluate(async () => {
    const P = await import("/src/previsions.js");
    return (await P.charger({ lat: 45.5, lon: 5 }))?.hourly?.temperature_2m?.[0] ?? null;
  });
  ok("hors connexion, la dernière prévision gardée pour le lieu reste servie", gardeeDit === 100, String(gardeeDit));

  /* Constat 1.10 : un premier chargement manqué, puis le retour dans
     l'application, relit la prévision. */
  await pgLotB.evaluate(() => localStorage.clear());
  await pgLotB.reload(); await pgLotB.waitForTimeout(400);
  const relanceDit = await pgLotB.evaluate(async () => {
    const P = await import("/src/previsions.js");
    await P.charger({ lat: 45.5, lon: 5 });
    let appels = 0;
    P.surRetourAuPremierPlan(() => { appels++; });
    document.dispatchEvent(new Event("visibilitychange"));
    return appels;
  });
  ok("après un premier chargement manqué, le retour dans l'application relit la prévision", relanceDit === 1, String(relanceDit));

  /* Constat 1.2 : la commune A est en mémoire, sa relecture est lente ; la
     commune B est demandée ensuite et répond vite. La prévision de A est oubliée
     dès la demande de B, et sa réponse tardive n'écrase pas celle de B. */
  modeLieux = "ok";
  await pgLotB.evaluate(async () => {
    const P = await import("/src/previsions.js");
    await P.charger({ lat: 45.5, lon: 5 });
    localStorage.clear();
  });
  modeLieux = "lent";
  const melangeDit = await pgLotB.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const pA = P.charger({ lat: 45.5, lon: 5 });
    const pB = P.charger({ lat: 46.5, lon: 5 });
    const oubliee = P.chargeCourante() === null;
    await pB; await pA;
    return { oubliee, finale: P.chargeCourante()?.hourly?.temperature_2m?.[0] ?? null };
  });
  ok("une commune demandée oublie aussitôt la prévision de la précédente", melangeDit.oubliee, JSON.stringify(melangeDit));
  ok("une réponse lente de la commune précédente n'écrase pas la prévision de la suivante",
    melangeDit.finale === 200, JSON.stringify(melangeDit));

  /* Constat 1.2, suite : l'air, l'ensemble et les scénarios. A répond lentement,
     B en erreur ; la réponse tardive de A ne doit pas reparaître sous B. */
  const sourcesDit = await pgLotB.evaluate(async () => {
    const Air = await import("/src/air.js"), Ens = await import("/src/ensemble.js"), Sc = await import("/src/scenarios.js");
    localStorage.clear();
    const jours = ["2026-08-17", "2026-08-18", "2026-08-19"];
    const daily = { time: jours };
    for (const m of ["icon", "ecmwf"]) for (let k = 1; k <= 5; k++) daily[`temperature_2m_max_member0${k}_${Sc.MODELES[m].suffixe}`] = jours.map(() => 20 + k);
    const lent = () => new Promise(r => setTimeout(() => r({ ok: true, json: async () => ({ daily }) }), 1500));
    const panne = async () => ({ ok: false, status: 500 });
    const pAir = Air.charger({ lat: 45.5, lon: 5 }), pEns = Ens.charger({ lat: 45.5, lon: 5 });
    const pSc = Sc.charger({ lat: 45.5, lon: 5 }, lent);
    await Promise.all([Air.charger({ lat: 46.5, lon: 5 }), Ens.charger({ lat: 46.5, lon: 5 }), Sc.charger({ lat: 46.5, lon: 5 }, panne)]);
    await Promise.all([pAir, pEns, pSc]);
    return { air: Air.chargeCourante() === null, ensemble: Ens.chargeCourante() === null, scenarios: Sc.chargee() === null };
  });
  ok("l'air, l'ensemble et les scénarios d'une commune précédente ne reparaissent pas sous la suivante",
    sourcesDit.air && sourcesDit.ensemble && sourcesDit.scenarios, JSON.stringify(sourcesDit));

  /* Constats 1.4 et 1.5, sur les fonctions seules. */
  const lotBPur = await pgLotB.evaluate(async () => {
    const Eau = await import("/src/eau.js"), C = await import("/src/comparaison.js");
    const repond = statut => async u => (u.includes("vigieau") && statut === 200
      ? { ok: true, json: async () => [] } : { ok: false, status: 500, json: async () => ({}) });
    const enPanne = Eau.tuileEau(await Eau.chargerEau({ lat: 44.11, lon: 3.11 }, "2026-08-18", repond(500)));
    const sansZone = Eau.tuileEau(await Eau.chargerEau({ lat: 44.22, lon: 3.22 }, "2026-08-18", repond(200)));
    const d = C.datesDe("7p", "2027-01-03");
    return { panne: enPanne?.valeur, vide: sansZone?.valeur,
      meme: C.memesDates(d, 2027, 2027).join(" ") === d.join(" "),
      autre: `${C.memesDates(d, 2025, 2027)[0]} ${C.memesDates(d, 2025, 2027)[6]}` };
  });
  ok("une panne de VigiEau ne se lit pas comme une absence de restriction",
    lotBPur.panne === "—" && lotBPur.vide === "Aucune", JSON.stringify(lotBPur));
  ok("une période qui chevauche le 1er janvier garde ses deux années dans une autre année",
    lotBPur.meme && lotBPur.autre === "2024-12-27 2025-01-02", JSON.stringify(lotBPur));
  await ctxLotB.close();

  /* Constats 3.1 à 3.5, l'agent de service. Le texte d'abord : une installation
     incomplète échoue, les fichiers se demandent sans le cache du navigateur, le
     ciel des étoiles et les icônes sont dans la copie. */
  const coqueTexte = await (await fetch(`${RACINE_HTTP}sw.js`)).text();
  ok("une installation incomplète ne remplace pas la version en place",
    !/catch\(\(\) => self\.skipWaiting\(\)\)/.test(coqueTexte) && /new Request\(u, \{ cache: "reload" \}\)/.test(coqueTexte));
  ok("la copie hors ligne garde le ciel des étoiles et les icônes",
    ["./donnees/ciel.json", "./icones/icone-180.png", "./icones/icone-maskable-512.png"].every(f => coqueTexte.includes(`"${f}"`)));

  /* Puis le comportement : l'application installée se recharge hors connexion,
     un fichier absent n'est pas remplacé par la page, et la recherche de
     version, faite en ligne, n'a rien laissé dans la copie. */
  const ctxCoque = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  const pgCoque = await ctxCoque.newPage();
  await ouvrirPage(pgCoque);
  await pgCoque.evaluate(() => navigator.serviceWorker.ready);
  await pgCoque.reload();
  await pgCoque.waitForTimeout(4800);
  await ctxCoque.setOffline(true);
  await pgCoque.reload();
  await pgCoque.waitForTimeout(800);
  const coqueDit = await pgCoque.evaluate(async () => ({
    controle: !!navigator.serviceWorker.controller,
    ecran: !!document.getElementById("ecran"),
    absent: await fetch("./src/absent.js").then(r => `${r.status} ${(r.headers.get("content-type") || "").split(";")[0]}`, () => "échec"),
    parametres: (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys())
      .filter(r => new URL(r.url).search).length))).reduce((a, n) => a + n, 0),
  }));
  ok("hors connexion, l'application se recharge et seule une navigation reçoit la page en secours",
    coqueDit.controle && coqueDit.ecran && coqueDit.absent === "échec", JSON.stringify(coqueDit));
  ok("une adresse à paramètres n'entre pas dans la copie hors ligne", coqueDit.parametres === 0, JSON.stringify(coqueDit));
  await ctxCoque.close();

  /* Audit du 1er octobre 2026, lot C, la confidentialité. */
  const ctxLotC = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  const pgLotC = await ctxLotC.newPage();
  await ouvrirPage(pgLotC);

  /* Constats 2.3 et 2.4, sur les fonctions seules : l'élagage des caches par
     lieu, et les liens venus d'un service. */
  const lotCPur = await pgLotC.evaluate(async () => {
    const H = await import("/src/horloge.js"), Eau = await import("/src/eau.js");
    const t = 1_000_000_000;
    const c = { vieux: { t: t - 50 } };
    for (let k = 0; k < 30; k++) c[`p${k}`] = { t: t - k };
    H.elaguer(c, 40, t);
    /* Deux entrées seulement : le plafond ne joue pas, seule la péremption
       retire la plus vieille. */
    const deux = H.elaguer({ vieux: { t: t - 50 }, neuf: { t: t - 1 } }, 40, t);
    return { restent: Object.keys(c).length, vieux: "vieux" in c, recent: "p0" in c, ancien: "p29" in c,
      perime: Object.keys(deux).join(" "),
      js: Eau.lienSur("javascript:alert(1)"), http: Eau.lienSur("http://exemple.gouv.fr/a.pdf"),
      https: Eau.lienSur("https://exemple.gouv.fr/a.pdf") };
  });
  ok("les caches par lieu oublient les entrées périmées et n'en gardent que vingt",
    lotCPur.restent === 20 && !lotCPur.vieux && lotCPur.recent && !lotCPur.ancien && lotCPur.perime === "neuf",
    JSON.stringify(lotCPur));
  ok("un lien venu d'un service n'entre dans la page qu'en https",
    lotCPur.js === null && lotCPur.http === null && lotCPur.https === "https://exemple.gouv.fr/a.pdf", JSON.stringify(lotCPur));

  /* Constat 2.1 : les réglages nomment tous les services qui reçoivent le lieu,
     et ne prétendent plus qu'aucune donnée n'est envoyée. */
  await pgLotC.locator("#btnReglages").click();
  await pgLotC.waitForTimeout(600);
  const reglagesDit = await pgLotC.evaluate(() => document.getElementById("feuille-corps")?.textContent || "");
  ok("les réglages disent quels services reçoivent le lieu affiché",
    !/aucune donnée envoyée/i.test(reglagesDit)
    && ["Open-Meteo", "Météo-France", "data.gouv.fr", "Atmo France", "VigiEau", "Hub'eau", "OSRM", "RainViewer", "EUMETSAT"]
      .every(m => reglagesDit.includes(m)) && /arrondies à un kilomètre/.test(reglagesDit),
    reglagesDit.slice(0, 160));

  /* Constat 2.3 : le bouton efface tout ce que l'application garde, après
     confirmation. */
  await pgLotC.evaluate(() => {
    localStorage.setItem("mameteo.plage.proches.v1", JSON.stringify({ "45.190,5.720": { t: Date.now(), l: [] } }));
    localStorage.setItem("autre.application", "garde");
  });
  pgLotC.once("dialog", d => d.accept());
  await Promise.all([pgLotC.waitForEvent("load"), pgLotC.locator("#rgEffacer").click()]);
  await pgLotC.waitForTimeout(400);
  /* L'application rechargée peut réécrire ses réglages par défaut : le
     contrôle juge la clé qu'il a posée lui-même. */
  const effaceDit = await pgLotC.evaluate(() => ({
    plage: localStorage.getItem("mameteo.plage.proches.v1"), autre: localStorage.getItem("autre.application") }));
  ok("le bouton d'effacement retire les données de l'application, et elles seules",
    effaceDit.plage === null && effaceDit.autre === "garde", JSON.stringify(effaceDit));
  await ctxLotC.close();

  /* Audit du 1er octobre 2026, lot E, les performances. Constats 5.2 et 5.7, sur
     le texte : les sources secondaires passent par le rendu regroupé, et toute
     toile plafonne sa densité à 2. */
  const appTexte = await (await fetch(`${RACINE_HTTP}src/app.js`)).text();
  const regroupeTexte = ["lireNeigeDe", "lirePlageDe", "lireEauDe", "lireEnsemble", "lireAir", "lirePluieProche"].map(f => {
    const i = appTexte.indexOf(`async function ${f}(`);
    const corps = appTexte.slice(i, appTexte.indexOf("\n}\n", i));
    return `${f}:${/rafraichir\(\)/.test(corps) && !/\brendre\(\);/.test(corps)}`;
  });
  ok("les sources secondaires passent par le rendu regroupé", regroupeTexte.every(x => x.endsWith(":true")), regroupeTexte.join(" "));
  const densiteTexte = [];
  /* La peinture des étoiles a quitté vues/etoiles.js pour voute.js en version
     176. */
  for (const f of ["carte", "vent", "temps", "feu", "relief", "voute", "vues/climat"]) {
    const t = await (await fetch(`${RACINE_HTTP}src/${f}.js`)).text();
    const usages = t.match(/[^\n]{0,30}devicePixelRatio/g) || [];
    densiteTexte.push(`${f}:${usages.length && usages.every(u => /Math\.min\(2, window\.devicePixelRatio/.test(u))}`);
  }
  ok("toute toile plafonne sa densité à 2", densiteTexte.every(x => x.endsWith(":true")), densiteTexte.join(" "));

  /* Constats 5.3 et 5.4, en page. Les écouteurs de redimensionnement se
     comptent : quatre allers et retours sur la carte ne doivent pas en
     ajouter. */
  const ctxLotE = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxLotE.addInitScript(amorce(FAIN));
  await ctxLotE.addInitScript(() => {
    const actifs = new Set();
    const ajouter = window.addEventListener.bind(window), retirer = window.removeEventListener.bind(window);
    window.addEventListener = (t, f, o) => { if (t === "resize") actifs.add(f); return ajouter(t, f, o); };
    window.removeEventListener = (t, f, o) => { if (t === "resize") actifs.delete(f); return retirer(t, f, o); };
    window.__redimensions = () => actifs.size;
  });
  await brancherRoutes(ctxLotE);
  const pgLotE = await ctxLotE.newPage();
  await ouvrirPage(pgLotE);
  await pgLotE.locator('[data-onglet="carte"]').click(); await pgLotE.waitForTimeout(700);
  const ecouteursDit = { premier: await pgLotE.evaluate(() => window.__redimensions()) };
  for (let k = 0; k < 4; k++) {
    await pgLotE.locator('[data-onglet="accueil"]').click(); await pgLotE.waitForTimeout(300);
    await pgLotE.locator('[data-onglet="carte"]').click(); await pgLotE.waitForTimeout(500);
  }
  ecouteursDit.apres = await pgLotE.evaluate(() => window.__redimensions());
  ok("la carte redessinée ne multiplie pas ses écouteurs", ecouteursDit.apres === ecouteursDit.premier, JSON.stringify(ecouteursDit));

  /* Constats 5.6 et 5.9 : le ciel animé de l'accueil s'arrête quand le
     défilement le sort de l'écran et reprend à son retour ; un retour au
     premier plan ne lance pas une seconde boucle, ce qui doublerait le rythme
     des images demandées. */
  await pgLotE.locator('[data-onglet="accueil"]').click(); await pgLotE.waitForTimeout(700);
  const animeDit = await pgLotE.evaluate(async () => {
    const T = await import("/src/temps.js");
    const attendre = ms => new Promise(r => setTimeout(r, ms));
    const haut = T.anime();
    window.scrollTo(0, document.documentElement.scrollHeight); await attendre(500);
    const bas = T.anime();
    window.scrollTo(0, 0); await attendre(500);
    const retour = T.anime();
    /* Le compte des images demandées dépendait de la vitesse de la machine :
       le 5 octobre 2026, une machine de GitHub chargée en a compté 18 avant
       et 30 après, sans aucune boucle doublée. La mesure compte désormais,
       pour chaque fonction de boucle, combien de demandes sont en attente à
       la fois : une boucle seule n'en a jamais plus d'une, une boucle doublée
       en a deux, quelle que soit la cadence. */
    const raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
    const enAttente = new Map(), parId = new Map();
    let n = 0, pire = 0;
    const moins = f => enAttente.set(f, enAttente.get(f) - 1);
    window.requestAnimationFrame = f => {
      n++;
      const c = (enAttente.get(f) || 0) + 1;
      enAttente.set(f, c);
      pire = Math.max(pire, c);
      const id = raf(t => { parId.delete(id); moins(f); f(t); });
      parId.set(id, f);
      return id;
    };
    // Une demande annulée n'est plus en attente : un nouveau rendu en annule.
    window.cancelAnimationFrame = id => {
      if (parId.has(id)) { moins(parId.get(id)); parId.delete(id); }
      return caf(id);
    };
    await attendre(600); const avant = n; const pireAvant = pire; pire = 0;
    for (let k = 0; k < 3; k++) document.dispatchEvent(new Event("visibilitychange"));
    await attendre(600); const apres = pire;
    window.requestAnimationFrame = raf;
    window.cancelAnimationFrame = caf;
    return { haut, bas, retour, avant, pireAvant, apres };
  });
  ok("le ciel animé s'arrête hors de l'écran et reprend à son retour",
    animeDit.haut && !animeDit.bas && animeDit.retour, JSON.stringify(animeDit));
  ok("un retour au premier plan ne lance pas de seconde boucle d'animation",
    animeDit.avant > 0 && animeDit.apres === 1, JSON.stringify(animeDit));

  /* Constat 5.8 : la série de secours écrite sur l'appareil ne garde que les
     trois colonnes qu'on relit. */
  const secoursDit = await pgLotE.evaluate(() => Object.keys(
    JSON.parse(localStorage.getItem("mameteo.previsions.v1") || "null")?.d?.horaireSecours || {}).sort().join(","));
  ok("la série de secours ne garde sur l'appareil que les colonnes relues",
    secoursDit === "precipitation,temperature_2m,time", secoursDit);

  /* La grille de la carte, lue une fois, se sert de l'appareil après un
     rechargement de la page, sans nouvelle requête. */
  const grilleE = await pgLotE.evaluate(async () => {
    const N = await import("/src/nappe.js");
    N.oublier();
    const n = N.COLS * N.RANGS;
    window.__appelsGrille = 0;
    const repond = async () => { window.__appelsGrille++; return { ok: true, json: async () => Array.from({ length: n }, (_, i) => ({
      current: { temperature_2m: i % 40, wind_speed_10m: 3, wind_direction_10m: 90, time: "2026-08-18T12:00" },
      daily: { time: ["2026-08-18", "2026-08-19"], uv_index_max: [4, 5] } })) }; };
    const d = await N.charger(repond);
    return { appels: window.__appelsGrille, t5: d?.temp?.[5] ?? null };
  });
  await pgLotE.reload(); await pgLotE.waitForTimeout(500);
  grilleE.apres = await pgLotE.evaluate(async () => {
    const N = await import("/src/nappe.js");
    let appels = 0;
    const d = await N.charger(async () => { appels++; return { ok: false }; });
    return { appels, t5: d?.temp?.[5] ?? null };
  });
  ok("la grille de la carte se garde sur l'appareil après un relancement",
    grilleE.appels === 1 && grilleE.t5 === 5 && grilleE.apres.appels === 0 && grilleE.apres.t5 === 5, JSON.stringify(grilleE));
  await ctxLotE.close();

  /* Audit du 1er octobre 2026, constat 5.5 : les sources secondaires lues se
     gardent sur l'appareil. La vigilance d'abord, en page : un bulletin lu
     n'est pas relu après un rechargement. */
  const ctxLotE2 = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  let appelsVigE = 0;
  await ctxLotE2.route(/webservice\.meteofrance\.com\/v3\/warning\/full/, r => {
    appelsVigE++;
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ timelaps: [], phenomenons_max_colors: [] }) });
  });
  const pgLotE2 = await ctxLotE2.newPage();
  await ouvrirPage(pgLotE2);
  await pgLotE2.evaluate(async () => { const V = await import("/src/vigilance.js"); await V.lire("21"); });
  const vigGardeDit = { premier: appelsVigE };
  await pgLotE2.reload(); await pgLotE2.waitForTimeout(400);
  await pgLotE2.evaluate(async () => { const V = await import("/src/vigilance.js"); await V.lire("21"); });
  vigGardeDit.apres = appelsVigE;
  ok("un bulletin de vigilance lu n'est pas relu après un relancement",
    vigGardeDit.premier > 0 && vigGardeDit.apres === vigGardeDit.premier, JSON.stringify(vigGardeDit));

  /* Puis la neige, les communes des plages, les plages et l'eau, sur leurs
     fonctions, avec un faux service qui compte ses appels. */
  const sourcesGardeDit = await pgLotE2.evaluate(async () => {
    const N = await import("/src/neige.js"), Pl = await import("/src/plage.js"), E = await import("/src/eau.js");
    localStorage.clear();
    const heure = "2026-08-18T12:00", jour = "2026-08-18";
    const compte = { neige: 0, communes: 0, plages: 0, eau: 0 };
    const rep = v => ({ ok: true, json: async () => v });
    const nombre = u => (new URL(u).searchParams.get("latitude") || "").split(",").length;
    /* Les appels à OSRM ne se comptent pas : une durée estimée faute d'OSRM ne
       se garde jamais, et la lecture suivante retente le service, par choix. */
    const faux = quoi => async u => {
      if (!u.includes("project-osrm")) compte[quoi]++;
      if (u.includes("geo.api.gouv.fr")) return rep([{ nom: "Biarritz" }]);
      if (u.includes("marine-api")) return rep(Array.from({ length: nombre(u) }, () => ({ hourly: { time: [heure],
        wave_height: [0.5], wave_period: [6], wave_direction: [270], sea_surface_temperature: [20], sea_level_height_msl: [0.1] } })));
      if (u.includes("api.open-meteo.com") && quoi === "plages") return rep(Array.from({ length: nombre(u) }, () => ({
        hourly: { time: [heure], temperature_2m: [25], wind_speed_10m: [10], wind_direction_10m: [270], precipitation: [0] },
        daily: { time: [jour], temperature_2m_max: [26], uv_index_max: [5], sunrise: [`${jour}T07:10`], sunset: [`${jour}T20:50`] } })));
      if (u.includes("vigieau")) return rep([]);
      if (quoi === "neige") return rep([]);
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const deux = [{ nom: "Une", lat: 45.2, lon: 6.3, pied: 1200, sommet: 2300 },
      { nom: "Deux", lat: 45.4, lon: 6.6, pied: 1500, sommet: 2700 }];
    await N.lireNeige(deux, heure, faux("neige")); await N.lireNeige(deux, heure, faux("neige"));
    const plage = { lat: 43.48, lon: -1.56, pays: "FR" };
    await Pl.communeDe(plage, faux("communes")); const avantCommunes = compte.communes;
    await Pl.communeDe(plage, faux("communes"));
    const g = { lat: 43.48, lon: -1.56 };
    const p1 = await Pl.chargerPlage(g, heure, faux("plages")); const avantPlages = compte.plages;
    const p2 = await Pl.chargerPlage(g, heure, faux("plages"));
    await E.chargerEau({ lat: 45.5, lon: 5.5 }, jour, faux("eau"));
    await new Promise(r => setTimeout(r, 300));
    const avantEau = compte.eau;
    await E.chargerEau({ lat: 45.5, lon: 5.5 }, jour, faux("eau"));
    return { neige: compte.neige, communes: `${avantCommunes} ${compte.communes}`,
      plages: `${avantPlages} ${compte.plages} ${p1?.resumes?.length ?? 0} ${p2?.resumes?.length ?? 0}`,
      eau: `${avantEau} ${compte.eau}` };
  });
  const [cAE, cBE] = sourcesGardeDit.communes.split(" ").map(Number);
  const [plAE, plBE, plN1E, plN2E] = sourcesGardeDit.plages.split(" ").map(Number);
  const [eAE, eBE] = sourcesGardeDit.eau.split(" ").map(Number);
  ok("la neige lue se garde pour l'heure", sourcesGardeDit.neige === 1, JSON.stringify(sourcesGardeDit));
  ok("la commune d'une plage se garde sur l'appareil", cAE > 0 && cBE === cAE, JSON.stringify(sourcesGardeDit));
  ok("les plages lues se gardent pour l'heure", plAE > 0 && plBE === plAE && plN1E > 0 && plN2E === plN1E, JSON.stringify(sourcesGardeDit));
  ok("l'état de l'eau se garde une heure une fois ses lectures arrivées", eAE > 0 && eBE === eAE, JSON.stringify(sourcesGardeDit));
  await ctxLotE2.close();

  /* Audit du 1er octobre 2026, constat 5.1 : les listes des plages et des
     stations, 217 kilooctets, ne sont plus sur le chemin du premier affichage.
     Refusées toutes deux, l'accueil s'affiche quand même ; un import statique
     aurait fait échouer toute l'application. */
  const ctxListes = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxListes.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxListes);
  await ctxListes.route(/\/src\/(plages|stations)\.js/, r => r.abort());
  const pgListes = await ctxListes.newPage();
  await ouvrirPage(pgListes);
  await pgListes.waitForTimeout(800);
  const listesDit = await pgListes.evaluate(() => ({
    temperature: !!document.querySelector("#ecran .bd-deg"), tuiles: document.querySelectorAll("#ecran .bd-m").length }));
  ok("l'accueil s'affiche sans les listes des plages et des stations",
    listesDit.temperature && listesDit.tuiles > 0, JSON.stringify(listesDit));
  await ctxListes.close();

  /* Plan du découpage de vues.js, étape 4, version 134 : la carte et le ciel se
     chargent à la première ouverture de leur onglet. Leurs fichiers refusés,
     l'accueil s'affiche quand même ; l'onglet de la carte dit qu'il n'a pas pu
     se charger et propose de recharger l'application, qui ouvre ensuite la
     carte une fois les fichiers rendus. Un nouvel import dans la même page ne
     relit rien : le navigateur garde l'échec en mémoire. */
  const ctxDiffere = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDiffere.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxDiffere);
  const refuserDifferes = r => r.abort();
  await ctxDiffere.route(/\/src\/(vues\/carte|vues\/etoiles|carte|geographie)\.js/, refuserDifferes);
  const pgDiffere = await ctxDiffere.newPage();
  await ouvrirPage(pgDiffere);
  await pgDiffere.waitForTimeout(600);
  /* Chaque étape ne se tente que si son élément existe : sous une erreur
     volontaire, l'onglet ou le bouton peut manquer, et le contrôle doit rendre
     son verdict au lieu d'attendre. */
  const differeDit = { accueil: await pgDiffere.evaluate(() => !!document.querySelector("#ecran .bd-deg")) };
  ok("l'accueil s'affiche sans les fichiers de la carte et du ciel", differeDit.accueil, JSON.stringify(differeDit));
  const ongletCarte = pgDiffere.locator('[data-onglet="carte"]');
  if (await ongletCarte.count()) { await ongletCarte.click(); await pgDiffere.waitForTimeout(800); }
  differeDit.manque = await pgDiffere.evaluate(() => !!document.querySelector('#ecran [data-differe-manque] [data-action="recharger"]'));
  await ctxDiffere.unroute(/\/src\/(vues\/carte|vues\/etoiles|carte|geographie)\.js/, refuserDifferes);
  if (differeDit.manque) {
    await Promise.all([pgDiffere.waitForEvent("load"), pgDiffere.locator('#ecran [data-action="recharger"]').click()]);
    await pgDiffere.waitForTimeout(600);
    if (await ongletCarte.count()) { await ongletCarte.click(); await reposer(pgDiffere, 1800); }
  }
  differeDit.carte = await pgDiffere.evaluate(() => !!document.getElementById("caToile"));
  ok("un onglet qui n'a pas pu se charger le dit, et s'ouvre après le rechargement proposé",
    differeDit.manque && differeDit.carte, JSON.stringify(differeDit));
  await ctxDiffere.close();

  /* Audit du 1er octobre 2026, constat 1.3. Une prévision qui ne répond pas
     rend la main en moins de vingt-cinq secondes, deux essais de dix au plus ;
     le faux service retient sa réponse trente secondes. Puis un refus du quota
     attend le délai demandé avant le second essai, et une erreur 404 ne se
     réessaie pas. */
  let modeDelais = "muet";
  const appelsDelais = [];
  const ctxDelais = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDelais.route(/api\.open-meteo\.com/, async route => {
    const u = route.request().url();
    const quoi = u.includes("models=") ? "arome" : u.includes("daily=") ? "jour" : "heure";
    appelsDelais.push({ quoi, t: Date.now(), mode: modeDelais });
    try {
      if (modeDelais === "muet") {
        await new Promise(r => setTimeout(r, 30000));
        await route.fulfill({ status: 503, body: "" });
        return;
      }
      if (quoi === "jour") {
        const premier = appelsDelais.filter(x => x.quoi === "jour" && x.mode === "refus").length === 1;
        if (premier) { await route.fulfill({ status: 429, headers: { "Retry-After": "1" }, body: "" }); return; }
        await route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ daily: { time: ["2026-08-18"], temperature_2m_max: [25] } }) });
        return;
      }
      await route.fulfill({ status: 404, body: "" });
    } catch { /* la page a abandonné la requête */ }
  });
  const pgDelais = await ctxDelais.newPage();
  await ouvrirPage(pgDelais);
  const delaisDit = {};
  delaisDit.muet = await pgDelais.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const t0 = Date.now();
    const r = await P.charger({ lat: 45.5, lon: 5 });
    return { ms: Date.now() - t0, rendu: r === null };
  });
  ok("une prévision qui ne répond pas rend la main en moins de vingt-cinq secondes",
    delaisDit.muet.ms < 25000 && delaisDit.muet.rendu, JSON.stringify(delaisDit));
  modeDelais = "refus";
  await pgDelais.evaluate(async () => { const P = await import("/src/previsions.js"); await P.charger({ lat: 46.5, lon: 5 }); });
  const jours = appelsDelais.filter(x => x.mode === "refus" && x.quoi === "jour");
  const heures = appelsDelais.filter(x => x.mode === "refus" && x.quoi === "heure");
  delaisDit.refus = { jours: jours.length, ecart: jours.length > 1 ? jours[1].t - jours[0].t : null, heures: heures.length };
  ok("un refus du quota attend avant le second essai, et une erreur 404 ne se réessaie pas",
    delaisDit.refus.jours === 2 && delaisDit.refus.ecart >= 900 && delaisDit.refus.heures === 1, JSON.stringify(delaisDit));
  await ctxDelais.close();

  /* Audit du 1er octobre 2026, constat 1.7 : le département vient du contexte
     du service d'adresses, non du code postal. Éloise a un code postal de
     l'Ain, 01200, et se trouve en Haute-Savoie. */
  const ELOISE = { commune: "Éloise", codePostal: "01200", departement: "74", lat: 46.08, lon: 5.85 };
  const ctxDepF = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDepF.addInitScript(amorce({ ...FAIN, ...ELOISE, suivies: [ELOISE] }));
  await brancherRoutes(ctxDepF);
  await ctxDepF.route(/api-adresse\.data\.gouv\.fr/, r => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ features: [{ geometry: { coordinates: [5.85, 46.08] },
      properties: { city: "Éloise", name: "Éloise", postcode: "01200", context: "74, Haute-Savoie, Auvergne-Rhône-Alpes" } }] }) }));
  const pgDepF = await ctxDepF.newPage();
  await ouvrirPage(pgDepF);
  await pgDepF.waitForTimeout(400);
  const depDit = await pgDepF.evaluate(async () => {
    const R = await import("/src/reglages.js");
    const l = (await R.chercherCommune("Eloise"))[0];
    const inverse = await R.communeDe(46.08, 5.85);
    return { trouve: l?.departement, inverse: inverse?.departement, secours: R.departementDu({ codePostal: "01200" }),
      tete: document.getElementById("navLieuDep")?.textContent || "" };
  });
  ok("le département d'une commune vient du service d'adresses, le code postal n'étant qu'un secours",
    depDit.trouve === "74" && depDit.inverse === "74" && depDit.secours === "01", JSON.stringify(depDit));
  ok("la barre de tête nomme le département de la commune, non celui de son code postal",
    depDit.tete === "Haute-Savoie", JSON.stringify(depDit));
  await ctxDepF.close();

  /* Audit du 1er octobre 2026, constat 1.8 : un téléphone réglé sur Honolulu
     voit 21 h la veille quand il est 9 h à Paris. Il doit trouver l'heure et la
     journée de Paris dans les données, et l'accueil s'afficher. */
  const ctxFuseau = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Pacific/Honolulu", isMobile: true, hasTouch: true,
  });
  await ctxFuseau.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxFuseau);
  const pgFuseau = await ctxFuseau.newPage();
  await ouvrirPage(pgFuseau);
  await pgFuseau.waitForTimeout(600);
  const fuseauDit = await pgFuseau.evaluate(async () => {
    const P = await import("/src/previsions.js"), H = await import("/src/horloge.js");
    const c = P.chargeCourante();
    return { telephone: new Date().getHours(), heure: c?.hourly?.time?.[P.iHeure()] ?? null, jour: c?.daily?.time?.[P.iJour()] ?? null,
      temperature: !!document.querySelector("#ecran .bd-deg"),
      ete: H.instantParis("2026-08-18T09:00") === Date.parse("2026-08-18T09:00:00+02:00"),
      hiver: H.instantParis("2026-12-01T09:00") === Date.parse("2026-12-01T09:00:00+01:00") };
  });
  ok("un téléphone réglé sur un autre fuseau lit l'heure et la journée de Paris",
    fuseauDit.telephone === 21 && fuseauDit.heure === "2026-08-18T09:00" && fuseauDit.jour === "2026-08-18" && fuseauDit.temperature,
    JSON.stringify(fuseauDit));
  ok("une heure des données se lit comme un instant de Paris, en été comme en hiver",
    fuseauDit.ete && fuseauDit.hiver, JSON.stringify(fuseauDit));
  await ctxFuseau.close();
};
