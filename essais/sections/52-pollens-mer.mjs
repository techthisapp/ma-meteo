/* Les pollens et la mer sur la carte. Section écrite le 3 octobre 2026 pour le
   jalon 19, lot 5b ; elle part d'un état neuf préparé par essais/banc.mjs. Les
   grilles fabriquées sont décrites dans les routes de l'air et de la mer des
   faux services. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Les pollens et la mer";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(p, 1500);

  /* L'échelle d'un pollen : hors saison sous un, en saison de un à deux, au
     pic à deux, trois au plus. */
  const echelle = await p.evaluate(async () => {
    const N = await import("/src/nappe.js");
    const g = { saison: 3, pic: 50 };
    return [0, 1.5, 3, 26.5, 50, 100, 500].map(c => Math.round(N.indicePollen(c, g) * 100) / 100).join(" ");
  });
  ok("l'indice d'un pollen suit ses deux seuils : saison à un, pic à deux, trois au plus",
    echelle === "0 0.5 1 1.5 2 2.5 3", echelle);

  const choisir = async id => {
    await p.locator("#caCouches").click();
    await p.waitForTimeout(150);
    await p.locator(`#${id}`).click();
    await p.locator("#caCouches").click();
    await reposer(p, 1500);
  };
  /* La couleur d'un point de la toile, et la teinte de la carte sans nappe au
     même point, pour savoir si la nappe y a peint. */
  const pixel = (la, lo) => p.evaluate(async ([la, lo]) => {
    const C = await import("/src/carte.js");
    const cv = document.getElementById("caToile");
    const vue = { lat: 46.4, lon: 2.2, z: 5.13 };
    const q = C.surEcran(vue, la, lo, cv.clientWidth, cv.clientHeight);
    return [...cv.getContext("2d").getImageData(Math.round(q.x * 2), Math.round(q.y * 2), 1, 1).data].slice(0, 3).join(",");
  }, [la, lo]);
  const avant = { bordeaux: await pixel(44.6, 0.3), lille: await pixel(50.4, 3.1), golfe: await pixel(45.5, -3.5),
    centre: await pixel(46.6, 2.5) };

  await choisir("caPollens");
  const pollens = { bordeaux: await pixel(44.6, 0.3), lille: await pixel(50.4, 3.1),
    titre: await p.evaluate(() => document.getElementById("caLegTitre").textContent),
    grads: await p.evaluate(() => [...document.querySelectorAll("#caGrads span")].map(x => x.textContent).join(",")) };
  ok("les pollens se peignent où ils sont en saison, et la légende nomme les seuils",
    etat.appelsPollens.length === 1 && pollens.bordeaux !== avant.bordeaux && pollens.lille === avant.lille
    && pollens.titre === "Pollens, le plus fort des six, maintenant" && pollens.grads === "Saison,Pic,Très fort",
    JSON.stringify({ appels: etat.appelsPollens.length, avant, pollens }));

  await choisir("caVagues");
  const vagues = { golfe: await pixel(45.5, -3.5), centre: await pixel(46.6, 2.5),
    titre: await p.evaluate(() => document.getElementById("caLegTitre").textContent) };
  ok("les vagues se peignent sur la mer et non sur la terre de France",
    etat.appelsMer.length === 1 && vagues.golfe !== avant.golfe && vagues.centre === avant.centre
    && vagues.titre === "Vagues, hauteur maintenant", JSON.stringify({ appels: etat.appelsMer.length, avant, vagues }));

  /* La mer près des côtes : une maille de terre ne laisse pas la bande
     côtière sans valeur. La température de l'eau se lit sur la même lecture. */
  const cote = await p.evaluate(async () => {
    const N = await import("/src/nappe.js");
    const d = await N.chargerMer();
    return { stricte: N.valeurA(d.vagues, 47.3, -2.0), partielle: N.valeurA(d.vagues, 47.3, -2.0, true),
      eau: N.valeurA(d.eauMer, 42.5, 5, true) };
  });
  await choisir("caEauMer");
  ok("la mer garde une valeur près des côtes, et l'eau de mer se lit sans nouvelle lecture",
    cote.stricte === null && cote.partielle > 0 && cote.eau > 20 && etat.appelsMer.length === 1, JSON.stringify(cote));
};
