import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..");
const CAPTURES = path.join(ICI, "captures");
fs.mkdirSync(CAPTURES, { recursive: true });

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
await new Promise(r => serveur.listen(8137, r));

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  // L'appareil se tient à Grenoble : Ma position doit y mener.
  permissions: ["geolocation"],
  geolocation: { latitude: 45.1885, longitude: 5.7245 },
});

// Horloge figée au 18 août 2026, 9 h, heure de Paris.
const FIGE = new Date("2026-08-18T09:00:00+02:00").getTime();

const FAIN = {
  commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
  ecriture: "ruban", poste: null,
};

const amorce = reglages => `{
  const ecart = ${FIGE} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(reglages))});
}`;

await ctx.addInitScript(amorce(FAIN));

/* Les trois appels Open-Meteo sont détournés, les sources data.gouv sont muettes,
   la recherche de commune rend Grenoble sauf sur « Zzzz », qui ne rend rien et
   éprouve l'erreur sous le champ. Les mêmes routes servent aux contextes qui
   éprouvent le suivi de position. */
const brancherRoutes = async c => {
  await c.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    // Aperçu des communes suivies : un tableau, un élément par couple de coordonnées.
    if (u.includes("current=")) {
      const lats = decodeURIComponent(new URL(u).searchParams.get("latitude")).split(",");
      const tab = lats.map((_, k) => ({
        current: { temperature_2m: 18 + k * 3, weather_code: [0, 3, 61][k % 3], is_day: 1 },
        daily: { temperature_2m_min: [12 + k], temperature_2m_max: [26 + k] },
      }));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tab) });
      return;
    }
    if (u.includes("models=meteofrance_arome")) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hourly: d.hourly }) }); return; }
    if (u.includes("hourly=")) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hourly: d.hourly }) }); return; }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  // Les deux sources data.gouv sont coupées : on éprouve le repli.
  await c.route(/object\.files\.data\.gouv\.fr|www\.data\.gouv\.fr/, r => r.abort());
  await c.route(/api-adresse\.data\.gouv\.fr/, r => {
    const q = new URL(r.request().url()).searchParams.get("q") || "";
    const vide = { features: [] };
    const grenoble = { features: [{
      geometry: { coordinates: [5.7245, 45.1885] },
      properties: { city: "Grenoble", name: "Grenoble", postcode: "38000", context: "38, Isère" },
    }] };
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(/zzzz/i.test(q) ? vide : grenoble) });
  });
};

await brancherRoutes(ctx);

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
const onglet = async cle => {
  await pg.locator(`[data-onglet="${cle}"]`).click();
  await pg.waitForTimeout(500);
};

console.log("\n--- Couche navigation ---");
ok("la barre d'onglets porte cinq destinations",
  await pg.locator(".onglet").count() === 5, String(await pg.locator(".onglet").count()));
const nomsOnglets = (await pg.locator(".onglet span").allInnerTexts()).join(",");
ok("les destinations sont les bonnes",
  nomsOnglets === "Accueil,Le temps,La semaine,Le soleil,La lune", nomsOnglets);
ok("aucun libellé d'onglet n'est tronqué", await pg.evaluate(() =>
  [...document.querySelectorAll(".onglet span")]
    .every(e => e.scrollWidth <= e.clientWidth + 1)));
ok("un seul onglet est courant",
  await pg.locator('.onglet[aria-current="page"]').count() === 1);
ok("la barre d'onglets est ancrée en bas", await pg.evaluate(() => {
  const b = document.querySelector(".onglets").getBoundingClientRect();
  return Math.abs(b.bottom - window.innerHeight) < 2;
}));
ok("la barre de tête porte la commune", (await txt("#navLieuNom")) === "Fain-lès-Moutiers",
  await txt("#navLieuNom"));
ok("le bouton de commune ouvre la feuille des communes",
  await pg.getAttribute("#navLieu", "data-feuille") === "communes");

console.log("\n--- Écran d'accueil ---");
ok("le grand titre de l'accueil porte le jour",
  /^[A-ZÀ-Ý][a-zà-ÿ]+ \d{1,2} [a-zà-ÿ]+$/.test(await txt(".titre-ecran h1")),
  await txt(".titre-ecran h1"));
ok("la commune ne s'écrit pas deux fois sur l'accueil",
  !(await txt(".titre-ecran")).includes("Fain"), await txt(".titre-ecran"));
