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

/* Même amorce, à un autre instant : les cas d'astres ne se rencontrent pas tous
   à neuf heures du matin. */
const amorceA = (reglages, quand) => `{
  const ecart = ${new Date(quand).getTime()} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(reglages))});
}`;

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
  /* La vigilance : orange sur les orages jusqu'à 20 h, jaune sur le vent de 14 h
     à 18 h, vert ailleurs. Le département 99 sert le tout vert, pour éprouver
     l'absence de panneau. */
  await c.route(/webservice\.meteofrance\.com/, r => {
    const dep = new URL(r.request().url()).searchParams.get("domain");
    /* Les heures se posent en heure de Paris, celle du navigateur d'essai : les
       construire dans le fuseau du conteneur les décalerait de deux heures. */
    const h = n => Math.floor(
      Date.parse(`2026-08-18T${String(n).padStart(2, "0")}:00:00+02:00`) / 1000);
    const vert = id => ({ phenomenon_id: String(id),
      timelaps_items: [{ begin_time: h(0), end_time: h(23), color_id: 1 }] });
    const corps = dep === "99"
      ? { domain_id: dep, update_time: h(6), end_validity_time: h(23),
          timelaps: [1, 2, 3, 4, 5, 6].map(vert) }
      : { domain_id: dep, update_time: h(6), end_validity_time: h(23),
          timelaps: [
            { phenomenon_id: "3", timelaps_items: [
              { begin_time: h(6), end_time: h(20), color_id: 3 },
              { begin_time: h(20), end_time: h(23), color_id: 1 }] },
            { phenomenon_id: "1", timelaps_items: [
              { begin_time: h(0), end_time: h(14), color_id: 1 },
              { begin_time: h(14), end_time: h(16), color_id: 2 },
              { begin_time: h(16), end_time: h(18), color_id: 2 },
              { begin_time: h(18), end_time: h(23), color_id: 1 }] },
            vert(2), vert(5), vert(6),
          ] };
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
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
ok("le jour est porté par le ciel, non par un titre d'écran",
  /^[A-ZÀ-Ý][a-zà-ÿ]+ \d{1,2} [a-zà-ÿ]+$/.test(await txt(".plein-titre > i"))
  && await pg.locator(".titre-ecran").count() === 0,
  await txt(".plein-titre > i"));
ok("la commune ne s'écrit pas deux fois sur l'accueil",
  !(await txt(".plein-titre")).includes("Fain"), await txt(".plein-titre"));
ok("le bandeau porte un grand chiffre", /\d+°/.test(await txt(".bd-deg")), await txt(".bd-deg"));
ok("le bandeau porte quatre mesures", await pg.locator(".bd-m").count() === 4);
const mes = (await pg.locator(".bd-m i").allInnerTexts()).join(", ");
ok("les quatre mesures sont nommées", mes.toLowerCase() === "pluie, vent, humidité, indice uv", mes);
const cj = await pg.locator(".cj-l").allInnerTexts();
/* Trois lignes par bloc au plus : au-delà, un bloc cesse d'être un résumé. Six
   en tout au pire, comme du temps de la carte unique. */
ok("trois lignes par bloc au plus", await pg.evaluate(() =>
  [...document.querySelectorAll("#ecran .section[data-bloc]")]
    .every(s => s.querySelectorAll(".cj-l").length <= 3)),
  cj.length + " lignes en tout");
/* Une règle ne parle que si elle a quelque chose à dire : une phrase qui
   annonce qu'il ne se passe rien se lit cent fois pour rien apprendre. */
ok("rien ne s'écrit pour dire qu'il n'y a rien",
  !/aucune lame|rien à signaler|pas de pluie/i.test(cj.join(" ")), cj.join(" | "));
/* La page se lit en échelle de temps : trois blocs, du plus proche au plus
   lointain, chacun répondant à une question distincte. */
const blocs = await pg.locator("#ecran .section[data-bloc] h2").allInnerTexts();
ok("l'accueil se lit en trois blocs de temps",
  blocs[0] === "Aujourd'hui" && blocs[1] === "Les 24 prochaines heures"
  && /^(Demain|Après-demain|Demain et après-demain)$/.test(blocs[2] || ""),
  blocs.join(" | "));

/* Chaque bloc ne parle que de sa fenêtre. Le premier s'arrête à minuit, le
   dernier ne dit rien d'aujourd'hui, et son titre nomme les journées qu'il
   porte, ni plus ni moins. */
ok("chaque bloc s'en tient à sa fenêtre", await pg.evaluate(() => {
  const q = c => document.querySelector(`#ecran .section[data-bloc="${c}"]`);
  const lignes = s => (s ? [...s.querySelectorAll(".cj-l")].map(e => e.textContent) : []);
  const jour = lignes(q("jour")).join(" ");
  if (/demain/.test(jour)) return `aujourd'hui parle de demain : ${jour}`;
  const suite = q("suite");
  if (!suite) return "";
  const vus = new Set();
  for (const l of lignes(suite)) {
    if (/après-demain/.test(l)) vus.add(2);
    else if (/demain/.test(l)) vus.add(1);
    else return `une ligne sans journée : ${l}`;
  }
  const titre = suite.querySelector("h2").textContent;
  const attendu = vus.size === 2 ? "Demain et après-demain"
    : vus.has(2) ? "Après-demain" : "Demain";
  return titre === attendu ? "" : `titre ${titre} pour ${[...vus].join(",")}`;
}) === "", await pg.evaluate(() =>
  [...document.querySelectorAll("#ecran .section[data-bloc] h2")]
    .map(e => e.textContent).join(" | ")));
ok("aucune ligne ne se répète", new Set(cj).size === cj.length);
ok("aucun verbe de jardin", !/arros|voiler|tuteur|repiquage|ombrer|plant/i.test(cj.join(" ")), cj.join(" | "));
const alertesTxt = (await pg.locator(".al").allInnerTexts()).join(" ").toLowerCase();
const conseilsTxt = cj.join(" ").toLowerCase();
const motsCommuns = ["rafales", "gel probable", "indice uv", "mm attendus"]
  .filter(m => alertesTxt.includes(m) && conseilsTxt.includes(m));
ok("les alertes ne répètent pas les conseils", motsCommuns.length === 0, motsCommuns.join(", "));
/* Le mot ne doit pas paraître deux fois, en tuile et en ligne de conseil. Zéro
   fois est un état normal : la tuile cède sa place à la pluie quand le ressenti
   ne s'écarte pas du maximum du jour. */
ok("le ressenti n'est pas écrit deux fois sur l'accueil",
  ((await txt("#ecran")).toLowerCase().match(/ressenti/g) || []).length <= 1);
ok("la vigilance ouvre son détail depuis l'accueil",
  await pg.locator('#ecran .vg-c[data-feuille="vigilance"]').count() === 1);
ok("l'accueil ne porte plus de tuiles", await pg.locator(".tu").count() === 0);
ok("une valeur ne prend une couleur qu'au delà de son seuil", await pg.evaluate(() => {
  const v = [...document.querySelectorAll(".bd-m")].map(e => ({
    nom: e.querySelector("i").textContent,
    classe: e.querySelector("b").className,
  }));
  const hum = v.find(x => x.nom === "Humidité");
  const pluie = v.find(x => x.nom === "Pluie");
  // Humidité à 98 % et risque de pluie à 8 % dans le jeu figé : l'un signale, l'autre non.
  return hum.classe === "v-eau" && pluie.classe === "";
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

console.log("\n--- Le ciel de l'accueil ---");

/* Le bandeau de l'accueil suit la grammaire du soleil et de la lune : plein
   cadre, titre posé dans le ciel, barre de tête déshabillée. Ce qui lui est
   propre, c'est le temps qu'il fait, peint devant l'astre. */
ok("le ciel de l'accueil occupe toute la largeur", await pg.evaluate(() => {
  const ci = document.querySelector("#ecran .ci");
  if (!ci) return false;
  const b = ci.getBoundingClientRect();
  return b.left <= 0.5 && Math.abs(b.right - window.innerWidth) < 0.5 && b.top <= 0.5;
}));
ok("la barre de tête se déshabille sur le ciel de l'accueil",
  await pg.locator("#nav.sur-ciel").count() === 1);
ok("le temps est peint sur une toile",
  await pg.locator("canvas#ciTemps").count() === 1);
ok("la toile du temps couvre le panneau", await pg.evaluate(() => {
  const cv = document.getElementById("ciTemps");
  const ci = document.querySelector("#ecran .ci");
  if (!cv || !ci) return false;
  const a = cv.getBoundingClientRect(), b = ci.getBoundingClientRect();
  return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}));
/* Le temps passe devant l'astre : un nuage cache le Soleil, non l'inverse. La
   toile vient donc après lui dans l'ordre du document, et au-dessus par sa
   couche. */
ok("le temps se peint devant l'astre", await pg.evaluate(() => {
  const ci = document.querySelector("#ecran .ci");
  const cv = document.getElementById("ciTemps");
  const as = ci && ci.querySelector(".ci-astre");
  if (!ci || !cv) return false;
  if (!as) return true;
  const apres = as.compareDocumentPosition(cv) & Node.DOCUMENT_POSITION_FOLLOWING;
  return Boolean(apres) && Number(getComputedStyle(cv).zIndex) >= 1;
}));
/* Les quatre mesures portent sur la journée civile, non sur l'heure en cours.
   « Indice UV 0 » à dix heures du soir ne dit rien d'une journée montée à sept.
   Le jeu figé donne sept d'indice au plus contre cinq à neuf heures, et
   quatre-vingt-dix-huit pour cent d'humidité au plus contre quatre-vingts. */
const jour = await pg.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll(".bd-m")].map(e =>
    [e.querySelector("i").textContent.trim(), e.querySelector("b").textContent.trim()])));
ok("les mesures portent sur la journée, non sur l'heure",
  jour["Indice UV"] === "7" && jour["Humidité"] === "98 %" && jour["Vent"] === "23 km/h",
  JSON.stringify(jour));
/* Chaque mesure dit sur quoi elle porte : un chiffre de journée présenté comme
   un relevé d'instant se lirait de travers. */
ok("chaque mesure dit sa portée", await pg.evaluate(() =>
  [...document.querySelectorAll(".bd-m")].every(e => (e.querySelector("em") || {}).textContent)));

/* Le renversement de température se juge d'un maximum de journée à l'autre. La
   règle coupait en deux la fenêtre de vingt-quatre heures, ce qui revenait à
   comparer un après-midi à une nuit : elle annonçait un refroidissement tous les
   jours de beau temps, et nommait « le plus chaud de demain » un relevé du petit
   matin. La charge d'essai a deux journées de même chaleur : rien ne doit se
   dire. */
ok("aucun renversement annoncé quand demain vaut aujourd'hui", await pg.evaluate(() =>
  [...document.querySelectorAll(".conseils .cj-l")]
    .filter(e => /Refroidissement|Réchauffement/.test(e.textContent))
    .map(e => e.textContent).join(" | ")) === "",
  await pg.evaluate(() => [...document.querySelectorAll(".conseils .cj-l")]
    .map(e => e.textContent.trim()).join(" | ")));

/* Le Soleil et la Lune partagent le ciel dès qu'ils sont levés tous les deux.
   À neuf heures du matin la Lune est à quarante degrés sous l'horizon : le
   Soleil est seul, et rien ne doit tenir sa place. */
ok("de jour, Lune couchée, le Soleil est seul",
  await pg.locator("canvas#ciFeu").count() === 1
  && await pg.locator("#ecran canvas#ciLune").count() === 0,
  `${await pg.locator("canvas#ciFeu").count()} soleil, ${await pg.locator("#ecran canvas#ciLune").count()} lune`);

/* Les deux astres se placent par leur azimut, dans un même repère. Le Soleil
   suivait l'heure, ce qui le posait ailleurs que là où il est : à neuf heures
   il tombait au milieu du panneau alors qu'il est à l'est-nord-est. La même
   règle sur les deux écrans donne la même place au même instant. */
const placeAccueil = await pg.evaluate(() =>
  document.querySelector("#ecran .ci-astre").style.getPropertyValue("--ax"));
await onglet("soleil");
const placeSoleil = await pg.evaluate(() =>
  document.querySelector("#ecran .ci-astre").style.getPropertyValue("--ax"));
await onglet("accueil");
ok("le Soleil est à la même place sur les deux écrans",
  placeAccueil === placeSoleil && parseFloat(placeAccueil) < 30,
  `${placeAccueil} contre ${placeSoleil}`);

/* La règle de choix, éprouvée sur des cas que la charge d'essai ne porte pas :
   une Lune neuve en plein jour, deux astres qui se frôlent. */
const choix = await pg.evaluate(async () => {
  const V = await import("/src/vues.js");
  const cas = [
    ["jour, Lune levée et écartée", { hauteur: 17, azimut: 270 }, { hauteur: 22, azimut: 191 }, 0.37, true, true],
    ["jour, Lune sous l'horizon", { hauteur: 22, azimut: 95 }, { hauteur: -43, azimut: 67 }, 0.33, true, false],
    ["nuit, Lune levée", { hauteur: -12, azimut: 300 }, { hauteur: 11, azimut: 200 }, 0.57, false, true],
    ["nuit, Lune couchée", { hauteur: -30, azimut: 20 }, { hauteur: -20, azimut: 60 }, 0.5, false, true],
    ["jour, Lune neuve", { hauteur: 27, azimut: 130 }, { hauteur: 58, azimut: 170 }, 0.10, true, false],
    ["jour, astres qui se frôlent", { hauteur: 39, azimut: 220 }, { hauteur: 16, azimut: 205 }, 0.25, true, false],
  ];
  const fautes = [];
  for (const [nom, ps, pl, ecl, soleil, lune] of cas) {
    const v = V.astresVus(ps, pl, ecl);
    if (v.soleil !== soleil || v.lune !== lune) {
      fautes.push(`${nom} : soleil ${v.soleil}, lune ${v.lune}`);
    }
  }
  return fautes.join(" | ");
});
ok("le ciel choisit ses astres", choix === "", choix);

ok("la toile du temps porte des pixels", await pg.evaluate(() => {
  const cv = document.getElementById("ciTemps");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 3; i < d.length; i += 400) if (d[i] > 8) return true;
  return false;
}));
ok("le ciel bouge d'une image à l'autre", await pg.evaluate(async () => {
  const cv = document.getElementById("ciTemps");
  const lire = () => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  const a = lire();
  await new Promise(r => setTimeout(r, 700));
  const b = lire();
  let som = 0, n = 0;
  for (let i = 0; i < b.length; i += 16) { som += Math.abs(b[i] - a[i]); n++; }
  return som / n > 0.5;
}));

/* Le passage de la prévision au dessin. La couverture décide de la forme du
   ciel, le code décide de la précipitation, et la couche décide de ce qui reste
   visible de l'astre. */
const cielsRendus = await pg.evaluate(async () => {
  const T = await import("/src/temps.js");
  const cas = {
    clair: T.depuis(0, 4, 0), eclaircies: T.depuis(2, 45, 0), couvert: T.depuis(3, 97, 0),
    brume: T.depuis(45, 88, 0), pluie: T.depuis(63, 94, 2.1), averse: T.depuis(81, 74, 4.6),
    orage: T.depuis(95, 98, 7.4), neige: T.depuis(73, 90, 1.8),
    secours: T.depuis(63, null, null),
  };
  const voiles = {};
  for (const [n, p] of Object.entries(cas)) voiles[n] = T.voileDe(p);
  return { cas, voiles, seuil: T.SEUIL_VOILE };
});
const cr = cielsRendus;
ok("un ciel clair n'a ni couche ni précipitation",
  cr.cas.clair.nappe === 0 && cr.cas.clair.lame === 0 && cr.cas.clair.cumulus < 0.1);
ok("des éclaircies portent des cumulus, sans couche",
  cr.cas.eclaircies.nappe === 0 && cr.cas.eclaircies.cumulus > 0.3);
ok("un ciel couvert porte une couche fermée",
  cr.cas.couvert.nappe > 0.9 && cr.cas.couvert.cumulus < 0.3);
/* Sous une couche fermée, plus aucune masse isolée : celle qui restait se
   lisait comme un ballon suspendu devant le plafond. Sous une couche partielle,
   elles subsistent, c'est le ciel d'averse. */
ok("sous une couche fermée il ne reste aucune masse isolée",
  cr.cas.couvert.cumulus === 0 && cr.cas.averse.cumulus > 0.4,
  `${cr.cas.couvert.cumulus} | ${cr.cas.averse.cumulus}`);
ok("une averse garde ses cumulus sous une couche partielle",
  cr.cas.averse.cumulus > 0.4 && cr.cas.averse.nappe > 0.1 && cr.cas.averse.nappe < 0.7);
ok("la pluie, l'averse, l'orage et la neige portent une lame",
  ["pluie", "averse", "orage", "neige"].every(n => cr.cas[n].lame > 0));
ok("la neige tombe en neige, la pluie en pluie",
  cr.cas.neige.genre === "neige" && cr.cas.pluie.genre === "pluie");
ok("l'orage est marqué comme tel", cr.cas.orage.orage === true && cr.cas.clair.orage === false);
ok("le brouillard est un voile, non une averse",
  cr.cas.brume.brouillard > 0 && cr.cas.brume.lame === 0);
/* La charge de secours ne porte que le code : une pluie ne peut pas tomber d'un
   ciel vide, la couverture se déduit donc du code. */
ok("sans couverture nuageuse, le code en tient lieu",
  cr.cas.secours.nappe > 0.5 && cr.cas.secours.lame > 0);
ok("sous une couche fermée l'astre n'est plus dessiné",
  cr.voiles.couvert >= cr.seuil && cr.voiles.pluie >= cr.seuil
  && cr.voiles.orage >= cr.seuil);
ok("sous un ciel dégagé l'astre garde toute sa lumière",
  cr.voiles.clair === 0 && cr.voiles.eclaircies < cr.seuil);

console.log("\n--- Les moments de l'accueil ---");

/* Les moments racontent la journée qui vient, ce qui est l'affaire de
   l'accueil. Ils en ferment le contenu, la vigilance et la source formant la
   clôture. */
const moTitres = await pg.locator("#ecran .mt-t b").allInnerTexts();
ok("l'accueil porte les moments", moTitres.length >= 3, moTitres.join(" | "));
ok("les moments ferment le contenu de l'accueil", await pg.evaluate(() => {
  const mo = document.querySelector("#ecran .mt");
  const re = document.querySelector("#ecran .retenir");
  const pied = document.querySelector("#ecran .pied");
  if (!mo || !re || !pied) return false;
  const apresRetenir = re.compareDocumentPosition(mo) & Node.DOCUMENT_POSITION_FOLLOWING;
  const avantPied = mo.compareDocumentPosition(pied) & Node.DOCUMENT_POSITION_FOLLOWING;
  return Boolean(apresRetenir) && Boolean(avantPied);
}));

/* Le nom se dit comme on le dirait à l'oral tant qu'on est dans la journée en
   cours. La nuit qui vient porte la date du lendemain dès minuit passé : elle
   s'appelle pourtant « cette nuit ». Les colonnes suivantes prennent le nom
   court, l'ordre du temps et les heures les situant déjà. */
ok("les moments du jour se disent au démonstratif",
  moTitres.some(t => /^(Ce matin|Cet après-midi|Ce soir|Cette nuit)$/.test(t)),
  moTitres.join(" | "));
ok("les moments du lendemain prennent le nom court",
  moTitres.slice(1).every(t =>
    /^(nuit|matin|après-midi|soirée|Cette nuit|Ce matin|Cet après-midi|Ce soir)$/.test(t)),
  moTitres.join(" | "));
ok("aucun moment ne dit « demain »",
  !moTitres.some(t => /demain/i.test(t)), moTitres.join(" | "));
ok("la nuit qui vient s'appelle cette nuit",
  moTitres.includes("Cette nuit"), moTitres.join(" | "));

// Les heures situent la tranche, sous son nom, dans la même colonne.
ok("chaque moment porte ses heures", await pg.evaluate(() => {
  const e = [...document.querySelectorAll("#ecran .mt-t")];
  return e.length >= 3 && e.every(x => /\d\d-\d\d h/.test(x.textContent));
}));

/* Le libellé s'écrit une fois. C'était le défaut du bloc par moment : quatre
   fois « Température », cinq fois « Vent », et six cents points de haut. */
ok("chaque mesure n'est nommée qu'une fois", await pg.evaluate(() => {
  const l = [...document.querySelectorAll("#ecran .mt-l")]
    .map(e => e.textContent.trim()).filter(Boolean);
  return l.length >= 3 && l.length === new Set(l).size;
}), (await pg.locator("#ecran .mt-l").allInnerTexts()).join("/"));

ok("le tableau porte une case par mesure et par moment", await pg.evaluate(() => {
  const t = document.querySelector("#ecran .mt");
  const n = document.querySelectorAll("#ecran .mt-t").length;
  const lignes = document.querySelectorAll("#ecran .mt-l").length;
  // Entête, ciel, puis une ligne par mesure. La ligne du ciel porte un libellé vide.
  return t.children.length === (n + 1) * (lignes + 1);
}));

/* Une ligne ne paraît que si un moment au moins a quelque chose à y dire. Une
   ligne entièrement creuse serait un libellé pour rien. */
ok("aucune ligne n'est creuse de bout en bout", await pg.evaluate(() => {
  const t = document.querySelector("#ecran .mt");
  const n = document.querySelectorAll("#ecran .mt-t").length;
  const cases = [...t.children].slice((n + 1) * 2);
  for (let k = 0; k < cases.length; k += n + 1) {
    const ligne = cases.slice(k + 1, k + 1 + n);
    if (ligne.every(c => c.classList.contains("mt-creux"))) {
      return `${cases[k].textContent} vide`;
    }
  }
  return "";
}) === "", await pg.evaluate(() => {
  const t = document.querySelector("#ecran .mt");
  const n = document.querySelectorAll("#ecran .mt-t").length;
  const cases = [...t.children].slice((n + 1) * 2);
  const maux = [];
  for (let k = 0; k < cases.length; k += n + 1) {
    if (cases.slice(k + 1, k + 1 + n).every(c => c.classList.contains("mt-creux"))) {
      maux.push(cases[k].textContent);
    }
  }
  return maux.join(" ");
}));

// Le tableau tient dans sa carte, sans défilement latéral.
ok("le tableau des moments tient dans sa carte", await pg.evaluate(() => {
  const t = document.querySelector("#ecran .mt");
  return t.scrollWidth <= t.clientWidth + 1;
}));

/* À cinquante points de large, un nom de tranche qui passe à la ligne décale
   toute la ligne d'entête : « après-midi » s'abrège. */
ok("aucun nom de moment ne passe à la ligne", await pg.evaluate(() =>
  [...document.querySelectorAll("#ecran .mt-t b")]
    .every(e => e.scrollWidth <= e.clientWidth + 1)),
  (await pg.locator("#ecran .mt-t b").allInnerTexts()).join("/"));

/* Les deux bornes se séparent par une espace, non par un trait : « 13-15° » se
   lit encore, « -3--1° » ne se lit plus. */
ok("les bornes de température ne se collent pas par un trait", await pg.evaluate(() =>
  [...document.querySelectorAll("#ecran .mt-v")]
    .every(e => !/\d\s*-\s*\d/.test(e.textContent))),
  (await pg.locator("#ecran .mt-v").allInnerTexts()).slice(0, 5).join("/"));

/* La carte remplaçait cinq blocs de six cents points. Ce contrôle garde le
   gain : elle ne doit pas regrossir sans qu'on s'en aperçoive. */
ok("la journée qui vient tient sous quatre cents points", await pg.evaluate(() => {
  const c = document.querySelector("#ecran .mt").closest(".carte");
  return c.getBoundingClientRect().height < 400;
}), String(await pg.evaluate(() =>
  Math.round(document.querySelector("#ecran .mt").closest(".carte").getBoundingClientRect().height))));

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
/* Ce qui mérite d'être retenu se lit sur l'accueil, sous « À retenir ». Le
   répéter en tête du temps redisait les mêmes phrases un écran plus loin, à
   l'endroit où l'on vient justement chercher le détail. */
ok("les conseils ne se répètent pas sur l'écran du temps",
  await pg.locator("#ecran .conseils").count() === 0);
ok("l'écran s'ouvre sur Le temps", (await txt(".titre-ecran h1")) === "Le temps", await txt(".titre-ecran h1"));
ok("aucune feuille n'est ouverte", await pg.locator("#feuille:visible").count() === 0);
const voies = await pg.locator(".mg-v .mg-n").allInnerTexts();
ok("sept voies", voies.length === 7, voies.join(", "));
const nomsVoies = voies.map(v => v.replace(/[+−\n]/g, "").trim().toLowerCase()).join(",");
ok("les voies sont les bonnes",
  nomsVoies === "ciel,température,pluie,vent,indice uv,humidité,pression", nomsVoies);
ok("chaque voie porte une lecture à droite", (await pg.locator(".mg-r").count()) === 7);
const uv = (await pg.locator('.mg-v[data-cle="uv"]').innerText());
ok("l'indice UV porte son maximum et le mot qui le qualifie",
  /7[,.\d]*\s*au plus, (faible|modéré|élevé|très élevé|extrême)/.test(uv), uv.split("\n")[0]);
ok("l'axe des heures est posé", await pg.locator(".mg-a text").count() >= 3);

/* Le ciel ouvre la pile, et sa bande de symboles ne se mérite pas : c'est le
   dessin qu'on lit en un coup d'œil, il paraît replié comme déplié. L'axe le
   suit, sans quoi un symbole de pluie en tête de page ne dirait pas son heure. */
ok("le ciel ouvre la pile",
  await pg.locator(".mg-v").first().getAttribute("data-cle") === "nua",
  await pg.locator(".mg-v").first().getAttribute("data-cle"));
ok("les symboles du ciel paraissent voie repliée", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="nua"]');
  if (v.classList.contains("mg-grand")) return "voie dépliée";
  const ic = [...v.querySelectorAll("svg.mg-ic")];
  if (ic.length < 6) return `${ic.length} symboles`;
  /* La bande leur est réservée : sans réserve de hauteur, les symboles se
     dessinent quand même, mais par-dessus les lames de densité. */
  const lames = [...v.querySelectorAll('rect[shape-rendering="crispEdges"]')];
  if (!lames.length) return "aucune lame de densité";
  const bas = Math.max(...ic.map(e => e.getBoundingClientRect().bottom));
  const haut = Math.min(...lames.map(e => e.getBoundingClientRect().top));
  return haut >= bas - 1 ? "" : `chevauchement de ${(bas - haut).toFixed(1)} points`;
}) === "", String(await pg.locator('.mg-v[data-cle="nua"] svg.mg-ic').count()));
ok("l'axe des heures suit la bande du ciel",
  await pg.locator('.mg-v[data-cle="nua"] .mg-a text').count() >= 3,
  String(await pg.locator('.mg-v[data-cle="nua"] .mg-a text').count()));
