const RACINE = "/sessions/zealous-gracious-ramanujan/mnt/Projects/ma-meteo";
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const METEO = JSON.parse(fs.readFileSync("/tmp/essais/meteo.json", "utf8"));
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
               ".json":"application/json", ".svg":"image/svg+xml",
               ".webmanifest":"application/manifest+json" };

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
await new Promise(r => serveur.listen(8137, r));

const nav = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
});

// Horloge figée au 18 août 2026, 9 h, heure de Paris.
const FIGE = new Date("2026-08-18T09:00:00+02:00").getTime();
await ctx.addInitScript(`{
  const ecart = ${FIGE} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  localStorage.setItem("mameteo.reglages.v1", JSON.stringify({
    commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
    ecriture: "ruban", poste: null
  }));
}`);

// Les trois appels Open-Meteo sont détournés, les sources data.gouv sont muettes.
await ctx.route(/api\.open-meteo\.com/, route => {
  const u = route.request().url();
  const d = JSON.parse(JSON.stringify(METEO));
  if (u.includes("models=meteofrance_arome")) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hourly: d.hourly }) }); return; }
  if (u.includes("hourly=")) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hourly: d.hourly }) }); return; }
  delete d.hourly;
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
});
// Les deux sources data.gouv sont coupées : on éprouve le repli.
await ctx.route(/object\.files\.data\.gouv\.fr|www\.data\.gouv\.fr/, r => r.abort());

const pg = await ctx.newPage();
const erreurs = [];
pg.on("pageerror", e => erreurs.push(String(e)));
pg.on("console", m => {
  // Les deux sources data.gouv sont volontairement coupées dans cet essai.
  if (m.type() === "error" && !/ERR_FAILED|ERR_ABORTED/.test(m.text())) erreurs.push("console: " + m.text());
});

await pg.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pg.waitForTimeout(900);

let n = 0, ko = 0;
const ok = (nom, cond, detail) => {
  n++; if (!cond) { ko++; console.log(`  ÉCHEC  ${nom}${detail ? " | " + detail : ""}`); }
  else console.log(`  ok     ${nom}`);
};
const txt = async s => (await pg.locator(s).count()) ? (await pg.locator(s).first().innerText()) : "";

console.log("\n--- Écran d'accueil ---");
ok("le lieu est affiché", (await txt("#lieuNom")).includes("Fain"), await txt("#lieuNom"));
ok("le bandeau porte un grand chiffre", /\d+°/.test(await txt(".bd-deg")), await txt(".bd-deg"));
ok("le bandeau porte quatre mesures", await pg.locator(".bd-m").count() === 4);
const mes = (await pg.locator(".bd-m i").allInnerTexts()).join(", ");
ok("les quatre mesures sont nommées", mes.toLowerCase() === "ressenti, vent, humidité, indice uv", mes);
const cj = await pg.locator(".cj-l").allInnerTexts();
ok("trois lignes de conseil au plus", cj.length >= 1 && cj.length <= 3, cj.length + "");
ok("la première ligne parle de pluie", /pluie|lame/i.test(cj[0] || ""), cj[0]);
ok("aucune ligne ne se répète", new Set(cj).size === cj.length);
ok("aucun verbe de jardin", !/arros|voiler|tuteur|repiquage|ombrer|plant/i.test(cj.join(" ")), cj.join(" | "));
ok("les tuiles sont posées", await pg.locator(".tu").count() >= 3);
const alertesTxt = (await pg.locator(".al").allInnerTexts()).join(" ").toLowerCase();
const conseilsTxt = cj.join(" ").toLowerCase();
const motsCommuns = ["rafales", "gel probable", "indice uv", "mm attendus"]
  .filter(m => alertesTxt.includes(m) && conseilsTxt.includes(m));
ok("les alertes ne répètent pas les conseils", motsCommuns.length === 0, motsCommuns.join(", "));
ok("le ressenti n'est écrit qu'une fois dans le bandeau",
  ((await txt("#bandeau")).toLowerCase().match(/ressenti/g) || []).length === 1);
ok("la tuile de vigilance renvoie vers Météo-France",
  (await txt("#tuiles")).includes("Météo-France"));

console.log("\n--- Feuille du temps, ruban ---");
await pg.locator('[data-vue="temps"]').first().click();
await pg.waitForTimeout(600);
ok("la feuille s'ouvre sur Le temps", (await txt("#feuille-titre")).startsWith("Le temps"));
const voies = await pg.locator(".mg-v .mg-n").allInnerTexts();
ok("sept voies", voies.length === 7, voies.join(", "));
const nomsVoies = voies.map(v => v.replace(/[+−\n]/g, "").trim().toLowerCase()).join(",");
ok("les voies sont les bonnes",
  nomsVoies === "température,pluie,vent,ciel,indice uv,humidité,pression", nomsVoies);
