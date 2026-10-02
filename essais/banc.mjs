/* Le banc d'essai des contrôles : le serveur qui sert l'application depuis le
   disque, le navigateur, et la préparation de chaque section. Depuis le
   2 octobre 2026, chaque section de la suite vit dans son fichier sous
   essais/sections/ et part d'un état neuf : un contexte à elle, ses propres
   faux services et, si elle s'en sert, une page ouverte sur l'accueil de la
   commune d'essai. Les sections ne dépendent plus les unes des autres et
   peuvent passer seules ou côte à côte, docs/plan-chantiers-facultatifs.md. */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  METEO, FIGE, FAIN, amorce, amorceGardee, nouvelEtat, brancherFauxServices,
  envelopperNavigateur, repliCorps, servirBeauTemps, grilleCorps,
} from "./faux-services.mjs";

export const ICI = path.dirname(fileURLToPath(import.meta.url));
export const RACINE = path.resolve(ICI, "..");
export const CAPTURES = path.join(ICI, "captures");
fs.mkdirSync(CAPTURES, { recursive: true });

const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
               ".json":"application/json", ".svg":"image/svg+xml",
               ".webmanifest":"application/manifest+json", ".png":"image/png", ".webp":"image/webp" };

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
/* Le port se choisit par l'environnement : plusieurs épreuves tournent alors
   en parallèle sur des copies du dépôt, chacune sur son port. */
const PORT = Number(process.env.PORT_ESSAIS) || 8137;
export const RACINE_HTTP = `http://localhost:${PORT}/`;
await new Promise(r => serveur.listen(PORT, r));

export const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
/* Le filet du réseau, posé sur tout contexte : la liste des requêtes refusées
   se juge à la fin de la passe. */
export const sortantes = envelopperNavigateur(nav);

/* Les espaces insécables de l'application, posées depuis le 2 octobre 2026,
   audit, constat 4.12, se lisent comme des espaces ordinaires : les contrôles
   comparent des mots, et la typographie a son propre contrôle. Toute chaîne
   que Playwright rapporte de la page est normalisée ; `evaluateBrut` garde la
   lecture exacte pour ce contrôle-là. */
const sansInsecables = t => t.replace(/[\u00A0\u202F]/g, " ");
const normer = v => (typeof v === "string" ? sansInsecables(v)
  : Array.isArray(v) ? v.map(normer)
    : v && Object.getPrototypeOf(v) === Object.prototype
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normer(x)])) : v);
{
  const c0 = await nav.newContext();
  const p0 = await c0.newPage();
  const page = Object.getPrototypeOf(p0), locator = Object.getPrototypeOf(p0.locator("body"));
  page.evaluateBrut = page.evaluate;
  for (const [proto, noms] of [[page, ["evaluate", "textContent", "innerText", "getAttribute"]],
    [locator, ["evaluate", "evaluateAll", "innerText", "textContent", "allInnerTexts", "allTextContents", "getAttribute"]]]) {
    for (const nom of noms) {
      const brut = proto[nom];
      proto[nom] = async function (...a) { return normer(await brut.apply(this, a)); };
    }
  }
  await c0.close();
}
/* Les requêtes en cours de chaque contexte, pour savoir quand une page est au
   repos. */
const enCours = new WeakMap();
const nouveauContexte = async (...a) => {
  const c = await nav.newContext(...a);
  enCours.set(c, 0);
  const moins = () => enCours.set(c, Math.max(0, enCours.get(c) - 1));
  c.on("request", () => enCours.set(c, enCours.get(c) + 1));
  c.on("requestfinished", moins);
  c.on("requestfailed", moins);
  return c;
};

/* La fin de la passe. La sortie est synchrone jusqu'à `process.exit` : le
   processus qui s'arrête ferme le navigateur et le serveur de toute façon. */
export const fermer = () => {
  nav.close().catch(() => {});
  try { serveur.close(); } catch { /* déjà fermé */ }
};

/* L'ouverture d'une page. L'attente d'un réseau au repos a tenu une suite
   entière trois fois : une requête qui traîne, et neuf minutes de contrôles
   perdues. Le repli borne l'attente et se compte, pour que le masquage se voie
   plutôt que de passer inaperçu. */
export const mesure = { repliesOuverture: 0, coutOuvertures: 0, nbOuvertures: 0,
  repos: 0, reposPlafond: 0, coutRepos: 0 };
export const ouvrirPage = async (p, url = RACINE_HTTP) => {
  const t0 = Date.now();
  try {
    await p.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  } catch {
    mesure.repliesOuverture++;
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
  }
  mesure.coutOuvertures += Date.now() - t0; mesure.nbOuvertures++;
  return p;
};

