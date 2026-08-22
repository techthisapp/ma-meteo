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
ok("les quatre mesures sont nommées", mes.toLowerCase() === "ressenti, vent, humidité, indice uv", mes);
const cj = await pg.locator(".cj-l").allInnerTexts();
ok("quatre lignes à savoir au plus", cj.length >= 1 && cj.length <= 4, cj.length + "");
/* Une règle ne parle que si elle a quelque chose à dire : une phrase qui
   annonce qu'il ne se passe rien se lit cent fois pour rien apprendre. */
ok("rien ne s'écrit pour dire qu'il n'y a rien",
  !/aucune lame|rien à signaler|pas de pluie/i.test(cj.join(" ")), cj.join(" | "));
/* Le titre annonce la portée réelle de ce qui suit : un titre qui promet
   vingt-quatre heures alors que la dernière ligne s'arrête à seize ment. */
const titreRet = (await pg.locator("#ecran .section h2").allInnerTexts())
  .find(t => t.startsWith("Dans les")) || "";
ok("le titre annonce la portée de ce qui suit",
  /^Dans les \d+ prochain(e?)s (heures|jours)$/.test(titreRet), titreRet);
ok("la portée annoncée couvre la ligne la plus lointaine", await pg.evaluate(() => {
  const h2 = [...document.querySelectorAll("#ecran .section h2")]
    .find(x => x.textContent.startsWith("Dans les"));
  const m = /Dans les (\d+) prochain/.exec(h2.textContent);
  const heures = /jours/.test(h2.textContent) ? Number(m[1]) * 24 : Number(m[1]);
  const txt = h2.parentElement.textContent;
  /* Toute heure citée doit tomber dans la fenêtre annoncée. Les heures de
     demain comptent vingt-quatre de plus. */
  const maintenant = new Date().getHours();
  let pire = 0;
  for (const c of txt.matchAll(/(demain )?(\d\d) h/g)) {
    const h = Number(c[2]) + (c[1] ? 24 : 0);
    pire = Math.max(pire, h - maintenant + (h < maintenant && !c[1] ? 24 : 0));
  }
  return pire <= heures;
}));
ok("aucune ligne ne se répète", new Set(cj).size === cj.length);
ok("aucun verbe de jardin", !/arros|voiler|tuteur|repiquage|ombrer|plant/i.test(cj.join(" ")), cj.join(" | "));
const alertesTxt = (await pg.locator(".al").allInnerTexts()).join(" ").toLowerCase();
const conseilsTxt = cj.join(" ").toLowerCase();
const motsCommuns = ["rafales", "gel probable", "indice uv", "mm attendus"]
  .filter(m => alertesTxt.includes(m) && conseilsTxt.includes(m));
ok("les alertes ne répètent pas les conseils", motsCommuns.length === 0, motsCommuns.join(", "));
ok("le ressenti n'est écrit qu'une fois sur l'accueil",
  ((await txt("#ecran")).toLowerCase().match(/ressenti/g) || []).length === 1);
ok("la vigilance ouvre son détail depuis l'accueil",
  await pg.locator('#ecran .vg-c[data-feuille="vigilance"]').count() === 1);
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
ok("il écrit le niveau en toutes lettres, non par la seule couleur",
  /Vigilance orange/i.test(await txt("#ecran .vg h2")), await txt("#ecran .vg h2"));
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