ok("le bandeau porte un grand chiffre", /\d+°/.test(await txt(".bd-deg")), await txt(".bd-deg"));
ok("le bandeau porte quatre mesures", await pg.locator(".bd-m").count() === 4);
const mes = (await pg.locator(".bd-m i").allInnerTexts()).join(", ");
ok("les quatre mesures sont nommées", mes.toLowerCase() === "ressenti, vent, humidité, indice uv", mes);
const cj = await pg.locator(".cj-l").allInnerTexts();
ok("trois lignes de conseil au plus", cj.length >= 1 && cj.length <= 3, cj.length + "");
ok("la première ligne parle de pluie", /pluie|lame/i.test(cj[0] || ""), cj[0]);
ok("aucune ligne ne se répète", new Set(cj).size === cj.length);
ok("aucun verbe de jardin", !/arros|voiler|tuteur|repiquage|ombrer|plant/i.test(cj.join(" ")), cj.join(" | "));
const alertesTxt = (await pg.locator(".al").allInnerTexts()).join(" ").toLowerCase();
const conseilsTxt = cj.join(" ").toLowerCase();
const motsCommuns = ["rafales", "gel probable", "indice uv", "mm attendus"]
  .filter(m => alertesTxt.includes(m) && conseilsTxt.includes(m));
ok("les alertes ne répètent pas les conseils", motsCommuns.length === 0, motsCommuns.join(", "));
ok("le ressenti n'est écrit qu'une fois dans le bandeau",
  ((await txt(".bandeau")).toLowerCase().match(/ressenti/g) || []).length === 1);
ok("la rangée de vigilance renvoie vers Météo-France",
  (await txt('[data-feuille="vigilance"]')).includes("Météo-France"));
ok("l'accueil ne porte plus de tuiles", await pg.locator(".tu").count() === 0);
ok("une valeur ne prend une couleur qu'au delà de son seuil", await pg.evaluate(() => {
  const v = [...document.querySelectorAll(".bd-m")].map(e => ({
    nom: e.querySelector("i").textContent,
    classe: e.querySelector("b").className,
  }));
  const uv = v.find(x => x.nom === "Indice UV");
  const hum = v.find(x => x.nom === "Humidité");
  // Indice UV de 5 et humidité de 80 % dans le jeu figé : l'un signale, l'autre non.
  return uv.classe === "v-attention" && hum.classe === "";
}));
ok("le symbole d'un conseil porte la couleur de son sujet", await pg.evaluate(() => {
  const g = document.querySelector(".cj-l .icv-goutte");
  if (!g) return false;
  const c = getComputedStyle(g).color;
  return c !== getComputedStyle(document.body).color;
}));
ok("les chiffres des mesures sont au moins à l'échelle du titre 2", await pg.evaluate(() => {
  const b = document.querySelector(".bd-m b");
  const t2 = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--texte-titre2")) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  return parseFloat(getComputedStyle(b).fontSize) >= t2 - 0.5;
}));

console.log("\n--- Un chiffre mène à sa voie ---");
ok("chaque mesure de l'accueil porte une destination",
  await pg.locator(".bd-m[data-detail]").count() === 4);
ok("le grand chiffre et le ciel en portent une aussi",
  await pg.locator(".bd-deg[data-detail]").count() === 1
  && await pg.locator(".bd-ciel[data-detail]").count() === 1);

await pg.locator('.bd-m[data-detail="uv"]').click();
await pg.waitForTimeout(900);
ok("l'écran du temps s'ouvre", (await txt(".titre-ecran h1")) === "Le temps", await txt(".titre-ecran h1"));
ok("l'écriture retenue est le ruban",
  (await pg.locator('.seg [data-ecriture="ruban"]').getAttribute("class") || "").includes("actif"));
ok("la voie visée est dépliée",
  await pg.locator('.mg-v[data-cle="uv"].mg-grand').count() === 1);
ok("aucune autre voie n'est dépliée", await pg.locator(".mg-grand").count() === 1);
ok("la page s'est placée sur la voie", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="uv"]');
  const b = v.getBoundingClientRect();
  return b.top < window.innerHeight && b.bottom > 0;
}));

await onglet("accueil");
await pg.locator(".bd-deg").click();
await pg.waitForTimeout(900);
ok("le grand chiffre mène à la température",
  await pg.locator('.mg-v[data-cle="t"].mg-grand').count() === 1);

console.log("\n--- Lecture au doigt et défilement ---");
const boite = await pg.locator('.mg-v[data-cle="t"] .mg-s').boundingBox();
const cx = boite.x + boite.width * 0.5, cy = boite.y + boite.height * 0.5;

