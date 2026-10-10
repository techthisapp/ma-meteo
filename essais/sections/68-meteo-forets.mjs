/* La météo des forêts de Météo-France. Section écrite le 10 octobre 2026,
   version 188. Elle part d'un état neuf préparé par essais/banc.mjs ; le faux
   service est décrit dans `faux-services.mjs`, au voisinage de `foretCsv`. */
import { FIGE, FAIN, amorceGardee, foretCsv } from "../faux-services.mjs";

export const titre = "La météo des forêts";
export const avecPage = false;

const CLE = "cle-d-essai-des-controles-de-ma-meteo";

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, ouvrirCarte, reposer } = T;
  const accueil = async reglages => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(reglages, FIGE));
    await brancherRoutes(c);
    await c.route(/api\.rainviewer\.com/, r => r.abort());
    const p = await c.newPage();
    await ouvrirPage(p);
    await reposer(p, 2500);
    return [c, p];
  };

  const [c0, p0] = await accueil(FAIN);
  /* La lecture de la carte : niveaux, jours visés, département sans zéro. */
  ok("la carte se lit par département, pour le lendemain et le surlendemain de sa date",
    await p0.evaluate(async csv => {
      const F = await import("/src/foret.js");
      const d = F.lire(csv);
      return [F.jourDe(d.ref, 1), F.jourDe(d.ref, 2), F.niveau(d, "21", "2026-08-18"), F.niveau(d, "21", "2026-08-19"),
        F.niveau(d, "1", "2026-08-18"), String(F.niveau(d, "21", "2026-08-20")), F.nomDe(4)].join(" ");
    }, foretCsv(false)) === "2026-08-18 2026-08-19 3 4 1 null Très élevé");

  await p0.locator('[data-onglet="carte"]').click();
  await reposer(p0, 1500);
  const tuileSansCle = await p0.evaluate(() => ({ panneau: !!document.getElementById("caPluie"), foret: !!document.getElementById("caForet") }));
  ok("sans clé, la météo des forêts ne se demande pas et sa tuile ne paraît pas",
    etat.appelsForet.length === 0 && tuileSansCle.panneau && !tuileSansCle.foret,
    `${etat.appelsForet.length} appels ; ${JSON.stringify(tuileSansCle)}`);
  await c0.close();

  /* Avec la clé : le danger élevé se dit aujourd'hui, très élevé demain. */
  etat.appelsForet.length = 0;
  const [c1, p1] = await accueil({ ...FAIN, clepiaf: CLE });
  const texte = await p1.evaluate(() => [...document.querySelectorAll("#ecran [data-phrase]")].map(x => x.dataset.phrase).join(" | "));
  ok("le danger d'incendie élevé se dit aujourd'hui et le très élevé demain, avec le département",
    texte.includes("Danger d'incendie de forêt élevé aujourd'hui, Côte-d'Or.")
    && texte.includes("Danger d'incendie de forêt très élevé demain, Côte-d'Or.")
    && etat.appelsForet.length === 1 && /carte\/encours\?apikey=/.test(etat.appelsForet[0]),
    `${etat.appelsForet.length} appels ; ${texte}`);
  await c1.close();

  /* La carte : la tuile dans la famille de l'air, la légende du jour, et la
     Côte-d'Or teintée d'orange. */
  const [, q] = await ouvrirCarte({ ...FAIN, clepiaf: CLE, nappe: "foret", pluiecarte: false, vigicarte: false,
    foudrecarte: false }, 0, { sansFond: true });
  await reposer(q, 2000);
  const carte = await q.evaluate(() => {
    const b = document.getElementById("caForet");
    return { famille: b?.closest(".ca-fam")?.getAttribute("aria-label"), coche: b?.getAttribute("aria-checked"),
      titre: document.getElementById("caLegTitre").textContent,
      grads: [...document.querySelectorAll("#caGrads span")].map(s => s.textContent).join("|"),
      credit: document.getElementById("caCredit").textContent };
  });
  ok("la nappe du danger d'incendie se choisit dans l'air, avec sa légende du jour et sa source",
    carte.famille === "Air" && carte.coche === "true" && carte.titre === "Danger d'incendie, aujourd'hui"
    && carte.grads === "Faible|Très élevé" && /Météo des forêts Météo-France/.test(carte.credit),
    JSON.stringify(carte));
  /* Les départements se teintent de leur niveau : l'orange du danger élevé
     pour la Côte-d'Or, le rouge du très élevé pour les Bouches-du-Rhône, le
     vert du faible pour l'Ain et l'Yonne. */
  const teintes = await q.evaluate(() => {
    const cv = document.getElementById("caToile"), ctx = cv.getContext("2d");
    const n = { orange: 0, rouge: 0, vert: 0 };
    for (let y = 0; y < cv.height; y += 6) {
      for (let x = 0; x < cv.width; x += 6) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 220 && g > 150 && g < 200 && b < 150) n.orange++;
        else if (r > 200 && g < 150 && b < 150) n.rouge++;
        else if (g > r + 15 && g > b + 15) n.vert++;
      }
    }
    return n;
  });
  ok("chaque département se teinte de son niveau du jour", teintes.orange > 20 && teintes.rouge > 20 && teintes.vert > 20,
    JSON.stringify(teintes));

  /* Hors saison, la dernière carte se montre datée, et l'accueil se tait. */
  etat.foretVieille = true;
  const [c2, p2] = await accueil({ ...FAIN, clepiaf: CLE });
  const texte2 = await p2.evaluate(() => document.getElementById("ecran").textContent);
  await c2.close();
  const [, q2] = await ouvrirCarte({ ...FAIN, clepiaf: CLE, nappe: "foret", pluiecarte: false, vigicarte: false,
    foudrecarte: false }, 0, { sansFond: true });
  await reposer(q2, 2000);
  const titre2 = await q2.evaluate(() => document.getElementById("caLegTitre").textContent);
  etat.foretVieille = false;
  ok("hors saison, l'accueil se tait et la carte dit la date de la dernière carte",
    !/Danger d'incendie/.test(texte2) && titre2 === "Danger d'incendie, le 19 juillet, hors saison", titre2);
};
