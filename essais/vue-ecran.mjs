import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..");
const SORTIE = path.join(ICI, "captures");
fs.mkdirSync(SORTIE, { recursive: true });

const METEO = JSON.parse(fs.readFileSync(path.join(ICI, "meteo.json"), "utf8"));
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

const FIGE = new Date(process.env.QUAND || "2026-08-18T09:00:00+02:00").getTime();
const REGLAGES = { commune: "Fain-lès-Moutiers", codePostal: "21500",
  lat: 47.5, lon: 4.3, ecriture: "ruban", poste: null,
  /* Trois lieux suivis pour la feuille du beau temps, qui compare des lieux :
     avec le seul lieu courant, la capture ne montrerait qu'une rangée. */
  suivies: process.env.FEUILLE === "beautemps" ? [
    { commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3 },
    { commune: "Troyes", codePostal: "10000", lat: 48.3, lon: 4.07 },
    { commune: "Autun", codePostal: "71400", lat: 46.95, lon: 4.3 },
  ] : [] };

/* Deux journées par point, comme la source les rend pour plusieurs couples de
   coordonnées : le soleil monte vers le nord, la pluie tombe à l'ouest. */
const journeesDe = (lat, lon) => {
  const u = Math.max(0, Math.min(1, (lat - 46.6) / 1.8));
  const journee = j => {
    const p = j === 0 ? u : 1 - u;
    return {
      soleil: 2.5 + 7 * p + 0.4 * (lon - 4.3),
      tmax: 27 - 5 * p,
      pluie: lon < 3.9 ? 6 : 0,
    };
  };
  const d = [journee(0), journee(1)];
  return { daily: {
    time: ["2026-08-18", "2026-08-19"],
    weather_code: d.map(x => (x.pluie ? 61 : x.soleil > 7 ? 0 : 3)),
    temperature_2m_max: d.map(x => Math.round(x.tmax * 10) / 10),
    precipitation_sum: d.map(x => x.pluie),
    sunshine_duration: d.map(x => Math.round(Math.max(0, x.soleil) * 3600)),
    daylight_duration: [48600, 48600],
  } };
};

/* Une tuile de pluie fabriquée. La nappe est une somme d'ondes prises en
   coordonnées de monde : elle se raccorde donc d'une tuile à l'autre, et
   l'image la déplace vers l'est comme une masse pluvieuse se déplace. */
