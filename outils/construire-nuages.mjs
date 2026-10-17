/* Les textures des nuages du ciel WebGL de l'accueil, version 216 :
   `node outils/construire-nuages.mjs`, ou avec une liste de sortes, par
   exemple `cumulus,cirrus`. Une dizaine de secondes, sans réseau.

   Le rendu volumique se fait dans le Chromium de Playwright, sur la carte
   graphique du poste : `outils/nuages.html` porte le programme. Chaque
   texture fait 1024 points de côté, en WebP, entre cinquante et trois cents
   kilooctets. Les réglages ci-dessous ont été choisis sur la maquette du
   17 octobre 2026 : couverture, gonflement des cellules, érosion des bords,
   densité, étirement dans le sens du vent. Changer la graine donne un autre
   tirage de la même sorte. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, "..", "donnees", "nuages");

const BASE = { uF: 4, uEtire: 1, uCouv: 0.5, uErosion: 0.35, uBase: 0.05, uSommet: 0.95, uEpais: 0.35, uDens: 9, uWorley: 0.5, uGraine: 1, uGrain: 1, uAmas: 0.6 };
const SORTES = {
  cumulus: { ...BASE, uF: 3, uCouv: 0.5, uErosion: 0.35, uWorley: 1.0, uDens: 12, uAmas: 0.9, uGraine: 3 },
  dense: { ...BASE, uF: 3, uCouv: 0.78, uErosion: 0.28, uWorley: 0.9, uDens: 14, uAmas: 0.5, uGraine: 7 },
  stratus: { ...BASE, uF: 3, uEtire: 2, uCouv: 0.9, uErosion: 0.18, uWorley: 0.75, uDens: 9, uAmas: 0.35, uGraine: 11, uGrain: 0.6 },
  alto: { ...BASE, uF: 8, uCouv: 0.6, uErosion: 0.3, uWorley: 1.0, uDens: 11, uAmas: 1, uBase: 0.25, uSommet: 0.75, uGraine: 5, uGrain: 0.5 },
  fractus: { ...BASE, uF: 3, uEtire: 2, uCouv: 0.55, uErosion: 0.55, uWorley: 0.7, uDens: 11, uAmas: 0.8, uGraine: 13, uGrain: 1.4 },
  /* Les cirrus sont une couche mince très étirée : rendus en fibres à plat,
     ils faisaient penser à des rides sur l'eau. */
  cirrus: { ...BASE, uF: 2, uEtire: 12, uCouv: 0.62, uErosion: 0.5, uWorley: 0.3, uDens: 8, uAmas: 1, uBase: 0.35, uSommet: 0.65, uGraine: 2, uGrain: 1 },
};

const seules = process.argv[2] ? process.argv[2].split(",") : Object.keys(SORTES);
fs.mkdirSync(SORTIE, { recursive: true });
const nav = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await nav.newPage();
page.on("pageerror", e => console.error("erreur de la page :", e.message));
await page.goto(pathToFileURL(path.join(ICI, "nuages.html")).href);
for (const s of seules) {
  if (!SORTES[s]) { console.error(`sorte inconnue : ${s}`); continue; }
  const t0 = Date.now();
  const d = await page.evaluate(r => window.rendre(1024, r), SORTES[s]);
  const b = Buffer.from(d.split(",")[1], "base64");
  fs.writeFileSync(path.join(SORTIE, `${s}.webp`), b);
  console.log(`${s} : ${Math.round(b.length / 1024)} ko, ${Date.now() - t0} ms`);
}
await nav.close();
