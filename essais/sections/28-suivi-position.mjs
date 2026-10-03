/* Suivi de la position. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { METEO, FIGE, FAIN, amorceA, amorce } from "../faux-services.mjs";

export const titre = "Suivi de la position";
export const avecPage = true;

export default async T => {
  const { pg, nav, etat, ok, brancherRoutes, ouvrirPage, RACINE_HTTP, ouvrirLeTemps,
    phrasesConseils, txt, onglet, ecranCiel, reposer } = T;
  /* L'application s'ouvre en mode position sur un relevé ancien, pris ailleurs.
     L'autorisation étant déjà accordée, le relevé silencieux doit partir seul,
     voir que l'appareil a bougé, et relire la prévision là où il se trouve. */
  const ctxSuivi = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    permissions: ["geolocation"],
    geolocation: { latitude: 45.1885, longitude: 5.7245 },
  });
  await ctxSuivi.addInitScript(amorce({
    commune: "Ailleurs", codePostal: null, lat: 47.5, lon: 4.3,
    ecriture: "ruban", poste: null, suivies: [],
    auto: true,
    position: { commune: "Ailleurs", codePostal: null, lat: 47.5, lon: 4.3, t: 0 },
  }));
  await brancherRoutes(ctxSuivi);
  const pgSuivi = await ctxSuivi.newPage();
  const erreursSuivi = [];
  pgSuivi.on("pageerror", e => erreursSuivi.push(String(e)));
  await ouvrirPage(pgSuivi);
  await reposer(pgSuivi, 3000);
  ok("le relevé silencieux suit l'appareil",
    (await pgSuivi.locator("#navLieuNom").innerText()) === "Grenoble",
    await pgSuivi.locator("#navLieuNom").innerText());
  ok("la prévision est relue aux nouvelles coordonnées", await pgSuivi.evaluate(() => {
    const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
    return g.lat === 45.19 && g.lon === 5.72 && Math.abs(g.releve?.lat - 45.1885) < 0.001;
  }));
  ok("le suivi n'ajoute pas de commune suivie", await pgSuivi.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).suivies.length === 0));
  ok("le suivi n'a soulevé aucune erreur", erreursSuivi.length === 0, erreursSuivi.join(" | "));
  await ctxSuivi.close();

  /* Sans autorisation, aucune demande ne doit partir au chargement : le dernier
     relevé reste servi et la rangée attend un appui. */
  const ctxRefus = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxRefus.addInitScript(amorce({
    commune: "Ailleurs", codePostal: null, lat: 47.5, lon: 4.3,
    ecriture: "ruban", poste: null, suivies: [],
    auto: true,
    position: { commune: "Ailleurs", codePostal: null, lat: 47.5, lon: 4.3, t: 0 },
  }));
  await brancherRoutes(ctxRefus);
  const pgRefus = await ctxRefus.newPage();
  await ouvrirPage(pgRefus);
  await reposer(pgRefus, 2250);
  ok("sans autorisation, le dernier relevé reste servi",
    (await pgRefus.locator("#navLieuNom").innerText()) === "Ailleurs",
    await pgRefus.locator("#navLieuNom").innerText());
  ok("sans autorisation, la prévision garde ses coordonnées", await pgRefus.evaluate(() => {
    const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
    return Math.abs(g.lat - 47.5) < 0.001;
  }));
  await ctxRefus.close();

  /* Le relevé peut avoir abouti alors que l'interface adresse était muette : la
     prévision est juste, mais la barre de tête ne nomme pas la commune servie. Le
     nom doit se rattraper seul, sans redemander la position à l'appareil, et sans
     remettre à zéro l'horodatage du relevé. */
  const ctxAnonyme = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  const T_RELEVE = FIGE - 60 * 1000;
  await ctxAnonyme.addInitScript(amorce({
    commune: null, codePostal: null, lat: 45.1885, lon: 5.7245,
    ecriture: "ruban", poste: null, suivies: [],
    auto: true,
    position: { commune: null, codePostal: null, lat: 45.1885, lon: 5.7245, t: T_RELEVE },
  }));
  await brancherRoutes(ctxAnonyme);
  const pgAnonyme = await ctxAnonyme.newPage();
  const erreursAnonyme = [];
  pgAnonyme.on("pageerror", e => erreursAnonyme.push(String(e)));
  await ouvrirPage(pgAnonyme);
  await reposer(pgAnonyme, 2700);
  ok("une position sans nom se nomme seule",
    (await pgAnonyme.locator("#navLieuNom").innerText()) === "Grenoble",
    await pgAnonyme.locator("#navLieuNom").innerText());
  ok("la barre de tête garde sa cible en mode position",
    await pgAnonyme.locator("#navPos:visible").count() === 1);
  ok("nommer n'est pas relever : l'horodatage ne bouge pas", await pgAnonyme.evaluate(t => {
    const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
    return g.position.t === t;
  }, T_RELEVE));
  ok("le code postal relevé ouvre la vigilance du bon département", await pgAnonyme.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).codePostal === "38000"));
  ok("nommer la position n'a soulevé aucune erreur",
    erreursAnonyme.length === 0, erreursAnonyme.join(" | "));
  await ctxAnonyme.close();

  /* Sans vigilance en vigueur, rien du tout : pas de panneau, pas même une rangée
     d'accès. Un bandeau permanent qui dit « rien à signaler » finit par ne plus se
     lire, et le jour où il dit autre chose, personne ne le voit. */
  const ctxVert = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxVert.addInitScript(amorce({
    commune: "Nulle-Part", codePostal: "99000", lat: 47.5, lon: 4.3,
    ecriture: "ruban", poste: null, suivies: [],
  }));
  await brancherRoutes(ctxVert);
  const pgVert = await ctxVert.newPage();
  await ouvrirPage(pgVert);
  await reposer(pgVert, 2400);
  ok("sans vigilance, aucun panneau", await pgVert.locator("#ecran .vg").count() === 0);
  ok("sans vigilance, aucune rangée d'accès",
    await pgVert.locator('#ecran [data-feuille="vigilance"]').count() === 0);
  ok("sans vigilance, le reste de l'accueil tient",
    await pgVert.locator("#ecran .bd-mesures").count() === 1
    && await pgVert.locator("#ecran .mt").count() === 1);
  await ctxVert.close();

  /* Une règle ne parle que si elle a quelque chose à dire. Sur un temps calme,
     aucune ne parle, et la section entière disparaît : « Aucune lame annoncée
     d'ici demain 16 h » occupait la première ligne tous les jours de beau temps,
     et une phrase qu'on lit cent fois pour n'y rien apprendre finit par cacher
     celles qui comptent. */
  const ctxCalme = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxCalme.addInitScript(amorce(FAIN));
  await ctxCalme.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    const h = d.hourly;
    const n = h.time.length;
    const plat = v => Array.from({ length: n }, () => v);
    h.weather_code = plat(0);
    h.precipitation = plat(0);
    h.precipitation_probability = plat(3);
    h.cloud_cover = plat(8);
    h.temperature_2m = plat(21);
    h.apparent_temperature = plat(21);
    h.dew_point_2m = plat(10);
    h.relative_humidity_2m = plat(48);
    h.wind_speed_10m = plat(9);
    h.wind_gusts_10m = plat(16);
    h.uv_index = plat(4);
    h.pressure_msl = plat(1018);
    // Les jours suivants sont calmes eux aussi : aucune alerte journalière.
    const m = d.daily.time.length;
    d.daily.temperature_2m_min = Array.from({ length: m }, () => 14);
    d.daily.temperature_2m_max = Array.from({ length: m }, () => 24);
    d.daily.precipitation_sum = Array.from({ length: m }, () => 0);
    d.daily.weather_code = Array.from({ length: m }, () => 0);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("models=meteofrance_arome") || u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: h }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxCalme.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr/, r => r.abort());
  await ctxCalme.route(/webservice\.meteofrance\.com/, r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ domain_id: "21", timelaps: [] }) }));
  const pgCalme = await ctxCalme.newPage();
  await ouvrirPage(pgCalme);
  await reposer(pgCalme, 2400);
  ok("sur un temps calme, aucune ligne à savoir",
    await pgCalme.locator("#ecran .cj-l").count() === 0
    && await pgCalme.locator("#ecran .al").count() === 0,
    await phrasesConseils(pgCalme, "#ecran .cj-l").then(x => x.join(" | ")));
  ok("sur un temps calme, la section entière disparaît", await pgCalme.evaluate(() =>
    ![...document.querySelectorAll("#ecran .section h2")].some(x => (x.dataset.phrase || x.textContent).startsWith("Dans les"))
    && document.querySelectorAll("#ecran .retenir").length === 0));
  ok("sur un temps calme, le reste de l'accueil tient",
    await pgCalme.locator("#ecran .bd-mesures").count() === 1
    && await pgCalme.locator("#ecran .mt").count() === 1);
  /* Sans pluie ni risque, la ligne de la pluie n'a rien à dire : elle ne
     paraît pas. Depuis le jalon 20, lot 2, le tableau n'a plus que quatre
     lignes, et l'humidité n'en est plus. Les noms se lisent par leur texte :
     la feuille de style les écrit en capitales. */
  const lignesCalme = (await pgCalme.locator("#ecran .mt-l").allTextContents()).map(t => t.trim()).filter(Boolean).join("/");
  ok("sur un temps calme, le tableau ne garde que ses lignes utiles", lignesCalme === "Temp./Vent/UV", lignesCalme);
  await ctxCalme.close();

  /* Heures écourtées : la source s'arrête au milieu du troisième jour annoncé.
     Les jours sans heures complètes ne doivent alors pas s'ouvrir, ni porter de
     chevron, et la journée coupée en deux ne doit pas s'ouvrir non plus sur des
     tranches vides. La coupe se compte depuis le début de la série, laquelle porte
     deux journées écoulées avant le jour en cours. */
  const ctxCourt = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxCourt.addInitScript(amorce(FAIN));
  await ctxCourt.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      const h = {};
      for (const c of Object.keys(d.hourly)) h[c] = d.hourly[c].slice(0, 48 + 60);
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: h }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxCourt.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr/, r => r.abort());
  await ctxCourt.route(/webservice\.meteofrance\.com/, r => r.abort());
  const pgCourt = await ctxCourt.newPage();
  const urls = [];
  pgCourt.on("request", r => {
    // L'adresse d'ensemble porte le même domaine à un préfixe près : elle est
    // écartée d'ici, le contrat éprouvé étant celui de la prévision servie.
    if (r.url().startsWith("https://api.open-meteo.com")) urls.push(r.url());
  });
  await ouvrirPage(pgCourt);
  await reposer(pgCourt, 2100);

  /* Le contrat avec la source. Les heures portent sur les sept jours, c'est
     d'elles que la semaine tire ses moments. AROME reste à trois jours : au delà
     il ne rend que des colonnes vides. */
  /* La lecture du sol, jalon 18, est une requête distincte, faite après la
     prévision pour la feuille de l'eau : elle se reconnaît à l'humidité du sol et
     ne compte pas comme une prévision de plus. */
  const prevues = urls.filter(u => !u.includes("soil_moisture"));
  const uHoraire = prevues.find(u => u.includes("hourly=") && !u.includes("models="));
  const uArome = urls.find(u => u.includes("models=meteofrance_arome"));
  ok("les heures sont demandées sur sept jours",
    !!uHoraire && uHoraire.includes("forecast_days=7"), uHoraire || "aucune requête horaire");
  ok("AROME n'est demandé que sur trois jours",
    !!uArome && uArome.includes("forecast_days=3"), uArome || "aucune requête AROME");
  /* Les journées écoulées viennent de la même requête, sans appel de plus. AROME
     les porte aussi : sans elles, le modèle fin se serait arrêté à minuit du jour
     en cours et le ruban aurait changé de source en plein tracé. */
  ok("deux journées écoulées sont demandées avec les heures",
    !!uHoraire && uHoraire.includes("past_days=2"), uHoraire || "aucune requête horaire");
  ok("AROME porte les mêmes journées écoulées",
    !!uArome && uArome.includes("past_days=2"), uArome || "aucune requête AROME");
  ok("aucune requête horaire supplémentaire n'est émise",
    prevues.filter(u => u.includes("hourly=")).length === 2,
    prevues.filter(u => u.includes("hourly=")).length + " requêtes horaires");

  await pgCourt.locator('[data-onglet="semaine"]').click();
  await pgCourt.waitForTimeout(500);
  ok("sans heures complètes, la journée ne s'ouvre pas",
    await pgCourt.locator(".sem-r").count() === 9
    && await pgCourt.locator(".sem-r[aria-expanded]").count() === 4
    && await pgCourt.locator(".sem-fixe").count() === 5,
    `${await pgCourt.locator(".sem-r[aria-expanded]").count()} ouvrables`);
  ok("une journée qui ne s'ouvre pas ne porte pas de chevron",
    await pgCourt.locator(".sem-chev").count() === 4);
  ok("les journées sans heures gardent leurs bornes",
    await pgCourt.locator(".sem-min").count() === 9
    && await pgCourt.locator(".sem-max").count() === 9);
  await ctxCourt.close();

  /* Une charge gardée sous une autre forme. La version d'avant ne demandait que
     deux jours d'heures ; sa charge restait servie jusqu'à la fin de l'heure en
     cours, le nouveau code tournait sur l'ancienne donnée, et la semaine ne
     s'ouvrait que sur ses deux premières journées. La portée demandée entre donc
     dans la clé du cache. */
  const ctxVieux = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  const ancienne = JSON.parse(JSON.stringify(METEO));
  for (const c of Object.keys(ancienne.hourly)) {
    ancienne.hourly[c] = ancienne.hourly[c].slice(0, 48);
  }
  ancienne.horaireSecours = ancienne.hourly;
  await ctxVieux.addInitScript(amorce(FAIN));
  await ctxVieux.addInitScript(`localStorage.setItem("mameteo.previsions.v1", JSON.stringify({
  cle: "${FAIN.lat},${FAIN.lon}", t: Date.now(), h: "2026-08-18T09",
  d: ${JSON.stringify(ancienne)},
}));`);
  await brancherRoutes(ctxVieux);
  const pgVieux = await ctxVieux.newPage();
  await ouvrirPage(pgVieux);
  await reposer(pgVieux, 2400);
  ok("une charge gardée sous une autre forme n'est pas servie", await pgVieux.evaluate(async () => {
    const P = await import("/src/previsions.js");
    return (P.chargeCourante()?.hourly?.time?.length ?? 0) === 216;
  }), String(await pgVieux.evaluate(async () => {
    const P = await import("/src/previsions.js");
    return P.chargeCourante()?.hourly?.time?.length ?? 0;
  })));
  await pgVieux.locator('[data-onglet="semaine"]').click();
  await pgVieux.waitForTimeout(600);
  ok("la semaine s'ouvre bien sur ses neuf journées après une charge périmée",
    await pgVieux.locator(".sem-chev").count() === 9,
    String(await pgVieux.locator(".sem-chev").count()));
  await ctxVieux.close();

  /* Un ciel entièrement couvert. La couche se répète sur la largeur : son motif
     fait sept cent vingt points pour un panneau de trois cent quatre-vingt-dix, et
     le raccord tombe donc en plein écran. Flouter le masque en le découpant
     revenait à flouter son bord contre du vide, et laissait une couture verticale
     d'un bout à l'autre du ciel. */
  const ctxCouvert = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    // Mouvement réduit : le ciel se peint une fois, à un instant fixe. Sans cela
    // le raccord tombe ailleurs à chaque exécution et la mesure varie.
    reducedMotion: "reduce",
  });
  await ctxCouvert.addInitScript(amorce(FAIN));
  await ctxCouvert.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    const n = d.hourly.time.length;
    d.hourly.cloud_cover = Array.from({ length: n }, () => 100);
    d.hourly.weather_code = Array.from({ length: n }, () => 3);
    d.hourly.precipitation = Array.from({ length: n }, () => 0);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxCouvert.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr|webservice\.meteofrance\.com/,
    r => r.abort());
  const pgCouvert = await ctxCouvert.newPage();
  await ouvrirPage(pgCouvert);
  /* Une pause fixe : la toile lue ensuite change sans toucher au document, et
     l'attente du repos rendait la main avant qu'elle soit peinte. */
  await pgCouvert.waitForTimeout(1600);
  /* Le raccord du motif, mesuré en ligne. Fermée, la couche n'a plus de bord dans
     le cadre : c'est donc dans son corps qu'il faut chercher la couture, et une
     couture est une rupture verticale de clarté, non une pente. Le marbré, lui,
     est doux partout. */
  const couture = await pgCouvert.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    if (!cv) return { erreur: "aucune toile" };
    const L = cv.width, H = cv.height;
    const d = cv.getContext("2d").getImageData(0, 0, L, H).data;
    const cl = (px, py) => {
      const k = (py * L + px) * 4;
      return (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) * (d[k + 3] / 255);
    };
    /* Une couture est verticale : elle tombe sur la même abscisse à toutes les
       hauteurs. Le marbré, lui, se disperse. On somme donc la rupture par colonne
       sur cinq lignes, ce qui additionne une couture et moyenne le reste. */
    const par = new Array(L).fill(0);
    const lignes = [0.18, 0.34, 0.50, 0.66, 0.82];
    for (const f of lignes) {
      const y = Math.round(H * f);
      for (let x = 6; x < L - 6; x++) {
        /* L'écart au milieu de deux voisins écartés de cinq points : une pente,
           si raide soit-elle, y vaut zéro ; une cassure y vaut la moitié du saut. */
        par[x] += Math.abs(cl(x, y) - (cl(x - 5, y) + cl(x + 5, y)) / 2) / lignes.length;
      }
    }
    /* Le raccord se voit aussi dans l'opacité : floutée après découpe, chaque
       tuile se dilue sur ses deux bords et le creux se retrouve au collage.
       Fermée, la couche est pleine d'un bord à l'autre du cadre ; un creux d'un
       dixième y est déjà une couture. */
    let creux = 255;
    for (const f of lignes) {
      const y = Math.round(H * f);
      for (let x = 0; x < L; x++) creux = Math.min(creux, d[(y * L + x) * 4 + 3]);
    }
    /* Une couture est une cassure nette qui traverse toute la hauteur. Le 30
       septembre 2026, le bord presque vertical d'une rangée de nuages, coupant
       une ligne de mesure, a fait sortir une colonne sans qu'il y ait de
       couture : la mesure sur cinq points voit aussi bien un bord flouté qu'une
       cassure. Le saut d'un point à son voisin les sépare : faible sur un bord
       flouté, entier sur une couture. Une colonne est une couture si ce saut y
       ressort, à un point près, sur quatre lignes au moins.

       Le vote se prend sur treize lignes depuis le 2 octobre 2026. Sur cinq, la
       couture de l'erreur volontaire 108, nette à l'œil sur toute la hauteur,
       ne ressortait que sur trois lignes : dans les zones lisses du ciel le
       saut reste sous le seuil, et le contrôle passait. Sur treize lignes, elle
       en emporte cinq, et un ciel sans couture une au plus. */
    const votes = new Array(L).fill(0);
    const lignesVote = Array.from({ length: 13 }, (_, i) => 0.1 + 0.8 * i / 12);
    for (const f of lignesVote) {
      const y = Math.round(H * f);
      const r = new Array(L).fill(0);
      for (let x = 1; x < L - 1; x++) r[x] = Math.abs(cl(x + 1, y) - cl(x, y));
      const tr = r.slice(6, L - 6).sort((a, b) => a - b);
      const med = Math.max(0.05, tr[Math.floor(tr.length / 2)] || 0);
      for (let x = 7; x < L - 7; x++) if (Math.max(r[x - 1], r[x], r[x + 1]) > 6 * med && Math.max(r[x - 1], r[x], r[x + 1]) > 1.5) votes[x]++;
    }
    const pireVote = Math.max(...votes);
    const rang = par.map((v, x) => [x, v]).sort((a, b) => b[1] - a[1]);
    const tries = par.slice(6, L - 6).sort((a, b) => a - b);
    const median = tries[Math.floor(tries.length / 2)] || 0.01;
    /* C'est le rapport qui parle, non la valeur : le marbré donne à toutes les
       colonnes une rupture du même ordre, une couture en fait sortir une seule. La
       mesure reste juste si le marbré change de force. */
    return { max: rang[0][1], rapport: rang[0][1] / Math.max(0.05, median), creux, votes: pireVote,
      colonnes: votes.map((v, x) => [x, v]).filter(([, v]) => v >= 4).map(([x]) => x).join(" "),
      pires: rang.slice(0, 5).map(([x, v]) => `${x}:${v.toFixed(2)}`).join(" "),
      /* L'image mesurée et l'état du ciel qu'elle représente, gardés pour qu'un
         échec se regarde avant de se corriger. */
      image: cv.toDataURL("image/png"), taille: `${L}x${H}`, etat: JSON.stringify(cv.dataset) };
  });
  try {
    if (couture.image) (await import("node:fs")).writeFileSync("/tmp/couture.png", Buffer.from(couture.image.split(",")[1], "base64"));
    (await import("node:fs")).writeFileSync("/tmp/couture.txt", `${couture.taille} ${couture.etat}\n`);
  } catch { /* l'image n'est qu'une aide */ }
  delete couture.image;
  ok("la couche se répète sans couture verticale",
    !couture.erreur && couture.votes < 4 && couture.creux >= 250,
    couture.erreur || `${couture.votes} lignes sur 13 au pire, colonnes ${couture.colonnes || "aucune"} ; `
    + `pointe ${couture.rapport?.toFixed(1)} fois la médiane, opacité minimale ${couture.creux} | ${couture.pires}`);

  /* Fermée, la couche remplit le champ. Son bord festonné laissait sous lui une
     bande de ciel nu, qui avec la brume d'horizon faisait lire le panneau comme
     une mer grise vue d'avion. On ne passe sous un plafond que par ses trous. */
  ok("sous une couche fermée le plafond descend hors du cadre", await pgCouvert.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    if (!cv) return "aucune toile";
    const L = cv.width, H = cv.height;
    const d = cv.getContext("2d").getImageData(0, H - 3, L, 1).data;
    let nus = 0;
    for (let k = 0; k < L; k++) if (d[k * 4 + 3] < 220) nus++;
    return nus ? `${nus} colonnes sur ${L} laissent voir le ciel au bas du panneau` : "";
  }) === "", await pgCouvert.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    const d = cv.getContext("2d").getImageData(0, cv.height - 3, cv.width, 1).data;
    let mn = 255;
    for (let k = 0; k < cv.width; k++) mn = Math.min(mn, d[k * 4 + 3]);
    return `opacité minimale ${mn} au bas du panneau`;
  }));

  /* Un plafond de plein jour est une grande source diffuse : il est clair et
     presque neutre. Le code confondait couche fermée et plomb, poussait à
     quatre-vingt-douze pour cent vers le noir, et un couvert sec devenait un mur
     d'ardoise bleutée. */
  const plafond = await pgCouvert.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let r = 0, v = 0, b = 0, n = 0;
    for (let k = 0; k < d.length; k += 4 * 37) { r += d[k]; v += d[k + 1]; b += d[k + 2]; n++; }
    r /= n; v /= n; b /= n;
    return { clarte: (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255, teinte: (b - r) / 255 };
  });
  ok("un couvert sec de plein jour est clair et neutre",
    plafond.clarte > 0.48 && plafond.teinte < 0.075,
    `clarté ${(plafond.clarte * 100).toFixed(0)} %, bleu moins rouge `
    + `${(plafond.teinte * 100).toFixed(1)} points`);

  /* Le Soleil derrière la couche. On ne voit plus son disque, mais on voit
     parfaitement où il est : la lueur d'avant, étalée à douze pour cent d'opacité
     sur deux cent quatre-vingt-cinq points de rayon, ne se voyait pas du tout. */
  const perce = await pgCouvert.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    const L = cv.width, H = cv.height;
    const d = cv.getContext("2d").getImageData(0, 0, L, H).data;
    const cl = (px, py) => {
      const k = (py * L + px) * 4;
      return 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
    };
    const ax = Math.round(Number(cv.dataset.ax) * L), ay = Math.round(Number(cv.dataset.ay) * H);
    if (ax < 0 || ax >= L || ay < 0 || ay >= H) return { erreur: "astre hors du panneau" };
    // Une tache de vingt points autour de l'astre, contre la même au loin, à hauteur égale.
    const moyenne = (px, py) => {
      let s = 0, n = 0;
      for (let i = -10; i <= 10; i += 2) for (let j = -10; j <= 10; j += 2) {
        const qx = px + i, qy = py + j;
        if (qx < 0 || qx >= L || qy < 0 || qy >= H) continue;
        s += cl(qx, qy); n++;
      }
      return n ? s / n : 0;
    };
    return { ecart: moyenne(ax, ay) - moyenne(ax < L / 2 ? L - 14 : 14, ay) };
  });
  ok("le Soleil se devine derrière la couche fermée",
    !perce.erreur && perce.ecart > 14,
    perce.erreur || `écart de ${perce.ecart?.toFixed(1)} niveaux sur 255`);

  /* Le titre est écrit en blanc sur le ciel. Un plafond de plein jour est la
     surface la plus claire des trois ciels, et les voiles de lisibilité, réglés
     une fois pour toutes sur un ciel bleu, y laissaient le nom du jour à deux
     virgule quatre de contraste. Ils suivent maintenant la clarté de la couche.

     La mesure porte sur l'image composée, voiles compris, non sur la seule toile :
     la capture repasse par le navigateur, qui sait décoder un PNG. */
  const cliche = (await pgCouvert.locator(".ci").screenshot()).toString("base64");
  /* Le cliché se décode dans une page vierge : la politique de sécurité de
     l'application refuse les images en `data:`, depuis la version 139. */
  const pgCliche = await ctxCouvert.newPage();
  const lisible = await pgCliche.evaluate(async b64 => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const W = c.width, H = c.height;
    const d = x.getImageData(0, 0, W, H).data;
    const lin = v => (v / 255 <= 0.03928 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4);
    const lum = k => 0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2]);
    /* Le quart droit du bandeau, à hauteur du titre : le texte n'y va pas, et
       c'est le pixel le plus clair qui donne le pire contraste. */
    let pire = 99;
    for (const f of [0.68, 0.76, 0.84, 0.92]) {
      const y = Math.round(H * f);
      let haut = 0;
      for (let px = Math.round(W * 0.78); px < W * 0.97; px += 2) {
        haut = Math.max(haut, lum((y * W + px) * 4));
      }
      pire = Math.min(pire, 1.05 / (haut + 0.05));
    }
    return pire;
  }, cliche);
  ok("le titre reste lisible sur un plafond de plein jour",
    lisible >= 3.2, `contraste ${lisible.toFixed(2)} pour un blanc sur le ciel`);

  /* L'encart de la réponse du matin est écrit en blanc lui aussi, à la place
     qu'il occupe dans le ciel. Ce qui le rend lisible n'est pas sa matière, qui
     est fixe, mais la bande où il est posé : le voile bas couvre à cette hauteur
     plus de la moitié du ciel. Le contrôle mesure donc le contraste composé à sa
     place, et tombe si l'encart quitte cette bande pour le milieu du ciel, où les
     deux voiles se rejoignent au plus faible. La mesure prend les rangs de
     rembourrage, au-dessus et en dessous du texte. */
  const clicheRep = (await pgCouvert.locator(".pt-rep").screenshot()).toString("base64");
  const lisibleRep = await pgCliche.evaluate(async b64 => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const W = c.width, H = c.height;
    const d = x.getImageData(0, 0, W, H).data;
    const lin = v => (v / 255 <= 0.03928 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4);
    const lum = k => 0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2]);
    /* Les rangs de rembourrage, au-dessus et en dessous du texte, et seulement le
       tiers central en largeur : aux coins, le rayon de la carte laisse voir le
       ciel nu, qui n'est pas la matière que l'on mesure. */
    let haut = 0;
    for (const f of [0.10, 0.16, 0.84, 0.90]) {
      const y = Math.round(H * f);
      for (let px = Math.round(W * 0.35); px < W * 0.65; px += 2) {
        haut = Math.max(haut, lum((y * W + px) * 4));
      }
    }
    return 1.05 / (haut + 0.05);
  }, clicheRep);
  ok("l'encart de la réponse reste lisible sur un plafond de plein jour",
    lisibleRep >= 3.2, `contraste ${lisibleRep.toFixed(2)} pour un blanc sur la matière`);

  await ctxCouvert.close();

  /* Une vigilance rouge. La conduite officielle du rouge porte déjà le mot,
     « Vigilance absolue » : jointe au niveau sur une même ligne, la tête écrivait
     « Vigilance rouge, vigilance absolue ». */
  const ctxRouge = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxRouge.addInitScript(amorce(FAIN));
  await ctxRouge.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxRouge.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr/, r => r.abort());
  await ctxRouge.route(/webservice\.meteofrance\.com/, r => {
    const h = n => Math.floor(
      Date.parse(`2026-08-18T${String(n).padStart(2, "0")}:00:00+02:00`) / 1000);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      domain_id: "21", update_time: h(6), end_validity_time: h(23),
      timelaps: [{ phenomenon_id: "3",
        timelaps_items: [{ begin_time: h(9), end_time: h(20), color_id: 4 }] }],
    })});
  });
  const pgRouge = await ctxRouge.newPage();
  await ouvrirPage(pgRouge);
  await reposer(pgRouge, 2250);
  const teteRouge = await pgRouge.locator("#ecran .vg-txt").innerText();
  ok("le mot vigilance ne s'écrit qu'une fois, même au rouge",
    (teteRouge.toLowerCase().match(/vigilance/g) || []).length === 1,
    teteRouge.replace(/\n/g, " "));
  ok("le rouge écrit son niveau et sa conduite",
    /rouge/i.test(teteRouge) && /Vigilance absolue/.test(teteRouge),
    teteRouge.replace(/\n/g, " "));
  await ctxRouge.close();

  /* L'échéance du lendemain. Le panneau ne lisait que le jour en cours : une
     aggravation annoncée pour demain n'apparaissait nulle part, et un département
     vert aujourd'hui et orange demain ne faisait paraître aucun panneau, alors
     que c'est justement le moment où l'information sert.

     Trois contextes, sur le modèle du contexte rouge. Les bulletins y sont bâtis
     sur les mêmes heures, en heure de Paris, l'horloge étant figée au 18 août 9 h.
     Le lendemain est donc le 19. */
  const HV = (n, j = 18) => Math.floor(
    Date.parse(`2026-08-${j}T${String(n).padStart(2, "0")}:00:00+02:00`) / 1000);
  const vertV = (id, j) => ({ phenomenon_id: String(id),
    timelaps_items: [{ begin_time: HV(0, j), end_time: HV(23, j), color_id: 1 }] });

  const ctxVigilance = async servir => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorce(FAIN));
    await c.route(/api\.open-meteo\.com/, route => {
      const u = route.request().url();
      const d = JSON.parse(JSON.stringify(METEO));
      if (u.includes("current=")) {
        route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
      }
      if (u.includes("hourly=")) {
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ hourly: d.hourly }) }); return;
      }
      delete d.hourly;
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    });
    await c.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr/, r => r.abort());
    await c.route(/webservice\.meteofrance\.com/, r =>
      servir(r, new URL(r.request().url()).searchParams.get("echeance") === "J1"));
    const pg = await c.newPage();
    await ouvrirPage(pg);
    await reposer(pg, 2250);
    return { c, pg };
  };
  const rendre = (r, corps) => r.fulfill({ status: 200,
    contentType: "application/json", body: JSON.stringify(corps) });

  /* Premier contexte : département vert aujourd'hui, orange canicule demain.
     C'est le cas que l'application taisait entièrement. */
  const echA = await ctxVigilance((r, j1) => rendre(r, j1
    ? { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 20),
        timelaps: [vertV(1, 19), vertV(3, 19),
          { phenomenon_id: "6", timelaps_items: [
            { begin_time: HV(0, 19), end_time: HV(12, 19), color_id: 1 },
            { begin_time: HV(12, 19), end_time: HV(0, 20), color_id: 3 }] }] }
    : { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 19),
        timelaps: [1, 3, 6].map(id => vertV(id, 18)) }));
  /* Le texte d'un élément qui peut manquer : sans panneau, la lecture directe
     attendrait trente secondes avant de rendre la main, et la faute rétablie se
     dirait par un dépassement de délai plutôt que par un contrôle en échec. */
  const vu = async (p, sel) =>
    ((await p.locator(sel).count()) ? p.locator(sel).first().innerText() : "");

  const panneauA = await echA.pg.locator("#ecran .vg").count() === 1;
  ok("un département vert aujourd'hui et orange demain fait paraître le panneau", panneauA);
  ok("le panneau prend alors la couleur du lendemain",
    await echA.pg.locator("#ecran .vg.vg-orange").count() === 1);
  const teteA = await vu(echA.pg, "#ecran .vg-txt");
  ok("sa tête porte le mot demain et non une alerte en cours",
    /Vigilance orange demain/i.test(teteA) && !/jusqu'à/.test(teteA),
    teteA.replace(/\n/g, " ") || "aucune tête");
  const listeA = await echA.pg.locator("#ecran .vg-a").allInnerTexts();
  ok("le phénomène annoncé prend la place de la liste, avec le mot demain",
    listeA.length === 1 && /Canicule/.test(listeA[0]) && /demain/i.test(listeA[0]),
    listeA.join(" | ") || "aucune ligne");
  if (panneauA) {
    await echA.pg.locator("#ecran .vg-c").click();
    await echA.pg.waitForTimeout(500);
  }
  const feuilleA = await vu(echA.pg, "#feuille-corps");
  ok("la feuille ne dit plus qu'aucune vigilance n'est en vigueur",
    panneauA && !/Aucune vigilance/i.test(feuilleA));
  ok("la feuille porte la section annoncée pour demain",
    /Annoncé pour demain/i.test(feuilleA));
  await echA.c.close();

  /* Deuxième contexte, le cas réel du 2A le 26 août 2026 : canicule jaune de midi
     à minuit, jaune jusqu'à midi demain, orange ensuite. Un vent jaune des deux
     côtés sert à éprouver que seule une aggravation s'annonce.

     Deux phénomènes creux s'y ajoutent, sous les deux formes que la source rend :
     les crues portent un relevé vide côté lendemain et pas de relevé du tout côté
     jour, la neige l'inverse. C'est la seconde forme qui casse, la première se
     déverse sans bruit. */
  let toursB = 0;
  const echB = await ctxVigilance((r, j1) => rendre(r, ++toursB && j1
    ? { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 20),
        timelaps: [
          { phenomenon_id: "6", timelaps_items: [
            { begin_time: HV(0, 19), end_time: HV(12, 19), color_id: 2 },
            { begin_time: HV(12, 19), end_time: HV(0, 20), color_id: 3 }] },
          { phenomenon_id: "1", timelaps_items: [
            { begin_time: HV(0, 19), end_time: HV(23, 19), color_id: 2 }] },
          { phenomenon_id: "4", timelaps_items: [] },
          { phenomenon_id: "5" },
        ] }
    : { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 19),
        timelaps: [
          { phenomenon_id: "6", timelaps_items: [
            { begin_time: HV(0), end_time: HV(12), color_id: 1 },
            { begin_time: HV(12), end_time: HV(0, 19), color_id: 2 }] },
          { phenomenon_id: "1", timelaps_items: [
            { begin_time: HV(0), end_time: HV(0, 19), color_id: 2 }] },
          { phenomenon_id: "4" },
          vertV(5, 18),
        ] }));
  const listeB = await echB.pg.locator("#ecran .vg-a:not(.vg-d)").allInnerTexts();
  ok("un phénomène au relevé vide ou absent ne fait pas tomber la lecture",
    await echB.pg.locator("#ecran .vg").count() === 1 && listeB.length === 2,
    listeB.join(" | "));
  const canic = listeB.find(t => /Canicule/.test(t)) || "";
  ok("un même phénomène de même couleur des deux côtés de minuit n'écrit qu'une ligne",
    listeB.filter(t => /Canicule/.test(t)).length === 1, listeB.join(" | "));
  ok("sa borne dépasse minuit", /de 12 h à demain 12 h/.test(canic), canic);
  const annonceB = await echB.pg.locator("#ecran .vg-d").allInnerTexts();
  ok("l'aggravation du jaune vers l'orange écrit sa ligne d'annonce",
    annonceB.length === 1 && annonceB[0].trim() === "Demain, vigilance orange canicule",
    annonceB.join(" | "));
  /* La ligne d'annonce est une phrase, non une plage horaire : elle se lit depuis
     la gauche, en retrait de la liste. Calée à droite comme les plages, elle
     passait pour la fenêtre du phénomène au-dessus d'elle. */
  ok("la ligne d'annonce se lit depuis la gauche, en retrait",
    await echB.pg.evaluate(() => {
      const i = document.querySelector("#ecran .vg-d i");
      const sym = document.querySelector("#ecran .vg-a:not(.vg-d) .vg-as");
      const nom = document.querySelector("#ecran .vg-a:not(.vg-d) b");
      if (!i || !sym || !nom) return "élément manquant";
      const d = i.getBoundingClientRect().left - sym.getBoundingClientRect().left;
      if (d <= 2) return `retrait de ${d.toFixed(0)} points seulement`;
      const max = nom.getBoundingClientRect().left - sym.getBoundingClientRect().left;
      return d <= max ? "" : `phrase commencée à ${d.toFixed(0)} points, après le nom`;
    }) === "", await echB.pg.evaluate(() => {
      const i = document.querySelector("#ecran .vg-d i");
      const sym = document.querySelector("#ecran .vg-a:not(.vg-d) .vg-as");
      return `${(i.getBoundingClientRect().left - sym.getBoundingClientRect().left).toFixed(0)} points`;
    }));
  /* Le panneau le plus chargé que l'application produise : tête sur trois lignes,
     deux phénomènes, une ligne d'annonce. Mesuré, cent quatre-vingt-dix points,
     et vingt-sept points de dégagement sous le bloc du jour. C'est ce dégagement
     qui est gardé, avec un plafond large pour arrêter un emballement que l'écran
     de huit cent quarante-quatre points ne verrait pas. */
  ok("la bande horaire tient encore sous un panneau qui annonce",
    await echB.pg.evaluate(() => {
      const m = document.querySelector("#ecran #bande .bande-defil");
      const o = document.getElementById("onglets");
      if (!m || !o) return "élément manquant";
      const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
      const h = document.querySelector("#ecran .vg").getBoundingClientRect().height;
      if (h > 200) return `panneau de ${h.toFixed(0)} points`;
      return reste >= 0 ? "" : `${reste.toFixed(0)} points sous la bande`;
    }) === "", await echB.pg.evaluate(() => {
      const m = document.querySelector("#ecran #bande .bande-defil");
      const o = document.getElementById("onglets");
      const h = document.querySelector("#ecran .vg").getBoundingClientRect().height;
      return `panneau ${h.toFixed(0)}, reste `
        + `${(o.getBoundingClientRect().top - m.getBoundingClientRect().bottom).toFixed(0)}`;
    }));
  /* Sous une garde qui tient, le retour au premier plan ne coûte rien à la
     source : c'est la condition pour que le relevé de la garde échue puisse être
     posé sans relire le bulletin à chaque va-et-vient. */
  const avantB = toursB;
  await echB.pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await echB.pg.waitForTimeout(500);
  ok("un retour au premier plan sous garde tenue ne relit pas le bulletin",
    toursB === avantB, `${avantB} appels puis ${toursB}`);
  await echB.c.close();

  /* Troisième contexte : l'échéance du jour répond, celle du lendemain se tait.
     La lecture doit rendre le jour en cours seul, sans ligne creuse. */
  const echC = await ctxVigilance((r, j1) => {
    if (j1) { r.abort(); return; }
    rendre(r, { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 19),
      timelaps: [
        { phenomenon_id: "3", timelaps_items: [
          { begin_time: HV(6), end_time: HV(20), color_id: 3 }] },
        vertV(1, 18), vertV(6, 18),
      ] });
  });
  ok("une échéance du lendemain muette laisse le jour en cours entier",
    await echC.pg.locator("#ecran .vg").count() === 1
    && (await echC.pg.locator("#ecran .vg-a").allInnerTexts()).length === 1);
  ok("elle ne produit aucune ligne d'annonce ni élément vide",
    await echC.pg.locator("#ecran .vg-d").count() === 0);
  await echC.c.close();

  /* Quatrième contexte : l'application laissée ouverte au-delà de la validité du
     bulletin. Les deux premières réponses portent celui de la veille, déjà
     expiré : rien n'est en vigueur et aucun panneau ne paraît. Les suivantes
     portent celui du jour, orange. Le retour au premier plan doit franchir cet
     écart, la garde étant échue. */
  let toursD = 0;
  const echD = await ctxVigilance((r, j1) => {
    if (toursD++ < 2) {
      rendre(r, { domain_id: "21", update_time: HV(6, 17), end_validity_time: HV(0, 18),
        timelaps: [{ phenomenon_id: "3", timelaps_items: [
          { begin_time: HV(6, 17), end_time: HV(0, 18), color_id: 3 }] }] });
      return;
    }
    rendre(r, j1
      ? { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 20),
          timelaps: [vertV(3, 19)] }
      : { domain_id: "21", update_time: HV(6), end_validity_time: HV(0, 19),
          timelaps: [{ phenomenon_id: "3", timelaps_items: [
            { begin_time: HV(6), end_time: HV(20), color_id: 3 }] }] });
  });
  ok("un bulletin dont la validité est passée ne fait paraître aucun panneau",
    await echD.pg.locator("#ecran .vg").count() === 0);
  await echD.pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await echD.pg.waitForTimeout(800);
  ok("le retour au premier plan relit le bulletin dont la garde est échue",
    await echD.pg.locator("#ecran .vg.vg-orange").count() === 1, `${toursD} appels`);
  await echD.c.close();

  /* Un temps sec et dégagé. Deux défauts n'y paraissent que là : une voie sans
     tracé gardait sous son titre la réserve de hauteur d'une touche, ce qui
     portait la ligne « Pluie, aucune » de quarante-deux à soixante points, et la
     voie du ciel écrivait une file de zéros qui se lisait comme du bruit. */
  const ctxSerein = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxSerein.addInitScript(amorce(FAIN));
  await ctxSerein.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    const n = d.hourly.time.length;
    d.hourly.precipitation = Array.from({ length: n }, () => 0);
    d.hourly.precipitation_probability = Array.from({ length: n }, () => 0);
    // Dégagé d'abord, couvert ensuite : la voie doit taire les zéros et écrire le reste.
    d.hourly.cloud_cover = Array.from({ length: n }, (_, i) => (i < 20 ? 0 : 70));
    d.hourly.weather_code = Array.from({ length: n }, () => 0);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxSerein.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr|webservice\.meteofrance\.com/,
    r => r.abort());
  const pgSerein = await ctxSerein.newPage();
  await ouvrirPage(pgSerein);
  await reposer(pgSerein, 2100);
  await ouvrirLeTemps(pgSerein);
  await pgSerein.waitForTimeout(600);

  ok("sans pluie, la voie se réduit à sa ligne de titre", await pgSerein.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="mm"]')
      || [...document.querySelectorAll(".mg-v")].find(e => /^Pluie/.test(e.textContent));
    if (!v) return "voie absente";
    if (v.querySelector("svg.mg-s")) return "un tracé subsiste";
    const t = v.querySelector(".mg-t");
    /* La hauteur du titre contre celle de son encre : la réserve de touche gonfle
       la boîte sans rien y mettre, et `scrollHeight` la suit, donc ne la voit
       pas. Ce sont les enfants qu'il faut mesurer. */
    const k = [...t.children].map(e => e.getBoundingClientRect());
    const encre = Math.max(...k.map(r => r.bottom)) - Math.min(...k.map(r => r.top));
    const vide = t.getBoundingClientRect().height - encre;
    return vide > 16 ? `bande vide de ${vide.toFixed(0)} points` : "";
  }) === "", await pgSerein.evaluate(() => {
    const v = [...document.querySelectorAll(".mg-v")].find(e => /^Pluie/.test(e.textContent));
    return v ? `${v.getBoundingClientRect().height.toFixed(0)} points` : "voie absente";
  }));

  /* La ligne de titre qui s'ouvre garde sa cible de touche : c'est un bouton, il
     se vise au pouce. */
  ok("le titre qui s'ouvre garde sa cible de touche", await pgSerein.evaluate(() =>
    [...document.querySelectorAll(".mg-b")].every(e => e.getBoundingClientRect().height >= 40)));

  await pgSerein.locator('.mg-b[data-voie="nua"]').click();
  await pgSerein.waitForTimeout(400);
  ok("un ciel dégagé n'écrit pas sa file de zéros", await pgSerein.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="nua"]');
    const vus = [...v.querySelectorAll("text.mg-p")].map(e => e.textContent.trim());
    if (!vus.length) return "aucune valeur";
    if (!vus.some(x => Number(x) >= 5)) return "aucune valeur utile";
    const creux = vus.filter(x => x === "0" || x === "");
    return creux.length ? `${creux.length} valeurs creuses` : "";
  }) === "", await pgSerein.evaluate(() => [...document.querySelectorAll(
    '.mg-v[data-cle="nua"] text.mg-p')].map(e => e.textContent).join(" ") || "aucune"));
  await ctxSerein.close();

  /* Un lendemain nettement plus frais. La charge d'essai a deux journées de même
     chaleur, ce qui est justement le cas où la règle parlait à tort : on retire
     douze degrés au 19 août pour éprouver la phrase elle-même. Douze et non huit,
     pour que le maximum de la journée ne tombe pas par hasard sur celui que la
     fenêtre glissante aurait retenu. */
  const ctxFrais = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxFrais.addInitScript(amorce(FAIN));
  await ctxFrais.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    const i0 = d.hourly.time.findIndex(x => x.startsWith("2026-08-19"));
    for (let k = i0; k < i0 + 24; k++) {
      d.hourly.temperature_2m[k] -= 12;
      d.hourly.apparent_temperature[k] -= 12;
    }
    /* Charge asséchée : le bloc ne tient que trois lignes, et la pluie de la
       charge d'essai en occuperait deux. C'est la phrase de température qu'on
       éprouve ici, non l'ordre des gravités. */
    d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
    d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxFrais.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr|webservice\.meteofrance\.com/,
    r => r.abort());
  const pgFrais = await ctxFrais.newPage();
  await ouvrirPage(pgFrais);
  await reposer(pgFrais, 2100);

  const bascule = (await phrasesConseils(pgFrais, ".conseils .cj-l"))
    .find(x => /Refroidissement|Réchauffement/.test(x)) || "";
  ok("un vrai renversement de température se dit",
    /^Refroidissement de 12 degrés demain/.test(bascule.trim()), bascule || "aucune ligne");

  /* Le chiffre nommé doit être celui de la table de la semaine : c'est le même
     maximum de journée, il ne peut pas valoir vingt-quatre ici et trente-trois
     là. C'est la plainte d'origine. */
  await pgFrais.locator('[data-onglet="semaine"]').click();
  await pgFrais.waitForTimeout(600);
  const maxDemain = await pgFrais.evaluate(() => [...document.querySelectorAll(".sem-r")]
    .find(x => x.querySelector(".j b")?.textContent.trim() === "Demain")
    ?.querySelector(".sem-max").textContent.trim() || "aucune rangée demain");
  ok("le maximum de demain est le même sur les deux écrans",
    bascule.includes(`${maxDemain} au plus chaud`),
    `« ${bascule.trim()} » contre « ${maxDemain} » sur la semaine`);
  await ctxFrais.close();

  /* Une nuit de changement d'heure porte vingt-trois ou vingt-cinq heures : la
     même heure la veille ne se trouve pas en reculant de vingt-quatre rangs. Le
     contexte retire une heure comprise entre la même heure hier et l'heure en
     cours, ce qui décale la seconde d'un rang et pas la première, et pose sur
     l'heure que le rang aurait désignée une température qui ferait taire la
     règle.

     La lecture par horodatage écrit donc sa ligne, la lecture par rang non. */
  const ctxDecale = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDecale.addInitScript(amorce(FAIN));
  await ctxDecale.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    const k8 = d.hourly.time.indexOf("2026-08-17T08:00");
    d.hourly.temperature_2m[k8] = 18;
    const k15 = d.hourly.time.indexOf("2026-08-17T15:00");
    for (const c of Object.keys(d.hourly)) d.hourly[c].splice(k15, 1);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxDecale.route(/data\.gouv\.fr|webservice\.meteofrance\.com/, r => r.abort());
  const pgDecale = await ctxDecale.newPage();
  await ouvrirPage(pgDecale);
  await reposer(pgDecale, 2250);
  ok("la même heure la veille se cherche par son horodatage, non par son rang",
    await pgDecale.evaluate(async () => {
      const P = await import("/src/previsions.js");
      const v = P.ecartVeille();
      return v ? `${v.ecart}|${Math.round(v.hier)}` : "aucune lecture";
    }) === "-6|23",
    await pgDecale.evaluate(async () => {
      const P = await import("/src/previsions.js");
      return JSON.stringify(P.ecartVeille());
    }));
  ok("la ligne de comparaison le dit sur l'écran",
    (await phrasesConseils(pgDecale, "#ecran .cj-l"))
      .some(x => /6 degrés de moins qu'hier/.test(x)),
    (await phrasesConseils(pgDecale, "#ecran .cj-l")).join(" | "));
  await ctxDecale.close();

  /* Sous le seuil, la comparaison se tait : une oscillation ordinaire d'un ou deux
     degrés d'un jour à l'autre n'apprend rien, et occuperait une des trois places
     du bloc tous les jours. */
  const ctxPareil = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxPareil.addInitScript(amorce(FAIN));
  await ctxPareil.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    const k = d.hourly.time.indexOf("2026-08-17T09:00");
    d.hourly.temperature_2m[k] = 21;
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  await ctxPareil.route(/data\.gouv\.fr|webservice\.meteofrance\.com/, r => r.abort());
  const pgPareil = await ctxPareil.newPage();
  await ouvrirPage(pgPareil);
  await reposer(pgPareil, 2250);
  ok("un écart de quatre degrés avec la veille ne s'écrit pas",
    !(await phrasesConseils(pgPareil, "#ecran .cj-l")).some(x => /qu'hier/.test(x)),
    (await phrasesConseils(pgPareil, "#ecran .cj-l")).join(" | "));
  await ctxPareil.close();

  /* Le ciel à deux astres. Le 18 août 2026 à dix-neuf heures, le Soleil est à
     dix-sept degrés et la Lune à vingt-deux : le vrai ciel les porte tous les
     deux, l'application doit les porter aussi. */
  const pageA = async (quand, patch, faire) => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
      reducedMotion: "reduce",
    });
    await c.addInitScript(amorceA(FAIN, quand));
    await c.route(/api\.open-meteo\.com/, route => {
      const u = route.request().url();
      const d = JSON.parse(JSON.stringify(METEO));
      if (patch) patch(d);
      if (u.includes("current=")) {
        route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
      }
      if (u.includes("hourly=")) {
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ hourly: d.hourly }) }); return;
      }
      delete d.hourly;
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    });
    await c.route(/api-adresse\.data\.gouv\.fr|object\.files\.data\.gouv\.fr|webservice\.meteofrance\.com/,
      r => r.abort());
    const pg = await c.newPage();
    await ouvrirPage(pg);
    await reposer(pg, 2250);
    await faire(pg);
    await c.close();
  };

  /* Décale la température d'une journée entière, heures et jour, pour composer un
     cas que la charge d'essai ne porte pas. */
  const decaler = (jour, ecart) => d => {
    const i0 = d.hourly.time.findIndex(x => x.startsWith(jour));
    for (let k = i0; k < i0 + 24; k++) {
      d.hourly.temperature_2m[k] += ecart;
      d.hourly.apparent_temperature[k] += ecart;
    }
    const j = d.daily.time.indexOf(jour);
    if (j >= 0) {
      d.daily.temperature_2m_max[j] += ecart;
      d.daily.temperature_2m_min[j] += ecart;
    }
  };

  /* Le profil d'opacité du disque de la Lune, sur sa ligne médiane. De nuit il est
     plein d'un bord à l'autre, la part cendrée comprise. De jour la part sombre
     s'efface : seule reste la part éclairée, comme dans le vrai ciel. */
  const profilLune = pg => pg.evaluate(() => {
    const cv = document.getElementById("ciLune");
    if (!cv) return null;
    const x = cv.getContext("2d");
    const d = x.getImageData(0, 0, cv.width, cv.height).data;
    const y = Math.round(cv.height / 2), L = cv.width, c = L / 2;
    const R = L * 0.155 * 0.8;          // bien à l'intérieur du disque
    let mn = 255, mx = 0;
    for (let i = Math.round(c - R); i <= Math.round(c + R); i++) {
      const a = d[(y * L + i) * 4 + 3];
      if (a < mn) mn = a;
      if (a > mx) mx = a;
    }
    return { mn, mx, clarte: Number(cv.dataset.clarte) };
  });

  /* La cohérence entre écrans : la même grandeur affichée à deux endroits porte
     le même chiffre. Chaque paire lit deux rendus, jamais les modules. */
  await pageA("2026-08-18T09:00:00+02:00", null, async pg => {
    const acc = await pg.evaluate(() => ({
      deg: document.querySelector(".bd-deg")?.textContent.trim(),
      bornes: document.querySelector(".bd-bornes")?.textContent.trim(),
      pluie: [...document.querySelectorAll(".bd-m")].map(e =>
        [e.querySelector("i").textContent.trim(), e.querySelector("b").textContent.trim()])
        .find(([n]) => n === "Pluie")?.[1],
      demain: [...document.querySelectorAll('.section[data-bloc="suite"] .cj-l')]
        .map(e => e.dataset.phrase || e.textContent).find(x => /^Pluie demain/.test(x)) || "",
    }));
    await ouvrirLeTemps(pg);
    await pg.waitForTimeout(500);
    const sous = await pg.locator(".titre-ecran p").innerText();
    await pg.locator('[data-onglet="semaine"]').click();
    await pg.waitForTimeout(500);
    /* Les rangées se désignent par leur nom et non par leur rang : la table
       commence deux journées avant aujourd'hui depuis que les heures portent le
       passé. */
    const sem = await pg.evaluate(() => ["Auj.", "Demain"].map(nom => {
      const e = [...document.querySelectorAll(".sem-r")]
        .find(x => x.querySelector(".j b")?.textContent.trim() === nom);
      if (!e) return { eau: "", min: "", max: "" };
      return {
        eau: (e.querySelector(".c em") || {}).textContent?.trim() || "",
        min: e.querySelector(".sem-min")?.textContent.trim(),
        max: e.querySelector(".sem-max")?.textContent.trim(),
      };
    }));
    ok("les bornes du bandeau sont celles de la semaine",
      acc.bornes.includes(`${sem[0].min} à ${sem[0].max}`),
      `« ${acc.bornes} » contre « ${sem[0].min} à ${sem[0].max} »`);
    ok("la tuile de pluie dit ce que dit la semaine",
      acc.pluie === sem[0].eau, `« ${acc.pluie} » contre « ${sem[0].eau} »`);
    ok("la pluie de demain est la même sur l'accueil et la semaine",
      acc.demain.includes(sem[1].eau), `« ${acc.demain} » contre « ${sem[1].eau} »`);
    ok("le sous-titre du temps porte le chiffre du bandeau",
      sous.startsWith(`${acc.deg.replace("°", "")}°`), `« ${sous} » contre « ${acc.deg} »`);
  });

  /* Le degré s'écrit sans décimale, partout. `nombreFr` en garde une sous dix :
     le sous-titre disait « 9,4° » sous un bandeau qui dit « 9° », et la liste
     mêlait « 9,4° » et « 10° » dans une même colonne. */
  await pageA("2026-08-18T09:00:00+02:00", d => {
    d.hourly.time.forEach((x, k) => {
      if (x.startsWith("2026-08-18")) {
        d.hourly.temperature_2m[k] -= 7.6;
        d.hourly.apparent_temperature[k] -= 7.6;
        d.hourly.dew_point_2m[k] -= 7.6;
      }
    });
  }, async pg => {
    await ouvrirLeTemps(pg);
    await pg.waitForTimeout(500);
    const sous = await pg.locator(".titre-ecran p").innerText();
    ok("le sous-titre du temps s'écrit sans décimale",
      /^\d+° et /.test(sous), sous);
    await pg.locator('[data-ecriture="liste"]').click();
    await pg.waitForTimeout(500);
    ok("les températures de la liste s'écrivent sans décimale", await pg.evaluate(() => {
      const fautes = [];
      for (const tr of document.querySelectorAll(".hh tbody tr")) {
        for (const td of [...tr.children].slice(2, 5)) {
          if (/\d,\d°/.test(td.textContent)) fautes.push(td.textContent.trim());
        }
      }
      return fautes.length ? fautes.slice(0, 4).join(" ") : "";
    }) === "", await pg.evaluate(() =>
      document.querySelector(".hh tbody tr")?.textContent.trim().slice(0, 40)));
  });

  /* Le gel s'annonce au degré rond, et le mot s'accorde. */
  await pageA("2026-08-18T09:00:00+02:00", d => {
    d.hourly.time.forEach((x, k) => {
      if (x.startsWith("2026-08-18")) {
        d.hourly.temperature_2m[k] -= 16.6;
        d.hourly.apparent_temperature[k] -= 16.6;
      }
    });
  }, async pg => {
    const gel = (await phrasesConseils(pg, "#ecran .cj-l"))
      .find(x => /^Gel probable/.test(x)) || "";
    ok("le gel s'annonce au degré rond, le mot accordé",
      /jusqu'à -?\d+ degré(s)?\./.test(gel) && !/\d,\d degré/.test(gel),
      gel || "aucune ligne de gel");
  });

  /* La section des faits marquants s'arrête à après-demain. Les règles horaires
     couvrent le jour et le lendemain, les alertes le surlendemain, et rien
     au-delà : « 32° mercredi » annoncé un dimanche est de l'almanach, non un fait
     marquant, et la semaine est là pour cela. */
  await pageA("2026-08-18T09:00:00+02:00", d => {
    decaler("2026-08-21", 6)(d);   // i + 3, hors de portée
    decaler("2026-08-22", 6)(d);   // i + 4, hors de portée
  }, async pg => {
    const dit = (await phrasesConseils(pg, "#ecran .cj-l")).join(" | ");
    /* Aucune journée au-delà d'après-demain n'est nommée. Un jour de la semaine
       écrit en toutes lettres est la marque de l'ancien mécanisme d'alertes, qui
       portait jusqu'à quatre jours. */
    ok("rien ne se dit au-delà d'après-demain",
      !/lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/i.test(dit), dit);
  });
  await pageA("2026-08-18T09:00:00+02:00", d => {
    decaler("2026-08-20", 6)(d);
    d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
    d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
  }, async pg => {
    /* Depuis le 27 septembre 2026, l'accueil ne parle plus d'après-demain : la
       chaleur d'après-demain se lit dans La semaine. */
    const dit = (await phrasesConseils(pg, '#ecran .section[data-bloc="suite"] .cj-l')).join(" | ");
    ok("après-demain ne se dit plus sur l'accueil", !/après-demain/.test(dit), dit || "aucune ligne");
    const titre = await pg.evaluate(() =>
      document.querySelector('#ecran .section[data-bloc="suite"] h2')?.textContent || "");
    ok("le titre nomme la seule journée portée", titre === "" || titre === "Demain", titre);
  });

  /* La chaleur et le renversement de température ne nomment pas deux fois le même
     chiffre. À vingt-deux heures la fenêtre glissante contient le pic du
     lendemain : les deux règles le voyaient et l'écrivaient à la suite. */
  await pageA("2026-08-18T22:00:00+02:00", d => {
    decaler("2026-08-19", 8)(d);
    d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
    d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
  }, async pg => {
    const cj = await phrasesConseils(pg, ".conseils .cj-l");
    const avec33 = cj.filter(x => /33/.test(x));
    ok("un même maximum n'est pas annoncé deux fois",
      avec33.length === 1 && /Réchauffement/.test(avec33[0]), cj.join(" | "));
  });

  await pageA("2026-08-18T19:00:00+02:00", null, async pg => {
    ok("les deux astres levés partagent le ciel",
      await pg.locator("#ecran canvas#ciFeu").count() === 1
      && await pg.locator("#ecran canvas#ciLune").count() === 1,
      `${await pg.locator("#ecran canvas#ciFeu").count()} soleil, `
      + `${await pg.locator("#ecran canvas#ciLune").count()} lune`);
    const places = await pg.evaluate(() => [...document.querySelectorAll("#ecran .ci-astre")]
      .map(e => parseFloat(e.style.getPropertyValue("--ax"))));
    /* Chacun à sa place, et les disques ne se touchent pas : leurs rayons font
       ensemble près d'un tiers de la largeur du panneau. */
    ok("les deux disques gardent leur écart",
      places.length === 2 && Math.abs(places[0] - places[1]) > 25,
      places.map(v => v.toFixed(0)).join(" et "));
    const pf = await profilLune(pg);
    ok("de jour, la part sombre de la Lune s'efface",
      pf && pf.clarte > 0.9 && pf.mn < 60 && pf.mx > 150,
      pf ? `opacité de ${pf.mn} à ${pf.mx}, clarté ${pf.clarte}` : "aucune toile");
  });

  /* La nuit, la Lune est seule et garde son disque entier : la part cendrée est
     ce qui reste de Lune quand le Soleil n'en éclaire qu'un croissant. */
  await pageA("2026-08-20T22:00:00+02:00", null, async pg => {
    ok("la nuit, la Lune est seule dans le ciel",
      await pg.locator("#ecran canvas#ciLune").count() === 1
      && await pg.locator("#ecran canvas#ciFeu").count() === 0,
      `${await pg.locator("#ecran canvas#ciFeu").count()} soleil, `
      + `${await pg.locator("#ecran canvas#ciLune").count()} lune`);
    const pf = await profilLune(pg);
    ok("la nuit, la Lune garde son disque entier",
      pf && pf.clarte < 0.1 && pf.mn > 150,
      pf ? `opacité de ${pf.mn} à ${pf.mx}, clarté ${pf.clarte}` : "aucune toile");
  });

  /* Le Soleil se montre, ou non, selon la même règle sur les deux écrans qui le
     portent. L'accueil l'appliquait, l'écran du Soleil non : son disque restait
     allumé au ras du sol à onze heures du soir, sur un ciel déjà passé en nuit
     pleine. Défaut vu sur téléphone le 29 août à 22 h 09.

     Deux instants, de part et d'autre du seuil : à moins quatre degrés le disque
     porte encore la lueur du crépuscule civil, à moins treize il n'y a plus rien
     à peindre à sa place. */
  for (const [quand, hauteur, attendu] of [
    ["2026-08-18T21:10:00+02:00", "moins quatre degrés", 1],
    ["2026-08-18T22:09:00+02:00", "moins treize degrés", 0],
  ]) {
    await pageA(quand, null, async pg => {
      const disques = async () => pg.locator("#ecran canvas#ciFeu").count();
      await pg.locator('[data-onglet="accueil"]').click();
      await pg.waitForTimeout(450);
      const accueil = await disques();
      await ecranCiel(pg, "soleil");
      const soleil = await disques();
      ok(`à ${hauteur}, les deux écrans montrent le même Soleil`,
        accueil === attendu && soleil === attendu,
        `accueil ${accueil}, écran du Soleil ${soleil}, attendu ${attendu}`);
    });
  }

  /* Sur une installation neuve, la destination ouvre sur le soleil : il parle de
     la journée en cours, quand la lune parle d'un cycle qui la déborde. Le
     contexte est neuf, celui du contrôle principal ayant déjà changé d'écran. */
  await pageA("2026-08-18T09:00:00+02:00", null, async pg => {
    await pg.locator('[data-onglet="ciel"]').click();
    await pg.waitForTimeout(500);
    ok("sur une installation neuve, le soleil ouvre la destination",
      await pg.locator("#ecran #ptSoleil").count() === 1
      && await pg.locator("#ecran #ptLune").count() === 0,
      `${await pg.locator("#ecran #ptSoleil").count()} soleil, `
      + `${await pg.locator("#ecran #ptLune").count()} lune`);
  });

  /* Le relais entre le disque et le ciel. Le disque s'éteint six degrés sous
     l'horizon, le dégradé du ciel porte encore la lueur jusqu'à douze : entre les
     deux, le panneau n'est ni allumé ni noir. Sans ce recouvrement, la lueur
     s'éteindrait d'un coup à l'instant où le disque disparaît. */
  const basDuCiel = {};
  for (const [cle, quand] of [
    ["lueur", "2026-08-18T21:35:00+02:00"],   // moins huit degrés
    ["nuit", "2026-08-18T23:00:00+02:00"],    // moins dix-neuf degrés
  ]) {
    await pageA(quand, null, async pg => {
      await ecranCiel(pg, "soleil");
      basDuCiel[cle] = await pg.evaluate(() => ({
        bas: document.querySelector("#ecran .ci")?.style.getPropertyValue("--ci-bas") || "",
        feu: document.querySelectorAll("#ecran canvas#ciFeu").length,
      }));
    });
  }
  const rougeDe = s => Number((String(s).match(/\d+/g) || [0])[0]);
  ok("le disque éteint, le ciel porte encore la lueur du crépuscule",
    basDuCiel.lueur.feu === 0 && basDuCiel.nuit.feu === 0
    && rougeDe(basDuCiel.lueur.bas) > rougeDe(basDuCiel.nuit.bas) + 10,
    `${basDuCiel.lueur.bas} contre ${basDuCiel.nuit.bas}, `
    + `${basDuCiel.lueur.feu} et ${basDuCiel.nuit.feu} disques`);

  const ctxLent = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxLent.addInitScript(`localStorage.setItem("mameteo.reglages.v1", JSON.stringify({
  commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
  ecriture: "ruban", poste: null
}));`);
  await ctxLent.route(/api\.open-meteo\.com/, async route => {
    await new Promise(r => setTimeout(r, 2500));
    const d = JSON.parse(JSON.stringify(METEO));
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  const pgLent = await ctxLent.newPage();
  pgLent.goto(RACINE_HTTP).catch(() => {});
  await pgLent.waitForTimeout(1200);
  ok("la première lecture montre une ossature, non un voile plein écran",
    await pgLent.locator(".ossature").count() >= 3
    && await pgLent.locator(".etat-vide .tourne").count() === 0);
  await ctxLent.close();
};