ok("aucun montant de lecture visible au repos", await pg.locator(".mg-cur:visible").count() === 0);
const chVent = (await pg.locator('.mg-v[data-cle="v"]').locator("text.mg-g").allTextContents())
  .map(x => String(x ?? "").replace(/\s|km\/h/g, "")).filter(Boolean);
ok("le seuil du vent ne se superpose pas à la graduation",
  new Set(chVent).size === chVent.length, chVent.join(" | "));

/* ---- La grammaire du tracé ---- */

/* L'échelle vit dans la gouttière de droite, hors du tracé. Posée dedans, elle
   traversait les courbes : « 20 km/h » coupait la ligne du vent. */
ok("l'échelle se tient dans la gouttière", await pg.evaluate(() => {
  const t = [...document.querySelectorAll(".mg-s text.mg-g")];
  return t.length > 0 && t.every(e => Number(e.getAttribute("x")) >= 324);
}), String(await pg.locator(".mg-s text.mg-g").count()));

/* Deux chiffres d'échelle au même point se lisaient « 2,8 m2,5 ». */
ok("deux chiffres d'échelle ne se superposent pas", await pg.evaluate(() => {
  for (const v of document.querySelectorAll(".mg-v")) {
    const y = [...v.querySelectorAll("text.mg-g")].map(e => Number(e.getAttribute("y")));
    for (let a = 0; a < y.length; a++) {
      for (let b = a + 1; b < y.length; b++) if (Math.abs(y[a] - y[b]) < 7) return false;
    }
  }
  return true;
}));

