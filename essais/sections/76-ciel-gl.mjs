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