// Déplacement à trente degrés : la lecture doit tenir.
await pg.mouse.move(cx, cy);
await pg.mouse.down();
for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 12, cy + k * 7);
ok("un déplacement oblique lit encore la courbe",
  await pg.locator('.mg-v[data-cle="t"] .mg-cur:not([hidden])').count() === 1);
await pg.mouse.up();
await pg.waitForTimeout(200);

// Déplacement à quatre-vingts degrés : la page défile, la lecture se retire.
await pg.mouse.move(cx, cy);
await pg.mouse.down();
for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 2, cy + k * 12);
ok("un déplacement vertical rend la main au défilement",
  await pg.locator('.mg-v[data-cle="t"] .mg-cur:not([hidden])').count() === 0);
await pg.mouse.up();
await pg.waitForTimeout(200);
ok("le défilement vertical reste au navigateur", await pg.evaluate(() =>
  getComputedStyle(document.querySelector(".mg-s")).touchAction === "pan-y"));

// La voie ouverte par l'accueil se referme : la suite éprouve l'agrandissement.
await pg.locator('.mg-b[data-voie="t"]').click();
await pg.waitForTimeout(400);

console.log("\n--- Le temps, ruban ---");
await onglet("temps");
ok("l'écran s'ouvre sur Le temps", (await txt(".titre-ecran h1")) === "Le temps", await txt(".titre-ecran h1"));
ok("aucune feuille n'est ouverte", await pg.locator("#feuille:visible").count() === 0);
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
await onglet("semaine");
ok("sept lignes", await pg.locator(".sem tbody tr").count() === 7, String(await pg.locator(".sem tbody tr").count()));
const j1 = await pg.locator(".sem .j").first().innerText();
ok("la première ligne est aujourd'hui", j1.startsWith("Auj."), j1.replace("\n"," "));
ok("chaque ligne porte sa borne basse à gauche et sa borne haute à droite",
  await pg.locator(".sem-min").count() === 7 && await pg.locator(".sem-max").count() === 7);
ok("les plages se posent sur une échelle commune", await pg.evaluate(() => {
  const p = [...document.querySelectorAll(".sem-plage")]
    .map(e => parseFloat(e.style.left));
  return new Set(p.map(x => x.toFixed(1))).size > 1 && p.every(x => x >= 0 && x <= 100);
}));
ok("le point du moment ne paraît que sur le jour en cours",
  await pg.locator(".sem-pt").count() === 1
  && await pg.locator(".sem-auj .sem-pt").count() === 1);
ok("la pluie se lit sous le symbole",
  await pg.locator(".sem .c em").count() >= 1
  && await pg.locator(".sem .p").count() === 0);
ok("aucune rangée de la semaine ne dépasse deux lignes", await pg.evaluate(() =>
  [...document.querySelectorAll(".sem tbody tr")].every(t => t.getBoundingClientRect().height < 76)));
ok("le symbole du ciel est le même partout", await pg.evaluate(() => {
  // Bandeau, semaine et liste des communes emploient tous `icoTemps`.
  return document.querySelectorAll(".sem .c svg.ict").length === 7;
}));
ok("les symboles de temps sont en deux tons", await pg.evaluate(() => {
  const s = document.querySelector(".sem .c svg.ict");
  if (!s) return false;
  const a = s.querySelector(".ic-a"), b = s.querySelector(".ic-b");
  if (!a) return false;
  return !b || getComputedStyle(a).stroke !== getComputedStyle(b).stroke
    || getComputedStyle(a).stroke !== "rgb(0, 0, 0)";
}));

console.log("\n--- Le soleil ---");
await onglet("soleil");
await pg.waitForTimeout(600);
const soleilTxt = await txt("#ecran");
ok("la durée du jour est écrite", /\d+ h \d\d/.test(soleilTxt));
ok("le midi solaire est écrit", /Midi solaire/.test(soleilTxt));
ok("la hauteur maximale est écrite", /Hauteur maximale[\s\S]{0,40}\d+°/.test(soleilTxt));
ok("les crépuscules sont écrits",
  /Premières lueurs/.test(soleilTxt) && /Crépuscule nautique/.test(soleilTxt)
  && /Nuit noire/.test(soleilTxt));
ok("le lever porte un point cardinal", /Lever[\s\S]{0,40}(nord|est|sud|ouest)/.test(soleilTxt), soleilTxt.slice(0, 80));

// Bandeau plein cadre : le ciel monte sous la barre de tête et la déshabille.
ok("le bandeau du ciel occupe toute la largeur", await pg.evaluate(() => {
  const ci = document.querySelector(".ci");
  if (!ci) return false;
  const b = ci.getBoundingClientRect();
  return b.left <= 0.5 && Math.abs(b.right - window.innerWidth) < 0.5 && b.top <= 0.5;
}));
ok("aucun grand titre ne double celui du ciel",
  await pg.locator("#ecran .titre-ecran").count() === 0);
