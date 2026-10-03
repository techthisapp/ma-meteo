/* Les retouches des écrans du 3 octobre 2026 : le « i » à hauteur du titre,
   l'engrenage des réglages, la mise en page des réglages, la face sombre de
   la Lune et le zoom d'un doigt de la carte. Elle part d'un état neuf préparé
   par essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Les retouches des écrans";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ecranCiel, reposer, ouvrirCarte } = T;

  /* Le « i » d'une carte titrée se tient à droite de son titre. */
  const placesDe = () => pg.evaluate(() => [...document.querySelectorAll("#ecran details.aide, #feuille-corps details.aide")]
    .filter(d => d.checkVisibility?.() !== false && d.querySelector("summary").getBoundingClientRect().width > 0)
    .map(d => {
      const carte = d.closest(".carte");
      const t = carte?.querySelector(":scope > .carte-tete, :scope > h3");
      if (!t) return null;
      const s = d.querySelector("summary").getBoundingClientRect(), r = t.getBoundingClientRect(), c = carte.getBoundingClientRect();
      const centre = s.top + s.height / 2;
      return { ok: centre >= r.top - 4 && centre <= r.bottom + 4 && s.right <= c.right + 1 && s.left > r.left + r.width / 2,
        titre: t.textContent.trim().slice(0, 30) };
    }).filter(Boolean));
  const places = [];
  await onglet("semaine"); await reposer(pg, 1200); places.push(...await placesDe());
  await ecranCiel(pg, "soleil"); await reposer(pg, 1200); places.push(...await placesDe());
  await pg.locator("#btnReglages").click(); await pg.waitForTimeout(600); places.push(...await placesDe());
  const mal = places.filter(p => !p.ok).map(p => p.titre);
  ok("le « i » d'une carte titrée se tient à droite de son titre", places.length >= 4 && mal.length === 0,
    JSON.stringify({ n: places.length, mal }));

  /* Les réglages : l'engrenage, les boutons alignés sur le texte, les sources
     empilées. */
  const reg = await pg.evaluate(() => {
    const svg = document.querySelector("#btnReglages svg");
    const dents = (svg.querySelector("path")?.getAttribute("d") || "").split("L").length;
    const version = [...document.querySelectorAll("#feuille-corps .rangee-txt")].find(e => e.textContent === "Version");
    const b = document.getElementById("rgChercher");
    const src = [...document.querySelectorAll("#feuille-corps .rg-src")];
    return { dents, ecart: Math.abs(b.getBoundingClientRect().left - version.getBoundingClientRect().left),
      sources: src.length, empilees: src.every(r => { const [n, v] = r.querySelectorAll(".rangee-txt > *");
        return n && v && v.getBoundingClientRect().top >= n.getBoundingClientRect().bottom - 1; }) };
  });
  ok("les réglages ont un engrenage, des boutons alignés sur le texte et des sources empilées",
    reg.dents >= 32 && reg.ecart <= 2 && reg.sources >= 10 && reg.empilees, JSON.stringify(reg));
  await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(400);

  /* La face sombre de la Lune reste perceptible de jour, et dans la vignette. */
  await ecranCiel(pg, "lune"); await reposer(pg, 1200);
  const lune = await pg.evaluate(async () => {
    const R = await import("/src/relief.js");
    /* Un premier croissant éclairé à un tiers, sous un ciel de plein jour : un
       point de la part sombre garde de l'opacité. */
    const cv = R.disque(120, 0, 0.3, 1);
    const x = cv.getContext("2d"), c = cv.width / 2;
    const sombre = x.getImageData(Math.round(c - cv.width * 0.25), Math.round(c), 1, 1).data;
    const v = document.getElementById("ptLune");
    const d = v.getContext("2d").getImageData(0, 0, v.width, v.height).data;
    let noirs = 0, pleins = 0;
    for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 200) { pleins++; if (d[k] + d[k + 1] + d[k + 2] < 120) noirs++; }
    return { alpha: sombre[3], gris: sombre[0], pleins, noirs };
  });
  ok("la face sombre de la Lune reste perceptible de jour et dans la vignette",
    lune.alpha >= 90 && lune.gris >= 60 && lune.pleins > 50 && lune.noirs === 0, JSON.stringify(lune));

  /* La carte : un double appui dont le second doigt glisse vers le bas
     grossit, vers le haut réduit ; un double appui simple zoome d'un cran. */
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(p, 1500);
  const b = await p.locator("#caToile").boundingBox();
  const x0 = b.x + b.width * 0.3, y0 = b.y + b.height * 0.45;
  /* Le zoom se lit dans le cadrage que la carte garde, 800 ms après le geste. */
  const z = () => p.evaluate(() => JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").vuecarte?.z ?? null);
  const zoomA = async dy => {
    await p.mouse.click(x0, y0); await p.waitForTimeout(80);
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move(x0, y0 + dy / 2, { steps: 4 }); await p.mouse.move(x0, y0 + dy, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(1200);
    return z();
  };
  const z0 = await (async () => { await p.mouse.move(x0 + 40, y0); await p.mouse.down(); await p.mouse.move(x0 + 44, y0, { steps: 2 });
    await p.mouse.up(); await p.waitForTimeout(1200); return z(); })();
  const zBas = await zoomA(90);
  await p.waitForTimeout(400);
  const zHaut = await zoomA(-90);
  ok("un double appui suivi d'un glissement zoome d'un doigt, vers le bas pour grossir, vers le haut pour réduire",
    z0 !== null && zBas - z0 > 0.6 && zBas - z0 < 1.4 && zBas - zHaut > 0.6, JSON.stringify({ z0, zBas, zHaut }));
};
