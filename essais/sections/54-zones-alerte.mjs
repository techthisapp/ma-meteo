/* Les restrictions d'eau par zone d'alerte. Section écrite le 3 octobre 2026
   pour le jalon 19, lot 6 ; elle part d'un état neuf préparé par
   essais/banc.mjs. L'archive fabriquée, `zonesArchive` des faux services,
   porte une tuile au zoom 8 sur Fain : à l'ouest une zone en crise, à l'est
   une zone en vigilance, toutes deux en Côte-d'Or, département en crise. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Les zones d'alerte";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer, appuiLong } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, nappe: "eau", pluiecarte: false, foudrecarte: false, vigicarte: false }, 0,
    { sansFond: true });
  await reposer(p, 1500);
  const titre = () => p.evaluate(() => document.getElementById("caLegTitre").textContent);

  /* Sur le pays entier, les départements, sans lecture des zones. */
  const pays = { titre: await titre(), zones: etat.appelsZones.length };

  /* Au zoom d'un département, les zones : la zone en crise et la zone en
     vigilance ne portent plus la même couleur, alors que leur département
     les teignait d'une seule. */
  const pixel = (la, lo) => p.evaluate(async ([la, lo]) => {
    const C = await import("/src/carte.js");
    const cv = document.getElementById("caToile");
    const q = C.surEcran({ lat: 47.5, lon: 4.3, z: C.ZDEFAUT }, la, lo, cv.clientWidth, cv.clientHeight);
    return [...cv.getContext("2d").getImageData(Math.round(q.x * 2), Math.round(q.y * 2), 1, 1).data].slice(0, 3).join(",");
  }, [la, lo]);
  await p.locator("#caIci").click();
  await reposer(p, 2000);
  const zones = { titre: await titre(), crise: await pixel(47.3, 4.35), vigilance: await pixel(47.3, 4.9),
    plages: etat.appelsZones.slice() };
  ok("au zoom d'un département, les zones d'alerte remplacent les départements, chacune de sa couleur",
    pays.zones === 0 && pays.titre === "Restrictions d'eau, en vigueur"
    && zones.titre === "Restrictions d'eau, en vigueur, par zone d'alerte" && zones.crise !== zones.vigilance
    && zones.plages.length >= 3 && zones.plages.every(r => /^bytes=\d+-\d+$/.test(r)),
    JSON.stringify({ pays, zones }));

  /* Une tuile lue ne se relit pas : un petit déplacement ne demande rien. */
  const avant = etat.appelsZones.length;
  await p.locator("#caToile").focus();
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowLeft");
  await reposer(p, 1200);
  ok("une tuile de zones déjà lue ne se relit pas", etat.appelsZones.length === avant,
    `${avant} puis ${etat.appelsZones.length}`);

  /* La bulle d'un point nomme la zone la plus grave que VigiEau rend. */
  const b = await p.locator("#caToile").boundingBox();
  await appuiLong(p, b.x + b.width * 0.4, b.y + b.height * 0.7);
  await p.waitForTimeout(800);
  await reposer(p, 1200);
  const lignes = await p.evaluate(() => [...document.querySelectorAll("#caBulle .cb-l")].map(x => x.textContent));
  ok("la bulle d'un point nomme sa zone d'alerte", lignes.some(t => /^Restriction d'eau : \S+, .+/.test(t)), JSON.stringify(lignes));
};