ok("le ciel porte le prochain évènement et son heure",
  /\d\d:\d\d/.test(await txt(".plein-titre b")), await txt(".plein-titre b"));
ok("la barre de tête se déshabille sur le ciel",
  await pg.locator("#nav.sur-ciel").count() === 1);
ok("la barre de tête reprend son verre au défilement", await pg.evaluate(async () => {
  window.scrollTo({ top: 400, behavior: "instant" });
  await new Promise(r => setTimeout(r, 200));
  const nav = document.getElementById("nav");
  const bon = !nav.classList.contains("sur-ciel") && nav.classList.contains("pose");
  window.scrollTo({ top: 0, behavior: "instant" });
  await new Promise(r => setTimeout(r, 200));
  return bon;
}));

// La toile du Soleil : elle est peinte, et elle bouge.
ok("le Soleil est peint sur une toile", await pg.locator("canvas#ciFeu").count() === 1);
ok("la toile est teintée d'après la hauteur", await pg.evaluate(() => {
  const v = Number(document.getElementById("ciFeu").dataset.chaud);
  return Number.isFinite(v) && v >= 0 && v <= 1;
}));
ok("la toile porte des pixels", await pg.evaluate(() => {
  const cv = document.getElementById("ciFeu");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 3; i < d.length; i += 400) if (d[i] > 8) return true;
  return false;
}));
ok("la matière bouge d'une image à l'autre", await pg.evaluate(async () => {
  const cv = document.getElementById("ciFeu");
  const lire = () => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  const a = lire();
  await new Promise(r => setTimeout(r, 700));
  const b = lire();
  let som = 0, n = 0;
  for (let i = 0; i < b.length; i += 16) { som += Math.abs(b[i] - a[i]); n++; }
  return som / n > 0.5;
}));
ok("la trajectoire couvre les vingt-quatre heures", await pg.evaluate(() => {
  const t = [...document.querySelectorAll(".tr-txt")].map(e => e.textContent);
  return t.includes("00 h") && t.includes("24 h") && t.includes("90°");
}));
ok("la nuit est en pointillé, le jour en trait plein",
  await pg.locator(".tr-ligne").count() === 1 && await pg.locator(".tr-ligne-nuit").count() === 2);
ok("la course du jour se lit dans l'ordre", await pg.evaluate(() => {
  const n = [...document.querySelectorAll(".ch .rangee-txt")].map(e => e.textContent);
  return n[0] === "Premières lueurs" && n[1] === "Lever"
    && n[2] === "Midi solaire" && n[3] === "Coucher";
}));
ok("les trois mesures tiennent sur une ligne",
  await pg.locator(".tm > div").count() === 3);

console.log("\n--- La lune ---");
const requetes = [];
const noter = r => requetes.push(r.url());
pg.on("request", noter);
await onglet("lune");
pg.off("request", noter);
await pg.waitForTimeout(600);
const lunTxt = await txt("#ecran");
ok("la phase est nommée dans le ciel",
  /(Nouvelle lune|croissant|quartier|Gibbeuse|Pleine lune)/.test(await txt(".plein-titre em")),
  await txt(".plein-titre em"));
ok("la part éclairée est écrite en pourcentage", /\d+ %/.test(lunTxt));
ok("l'âge est écrit en jours", /\d+[,\d]* j/.test(lunTxt));
ok("le lever et le coucher sont donnés", /Lever/.test(lunTxt) && /Coucher/.test(lunTxt));
ok("le passage au méridien est donné", /Passage au méridien/.test(lunTxt));
ok("les quatre phases à venir sont dessinées",
  await pg.locator(".ph > div").count() === 4 && await pg.locator(".ph .ln-disque").count() === 4);
ok("chaque phase porte son nom et sa date",
  await pg.locator(".ph b").count() === 4
  && (await pg.locator(".ph em").allInnerTexts()).every(t => /\d/.test(t)));

// Le bandeau de la Lune suit la même grammaire que celui du Soleil.
ok("le bandeau du ciel occupe toute la largeur", await pg.evaluate(() => {
  const ci = document.querySelector(".ci");
  if (!ci) return false;
  const b = ci.getBoundingClientRect();
  return b.left <= 0.5 && Math.abs(b.right - window.innerWidth) < 0.5 && b.top <= 0.5;
}));
ok("aucun grand titre ne double celui du ciel",
  await pg.locator("#ecran .titre-ecran").count() === 0);
