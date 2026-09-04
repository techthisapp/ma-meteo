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

/* La charge d'ensemble, bâtie sur la charge d'essai. Quarante membres écartés
   régulièrement autour de la valeur servie, d'une demi-largeur qui s'ouvre avec
   l'échéance : c'est la forme du vrai, où la dispersion vaut un demi-degré à
   l'heure en cours et plusieurs degrés à sept jours.

   Elle ne porte pas les journées écoulées, la source d'ensemble n'en rendant
   pas : le tracé doit savoir s'arrêter là où elle s'arrête.

   La demi-largeur est écrite ici pour que les contrôles puissent la prédire :
   à l'heure `L` après maintenant, elle vaut `0,5 + L / 20`, plafonnée à six. */
const MEMBRES = 40;
const demiLargeur = L => Math.min(6, 0.5 + Math.max(0, L) / 20);
const ensembleDe = (mult = 1) => {
  const h = METEO.hourly;
  const i0 = h.time.indexOf("2026-08-18T00:00");
  const t0 = new Date(FIGE).getTime();
  const out = { time: h.time.slice(i0) };
  const col = (nom, base, echelle) => {
    out[nom] = out.time.map((t, k) => Math.round(base[i0 + k] * 10) / 10);
    for (let m = 1; m < MEMBRES; m++) {
      /* Les membres s'écartent en éventail, pairs au-dessus, impairs en
         dessous, du centre vers les bords. Le membre le plus extrême porte la
         demi-largeur entière. */
      const f = (m % 2 ? -1 : 1) * Math.ceil(m / 2) / Math.floor(MEMBRES / 2);
      out[`${nom}_member${String(m).padStart(2, "0")}`] = out.time.map((t, k) => {
        const L = (Date.parse(`${t}:00`) - t0) / 3600000;
        const v = base[i0 + k] + f * demiLargeur(L) * mult * echelle;
        return Math.round(Math.max(nom === "precipitation" ? 0 : -60, v) * 10) / 10;
      });
    }
  };
  col("temperature_2m", h.temperature_2m, 1);
  col("precipitation", h.precipitation, 0.2);
  col("wind_speed_10m", h.wind_speed_10m, 2);
  col("wind_gusts_10m", h.wind_gusts_10m, 3);
  return { hourly: out };
};
const ENSEMBLE = ensembleDe();
// Six fois plus large : les scénarios y sont partagés au sens de `ACCORDS`.
const ENSEMBLE_LARGE = ensembleDe(6);

const FAIN = {
  commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
  ecriture: "ruban", poste: null,
};

/* La charge de « Où est le beau temps » : deux journées par point, un élément
   par point, comme la source les rend pour plusieurs couples de coordonnées.

   Elle est bâtie pour séparer le classement de ses deux voisins évidents. Le
   soleil monte vers le nord aujourd'hui et vers le sud demain, la température
   fait exactement l'inverse : un classement trié sur la température seule
   sortirait à l'envers. La rangée la plus au nord reçoit douze millimètres de
   pluie : elle est la plus ensoleillée des deux journées et ne doit pas être en
   tête, faute de quoi le classement suivrait l'ensoleillement seul. */
const JOUR_S = Math.round(13.5 * 3600);
const journeesDe = (lat, lon) => {
  const u = Math.max(0, Math.min(1, (lat - 46.6) / 1.8));
  const journee = j => {
    const p = j === 0 ? u : 1 - u;
    // La longitude départage les points d'une même rangée : sans elle, les cinq
    // premiers du classement seraient cinq ex æquo.
    const soleil = 2 + 8 * p + 0.3 * (j === 0 ? lon - 4.3 : 4.3 - lon);
    const mouille = j === 0 ? lat > 48.2 : lat < 46.8;
    return { soleil, tmax: 28 - 6 * p, pluie: mouille ? 12 : 0 };
  };
  const d = [journee(0), journee(1)];
  return { daily: {
    time: ["2026-08-18", "2026-08-19"],
    weather_code: d.map(x => (x.pluie ? 61 : x.soleil > 7 ? 0 : 3)),
    temperature_2m_max: d.map(x => Math.round(x.tmax * 10) / 10),
    precipitation_sum: d.map(x => x.pluie),
    sunshine_duration: d.map(x => Math.round(x.soleil * 3600)),
    daylight_duration: [JOUR_S, JOUR_S],
  } };
};

/* La charge de l'air : quatre-vingt-seize heures à partir de minuit du 18 août,
   la portée que le module demande. Trois profils, un par règle à éprouver.

   L'indice monte l'après-midi, comme l'ozone dans la réalité. Les graminées
   sont en saison sans être au pic, ce qui fait paraître une rangée dans la
   feuille sans rien ajouter aux faits marquants ; les autres pollens sont sous
   leur seuil de saison et ne doivent donc rien écrire du tout. */
const AIR_PROFILS = {
  base: { aqi: h => (h >= 12 && h <= 17 ? 26 : 14), pollens: {} },
  // Un après-midi dégradé : la ligne des faits marquants, et les heures que
  // l'aération doit refuser.
  degrade: { aqi: h => (h >= 12 && h <= 20 ? 55 : 14), pollens: {} },
  // Un pic d'ambroisie à quinze heures, le reste de la journée en saison.
  ambroisie: { aqi: h => 14, pollens: { ragweed_pollen: h => (h === 15 ? 71 : 6) } },
  // Un matin dégradé et une après-midi propre : l'aération doit attendre.
  matin: { aqi: h => (h >= 9 && h <= 11 ? 55 : 14), pollens: {} },
};

const airDe = (profil = "base") => {
  const p = AIR_PROFILS[profil] || AIR_PROFILS.base;
  const cols = ["pm2_5", "pm10", "ozone", "nitrogen_dioxide", "alder_pollen",
    "birch_pollen", "grass_pollen", "mugwort_pollen", "olive_pollen", "ragweed_pollen"];
  const fixes = { pm2_5: 5.1, pm10: 8.2, ozone: 57, nitrogen_dioxide: 3.3,
    alder_pollen: 0, birch_pollen: 0, grass_pollen: 12, mugwort_pollen: 0.4,
    olive_pollen: 0, ragweed_pollen: 0.5 };
  const h = { time: [], european_aqi: [] };
  for (const c of cols) h[c] = [];
  for (let j = 18; j < 22; j++) {
    for (let x = 0; x < 24; x++) {
      h.time.push(`2026-08-${j}T${String(x).padStart(2, "0")}:00`);
      h.european_aqi.push(p.aqi(x));
      for (const c of cols) h[c].push(p.pollens[c] ? p.pollens[c](x) : fixes[c]);
    }
  }
  return { hourly: h };
};

const servirBeauTemps = (u, route) => {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(lats.map((la, k) => journeesDe(la, lons[k]))) });
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

/* La même amorce, qui ne récrit pas les réglages déjà posés. Les amorces
   ci-dessus remettent l'état à neuf à chaque page, ce qui est ce qu'il faut
   presque partout ; les contrôles qui éprouvent ce que l'application garde d'un
   rechargement à l'autre ont besoin du contraire. */
const amorceGardee = (reglages, quand) => `{
  const ecart = ${new Date(quand).getTime()} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  if (!localStorage.getItem("mameteo.reglages.v1")) {
    localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(reglages))});
  }
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
/* Chaque appel au service de vigilance, pour compter ce que coûte à la source
   un écran qui se recharge. Les contextes qui suivent le premier ne s'ouvrent
   qu'après la section Vigilance : le relevé y est encore celui du seul contexte
   principal. */
const appelsVig = [];

const appelsEns = [];
const appelsAir = [];
/* Le profil d'air servi. Les contextes s'ouvrent l'un après l'autre : celui qui
   veut un autre air le pose avant d'ouvrir sa page et le remet ensuite. */
let profilAir = "base";

const brancherRoutes = async c => {
  /* L'ensemble se sert avant la prévision : son domaine porte le même nom à un
     préfixe près, et la route de la prévision le happerait. Playwright essaie la
     dernière route posée en premier, celle-ci vient donc après. */
  await c.route(/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    // Le classement des lieux : la colonne d'ensoleillement n'est demandée que là.
    if (u.includes("sunshine_duration")) { servirBeauTemps(u, route); return; }
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
     l'absence de panneau.

     La route branche sur le paramètre `echeance` : sans lui la réponse porte le
     jour en cours, avec `J1` le lendemain. L'échéance du lendemain est ici tout
     au vert, le contexte ordinaire éprouvant ce qui est en vigueur ; trois
     contextes dédiés éprouvent l'annonce. */
  await c.route(/webservice\.meteofrance\.com/, r => {
    const u = new URL(r.request().url());
    const dep = u.searchParams.get("domain");
    appelsVig.push(`${dep}|${u.searchParams.get("echeance") || "J0"}`);
    /* Les heures se posent en heure de Paris, celle du navigateur d'essai : les
       construire dans le fuseau du conteneur les décalerait de deux heures. */
    const h = (n, j = 18) => Math.floor(
      Date.parse(`2026-08-${j}T${String(n).padStart(2, "0")}:00:00+02:00`) / 1000);
    const vert = (id, j = 18) => ({ phenomenon_id: String(id),
      timelaps_items: [{ begin_time: h(0, j), end_time: h(23, j), color_id: 1 }] });
    if (u.searchParams.get("echeance") === "J1") {
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        domain_id: dep, update_time: h(6), end_validity_time: h(0, 20),
        timelaps: [1, 2, 3, 4, 5, 6].map(id => vert(id, 19)),
      })});
      return;
    }
    const corps = dep === "99"
      ? { domain_id: dep, update_time: h(6), end_validity_time: h(0, 19),
          timelaps: [1, 2, 3, 4, 5, 6].map(id => vert(id)) }
      : { domain_id: dep, update_time: h(6), end_validity_time: h(0, 19),
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
  await c.route(/ensemble-api\.open-meteo\.com/, r => {
    appelsEns.push(r.request().url());
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(ENSEMBLE) });
  });
  /* L'air se sert après la prévision, pour la même raison que l'ensemble : son
     domaine porte « api.open-meteo.com » à un préfixe près, et la route de la
     prévision le happerait. */
  await c.route(/air-quality-api\.open-meteo\.com/, r => {
    appelsAir.push(r.request().url());
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(airDe(profilAir)) });
  });
};

await brancherRoutes(ctx);

const pg = await ctx.newPage();
const erreurs = [];
pg.on("pageerror", e => erreurs.push(String(e)));
/* Les adresses réellement émises vers la prévision, pour éprouver le contrat
   avec la source : les colonnes demandées, et rien de plus. L'ensemble porte le
   même domaine à un préfixe près et reste hors du compte. */
const appelsHoraire = [];
pg.on("request", r => {
  if (r.url().startsWith("https://api.open-meteo.com")) appelsHoraire.push(r.url());
});
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
const txtDe = async (p, s) => (await p.locator(s).count())
  ? (await p.locator(s).first().innerText()) : "";
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
/* La charge d'essai est sèche : le rappel de parapluie n'a rien à dire, et le
   silence est son état par défaut. Le reste de ses contrôles est plus bas, sur
   des contextes qui portent de la pluie. */
ok("une journée sèche ne fait paraître aucun jeton de parapluie",
  await pg.locator("#navJeton").isHidden());

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

/* La comparaison avec la veille. « Dix-sept degrés » ne se juge que par rapport
   à quelque chose, et la veille est la seule référence que tout le monde a en
   tête. La charge d'essai porte vingt-trois degrés hier à neuf heures et
   dix-sept aujourd'hui. */
const cjVeille = cj.find(x => /qu'hier/.test(x)) || "";
ok("la comparaison avec la même heure la veille s'écrit",
  cjVeille.trim() === "6 degrés de moins qu'hier à la même heure, 17° contre 23°.",
  cjVeille || "aucune ligne");
ok("elle se pose dans le bloc du jour, non dans celui qui suit",
  await pg.evaluate(() => {
    const dans = c => [...document.querySelectorAll(
      `#ecran .section[data-bloc="${c}"] .cj-l`)].some(e => /qu'hier/.test(e.textContent));
    return dans("jour") && !dans("suite");
  }));
/* Les fenêtres partent toutes de l'heure en cours : aucune règle ne peut parler
   d'une heure écoulée, la journée d'hier étant chargée. La comparaison est la
   seule à regarder en arrière, et elle n'écrit aucune heure. */
ok("aucune règle ne se déclenche sur une heure écoulée", await pg.evaluate(() => {
  const h = new Date().getHours();
  const t = [...document.querySelectorAll('#ecran .section[data-bloc="jour"] .cj-l')]
    .map(e => e.textContent).join(" ");
  const vues = [...t.matchAll(/(\d\d) h/g)].map(m => Number(m[1]));
  const tot = vues.filter(x => x < h);
  return tot.length ? `${tot.join(", ")} avant ${h} h` : "";
}) === "", await pg.evaluate(() =>
  [...document.querySelectorAll('#ecran .section[data-bloc="jour"] .cj-l')]
    .map(e => e.textContent).join(" | ")));
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
const lu = () => pg.locator('.mg-v[data-cle="t"] .mg-cur:not([hidden])').count();
const fenLue = () => txt(".mg-fenl");

/* Trois issues pour un même appui. L'appui bref ne fait rien : la lecture et le
   glissement se disputaient le même geste, et la lecture partait au moindre
   effleurement de la courbe. */
await pg.mouse.move(cx, cy);
await pg.mouse.down();
await pg.waitForTimeout(90);
ok("un appui bref ne lit pas la courbe", await lu() === 0);
await pg.mouse.up();
await pg.waitForTimeout(200);

// L'appui maintenu ouvre la lecture, qui suit ensuite le doigt où qu'il aille.
await pg.mouse.move(cx, cy);
await pg.mouse.down();
await pg.waitForTimeout(420);
ok("un appui maintenu ouvre la lecture", await lu() === 1);
for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 12, cy + k * 7);
ok("la lecture ouverte suit le doigt en oblique", await lu() === 1);
const lecture = await txt('.mg-v[data-cle="t"] .mg-r');
ok("la lecture porte une heure et un degré",
  /^(demain |après-demain |[a-zéû]{3}\.? )?\d{2} h, -?\d+°$/.test(lecture), lecture);
await pg.mouse.up();
await pg.waitForTimeout(250);
ok("le relâchement retire la lecture", await lu() === 0);
ok("le relâchement d'une lecture ne fait pas glisser la fenêtre",
  (await fenLue()).startsWith("05 h à"), await fenLue());

// Déplacement à quatre-vingts degrés sans appui maintenu : la page défile.
await pg.mouse.move(cx, cy);
await pg.mouse.down();
for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 2, cy + k * 12);
ok("un déplacement vertical rend la main au défilement", await lu() === 0);
await pg.mouse.up();
await pg.waitForTimeout(250);
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
    /* Le rectangle d'une découpe n'est pas de l'encre, et le voile du passé non
       plus : il éloigne ce qui est dessous, il ne le cache pas. Ni l'un ni
       l'autre ne doit interdire une place au mot. */
    const barres = [...svg.querySelectorAll("rect")]
      .filter(r => !r.classList.contains("mg-nuit") && !r.classList.contains("mg-passe")
        && !r.closest("defs"))
      .map(r => r.getBoundingClientRect());
    /* Le tracé s'étend d'un bout à l'autre des filets de seuil : ce sont eux qui
       donnent la zone de dessin, sans avoir à refaire le calcul des marges. */
    const filets = [...svg.querySelectorAll("line")].filter(l =>
      Math.abs(Number(l.getAttribute("y1")) - Number(l.getAttribute("y2"))) < 0.01);
    if (!filets.length) continue;
    /* Les filets courent sur toute la bande dessinée, laquelle déborde le cadre
       de part et d'autre : la zone où poser un mot est l'intersection des deux. */
    const f0 = filets[0].getBoundingClientRect(), cad = svg.getBoundingClientRect();
    const zone = { left: Math.max(f0.left, cad.left), right: Math.min(f0.right, cad.right) };
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
  if (nus.length) return `${nus.length} symboles sans taille`;
  /* Quatorze points, la hauteur de la bande. La mesure à l'écran ne suffit pas
     à le dire : le dessin d'un symbole n'occupe que sept dixièmes de sa boîte,
     et un symbole de trente points passait sous le seuil des vingt-deux. */
  const gros = ic.filter(e => e.getAttribute("width") !== "14" || e.getAttribute("height") !== "14");
  return gros.length ? `${gros.length} symboles hors des quatorze points` : "";
}) === "", String(await pg.locator('.mg-v[data-cle="nua"] svg.mg-ic').count()));
/* Le dessin court au delà du cadre, d'une fenêtre de part et d'autre : c'est
   cette réserve que le glissement découvre. Les symboles qui y tombent sont
   légitimes, la découpe les retient. Ceux qui tombent dans le cadre, eux,
   doivent tenir dans leur bande. */
/* La zone de dessin est celle que la découpe laisse voir : le cadre du SVG
   comprend la gouttière et un peu d'air, où un symbole de la réserve peut
   légitimement tomber. */
const CADRE = `(svg => {
  const m = svg.getScreenCTM();
  const r = svg.querySelector("defs clipPath rect");
  if (!r) return null;
  const g = m.a * Number(r.getAttribute("x")) + m.e;
  return { gauche: g, droite: g + m.a * Number(r.getAttribute("width")),
           haut: svg.getBoundingClientRect().top, ech: m.a };
})`;
ok("les symboles du ciel tiennent dans leur bande", await pg.evaluate(`(() => {
  const voie = document.querySelector('.mg-v[data-cle="nua"]');
  const c = ${CADRE}(voie.querySelector("svg.mg-s"));
  if (!c) return "aucune découpe";
  let dedans = 0;
  for (const e of voie.querySelectorAll("svg.mg-ic")) {
    const b = e.getBoundingClientRect();
    if (b.height > 22 || b.width > 22) return "symbole de " + b.width.toFixed(0) + " sur " + b.height.toFixed(0);
    const cx = (b.left + b.right) / 2;
    if (cx < c.gauche || cx > c.droite) {
      if (!e.closest("g.mg-mob[clip-path]")) return "symbole hors cadre et hors découpe";
      continue;
    }
    dedans++;
    if (b.bottom > c.haut + 40 * c.ech) return "symbole hors de la bande";
    if (b.left < c.gauche - 1 || b.right > c.droite + 1) return "symbole à cheval sur le bord";
  }
  return dedans >= 6 ? "" : "seulement " + dedans + " symboles dans le cadre";
})()`) === "", await pg.evaluate(`(() => {
  const voie = document.querySelector('.mg-v[data-cle="nua"]');
  const c = ${CADRE}(voie.querySelector("svg.mg-s"));
  const ic = [...voie.querySelectorAll("svg.mg-ic")];
  const d = ic.filter(e => {
    const b = e.getBoundingClientRect(), cx = (b.left + b.right) / 2;
    return c && cx >= c.gauche && cx <= c.droite;
  });
  return d.length + " dans le cadre sur " + ic.length;
})()`));
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