const PALETTE = [
  [0.55, [120, 185, 232], 110], [0.63, [24, 140, 205], 190],
  [0.71, [0, 175, 150], 215], [0.79, [225, 200, 70], 235],
  [0.86, [228, 120, 55], 242], [0.92, [214, 62, 60], 248],
];
function tuilePluie(im, taille, z, tx, ty) {
  const n = taille;
  const brut = Buffer.alloc(n * (n * 4 + 1));
  const N = Math.pow(2, z);
  const decal = im * 0.0035;   // la masse avance vers l'est d'image en image
  for (let y = 0; y < n; y++) {
    const wy = (ty + y / n) / N;
    const o = y * (n * 4 + 1);
    for (let x = 0; x < n; x++) {
      const wx = (tx + x / n) / N - decal;
      const u = wx * 360 - 180, v = (0.5 - wy) * 360;
      const a = Math.sin(u * 1.7 + v * 0.9) * Math.cos(v * 1.3 - u * 0.6);
      const b = Math.sin(u * 4.1 - v * 2.7) * 0.45;
      const c = Math.cos(u * 0.8 + v * 2.2) * 0.35;
      const val = (a + b + c + 1.8) / 3.6;
      let t = [0, 0, 0], al = 0;
      for (const [seuil, teinte, alpha] of PALETTE) {
        if (val >= seuil) { t = teinte; al = alpha; }
      }
      const p = o + 1 + x * 4;
      brut[p] = t[0]; brut[p + 1] = t[1]; brut[p + 2] = t[2]; brut[p + 3] = al;
    }
  }
  const bloc = (type, data) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0);
    const tt = Buffer.from(type, "ascii");
    const cc = Buffer.alloc(4); cc.writeUInt32BE(zlib.crc32(Buffer.concat([tt, data])) >>> 0, 0);
    return Buffer.concat([l, tt, data, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc("IHDR", ihdr), bloc("IDAT", zlib.deflateSync(brut)),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

for (const theme of ["light", "dark"]) {
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    colorScheme: theme,
  });
  await ctx.addInitScript(`{
    const ecart = ${FIGE} - Date.now();
    const D = Date;
    globalThis.Date = class extends D {
      constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
      static now(){ return D.now() + ecart; }
    };
    Object.setPrototypeOf(globalThis.Date, D);
    localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(REGLAGES))});
  }`);
  await ctx.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    /* De la pluie posée l'après-midi du 18 août, pour les vues qui montrent le
       rappel de parapluie. La charge d'essai est sèche ce jour-là. */
    if (process.env.PLUIE) {
      for (let k = 0; k < d.hourly.time.length; k++) {
        if (!/^2026-08-18T1[45]/.test(d.hourly.time[k])) continue;
        d.hourly.precipitation[k] = 1.2;
        d.hourly.precipitation_probability[k] = 80;
        d.hourly.wind_gusts_10m[k] = process.env.PLUIE === "vent" ? 55 : 30;
      }
    }
    if (u.includes("sunshine_duration")) {
      const q = new URL(u).searchParams;
      const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
      const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(lats.map((la, k) => journeesDe(la, lons[k]))) });
      return;
    }
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
  await ctx.route(/data\.gouv\.fr|webservice\.meteofrance\.com/, r => r.abort());
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
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: tuilePluie(im, taille, z, tx, ty) });
  });
  /* L'air : quatre-vingt-seize heures à partir de minuit du 18 août. L'indice
     monte l'après-midi, les graminées sont en saison, l'ambroisie au pic à
     quinze heures. La route vient après celle de la prévision, dont
     l'expression happerait ce domaine. */
  await ctx.route(/air-quality-api\.open-meteo\.com/, r => {
    const h = { time: [], european_aqi: [] };
    const fixes = { pm2_5: 5.1, pm10: 8.2, ozone: 57, nitrogen_dioxide: 3.3,
      alder_pollen: 0, birch_pollen: 0, grass_pollen: 12, mugwort_pollen: 0.4,
      olive_pollen: 0, ragweed_pollen: 0.5 };
    for (const c of Object.keys(fixes)) h[c] = [];
    for (let j = 18; j < 22; j++) {
      for (let x = 0; x < 24; x++) {
        h.time.push(`2026-08-${j}T${String(x).padStart(2, "0")}:00`);
        h.european_aqi.push(x >= 12 && x <= 17 ? 26 : 14);
        for (const c of Object.keys(fixes)) {
          h[c].push(c === "ragweed_pollen" && x === 15 ? 71 : fixes[c]);
        }
      }
    }
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ hourly: h }) });
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
  /* Les scénarios, bâtis sur la charge d'essai : quarante membres écartés d'une
     demi-largeur qui s'ouvre avec l'échéance. La route vient après celle de la
     prévision, dont l'expression happerait ce domaine, Playwright essayant la
     dernière posée en premier. */
  await ctx.route(/ensemble-api\.open-meteo\.com/, r => {
    const h = METEO.hourly;
    const i0 = h.time.findIndex(t => t >= new Date(FIGE).toISOString().slice(0, 10));
    const out = { time: h.time.slice(Math.max(0, i0)) };
    const demi = L => Math.min(6, 0.5 + Math.max(0, L) / 20);
    const col = (nom, base, ech) => {
      const d0 = Math.max(0, i0);
      out[nom] = out.time.map((t, k) => base[d0 + k]);
      for (let m = 1; m < 40; m++) {
        const f = (m % 2 ? -1 : 1) * Math.ceil(m / 2) / 20;
        out[`${nom}_member${String(m).padStart(2, "0")}`] = out.time.map((t, k) => {
          const L = (Date.parse(`${t}:00`) - FIGE) / 3600000;
          return Math.round(Math.max(nom === "precipitation" ? 0 : -60,
            base[d0 + k] + f * demi(L) * ech) * 10) / 10;
        });
      }
    };
    col("temperature_2m", h.temperature_2m, 1);
    col("precipitation", h.precipitation, 0.2);
    col("wind_speed_10m", h.wind_speed_10m, 2);
    col("wind_gusts_10m", h.wind_gusts_10m, 3);
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ hourly: out }) });
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
  if (process.env.DEZOOM) {
    for (let k = 0; k < Number(process.env.DEZOOM); k++) {
      await pg.locator("#caMoins").click();
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
console.log("captures faites");