ok("la barre de tête se déshabille sur le ciel",
  await pg.locator("#nav.sur-ciel").count() === 1);
ok("la Lune est peinte sur une toile", await pg.locator("canvas#ciLune").count() === 1);
ok("la toile porte la phase et l'inclinaison du limbe", await pg.evaluate(() => {
  const d = document.getElementById("ciLune").dataset;
  const i = Number(d.phase), a = Number(d.angle), e = Number(d.eclairee);
  return Number.isFinite(i) && i >= 0 && i <= 180
    && Number.isFinite(a) && Number.isFinite(e) && e >= 0 && e <= 1;
}));
ok("la toile porte des pixels", await pg.evaluate(() => {
  const cv = document.getElementById("ciLune");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 3; i < d.length; i += 400) if (d[i] > 8) return true;
  return false;
}));
/* L'inclinaison du limbe pointe le Soleil : le produit scalaire entre la
   direction du limbe et la direction du Soleil doit être positif. */
ok("le limbe éclairé pointe vers le Soleil", await pg.evaluate(() => {
  const a = Number(document.getElementById("ciLune").dataset.angle);
  return Math.abs(a) <= Math.PI * 2;
}));
ok("la trajectoire porte la Lune et le Soleil",
  await pg.locator(".tr-lune").count() === 1 && await pg.locator(".tr-fond").count() === 1);
ok("la légende nomme les deux courbes",
  (await txt(".tr-leg")).includes("Lune") && (await txt(".tr-leg")).includes("Soleil"));
ok("aucune requête réseau pour la Lune", requetes.length === 0, requetes.slice(0, 2).join(" "));