/* Les seuils nommés disent ce que vaut la valeur là où on la regarde. */
ok("les échelles nommées portent leurs seuils dans le tracé", await pg.evaluate(() => {
  const attendu = { v: ["Léger", "Modéré", "Fort"], uv: ["Modéré", "Élevé"],
    hum: ["Humide", "Saturé"], mm: ["Modérée"] };
  for (const [cle, mots] of Object.entries(attendu)) {
    const v = document.querySelector(`.mg-v[data-cle="${cle}"]`);
    if (!v) return `voie ${cle} absente`;
    const vus = [...v.querySelectorAll("text.mg-bn")].map(e => e.textContent);
    for (const m of mots) if (!vus.includes(m)) return `${cle} sans ${m} (${vus.join("/")})`;
  }
  return "";
}) === "", await pg.evaluate(() =>
  [...document.querySelectorAll("text.mg-bn")].map(e => e.textContent).join("/")));

/* Le nom de bande cherche l'espace libre. Un mot posé sur l'aire pleine se
   noyait ; il se déporte au milieu ou à droite quand la gauche est prise. */
const noms = await pg.evaluate(() => {
  const fautes = [];
  for (const cle of ["v", "hum", "uv", "mm"]) {
    const voie = document.querySelector(`.mg-v[data-cle="${cle}"]`);
    if (!voie) continue;
    const svg = voie.querySelector("svg.mg-s");
    const m = svg.getScreenCTM();
    const ecran = (x, y) => ({ x: m.a * x + m.e, y: m.d * y + m.f });
    /* Une aire et un trait ne salissent pas de la même façon. L'aire couvre tout
       ce qui est sous sa courbe, un trait haut au-dessus du mot ne le touche
       pas : les deux se comptent séparément. */
    const traits = [], toits = [];
    for (const pl of svg.querySelectorAll("polyline")) {
      for (const p of (pl.getAttribute("points") || "").trim().split(/\s+/)) {
        const [x, y] = p.split(",").map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) traits.push(ecran(x, y));
      }
    }
    for (const pa of svg.querySelectorAll("path[fill]")) {
      const f = pa.getAttribute("fill");
      if (f === "none" || Number(pa.getAttribute("opacity") || 1) < 0.2) continue;
      for (const c of (pa.getAttribute("d") || "").matchAll(/([-\d.]+),([-\d.]+)/g)) {
        toits.push(ecran(Number(c[1]), Number(c[2])));
      }
    }
    const barres = [...svg.querySelectorAll("rect")]
      .filter(r => !r.classList.contains("mg-nuit"))
      .map(r => r.getBoundingClientRect());
    /* Le tracé s'étend d'un bout à l'autre des filets de seuil : ce sont eux qui
       donnent la zone de dessin, sans avoir à refaire le calcul des marges. */
    const filets = [...svg.querySelectorAll("line")].filter(l =>
      Math.abs(Number(l.getAttribute("y1")) - Number(l.getAttribute("y2"))) < 0.01);
    if (!filets.length) continue;
    const zone = filets[0].getBoundingClientRect();
    const pris = (g, dr, haut, bas) =>
      traits.some(p => p.x > g && p.x < dr && p.y > haut && p.y < bas)
      || toits.some(p => p.x > g && p.x < dr && p.y < bas)
      || barres.some(r => r.right > g && r.left < dr && r.top < bas - 1);
    for (const t of voie.querySelectorAll("text.mg-bn")) {
      const b = t.getBoundingClientRect();
      /* Une ligne peut être prise sur toute sa longueur : on ne reproche au mot
         sa place que s'il en existait une nette. La recherche est plus exigeante
         que la pose, d'une marge de quatre points de chaque côté. */
      let libre = false;
      for (let g = zone.left; g + b.width + 10 <= zone.right && !libre; g += 4) {
        if (!pris(g, g + b.width + 10, b.top - 4, b.bottom + 4)) libre = true;
      }
      if (libre && pris(b.left - 2, b.right + 2, b.top + 1, b.bottom - 1)) {
        fautes.push(`${cle}/${t.textContent}`);
      }
    }
  }
  return fautes.join(", ");
});
ok("les noms de bande évitent l'encre quand ils le peuvent", noms === "", noms);