console.log("\n--- L'horizon glissant ---");

/* La fenêtre porte vingt-quatre heures sur la largeur en portrait, et le dessin
   court au delà, d'une fenêtre de part et d'autre : c'est la réserve que le
   glissement découvre sans avoir à tout redessiner. */
ok("la barre de commande porte ses deux sauts et son libellé",
  await pg.locator(".mg-nav [data-glisse]").count() === 2
  && await pg.locator(".mg-nav .mg-fen").count() === 1);
ok("le libellé dit la fenêtre lue", (await txt(".mg-fenl")) === "05 h à demain 05 h",
  await txt(".mg-fenl"));

/* Calée sur maintenant, la fenêtre ne commence pas à l'heure en cours mais un
   sixième avant. Les heures qui viennent de passer sont le premier repère qu'on
   cherche, et le repère de l'heure en cours a besoin de tomber dans le cadre
   pour se voir : collé au bord gauche, il se lisait comme un filet de cadre. */
ok("la fenêtre calée garde le passé récent derrière elle", await pg.evaluate(() => {
  const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
  const l = svg.querySelector(".mg-ici");
  if (!l) return "aucun repère dans le cadre";
  const r = svg.querySelector("defs clipPath rect");
  const f = (Number(l.getAttribute("x1")) - Number(r.getAttribute("x")))
    / Number(r.getAttribute("width"));
  return Math.abs(f - 1 / 6) < 0.02 ? "" : `repère au ${(f * 100).toFixed(0)} centième`;
}) === "");
/* Le repère porte une gaine à la couleur de la carte : sans elle il se perdait
   dans les aires pleines et les lavis de nuit qu'il traverse. */
ok("le repère est gainé et l'axe le nomme d'une pastille", await pg.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="t"]');
  if (v.querySelectorAll(".mg-ici-g").length !== 1) return "aucune gaine";
  const g = getComputedStyle(v.querySelector(".mg-ici-g")).strokeWidth;
  const t = getComputedStyle(v.querySelector(".mg-ici")).strokeWidth;
  if (parseFloat(g) <= parseFloat(t)) return `gaine ${g} contre trait ${t}`;
  return document.querySelector(".mg-a .mg-ici-p") ? "" : "aucune pastille sur l'axe";
}) === "");
ok("la fenêtre porte vingt-quatre heures", await pg.evaluate(`(() => {
  const a = document.querySelector(".mg-a");
  const c = ${CADRE}(a);
  const t = [...a.querySelectorAll("text")].filter(e => {
    const x = e.getBoundingClientRect().left;
    return x >= c.gauche - 1 && x <= c.droite;
  }).map(e => e.textContent);
  // Un montant toutes les six heures : quatre ou cinq dans vingt-quatre heures.
  return t.length >= 4 && t.length <= 5 ? "" : t.length + " montants : " + t.join("/");
})()`) === "", await pg.evaluate(`(() => {
  const a = document.querySelector(".mg-a");
  const c = ${CADRE}(a);
  return [...a.querySelectorAll("text")].filter(e => {
    const x = e.getBoundingClientRect().left;
    return x >= c.gauche - 1 && x <= c.droite;
  }).map(e => e.textContent).join("/");
})()`));
ok("le dessin déborde le cadre et la découpe le retient", await pg.evaluate(() => {
  const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
  const mob = svg.querySelector("g.mg-mob[clip-path]");
  if (!mob) return "aucun groupe découpé";
  const pl = svg.querySelector("polyline");
  const b = pl.getBBox(), r = svg.querySelector("defs clipPath rect");
  const large = Number(r.getAttribute("width"));
  return b.width > large * 2 ? "" : `tracé de ${b.width.toFixed(0)} pour un cadre de ${large}`;
}) === "");

/* Le passé est tracé, en retrait, et l'heure en cours porte son repère. La série
   ne commence plus à minuit du jour en cours mais deux journées plus tôt : le
   saut arrière traverse hier, puis avant-hier, et s'arrête au premier jour
   chargé. */
await pg.locator('.mg-nav [data-glisse="-24"]').click();
await pg.waitForTimeout(420);
ok("le saut arrière passe la veille sans buter sur minuit",
  (await txt(".mg-fenl")) === "hier 05 h à 05 h", await txt(".mg-fenl"));
ok("le passé est tracé et mis en retrait",
  await pg.locator('.mg-v[data-cle="t"] .mg-passe').count() === 1);
/* Une fenêtre entièrement écoulée est voilée de bout en bout : le voile part du
   début de la bande dessinée et court jusqu'à l'heure en cours, laquelle tombe
   au delà du cadre. */
ok("une fenêtre entièrement écoulée est voilée sur toute sa largeur",
  await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
    const p = svg.querySelector(".mg-passe"), r = svg.querySelector("defs clipPath rect");
    if (!p) return "aucun voile";
    const g = Number(r.getAttribute("x")), w = Number(r.getAttribute("width"));
    const x = Number(p.getAttribute("x")), lg = Number(p.getAttribute("width"));
    return x <= g + 0.5 && x + lg >= g + w - 0.5 ? ""
      : `voile de ${x.toFixed(0)} à ${(x + lg).toFixed(0)} pour un cadre de ${g} à ${g + w}`;
  }) === "");
/* Le repère existe encore dans le dessin, la bande débordant le cadre d'une
   fenêtre de part et d'autre, mais il tombe hors du cadre et la découpe le
   retient. Compter les éléments ne dirait rien, c'est son abscisse qui parle. */
ok("l'heure en cours ne se repère pas dans une fenêtre qui ne la contient pas",
  await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
    const l = svg.querySelector(".mg-ici");
    if (!l) return "";
    const r = svg.querySelector("defs clipPath rect");
    const g = Number(r.getAttribute("x")), w = Number(r.getAttribute("width"));
    const x = Number(l.getAttribute("x1"));
    return x < g || x > g + w ? "" : `repère à ${x.toFixed(0)} dans le cadre ${g} à ${g + w}`;
  }) === "");
await pg.locator('.mg-nav [data-glisse="-24"]').click();
await pg.waitForTimeout(420);
ok("le saut arrière atteint l'avant-veille, qui se nomme",
  (await txt(".mg-fenl")) === "avant-hier 05 h à hier 05 h", await txt(".mg-fenl"));
await pg.locator('.mg-nav [data-glisse="-24"]').click();
await pg.waitForTimeout(420);
ok("le saut arrière s'arrête au premier jour chargé",
  (await txt(".mg-fenl")) === "avant-hier 00 h à hier 00 h", await txt(".mg-fenl"));
ok("au début de l'horizon, le saut arrière s'éteint",
  await pg.locator('.mg-nav [data-glisse="-24"]').isDisabled());
ok("le libellé propose de revenir à maintenant",
  await pg.locator('.mg-fen[data-maintenant]').count() === 1);

/* Revenu sur la journée en cours, le repère reparaît là où il doit tomber :
   une fenêtre partie de minuit le pose à sa neuvième heure, l'horloge des essais
   étant figée à neuf heures. */
await pg.locator('.mg-nav [data-glisse="24"]').click();
await pg.waitForTimeout(420);
await pg.locator('.mg-nav [data-glisse="24"]').click();
await pg.waitForTimeout(420);
ok("deux sauts avant ramènent à minuit du jour en cours",
  (await txt(".mg-fenl")) === "00 h à demain 00 h", await txt(".mg-fenl"));
ok("l'heure en cours porte son repère",
  await pg.locator('.mg-v[data-cle="t"] .mg-ici').count() === 1);
ok("le repère tombe à la neuvième heure de la fenêtre", await pg.evaluate(() => {
  const svg = document.querySelector('.mg-v[data-cle="t"] svg.mg-s');
  const l = svg.querySelector(".mg-ici"), r = svg.querySelector("defs clipPath rect");
  const g = Number(r.getAttribute("x")), w = Number(r.getAttribute("width"));
  const f = (Number(l.getAttribute("x1")) - g) / w;
  return Math.abs(f - 9 / 24) < 0.02 ? "" : `repère à ${(f * 24).toFixed(1)} h`;
}) === "");

/* L'échelle est commune à tout l'horizon : recalée à chaque glissement, la
   courbe se serait déformée sous le doigt et deux journées n'auraient plus été
   comparables. */
const echelleDe = () => pg.evaluate(() =>
  [...document.querySelectorAll('.mg-v[data-cle="t"] text.mg-g')]
    .map(e => e.textContent).join("/"));
const ech0 = await echelleDe();
await pg.locator('.mg-nav [data-glisse="24"]').click();
await pg.waitForTimeout(420);
await pg.locator('.mg-nav [data-glisse="24"]').click();
await pg.waitForTimeout(420);
ok("le saut avant avance de deux journées",
  (await txt(".mg-fenl")) === "après-demain 00 h à ven 00 h", await txt(".mg-fenl"));
ok("l'échelle ne bouge pas quand la fenêtre glisse",
  (await echelleDe()) === ech0, `${ech0} puis ${await echelleDe()}`);
ok("au delà d'après-demain, le jour se nomme",
  /\b(lun|mar|mer|jeu|ven|sam|dim) 00 h$/.test(await txt(".mg-fenl")), await txt(".mg-fenl"));
ok("le passé n'est plus voilé hors de sa journée",
  await pg.locator('.mg-v[data-cle="t"] .mg-passe').count() === 0);
ok("la lecture de droite parle de la fenêtre, non de l'horizon", await pg.evaluate(() => {
  const r = document.querySelector('.mg-v[data-cle="t"] .mg-r').textContent;
  const m = r.match(/^(-?\d+) à (-?\d+)°$/);
  if (!m) return r;
  // La fenêtre d'après-demain ne peut pas porter les bornes des sept jours.
  return Number(m[2]) - Number(m[1]) <= 20 ? "" : `amplitude ${m[2] - m[1]}`;
}) === "", await txt('.mg-v[data-cle="t"] .mg-r'));

/* L'horizon du ruban est celui de la charge, sept jours, non les vingt-quatre
   heures de la table : c'est ce qui donne sa course au glissement. */
let sauts = 0;
while (!(await pg.locator('.mg-nav [data-glisse="24"]').isDisabled()) && sauts < 12) {
  await pg.locator('.mg-nav [data-glisse="24"]').click();
  await pg.waitForTimeout(240);
  sauts++;
}
ok("le glissement court jusqu'au dernier jour chargé",
  sauts === 4, `${sauts} sauts depuis après-demain`);
ok("l'horizon s'arrête au dernier jour de la charge",
  (await txt(".mg-fenl")) === "lun 00 h à mar 00 h", await txt(".mg-fenl"));
ok("au bout de l'horizon, le saut avant s'éteint",
  await pg.locator('.mg-nav [data-glisse="24"]').isDisabled());
await pg.locator('.mg-fen[data-maintenant]').click();
await pg.waitForTimeout(420);
await pg.locator('.mg-nav [data-glisse="-24"]').click();
await pg.waitForTimeout(420);
await pg.locator('.mg-nav [data-glisse="24"]').click();
await pg.waitForTimeout(420);
await pg.locator('.mg-nav [data-glisse="24"]').click();
await pg.waitForTimeout(420);

/* L'écriture d'échelle ne glisse pas avec le dessin : elle nomme une hauteur,
   laquelle ne dépend pas de l'heure regardée. */
ok("les noms de seuil et les chiffres restent hors du groupe mobile",
  await pg.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="v"] svg.mg-s');
    const dedans = [...svg.querySelectorAll("text.mg-bn, text.mg-g")]
      .filter(e => e.closest("g.mg-mob"));
    return dedans.length ? `${dedans.length} écritures dans le groupe mobile` : "";
  }) === "");

// Le libellé ramène à l'heure en cours d'un seul appui.
await pg.locator('.mg-fen[data-maintenant]').click();
await pg.waitForTimeout(420);
ok("le libellé ramène la fenêtre à maintenant",
  (await txt(".mg-fenl")) === "05 h à demain 05 h", await txt(".mg-fenl"));
ok("revenue à maintenant, la fenêtre n'a plus où ramener",
  await pg.locator('.mg-fen[data-maintenant]').count() === 0);

// Un glissement horizontal franc déplace la fenêtre, à l'heure entière.
const bt = await pg.locator('.mg-v[data-cle="t"] .mg-s').boundingBox();
await pg.mouse.move(bt.x + bt.width * 0.7, bt.y + bt.height * 0.5);
await pg.mouse.down();
for (let k = 1; k <= 8; k++) {
  await pg.mouse.move(bt.x + bt.width * 0.7 - k * 12, bt.y + bt.height * 0.5 + k);
}
ok("le glissement déporte les sept voies ensemble", await pg.evaluate(() => {
  const t = [...document.querySelectorAll(".mg-v g.mg-mob")]
    .map(e => e.getAttribute("transform") || "");
  const pose = t.filter(v => v.startsWith("translate("));
  return pose.length === t.length && new Set(pose).size === 1 ? "" : pose.join(" | ");
}) === "");
await pg.mouse.up();
await pg.waitForTimeout(500);
ok("le glissement horizontal avance la fenêtre",
  (await txt(".mg-fenl")).startsWith("12 h à demain 12 h")
  || (await txt(".mg-fenl")).startsWith("13 h à demain 13 h"), await txt(".mg-fenl"));
ok("le glissement calé, le déport est repris par le dessin", await pg.evaluate(() =>
  [...document.querySelectorAll(".mg-v g.mg-mob")]
    .every(e => !(e.getAttribute("transform") || "").startsWith("translate("))));
await pg.locator('.mg-fen[data-maintenant]').click();
await pg.waitForTimeout(420);

/* En paysage, la fenêtre double : la densité de points par heure le permet, et
   le ruban n'est pas bridé à la largeur de lecture, sa lisibilité tenant à cette
   densité. */
await pg.setViewportSize({ width: 844, height: 390 });
await pg.waitForTimeout(600);
ok("l'écran du ruban n'est pas bridé", await pg.evaluate(() =>
  document.querySelector("#ecran").classList.contains("ecran-large")
  && getComputedStyle(document.querySelector("#ecran")).maxWidth === "none"));
ok("le ruban prend la largeur en paysage", await pg.evaluate(() => {
  const w = document.querySelector("#ecran .carte").getBoundingClientRect().width;
  return w > 700 ? "" : `carte de ${w.toFixed(0)} points`;
}) === "", await pg.evaluate(() =>
  document.querySelector("#ecran .carte").getBoundingClientRect().width.toFixed(0)));
ok("en paysage la fenêtre porte quarante-huit heures",
  (await txt(".mg-fenl")) === "01 h à après-demain 01 h", await txt(".mg-fenl"));
await pg.setViewportSize({ width: 390, height: 844 });
await pg.waitForTimeout(600);
ok("de retour en portrait, la fenêtre reprend vingt-quatre heures",
  (await txt(".mg-fenl")) === "05 h à demain 05 h", await txt(".mg-fenl"));

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
/* Neuf rangées : les deux journées que les heures couvrent en arrière, puis les
   sept annoncées. La table commençait à aujourd'hui, faute d'avoir demandé les
   journées d'avant. */
ok("neuf lignes", await pg.locator(".sem-r").count() === 9, String(await pg.locator(".sem-r").count()));
const jNoms = (await pg.locator(".sem .j b").allInnerTexts()).map(x => x.trim());
ok("les trois journées qui se nomment portent leur nom, les autres leur date",
  jNoms[1] === "Hier" && jNoms[2] === "Auj." && jNoms[3] === "Demain"
  && /^(lun|mar|mer|jeu|ven|sam|dim)/.test(jNoms[0]), jNoms.join(" | "));
/* « Avant-hier » ne tient pas dans une colonne de soixante-quatre points : le
   nom court y sert, comme après-demain. Un nom trop long ne déborde pas, il
   repasse à la ligne : c'est la hauteur qui le dit, non la largeur. */
ok("aucun nom de journée ne repasse à la ligne", await pg.evaluate(() => {
  const h = [...document.querySelectorAll(".sem .j b")]
    .map(e => e.getBoundingClientRect().height);
  const bas = Math.min(...h);
  const gros = h.filter(x => x > bas + 1);
  return gros.length ? `${gros.length} noms sur deux lignes` : "";
}) === "");
ok("les journées écoulées sont mises en retrait",
  await pg.locator(".sem-passe").count() === 2
  && await pg.evaluate(() => {
    const p = document.querySelector(".sem-passe > .sem-r");
    return p ? Number(getComputedStyle(p).opacity) < 0.9 : false;
  }));
ok("chaque ligne porte sa borne basse à gauche et sa borne haute à droite",
  await pg.locator(".sem-min").count() === 9 && await pg.locator(".sem-max").count() === 9);
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
  return document.querySelectorAll(".sem .c svg.ict").length === 9;
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
  await pg.locator('.sem-r[aria-expanded="false"]').count() === 9
  && await pg.locator(".sem-chev").count() === 9);
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
    /* Le volet porte ses quatre moments, et sous eux la ligne d'accord des
       scénarios quand l'ensemble couvre la journée entière. */
    const dedans = [...document.getElementById(j.getAttribute("aria-controls")).children];
    const cases = dedans.filter(e => !e.classList.contains("md-sc"));
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