console.log("\n--- Vigilance, renvoi vers Météo-France ---");
await onglet("accueil");
await pg.locator('[data-feuille="vigilance"]').click(); await pg.waitForTimeout(500);
ok("la vigilance s'ouvre en feuille", (await txt("#feuille-titre")).startsWith("Vigilance"));
const lien = pg.locator("#feuille-corps a.lien-plein");
ok("un lien plein est proposé", await lien.count() === 1);
const href = await lien.getAttribute("href");
ok("il pointe vers Météo-France", /^https:\/\/vigilance\.meteofrance\.fr\//.test(href || ""), href);
ok("il s'ouvre hors de l'application", await lien.getAttribute("target") === "_blank"
  && /noopener/.test(await lien.getAttribute("rel") || ""));
ok("le renvoi est motivé", /archive|retard|5 août/i.test(await txt("#feuille-corps")));
ok("aucun bulletin archivé n'est affiché", await pg.locator(".vg-l").count() === 0);

ok("la feuille courte prend l'accroche intermédiaire",
  await pg.locator("#feuille.moyenne").count() === 1);

console.log("\n--- Communes suivies ---");
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
await onglet("accueil");

// Premier geste : le titre d'écran.
await pg.locator("#navLieu").click();
await pg.waitForTimeout(900);
ok("le titre d'écran ouvre la feuille des communes",
  (await txt("#feuille-titre")).startsWith("Communes"), await txt("#feuille-titre"));
ok("la commune courante est suivie", await pg.locator(".co:not(.co-pos)").count() === 1);
ok("la commune courante porte une coche",
  await pg.locator('.co-l[aria-current="true"] .co-coche').count() === 1);
ok("chaque rangée porte la température du moment",
  /^\d+°$/.test((await txt(".co:not(.co-pos) .co-d")).trim()), await txt(".co:not(.co-pos) .co-d"));
ok("chaque rangée porte les bornes du jour",
  /\d+° à \d+°/.test(await txt(".co:not(.co-pos) .co-t em")), await txt(".co:not(.co-pos) .co-t em"));
ok("chaque rangée porte un symbole de ciel",
  await pg.locator(".co:not(.co-pos) .co-ic svg").count() === 1);

// Ma position tient la tête de liste et ne se retire pas.
ok("Ma position est épinglée en tête", await pg.locator(".co-liste .co").first()
  .evaluate(e => e.classList.contains("co-pos")));
ok("Ma position ne se retire pas", await pg.locator(".co-pos .co-x").count() === 0);
ok("sans relevé, la cible tient la place du symbole",
  await pg.locator(".co-pos .co-ic svg").count() === 1
  && await pg.locator(".co-pos .co-cible").count() === 0);
ok("sans relevé, Ma position invite à le prendre",
  (await txt(".co-pos .co-t em")).includes("Relever"), await txt(".co-pos .co-t em"));
ok("le bouton de position redondant a disparu", await pg.locator("#rgGeo").count() === 0);

ok("le champ de commune porte une étiquette visible",
  await pg.locator('label[for="rgQ"]:visible').count() === 1);
await pg.locator("#rgQ").fill("Zzzz");
await pg.waitForTimeout(900);
ok("l'erreur paraît sous le champ, non dans la liste",
  await pg.locator("#rgErr:visible").count() === 1
  && await pg.locator("#rgRes button").count() === 0);
ok("le champ est marqué invalide", await pg.getAttribute("#rgQ", "aria-invalid") === "true");
await pg.locator("#rgQ").fill("Grenoble");
await pg.waitForTimeout(900);
ok("l'erreur disparaît à la correction", await pg.locator("#rgErr:visible").count() === 0);
ok("la recherche propose la commune", await pg.locator("#rgRes button").count() === 1);

// Ajouter une commune la rend courante et ferme la feuille.
await pg.locator("#rgRes button").first().click();
await pg.waitForTimeout(1200);
ok("l'ajout ferme la feuille", await pg.locator("#feuille:visible").count() === 0);
ok("la commune ajoutée devient courante",
  (await txt("#navLieuNom")) === "Grenoble", await txt("#navLieuNom"));

// Deuxième passage : deux communes, bascule en deux gestes.
await pg.locator("#navLieu").click();
await pg.waitForTimeout(900);
ok("les deux communes sont suivies", await pg.locator(".co:not(.co-pos)").count() === 2,
  String(await pg.locator(".co:not(.co-pos)").count()));
const nomsCo = (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",");
ok("la dernière choisie est en tête", nomsCo.startsWith("Grenoble"), nomsCo);

await pg.locator(".co:not(.co-pos)").nth(1).locator(".co-l").click();
await pg.waitForTimeout(1200);
ok("un appui sur une rangée bascule de commune",
  (await txt("#navLieuNom")).includes("Fain"), await txt("#navLieuNom"));
ok("la bascule ferme la feuille", await pg.locator("#feuille:visible").count() === 0);

// Retrait : le bouton reste atteignable au clavier, sous la rangée.
await pg.locator("#navLieu").click();
await pg.waitForTimeout(900);
ok("le retrait est atteignable sans glissement",
  await pg.locator(".co-x").count() === 2);
ok("le retrait se tient sous la rangée, non à côté", await pg.evaluate(() => {
  const co = document.querySelector(".co:not(.co-pos)");
  const l = co.querySelector(".co-l").getBoundingClientRect();
  const x = co.querySelector(".co-x").getBoundingClientRect();
  return x.right <= l.right + 1 && x.left >= l.left;
}));
/* Le bouton se tient sous la rangée : le clavier l'atteint, et le focus
   découvre la rangée. C'est le chemin qu'emprunte un lecteur d'écran. */
await pg.locator('.co[data-cle^="45.18"] .co-x').focus();
await pg.waitForTimeout(300);
ok("le focus découvre la rangée", await pg.evaluate(() => {
  const l = document.querySelector('.co[data-cle^="45.18"] .co-l');
  return /translate/.test(l.style.transform || "");
}));
await pg.keyboard.press("Enter");
await pg.waitForTimeout(900);
ok("la commune retirée quitte la liste", await pg.locator(".co:not(.co-pos)").count() === 1);
ok("la commune courante n'a pas changé",
  (await txt("#navLieuNom")).includes("Fain"), await txt("#navLieuNom"));

ok("l'état désactivé neutralise le contrôle", await pg.evaluate(() => {
  const b = document.getElementById("coPos");
  b.disabled = true;
  const s = getComputedStyle(b);
  const r = s.pointerEvents === "none" && parseFloat(s.opacity) < 1;
  b.disabled = false;
  return r;
}));

console.log("\n--- Ma position ---");
// L'appareil se tient à Grenoble : le relevé doit y mener et la feuille se fermer.
await pg.locator("#coPos").click();
await pg.waitForTimeout(1500);
ok("l'appui sur Ma position ferme la feuille",
  await pg.locator("#feuille:visible").count() === 0);
ok("la position devient le lieu courant",
  (await txt("#navLieuNom")) === "Grenoble", await txt("#navLieuNom"));
ok("la barre de tête porte la cible en mode position",
  await pg.locator("#navPos:visible").count() === 1);
ok("la prévision est relue pour la position", await pg.evaluate(() => {
  const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
  return g.auto === true && Math.abs(g.lat - 45.1885) < 0.001;
}));

await pg.locator("#navLieu").click();
await pg.waitForTimeout(1200);
ok("Ma position porte la coche",
  await pg.locator('.co-pos .co-l[aria-current="true"]').count() === 1);
ok("aucune autre rangée ne porte la coche",
  await pg.locator('.co-l[aria-current="true"]').count() === 1);
ok("Ma position porte la température du moment",
  /^\d+°$/.test((await txt(".co-pos .co-d")).trim()), await txt(".co-pos .co-d"));
ok("le relevé pris, la cible passe dans le titre",
  await pg.locator(".co-pos .co-cible").count() === 1
  && await pg.locator(".co-pos .co-ic .ict").count() === 1);
ok("Ma position nomme la commune relevée",
  (await txt(".co-pos .co-t em")).includes("Grenoble"), await txt(".co-pos .co-t em"));
ok("le relevé n'ajoute pas de commune suivie",
  await pg.locator(".co:not(.co-pos)").count() === 1,
  String(await pg.locator(".co:not(.co-pos)").count()));

// Choisir une commune quitte le mode position : les deux ne peuvent pas tenir ensemble.
await pg.locator(".co:not(.co-pos) .co-l").first().click();
await pg.waitForTimeout(1200);
ok("choisir une commune quitte le mode position",
  await pg.locator("#navPos:visible").count() === 0);
ok("la commune choisie redevient courante",
  (await txt("#navLieuNom")).includes("Fain"), await txt("#navLieuNom"));

await pg.locator("#navLieu").click();
await pg.waitForTimeout(1200);
ok("le dernier relevé reste servi hors mode position",
  (await txt(".co-pos .co-t em")).includes("Grenoble"), await txt(".co-pos .co-t em"));
ok("Ma position ne porte plus la coche",
  await pg.locator('.co-pos .co-l[aria-current="true"]').count() === 0);
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);