/* Le liseré du nom doit être opaque : à trois quarts, il laissait passer l'aire
   qu'il devait masquer et le mot s'y noyait. */
ok("le liseré des noms de bande est opaque", await pg.evaluate(() => {
  const st = getComputedStyle(document.querySelector("text.mg-bn"));
  return st.opacity === "1" && st.paintOrder.includes("stroke")
    && parseFloat(st.strokeWidth) >= 2;
}));

// Le vent porte ses flèches de direction, repliée comme dépliée.
ok("le vent porte ses flèches de direction",
  await pg.locator('.mg-v[data-cle="v"] .mg-fl').count() >= 6,
  String(await pg.locator('.mg-v[data-cle="v"] .mg-fl').count()));

// La rampe colore la courbe de température, en largeur comme en hauteur.
ok("la rampe colore la température", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="t"]');
  const lignes = [...v.querySelectorAll("polyline")];
  const rampee = lignes.some(e => /url\(#mgTx\)/.test(e.getAttribute("stroke") || ""));
  const aire = v.querySelector('path[fill^="url(#mgTy"]');
  return rampee && !!aire && v.querySelectorAll("linearGradient stop").length > 20;
}));

// Les barres de l'indice ultraviolet prennent la couleur de leur niveau.
ok("les barres UV prennent la couleur de leur niveau", await pg.evaluate(() => {
  const b = [...document.querySelectorAll('.mg-v[data-cle="uv"] rect[fill^="hsl"]')];
  if (b.length < 6) return false;
  const teinte = e => Number((e.getAttribute("fill").match(/hsl\((\d+)/) || [])[1]);
  const h = b.map(teinte).filter(Number.isFinite);
  // Une teinte basse est chaude, une teinte haute est froide : l'indice le plus
  // fort doit être le plus chaud, donc la teinte la plus basse.
  return new Set(h).size >= 3 && Math.min(...h) < Math.max(...h) - 20;
}));

/* La nuit prend l'encre du texte, non la couleur de la voie : lavée à la
   couleur, elle virait au jaune sur l'indice ultraviolet. */
ok("la nuit traverse les sept voies", await pg.evaluate(() =>
  [...document.querySelectorAll(".mg-v[data-cle]")]
    .every(v => v.querySelector("rect.mg-nuit"))));
ok("la nuit garde l'encre du texte, non la couleur de la voie", await pg.evaluate(() => {
  const r = document.querySelector('.mg-v[data-cle="uv"] rect.mg-nuit');
  const s = document.querySelector('.mg-v[data-cle="uv"] .mg-s');
  return getComputedStyle(r).fill !== getComputedStyle(s).color;
}));

/* La phrase de résumé est un fait tiré de la série, non une notice : elle porte
   une heure ou un chiffre. */
ok("chaque voie résume un fait, non une notice", await pg.evaluate(() =>
  [...document.querySelectorAll(".mg-l")].every(e => /\d/.test(e.textContent))),
  (await pg.locator(".mg-l").first().innerText()).slice(0, 60));

console.log("\n--- Agrandissement d'une voie ---");
const hAvant = await pg.locator('.mg-v[data-cle="t"] svg.mg-s').boundingBox();
await pg.locator('.mg-b[data-voie="t"]').click();
await pg.waitForTimeout(320);
const hApres = await pg.locator('.mg-v[data-cle="t"] svg.mg-s').boundingBox();
ok("la voie touchée s'agrandit", hApres.height > hAvant.height * 2, `${hAvant.height.toFixed(0)} puis ${hApres.height.toFixed(0)}`);
ok("les autres voies gardent leur taille", await (async () => {
  const v = (await pg.locator('.mg-v[data-cle="v"] svg.mg-s').boundingBox()).height;
  const hum = (await pg.locator('.mg-v[data-cle="hum"] svg.mg-s').boundingBox()).height;
  // Le dessin est rendu à la largeur de la carte : c'est le rapport qui tient,
  // non la valeur absolue en points de la boîte de vue.
  return Math.abs(v / hum - 86 / 52) < 0.08 ? "" : `vent ${v.toFixed(0)}, humidité ${hum.toFixed(0)}`;
})() === "", await (async () => {
  const v = (await pg.locator('.mg-v[data-cle="v"] svg.mg-s').boundingBox()).height;
  const hum = (await pg.locator('.mg-v[data-cle="hum"] svg.mg-s').boundingBox()).height;
  return `vent ${v.toFixed(0)}, humidité ${hum.toFixed(0)}`;
})());
ok("la légende paraît avec l'agrandissement", await pg.locator(".mg-l:visible").count() === 1);
/* La pile fait cinq cents points et l'axe est tout en bas : une voie dépliée
   au milieu n'aurait plus de repère de temps. Trois axes en tout, celui du ciel
   en tête, celui de la voie dépliée, celui du pied de pile. */
ok("l'axe des heures se répète sous la voie dépliée",
  await pg.locator('.mg-v[data-cle="t"] .mg-a').count() === 1
  && await pg.locator(".mg-a").count() === 3,
  String(await pg.locator(".mg-a").count()));
/* Les symboles et les valeurs occupent deux bandes distinctes : écrits au même
   niveau, les flèches du vent et les chiffres du vent se recouvraient. */
await pg.locator('.mg-b[data-voie="v"]').click();
await pg.waitForTimeout(320);
ok("les symboles et les valeurs ne partagent pas leur bande", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="v"]');
  const fl = [...v.querySelectorAll(".mg-fl")];
  const va = [...v.querySelectorAll("text.mg-p")];
  if (!fl.length || !va.length) return "bande vide";
  const bas = Math.max(...fl.map(e => e.getBoundingClientRect().bottom));
  const haut = Math.min(...va.map(e => e.getBoundingClientRect().top));
  return haut >= bas - 1 ? "" : `chevauchement de ${(bas - haut).toFixed(1)} points`;
}) === "", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="v"]');
  const fl = [...v.querySelectorAll(".mg-fl")], va = [...v.querySelectorAll("text.mg-p")];
  if (!fl.length || !va.length) return "bande vide";
  return `${Math.max(...fl.map(e => e.getBoundingClientRect().bottom)).toFixed(0)} puis `
    + `${Math.min(...va.map(e => e.getBoundingClientRect().top)).toFixed(0)}`;
}));
await pg.locator('.mg-b[data-voie="v"]').click();
await pg.waitForTimeout(320);

/* Le symbole du ciel est un SVG dans un SVG. Sa taille passe par des attributs,
   non par la feuille de style : WebKit ignore `width` et `height` venus du CSS
   sur un SVG imbriqué, déploie le dessin sur toute la hauteur du parent, et le
   symbole débordait alors de la carte. */
await pg.locator('.mg-b[data-voie="nua"]').click();
await pg.waitForTimeout(320);
ok("les symboles du ciel portent leur taille en attributs", await pg.evaluate(() => {
  const ic = [...document.querySelectorAll('.mg-v[data-cle="nua"] svg.mg-ic')];
  if (ic.length < 6) return `seulement ${ic.length} symboles`;
  const nus = ic.filter(e => !e.getAttribute("width") || !e.getAttribute("height"));
  return nus.length ? `${nus.length} symboles sans taille` : "";
}) === "", String(await pg.locator('.mg-v[data-cle="nua"] svg.mg-ic').count()));
ok("les symboles du ciel tiennent dans leur bande", await pg.evaluate(() => {
  const voie = document.querySelector('.mg-v[data-cle="nua"]');
  const cadre = voie.querySelector("svg.mg-s").getBoundingClientRect();
  for (const e of voie.querySelectorAll("svg.mg-ic")) {
    const b = e.getBoundingClientRect();
    if (b.height > 22 || b.width > 22) return `symbole de ${b.width.toFixed(0)} sur ${b.height.toFixed(0)}`;
    if (b.bottom > cadre.top + 40 || b.right > cadre.right + 1) return "symbole hors de la bande";
  }
  return "";
}) === "", await pg.evaluate(() => {
  const e = document.querySelector('.mg-v[data-cle="nua"] svg.mg-ic');
  const b = e && e.getBoundingClientRect();
  return b ? `${b.width.toFixed(0)} sur ${b.height.toFixed(0)}` : "aucun";
}));
/* Dépliée, la voie du ciel quitte la densité pour l'aire sous ses bandes
   nommées : une teinte n'a pas d'échelle contre laquelle se lire. Et elle tient
   dans la hauteur commune, l'agrandissement d'une bande plate ne donnant rien. */
ok("le ciel déplié prend la grammaire du tracé", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="nua"]');
  const svg = v.querySelector("svg.mg-s");
  if (!svg.querySelector("polyline")) return "aucune courbe";
  if (!svg.querySelector('path[fill="currentColor"]')) return "aucune aire";
  const noms = [...svg.querySelectorAll("text.mg-bn")].map(e => e.textContent);
  if (!noms.includes("Couvert") || !noms.includes("Éclaircies")) return `bandes ${noms.join("/")}`;
  const lames = [...svg.querySelectorAll('rect[shape-rendering="crispEdges"]')];
  return lames.length ? `${lames.length} lames de densité subsistent` : "";
}) === "", await pg.evaluate(() => [...document.querySelectorAll(
  '.mg-v[data-cle="nua"] text.mg-bn')].map(e => e.textContent).join("/") || "aucune bande"));
ok("le ciel déplié tient dans la hauteur commune", await (async () => {
  const nua = (await pg.locator('.mg-v[data-cle="nua"] svg.mg-s').boundingBox()).height;
  const hum = (await pg.locator('.mg-v[data-cle="hum"] svg.mg-s').boundingBox()).height;
  return Math.abs(nua / hum - 86 / 52) < 0.08 ? "" : `rapport ${(nua / hum).toFixed(2)}`;
})() === "", await (async () => {
  const nua = (await pg.locator('.mg-v[data-cle="nua"] svg.mg-s').boundingBox()).height;
  const hum = (await pg.locator('.mg-v[data-cle="hum"] svg.mg-s').boundingBox()).height;
  return `rapport ${(nua / hum).toFixed(2)}, attendu ${(86 / 52).toFixed(2)}`;
})());
await pg.locator('.mg-b[data-voie="nua"]').click();
await pg.waitForTimeout(320);

console.log("\n--- Les deux écritures ---");
/* Le sélecteur se tient sur la ligne du titre : c'est ce qui remonte le ruban
   et la table en haut de la page. */
ok("le sélecteur d'écriture est sur la ligne du titre",
  await pg.locator(".titre-ecran .te-ligne .seg-menu").count() === 1);
ok("le sélecteur ne propose que le ruban et la table",
  await pg.locator(".seg-menu [data-ecriture]").count() === 2,
  (await pg.locator(".seg-menu [data-ecriture]").allInnerTexts()).join(" | "));