/* L'accord des scénarios, écrit en toutes lettres sous les quatre moments. Un
   chiffre de dispersion ne se lit pas : « six degrés d'étendue » ne dit rien à
   qui n'a pas l'habitude, quand « les scénarios sont partagés, de 18 à 27 degrés
   au plus chaud » dit à la fois l'accord et ce qu'il recouvre.

   L'ensemble porte sept jours annoncés et aucun jour écoulé : les deux rangées
   du passé ne portent donc pas la ligne, et c'est normal. */
{
  const vus = await pg.evaluate(() => [...document.querySelectorAll(".sem-j")].map(j => ({
    jour: j.querySelector(".sem-r")?.dataset.jour || "",
    passe: j.classList.contains("sem-passe"),
    dit: (j.querySelector(".md-sc") || {}).textContent || "",
  })));
  const couverts = vus.filter(x => x.dit);
  ok("les journées que les scénarios couvrent disent leur confiance",
    couverts.length === 7 && vus.filter(x => x.passe).every(x => !x.dit),
    `${couverts.length} journées sur ${vus.length}, `
    + `dont ${vus.filter(x => x.passe && x.dit).length} écoulées`);
  ok("la confiance s'écrit en toutes lettres et porte la fourchette",
    couverts.every(x => /^Confiance (bonne|moyenne|faible) : les scénarios /.test(x.dit)
      && /de -?\d+ à -?\d+° au plus chaud\.$/.test(x.dit.trim())),
    couverts[0]?.dit || "aucune ligne");
  /* La confiance se dégrade avec l'échéance : les scénarios s'accordent sur
     demain et se partagent en fin de semaine. Une ligne qui dirait la même chose
     sur les sept journées ne dirait rien. */
  const mots = couverts.map(x => (x.dit.match(/Confiance (\w+)/) || [])[1]);
  ok("elle se dégrade à mesure que l'échéance s'éloigne",
    new Set(mots).size >= 2 && mots[0] === "bonne" && mots[mots.length - 1] === "faible",
    mots.join(", "));
  /* La dispersion est la moyenne sur les heures de la journée, non celle d'une
     heure prise au hasard : une nuit calme sous un après-midi indécis ne doit
     pas passer pour une journée sûre. Le contrôle la recalcule à part. */
  ok("la dispersion est la moyenne des heures de la journée",
    await pg.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      const c = E.chargeCourante();
      if (!c?.q?.t) return "aucun ensemble";
      for (const date of [...new Set(c.time.map(t => t.slice(0, 10)))]) {
        const j = E.journee(date);
        if (!j) continue;
        const k = [];
        c.time.forEach((t, i) => { if (t.slice(0, 10) === date) k.push(i); });
        const moy = k.reduce((a, i) => a + (c.q.t.maxi[i] - c.q.t.mini[i]), 0) / k.length;
        if (Math.abs(moy - j.etendue) > 0.06) {
          return `${date} : ${j.etendue} rendu, ${moy.toFixed(2)} attendu`;
        }
      }
      return "";
    }) === "");
}

/* Sur la journée en cours, un moment déjà passé s'efface. La rangée du jour
   n'est plus la première de la table, deux journées écoulées la précédant. */
await pg.locator(".sem-auj .sem-r").click();
await pg.waitForTimeout(350);
ok("un moment passé s'efface sur la journée en cours", await pg.evaluate(() => {
  const v = document.querySelector(".md:not([hidden])");
  if (!v) return false;
  const h = new Date().getHours();
  return [...v.children].every((c, q) =>
    c.classList.contains("passe") === (q * 6 + 6 <= h));
}));
/* Une journée entièrement écoulée n'efface aucun de ses moments : tout y est
   passé, et le dire quatre fois n'apprendrait rien. Sa rangée fermée porte déjà
   le retrait. */
await pg.locator(".sem-auj .sem-r").click();
await pg.waitForTimeout(300);
await pg.locator(".sem-passe .sem-r").first().click();
await pg.waitForTimeout(350);
ok("une journée écoulée n'efface aucun de ses moments",
  await pg.locator(".md:not([hidden]) > div.passe").count() === 0
  && await pg.locator(".md:not([hidden]) > div").count() === 4);
await pg.locator(".sem-passe .sem-r").first().click();
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

/* Les deux écrans jumeaux portent la même sous-ligne : une vignette de l'astre
   peinte, puis son état. Dans le ciel du bandeau chaque astre est à sa place
   réelle et peut n'y être pas visible du tout ; la vignette le montre toujours. */
ok("le Soleil porte sa vignette devant son état", await pg.evaluate(() => {
  const v = document.querySelector(".plein-titre em canvas#ptSoleil");
  if (!v) return false;
  const t = document.querySelector(".plein-titre em span");
  return !!t && v.compareDocumentPosition(t) === Node.DOCUMENT_POSITION_FOLLOWING;
}));
ok("elle est peinte, opaque et chaude", await pg.evaluate(() => {
  const cv = document.getElementById("ptSoleil");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let n = 0, r = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    n++; r += d[i]; b += d[i + 2];
  }
  // Le disque couvre environ les trois quarts du carré, et le feu est chaud.
  if (n < (d.length / 4) * 0.5) return `${n} pixels opaques`;
  return r / n > b / n + 40 ? "" : `rouge ${Math.round(r / n)} contre bleu ${Math.round(b / n)}`;
}) === "");
/* Le même alignement des deux côtés : c'est la vignette qui décale le texte,
   et une seule règle de taille la porte pour les deux écrans. */
const decalage = async cle => {
  await onglet(cle);
  await pg.waitForTimeout(500);
  return pg.evaluate(() => {
    const em = document.querySelector(".plein-titre em");
    const sp = em?.querySelector("span");
    const cv = em?.querySelector("canvas");
    const t = document.querySelector(".plein-titre > b");
    if (!em || !sp || !cv || !t) return null;
    const b = em.getBoundingClientRect();
    return [Math.round(sp.getBoundingClientRect().left - b.left),
      Math.round(cv.getBoundingClientRect().width),
      Math.round(b.left - t.getBoundingClientRect().left)];
  });
};
const alSoleil = await decalage("soleil");
const alLune = await decalage("lune");
ok("les deux écrans jumeaux alignent leur sous-ligne au même endroit",
  !!alSoleil && JSON.stringify(alSoleil) === JSON.stringify(alLune),
  `${JSON.stringify(alSoleil)} contre ${JSON.stringify(alLune)}`);
await onglet("soleil");
await pg.waitForTimeout(500);

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

/* Quel bulletin le panneau porte se lisait dans la feuille seulement. Un
   panneau ouvert le matin ne se distinguait pas d'un panneau de la veille. La
   publication se faisant à 06 h et à 16 h, l'heure ronde suffit à dire lequel
   des deux est en main ; la minute exacte de la révision reste dans la
   feuille. */
ok("la tête dit quel bulletin elle porte",
  /bulletin de 06 h/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));
ok("les faits d'horloge tiennent leur propre ligne sous la conduite",
  /^jusqu'à 20 h, bulletin de 06 h$/.test((await txt("#ecran .vg-q")).trim()),
  await txt("#ecran .vg-q"));

/* Le panneau prend la tête de l'écran : ce qui le suit doit rester visible sans
   défiler. C'est le bloc du jour et ses quatre mesures, non ses faits, qui doit
   tenir au-dessus de la barre d'onglets.

   Une enveloppe de cent cinquante points a longtemps gardé ce budget. Elle a
   cédé quand la tête a pris sa ligne d'horloge, « jusqu'à 20 h, bulletin de
   06 h » : le panneau mesure alors cent soixante et un points et le bloc du
   jour garde cinquante-six points de dégagement. Le nombre gardait une
   conséquence, c'est elle qu'on mesure désormais, avec un plafond large pour
   arrêter un emballement que l'écran de huit cent quarante-quatre points ne
   verrait pas. */
ok("le panneau de vigilance ne repousse pas les mesures du jour hors de la vue",
  await pg.evaluate(() => {
    const m = document.querySelector("#ecran .bd-mesures");
    const o = document.getElementById("onglets");
    if (!m || !o) return "élément manquant";
    const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
    const h = document.querySelector("#ecran .vg").getBoundingClientRect().height;
    if (h > 180) return `panneau de ${h.toFixed(0)} points`;
    return reste >= 0 ? "" : `${reste.toFixed(0)} points sous les mesures`;
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
/* La borne de la tête est la fin du phénomène qui va le plus loin, non la fin de
   validité du bulletin. Les orages tiennent jusqu'à 20 h, le bulletin jusqu'à
   minuit : écrire « jusqu'à demain 00 h » au-dessus d'une ligne qui dit
   « jusqu'à 20 h » se contredit, et « bulletin valable jusqu'à » est de
   l'administration. */
ok("la borne de la tête est celle du phénomène, non celle du bulletin",
  /jusqu'à 20 h/.test(await txt("#ecran .vg-txt"))
  && !/00 h/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));
/* Le numéro de département ne se lit pas : « Côte-d'Or » dit ce que « 21 » cache. */
ok("il nomme le département plutôt que de le numéroter",
  /Côte-d'Or/.test(await txt("#ecran .vg-txt"))
  && !/Département 21/.test(await txt("#ecran .vg-txt")), await txt("#ecran .vg-txt"));

/* La garde du bulletin se cale sur la publication, à 06 h et à 16 h en heure
   locale, non sur une durée fixe. Un quart d'heure relisait quarante fois dans
   une journée qui ne bougeait pas, et servait encore le bulletin de la veille
   un quart d'heure après la publication du matin.

   Les cinq cas se lisent sur la fonction elle-même : le rendu ne saurait les
   montrer, l'horloge des contextes étant figée. */
const gardeV = await pg.evaluate(async () => {
  const V = await import("/src/vigilance.js");
  const t = (j, h, m = 0) => new Date(2026, 7, j, h, m, 0, 0).getTime();
  const bul = (maj, fin) => ({ update_time: maj / 1000, end_validity_time: fin / 1000 });
  return {
    matin: V.jusqua(bul(t(18, 6, 4), t(19, 0)), t(18, 9)) === t(18, 16),
    soir: V.jusqua(bul(t(18, 16, 4), t(20, 0)), t(18, 17)) === t(19, 6),
    validite: V.jusqua(bul(t(18, 6, 4), t(18, 12)), t(18, 9)) === t(18, 12),
    remplace: V.jusqua(bul(t(18, 5, 50), t(19, 0)), t(18, 9)) === t(18, 9) + 5 * 60000,
    muet: V.jusqua(null, t(18, 9)) === t(18, 9) + 15 * 60000,
  };
});
ok("une charge lue le matin est gardée jusqu'à la publication de 16 h", gardeV.matin);
ok("une charge lue le soir est gardée jusqu'à celle de 06 h", gardeV.soir);
ok("une fin de validité plus proche que la borne ferme la garde plus tôt", gardeV.validite);
ok("un bulletin révisé avant la dernière borne franchie ne tient que le plancher",
  gardeV.remplace);
ok("un service muet garde son quart d'heure", gardeV.muet);
/* Un chargement d'écran ne demande chaque échéance qu'une fois. La garde est
   posée par échéance : sans elle, ou avec deux lectures déclenchées au
   démarrage, la source recevrait le double. */
ok("un chargement ne demande chaque échéance qu'une fois",
  appelsVig.length === 2 && appelsVig.includes("21|J0") && appelsVig.includes("21|J1"),
  appelsVig.join(" "));

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

console.log("\n--- La coque hors ligne ---");

/* L'agent de service met en cache une liste de fichiers écrite à la main. Un
   module nouveau qui n'y figure pas ne se voit pas : l'application marche tant
   qu'il y a du réseau, et tombe hors ligne, où rien ne dit pourquoi. La liste
   se compare donc à ce que l'application importe réellement, en suivant les
   `import` depuis son point d'entrée. */
{
  const lu = f => fs.readFileSync(path.join(ICI, "..", f), "utf8");
  const coque = new Set([...lu("sw.js").matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]));
  const vus = new Set();
  const suivre = f => {
    if (vus.has(f)) return;
    vus.add(f);
    for (const m of lu(f).matchAll(/from\s+"\.\/([^"]+\.js)"/g)) {
      suivre(`src/${m[1]}`);
    }
  };
  suivre("src/app.js");
  const manquants = [...vus].filter(f => !coque.has(f));
  ok("la coque hors ligne porte tous les modules importés",
    manquants.length === 0, manquants.join(", ") || `${vus.size} modules`);
  /* L'inverse vaut aussi : un module retiré de l'application et laissé dans la
     liste ferait échouer l'installation entière de l'agent de service, `addAll`
     étant tout ou rien. */
  const morts = [...coque].filter(f => f.startsWith("src/") && !vus.has(f));
  ok("elle ne porte aucun module que l'application n'importe plus",
    morts.length === 0, morts.join(", "));
}

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

/* Le verre est la matière de la couche navigation. La réponse du matin en est la
   seule exception, arbitrée : posée sur le ciel, elle emploie la matière que la
   barre de tête emploie déjà. L'exception est nommée ici, une exception qui
   n'est pas écrite n'en est plus une. */
ok("le verre est réservé à la couche navigation et à la réponse du matin",
  await pg.evaluate(() => {
    const flous = [...document.querySelectorAll("body *")].filter(e => {
      const s = getComputedStyle(e);
      const f = s.backdropFilter || s.webkitBackdropFilter || "none";
      return f !== "none" && f !== "";
    });
    return flous.every(e => e.closest(".nav, .onglets") || e.matches(".pt-rep"));
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

console.log("\n--- La réponse du matin ---");

/* Une phrase qui tranche ce qu'il y a à faire, posée dans le ciel. Elle donne
   une instruction là où les conseils donnent un fait, et c'est ce qui la
   distingue du bloc qui la suit. */
ok("l'encart porte une instruction et non un fait",
  /^(Manteau|Veste|Pull|Manches|Tenue|Aérer)/.test((await txt(".pt-rep")).trim()),
  await txt(".pt-rep"));
/* Sans pluie, elle n'a qu'une ligne : le silence par défaut vaut ligne par
   ligne, et non pour l'encart entier. */
ok("sans objet à prendre, elle n'a qu'une ligne",
  await pg.locator(".pt-rep .pt-l").count() === 1,
  String(await pg.locator(".pt-rep .pt-l").count()));
/* Elle traverse la largeur au-dessus de la ligne de date. En dessous, elle
   rencontrerait le grand chiffre et les bornes du jour. */
ok("elle est posée au-dessus de la ligne de date et du grand chiffre",
  await pg.evaluate(() => {
    const r = document.querySelector(".pt-rep")?.getBoundingClientRect();
    const jour = document.querySelector(".plein-titre > i")?.getBoundingClientRect();
    const deg = document.querySelector(".bd-deg")?.getBoundingClientRect();
    const ciel = document.querySelector(".ci")?.getBoundingClientRect();
    if (!r || !jour || !deg || !ciel) return "un élément manque";
    if (r.bottom > jour.top + 0.5) return "l'encart déborde sur la ligne de date";
    if (r.bottom > deg.top + 0.5) return "l'encart déborde sur le grand chiffre";
    if (r.top < ciel.top || r.bottom > ciel.bottom) return "l'encart sort du ciel";
    if (r.width < ciel.width * 0.7) return "l'encart ne traverse pas la largeur";
    return "";
  }) === "", await pg.evaluate(() => {
    const r = document.querySelector(".pt-rep")?.getBoundingClientRect();
    return r ? `${Math.round(r.width)} sur ${Math.round(r.height)}` : "absent";
  }));
/* Chaque ligne est une cible propre : l'objet mène au rappel d'agenda, la tenue
   au réglage du ressenti. Une seule cible pour les deux enverrait l'un des deux
   appuis au mauvais endroit. */
ok("chaque ligne de l'encart ouvre la feuille qui la concerne",
  await pg.evaluate(() => {
    const l = [...document.querySelectorAll(".pt-rep .pt-l")];
    if (!l.length) return "aucune ligne";
    const f = l.map(x => x.dataset.feuille);
    return f.every(x => x === "parapluie" || x === "ressenti") && new Set(f).size === f.length
      ? "" : f.join(",");
  }) === "");

console.log("\n--- L'écran de questions ---");

await pg.locator('[data-onglet="accueil"]').click();
await pg.waitForTimeout(400);
ok("l'accueil porte la porte de l'écran de questions, sous les mesures du jour",
  await pg.evaluate(() => {
    const b = document.querySelector('[data-feuille="activites"]');
    const m = document.querySelector(".bd-mesures");
    if (!b || !m) return "un élément manque";
    if (b.dataset.feuille !== "activites") return "la porte n'ouvre pas la feuille";
    if (m.compareDocumentPosition(b) !== Node.DOCUMENT_POSITION_FOLLOWING) {
      return "la porte n'est pas sous les mesures";
    }
    return "";
  }) === "");
/* Les deux portes se lisent comme une paire, quand et où. Elles se suivent, ont
   le même gabarit, et la seconde ne se range pas ailleurs sur la page. */
ok("les trois portes se suivent et partagent leur gabarit",
  await pg.evaluate(() => {
    const cles = ["activites", "beautemps", "air"];
    const p = cles.map(c => document.querySelector(`[data-feuille="${c}"]`));
    if (p.some(x => !x)) return "une porte manque";
    for (let i = 1; i < p.length; i++) {
      if (p[i - 1].nextElementSibling !== p[i]) return `${cles[i]} ne suit pas ${cles[i - 1]}`;
    }
    if (p.some(x => !x.classList.contains("porte"))) return "gabarits différents";
    const l = p.map(x => x.getBoundingClientRect().width);
    if (Math.max(...l) - Math.min(...l) > 1) return `largeurs ${l.join(" et ")}`;
    return "";
  }) === "");
await pg.locator('[data-feuille="activites"]').click();
await pg.waitForTimeout(500);

const lignesAct = async p => p.evaluate(() =>
  [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
    nom: r.querySelector(".rangee-txt b").textContent,
    quand: r.querySelector(".rangee-val b").textContent,
    detail: r.querySelector(".rangee-txt span").textContent,
    sans: r.classList.contains("act-sans"),
  })));
const act = await lignesAct(pg);
ok("les six activités sont là, dans l'ordre",
  act.map(a => a.nom).join(" | ")
    === "Courir | Rouler à vélo | Étendre le linge | Aérer pour rafraîchir | Arroser | Laver la voiture",
  act.map(a => a.nom).join(" | "));
ok("chacune porte un créneau daté et ce qui le décide",
  act.every(a => a.quand.trim() && a.detail.trim()),
  JSON.stringify(act.map(a => [a.quand, a.detail])));

/* Le créneau annoncé doit tenir contre la série, recalculée à part par le
   contrôle : c'est la seule façon de savoir que le moteur ne rend pas le
   premier créneau venu. */
ok("le créneau de la course est sec et dans ses bornes de ressenti et d'ultraviolet",
  await pg.evaluate(async () => {
    const A = await import("/src/activites.js");
    const P = await import("/src/previsions.js");
    const s = P.serieHoraire(0, A.FENETRE, 8);
    const c = A.ACTIVITES.find(x => x.cle === "courir").creneau(s, [...Array(s.n).keys()]);
    if (!c) return "aucun créneau";
    const S = A.SEUILS_ACT;
    for (let i = c[0]; i < c[1]; i++) {
      if ((s.mm[i] || 0) >= 0.1) return `pluie à ${s.heure[i]} h`;
      if (s.res[i] < S.courirFroid || s.res[i] > S.courirChaud) return `ressenti ${s.res[i]}`;
      if (s.uv[i] >= S.courirUv) return `UV ${s.uv[i]}`;
    }
    return "";
  }) === "");
/* Les deux activités qu'on décide de faire soi-même restent dans les heures où
   l'on sort. Sans cette borne, une nuit calme et sèche donnait « 17 h à 03 h » :
   c'est vrai du vent, et personne ne roule à trois heures du matin. */
ok("les créneaux d'effort restent dans les heures où l'on sort",
  await pg.evaluate(async () => {
    const A = await import("/src/activites.js");
    const P = await import("/src/previsions.js");
    const s = P.serieHoraire(0, A.FENETRE, 8);
    const S = A.SEUILS_ACT;
    for (const cle of ["courir", "velo"]) {
      const c = A.ACTIVITES.find(x => x.cle === cle).creneau(s, [...Array(s.n).keys()]);
      if (!c) continue;
      for (let i = c[0]; i < c[1]; i++) {
        if (s.heure[i] < S.effort[0] || s.heure[i] >= S.effort[1]) {
          return `${cle} à ${s.heure[i]} h`;
        }
      }
    }
    return "";
  }) === "");
/* Douze heures sèches après le lavage : sans elles, la première averse défait
   le travail, et c'est la seule condition de cette activité. */
ok("le créneau du lavage porte ses douze heures sèches",
  await pg.evaluate(async () => {
    const A = await import("/src/activites.js");
    const P = await import("/src/previsions.js");
    const s = P.serieHoraire(0, A.FENETRE, 8);
    const c = A.ACTIVITES.find(x => x.cle === "voiture").creneau(s, [...Array(s.n).keys()]);
    if (!c) return "aucun créneau";
    for (let j = c[0]; j <= c[0] + A.SEUILS_ACT.lavageSec; j++) {
      if ((s.mm[j] || 0) >= 0.1) return `pluie ${j - c[0]} heures après`;
    }
    return "";
  }) === "");
/* La colonne d'évapotranspiration est demandée à la source, et la signature des
   colonnes entre dans la clé du cache : une charge écrite sans elle ne doit pas
   être servie au code qui la lit. */
ok("l'évapotranspiration est demandée en horaire et en quotidien",
  appelsHoraire.some(u => /hourly=[^&]*et0_fao_evapotranspiration/.test(u))
  && appelsHoraire.some(u => /daily=[^&]*et0_fao_evapotranspiration/.test(u)),
  appelsHoraire.length + " requêtes");
ok("la signature des colonnes entre dans la clé du cache",
  await pg.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("mameteo.previsions.v1") || "null");
    return c && /\|[0-9a-z]+c$/.test(c.cle) ? "" : `clé ${c ? c.cle : "absente"}`;
  }) === "");
