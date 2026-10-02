/* L'outil de captures d'écran. Depuis le 2 octobre 2026, il sert les mêmes
   faux services que les contrôles, essais/faux-services.mjs, avec le même
   filet du réseau : une capture ne touche plus le vrai réseau. Seules restent
   ici les charges posées pour l'image, le radar en nappe continue, la
   vigilance de plusieurs départements, la pluie dans l'heure et la pluie de
   l'après-midi à la demande, la grille de l'air et les noms des points. */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { METEO, amorceA, enPng, nouvelEtat, brancherFauxServices, envelopperNavigateur } from "./faux-services.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..");
const SORTIE = path.join(ICI, "captures");
fs.mkdirSync(SORTIE, { recursive: true });

const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
               ".json":"application/json", ".svg":"image/svg+xml",
               ".webmanifest":"application/manifest+json", ".png":"image/png" };

const serveur = http.createServer((rq, rs) => {
  let p = decodeURIComponent(rq.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(RACINE, p);
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    rs.writeHead(404); rs.end("non"); return;
  }
  rs.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "text/plain" });
  rs.end(fs.readFileSync(f));
});
await new Promise(r => serveur.listen(8141, r));

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const sortantes = envelopperNavigateur(nav);

const FIGE = new Date(process.env.QUAND || "2026-08-18T09:00:00+02:00").getTime();
const REGLAGES = { commune: "Fain-lès-Moutiers", codePostal: "21500",
  lat: 47.5, lon: 4.3, ecriture: "ruban", poste: null,
  /* Trois lieux suivis pour la feuille du beau temps, qui compare des lieux :
     avec le seul lieu courant, la capture ne montrerait qu'une rangée. */
  suivies: process.env.FEUILLE === "beautemps" ? [
    { commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3 },
    { commune: "Troyes", codePostal: "10000", lat: 48.3, lon: 4.07 },
    { commune: "Autun", codePostal: "71400", lat: 46.95, lon: 4.3 },
  ] : [],
  /* La nappe de la carte : la variable NAPPE la pose avant le chargement, la
     capture n'ayant pas à passer par le panneau pour la choisir. */
  ...(process.env.NAPPE ? { nappe: process.env.NAPPE } : {}),
  ...(process.env.CIEL ? { ciel: process.env.CIEL } : {}),
  ...(process.env.VENT ? { ventcarte: true } : {}) };

/* Une tuile de pluie fabriquée. La nappe est une somme d'ondes prises en
   coordonnées de monde : elle se raccorde donc d'une tuile à l'autre, et
   l'image la déplace vers l'est comme une masse pluvieuse se déplace. */
const PALETTE = [
  [0.55, [120, 185, 232], 110], [0.63, [24, 140, 205], 190],
  [0.71, [0, 175, 150], 215], [0.79, [225, 200, 70], 235],
  [0.86, [228, 120, 55], 242], [0.92, [214, 62, 60], 248],
];
/* Le PNG. Une fonction rend la couleur de chaque point ; l'enveloppe est celle
   des faux services. */
function png(n, teinteDe) {
  const brut = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) {
    const o = y * (n * 4 + 1);
    for (let x = 0; x < n; x++) {
      const [r, g, b, a] = teinteDe(x, y);
      const p = o + 1 + x * 4;
      brut[p] = r; brut[p + 1] = g; brut[p + 2] = b; brut[p + 3] = a;
    }
  }
  return enPng(brut, n);
}

/* La tuile de refus du service : un aplat gris uni. Elle n'a pas à porter le
   texte de la vraie, seule sa présence compte. */
const tuileRefus = taille => png(taille, () => [128, 128, 128, 200]);