/* L'attente du repos d'une page, qui remplace depuis le 2 octobre 2026 les
   pauses fixes d'une seconde ou plus. La page est au repos quand son contexte
   n'a plus de requête en cours et que son document n'a pas changé depuis un
   quart de seconde. Le plafond est la durée de l'ancienne pause augmentée de
   moitié : une page qui ne se pose pas attend un peu plus qu'avant, sans
   bloquer la passe. Les plafonds atteints se comptent, et CHRONO=1 les dit.

   L'attente commence par deux images d'écran : un changement de taille de la
   fenêtre ne se traite qu'à l'image suivante, et sous la charge de trois
   sections côte à côte cette image tardait plus d'un quart de seconde. Le
   ruban était alors relu avant d'être redessiné en paysage. */
const CALME = 250;
export const reposer = async (p, plafond) => {
  const t0 = Date.now();
  const c = p.context();
  await p.evaluate(() => new Promise(r => {
    setTimeout(r, 500);
    requestAnimationFrame(() => requestAnimationFrame(r));
  })).catch(() => {});
  for (;;) {
    let calme = 0;
    try {
      calme = await p.evaluate(() => {
        if (!window.__repos) {
          window.__repos = performance.now();
          new MutationObserver(() => { window.__repos = performance.now(); })
            .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
        }
        return performance.now() - window.__repos;
      });
    } catch { /* une navigation en cours : le document se relira au tour suivant */ }
    const ecoule = Date.now() - t0;
    if (calme >= CALME && !(enCours.get(c) > 0)) break;
    if (ecoule >= plafond) { mesure.reposPlafond++; break; }
    await new Promise(r => setTimeout(r, 50));
  }
  mesure.repos++; mesure.coutRepos += Date.now() - t0;
};

/* La préparation d'une section. Elle rend les outils que la section emploie :
   le compte de ses contrôles, son état des faux services, et, quand `avecPage`
   le demande, le contexte principal et sa page ouverte sur l'accueil. Le
   contexte principal se tient à Grenoble : Ma position doit y mener. Tout
   contexte ouvert par la section se ferme à sa fin. */
export const espaces = t => (typeof t === "string" ? t.replace(/[\u00A0\u202F]/g, " ") : t);