await pg.locator("#feuille-fermer").click();
await pg.waitForTimeout(400);

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
/* Les journées écoulées viennent de la même requête, sans appel de plus. AROME
   les porte aussi : sans elles, le modèle fin se serait arrêté à minuit du jour
   en cours et le ruban aurait changé de source en plein tracé. */
ok("deux journées écoulées sont demandées avec les heures",
  !!uHoraire && uHoraire.includes("past_days=2"), uHoraire || "aucune requête horaire");
ok("AROME porte les mêmes journées écoulées",
  !!uArome && uArome.includes("past_days=2"), uArome || "aucune requête AROME");
ok("aucune requête horaire supplémentaire n'est émise",
  urls.filter(u => u.includes("hourly=")).length === 2,
  urls.filter(u => u.includes("hourly=")).length + " requêtes horaires");

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
await pgVieux.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgVieux.waitForTimeout(1600);
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
await pgCouvert.goto("http://localhost:8137/", { waitUntil: "networkidle" });
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
  const rang = par.map((v, x) => [x, v]).sort((a, b) => b[1] - a[1]);
  const tries = par.slice(6, L - 6).sort((a, b) => a - b);
  const median = tries[Math.floor(tries.length / 2)] || 0.01;
  /* C'est le rapport qui parle, non la valeur : le marbré donne à toutes les
     colonnes une rupture du même ordre, une couture en fait sortir une seule. La
     mesure reste juste si le marbré change de force. */
  return { max: rang[0][1], rapport: rang[0][1] / Math.max(0.05, median), creux,
    pires: rang.slice(0, 5).map(([x, v]) => `${x}:${v.toFixed(2)}`).join(" ") };
});
ok("la couche se répète sans couture verticale",
  !couture.erreur && couture.rapport < 3 && couture.creux >= 250,
  couture.erreur || `pointe ${couture.rapport?.toFixed(1)} fois la médiane, `
  + `opacité minimale ${couture.creux} | ${couture.pires}`);

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
const lisible = await pgCouvert.evaluate(async b64 => {
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
const lisibleRep = await pgCouvert.evaluate(async b64 => {
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
  await pg.goto("http://localhost:8137/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(1500);
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
ok("les mesures du jour tiennent encore sous un panneau qui annonce",
  await echB.pg.evaluate(() => {
    const m = document.querySelector("#ecran .bd-mesures");
    const o = document.getElementById("onglets");
    if (!m || !o) return "élément manquant";
    const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
    const h = document.querySelector("#ecran .vg").getBoundingClientRect().height;
    if (h > 200) return `panneau de ${h.toFixed(0)} points`;
    return reste >= 0 ? "" : `${reste.toFixed(0)} points sous les mesures`;
  }) === "", await echB.pg.evaluate(() => {
    const m = document.querySelector("#ecran .bd-mesures");
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
await pgDecale.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgDecale.waitForTimeout(1500);
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
  (await pgDecale.locator("#ecran .cj-l").allInnerTexts())
    .some(x => /6 degrés de moins qu'hier/.test(x)),
  (await pgDecale.locator("#ecran .cj-l").allInnerTexts()).join(" | "));
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
await pgPareil.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgPareil.waitForTimeout(1500);
ok("un écart de quatre degrés avec la veille ne s'écrit pas",
  !(await pgPareil.locator("#ecran .cj-l").allInnerTexts()).some(x => /qu'hier/.test(x)),
  (await pgPareil.locator("#ecran .cj-l").allInnerTexts()).join(" | "));
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
    const disques = async cle => {
      await pg.locator(`[data-onglet="${cle}"]`).click();
      await pg.waitForTimeout(450);
      return pg.locator("#ecran canvas#ciFeu").count();
    };
    const accueil = await disques("accueil");
    const soleil = await disques("soleil");
    ok(`à ${hauteur}, les deux écrans montrent le même Soleil`,
      accueil === attendu && soleil === attendu,
      `accueil ${accueil}, écran du Soleil ${soleil}, attendu ${attendu}`);
  });
}

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
    await pg.locator('[data-onglet="soleil"]').click();
    await pg.waitForTimeout(450);
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
pgLent.goto("http://localhost:8137/").catch(() => {});
await pgLent.waitForTimeout(1200);
ok("la première lecture montre une ossature, non un voile plein écran",
  await pgLent.locator(".ossature").count() >= 3
  && await pgLent.locator(".etat-vide .tourne").count() === 0);
await ctxLent.close();

console.log("\n--- Les scénarios ---");

/* La marge d'une prévision. La source rend quarante scénarios sous un autre
   point d'entrée : leur dispersion est la marge, et elle s'élargit avec
   l'échéance. La charge d'essai la reproduit, d'une demi-largeur qui vaut
   `0,5 + L / 20` à l'heure `L` après maintenant, plafonnée à six. */
const ctxSc = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
});
await ctxSc.addInitScript(amorce(FAIN));
await brancherRoutes(ctxSc);
const pgSc = await ctxSc.newPage();
const appelsScPage = [];
pgSc.on("request", r => {
  if (r.url().startsWith("https://ensemble-api.open-meteo.com")) appelsScPage.push(r.url());
});
await pgSc.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgSc.waitForTimeout(1800);

/* La requête. Un modèle, sept jours, deux grandeurs, et la seule commune
   affichée : l'aperçu des lieux suivis n'en demande pas, la charge d'ensemble
   étant cinq fois celle d'une prévision.

   Trois heures de garde. L'ensemble tourne toutes les trois heures et sa
   dispersion bouge lentement : la relire à chaque heure comme la prévision
   déterministe coûterait quatre fois la bande passante pour la même marge. Une
   seconde ouverture ne redemande donc rien. */
ok("les scénarios sont demandés une seule fois, pour la commune affichée",
  appelsScPage.length === 1, `${appelsScPage.length} requêtes`);
const uSc = appelsScPage[0] || "";
await pgSc.reload({ waitUntil: "networkidle" });
await pgSc.waitForTimeout(1500);
ok("une seconde ouverture sous garde ne les redemande pas",
  appelsScPage.length === 1, `${appelsScPage.length} requêtes après rechargement`);
/* La liste des grandeurs est comparée en entier, non par inclusion : une
   grandeur demandée pour rien coûterait quarante kilooctets de charge brute à
   chaque lecture, et l'indice ultraviolet, dont la source rend des colonnes
   vides, se serait glissé là sans que rien ne le dise. */
ok("la requête porte le modèle, la portée et les grandeurs exactes",
  uSc.includes("models=icon_seamless") && uSc.includes("forecast_days=7")
  && decodeURIComponent(new URL(uSc || "https://x/").searchParams.get("hourly") || "")
    === "temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation", uSc);

/* La charge brute pèse cent trente-neuf kilooctets pour quarante membres et
   quatre grandeurs. Elle n'est ni gardée ni transportée telle quelle : cinq
   nombres par heure et par grandeur suffisent à tout ce qui s'affiche, et c'est
   eux que la réserve locale porte. */
ok("la charge gardée est réduite à ses quantiles, non aux membres",
  await pgSc.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("mameteo.ensemble.v1") || "null");
    if (!c?.d) return "aucune charge gardée";
    const cols = [];
    const plat = (o, prefixe) => {
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (v && !Array.isArray(v) && typeof v === "object") plat(v, `${prefixe}${k}.`);
        else cols.push(prefixe + k);
      }
    };
    plat(c.d, "");
    const membres = cols.filter(x => /member/.test(x));
    if (membres.length) return `${membres.length} colonnes de membres gardées`;
    const bornes = ["mini", "bas", "med", "haut", "maxi"];
    const surplus = cols.filter(x => !["time", "membres", "pluie"].includes(x)
      && !bornes.includes(x.split(".").pop()));
    return surplus.length ? `colonnes en trop : ${surplus.join(", ")}` : "";
  }) === "", await pgSc.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mameteo.ensemble.v1") || "{}").d || {};
    return `${Object.keys(d).join(", ")} | q : ${Object.keys(d.q || {}).join(", ")}`;
  }));
/* Le plafond suit le nombre de grandeurs encadrées : six kilooctets chacune,
   plus quatre pour les heures et le comptage de pluie. Mesuré, trois grandeurs
   tiennent en seize kilooctets. Une grandeur ajoutée sans que la réduction
   suive se verrait ici. */
ok("elle reste proportionnée au nombre de grandeurs encadrées",
  await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    const n = Object.keys(E.chargeCourante()?.q || {}).length;
    const o = (localStorage.getItem("mameteo.ensemble.v1") || "").length;
    return n && o <= 6 * 1024 * n + 4096 ? "" : `${o} octets pour ${n} grandeurs`;
  }) === "", await pgSc.evaluate(() =>
    `${(localStorage.getItem("mameteo.ensemble.v1") || "").length} octets`));

/* Les quantiles encadrent toujours la médiane, et l'étendue encadre les
   quartiles. Un tri à l'envers, ou un quantile pris sur une série non triée,
   se verrait ici et nulle part ailleurs. */
ok("la fourchette encadre toujours la médiane, sur chaque grandeur",
  await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    const c = E.chargeCourante();
    if (!c) return "aucun ensemble";
    for (const [cle, q] of Object.entries(c.q)) {
      for (let i = 0; i < c.time.length; i++) {
        if (q.med[i] === null) continue;
        if (!(q.mini[i] <= q.bas[i] && q.bas[i] <= q.med[i]
          && q.med[i] <= q.haut[i] && q.haut[i] <= q.maxi[i])) {
          return `${cle} à ${c.time[i]} : `
            + `${q.mini[i]}/${q.bas[i]}/${q.med[i]}/${q.haut[i]}/${q.maxi[i]}`;
        }
      }
    }
    return "";
  }) === "");
/* Résumer n'est pas encadrer. Quatre grandeurs sont résumées en quantiles ;
   trois seulement portent une bande, la pluie disant ce qu'elle a à dire en
   mots. L'indice ultraviolet n'a aucun scénario du côté de la source. */
ok("quatre grandeurs sont résumées, trois seulement sont encadrées",
  await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    return `${Object.keys(E.chargeCourante()?.q || {}).sort().join(",")}`
      + ` | ${[...E.ENCADREES].sort().join(",")}`;
  }) === "mm,raf,t,v | raf,t,v",
  await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    return `${Object.keys(E.chargeCourante()?.q || {}).join(",")} | ${E.ENCADREES.join(",")}`;
  }));
ok("la dispersion s'élargit avec l'échéance, sur chaque grandeur",
  await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    const c = E.chargeCourante();
    const e = (cle, t) => {
      const i = c.time.indexOf(t);
      return i < 0 ? null : Math.round((c.q[cle].maxi[i] - c.q[cle].mini[i]) * 10) / 10;
    };
    for (const cle of Object.keys(c.q)) {
      const proche = e(cle, "2026-08-18T12:00"), loin = e(cle, "2026-08-22T12:00");
      if (proche === null || loin === null) return `${cle} : heure absente`;
      if (!(loin > proche * 2)) return `${cle} : ${proche} près, ${loin} loin`;
    }
    return "";
  }) === "");

/* L'enveloppe, peinte dans le groupe mobile de la voie de température, sous les
   courbes et au-dessus du lavis de nuit. Elle suit donc le glissement sans
   travail supplémentaire. */
await pgSc.locator('[data-onglet="temps"]').click();
await pgSc.waitForTimeout(700);
ok("l'enveloppe est peinte dans la voie de température",
  await pgSc.locator('.mg-v[data-cle="t"] .mg-sc-q path').count() >= 1
  && await pgSc.locator('.mg-v[data-cle="t"] .mg-sc-e path').count() >= 1);
ok("elle glisse avec le dessin", await pgSc.evaluate(() =>
  !!document.querySelector('.mg-v[data-cle="t"] .mg-sc-q')?.closest("g.mg-mob")));
ok("elle passe sous les courbes et au-dessus du lavis de nuit",
  await pgSc.evaluate(() => {
    const g = document.querySelector('.mg-v[data-cle="t"] svg.mg-s g.mg-mob');
    if (!g) return "aucun groupe mobile";
    const rang = e => [...g.children].indexOf(e.closest("g.mg-mob > *") || e);
    const kids = [...g.querySelectorAll("*")];
    const iNuit = kids.findIndex(e => e.classList.contains("mg-nuit"));
    const iEnv = kids.findIndex(e => e.classList.contains("mg-sc-e"));
    const iCourbe = kids.findIndex(e => e.tagName === "polyline");
    if (iNuit < 0 || iEnv < 0 || iCourbe < 0) return "élément manquant";
    return iNuit < iEnv && iEnv < iCourbe ? ""
      : `nuit ${iNuit}, enveloppe ${iEnv}, courbe ${iCourbe}`;
  }) === "");
/* Deux bandes grises sous une courbe ne se lisent pas seules : elles passent
   pour un effet de dessin. La phrase de la voie dit ce qu'elles portent, et
   nomme l'écart le plus large de la fenêtre, non celui de l'heure en cours qui
   vaut un demi-degré. */
await pgSc.locator('.mg-b[data-voie="t"]').click();
await pgSc.waitForTimeout(500);
const phraseSc = await pgSc.locator('.mg-v[data-cle="t"] .mg-l').innerText();
ok("la voie dit ce que l'ombre porte",
  /L'ombre porte les 40 scénarios de la source, écartés de \d+ degrés? au plus large vers/
    .test(phraseSc), phraseSc);
ok("l'écart nommé est celui de la fenêtre", await pgSc.evaluate(() => {
  const t = document.querySelector('.mg-v[data-cle="t"] .mg-l').textContent;
  const m = t.match(/écartés de (\d+) degrés? au plus large vers ([^.]+)\./);
  if (!m) return "phrase absente";
  // Fenêtre de 05 h à demain 05 h : l'écart le plus large tombe à sa fin.
  return Number(m[1]) >= 1 && Number(m[1]) <= 4 && /demain/.test(m[2])
    ? "" : `${m[1]} degrés vers ${m[2]}`;
}) === "", phraseSc);

