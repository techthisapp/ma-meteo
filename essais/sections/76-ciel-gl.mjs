/* Le ciel WebGL de l'accueil, version 216, demandé par Jérôme le 17 octobre
   2026 sur maquette : des nuages en textures calculées à l'avance, posés en
   plusieurs plans par la carte graphique. Le banc coupe ce ciel d'office,
   `__cielSimple` ; la section le rallume par `__cielGL`. Le Chromium des
   contrôles peint en WebGL par SwiftShader, sur le Mac comme sur les
   machines de GitHub. Section écrite le 17 octobre 2026 ; elle part d'un état
   neuf préparé par essais/banc.mjs. */
import fs from "node:fs";
import path from "node:path";
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Le ciel en WebGL";
export const avecPage = false;

const TEXTURES = ["cumulus", "dense", "stratus", "alto", "fractus", "cirrus"];

export default async T => {
  const { nav, ok, brancherRoutes, ouvrirPage, reposer, RACINE } = T;
  const contexte = async gl => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, FIGE));
    if (gl) await c.addInitScript(() => { window.__cielGL = true; });
    await brancherRoutes(c);
    await c.route(/api\.rainviewer\.com/, r => r.abort());
    return c;
  };

  /* Les textures sont dans la coque hors ligne, et le module aussi. */
  const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
  const manquantes = TEXTURES.filter(n => !sw.includes(`"./donnees/nuages/${n}.webp"`)
    || !fs.existsSync(path.join(RACINE, "donnees", "nuages", `${n}.webp`)));
  ok("les six textures de nuages existent et sont dans la coque hors ligne",
    manquantes.length === 0, manquantes.join(", "));

  const c = await contexte(true);
  const p = await c.newPage();
  const demandes = [];
  p.on("request", q => { if (/open-meteo\.com\/v1\/forecast/.test(q.url()) && q.url().includes("hourly=")) demandes.push(decodeURIComponent(q.url())); });
  await ouvrirPage(p);
  await reposer(p, 3000);
  await p.waitForTimeout(800);

  /* L'accueil plein ciel est peint en WebGL. */
  const etat = await p.evaluate(async () => {
    const Te = await import("/src/temps.js");
    const t = document.getElementById("ciTemps");
    return { gl: t?.dataset.gl, webgl: Te.enWebGL(t), anime: Te.anime() };
  });
  ok("l'accueil plein ciel peint son ciel en WebGL, et l'anime",
    etat.gl === "1" && etat.webgl && etat.anime, JSON.stringify(etat));

  /* Le Soleil est peint par la carte graphique, version 217 : le disque
     plat du panneau reste en place pour le toucher, mais transparent. */
  const disque = await p.evaluate(() => {
    const f = document.getElementById("ciFeu");
    return f ? getComputedStyle(f).opacity : "absent";
  });
  ok("sous le ciel WebGL, le disque plat du Soleil laisse la place au Soleil peint",
    disque === "0" || disque === "absent", disque);

  /* Des nuages se voient : la toile, photographiée seule, n'est pas
     uniforme. Le ciel d'essai de Fain porte un tiers de cumulus. */
  /* La toile se lit dans l'image même où elle vient d'être peinte : le
     tampon de WebGL n'est gardé que jusqu'à l'affichage. */
  const ecart = () => p.evaluate(() => new Promise(res => requestAnimationFrame(() => {
    const t = document.getElementById("ciTemps");
    const cv = document.createElement("canvas"); cv.width = 60; cv.height = 120;
    const x = cv.getContext("2d"); x.drawImage(t, 0, 0, 60, 120);
    const d = x.getImageData(0, 0, 60, 120).data;
    let s = 0, s2 = 0, n = 0;
    for (let k = 0; k < d.length; k += 4) {
      const a = d[k + 3] / 255;
      const l = (d[k] * 0.2126 + d[k + 1] * 0.7152 + d[k + 2] * 0.0722) * a;
      s += l; s2 += l * l; n++;
    }
    res(Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)));
  })));
  const e = await ecart();
  ok("le ciel WebGL montre des nuages, la toile lue n'est pas unie",
    e > 6, `écart type de la clarté ${e.toFixed(1)}`);

  /* Les plans suivent le temps : des cumulus par ciel mêlé, une nappe par
     ciel couvert, des lambeaux bas sous la pluie, rien par ciel clair. */
  const plans = await p.evaluate(async () => {
    const G = await import("/src/ciel-gl.js");
    const base = { cumulus: 0, nappe: 0, lame: 0, genre: "", brouillard: 0, orage: false };
    const noms = d => G.plansDe({ ...base, ...d }, 0).map(x => x.tex);
    return {
      mele: noms({ cumulus: 0.35 }), couvert: noms({ nappe: 0.95 }),
      pluie: noms({ nappe: 0.9, lame: 3, genre: "pluie" }), clair: noms({}),
      autre: [0, 1, 2].map(g => G.plansDe({ ...base, cumulus: 0.35 }, g).map(x => x.tex).join("+")),
    };
  });
  ok("les plans de nuages suivent le temps : cumulus, nappe, lambeaux sous la pluie",
    plans.mele.includes("cumulus") && plans.couvert.includes("stratus") && !plans.couvert.includes("cumulus")
    && plans.pluie.includes("fractus") && plans.pluie.length <= 4
    && !plans.clair.some(n => n !== "cirrus"),
    JSON.stringify(plans));
  ok("le même temps se peint en plusieurs variantes selon le tirage",
    new Set(plans.autre).size >= 2, plans.autre.join(" | "));

  /* Les trois étages de nuages de la prévision, version 218, arrivent sur
     la toile : l'heure en cours et la suivante. Les faux services portent les
     nuages bas égaux à la couverture totale. */
  const etages = await p.evaluate(() => {
    const t = document.getElementById("ciTemps");
    return { etages: t.dataset.etages, couv: t.dataset.couv };
  });
  const e6 = (etages.etages || "").split(",").map(Number);
  const demande = demandes.some(u => ["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"].every(c => u.includes(c)));
  ok("les trois étages de nuages, bas, moyens et hauts, arrivent au ciel de l'accueil",
    demande && e6.length === 6 && e6.every(Number.isFinite) && Math.abs(e6[0] - Number(etages.couv) * 100) <= 1 && e6[4] === 25,
    JSON.stringify({ ...etages, demande }));

  /* La part du ciel couverte suit la couverture annoncée, à dix points près.
     Un écran ne voit qu'une dizaine de nuages, et sa part couverte varie au
     fil des minutes comme dans un vrai ciel : la mesure se fait sur une
     toile élargie à plusieurs carreaux de texture, la moyenne que l'œil voit
     passer. */
  const couverture = await p.evaluate(async () => {
    const t = document.getElementById("ciTemps");
    t.style.width = "2400px";
    await new Promise(r => setTimeout(r, 300));
    const lire = () => new Promise(res => requestAnimationFrame(() => {
      const v = document.createElement("canvas"); v.width = 480; v.height = 160;
      const x = v.getContext("2d"); x.drawImage(t, 0, 0, 480, 160);
      const d = x.getImageData(0, 0, 480, 160).data;
      let k = 0, m = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 128) k++; m++; }
      res(100 * k / m);
    }));
    const out = {};
    for (const n of [10, 25, 50, 75, 90]) {
      t.dataset.etages = [n, n, 0, 0, 0, 0].join(",");
      let s = 0;
      for (let j = 0; j < 3; j++) { await new Promise(r => setTimeout(r, 500)); s += await lire(); }
      out[n] = Math.round(s / 3);
    }
    t.style.width = "";
    return out;
  });
  ok("la part du ciel couverte suit la couverture annoncée, à dix points près",
    Object.entries(couverture).every(([n, v]) => Math.abs(v - Number(n)) <= 10), JSON.stringify(couverture));

  /* Chaque étage a ses nuages, et le passage à l'heure suivante est
     progressif. */
  const sortes = await p.evaluate(async () => {
    const G = await import("/src/ciel-gl.js");
    const E = await import("/src/etalonnage-nuages.js");
    const base = { cumulus: 0, nappe: 0, lame: 0, genre: "", brouillard: 0, orage: false };
    const noms = e => G.plansDe({ ...base, etages: e }, 0).map(x => `${x.tex}@${x.prof}`);
    /* L'étalonnage : au seuil rendu, la part de la texture au-dessus est la
       part demandée, à un trente-deuxième près. */
    const ecarts = [];
    for (const [tex, c] of [["cumulus", 0.3], ["dense", 0.6], ["alto", 0.5], ["stratus", 0.9], ["cirrus", 0.15]]) {
      const s = G.seuil(tex, c).s;
      const part = E.QUANTILES[tex].filter(q => q > s).length / 33;
      ecarts.push(Math.abs(part - c));
    }
    return {
      hauts: noms({ b: 0, m: 0, h: 0.15 }), voile: noms({ b: 0, m: 0, h: 0.7 }),
      moyens: noms({ b: 0, m: 0.5, h: 0 }), bas: noms({ b: 0.95, m: 0, h: 0 }),
      demi: G.etagesA([20, 80, 0, 40, 10, 10], 0.5),
      ecart: Math.max(...ecarts),
    };
  });
  ok("chaque étage a ses nuages : cirrus ou voile en haut, altocumulus au milieu, nappe en bas",
    sortes.hauts.join() === "cirrus@0" && sortes.voile.join() === "stratus@0"
    && sortes.moyens.join() === "alto@0.3" && sortes.bas.every(n => n.startsWith("stratus") || n.startsWith("dense")),
    JSON.stringify(sortes));
  ok("les étages glissent vers ceux de l'heure suivante au fil des minutes",
    sortes.demi && Math.abs(sortes.demi.b - 0.5) < 0.001 && Math.abs(sortes.demi.m - 0.2) < 0.001, JSON.stringify(sortes.demi));
  ok("le seuil de chaque texture vient de son étalonnage",
    sortes.ecart <= 1 / 32 + 0.01, sortes.ecart.toFixed(3));

  /* Version 221 : les nuages proches traversent l'écran en une minute
     environ par vent de 15 km/h, et la dérive reste entre zéro et un carreau
     même après des jours d'animation. */
  const derive = await p.evaluate(async () => {
    const G = await import("/src/ciel-gl.js");
    const largeur = (390 / 844) / (0.42 + 0.53 * 0.92);
    return { traversee: largeur / G.vitesse(15, 0.92), longue: G.decalage(3e6, 15, 0.92) };
  });
  ok("les nuages proches traversent l'écran en une minute environ, sans hâte",
    derive.traversee >= 40 && derive.traversee <= 240, `${Math.round(derive.traversee)} s`);
  ok("la dérive des nuages reste bornée, même après des jours d'animation",
    derive.longue >= 0 && derive.longue < 1, String(derive.longue));

  /* L'application installée dessine jusque sous la barre d'état. */
  const page = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
  ok("l'application installée occupe tout l'écran, jusque sous la barre d'état",
    /apple-mobile-web-app-status-bar-style" content="black-translucent"/.test(page) && /viewport-fit=cover/.test(page));

  /* Le ciel WebGL ne se met pas en pause au glissement : ses plans glissent
     avec la page. */
  const glisse = await p.evaluate(async () => {
    const Te = await import("/src/temps.js");
    window.scrollTo(0, 260);
    await new Promise(r => setTimeout(r, 90));
    const pendant = Te.anime();
    window.scrollTo(0, 0);
    return { pendant };
  });
  ok("le ciel WebGL continue de s'animer pendant le glissement", glisse.pendant, JSON.stringify(glisse));
  await c.close();

  /* Sans la demande, le dessin sur toile reste en place : c'est le repli des
     navigateurs sans WebGL, et le ciel des autres contrôles. */
  const c2 = await contexte(false);
  const p2 = await c2.newPage();
  await ouvrirPage(p2);
  await reposer(p2, 3000);
  const repli = await p2.evaluate(async () => {
    const Te = await import("/src/temps.js");
    const t = document.getElementById("ciTemps");
    return { webgl: Te.enWebGL(t), anime: Te.anime() };
  });
  ok("sans WebGL, le ciel garde son dessin sur toile", !repli.webgl && repli.anime, JSON.stringify(repli));
  await c2.close();
};