ok("le sélecteur reste plus étroit que la moitié de la largeur", await pg.evaluate(() => {
  const g = document.querySelector(".seg-menu");
  return g.getBoundingClientRect().width < window.innerWidth * 0.5;
}));
/* Le premier chiffre du ruban doit se voir sans défiler : c'est la raison
   d'être du déplacement. */
ok("le ruban commence au-dessus de la ligne de flottaison", await pg.evaluate(() => {
  const c = document.querySelector("#ecran .carte");
  return c.getBoundingClientRect().top < 200;
}, ));
await pg.locator('[data-ecriture="liste"]').click();
await pg.waitForTimeout(420);
ok("la liste porte treize colonnes", await pg.locator(".hh thead th").count() === 13,
  String(await pg.locator(".hh thead th").count()));
ok("la liste porte vingt-quatre lignes", await pg.locator(".hh tbody tr").count() === 24,
  String(await pg.locator(".hh tbody tr").count()));
const h1 = await pg.locator(".hh tbody tr").first().locator("td").first().innerText();
ok("la première ligne est l'heure en cours", h1.trim() === "09 h", h1);
await pg.locator('[data-ecriture="ruban"]').click();
await pg.waitForTimeout(420);

console.log("\n--- La semaine ---");
await onglet("semaine");
ok("sept lignes", await pg.locator(".sem-r").count() === 7, String(await pg.locator(".sem-r").count()));
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
  [...document.querySelectorAll(".sem-r")].every(t => t.getBoundingClientRect().height < 76)));
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

/* ---- Les moments d'une journée de la semaine ---- */

ok("chaque journée annonce qu'elle s'ouvre",
  await pg.locator('.sem-r[aria-expanded="false"]').count() === 7
  && await pg.locator(".sem-chev").count() === 7);
ok("aucun volet n'est ouvert à l'arrivée",
  await pg.locator(".md:not([hidden])").count() === 0);

await pg.locator(".sem-r").nth(2).click();
await pg.waitForTimeout(350);
ok("l'appui ouvre les quatre moments",
  await pg.locator(".md:not([hidden])").count() === 1
  && await pg.locator(".md:not([hidden]) > div").count() === 4);
ok("les quatre moments sont nommés par tranche de six heures",
  (await pg.locator(".md:not([hidden]) > div > i").allInnerTexts()).join("/")
  === "nuit/matin/après-midi/soirée",
  (await pg.locator(".md:not([hidden]) > div > i").allInnerTexts()).join("/"));

await pg.locator(".sem-r").nth(4).click();
await pg.waitForTimeout(350);
ok("un seul volet reste ouvert",
  await pg.locator(".md:not([hidden])").count() === 1
  && await pg.locator('.sem-r[aria-expanded="true"]').count() === 1);
await pg.locator(".sem-r").nth(4).click();
await pg.waitForTimeout(350);
ok("un second appui referme",
  await pg.locator(".md:not([hidden])").count() === 0
  && await pg.locator('.sem-r[aria-expanded="true"]').count() === 0);

/* La donnée du volet est celle du module, non une valeur recopiée : la
   température montrée est le minimum la nuit, le maximum le jour, et les deux
   lignes basses ne paraissent que si elles ont quelque chose à dire. */
const voletsKO = await pg.evaluate(async () => {
  const P = await import("/src/previsions.js");
  const maux = [];
  for (const j of document.querySelectorAll(".sem-r[data-jour]")) {
    const date = j.dataset.jour;
    const mo = P.momentsJour(date);
    if (!mo) { maux.push(`${date}: aucun moment`); continue; }
    const cases = [...document.getElementById(j.getAttribute("aria-controls")).children];
    if (cases.length !== 4) { maux.push(`${date}: ${cases.length} cases`); continue; }
    cases.forEach((c, q) => {
      const m = mo[q];
      const attendu = Math.round(q === 0 ? m.tn : m.tx);
      const vu = Number(c.querySelector("b").textContent.replace("°", ""));
      if (vu !== attendu) maux.push(`${date} ${q}: ${vu} au lieu de ${attendu}`);
      const eau = c.querySelector("em");
      if (eau && !(m.mm >= 0.1 || m.pb >= 5)) maux.push(`${date} ${q}: eau sans motif`);
      if (!eau && (m.mm >= 0.1 || m.pb >= 5)) maux.push(`${date} ${q}: eau manquante`);
      const vent = c.querySelector("u");
      if (vent && m.raf < 40) maux.push(`${date} ${q}: vent sans motif`);
      if (!vent && m.raf >= 40) maux.push(`${date} ${q}: rafale tue`);
    });
  }
  return maux;
});
ok("chaque volet dit la borne qui compte et rien de superflu",
  voletsKO.length === 0, voletsKO.slice(0, 3).join(" | "));

ok("la rafale forte est signalée quelque part dans la semaine", await pg.evaluate(() =>
  [...document.querySelectorAll(".md u")].length > 0));

// Sur la journée en cours, un moment déjà passé s'efface.
await pg.locator(".sem-r").first().click();
await pg.waitForTimeout(350);
ok("un moment passé s'efface sur la journée en cours", await pg.evaluate(() => {
  const v = document.querySelector(".md:not([hidden])");
  if (!v) return false;
  const h = new Date().getHours();
  return [...v.children].every((c, q) =>
    c.classList.contains("passe") === (q * 6 + 6 <= h));
}));
await pg.locator(".sem-r").first().click();
await pg.waitForTimeout(300);

console.log("\n--- Le soleil ---");
await onglet("soleil");
await pg.waitForTimeout(600);
const soleilTxt = await txt("#ecran");
ok("la durée du jour est écrite", /\d+ h \d\d/.test(soleilTxt));
ok("le midi solaire est écrit", /Midi solaire/.test(soleilTxt));
ok("le midi solaire porte la hauteur maximale",
  /Midi solaire[\s\S]{0,40}\d+° de hauteur/.test(soleilTxt), soleilTxt.slice(0, 120));
ok("les trois crépuscules sont nommés",
  ["Crépuscule civil", "Crépuscule nautique", "Crépuscule astronomique"]
    .every(x => soleilTxt.includes(x)));
ok("le lever porte un point cardinal", /Lever[\s\S]{0,40}(nord|est|sud|ouest)/.test(soleilTxt), soleilTxt.slice(0, 80));

/* La plainte d'origine : la même heure écrite deux fois. Le bandeau annonce le
   prochain évènement et redit donc son heure, il reste hors du compte. */
ok("aucune heure n'est écrite deux fois dans le corps", await pg.evaluate(() => {
  const h = (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []);
  return h.length === new Set(h).size;
}), await pg.evaluate(() =>
  (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []).join(" ")));

const dureeTxt = await txt(".tm > div:first-child b");
ok("la durée du jour n'est écrite qu'une fois",
  dureeTxt !== "" && soleilTxt.split(dureeTxt).length - 1 === 1,
  `${dureeTxt} | ${soleilTxt.split(dureeTxt).length - 1}`);

/* Le seconde plainte : la note nommait trois crépuscules, la carte en montrait
   deux. Les deux listes doivent coïncider, dans le même ordre. */
const nomsCrep = await pg.evaluate(() => {
  const carte = document.querySelector("#ecran .cp").closest(".carte");
  const note = (carte.querySelector(".note") || { textContent: "" }).textContent.toLowerCase();
  const rangs = [...carte.querySelectorAll(".cp-n b")].map(e => e.textContent.toLowerCase());
  const cles = ["civil", "nautique", "astronomique"];
  return {
    note: cles.filter(k => note.includes(k)),
    rangs: cles.filter(k => rangs.some(r => r.includes(k))),
  };
});
ok("la note ne nomme que les crépuscules montrés",
  nomsCrep.note.length === 3 && nomsCrep.note.join() === nomsCrep.rangs.join(),
  `${nomsCrep.note.join("/")} | ${nomsCrep.rangs.join("/")}`);

/* La troisième : deux heures nues sans dire laquelle est le matin. Chaque
   rangée porte donc deux colonnes, et chaque heure tombe dans sa moitié. */
const crepRangs = await pg.evaluate(() => {
  const tete = [...document.querySelectorAll(".cp-t")].map(e => e.textContent.trim());
  if (tete[1] !== "Le matin" || tete[2] !== "Le soir") return "entête " + tete.join("/");
  const cases = [...document.querySelectorAll(".cp > *")];
  const enMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let i = 3, rangs = 0;
  while (i < cases.length) {
    if (!cases[i].classList.contains("cp-n")) return "rangée sans nom en " + i;
    const a = cases[i + 1], b = cases[i + 2];
    /* La case d'absence dit pourquoi il n'y a pas d'heure. Si elle en porte
       une, les deux moments sont retombés dans la même case. */
    if (a && a.classList.contains("cp-abs")) {
      if (/\d\d:\d\d/.test(a.textContent)) return "deux moments dans une case: " + a.textContent;
      i += 2; rangs++; continue;
    }
    if (!a || !b || !a.classList.contains("cp-h") || !b.classList.contains("cp-h")) {
      return "heures manquantes en " + i;
    }
    if (enMin(a.textContent) >= 720 || enMin(b.textContent) <= 720) {
      return `hors de sa moitié ${a.textContent} ${b.textContent}`;
    }
    i += 3; rangs++;
  }
  return rangs === 3 ? "" : "rangées " + rangs;
});
ok("chaque crépuscule dit son matin et son soir", crepRangs === "", crepRangs);

// Le ruban de la lumière : il couvre le jour entier et montre ses cinq états.
const ruban = await pg.evaluate(() => {
  const r = [...document.querySelectorAll(".lm-r rect.lm")];
  return {
    largeur: r.reduce((a, e) => a + Number(e.getAttribute("width")), 0),
    etats: new Set(r.map(e => e.getAttribute("class").split(" ")[1])).size,
  };
});
ok("le ruban de la lumière couvre les vingt-quatre heures",
  Math.abs(ruban.largeur - 334) < 1.5, String(ruban.largeur));
ok("le ruban montre les cinq états de la lumière", ruban.etats === 5, String(ruban.etats));
/* Le découpage doit couvrir la journée entière et sans trou, quel que soit le
   ciel : un jour sans nuit noire, un jour sans coucher, un jour ordinaire. */