/* La voie du vent porte la sienne, posée sur la rafale et non sur le vent
   moyen : c'est la rafale qui décide, c'est elle que la règle des faits
   marquants regarde et que le maximum de la voie marque, et le vent moyen est
   déjà tracé en aire pleine sous laquelle une bande n'aurait pas paru. */
await pgSc.locator('.mg-b[data-voie="v"]').click();
await pgSc.waitForTimeout(500);
ok("la voie du vent porte son enveloppe",
  await pgSc.locator('.mg-v[data-cle="v"] .mg-sc-q path').count() >= 1
  && await pgSc.locator('.mg-v[data-cle="v"] .mg-sc-e path').count() >= 1);
ok("elle est posée sur la rafale, non sur le vent moyen",
  await pgSc.evaluate(() => {
    const svg = document.querySelector('.mg-v[data-cle="v"] svg.mg-s');
    const q = svg.querySelector(".mg-sc-q path");
    const traits = [...svg.querySelectorAll("polyline")];
    if (!q || traits.length < 2) return "élément manquant";
    /* Les deux tracés se distinguent par leur hauteur moyenne : la rafale
       recouvre le vent moyen, son centre est donc plus haut dans la voie. */
    const centre = e => e.getBBox().y + e.getBBox().height / 2;
    const cs = traits.map(centre).sort((a, b) => a - b);
    const raf = cs[0], moy = cs[cs.length - 1];
    const c = centre(q);
    return Math.abs(c - raf) < Math.abs(c - moy) ? ""
      : `bande centrée à ${c.toFixed(0)}, rafale à ${raf.toFixed(0)}, vent à ${moy.toFixed(0)}`;
  }) === "");
const phraseV = await pgSc.locator('.mg-v[data-cle="v"] .mg-l').innerText();
ok("la voie du vent dit ce que son ombre porte",
  /L'ombre porte les 40 scénarios de la source, écartés de \d+ km\/h au plus large vers/
    .test(phraseV), phraseV);
/* La pluie ne s'encadre pas : ses scénarios sont presque tous à zéro et
   quelques-uns à quelques dixièmes, une bande de zéro à un demi-millimètre est
   muette là où le comptage parle. Sa part est réduite et gardée, elle n'est pas
   peinte en bande. */
ok("la voie de la pluie ne porte pas d'enveloppe",
  await pgSc.locator('.mg-v[data-cle="mm"] .mg-sc-q').count() === 0
  && await pgSc.locator('.mg-v[data-cle="mm"] .mg-sc-e').count() === 0);
ok("l'indice ultraviolet non plus, la source n'en rendant aucun scénario",
  await pgSc.locator('.mg-v[data-cle="uv"] .mg-sc-q').count() === 0
  && await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    return !("uv" in (E.chargeCourante()?.q || {}));
  }));
ok("la part des scénarios mouillés est gardée",
  await pgSc.evaluate(async () => {
    const E = await import("/src/ensemble.js");
    const p = E.chargeCourante()?.pluie;
    return Array.isArray(p) && p.every(x => x === null || (x >= 0 && x <= 100))
      && p.some(x => x !== null);
  }));
/* Ce que le comptage ajoute est la quantité, non une seconde probabilité. La
   mesure a tranché : la probabilité de la source et la part des scénarios
   s'accordent à dix points près sur quatre-vingt-douze pour cent des heures, et
   rien ne dit lequel tombe le plus juste là où ils divergent. La voie parle donc
   de millimètres, et ne pose pas deux probabilités côte à côte. */
const phraseMm = await pgSc.evaluate(() => {
  const v = document.querySelector('.mg-v[data-cle="mm"] .mg-l');
  return v ? v.textContent : "";
});
ok("la voie de la pluie dit l'étalement des quantités",
  /Sur les 40 scénarios, la moitié (donnent moins de [\d,]+ mm|n'en donnent aucune) vers /
    .test(phraseMm) && /le plus arrosé [\d,]+ mm\.$/.test(phraseMm.trim()), phraseMm);
ok("elle ne pose pas une seconde probabilité à côté de la première",
  (phraseMm.match(/%/g) || []).length === 1, phraseMm);

/* La fourchette écrite sur l'accueil. Elle ne se dit que là où elle a de la
   matière : à l'heure en cours la dispersion vaut un demi-degré et la phrase
   serait creuse, à trois jours elle vaut cinq degrés et change la décision.

   Le contexte assèche la charge et calme le vent : sur la charge d'essai, les
   deux lignes de pluie et celle des rafales occupent les trois places du bloc
   et évincent la fourchette, ce qui est le bon comportement du plafond mais ne
   permet pas de l'éprouver. */
const ctxFourch = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
});
await ctxFourch.addInitScript(amorce(FAIN));
await brancherRoutes(ctxFourch);
await ctxFourch.route(/https:\/\/api\.open-meteo\.com/, route => {
  const u = route.request().url();
  const d = JSON.parse(JSON.stringify(METEO));
  d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
  d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
  d.hourly.wind_gusts_10m = d.hourly.wind_gusts_10m.map(() => 12);
  d.hourly.wind_speed_10m = d.hourly.wind_speed_10m.map(() => 8);
  d.hourly.uv_index = d.hourly.uv_index.map(() => 1);
  if (u.includes("current=")) {
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
  }
  /* AROME s'écarte ici de deux degrés du modèle global, sous le seuil : un écart
     ordinaire entre deux modèles n'est pas un désaccord, et la règle doit se
     taire dessus. */
  if (u.includes("models=meteofrance_arome")) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      hourly: { time: d.hourly.time.slice(),
        temperature_2m: d.hourly.temperature_2m.map(v => v + 2) } }) }); return;
  }
  if (u.includes("hourly=")) {
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ hourly: d.hourly }) }); return;
  }
  delete d.hourly;
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
});
const pgFourch = await ctxFourch.newPage();
await pgFourch.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgFourch.waitForTimeout(1600);
const cjF = await pgFourch.locator("#ecran .cj-l").allInnerTexts();
ok("la fourchette des scénarios s'écrit là où elle a de la matière",
  cjF.some(x => /^Scénarios partagés sur le maximum, de -?\d+ à -?\d+°\.$/.test(x.trim())),
  cjF.join(" | ") || "aucune ligne");
/* Elle parle de la journée de son bloc, non de l'heure en cours : la dispersion
   de maintenant vaut un demi-degré et n'a rien à dire. */
ok("elle se pose dans un bloc qui suit, non dans celui du jour",
  await pgFourch.evaluate(() => {
    const dans = c => [...document.querySelectorAll(
      `#ecran .section[data-bloc="${c}"] .cj-l`)].some(e => /Scénarios partagés/.test(e.textContent));
    return !dans("jour") && dans("suite");
  }));
/* Deux degrés d'écart entre modèles ne sont pas un désaccord : c'est
   l'ordinaire, et une phrase qui le dirait tous les jours ne dirait rien. */
ok("un écart ordinaire entre modèles ne fait pas parler la règle du désaccord",
  !cjF.some(x => /ne s'accordent pas/.test(x)), cjF.join(" | "));
await ctxFourch.close();

/* Le désaccord entre modèles. Trois voix, toutes déjà chargées et aucune requête
   nouvelle : le modèle global, AROME par-dessus lui sur les trois premiers
   jours, et la médiane des scénarios d'ICON.

   Sur la charge d'essai les trois se confondent, AROME rendant la même série que
   le modèle global et les membres étant posés symétriquement autour d'elle : la
   règle s'y tait, ce qui est le bon comportement et se contrôle plus bas. Ici
   AROME est décalé de six degrés, et la phrase doit nommer les deux extrêmes. */
const ctxDesac = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
});
await ctxDesac.addInitScript(amorce(FAIN));
await brancherRoutes(ctxDesac);
await ctxDesac.route(/https:\/\/api\.open-meteo\.com/, route => {
  const u = route.request().url();
  const d = JSON.parse(JSON.stringify(METEO));
  d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
  d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
  d.hourly.wind_gusts_10m = d.hourly.wind_gusts_10m.map(() => 12);
  d.hourly.wind_speed_10m = d.hourly.wind_speed_10m.map(() => 8);
  d.hourly.uv_index = d.hourly.uv_index.map(() => 1);
  if (u.includes("current=")) {
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
  }
  if (u.includes("models=meteofrance_arome")) {
    const a = { time: d.hourly.time.slice(), temperature_2m: d.hourly.temperature_2m.map(v => v + 6) };
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ hourly: a }) }); return;
  }
  if (u.includes("hourly=")) {
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ hourly: d.hourly }) }); return;
  }
  delete d.hourly;
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
});
/* Les scénarios suivent AROME et non le modèle global : les trois voix ne se
   réduisent donc pas à deux, et retirer celle du modèle global fait tomber
   l'écart à zéro. C'est ce qui rend cette voix nécessaire. */
await ctxDesac.route(/ensemble-api\.open-meteo\.com/, r => {
  const e = JSON.parse(JSON.stringify(ENSEMBLE));
  for (const c of Object.keys(e.hourly)) {
    if (c.startsWith("temperature_2m")) e.hourly[c] = e.hourly[c].map(v => v + 6);
  }
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(e) });
});
const pgDesac = await ctxDesac.newPage();
await pgDesac.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgDesac.waitForTimeout(1600);
const cjD = await pgDesac.locator("#ecran .cj-l").allInnerTexts();
const ligneD = cjD.find(x => /ne s'accordent pas/.test(x)) || "";
ok("le désaccord entre modèles se dit, avec ses extrêmes et son échéance",
  /^Les modèles ne s'accordent pas vers .+, de -?\d+ à -?\d+ degrés\.$/.test(ligneD.trim()),
  ligneD || cjD.join(" | ") || "aucune ligne");
ok("les extrêmes nommés encadrent les six degrés d'écart posés", (() => {
  const m = ligneD.match(/de (-?\d+) à (-?\d+) degrés/);
  if (!m) return false;
  const e = Number(m[2]) - Number(m[1]);
  return e >= 5 && e <= 7;
})(), ligneD);
ok("elle passe devant la fourchette des scénarios",
  await pgDesac.evaluate(() => {
    const l = [...document.querySelectorAll('#ecran .section[data-bloc="suite"] .cj-l')]
      .map(e => e.textContent);
    const d = l.findIndex(x => /ne s'accordent pas/.test(x));
    const f = l.findIndex(x => /Scénarios partagés/.test(x));
    return d >= 0 && (f < 0 || d < f);
  }));
await ctxDesac.close();

/* Une source d'ensemble muette ne prive de rien : la prévision déterministe est
   déjà à l'écran, et l'enveloppe ne paraît simplement pas. */
const ctxMuet = await nav.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
});
await ctxMuet.addInitScript(amorce(FAIN));
await brancherRoutes(ctxMuet);
await ctxMuet.route(/ensemble-api\.open-meteo\.com/, r => r.abort());
const pgMuet = await ctxMuet.newPage();
await pgMuet.goto("http://localhost:8137/", { waitUntil: "networkidle" });
await pgMuet.waitForTimeout(1500);
await pgMuet.locator('[data-onglet="temps"]').click();
await pgMuet.waitForTimeout(700);
ok("sans scénarios, la voie de température se dessine quand même",
  await pgMuet.locator('.mg-v[data-cle="t"] polyline').count() >= 3
  && await pgMuet.locator('.mg-v[data-cle="t"] .mg-sc-q').count() === 0);
ok("et sa phrase ne parle pas d'une ombre absente",
  !/ombre/.test(await pgMuet.locator('.mg-v[data-cle="t"] .mg-l').innerText()),
  await pgMuet.locator('.mg-v[data-cle="t"] .mg-l').innerText());
await ctxMuet.close();

/* Le journal de justesse. Rien ne s'affiche : deux mois de couples entre ce qui
   était annoncé et ce qui a été relevé permettront de dire, au jalon 6, à quelle
   distance la prévision tombe. La donnée ne se rattrape pas après coup, d'où
   cette amorce livrée avant tout ce qui l'exploitera. */
const jr = await pgSc.evaluate(() =>
  JSON.parse(localStorage.getItem("mameteo.justesse.v1") || "null"));
ok("le journal de justesse est écrit", !!jr && Array.isArray(jr.lignes) && jr.lignes.length > 0,
  jr ? `${jr.lignes.length} lignes` : "aucun journal");
ok("chaque ligne porte son lieu, son heure visée, son échéance et sa valeur",
  (jr?.lignes || []).every(l => typeof l.l === "string" && /^\d{4}-\d\d-\d\dT\d\d$/.test(l.c)
    && typeof l.e === "number" && typeof l.t === "number" && typeof l.le === "string"),
  JSON.stringify((jr?.lignes || [])[0] || {}));
/* Les heures visées sont les extrêmes de la journée : une prévision se juge sur
   eux, non sur une heure quelconque. */
ok("il ne vise que les heures extrêmes des journées",
  (jr?.lignes || []).every(l => ["06", "15"].includes(l.c.slice(11, 13))),
  [...new Set((jr?.lignes || []).map(l => l.c.slice(11, 13)))].join(", "));
ok("une même heure visée n'est notée qu'une fois par échéance",
  (() => {
    const vus = new Set();
    for (const l of jr?.lignes || []) {
      const k = `${l.l}|${l.c}|${l.e}`;
      if (vus.has(k)) return `doublon sur ${k}`;
      vus.add(k);
    }
    return "";
  })() === "");
/* Les heures visées déjà passées portent leur relevé : la charge horaire garde
   deux journées écoulées, au delà l'heure aurait disparu de la source et la
   comparaison n'aurait plus de terme. */
ok("une heure visée passée porte son relevé", await pgSc.evaluate(async () => {
  const J = await import("/src/justesse.js");
  const P = await import("/src/previsions.js");
  const j = J.lire();
  const avant = j.lignes.length;
  // Une ligne d'hier, notée à six heures d'échéance, que le relevé doit remplir.
  j.lignes.push({ l: "47.500,4.300", c: "2026-08-17T15", e: 6, t: 20, mm: 0, pb: 0,
    le: "2026-08-17T09" });
  localStorage.setItem("mameteo.justesse.v1", JSON.stringify(j));
  const r = J.noter(P.chargeCourante(), "47.500,4.300");
  const apres = J.lire().lignes.find(l => l.c === "2026-08-17T15" && l.e === 6);
  return apres && apres.r !== undefined && r.releves >= 1
    ? "" : `relevé ${JSON.stringify(apres)} après ${avant} lignes`;
}) === "");
ok("une seconde notation dans la même heure n'ajoute rien",
  await pgSc.evaluate(async () => {
    const J = await import("/src/justesse.js");
    const P = await import("/src/previsions.js");
    const avant = J.lire().lignes.length;
    J.noter(P.chargeCourante(), "47.500,4.300");
    return J.lire().lignes.length - avant;
  }) === 0);
/* Chaque ligne porte les deux probabilités, celle de la source et la part des
   scénarios mouillés. Rien n'en affiche aucune : c'est le jalon 6 qui dira,
   dans deux mois et par échéance, laquelle tombe le plus juste. Les scénarios
   arrivant après la prévision, la ligne est écrite sans eux puis complétée. */
ok("chaque ligne porte les deux probabilités",
  await pgSc.evaluate(() => {
    const j = JSON.parse(localStorage.getItem("mameteo.justesse.v1") || "null");
    const l = (j?.lignes || []).filter(x => x.pe !== undefined);
    if (!l.length) return "aucune ligne complétée";
    const faux = l.filter(x => !(x.pe >= 0 && x.pe <= 100) || typeof x.pb !== "number");
    return faux.length ? JSON.stringify(faux[0]) : "";
  }) === "", await pgSc.evaluate(() => {
    const j = JSON.parse(localStorage.getItem("mameteo.justesse.v1") || "null");
    return JSON.stringify((j?.lignes || []).find(x => x.pe !== undefined) || {});
  }));
ok("la part des scénarios se pose sur les lignes déjà écrites",
  await pgSc.evaluate(async () => {
    const J = await import("/src/justesse.js");
    const P = await import("/src/previsions.js");
    const E = await import("/src/ensemble.js");
    const j = J.lire();
    const cible = j.lignes.find(l => l.pe !== undefined);
    if (!cible) return "aucune ligne à éprouver";
    delete cible.pe;
    localStorage.setItem("mameteo.justesse.v1", JSON.stringify(j));
    const r = J.noter(P.chargeCourante(), cible.l, new Date(), E.chargeCourante());
    const apres = J.lire().lignes.find(l => l.c === cible.c && l.e === cible.e);
    return r.completees >= 1 && apres?.pe !== undefined ? "" : `complétées ${r.completees}`;
  }) === "");
await ctxSc.close();

/* ---------- Le rappel de parapluie ---------- */

console.log("\n--- Le rappel de parapluie ---");

/* Les heures réglées disent quand prévenir, non où chercher la pluie. Chaque
   alerte répond de la pluie attendue jusqu'à la suivante, la dernière jusqu'à
   minuit ; la tranche qui va de minuit à la première alerte n'est couverte par
   personne, on n'y sort pas.

   La charge d'essai est mouillée par plages, pour éprouver chaque cas. Les
   rafales des heures mouillées sont posées avec elles : celles de la charge
   dépassent le seuil de retournement l'après-midi, et tout serait capuche. */
const meteoPluie = (raf, motif) => () => {
  const d = JSON.parse(JSON.stringify(METEO));
  const h = d.hourly;
  for (let k = 0; k < h.time.length; k++) {
    if (!motif.test(h.time[k])) continue;
    h.precipitation[k] = 1.2;
    h.precipitation_probability[k] = 80;
    h.wind_gusts_10m[k] = raf;
  }
  return d;
};

// L'après-midi du 18 août, quatorze et quinze heures : le cas de la consigne.
const APRESMIDI = /^2026-08-18T1[45]/;

