import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
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
  lat: 47.5, lon: 4.3, ecriture: "ruban", poste: null };

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
  await pg.locator(`[data-onglet="${process.env.ECRAN || "soleil"}"]`).click();
  await pg.waitForTimeout(700);

  const cle = process.env.ECRAN || "soleil";
  if (process.env.OUVRIRVOIE) {
    await pg.locator(`[data-voie="${process.env.OUVRIRVOIE}"]`).click();
    await pg.waitForTimeout(500);
  }
  if (process.env.OUVRIR) {
    await pg.locator(".sem-r").nth(Number(process.env.OUVRIR)).click();
    await pg.waitForTimeout(500);
  }
  if (process.env.FEUILLE) {
    await pg.locator(process.env.FEUILLE === "parapluie" ? "#navJeton" : "#btnReglages").click();
    await pg.waitForTimeout(600);
  }
  await pg.screenshot({ path: path.join(SORTIE, `${cle}-haut-${theme}.png`) });
  await pg.evaluate(() => window.scrollTo({ top: 99999, behavior: "instant" }));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SORTIE, `${cle}-bas-${theme}.png`) });
  await ctx.close();
}

await nav.close();
serveur.close();
console.log("captures faites");