function tuilePluie(im, taille, z, tx, ty) {
  const N = Math.pow(2, z);
  /* La masse avance vers l'est d'image en image. Le pas vaut deux points de
     zoom cinq par image de dix minutes, soit une quarantaine de kilomètres par
     heure : c'est l'allure d'une masse pluvieuse ordinaire, et la mesure du sens
     d'arrivée la retrouve. */
  const decal = im * 0.00024;
  return png(taille, (x, y) => {
    const wy = (ty + y / taille) / N;
    const wx = (tx + x / taille) / N - decal;
    const u = wx * 360 - 180, v = (0.5 - wy) * 360;
    const a = Math.sin(u * 1.7 + v * 0.9) * Math.cos(v * 1.3 - u * 0.6);
    const b = Math.sin(u * 4.1 - v * 2.7) * 0.45;
    const c = Math.cos(u * 0.8 + v * 2.2) * 0.35;
    const val = (a + b + c + 1.8) / 3.6;
    let t = [0, 0, 0], al = 0;
    for (const [seuil, teinte, alpha] of PALETTE) {
      if (val >= seuil) { t = teinte; al = alpha; }
    }
    return [t[0], t[1], t[2], al];
  });
}

for (const theme of ["light", "dark"]) {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    colorScheme: theme,
  });
  await ctx.addInitScript(amorceA(REGLAGES, FIGE));
  /* Les faux services des contrôles, l'air au profil de l'ambroisie, puis les
     charges propres aux captures, posées après pour passer devant. */
  await brancherFauxServices(ctx, Object.assign(nouvelEtat(), { profilAir: "ambroisie" }));
  /* De la pluie posée l'après-midi du 18 août, pour les vues qui montrent le
     rappel de parapluie. La charge d'essai est sèche ce jour-là. Seule la
     prévision horaire est retouchée ; les autres demandes au même hôte vont aux
     faux services. */
  if (process.env.PLUIE) {
    await ctx.route(/api\.open-meteo\.com/, route => {
      const u = route.request().url();
      if (new URL(u).host !== "api.open-meteo.com" || !u.includes("hourly=")
        || /minutely_15|snow_depth|soil_moisture|start_date=|current=|latitude=48\.857%2C/.test(u)) {
        route.fallback(); return;
      }
      const d = JSON.parse(JSON.stringify(METEO));
      for (let k = 0; k < d.hourly.time.length; k++) {
        if (!/^2026-08-18T1[45]/.test(d.hourly.time[k])) continue;
        d.hourly.precipitation[k] = 1.2;
        d.hourly.precipitation_probability[k] = 80;
        d.hourly.wind_gusts_10m[k] = process.env.PLUIE === "vent" ? 55 : 30;
      }
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) });
    });
  }
  /* La vigilance du département reste muette sur les captures, comme avant le
     2 octobre 2026 : son bandeau masquerait le haut des écrans. */
  await ctx.route(/webservice\.meteofrance\.com/, r => r.abort());
  /* La vigilance de tout le pays, pour la couche de la carte. Quelques
     départements en jaune, en orange et un en rouge, de quoi voir les trois
     teintes. La route vient après la coupure du service. */
  await ctx.route(/warning\/currentphenomenons/, r => {
    const niveaux = { "29": 2, "22": 2, "56": 2, "35": 2, "44": 3, "85": 3,
      "17": 3, "33": 4, "40": 2, "64": 2, "13": 3, "83": 2, "06": 2 };
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      update_time: Math.floor(FIGE / 1000),
      domain_id: "FRA",
      subdomains_phenomenons_max_color: Object.entries(niveaux).map(([d, n]) => ({
        domain_id: d,
        phenomenons_max_color: [{ phenomenon_id: "1", phenomenon_max_color_id: n }],
      })),
    })});
  });
  /* La pluie dans l'heure. Elle se sert après la coupure du service, dont
     l'expression happerait ce chemin : Playwright essaie la dernière route posée
     en premier. Le profil se choisit par la variable, l'écran ne montrant rien
     quand l'heure est sèche. */
  await ctx.route(/webservice\.meteofrance\.com\/v3\/nowcast\/rain/, r => {
    const i = (process.env.PLUIEPROCHE || "1,1,1,2,3,3,1,1,1").split(",").map(Number);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      update_time: new Date(FIGE - 3e5).toISOString(),
      properties: { name: "Millery", rain_product_available: 1,
        forecast: [5, 10, 15, 20, 25, 30, 40, 50, 60].map((m, k) => ({
          time: new Date(FIGE + m * 60000).toISOString(), rain_intensity: i[k],
          rain_intensity_description: "x" })) } }) });
  });
  /* Le radar. Les tuiles sont fabriquées ici plutôt que demandées au service :
     l'horloge de la capture est figée au 18 août, et les images du service
     portent l'heure du jour où l'on capture. La nappe est une somme d'ondes en
     coordonnées de monde, donc continue d'une tuile à l'autre, et sa palette
     suit celle du service, du bleu pâle au rouge. */
  await ctx.route(/api\.rainviewer\.com/, r => {
    const t0 = Math.floor(FIGE / 1000 / 600) * 600;
    const past = [];
    for (let k = 12; k >= 0; k--) past.push({ time: t0 - k * 600, path: `/v2/radar/o${12 - k}` });
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      host: "https://tilecache.rainviewer.com", radar: { past, nowcast: [] } }) });
  });
  await ctx.route(/tilecache\.rainviewer\.com/, r => {
    const m = /\/v2\/radar\/o(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\//.exec(r.request().url());
    if (!m) { r.fulfill({ status: 404, body: "non" }); return; }
    const [, im, taille, z, tx, ty] = m.map(Number);
    /* Le service ne sert le radar que jusqu'au zoom sept, mesuré le 6 septembre
       2026 : au delà il rend une image grise unique portant « Zoom Level Not
       Supported ». La capture le refuse de même, sans quoi elle montrerait une
       pluie que l'application ne recevrait pas. */
    if (z > 7) { r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: tuileRefus(taille) }); return; }
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: tuilePluie(im, taille, z, tx, ty) });
  });
  /* La grille de l'air sur la carte : l'indice monte vers le nord-est. La
     feuille de l'air, qui demande des heures sur un seul point, va aux faux
     services. */
  await ctx.route(/air-quality-api\.open-meteo\.com/, r => {
    const u = new URL(r.request().url());
    if (!u.searchParams.get("current")) { r.fallback(); return; }
    const las = u.searchParams.get("latitude").split(",").map(Number);
    const los = u.searchParams.get("longitude").split(",").map(Number);
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(las.map((la, k) => ({
        latitude: la, longitude: los[k],
        current: { time: "2026-08-18T09:00", interval: 3600,
          european_aqi: Math.round(10 + (la - 41) * 2.6 + los[k] * 1.1) },
      }))) });
  });
  /* L'interface adresse nomme les points de la grille. La route vient après
     celle qui coupe data.gouv.fr, Playwright essayant la dernière posée en
     premier. */
  await ctx.route(/api-adresse\.data\.gouv\.fr\/reverse/, r => {
    const u = new URL(r.request().url());
    const lat = Number(u.searchParams.get("lat"));
    const nom = lat > 48 ? "Troyes" : lat > 47.6 ? "Tonnerre"
      : lat > 47.2 ? "Semur-en-Auxois" : "Autun";
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [{
      geometry: { coordinates: [u.searchParams.get("lon"), lat] },
      properties: { city: nom, postcode: "21140", type: "municipality" },
    }] }) });
  });

  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8141/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(900);
  /* Le soleil et la lune sont deux écrans de la destination Le ciel : la
     variable les nomme encore, la capture ouvre la destination puis choisit. */
  const voulu = process.env.ECRAN || "soleil";
  const dansLeCiel = voulu === "soleil" || voulu === "lune";
  await pg.locator(`[data-onglet="${dansLeCiel ? "ciel" : voulu}"]`).click();
  await pg.waitForTimeout(700);
  if (dansLeCiel) {
    await pg.locator(`[data-ciel="${voulu}"]`).click();
    await pg.waitForTimeout(700);
  }

  const cle = process.env.ECRAN || "soleil";
  if (process.env.OUVRIRVOIE) {
    await pg.locator(`[data-voie="${process.env.OUVRIRVOIE}"]`).click();
    await pg.waitForTimeout(500);
  }
  if (process.env.OUVRIR) {
    await pg.locator(".sem-r").nth(Number(process.env.OUVRIR)).click();
    await pg.waitForTimeout(500);
  }
  /* La carte s'ouvre au zoom par défaut : la variable permet de la reculer de
     quelques crans pour voir le pays entier. */
  /* Mesure du coût de la couche de vent : la cadence d'images du navigateur,
     couche allumée puis éteinte. La différence est ce que les particules
     coûtent. */
  if (process.env.MESURE === "vent") {
    const cadence = async () => pg.evaluate(() => new Promise(res => {
      const t = [];
      let n = 0, avant = performance.now();
      const pas = () => {
        const m = performance.now();
        t.push(m - avant); avant = m;
        if (++n < 120) requestAnimationFrame(pas);
        else {
          const tries = t.slice(10).sort((a, b) => a - b);
          res({ median: tries[Math.floor(tries.length / 2)],
                pire: tries[tries.length - 1] });
        }
      };
      requestAnimationFrame(pas);
    }));
    const avec = await cadence();
    await pg.locator("#caCouches").click();
    await pg.waitForTimeout(200);
    await pg.locator("#caVent").click();
    await pg.waitForTimeout(600);
    const sans = await cadence();
    const n = await pg.evaluate(async () => {
      const V = await import("/src/vent.js");
      const cv = document.getElementById("caToileVent");
      return Math.round(cv.clientWidth * cv.clientHeight * V.DENSITE);
    });
    console.log(`particules ${n}`);
    console.log(`vent allumé : image médiane ${avec.median.toFixed(2)} ms, pire ${avec.pire.toFixed(2)} ms`);
    console.log(`vent éteint : image médiane ${sans.median.toFixed(2)} ms, pire ${sans.pire.toFixed(2)} ms`);
    await pg.locator("#caVent").click();
    await pg.waitForTimeout(400);
    await pg.locator("#caCouches").click();
    await pg.waitForTimeout(200);
  }

  /* Un toucher avant la capture, sur l'élément que CLIQUER désigne : le ciel
     en plein écran s'ouvre ainsi, depuis son bandeau. */
  if (process.env.CLIQUER) {
    await pg.waitForTimeout(1200);
    /* Plusieurs touchers se séparent par une barre verticale. */
    for (const sel of process.env.CLIQUER.split("|")) {
      await pg.locator(sel).click();
      await pg.waitForTimeout(900);
    }
  }

  /* Le panneau des couches, ouvert pour la capture qui le montre. */
  if (process.env.PANNEAU) {
    await pg.locator("#caCouches").click();
    await pg.waitForTimeout(400);
  }
  if (process.env.DEZOOM) {
    for (let k = 0; k < Number(process.env.DEZOOM); k++) {
      await pg.locator("#caToile").press("-");
      await pg.waitForTimeout(120);
    }
    await pg.waitForTimeout(400);
  }
  if (process.env.FEUILLE) {
    const cible = { parapluie: "#navJeton", activites: '[data-feuille="activites"]',
      beautemps: '[data-feuille="beautemps"]',
      air: '[data-feuille="air"]' }[process.env.FEUILLE]
      || "#btnReglages";
    await pg.locator(cible).click();
    await pg.waitForTimeout(600);
    if (process.env.LARGE) {
      await pg.locator("#btLarge").click();
      await pg.waitForTimeout(1400);
    }
  }
  await pg.screenshot({ path: path.join(SORTIE, `${cle}-haut-${theme}.png`) });
  /* Une feuille ouverte a son propre défilement : faire glisser la fenêtre
     rendait deux fois la même image. */
  await pg.evaluate(() => {
    const f = document.getElementById("feuille-corps");
    if (f && !document.getElementById("feuille").hidden) f.scrollTop = 99999;
    else window.scrollTo({ top: 99999, behavior: "instant" });
  });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SORTIE, `${cle}-bas-${theme}.png`) });
  await ctx.close();
}

await nav.close();
serveur.close();
if (sortantes.length) console.log(`requêtes refusées vers le réseau réel : ${[...new Set(sortantes)].join(" ")}`);
console.log("captures faites");