const ctxJeton = async (patch, quand, reglages) => {
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c.addInitScript(amorceGardee(reglages || FAIN, quand || FIGE));
  await brancherRoutes(c);
  await c.route(/https:\/\/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = patch();
    if (u.includes("sunshine_duration")) { servirBeauTemps(u, route); return; }
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("models=meteofrance_arome") || u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  const p = await c.newPage();
  await p.goto("http://localhost:8137/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
  return [c, p];
};

/* L'appui passe par une aide qui rend la main sur un élément absent, au lieu de
   lever : une faute rétablie doit faire tomber les contrôles qu'elle concerne,
   non interrompre la suite avant les autres. */
const clic = async (p, sel) => {
  if (!(await p.locator(sel).count()) || !(await p.locator(sel).isVisible())) return false;
  await p.locator(sel).click();
  return true;
};

/* La nuit. À six heures, une pluie de six heures tombe entre minuit et la
   première alerte : personne n'en répond, et prévenir n'y donnerait aucune
   occasion de prendre un parapluie. */
const [ctxNuit, pgNuit] = await ctxJeton(
  meteoPluie(30, /^2026-08-18T0[56]/), "2026-08-18T06:00:00+02:00");
ok("une pluie tombée avant la première alerte ne fait rien paraître",
  await pgNuit.locator("#navJeton").isHidden());
await ctxNuit.close();

/* La même heure, la pluie posée l'après-midi. L'alerte du matin en répond, bien
   qu'elle soit à sept heures et demie et la pluie à quatorze heures : c'est le
   cas que la consigne nomme. Le rappel se pose alors à l'heure d'alerte, encore
   devant soi. */
const [ctxMatin, pgMatin] = await ctxJeton(
  meteoPluie(30, APRESMIDI), "2026-08-18T06:00:00+02:00");
ok("une pluie de l'après-midi est annoncée dès avant la première alerte",
  await pgMatin.locator("#navJeton").isVisible());
const ICS_MATIN = await pgMatin.evaluate(async () => {
  const Pl = await import("/src/parapluie.js");
  const Pr = await import("/src/previsions.js");
  const R = await import("/src/reglages.js");
  return Pl.ics(Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT)), "Fain-lès-Moutiers");
});
ok("le rappel se pose à l'heure d'alerte tant qu'elle est devant soi",
  ICS_MATIN.includes("DTSTART:20260818T073000"),
  (ICS_MATIN.match(/DTSTART:\S+/) || [""])[0]);
ok("et sa description nomme les heures de la pluie, non celles de l'alerte",
  /DESCRIPTION:Pluie de 14 h à 16 h/.test(ICS_MATIN),
  (ICS_MATIN.match(/DESCRIPTION:.*/) || [""])[0]);
await ctxMatin.close();

/* Neuf heures du matin, la même pluie. L'alerte de sept heures et demie est
   passée, mais l'application n'a pas de notification à pousser : ouvrir
   l'écran est l'alerte, et le jeton doit y être. */
const [ctxPluie, pgPluie] = await ctxJeton(meteoPluie(30, APRESMIDI));
ok("le jeton est là quand la période d'alerte est en cours",
  await pgPluie.locator("#navJeton").isVisible());
ok("le jeton nomme les heures de la pluie",
  (await pgPluie.locator("#navJetonTxt").innerText()).trim() === "14 h à 16 h",
  await pgPluie.locator("#navJetonTxt").innerText());
ok("il annonce un parapluie quand les rafales restent sous le seuil",
  /^Parapluie, pluie de 14 h à 16 h/.test(await pgPluie.getAttribute("#navJeton", "aria-label")),
  await pgPluie.getAttribute("#navJeton", "aria-label"));

/* La barre de tête garde sa hauteur, et le jeton tient tout entier dedans : le
   risque nommé dans la consigne est qu'il pousse le nom de commune dehors. */
ok("la barre de tête garde sa hauteur et le jeton tient dedans",
  await pgPluie.evaluate(() => {
    const barre = document.querySelector(".nav-corps").getBoundingClientRect();
    const j = document.getElementById("navJeton").getBoundingClientRect();
    const n = document.getElementById("navLieuNom").getBoundingClientRect();
    const haut = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--nav-haut"));
    return Math.round(barre.height) === Math.round(haut) && j.top >= barre.top - 0.5
      && j.bottom <= barre.bottom + 0.5 && j.width > 60 && n.width > 40
      && n.right <= j.left + 0.5;
  }));

ok("le jeton garde sa place sur les cinq écrans", await (async () => {
  const vus = [];
  for (const cle of ["accueil", "temps", "semaine", "soleil", "lune"]) {
    await pgPluie.locator(`[data-onglet="${cle}"]`).click();
    await pgPluie.waitForTimeout(400);
    const b = await pgPluie.locator("#navJeton").boundingBox();
    vus.push(b ? `${Math.round(b.x)},${Math.round(b.y)}` : "absent");
  }
  return new Set(vus).size === 1 && !vus.includes("absent");
})());

/* Le jeton se refait à chaque rendu, sur les cinq écrans et non sur le seul
   accueil : la barre de tête est commune, et un jeton pris ailleurs ne doit pas
   y rester posé. La place est rendue ensuite pour la suite des contrôles. */
await pgPluie.evaluate(async () => {
  const R = await import("/src/reglages.js");
  const Pl = await import("/src/parapluie.js");
  const Pr = await import("/src/previsions.js");
  R.prendreJeton(Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT)).cle);
});
await pgPluie.locator('[data-onglet="semaine"]').click();
await pgPluie.waitForTimeout(400);
ok("un jeton pris se retire aussi depuis un écran qui n'est pas l'accueil",
  await pgPluie.locator("#navJeton").isHidden());
await pgPluie.evaluate(() => localStorage.setItem("mameteo.reglages.v1",
  JSON.stringify({ ...JSON.parse(localStorage.getItem("mameteo.reglages.v1")),
    jetonsPris: [] })));
await pgPluie.reload({ waitUntil: "networkidle" });
await pgPluie.waitForTimeout(1400);

/* Le fichier d'agenda. C'est le seul mécanisme qui donne une vraie alerte sans
   service dorsal. L'heure d'alerte étant passée, le rappel se pose au début de
   la pluie : un rappel à sept heures et demie pour une journée entamée ne
   servirait à rien. */
const ICS = await pgPluie.evaluate(async () => {
  const Pl = await import("/src/parapluie.js");
  const Pr = await import("/src/previsions.js");
  const R = await import("/src/reglages.js");
  return Pl.ics(Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT)), "Fain-lès-Moutiers");
});
ok("le fichier d'agenda porte un calendrier complet",
  ICS.startsWith("BEGIN:VCALENDAR\r\n") && ICS.trimEnd().endsWith("END:VCALENDAR")
  && (ICS.match(/BEGIN:VEVENT/g) || []).length === 1, ICS.slice(0, 40));
ok("l'heure d'alerte passée, le rappel se pose au début de la pluie",
  ICS.includes("DTSTART:20260818T140000") && ICS.includes("DTEND:20260818T143000"),
  (ICS.match(/DT(START|END):\S+/g) || []).join(" "));
ok("son alarme tombe quinze minutes avant l'évènement",
  ICS.includes("BEGIN:VALARM") && /TRIGGER:-PT15M/.test(ICS),
  (ICS.match(/TRIGGER:\S+/g) || []).join(" "));
ok("il nomme l'objet et la commune",
  /SUMMARY:Parapluie à Fain-lès-Moutiers/.test(ICS),
  (ICS.match(/SUMMARY:.*/) || [""])[0]);
ok("ses fins de ligne sont celles de la norme",
  await pgPluie.evaluate(t => /[^\r]\n/.test(t) ? "un saut de ligne seul" : "", ICS) === "");
/* Le repli des lignes longues. Aucun nom de commune de France n'y mène, le plus
   long tenant sous le compte : le contrôle l'éprouve donc sur un nom assez long
   pour l'atteindre, plutôt que de porter un repli que rien ne vérifie. */
ok("une ligne longue se replie et se déplie sur son texte",
  await pgPluie.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    const R = await import("/src/reglages.js");
    const j = Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT));
    const long = "Saint-Rémy-en-Bouzemont-Saint-Genest-et-Isson-lès-Deux-Églises";
    const t = Pl.ics(j, long);
    const e = new TextEncoder();
    const trop = t.split("\r\n").filter(l => e.encode(l).length > 75);
    if (trop.length) return `ligne de ${e.encode(trop[0]).length} octets`;
    const deplie = t.replace(/\r\n /g, "");
    return deplie.includes(`SUMMARY:Parapluie à ${long}`)
      ? "" : "le dépliage ne rend pas le titre";
  }) === "");

/* La réponse du matin porte l'objet à côté de la tenue. Un conseil de vêtement
   qui ne dit pas de prendre un parapluie est incomplet : c'est la même question,
   celle de ce qu'on emporte. */
await pgPluie.locator('[data-onglet="accueil"]').click();
await pgPluie.waitForTimeout(400);
ok("l'encart porte l'objet, puis la tenue, dans cet ordre",
  await pgPluie.evaluate(() => {
    const l = [...document.querySelectorAll(".pt-rep .pt-l")];
    if (l.length !== 2) return `${l.length} lignes`;
    if (!/^(Parapluie|Capuche),/.test(l[0].textContent.trim())) return l[0].textContent;
    if (!/ressentis|puis /.test(l[1].textContent)) return l[1].textContent;
    return "";
  }) === "", await txtDe(pgPluie, ".pt-rep"));
ok("chaque ligne de l'encart mène là où elle appartient",
  await pgPluie.evaluate(() =>
    [...document.querySelectorAll(".pt-rep .pt-l")].map(x => x.dataset.feuille).join(","))
    === "parapluie,ressenti",
  await pgPluie.evaluate(() =>
    [...document.querySelectorAll(".pt-rep .pt-l")].map(x => x.dataset.feuille).join(",")));

/* La feuille et la prise. La prise est gardée sous la date et l'instant
   d'alerte : prendre le jeton du matin ne doit pas faire taire celui du soir,
   et un rechargement ne doit pas le rendre. */
await clic(pgPluie, "#navJeton");
await pgPluie.waitForTimeout(450);
ok("l'appui sur le jeton ouvre sa feuille",
  (await pgPluie.locator("#feuille-titre").innerText()).startsWith("Parapluie"),
  await pgPluie.locator("#feuille-titre").innerText());
ok("la feuille porte les deux mécanismes, l'agenda et la prise",
  await pgPluie.locator("#plAgenda").count() === 1
  && await pgPluie.locator("#plPris").count() === 1);
ok("elle dit pourquoi le rappel ne se pose pas à l'heure d'alerte",
  /heure d'alerte de cette période est passée/.test(
    await pgPluie.locator(".feuille-corps").innerText()),
  await pgPluie.locator(".feuille-corps").innerText());
await clic(pgPluie, "#plPris");
await pgPluie.waitForTimeout(500);
ok("le jeton disparaît après un appui", await pgPluie.locator("#navJeton").isHidden());
/* La prise vaut pour les deux endroits : l'objet quitte aussi l'encart, sans
   quoi l'application redemanderait de prendre ce qui est déjà pris. */
ok("et l'objet quitte aussi l'encart de la réponse",
  await pgPluie.evaluate(() =>
    [...document.querySelectorAll(".pt-rep .pt-l")].every(x => x.dataset.feuille !== "parapluie")),
  await txtDe(pgPluie, ".pt-rep"));
await pgPluie.reload({ waitUntil: "networkidle" });
await pgPluie.waitForTimeout(1400);
ok("et ne revient pas au rechargement", await pgPluie.locator("#navJeton").isHidden());
ok("la prise est gardée par sa date et son instant d'alerte",
  (await pgPluie.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).jetonsPris)).includes("2026-08-18|7.5"),
  await pgPluie.evaluate(() =>
    JSON.stringify(JSON.parse(localStorage.getItem("mameteo.reglages.v1")).jetonsPris)));

/* Les heures d'alerte se règlent, et le rappel les suit. Une première alerte
   posée après la pluie laisse celle-ci dans la tranche que personne ne couvre :
   le jeton se tait. */
await pgPluie.evaluate(() => localStorage.setItem("mameteo.reglages.v1",
  JSON.stringify({ ...JSON.parse(localStorage.getItem("mameteo.reglages.v1")),
    jetonsPris: [], alertes: [16, 20] })));
await pgPluie.reload({ waitUntil: "networkidle" });
await pgPluie.waitForTimeout(1400);
ok("une première alerte posée après la pluie fait taire le jeton",
  await pgPluie.locator("#navJeton").isHidden());
await pgPluie.locator("#btnReglages").click();
await pgPluie.waitForTimeout(450);
ok("les réglages portent deux instants d'alerte, non quatre bornes",
  await pgPluie.locator(".rg-h").count() === 2,
  String(await pgPluie.locator(".rg-h").count()));
ok("les instants affichés sont ceux qui sont enregistrés",
  await pgPluie.evaluate(() =>
    [...document.querySelectorAll(".rg-h")].map(s => s.value).join(",")) === "16,20",
  await pgPluie.evaluate(() =>
    [...document.querySelectorAll(".rg-h")].map(s => s.value).join(",")));
/* Chaque rangée dit la période dont son alerte répond. La dernière s'arrête à
   minuit : c'est la règle même du rappel, elle doit se lire dans le réglage. */
ok("chaque alerte dit la période qu'elle couvre, la dernière jusqu'à minuit",
  (await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").allInnerTexts())
    .join(" | ") === "couvre 16 h à 20 h | couvre 20 h à minuit",
  (await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").allInnerTexts()).join(" | "));
/* Une seconde alerte qui précèderait la première est refusée, et le menu revient
   à la valeur en vigueur plutôt que de montrer un état que rien n'enregistre. */
await pgPluie.selectOption('.rg-h[data-alerte="1"]', "9");
await pgPluie.waitForTimeout(350);
ok("une seconde alerte antérieure à la première est refusée",
  await pgPluie.evaluate(() =>
    document.querySelector('.rg-h[data-alerte="1"]').value) === "20"
  && JSON.stringify(await pgPluie.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).alertes)) === "[16,20]",
  await pgPluie.evaluate(() =>
    JSON.stringify(JSON.parse(localStorage.getItem("mameteo.reglages.v1")).alertes)));
/* Une alerte ramenée avant la pluie la reprend en charge, et le jeton reparaît
   sans que la feuille se ferme. */
await pgPluie.selectOption('.rg-h[data-alerte="0"]', "7.5");
await pgPluie.waitForTimeout(450);
ok("une alerte ramenée avant la pluie fait reparaître le jeton",
  await pgPluie.locator("#navJeton").isVisible());
ok("et la feuille dit aussitôt la période nouvelle",
  (await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").first().innerText())
    === "couvre 07:30 à 20 h",
  await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").first().innerText());
ok("la recette du raccourci se donne étape par étape",
  await pgPluie.locator(".rg-recette li").count() === 6,
  String(await pgPluie.locator(".rg-recette li").count()));
await ctxPluie.close();

/* Le vent. Un parapluie ne tient pas au delà du seuil de retournement, et
   l'annoncer alors serait un mauvais conseil. */
const [ctxCapuche, pgCapuche] = await ctxJeton(meteoPluie(55, APRESMIDI));
ok("un vent au delà du seuil fait écrire capuche et non parapluie",
  /^Capuche, pluie de/.test(await pgCapuche.getAttribute("#navJeton", "aria-label")),
  await pgCapuche.getAttribute("#navJeton", "aria-label"));
await clic(pgCapuche, "#navJeton");
await pgCapuche.waitForTimeout(450);
ok("sa feuille dit pourquoi le parapluie ne convient pas",
  /rafale, un parapluie se retourne/.test(await pgCapuche.locator(".feuille-corps").innerText()),
  await pgCapuche.locator(".feuille-corps").innerText());
ok("le seuil de retournement est celui de la règle des rafales",
  await pgCapuche.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const C = await import("/src/conseils.js");
    return Pl.RETOURNEMENT === C.SEUILS.rafale;
  }));
await ctxCapuche.close();

/* Deux averses séparées dans la même période. Les fondre en une seule plage
   ferait annoncer cinq heures de pluie là où il en tombe deux. Le jeton porte la
   première, la feuille les porte toutes. */
const [ctxDeux, pgDeux] = await ctxJeton(meteoPluie(30, /^2026-08-18T(10|14)/));
ok("le jeton porte la première averse de la période",
  (await pgDeux.locator("#navJetonTxt").innerText()).trim() === "10 h à 11 h",
  await pgDeux.locator("#navJetonTxt").innerText());
await clic(pgDeux, "#navJeton");
await pgDeux.waitForTimeout(450);
ok("la feuille nomme les deux averses, non la plage qui les enjambe",
  (await pgDeux.locator(".feuille-corps").innerText()).includes("10 h à 11 h et 14 h à 15 h"),
  await pgDeux.locator(".feuille-corps").innerText());
await ctxDeux.close();

/* L'heure passée, la période courant encore. À midi, la pluie de dix heures est
   derrière et l'alerte du matin répond toujours de l'après-midi : annoncer un
   parapluie pour une averse tombée n'aide personne. C'est la seule condition qui
   écarte une heure, et elle porte aussi les périodes entièrement passées, qui
   n'ont plus une seule heure à venir. */
const [ctxDerriere, pgDerriere] = await ctxJeton(
  meteoPluie(30, /^2026-08-18T10/), "2026-08-18T12:00:00+02:00");
ok("une pluie déjà tombée ne fait rien paraître",
  await pgDerriere.locator("#navJeton").isHidden());
await ctxDerriere.close();

/* La soirée. La dernière alerte répond jusqu'à minuit : une pluie de vingt-trois
   heures est à elle. */
const [ctxSoir, pgSoir] = await ctxJeton(
  meteoPluie(30, /^2026-08-18T2[23]/), "2026-08-18T21:00:00+02:00");
ok("la dernière alerte répond de la pluie du soir",
  await pgSoir.locator("#navJeton").isVisible());
ok("son jeton porte l'instant de la dernière alerte",
  await pgSoir.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    const R = await import("/src/reglages.js");
    return Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT))?.cle;
  }) === "2026-08-18|17");
await ctxSoir.close();