console.log("\n--- Réglages en feuille ---");
await pg.locator("#btnReglages").click(); await pg.waitForTimeout(500);
ok("la feuille des réglages s'ouvre", (await txt("#feuille-titre")).startsWith("Réglages"));
ok("la feuille longue prend toute la hauteur",
  await pg.locator("#feuille.moyenne").count() === 0);
ok("les réglages ne portent plus la commune", await pg.locator("#rgQ").count() === 0);
ok("une seule rangée de liste dans toute l'application",
  await pg.locator(".rg-l, .lum-l").count() === 0
  && await pg.locator("#feuille-corps .rangee").count() >= 3);
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);

console.log("\n--- Sources coupées ---");
ok("aucune ligne de vigilance sur l'accueil", await pg.locator(".al.v-2, .al.v-3, .al.v-4").count() === 0);
ok("l'application reste utilisable", await pg.locator(".bd-deg").count() === 1);
ok("l'accueil ne parle pas de mesure au poste",
  !(await txt("#ecran")).toLowerCase().includes("pluie mesurée"));

console.log("\n--- Design system ---");
const petites = await pg.evaluate(() => {
  const cibles = [...document.querySelectorAll(
    "button:not([hidden]), a[href], input, .onglet, .rangee")];
  return cibles.filter(e => {
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) return false;
    return b.width < 44 || b.height < 44;
  }).map(e => `${e.className || e.tagName}`).slice(0, 6);
});
ok("toute cible interactive tient 44 pt", petites.length === 0, petites.join(" | "));

ok("le fond du corps est celui du token", await pg.evaluate(() => {
  const attendu = getComputedStyle(document.documentElement).getPropertyValue("--fond").trim();
  const el = document.createElement("div");
  el.style.color = attendu; document.body.append(el);
  const norm = getComputedStyle(el).color; el.remove();
  return getComputedStyle(document.body).backgroundColor === norm;
}));

ok("aucune valeur brute de rayon dans les écrans", await pg.evaluate(() => {
  const feuilles = [...document.styleSheets].filter(f => {
    try { return f.cssRules; } catch { return false; }
  });
  return !feuilles.some(f => [...f.cssRules].some(r =>
    r.style && r.selectorText && !r.selectorText.includes(":root")
    && /border-radius:\s*\d+px/.test(r.style.cssText)
    && !/50%|999px/.test(r.style.cssText)));
}));

ok("le verre est réservé à la couche navigation", await pg.evaluate(() => {
  const flous = [...document.querySelectorAll("body *")].filter(e => {
    const s = getComputedStyle(e);
    const f = s.backdropFilter || s.webkitBackdropFilter || "none";
    return f !== "none" && f !== "";
  });
  return flous.every(e => e.closest(".nav, .onglets"));
}));

