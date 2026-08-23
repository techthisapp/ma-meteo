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
  await pg.screenshot({ path: path.join(SORTIE, `${cle}-haut-${theme}.png`) });
  await pg.evaluate(() => window.scrollTo({ top: 99999, behavior: "instant" }));
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SORTIE, `${cle}-bas-${theme}.png`) });
  await ctx.close();
}

await nav.close();
serveur.close();
console.log("captures faites");