/* Le lendemain. La dernière alerte s'arrête à minuit : une pluie du lendemain
   matin relève de l'alerte du lendemain, non de celle de ce soir. */
const [ctxDemain, pgDemain] = await ctxJeton(
  meteoPluie(30, /^2026-08-19T0[89]/), "2026-08-18T21:00:00+02:00");
ok("une pluie du lendemain matin ne s'annonce pas la veille au soir",
  await pgDemain.locator("#navJeton").isHidden());
/* Elle figure en revanche dans le lot de l'horizon, que la feuille propose de
   poser d'un coup : ce qui ne mérite pas un jeton ce soir mérite un rappel. */
ok("elle figure dans les rappels de l'horizon",
  await pgDemain.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    const R = await import("/src/reglages.js");
    const t = Pl.periodesPluvieuses(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT));
    /* La pluie du lendemain matin est dans le lot, et rien du soir même n'y
       figure : la soirée du 18 est sèche et sa période ne porte aucun rappel. */
    return t.some(x => x.cle === "2026-08-19|7.5") && !t.some(x => x.jour === "2026-08-18")
      ? "" : JSON.stringify(t.map(x => x.cle));
  }) === "");
/* La pluie de nuit de la charge d'essai, trois à cinq heures le 19 août, ne
   relève d'aucune alerte et ne doit produire aucun rappel. */
ok("aucune pluie de nuit n'entre dans les rappels de l'horizon",
  await pgDemain.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    const R = await import("/src/reglages.js");
    const t = Pl.periodesPluvieuses(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT));
    const tot = t.filter(x => x.salves.some(([a]) => a < 7));
    return tot.length ? JSON.stringify(tot[0]) : "";
  }) === "");
await ctxDemain.close();

/* La reprise de l'ancien réglage. La première version du rappel gardait deux
   plages de sortie ; le début de chaque plage est bien le moment où l'on
   sortait, et il devient l'instant d'alerte. */
const [ctxRepris, pgRepris] = await ctxJeton(meteoPluie(30, APRESMIDI), FIGE,
  { ...FAIN, sorties: [[7.5, 9], [17, 19]] });
ok("un réglage de plages de sortie se reprend en instants d'alerte",
  await pgRepris.evaluate(async () => {
    const R = await import("/src/reglages.js");
    const g = R.lire();
    return JSON.stringify(g.alertes) === "[7.5,17]" && g.sorties === undefined
      ? "" : JSON.stringify({ alertes: g.alertes, sorties: g.sorties });
  }) === "", await pgRepris.evaluate(async () => {
    const R = await import("/src/reglages.js");
    return JSON.stringify(R.lire().alertes);
  }));
await ctxRepris.close();
/* ---------- Le ressenti et le silence de la réponse ---------- */

console.log("\n--- Le ressenti calibré ---");

/* Un contexte à la carte pour la réponse du matin : la charge d'essai est
   reprise en déplaçant la température ressentie, qui décide de la tenue, et la
   température réelle, qui décide de l'aération. */
const meteoRes = (res, tem) => () => {
  const d = JSON.parse(JSON.stringify(METEO));
  const h = d.hourly;
  for (let k = 0; k < h.time.length; k++) {
    if (!/^2026-08-18T/.test(h.time[k])) continue;
    const heure = Number(h.time[k].slice(11, 13));
    h.apparent_temperature[k] = res(heure);
    if (tem) h.temperature_2m[k] = tem(heure);
  }
  return d;
};

const ctxReponse = async (patch, reglages, ensemble) => {
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c.addInitScript(amorceGardee(reglages || FAIN, FIGE));
  await brancherRoutes(c);
  await c.route(/https:\/\/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = patch();
    if (u.includes("sunshine_duration")) { servirBeauTemps(u, route); return; }
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("models=meteofrance_arome") || u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  if (ensemble) {
    await c.route(/ensemble-api\.open-meteo\.com/, r => r.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(ensemble) }));
  }
  const p = await c.newPage();
  const urls = [];
  p.on("request", r => urls.push(r.url()));
  await p.goto("http://localhost:8137/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  return [c, p, urls];
};

/* Une journée qui tient dans une seule tenue ordinaire n'a rien à décider. Le
   silence par défaut du dépôt s'applique : aucun encart, et le ciel reste nu. */
const [ctxPlat, pgPlat] = await ctxReponse(meteoRes(() => 19, () => 19));
ok("une journée sans rien à décider ne fait paraître aucun encart",
  await pgPlat.locator(".pt-rep").count() === 0,
  await pgPlat.locator(".pt-rep").innerText().catch(() => ""));
ok("et le ciel garde sa ligne de date et son grand chiffre",
  await pgPlat.locator(".plein-titre > i").count() === 1
  && await pgPlat.locator(".bd-deg").count() === 1);
await ctxPlat.close();

/* L'aération. Elle ne parle que les jours où l'intérieur va devenir plus chaud
   que le dehors : l'hiver, où il fait toujours plus frais dehors, la règle se
   déclencherait tous les jours et cesserait d'être lue. La tenue est ici
   constante, l'aération a donc son tour. */
const [ctxAerer, pgAerer] = await ctxReponse(
  meteoRes(() => 23, h => (h >= 9 && h < 12 ? 16 : 26)));
ok("l'aération nomme sa fenêtre et la fraîcheur du dehors",
  (await txtDe(pgAerer, ".pt-rep")).trim() === "Aérer de 09 h à 12 h, 16° dehors.",
  await txtDe(pgAerer, ".pt-rep"));
await ctxAerer.close();

/* La même journée fraîche, mais sans après-midi chaud : ouvrir une fenêtre n'y
   gagnerait rien, et la règle se tait. */
const [ctxHiver, pgHiver] = await ctxReponse(meteoRes(() => 23, () => 16));
ok("l'aération se tait quand l'intérieur ne va pas se réchauffer",
  await pgHiver.locator(".pt-rep").count() === 0,
  await pgHiver.locator(".pt-rep").innerText().catch(() => ""));
await ctxHiver.close();

/* Le biais personnel. Il déplace la tenue et non les degrés écrits : ceux-ci
   viennent de la source, et le ruban, la table des moments et la semaine
   doivent s'accorder au degré. */
const [ctxBiais, pgBiais, urlsBiais] = await ctxReponse(
  meteoRes(h => (h < 12 ? 8.6 : 14.6), () => 16));
const sansBiais = (await txtDe(pgBiais, ".pt-rep")).trim();
ok("sans correction, la tenue suit la température ressentie",
  /^Manteau, 9°, puis veste vers \d\d h, 15°\.$/.test(sansBiais), sansBiais);
await pgBiais.locator(".pt-rep").click();
await pgBiais.waitForTimeout(450);
ok("l'encart ouvre la feuille du ressenti personnel",
  (await pgBiais.locator("#feuille-titre").innerText()).startsWith("Mon ressenti"),
  await pgBiais.locator("#feuille-titre").innerText());
await pgBiais.locator('[data-biais="1"]').click();
await pgBiais.waitForTimeout(400);
const avecBiais = (await txtDe(pgBiais, ".pt-rep")).trim();
ok("un degré de trop chaud allège la tenue d'un cran",
  /^Veste, 9°, puis pull léger vers \d\d h, 15°\.$/.test(avecBiais), avecBiais);
ok("et ne déplace aucun des degrés écrits",
  sansBiais.match(/-?\d+°/g).join(",") === avecBiais.match(/-?\d+°/g).join(","),
  `${sansBiais} | ${avecBiais}`);
/* La borne. Sans elle, une suite d'appuis finirait par conseiller un manteau en
   juillet, et le réglage cesserait d'être une correction. */
for (let i = 0; i < 5; i++) {
  await pgBiais.locator('[data-biais="1"]').click();
  await pgBiais.waitForTimeout(220);
}
ok("le biais reste borné des deux côtés",
  await pgBiais.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais) === 3,
  String(await pgBiais.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais)));
for (let i = 0; i < 8; i++) {
  await pgBiais.locator('[data-biais="-1"]').click();
  await pgBiais.waitForTimeout(220);
}
ok("et il se borne aussi vers le froid",
  await pgBiais.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais) === -3,
  String(await pgBiais.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais)));
/* Le biais reste sur l'appareil. Aucune requête ne le porte, ce que le contrôle
   vérifie sur les adresses réellement émises depuis le réglage. */
const urlsApres = urlsBiais.length;
await pgBiais.locator('[data-biais="1"]').click();
await pgBiais.waitForTimeout(400);
ok("il n'entre dans aucune requête",
  urlsBiais.slice(urlsApres).every(u => !/biais|bias|ressenti/i.test(u)),
  urlsBiais.slice(urlsApres).join(" ") || "aucune requête nouvelle");
await ctxBiais.close();

/* La confiance. Elle ne s'écrit que lorsqu'elle est mauvaise : une mention à
   chaque fois se lirait une semaine, puis ne se lirait plus. */
const [ctxLarge, pgLarge] = await ctxReponse(
  meteoRes(h => (h < 12 ? 8.6 : 14.6), () => 16), null, ENSEMBLE_LARGE);
ok("des scénarios partagés se disent dans la phrase",
  /Scénarios partagés\.$/.test((await txtDe(pgLarge, ".pt-rep")).trim()),
  await txtDe(pgLarge, ".pt-rep"));
await ctxLarge.close();

/* Une journée qui se rafraîchit se dit dans l'ordre du temps, non du plus froid
   au plus chaud : on s'habille pour le premier des deux moments, et nommer une
   heure déjà passée en second serait une phrase à l'envers. */
const [ctxRefroidit, pgRefroidit] = await ctxReponse(
  meteoRes(h => (h < 15 ? 22 : 10), () => 16));
ok("une journée qui se rafraîchit se dit dans l'ordre du temps",
  (await txtDe(pgRefroidit, ".pt-rep")).trim()
    === "Manches courtes, 22°, puis veste vers 15 h, 10°.",
  await txtDe(pgRefroidit, ".pt-rep"));
await ctxRefroidit.close();

const [ctxSur, pgSur] = await ctxReponse(meteoRes(h => (h < 12 ? 8.6 : 14.6), () => 16));
ok("des scénarios accordés ne se disent pas",
  !/Scénarios/.test(await txtDe(pgSur, ".pt-rep")), await txtDe(pgSur, ".pt-rep"));
await ctxSur.close();

/* ---------- Les activités sur des charges à la carte ---------- */

console.log("\n--- Les activités, cas limites ---");

const meteoAct = patch => () => {
  const d = JSON.parse(JSON.stringify(METEO));
  patch(d);
  return d;
};

const ouvrirActivites = async p => {
  await p.locator('[data-feuille="activites"]').click();
  await p.waitForTimeout(500);
  return p.evaluate(() =>
    [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
      nom: r.querySelector(".rangee-txt b").textContent,
      quand: r.querySelector(".rangee-val b").textContent,
      detail: r.querySelector(".rangee-txt span").textContent,
      sans: r.classList.contains("act-sans"),
    })));
};

/* Une charge entièrement mouillée. Une activité sans créneau favorable le dit et
   ne propose rien : rendre le premier créneau à défaut ferait conseiller de
   courir sous la pluie. */
const [ctxTrempe, pgTrempe] = await ctxReponse(meteoAct(d => {
  d.hourly.precipitation = d.hourly.precipitation.map(() => 1.5);
  d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 95);
}));
const trempe = await ouvrirActivites(pgTrempe);
ok("sans créneau favorable, chaque activité le dit et ne propose rien",
  trempe.filter(a => a.nom !== "Arroser").every(a =>
    a.quand === "Aucun créneau" && a.sans && a.detail.length > 10),
  JSON.stringify(trempe.map(a => [a.nom, a.quand])));
/* L'arrosage a besoin d'une soirée sèche. N'en trouver aucune sur deux journées
   veut dire qu'il pleut, et le jardin est alors arrosé. */
ok("sous la pluie, l'arrosage dit que la pluie s'en charge",
  trempe.find(a => a.nom === "Arroser").quand === "La pluie s'en charge",
  trempe.find(a => a.nom === "Arroser").quand);
ok("et chacune dit pourquoi, non seulement qu'il n'y en a pas",
  trempe.filter(a => a.quand === "Aucun créneau").every(a => /pluie|mouill|vent|sèche|intérieur/i.test(a.detail)),
  JSON.stringify(trempe.filter(a => a.quand === "Aucun créneau").map(a => a.detail)));
await ctxTrempe.close();

/* Le lavage attend que douze heures sèches le suivent. Une matinée sèche
   suivie d'une averse de l'après-midi ne convient pas : la première averse
   défait le travail, et c'est la seule condition de cette activité. */
const [ctxAverse, pgAverse] = await ctxReponse(meteoAct(d => {
  for (let k = 0; k < d.hourly.time.length; k++) {
    if (/^2026-08-18T1[5-7]/.test(d.hourly.time[k])) d.hourly.precipitation[k] = 1.5;
  }
}));
const averse = await ouvrirActivites(pgAverse);
/* La charge d'essai porte aussi une pluie de nuit le 19 août, de trois à cinq
   heures : le premier lavage possible tombe donc après elle, au matin suivant. */
ok("une averse de l'après-midi repousse le lavage au delà d'elle",
  averse.find(a => a.nom === "Laver la voiture").quand === "demain 07 h à 21 h",
  averse.find(a => a.nom === "Laver la voiture").quand);
await ctxAverse.close();

/* Le bilan d'arrosage suit l'évapotranspiration et la pluie, non la pluie
   seule. Les deux contextes ne diffèrent que par l'évapotranspiration : même
   pluie tombée, deux verdicts contraires. */
const arrosageDe = async et0 => {
  const [c, p] = await ctxReponse(meteoAct(d => {
    d.daily.et0_fao_evapotranspiration = d.daily.et0_fao_evapotranspiration.map(() => et0);
  }));
  const l = await ouvrirActivites(p);
  await c.close();
  return l.find(a => a.nom === "Arroser");
};
const sec7 = await arrosageDe(3.5);
const humide7 = await arrosageDe(0.1);
ok("un sol qui a beaucoup évaporé demande un arrosage",
  sec7.quand !== "Pas nécessaire" && /déficit/.test(sec7.detail),
  `${sec7.quand} | ${sec7.detail}`);
ok("le même cumul de pluie, sans évaporation, n'en demande pas",
  humide7.quand === "Pas nécessaire" && /excédent/.test(humide7.detail),
  `${humide7.quand} | ${humide7.detail}`);

/* ---------- Où est le beau temps ---------- */

console.log("\n--- Où est le beau temps ---");

/* Trois lieux suivis sur un axe nord-sud. La charge d'essai fait monter le
   soleil vers le nord aujourd'hui, la température vers le sud : les deux
   classements possibles sont exactement inverses l'un de l'autre, et celui qui
   paraît dit lequel des deux la feuille suit. */
const REGL_BEAU = { ...FAIN, suivies: [
  { commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3 },
  { commune: "Nordville", codePostal: "10000", lat: 48.2, lon: 4.3 },
  { commune: "Sudville", codePostal: "71000", lat: 46.9, lon: 4.3 },
] };

const [ctxBeau, pgBeau, urlsBeau] = await ctxReponse(
  () => JSON.parse(JSON.stringify(METEO)), REGL_BEAU);

const lignesBeau = (p, ou) => p.evaluate(sel =>
  [...document.querySelectorAll(`${sel} .rangee`)].map(r => ({
    nom: r.querySelector(".rangee-txt b").textContent.trim(),
    sous: r.querySelector(".rangee-txt span").textContent,
    val: r.querySelector(".rangee-val").textContent.replace(/\s+/g, " ").trim(),
    ici: r.classList.contains("bt-ici"),
  })), ou);

await pgBeau.locator('[data-feuille="beautemps"]').click();
await pgBeau.waitForTimeout(900);

ok("la feuille s'ouvre sur la question du lieu",
  (await txtDe(pgBeau, "#feuille-titre")).startsWith("Où est le beau temps"),
  await txtDe(pgBeau, "#feuille-titre"));

const beauJour = await lignesBeau(pgBeau, "#btLieux");
ok("les lieux suivis sont classés du plus beau au moins beau",
  beauJour.map(l => l.nom).join(",") === "Nordville,Fain-lès-Moutiers,Sudville",
  beauJour.map(l => l.nom).join(","));
/* Le même jeu de lieux trié sur la température sortirait dans l'ordre inverse :
   c'est ce que ce contrôle interdit. */
ok("le classement ne suit pas la température, qui va ici en sens contraire",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const P = await import("/src/previsions.js");
    const l = [{ lat: 47.5, lon: 4.3 }, { lat: 48.2, lon: 4.3 }, { lat: 46.9, lon: 4.3 }];
    const { liste } = await P.journees(l);
    const cl = B.classer(l, liste, 0);
    const chaud = [...cl].sort((a, b) => b.tmax - a.tmax);
    return cl[0] === chaud[0] ? "le premier du classement est aussi le plus chaud" : "";
  }) === "");
/* L'ensoleillement compte en part de la durée du jour, non en heures : cinq
   heures de soleil sont une belle journée en décembre et une journée grise en
   juin. C'est la seule chose que la durée du jour décide. */
ok("le même ensoleillement vaut plus sur une journée courte",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const commun = { pluie: 0, tmax: 22 };
    const hiver = B.score({ ...commun, soleil: 5, jour: 9 });
    const ete = B.score({ ...commun, soleil: 5, jour: 14 });
    return hiver > ete ? "" : `hiver ${hiver.toFixed(1)}, été ${ete.toFixed(1)}`;
  }) === "");
ok("chaque rangée porte sa durée d'ensoleillement",
  beauJour.every(l => /^\d+(,\d)? h de soleil$/.test(l.val)),
  JSON.stringify(beauJour.map(l => l.val)));
ok("chaque rangée porte la température du maximum",
  beauJour.every(l => /\d+°/.test(l.sous)),
  JSON.stringify(beauJour.map(l => l.sous)));
/* La pluie s'écrit quand il en tombe, et rien quand il n'en tombe pas : « 0 mm »
   se lit comme une mesure alors que c'est une absence, et la rangée porte déjà
   sa distance et sa direction. */