export const preparer = async (titre, avecPage) => {
  const lignes = [];
  const dire = (...a) => lignes.push(a.join(" "));
  let n = 0, ko = 0;
  const ok = (nom, cond, detail) => {
    n++; if (!cond) { ko++; dire(`  ÉCHEC  ${nom}${detail ? " | " + detail : ""}`); }
    else dire(`  ok     ${nom}`);
  };
  const etat = nouvelEtat();
  const brancherRoutes = c => brancherFauxServices(c, etat);
  const contextes = [];
  /* Le navigateur vu de la section : il garde la liste des contextes ouverts. */
  const nav = {
    newContext: async (...a) => { const c = await nouveauContexte(...a); contextes.push(c); return c; },
  };
  const erreurs = [];
  /* Les adresses réellement émises vers la prévision, pour éprouver le contrat
     avec la source : les colonnes demandées, et rien de plus. L'ensemble porte
     le même domaine à un préfixe près et reste hors du compte. */
  const appelsHoraire = [];
  // Toutes les adresses demandées par la page, pour vérifier ce qui part de la position.
  const appelsTous = [];
  let ctx = null, pg = null;
  if (avecPage) {
    ctx = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 45.1885, longitude: 5.7245 },
    });
    await ctx.addInitScript(amorce(FAIN));
    await brancherRoutes(ctx);
    pg = await ctx.newPage();
    pg.on("pageerror", e => erreurs.push(String(e)));
    pg.on("request", r => appelsTous.push(r.url()));
    pg.on("request", r => {
      if (r.url().startsWith("https://api.open-meteo.com")) appelsHoraire.push(r.url());
    });
    pg.on("console", m => {
      // Les deux sources data.gouv sont volontairement coupées dans cet essai.
      if (m.type() === "error" && !/ERR_FAILED|ERR_ABORTED/.test(m.text())) erreurs.push("console: " + m.text());
    });
    await ouvrirPage(pg);
    await reposer(pg, 1350);
  }

  /* « Le temps » n'a plus d'onglet depuis le 25 septembre 2026 : il s'ouvre par
     le lien « Plus de détails » de la bande, sur l'accueil, tel qu'on l'a
     laissé, ruban ou liste. */
  const ouvrirLeTemps = async page => {
    await page.locator('[data-onglet="accueil"]').click();
    await page.waitForTimeout(350);
    await page.locator("#bande [data-temps]").click();
    await page.waitForTimeout(350);
  };
  /* La phrase entière d'un conseil. Depuis le jalon 11 le conseil s'affiche en
     deux lignes, titre et précision ; sa phrase reste dans `data-phrase`, et
     c'est elle que les contrôles comparent. */
  /* Les espaces insécables de l'application, posées depuis le 2 octobre 2026,
     audit, constat 4.12, se lisent comme des espaces ordinaires : les contrôles
     comparent des mots, et la typographie a son propre contrôle. */
  const phrasesConseils = (page, q = "#ecran .cj-l") => page.evaluate(sel =>
    [...document.querySelectorAll(sel)].map(l => (l.dataset.phrase || l.textContent).replace(/[\u00A0\u202F]/g, " ")), q);
  const txt = async s => (await pg.locator(s).count()) ? espaces(await pg.locator(s).first().innerText()) : "";
  const txtDe = async (p, s) => (await p.locator(s).count())
    ? espaces(await p.locator(s).first().innerText()) : "";
  const onglet = async cle => {
    if (cle === "temps") { await ouvrirLeTemps(pg); return; }
    await pg.locator(`[data-onglet="${cle}"]`).click();
    await pg.waitForTimeout(500);
  };
  /* Le soleil et la lune sont deux écrans d'une même destination : on ouvre Le
     ciel, puis on choisit lequel. */
  const ecranCiel = async (p, quel) => {
    await p.locator('[data-onglet="ciel"]').click();
    await p.waitForTimeout(400);
    await p.locator(`[data-ciel="${quel}"]`).click();
    await p.waitForTimeout(500);
  };
  /* Les cinq écrans de l'application, sous quatre destinations : le soleil et
     la lune s'ouvrent par le sélecteur du ciel, les autres par leur onglet. */
  const ouvrirEcran = async cle => {
    if (cle === "soleil" || cle === "lune") { await ecranCiel(pg, cle); return; }
    await onglet(cle);
    await pg.waitForTimeout(500);
  };

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
      /* Le repli de la pluie dans l'heure passe par le même hôte que la prévision.
         Il se reconnaît à sa colonne, demandée nulle part ailleurs. */
      if (u.includes("minutely_15")) {
        etat.appelsRepli.push(u);
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(repliCorps(etat.profilRepli, FIGE, u)) });
        return;
      }
      if (u.includes("sunshine_duration")) { servirBeauTemps(u, route); return; }
      /* La grille des nappes de la carte se reconnaît à ses colonnes : la
         direction du vent n'est demandée nulle part ailleurs. */
      if (u.includes("current=") && u.includes("wind_direction_10m")) {
        etat.appelsGrille.push(u);
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(grilleCorps(u)) });
        return;
      }
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
    await ouvrirPage(p);
    await reposer(p, 2250);
    return [c, p, urls];
  };

  /* Trois lieux suivis sur un axe nord-sud. La charge d'essai fait monter le
     soleil vers le nord aujourd'hui, la température vers le sud : les deux
     classements possibles sont exactement inverses l'un de l'autre, et celui qui
     paraît dit lequel des deux la feuille suit. */
  const REGL_BEAU = { ...FAIN, suivies: [
    { commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3 },
    { commune: "Nordville", codePostal: "10000", lat: 48.2, lon: 4.3 },
    { commune: "Sudville", codePostal: "71000", lat: 46.9, lon: 4.3 },
  ] };

  const METEO_NUE = () => JSON.parse(JSON.stringify(METEO));

  /* `sansFond` ouvre la carte sans le fond enrichi du jalon 19 : les contrôles
     qui lisent la couleur d'une nappe en un point ne doivent pas tomber sur
     le nom d'une ville ou sur une rivière. Le fond a sa propre section. */
  const ouvrirCarte = async (reglages, futur = 0, { sansFond = false } = {}) => {
    etat.radarFutur = futur;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(reglages || FAIN, FIGE));
    if (sansFond) await c.addInitScript(() => { window.__sansFond = true; });
    await brancherRoutes(c);
    const p = await c.newPage();
    await ouvrirPage(p);
    await p.locator('[data-onglet="carte"]').click();
    await p.waitForTimeout(900);
    return [c, p];
  };

  const finir = async () => {
    for (const c of contextes) await c.close().catch(() => {});
    return { n, ko, lignes, erreurs };
  };
  return {
    titre, dire, ok, etat, brancherRoutes, nav, ctx, pg, erreurs,
    appelsHoraire, appelsTous, ouvrirPage, reposer, RACINE_HTTP, RACINE, ICI, CAPTURES,
    ouvrirLeTemps, phrasesConseils, txt, txtDe, onglet, ecranCiel, ouvrirEcran,
    CADRE, meteoRes, ctxReponse, REGL_BEAU, METEO_NUE, ouvrirCarte,
    finir,
  };
};