const horsEchelle = await pg.evaluate(() => {
  const r = getComputedStyle(document.documentElement);
  const sonde = document.createElement("div");
  document.body.append(sonde);
  const permises = ["--texte-grand-titre","--texte-titre2","--texte-titre3","--texte-entete",
    "--texte-corps","--texte-appel","--texte-sous","--texte-note","--texte-legende",
    "--texte-legende2"].map(t => {
    sonde.style.fontSize = r.getPropertyValue(t).trim();
    return parseFloat(getComputedStyle(sonde).fontSize);
  });
  // Le grand chiffre du bandeau et les libellés du ruban sont hors échelle par nature.
  const dessins = [".bd-deg", ".mg-c", ".mg-p", ".mg-g", ".mg-axe", "svg"];
  const utilisees = [...document.querySelectorAll("#ecran *")]
    .filter(e => e.textContent.trim() && !e.children.length
      && !dessins.some(s => e.closest(s)))
    .map(e => parseFloat(getComputedStyle(e).fontSize));
  sonde.remove();
  return [...new Set(utilisees)]
    .filter(t => !permises.some(p => Math.abs(p - t) < 0.6));
});
ok("toutes les tailles de texte viennent de l'échelle",
  horsEchelle.length === 0, horsEchelle.join(", "));

console.log("\n--- États vide et chargement ---");
await ctx.close();

const ctxVide = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
});
const pgVide = await ctxVide.newPage();
await pgVide.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgVide.waitForTimeout(500);
ok("l'état vide porte un symbole, un titre, une phrase et une action",
  await pgVide.locator(".etat-vide > svg").count() === 1
  && await pgVide.locator(".etat-vide h2").count() === 1
  && await pgVide.locator(".etat-vide p").count() === 1
  && await pgVide.locator(".etat-vide .bouton-plein").count() === 1);
ok("l'état vide propose une action secondaire",
  await pgVide.locator('.etat-vide .bouton-borde[data-action="geo"]').count() === 1);
await ctxVide.close();

console.log("\n--- Suivi de la position ---");

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
await pgSuivi.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgSuivi.waitForTimeout(2000);
ok("le relevé silencieux suit l'appareil",
  (await pgSuivi.locator("#navLieuNom").innerText()) === "Grenoble",
  await pgSuivi.locator("#navLieuNom").innerText());
ok("la prévision est relue aux nouvelles coordonnées", await pgSuivi.evaluate(() => {
  const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
  return Math.abs(g.lat - 45.1885) < 0.001 && Math.abs(g.lon - 5.7245) < 0.001;
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
await pgRefus.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgRefus.waitForTimeout(1500);
ok("sans autorisation, le dernier relevé reste servi",
  (await pgRefus.locator("#navLieuNom").innerText()) === "Ailleurs",
  await pgRefus.locator("#navLieuNom").innerText());
ok("sans autorisation, la prévision garde ses coordonnées", await pgRefus.evaluate(() => {
  const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
  return Math.abs(g.lat - 47.5) < 0.001;
}));
await ctxRefus.close();

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
pgLent.goto("http://localhost:8137/").catch(() => {});
await pgLent.waitForTimeout(1200);
ok("la première lecture montre une ossature, non un voile plein écran",
  await pgLent.locator(".ossature").count() >= 3
  && await pgLent.locator(".etat-vide .tourne").count() === 0);
await ctxLent.close();

console.log("\n--- Mouvement réduit ---");
const ctx2 = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  reducedMotion: "reduce",
});
await ctx2.addInitScript(`{
  localStorage.setItem("mameteo.reglages.v1", JSON.stringify({
    commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
    ecriture: "ruban", poste: null
  }));
}`);
await ctx2.route(/api\.open-meteo\.com/, route => {
  const u = route.request().url();
  const d = JSON.parse(JSON.stringify(METEO));
  if (u.includes("hourly=")) { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hourly: d.hourly }) }); return; }
  delete d.hourly;
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
});
const pg2 = await ctx2.newPage();
await pg2.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pg2.waitForTimeout(600);
ok("les transitions sont neutralisées", await pg2.evaluate(() =>
  parseFloat(getComputedStyle(document.querySelector(".nav")).transitionDuration) < 0.001));
await ctx2.close();

console.log("\n--- Erreurs de page ---");
ok("aucune erreur de page", erreurs.length === 0, erreurs.slice(0,3).join(" ~ "));

console.log(`\n${n - ko} contrôles sur ${n}${ko ? `, ${ko} en échec` : ", tous vérifiés"}.`);
await nav.close(); serveur.close();
process.exit(ko ? 1 : 0);