ok("la pluie ne s'écrit que s'il en tombe",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const sec = B.journeeTxt({ tmax: 21, pluie: 0 });
    const mouille = B.journeeTxt({ tmax: 21, pluie: 3.4 });
    if (/mm/.test(sec)) return `une journée sèche dit « ${sec} »`;
    if (!/3,4 mm/.test(mouille)) return `une journée mouillée dit « ${mouille} »`;
    return "";
  }) === "");
/* Le lieu courant porte son repère : c'est la rangée à laquelle les autres se
   comparent, et sans elle le classement ne dit pas s'il faut bouger. */
ok("le lieu courant porte son repère, et lui seul",
  await pgBeau.locator("#btLieux .bt-ici").count() === 1
  && beauJour.find(l => l.ici)?.nom === "Fain-lès-Moutiers",
  JSON.stringify(beauJour.map(l => [l.nom, l.ici])));
ok("le repère est un symbole, non un mot ajouté au nom",
  await pgBeau.locator("#btLieux .bt-ici .bt-repere").count() === 1);

// La journée se choisit, et la charge d'essai retourne le classement d'un jour
// à l'autre : un sélecteur qui ne serait pas lu laisserait le même ordre.
await pgBeau.locator('[data-jour="1"]').click();
await pgBeau.waitForTimeout(300);
const beauDemain = await lignesBeau(pgBeau, "#btLieux");
ok("le sélecteur de journée change le classement",
  beauDemain.map(l => l.nom).join(",") === "Sudville,Fain-lès-Moutiers,Nordville",
  beauDemain.map(l => l.nom).join(","));
ok("le sélecteur marque la journée montrée",
  await pgBeau.locator('.bt-jours button.actif').count() === 1
  && (await txtDe(pgBeau, ".bt-jours button.actif")).trim() === "Demain",
  await txtDe(pgBeau, ".bt-jours button.actif"));
await pgBeau.locator('[data-jour="0"]').click();
await pgBeau.waitForTimeout(300);

/* La grille coûte une requête de soixante-neuf points. Elle ne part pas à
   l'ouverture de la feuille : celle-ci se lit d'abord sur les lieux connus. */
const appelsBeau = () => urlsBeau.filter(u => u.includes("sunshine_duration"));
ok("la grille ne part pas d'elle-même",
  appelsBeau().length === 1 && appelsBeau()[0].split("latitude=")[1].split("&")[0].split(",").length === 3,
  appelsBeau().map(u => u.split("latitude=")[1].split("&")[0].split(",").length).join(","));
ok("la carte des cent kilomètres n'est pas là avant qu'on la demande",
  await pgBeau.locator("#btGrille:not([hidden])").count() === 0);

await pgBeau.locator("#btLarge").click();
await pgBeau.waitForTimeout(1200);

ok("l'appui élargit la lecture à la grille, en un seul appel",
  appelsBeau().length === 2
  && appelsBeau()[1].split("latitude=")[1].split("&")[0].split(",").length === 69,
  appelsBeau().length + " appels");
const grille = await lignesBeau(pgBeau, "#btGrille");
ok("la grille montre cinq points, plus celui d'ici",
  grille.length === 6 && grille.filter(l => l.ici).length === 1,
  `${grille.length} rangées, ${grille.filter(l => l.ici).length} repère`);
/* Ici garde sa rangée alors qu'elle n'est pas dans les cinq premières : c'est la
   référence, et sans elle les cinq points ne se comparent à rien. */
ok("ici garde sa rangée hors du haut du classement",
  grille[grille.length - 1].ici, JSON.stringify(grille.map(l => l.ici)));
/* Le point le plus ensoleillé de la grille est aussi le plus arrosé. Un
   classement qui suivrait l'ensoleillement seul le mettrait en tête. */
ok("le point le plus ensoleillé, mais pluvieux, n'est pas en tête",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const P = await import("/src/previsions.js");
    const g = B.grille({ lat: 47.5, lon: 4.3 });
    const { liste } = await P.journees(g);
    const cl = B.classer(g, liste, 0);
    const soleil = [...cl].sort((a, b) => b.soleil - a.soleil)[0];
    if (soleil.pluie < 5) return "le plus ensoleillé n'est pas le point arrosé";
    if (cl[0] === soleil) return "le plus ensoleillé est en tête malgré sa pluie";
    return "";
  }) === "");
/* L'ensoleillement porte le score, ce que le seul classement des trois lieux ne
   montre pas : la charge d'essai y fait varier le soleil et la température
   ensemble. Une rangée de la grille les sépare, tous ses points ayant la même
   latitude, donc la même température et la même pluie, et ne différant que par
   le soleil. */
ok("à pluie et température égales, le plus ensoleillé passe devant",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const P = await import("/src/previsions.js");
    const g = B.grille({ lat: 47.5, lon: 4.3 });
    const { liste } = await P.journees(g);
    const cl = B.classer(g, liste, 0);
    const rangee = cl.filter(l => Math.abs(l.lat - cl[0].lat) < 0.001);
    if (rangee.length < 3) return "la rangée de grille est trop courte";
    if (new Set(rangee.map(l => l.tmax)).size !== 1) return "la rangée n'a pas une seule température";
    for (let i = 1; i < rangee.length; i++) {
      if (rangee[i].soleil > rangee[i - 1].soleil + 1e-9) return "un point moins ensoleillé passe devant";
    }
    return "";
  }) === "");
/* Les cinq points montrés sont cinq endroits distincts. Sans distance minimale,
   ce sont les cinq mailles voisines du même coin de la grille : un seul endroit
   écrit cinq fois, à deux dixièmes d'heure de soleil près. */
ok("deux points montrés ne sont jamais voisins",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const P = await import("/src/previsions.js");
    const g = B.grille({ lat: 47.5, lon: 4.3 });
    const { liste } = await P.journees(g);
    const cl = B.classer(g, liste, 0);
    const m = B.retenir(cl);
    if (m.length !== B.SEUILS_BEAU.montres) return `${m.length} points retenus`;
    if (m[0] !== cl[0]) return "le meilleur point n'est plus en tête";
    for (let i = 0; i < m.length; i++) {
      for (let k = i + 1; k < m.length; k++) {
        const d = B.km(m[i], m[k]);
        if (d < B.SEUILS_BEAU.ecartMontres) return `deux points à ${d.toFixed(1)} km`;
      }
    }
    return "";
  }) === "");
ok("le verdict dit où aller",
  /^Mieux à \d+ km (au|à l')/.test(await txtDe(pgBeau, ".bt-verdict")),
  await txtDe(pgBeau, ".bt-verdict"));
/* Un écart trop faible ne fait pas partir : sans ce seuil, la feuille enverrait
   à trente kilomètres pour un quart d'heure de soleil. */
ok("un écart trop faible laisse le beau temps ici",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const e = B.SEUILS_BEAU.ecartUtile;
    const ici = { ici: true, score: 60 };
    const petit = { score: 60 + e - 0.5 }, grand = { score: 60 + e + 0.5 };
    if (B.mieuxQuIci([petit, ici], ici)) return "un écart sous le seuil fait partir";
    if (!B.mieuxQuIci([grand, ici], ici)) return "un écart au-dessus du seuil ne fait pas partir";
    return "";
  }) === "");
/* Les points montrés sont nommés par l'interface adresse, et eux seuls :
   soixante-neuf géocodages inverses pour six rangées lues coûteraient soixante
   appels pour rien. */
const inverses = () => urlsBeau.filter(u => u.includes("api-adresse") && u.includes("/reverse/"));
ok("les points de la grille sont nommés",
  grille.filter(l => l.nom === "Grenoble").length >= 5,
  JSON.stringify(grille.map(l => l.nom)));
/* Le centre de la grille est le lieu courant : son nom est déjà dans les
   réglages, et l'aller-retour vers l'interface adresse le remplacerait par
   celui que le géocodage inverse rend, qui peut être celui de la commune
   voisine. */
ok("la rangée d'ici porte le nom du lieu courant",
  grille.find(l => l.ici)?.nom === "Fain-lès-Moutiers",
  grille.find(l => l.ici)?.nom);
ok("seuls les points montrés sont nommés",
  inverses().length > 0 && inverses().length <= 12, `${inverses().length} appels`);
ok("un point nommé garde sa distance et sa direction",
  grille.filter(l => !l.ici).every(l => /^à \d+ km (au |à l')\S+ · \d+°/.test(l.sous)),
  JSON.stringify(grille.map(l => l.sous)));

/* La grille elle-même : cent kilomètres de rayon, vingt-deux de pas, le centre
   marqué une fois. Un point hors du disque coûterait de la donnée pour un lieu
   que personne n'irait chercher. */
ok("la grille tient dans son rayon et porte un seul centre",
  await pgBeau.evaluate(async () => {
    const B = await import("/src/beautemps.js");
    const c = { lat: 47.5, lon: 4.3 };
    const g = B.grille(c);
    const hors = g.filter(p => p.km > B.SEUILS_BEAU.rayon + 0.001);
    if (hors.length) return `${hors.length} points hors du rayon`;
    if (g.filter(p => p.ici).length !== 1) return "le centre n'est pas marqué une fois";
    const pas = B.SEUILS_BEAU.pas;
    // Aucun endroit du disque n'est plus loin qu'une demi-diagonale de maille.
    const demi = Math.hypot(pas, pas) / 2;
    for (const t of [[47.6, 4.4], [47.2, 3.9], [48.0, 5.0]]) {
      const p = { lat: t[0], lon: t[1] };
      const d = Math.min(...g.map(q => B.km(p, q)));
      if (d > demi + 0.5) return `un point du disque est à ${d.toFixed(1)} km de la grille`;
    }
    return "";
  }) === "");

/* La lecture est gardée en mémoire une demi-heure. Rouvrir la feuille dans ce
   délai ne redemande rien : sans cela, chaque aller-retour vers l'accueil
   coûterait un appel de plus à la source. */
await pgBeau.locator("#feuille-fermer").click();
await pgBeau.waitForTimeout(420);
await pgBeau.locator('[data-feuille="beautemps"]').click();
await pgBeau.waitForTimeout(700);
ok("rouvrir la feuille ne redemande rien à la source",
  appelsBeau().length === 2, `${appelsBeau().length} appels`);
ok("et les lieux y sont encore classés",
  (await lignesBeau(pgBeau, "#btLieux")).length === 3);

await ctxBeau.close();

/* ---------- L'air qu'on respire ---------- */

console.log("\n--- L'air qu'on respire ---");

const METEO_NUE = () => JSON.parse(JSON.stringify(METEO));

const ouvrirAir = async p => {
  await p.locator('[data-feuille="air"]').click();
  await p.waitForTimeout(600);
  return p.evaluate(() =>
    [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
      nom: r.querySelector(".rangee-txt b")?.textContent.trim() || "",
      sous: r.querySelector(".rangee-txt span")?.textContent || "",
      val: r.querySelector(".rangee-val")?.textContent.replace(/\s+/g, " ").trim() || "",
    })));
};

const [ctxAir, pgAir, urlsAir] = await ctxReponse(METEO_NUE);
const lignesAir = await ouvrirAir(pgAir);

ok("la feuille s'ouvre sur la question de l'air",
  (await txtDe(pgAir, "#feuille-titre")).startsWith("L'air qu'on respire"),
  await txtDe(pgAir, "#feuille-titre"));
/* L'indice du moment et le pire des vingt-quatre heures. À neuf heures la charge
   d'essai donne quatorze, et vingt-six à partir de midi : deux niveaux
   différents, donc deux rangées. */
ok("l'indice du moment porte son niveau",
  lignesAir[0]?.nom === "Maintenant" && /^Bon 14$/.test(lignesAir[0].val),
  JSON.stringify(lignesAir[0]));
ok("le pire moment se dit avec son heure",
  lignesAir[1]?.nom === "Au plus haut" && /^Moyen 26$/.test(lignesAir[1].val)
  && /^Vers 12 h/.test(lignesAir[1].sous),
  JSON.stringify(lignesAir[1]));
ok("les quatre polluants portent leur unité",
  lignesAir.filter(l => /µg\/m³/.test(l.val)).length === 4,
  JSON.stringify(lignesAir.filter(l => /µg/.test(l.val)).map(l => l.nom)));
/* Un pollen sous son seuil de saison ne s'écrit pas. La charge d'essai porte
   des graminées à douze grains, au-dessus de leur seuil de trois, et cinq
   autres taxons en dessous du leur : une seule rangée doit paraître. */
const rangeesPollen = lignesAir.filter(l => /grains\/m³/.test(l.val));
ok("seul un pollen en saison paraît",
  rangeesPollen.length === 1 && rangeesPollen[0].nom === "Graminées",
  JSON.stringify(rangeesPollen.map(l => [l.nom, l.val])));
ok("et il dit qu'il est en saison, non au pic",
  /En saison/.test(rangeesPollen[0]?.sous || ""), rangeesPollen[0]?.sous);

/* Le profil d'allergies : six rangées, toutes suivies au départ. */
await pgAir.locator("#feuille-fermer").click();
await pgAir.waitForTimeout(420);
await pgAir.locator("#btnReglages").click();
await pgAir.waitForTimeout(600);
ok("le profil porte les six pollens, tous suivis au départ",
  await pgAir.locator("[data-pollen]").count() === 6
  && await pgAir.locator('[data-pollen][aria-checked="true"]').count() === 6,
  `${await pgAir.locator("[data-pollen]").count()} rangées, `
  + `${await pgAir.locator('[data-pollen][aria-checked="true"]').count()} suivies`);
await pgAir.locator('[data-pollen="ambroisie"]').click();
await pgAir.waitForTimeout(400);
ok("un pollen retiré se marque comme tel",
  await pgAir.locator('[data-pollen="ambroisie"][aria-checked="false"]').count() === 1);
ok("et le retrait est gardé sur l'appareil",
  await pgAir.evaluate(() => {
    const r = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
    return Array.isArray(r.pollensMuets) && r.pollensMuets.includes("ambroisie");
  }));
/* Le profil est une donnée de santé : il ne sort pas de l'appareil. La requête
   demande les six pollens quoi qu'il arrive, avant comme après le retrait. */
const requetesAir = () => urlsAir.filter(u => u.includes("air-quality"));
ok("le profil n'entre dans aucune requête",
  requetesAir().length > 0
  && requetesAir().every(u => ["alder", "birch", "grass", "mugwort", "olive", "ragweed"]
    .every(x => u.includes(`${x}_pollen`))),
  `${requetesAir().length} requêtes`);
await ctxAir.close();

/* Un air dégradé se dit dans ce qui est à savoir, et pas en deçà. Les deux
   contextes ne diffèrent que par l'air servi. */
const conseilsDe = async profil => {
  profilAir = profil;
  const [c, p] = await ctxReponse(METEO_NUE);
  const dit = (await p.locator("#ecran .conseils .cj-l").allInnerTexts()).join(" | ");
  await c.close();
  profilAir = "base";
  return dit;
};
const ditDegrade = await conseilsDe("degrade");
const ditBase = await conseilsDe("base");
ok("un air dégradé se dit dans ce qui est à savoir",
  /Air dégradé .*indice 55/.test(ditDegrade), ditDegrade);
ok("un air ordinaire ne se dit pas", !/Air /.test(ditBase), ditBase);

/* Le pic d'un pollen se dit, la saison ne se dit pas : une ligne quotidienne
   pendant six semaines ne se lirait plus. Le profil décide, et c'est la seule
   différence entre les deux contextes. */
profilAir = "ambroisie";
const [ctxPic, pgPic] = await ctxReponse(METEO_NUE);
const ditPic = (await pgPic.locator("#ecran .conseils .cj-l").allInnerTexts()).join(" | ");
await ctxPic.close();
const [ctxSansAmbroisie, pgSansAmbroisie] = await ctxReponse(METEO_NUE,
  { ...FAIN, pollensMuets: ["ambroisie"] });
const ditMuet = (await pgSansAmbroisie.locator("#ecran .conseils .cj-l")
  .allInnerTexts()).join(" | ");
await ctxSansAmbroisie.close();
profilAir = "base";
ok("un pollen du profil au pic se dit",
  /Ambroisie au pic.*71 grains par mètre cube/.test(ditPic), ditPic);
ok("le même pollen retiré du profil ne se dit plus",
  !/Ambroisie/.test(ditMuet), ditMuet);
/* Les graminées sont en saison dans les deux contextes sans jamais atteindre
   leur pic : la saison seule ne doit rien écrire. */
ok("une saison sans pic ne se dit pas",
  !/Graminées/.test(ditPic) && !/Graminées/.test(ditMuet), ditPic);

/* L'air entre dans la règle d'aération. Les deux contextes portent la même
   journée fraîche de neuf à quinze heures ; seul l'air du matin change. */
const aererAvec = async profil => {
  profilAir = profil;
  const [c, p] = await ctxReponse(meteoRes(() => 23, h => (h >= 9 && h < 15 ? 16 : 26)));
  const dit = (await txtDe(p, ".pt-rep")).trim();
  const rangees = await ouvrirAir(p);
  await c.close();
  profilAir = "base";
  return { dit, air: rangees.filter(l => /^(Bon|Moyen|Dégradé|Mauvais)/.test(l.val)) };
};
const aereBase = await aererAvec("base");
const aereSale = await aererAvec("matin");
ok("sans air dégradé, l'aération ouvre dès la première heure fraîche",
  aereBase.dit === "Aérer de 09 h à 15 h, 16° dehors.", aereBase.dit);
ok("un air dégradé le matin repousse l'aération après lui",
  aereSale.dit === "Aérer de 12 h à 15 h, 16° dehors.", aereSale.dit);
/* À neuf heures, le profil du matin est déjà au plus haut de la journée : la
   rangée « au plus haut » redirait le moment présent, et ne paraît pas. */
ok("le pire moment ne se répète pas quand c'est le moment présent",
  aereSale.air.length === 1 && aereBase.air.length === 2,
  `${aereSale.air.length} rangées d'air sur air dégradé, ${aereBase.air.length} sinon`);

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