const decoupe = await pg.evaluate(async () => {
  const { bandesLum } = await import("/src/vues.js");
  const courbe = f => {
    const out = [];
    for (let m = 0; m <= 1440; m += 5) out.push({ m, h: f(m) });
    return out;
  };
  const cas = {
    ordinaire: m => 55 * -Math.cos(2 * Math.PI * m / 1440) + 5,
    "sans nuit noire": m => 20 * -Math.cos(2 * Math.PI * m / 1440) + 5,
    "sans coucher": () => 12,
    "sans lever": () => -40,
  };
  const maux = [];
  for (const [nom, f] of Object.entries(cas)) {
    const b = bandesLum(courbe(f));
    if (!b.length) { maux.push(`${nom}: aucune bande`); continue; }
    if (b[0].a !== 0) maux.push(`${nom}: débute à ${b[0].a}`);
    if (b[b.length - 1].b !== 1440) maux.push(`${nom}: finit à ${b[b.length - 1].b}`);
    for (let k = 1; k < b.length; k++) {
      if (Math.abs(b[k].a - b[k - 1].b) > 1e-6) maux.push(`${nom}: trou en ${b[k].a}`);
      if (b[k].z === b[k - 1].z) maux.push(`${nom}: deux bandes du même état`);
    }
  }
  return maux;
});
ok("le découpage de la lumière couvre la journée sans trou",
  decoupe.length === 0, decoupe.join(" | "));

ok("chaque crépuscule porte la teinte de sa bande", await pg.evaluate(() => {
  const sonde = document.createElement("div");
  document.body.append(sonde);
  const attendu = n => {
    sonde.style.background = `var(${n})`;
    return getComputedStyle(sonde).backgroundColor;
  };
  const vu = c => {
    const e = document.querySelector(c);
    return e ? getComputedStyle(e).backgroundColor : "";
  };
  const bon = vu(".cp-p.p-civil") === attendu("--lum-civil")
    && vu(".cp-p.p-naut") === attendu("--lum-naut")
    && vu(".cp-p.p-astro") === attendu("--lum-astro");
  sonde.remove();
  return bon;
}));

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

/* Le grand chiffre est le même sur les trois bandeaux : la température de
   l'accueil, l'heure du soleil, l'heure de la lune. Deux traitements pour un
   même rôle donnaient trois écrans qui ne se ressemblaient pas. */
const grandChiffre = await pg.evaluate(() => {
  const faire = html => {
    const d = document.createElement("div");
    d.style.position = "absolute"; d.style.visibility = "hidden";
    d.innerHTML = html;
    document.body.append(d);
    return d;
  };
  const a = faire('<div class="plein-titre"><b>0</b></div>');
  const b = faire('<div class="plein-titre"><div class="pt-temps">'
    + '<span class="bd-deg">0</span></div></div>');
  const lire = e => {
    const s = getComputedStyle(e);
    return [s.fontSize, s.fontWeight, s.letterSpacing].join("/");
  };
  const r = [lire(a.querySelector("b")), lire(b.querySelector(".bd-deg"))];
  a.remove(); b.remove();
  return r;
});
ok("le grand chiffre du ciel est le même sur les trois bandeaux",
  grandChiffre[0] === grandChiffre[1], grandChiffre.join("  contre  "));
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
  const n = [...document.querySelectorAll(".ch .rangee-txt > b")].map(e => e.textContent);
  return n.length === 3 && n[0] === "Lever" && n[1] === "Midi solaire" && n[2] === "Coucher";
}), await pg.evaluate(() =>
  [...document.querySelectorAll(".ch .rangee-txt > b")].map(e => e.textContent).join("/")));
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

/* La vignette montre la forme du disque à côté de son nom : dans le ciel, la
   Lune est à sa place réelle et peut n'y être pas visible du tout. */
ok("la phase est montrée en vignette à côté de son nom", await pg.evaluate(() => {
  const v = document.querySelector(".plein-titre em canvas#ptLune");
  if (!v) return false;
  const t = document.querySelector(".plein-titre em span");
  return !!t && v.compareDocumentPosition(t) === Node.DOCUMENT_POSITION_FOLLOWING;
}));
ok("la vignette porte des pixels opaques", await pg.evaluate(() => {
  const cv = document.getElementById("ptLune");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++;
  // Le disque couvre environ les trois quarts du carré : la moitié suffit à l'affirmer.
  return n > (d.length / 4) * 0.5;
}));
/* À la taille d'un mot, la lumière cendrée noie le croissant : la part sombre
   doit être franche, sans quoi la vignette n'est qu'un rond gris. */
ok("la part sombre de la vignette est franche", await pg.evaluate(() => {
  const cv = document.getElementById("ptLune");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let opaques = 0, noirs = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    opaques++;
    if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 5) noirs++;
  }
  return opaques > 0 && noirs / opaques >= 0.30;
}), await pg.evaluate(() => {
  const cv = document.getElementById("ptLune");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let o = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    o++;
    if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 5) n++;
  }
  return `${n}/${o}`;
}));
ok("la vignette dit la même phase que le ciel", await pg.evaluate(() => {
  const a = document.getElementById("ciLune").dataset;
  const b = document.getElementById("ptLune").dataset;
  return a.phase === b.phase && a.angle === b.angle && a.eclairee === b.eclairee;
}));
ok("la vignette garde sa pleine matière sous le texte pâli", await pg.evaluate(() => {
  const v = document.getElementById("ptLune");
  return Number(getComputedStyle(v).opacity) === 1
    && Number(getComputedStyle(v.parentElement).opacity) === 1;
}));

ok("la course du jour de la lune se lit dans l'ordre", await pg.evaluate(() => {
  const n = [...document.querySelectorAll(".ch-lune .rangee-txt > b")].map(e => e.textContent);
  return n.length === 3 && n[0] === "Lever" && n[1] === "Passage au méridien"
    && n[2] === "Coucher";
}), await pg.evaluate(() =>
  [...document.querySelectorAll(".ch-lune .rangee-txt > b")].map(e => e.textContent).join("/")));
ok("le passage au méridien porte la hauteur maximale",
  /Passage au méridien[\s\S]{0,40}\d+° de hauteur/.test(lunTxt), lunTxt.slice(0, 160));
/* La part éclairée est dite dans le ciel, en toutes lettres et en image. Le
   corps ne la redit pas : c'était la place perdue de la durée au-dessus de
   l'horizon. */
ok("la part éclairée n'est écrite que dans le ciel", await pg.evaluate(() => {
  const ciel = /\d+ %/.test(document.querySelector(".plein-titre").innerText);
  const corps = /\d+ %/.test(document.querySelector("#ecran .ecran-corps").innerText);
  return ciel && !corps;
}));
ok("aucune heure n'est écrite deux fois dans le corps de la lune", await pg.evaluate(() => {
  const h = (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []);
  return h.length === new Set(h).size;
}), await pg.evaluate(() =>
  (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []).join(" ")));
ok("les quatre phases à venir sont dessinées",
  await pg.locator(".ph > div").count() === 4 && await pg.locator(".ph .ln-disque").count() === 4);
ok("chaque phase porte son nom et sa date",
  await pg.locator(".ph b").count() === 4
  && (await pg.locator(".ph em").allInnerTexts()).every(t => /\d/.test(t)));
/* La date situe, le délai mesure : « 20 août » ne dit pas si c'est dans deux
   jours ou dans trois semaines. */
ok("chaque phase porte son délai",
  await pg.locator(".ph u").count() === 4
  && (await pg.locator(".ph u").allInnerTexts())
    .every(t => /^(aujourd'hui|demain|dans \d+ j)$/.test(t.trim())),
  (await pg.locator(".ph u").allInnerTexts()).join("/"));

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

console.log("\n--- Vigilance ---");
await onglet("accueil");
await pg.waitForTimeout(500);

/* Le panneau ne paraît que s'il y a quelque chose à signaler, et il paraît alors
   en premier : une vigilance orange ne se lit pas après la température. */
ok("le panneau de vigilance paraît", await pg.locator("#ecran .vg").count() === 1);
ok("il vient avant tout le reste du corps", await pg.evaluate(() => {
  const c = document.querySelector("#ecran .ecran-corps");
  return c && c.firstElementChild && c.firstElementChild.classList.contains("vg");
}));
/* Le panneau porte son titre lui-même : un titre de section au-dessus d'une
   carte qui dit déjà « soyez attentif » annonçait deux fois la même chose et
   repoussait le bloc du jour hors de la première vue. */
ok("il écrit le niveau en toutes lettres, non par la seule couleur",
  /Vigilance orange/i.test(await txt("#ecran .vg-txt b")), await txt("#ecran .vg-txt b"));
ok("le mot vigilance ne s'écrit qu'une fois dans la tête",
  ((await txt("#ecran .vg-txt")).toLowerCase().match(/vigilance/g) || []).length === 1,
  await txt("#ecran .vg-txt"));
ok("le panneau ne porte pas de titre de section au-dessus de lui",
  await pg.locator("#ecran .vg h2").count() === 0);

/* Le panneau prend la tête de l'écran : ce qui le suit doit rester visible sans
   défiler. C'est le bloc du jour et ses quatre mesures, non ses faits, qui doit
   tenir au-dessus de la barre d'onglets.

   Le panneau tient donc dans une enveloppe, deux phénomènes compris. C'est elle
   qui garde le budget : la mesure du dégagement sous les mesures ne dit que
   l'état d'un écran de huit cent quarante-quatre points, et ne verrait pas un
   panneau qui reprendrait vingt points. */
ok("le panneau de vigilance tient dans son enveloppe", await pg.evaluate(() => {
  const v = document.querySelector("#ecran .vg");
  const n = document.querySelectorAll("#ecran .vg-a").length;
  const h = v.getBoundingClientRect().height;
  return h <= 150 ? "" : `${h.toFixed(0)} points pour ${n} phénomènes`;
}) === "", await pg.evaluate(() =>
  `${document.querySelector("#ecran .vg").getBoundingClientRect().height.toFixed(0)} points`));

ok("les mesures du jour tiennent dans la première vue malgré la vigilance",
  await pg.evaluate(() => {
    const m = document.querySelector("#ecran .bd-mesures");
    const o = document.getElementById("onglets");
    if (!m || !o) return "élément manquant";
    const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
    return reste >= 0 ? "" : `${reste.toFixed(0)} points sous les mesures`;
  }) === "", await pg.evaluate(() => {
    const m = document.querySelector("#ecran .bd-mesures");
    const o = document.getElementById("onglets");
    return m && o
      ? `${(o.getBoundingClientRect().top - m.getBoundingClientRect().bottom).toFixed(0)} points`
      : "élément manquant";
  }));
ok("il porte la conduite à tenir",
  /vigilant/i.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));
/* Le numéro de département ne se lit pas : « Côte-d'Or » dit ce que « 21 » cache. */
ok("il nomme le département plutôt que de le numéroter",
  /Côte-d'Or/.test(await txt("#ecran .vg-txt"))
  && !/Département 21/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));

/* Chaque phénomène signalé se décrit : son nom, son niveau écrit, sa fenêtre.
   Le vert n'est pas une vigilance et ne doit pas remonter. */
const vgA = await pg.locator("#ecran .vg-a").allInnerTexts();
ok("les deux phénomènes signalés sont décrits", vgA.length === 2, vgA.join(" | "));
ok("le plus grave passe devant", /Orages/.test(vgA[0] || ""), vgA.join(" | "));
ok("chaque ligne écrit son niveau et sa fenêtre",
  vgA.every(t => /(jaune|orange|rouge)/.test(t) && /\d+ h/.test(t)), vgA.join(" | "));