ok("chaque voie porte une lecture à droite", (await pg.locator(".mg-r").count()) === 7);
const uv = (await pg.locator(".mg-v").nth(4).innerText());
ok("l'indice UV porte son maximum", /max\s*7/.test(uv), uv.split("\n")[0]);
ok("l'axe des heures est posé", await pg.locator(".mg-axe span").count() >= 3);
ok("aucun montant de lecture visible au repos", await pg.locator(".mg-cur:visible").count() === 0);
const chVent = (await pg.locator(".mg-v").nth(2).locator("text.mg-g").allTextContents())
  .map(x => String(x ?? "").replace(/\s|km\/h/g, "")).filter(Boolean);
ok("le seuil du vent ne se superpose pas à la graduation",
  new Set(chVent).size === chVent.length, chVent.join(" | "));

console.log("\n--- Agrandissement d'une voie ---");
const hAvant = await pg.locator(".mg-v").first().locator("svg").boundingBox();
await pg.locator('.mg-b[data-voie="t"]').click();
await pg.waitForTimeout(320);
const hApres = await pg.locator(".mg-v").first().locator("svg").boundingBox();
ok("la voie touchée s'agrandit", hApres.height > hAvant.height * 2, `${hAvant.height.toFixed(0)} puis ${hApres.height.toFixed(0)}`);
ok("les autres voies gardent leur taille",
  Math.abs((await pg.locator(".mg-v").nth(2).locator("svg").boundingBox()).height
    - (await pg.locator(".mg-v").nth(5).locator("svg").boundingBox()).height * (86/48)) < 14);
ok("la légende paraît avec l'agrandissement", await pg.locator(".mg-l:visible").count() === 1);

console.log("\n--- Les trois écritures ---");
await pg.locator('[data-ecriture="liste"]').click();
await pg.waitForTimeout(420);
ok("la liste porte treize colonnes", await pg.locator(".hh thead th").count() === 13,
  String(await pg.locator(".hh thead th").count()));
ok("la liste porte vingt-quatre lignes", await pg.locator(".hh tbody tr").count() === 24,
  String(await pg.locator(".hh tbody tr").count()));
const h1 = await pg.locator(".hh tbody tr").first().locator("td").first().innerText();
ok("la première ligne est l'heure en cours", h1.trim() === "09 h", h1);
await pg.locator('[data-ecriture="moments"]').click();
await pg.waitForTimeout(420);
const mo = await pg.locator(".mo-t span").allInnerTexts();
ok("les moments sont nommés", mo.length >= 3, mo.join(" | "));
ok("aucun moment ne dit « demain » pour ce soir", !/^Demain, la soirée/.test(mo[1] || ""), mo.join(" | "));

console.log("\n--- La semaine ---");
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
await pg.locator('[data-vue="semaine"]').first().click(); await pg.waitForTimeout(500);
ok("sept lignes", await pg.locator(".sem tbody tr").count() === 7, String(await pg.locator(".sem tbody tr").count()));
const j1 = await pg.locator(".sem .j").first().innerText();
ok("la première ligne est aujourd'hui", j1.startsWith("Aujourd'hui"), j1.replace("\n"," "));

console.log("\n--- La lumière ---");
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
await pg.locator('[data-vue="lumiere"]').first().click(); await pg.waitForTimeout(500);
ok("l'arc du jour est dessiné", await pg.locator(".aj").count() === 1);
ok("la durée du jour est écrite", /\d+ h \d\d/.test(await txt(".feuille-corps")));

console.log("\n--- Vigilance, renvoi vers Météo-France ---");
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
await pg.locator('#tuiles [data-vue="vigilance"]').click(); await pg.waitForTimeout(500);
const lien = pg.locator("#feuille-corps a.lien-plein");
ok("un lien plein est proposé", await lien.count() === 1);
const href = await lien.getAttribute("href");
ok("il pointe vers Météo-France", /^https:\/\/vigilance\.meteofrance\.fr\//.test(href || ""), href);
ok("il s'ouvre hors de l'application", await lien.getAttribute("target") === "_blank"
  && /noopener/.test(await lien.getAttribute("rel") || ""));
ok("le renvoi est motivé", /archive|retard|5 août/i.test(await txt("#feuille-corps")));
ok("aucun bulletin archivé n'est affiché", await pg.locator(".vg-l").count() === 0);

console.log("\n--- Sources coupées ---");
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
ok("aucune ligne de vigilance sur l'accueil", await pg.locator(".al.v-2, .al.v-3, .al.v-4").count() === 0);
ok("l'application reste utilisable", await pg.locator(".bd-deg").count() === 1);
ok("l'accueil ne porte plus la tuile de mesure",
  !(await txt("#tuiles")).toLowerCase().includes("mesure"));
ok("quatre tuiles", await pg.locator(".tu").count() === 4, String(await pg.locator(".tu").count()));

console.log("\n--- Erreurs de page ---");
ok("aucune erreur de page", erreurs.length === 0, erreurs.slice(0,3).join(" ~ "));

await pg.screenshot({ path: "/tmp/essais/accueil.png" });
await pg.locator('[data-vue="temps"]').first().click(); await pg.waitForTimeout(700);
await pg.screenshot({ path: "/tmp/essais/temps.png" });

console.log(`\n${n - ko} contrôles sur ${n}${ko ? `, ${ko} en échec` : ", tous vérifiés"}.`);
await nav.close(); serveur.close();
process.exit(ko ? 1 : 0);