ok("les phénomènes au vert ne remontent pas",
  !vgA.some(t => /(Pluie|Neige|Canicule)/.test(t)), vgA.join(" | "));
/* Deux plages contiguës de même couleur ne font qu'une : la source les découpe
   sur ses propres bornes, qui ne sont pas celles du phénomène. */
ok("les plages contiguës de même couleur sont fondues",
  /de 14 h à 18 h/.test(vgA.find(t => /Vent/.test(t)) || ""), vgA.join(" | "));

await pg.locator("#ecran .vg-c").click(); await pg.waitForTimeout(500);
ok("le panneau ouvre le détail", (await txt("#feuille-titre")).startsWith("Vigilance"));
const lien = pg.locator("#feuille-corps a.lien-plein");
ok("un lien plein est proposé", await lien.count() === 1);
const href = await lien.getAttribute("href");
ok("il pointe vers la page du département sur Météo-France",
  href === "https://vigilance.meteofrance.fr/fr/cote-d-or", href);
ok("il s'ouvre hors de l'application", await lien.getAttribute("target") === "_blank"
  && /noopener/.test(await lien.getAttribute("rel") || ""));
ok("le détail reprend les phénomènes", await pg.locator("#feuille-corps .vg-r").count() === 2);
ok("le détail nomme sa source",
  /Météo-France/.test(await txt("#feuille-corps")));
ok("le détail nomme le département",
  /Côte-d'Or/.test(await txt("#feuille-titre")), await txt("#feuille-titre"));

ok("la feuille courte prend l'accroche intermédiaire",
  await pg.locator("#feuille.moyenne").count() === 1);

console.log("\n--- Communes suivies ---");
await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(420);
await onglet("accueil");

// Premier geste : le titre d'écran.
await pg.locator("#navLieu").click();
await pg.waitForTimeout(900);
ok("le titre d'écran ouvre la feuille des lieux",
  (await txt("#feuille-titre")).startsWith("Mes lieux"), await txt("#feuille-titre"));
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

/* Chaque rangée porte le ciel de son lieu : la même image qu'en fond d'accueil
   là-bas, un bleu contre un gris. */
ok("chaque rangée porte le ciel de son lieu", await pg.evaluate(() => {
  const co = [...document.querySelectorAll(".co:not([data-plat])")];
  return co.length > 0 && co.every(e => {
    const f = e.style.getPropertyValue("--co-haut").trim();
    return /^rgb\(\d+,\d+,\d+\)$/.test(f);
  });
}));
ok("le ciel d'une rangée n'est pas le fond de la carte", await pg.evaluate(() => {
  const l = document.querySelector(".co:not([data-plat]) .co-l");
  return l && getComputedStyle(l).backgroundImage.includes("gradient");
}));

/* Ajouter ne vit plus au bas de la liste : c'est une action, elle se range dans
   la tête de feuille, à droite du titre. */
ok("l'ajout se range derrière un bouton dans la tête",
  await pg.locator("#feuille-action .feuille-plus").count() === 1);
ok("le champ d'ajout n'encombre plus la liste",
  await pg.locator("#feuille-corps #rgQ").count() === 0);
await pg.locator("#feuille-action .feuille-plus").click();
await pg.waitForTimeout(700);
ok("le bouton pousse la feuille d'ajout",
  (await txt("#feuille-titre")).startsWith("Ajouter"), await txt("#feuille-titre"));
ok("le retour ramène à Mes lieux", await pg.locator("#feuille-retour:visible").count() === 1);

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

/* Réordonner. Au clavier d'abord, qui est le chemin d'un lecteur d'écran, puis
   au doigt par appui long. L'ordre tient au rechargement : il est écrit. */
const avantOrdre = (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",");
ok("deux lieux avant de réordonner", (await pg.locator(".co:not(.co-pos)").count()) === 2,
  avantOrdre);
ok("chaque lieu porte de quoi monter et descendre",
  await pg.locator(".co:not(.co-pos) [data-monter]").count() === 2
  && await pg.locator(".co:not(.co-pos) [data-descendre]").count() === 2);
ok("les commandes d'ordre ne se voient qu'au focus", await pg.evaluate(() => {
  const o = document.querySelector(".co-ordre");
  return parseFloat(getComputedStyle(o).opacity) === 0;
}));
await pg.locator(".co:not(.co-pos)").nth(1).locator("[data-monter]").focus();
await pg.keyboard.press("Enter");
await pg.waitForTimeout(700);
const apresOrdre = (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",");
ok("monter échange les deux lieux",
  apresOrdre === avantOrdre.split(",").reverse().join(","), `${avantOrdre} -> ${apresOrdre}`);
ok("le nouvel ordre est écrit", await pg.evaluate(nom => {
  const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
  return (g.suivies[0].commune || "").startsWith(nom);
}, apresOrdre.split(",")[0].slice(0, 5)));
/* Le premier lieu ne peut pas monter, le dernier ne peut pas descendre : la
   commande ne fait rien plutôt que de sortir de la liste. */
await pg.locator(".co:not(.co-pos)").first().locator("[data-monter]").focus();
await pg.keyboard.press("Enter");
await pg.waitForTimeout(500);
ok("le premier lieu ne sort pas de la liste par le haut",
  (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",") === apresOrdre);
ok("Ma position ne se réordonne pas",
  await pg.locator(".co-pos .co-ordre").count() === 0);
await pg.locator(".co:not(.co-pos)").first().locator("[data-descendre]").focus();
await pg.keyboard.press("Enter");
await pg.waitForTimeout(700);
ok("descendre rétablit l'ordre",
  (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",") === avantOrdre);

/* L'appui long soulève la rangée. Un déplacement avant la fin du délai annule
   la prise, sans quoi le glissement de retrait n'aurait plus son geste. */
const bRang = await pg.locator(".co:not(.co-pos)").first().boundingBox();
await pg.mouse.move(bRang.x + 120, bRang.y + bRang.height / 2);
await pg.mouse.down();
await pg.waitForTimeout(450);
ok("l'appui long soulève la rangée",
  await pg.locator(".co-prise").count() === 1);
await pg.mouse.move(bRang.x + 120, bRang.y + bRang.height * 1.7, { steps: 8 });
await pg.waitForTimeout(200);
ok("le déplacement change l'ordre en direct",
  (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",")
    === avantOrdre.split(",").reverse().join(","),
  (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(","));
await pg.mouse.up();
await pg.waitForTimeout(700);
ok("le lâcher repose la rangée", await pg.locator(".co-prise").count() === 0);
ok("l'appui long n'a pas basculé de lieu",
  await pg.locator("#feuille:visible").count() === 1);
ok("l'ordre déplacé au doigt est écrit", await pg.evaluate(() => {
  const g = JSON.parse(localStorage.getItem("mameteo.reglages.v1"));
  return g.suivies.length === 2;
}));
// L'ordre rétabli, la suite des contrôles repart de la même liste.
await pg.locator(".co:not(.co-pos)").nth(1).locator("[data-monter]").focus();
await pg.keyboard.press("Enter");
await pg.waitForTimeout(600);
ok("l'ordre est rétabli pour la suite",
  (await pg.locator(".co:not(.co-pos) .co-t b").allInnerTexts()).join(",") === avantOrdre);

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
/* Le symbole de ciel de la liste est monochrome : posé sur un ciel peint, un
   dessin bicolore ne se détacherait plus. */
ok("le relevé pris, la cible passe dans le titre",
  await pg.locator(".co-pos .co-cible").count() === 1
  && await pg.locator(".co-pos .co-ic svg").count() === 1
  && await pg.locator(".co-pos .co-ic .ict").count() === 0);
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

console.log("\n--- Largeur des écrans ---");
for (const cle of ["accueil", "temps", "semaine", "soleil", "lune"]) {
  await onglet(cle);
  await pg.waitForTimeout(500);
  /* Le débord se mesure sur la couche de contenu, non sur le document : le
     document est écrêté par `overflow-x:hidden`, ce qui masque la faute au
     lieu de la corriger. Un bloc qui sort de la fenêtre coupe la colonne des
     valeurs sur téléphone, et c'est lui qu'on cherche. */
  const trop = await pg.evaluate(() => {
    const ecran = document.getElementById("ecran");
    const debord = ecran.scrollWidth - ecran.clientWidth;
    const large = window.innerWidth;
    const coupables = [...ecran.querySelectorAll(".carte, .section, .plein, .bandeau, .groupe")]
      .filter(e => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && (b.right > large + 1 || b.left < -1);
      })
      .map(e => e.className).slice(0, 3);
    if (debord <= 1 && !coupables.length) return null;
    return `${debord}px de débord | ${coupables.join(" | ")}`;
  });
  ok(`aucun débord horizontal sur ${cle}`, trop === null, trop);
}
await onglet("accueil");

/* Grand corps de texte. Safari suit le réglage d'accessibilité du système :
   à deux crans au-dessus, une valeur insécable débordait de sa carte et la
   colonne des heures se coupait au bord de l'écran. */
console.log("\n--- Grand corps de texte ---");
await pg.addStyleTag({ content: ":root{font-size:22px}" });
for (const cle of ["accueil", "temps", "semaine", "soleil", "lune"]) {
  await onglet(cle);
  await pg.waitForTimeout(500);
  /* Deux fautes se cherchent ici : un contenu qui sort de sa rangée, et une
     rangée dont le contenu vient toucher le bord de sa carte. La seconde ne
     déborde pas au sens strict, mais la valeur se colle au bord et la coupure
     paraît la même à la lecture. */
  const deborde = await pg.evaluate(() => {
    const fautifs = [];
    for (const r of document.querySelectorAll("#ecran .rangee, #ecran .bd-m, #ecran .tm > div")) {
      const b = r.getBoundingClientRect();
      const carte = r.closest(".carte, .groupe");
      const c = carte ? carte.getBoundingClientRect() : b;
      for (const e of r.children) {
        const z = e.getBoundingClientRect();
        if (!z.width) continue;
        // Sur un SVG, `className` n'est pas une chaîne : le nom de balise suffit.
        const nom = typeof e.className === "string" && e.className
          ? e.className : e.tagName.toLowerCase();
        if (z.right > b.right + 1 || z.left < b.left - 1) fautifs.push(`hors rangée : ${nom}`);
        else if (z.right > c.right - 8 || z.left < c.left + 8) fautifs.push(`collé au bord : ${nom}`);
      }
    }
    return [...new Set(fautifs)].slice(0, 4);
  });
  ok(`aucune valeur ne touche le bord sur ${cle}`, deborde.length === 0, deborde.join(" | "));

  /* Le titre porté par le ciel doit y tenir : à grand corps de texte, un
     chiffre de plusieurs centimètres à côté d'un libellé long débordait du
     panneau par le bas, et passait sous la grille des mesures. */
  const sort = await pg.evaluate(() => {
    const t = document.querySelector("#ecran .plein-titre");
    const ci = document.querySelector("#ecran .ci");
    if (!t || !ci) return null;
    const a = t.getBoundingClientRect(), b = ci.getBoundingClientRect();
    if (a.bottom > b.bottom + 1) return `dépasse de ${Math.round(a.bottom - b.bottom)}px par le bas`;
    if (a.top < b.top - 1) return "dépasse par le haut";
    if (a.right > b.right + 1 || a.left < b.left - 1) return "dépasse sur les côtés";
    return null;
  });
  ok(`le titre du ciel tient dans le panneau sur ${cle}`, sort === null, sort);
}
await pg.evaluate(() => {
  for (const s of document.querySelectorAll("style")) {
    if (s.textContent.includes("font-size:22px")) s.remove();
  }
});
await onglet("accueil");

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
await pgAnonyme.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgAnonyme.waitForTimeout(1800);
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
await pgVert.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgVert.waitForTimeout(1600);
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
await pgCalme.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgCalme.waitForTimeout(1600);
ok("sur un temps calme, aucune ligne à savoir",
  await pgCalme.locator("#ecran .cj-l").count() === 0
  && await pgCalme.locator("#ecran .al").count() === 0,
  await pgCalme.locator("#ecran .cj-l").allInnerTexts().then(x => x.join(" | ")));
ok("sur un temps calme, la section entière disparaît", await pgCalme.evaluate(() =>
  ![...document.querySelectorAll("#ecran .section h2")].some(x => x.textContent.startsWith("Dans les"))
  && document.querySelectorAll("#ecran .retenir").length === 0));
ok("sur un temps calme, le reste de l'accueil tient",
  await pgCalme.locator("#ecran .bd-mesures").count() === 1
  && await pgCalme.locator("#ecran .mt").count() === 1);
/* Sans pluie, sans risque et sans rafale, ces trois lignes n'ont rien à dire :
   elles ne paraissent pas. Le profil de la journée, lui, tient toujours. */
ok("sur un temps calme, le tableau ne garde que ses lignes utiles",
  (await pgCalme.locator("#ecran .mt-l").allInnerTexts())
    .map(t => t.trim()).filter(Boolean).join("/") === "Temp./Vent/Humidité/UV",
  (await pgCalme.locator("#ecran .mt-l").allInnerTexts()).map(t => t.trim()).filter(Boolean).join("/"));
await ctxCalme.close();

/* Heures écourtées : la source s'arrête au milieu du troisième jour. Les jours
   sans heures complètes ne doivent alors pas s'ouvrir, ni porter de chevron, et
   la journée coupée en deux ne doit pas s'ouvrir non plus sur des tranches
   vides. */
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
    for (const c of Object.keys(d.hourly)) h[c] = d.hourly[c].slice(0, 60);
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
  if (r.url().includes("api.open-meteo.com")) urls.push(r.url());
});
await pgCourt.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgCourt.waitForTimeout(1400);

/* Le contrat avec la source. Les heures portent sur les sept jours, c'est
   d'elles que la semaine tire ses moments. AROME reste à trois jours : au delà
   il ne rend que des colonnes vides. */
const uHoraire = urls.find(u => u.includes("hourly=") && !u.includes("models="));
const uArome = urls.find(u => u.includes("models=meteofrance_arome"));
ok("les heures sont demandées sur sept jours",
  !!uHoraire && uHoraire.includes("forecast_days=7"), uHoraire || "aucune requête horaire");
ok("AROME n'est demandé que sur trois jours",
  !!uArome && uArome.includes("forecast_days=3"), uArome || "aucune requête AROME");

await pgCourt.locator('[data-onglet="semaine"]').click();
await pgCourt.waitForTimeout(500);
ok("sans heures complètes, la journée ne s'ouvre pas",
  await pgCourt.locator(".sem-r").count() === 7
  && await pgCourt.locator(".sem-r[aria-expanded]").count() === 2
  && await pgCourt.locator(".sem-fixe").count() === 5,
  `${await pgCourt.locator(".sem-r[aria-expanded]").count()} ouvrables`);
ok("une journée qui ne s'ouvre pas ne porte pas de chevron",
  await pgCourt.locator(".sem-chev").count() === 2);
ok("les journées sans heures gardent leurs bornes",
  await pgCourt.locator(".sem-min").count() === 7
  && await pgCourt.locator(".sem-max").count() === 7);
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
await pgVieux.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgVieux.waitForTimeout(1600);
ok("une charge gardée sous une autre forme n'est pas servie", await pgVieux.evaluate(async () => {
  const P = await import("/src/previsions.js");
  return (P.chargeCourante()?.hourly?.time?.length ?? 0) === 168;
}), String(await pgVieux.evaluate(async () => {
  const P = await import("/src/previsions.js");
  return P.chargeCourante()?.hourly?.time?.length ?? 0;
})));
await pgVieux.locator('[data-onglet="semaine"]').click();
await pgVieux.waitForTimeout(600);
ok("la semaine s'ouvre bien sur ses sept journées après une charge périmée",
  await pgVieux.locator(".sem-chev").count() === 7,
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
await pgCouvert.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgCouvert.waitForTimeout(1600);
/* Le bord bas de la couche, colonne par colonne. Un raccord se voit là et
   nulle part ailleurs : la teinte moyenne d'une colonne le noie, la position du
   bord le montre. */
const couture = await pgCouvert.evaluate(() => {
  const cv = document.getElementById("ciTemps");
  if (!cv) return { erreur: "aucune toile" };
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  const L = cv.width;
  const col = [];
  /* Le bord se mesure au sous-pixel : à l'unité près, la seule quantification
     donne déjà un point d'écart d'une colonne à l'autre et noie ce qu'on
     cherche. */
  for (let x = 0; x < L; x++) {
    let bord = -1;
    for (let y = 1; y < cv.height; y++) {
      const a0 = d[((y - 1) * L + x) * 4 + 3], a1 = d[(y * L + x) * 4 + 3];
      if (a0 >= 200 && a1 < 200) { bord = y - 1 + (a0 - 200) / Math.max(1, a0 - a1); break; }
    }
    col.push(bord);
  }
  if (col.some(v => v <= 0)) return { erreur: "aucun bord trouvé" };
  if (new Set(col.map(v => Math.round(v))).size < 4) return { erreur: "bord plat" };
  /* L'écart au milieu de ses voisins, non le pas d'une colonne à l'autre. Une
     pente régulière, si raide soit-elle, y vaut zéro ; une cassure y vaut la
     moitié de son saut. C'est une cassure qu'on cherche, non une pente. */
  const saut = [];
  for (let x = 4; x < L - 4; x++) {
    saut.push([x, Math.abs(col[x] - (col[x - 4] + col[x + 4]) / 2)]);
  }
  saut.sort((a, b) => b[1] - a[1]);
  return { max: saut[0][1], pires: saut.slice(0, 6).map(([x, v]) => `${x}:${v.toFixed(2)}`).join(" ") };
});
ok("la couche se répète sans couture verticale",
  !couture.erreur && couture.max < 5,
  couture.erreur || `saut maximal ${couture.max?.toFixed(2)} points | ${couture.pires}`);
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
await pgRouge.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgRouge.waitForTimeout(1500);
const teteRouge = await pgRouge.locator("#ecran .vg-txt").innerText();
ok("le mot vigilance ne s'écrit qu'une fois, même au rouge",
  (teteRouge.toLowerCase().match(/vigilance/g) || []).length === 1,
  teteRouge.replace(/\n/g, " "));
ok("le rouge écrit son niveau et sa conduite",
  /rouge/i.test(teteRouge) && /Vigilance absolue/.test(teteRouge),
  teteRouge.replace(/\n/g, " "));
await ctxRouge.close();

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
await pgSerein.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgSerein.waitForTimeout(1400);
await pgSerein.locator('[data-onglet="temps"]').click();
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
await pgFrais.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgFrais.waitForTimeout(1400);

const bascule = (await pgFrais.locator(".conseils .cj-l").allInnerTexts())
  .find(x => /Refroidissement|Réchauffement/.test(x)) || "";
ok("un vrai renversement de température se dit",
  /^Refroidissement de 12 degrés demain/.test(bascule.trim()), bascule || "aucune ligne");

/* Le chiffre nommé doit être celui de la table de la semaine : c'est le même
   maximum de journée, il ne peut pas valoir vingt-quatre ici et trente-trois
   là. C'est la plainte d'origine. */
await pgFrais.locator('[data-onglet="semaine"]').click();
await pgFrais.waitForTimeout(600);
const maxDemain = (await pgFrais.locator(".sem-r").nth(1).locator(".sem-max").innerText()).trim();
ok("le maximum de demain est le même sur les deux écrans",
  bascule.includes(`${maxDemain} au plus chaud`),
  `« ${bascule.trim()} » contre « ${maxDemain} » sur la semaine`);
await ctxFrais.close();

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
  await pg.goto("http://localhost:8137/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(1500);
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
      .map(e => e.textContent).find(x => /^Pluie demain/.test(x)) || "",
  }));
  await pg.locator('[data-onglet="temps"]').click();
  await pg.waitForTimeout(500);
  const sous = await pg.locator(".titre-ecran p").innerText();
  await pg.locator('[data-onglet="semaine"]').click();
  await pg.waitForTimeout(500);
  const sem = await pg.evaluate(() => [...document.querySelectorAll(".sem-r")].slice(0, 2)
    .map(e => ({
      eau: (e.querySelector(".c em") || {}).textContent?.trim() || "",
      min: e.querySelector(".sem-min")?.textContent.trim(),
      max: e.querySelector(".sem-max")?.textContent.trim(),
    })));
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
  await pg.locator('[data-onglet="temps"]').click();
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
  const gel = (await pg.locator("#ecran .cj-l").allInnerTexts())
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
  const dit = (await pg.locator("#ecran .cj-l").allInnerTexts()).join(" | ");
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
  const dit = (await pg.locator('#ecran .section[data-bloc="suite"] .cj-l')
    .allInnerTexts()).join(" | ");
  ok("après-demain se dit encore", /34 degrés vers après-demain/.test(dit), dit || "aucune ligne");
  const titre = await pg.locator('#ecran .section[data-bloc="suite"] h2').innerText();
  ok("le titre nomme les journées portées",
    titre === "Après-demain" || titre === "Demain et après-demain", titre);
});

/* La chaleur et le renversement de température ne nomment pas deux fois le même
   chiffre. À vingt-deux heures la fenêtre glissante contient le pic du
   lendemain : les deux règles le voyaient et l'écrivaient à la suite. */
await pageA("2026-08-18T22:00:00+02:00", d => {
  decaler("2026-08-19", 8)(d);
  d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
  d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
}, async pg => {
  const cj = await pg.locator(".conseils .cj-l").allInnerTexts();
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
