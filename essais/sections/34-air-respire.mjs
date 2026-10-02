/* L'air qu'on respire. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "L'air qu'on respire";
export const avecPage = true;

export default async T => {
  const { etat, ok, phrasesConseils, txt, txtDe, meteoRes, ctxReponse, METEO_NUE } = T;
  const ouvrirAir = async p => {
    await p.locator('.porte[data-feuille="air"]').click();
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

  /* ---------- L'indice officiel ----------

     Le service d'Atmo France met une vingtaine de secondes quand celui de
     Copernicus répond en une fraction : la feuille s'ouvre sans lui et se refait
     quand il arrive. Le contrat, relevé le 14 septembre 2026 sur le vrai
     service : la zone rendue n'est pas toujours la commune demandée, et le nom
     écrit doit être celui que la source donne. */
  const lignesApres = async (p, ms) => {
    await p.waitForTimeout(ms);
    return p.evaluate(() =>
      [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
        nom: r.querySelector(".rangee-txt b")?.textContent.trim() || "",
        sous: r.querySelector(".rangee-txt span")?.textContent || "",
        val: r.querySelector(".rangee-val")?.textContent.replace(/\s+/g, " ").trim() || "",
      })));
  };
  const titresCartes = p => p.evaluate(() =>
    [...document.querySelectorAll("#feuille-corps .carte-tete h3")].map(h => h.textContent.trim()));

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

  /* L'indice officiel, carte par carte. */
  etat.appelsAtmo.length = 0;
  etat.atmoLent = 1200;
  const [ctxOff, pgOff] = await ctxReponse(METEO_NUE);
  await pgOff.locator('.porte[data-feuille="air"]').click();

  const avantOff = await lignesApres(pgOff, 400);
  ok("la feuille s'ouvre sans attendre l'indice officiel",
    avantOff.length > 0 && !avantOff.some(l => l.nom === "Genay"),
    avantOff.map(l => l.nom).join(" / "));

  const apresOff = await lignesApres(pgOff, 1800);
  ok("l'indice officiel paraît quand le service a répondu",
    apresOff.some(l => l.nom === "Genay"), apresOff.map(l => l.nom).join(" / "));

  /* Le service rend les zones d'un rayon : la charge en porte trois, dont une
     plus séduisante par son rang. Retenir la première rendue afficherait un
     indice relevé à douze kilomètres. */
  ok("la zone retenue est la plus proche, non la première rendue",
    apresOff.some(l => l.nom === "Genay") && !apresOff.some(l => l.nom === "Zone lointaine"),
    apresOff.map(l => l.nom).join(" / "));

  ok("le nom écrit est celui de la source, non celui de la commune choisie",
    !apresOff.some(l => l.nom === "Fain-lès-Moutiers"),
    apresOff.map(l => l.nom).join(" / "));

  ok("les cinq sous-indices paraissent avec leur niveau",
    (() => {
      const i = apresOff.findIndex(l => l.nom === "Genay");
      if (i < 0) return false;
      const cinq = apresOff.slice(i + 1, i + 6);
      const noms = ["Particules fines", "Particules", "Ozone",
        "Dioxyde d'azote", "Dioxyde de soufre"];
      return cinq.length === 5 && cinq.every((l, k) => l.nom === noms[k] && l.val.length > 1);
    })(), apresOff.slice(-6).map(l => `${l.nom}=${l.val}`).join(" / "));

  ok("l'indice retenu est le plus mauvais de ses cinq sous-indices",
    (() => {
      const l = apresOff.find(x => x.nom === "Genay");
      return !!l && /Dégradé 3$/.test(l.val);
    })(), apresOff.find(x => x.nom === "Genay")?.val);

  ok("la requête demande le point de la commune, en projection de Mercator",
    etat.appelsAtmo.length > 0
    && /DWITHIN\(the_geom,POINT\(478674 6024072\),15000,meters\)/
      .test(decodeURIComponent(etat.appelsAtmo[0]).replace(/\+/g, " ")),
    decodeURIComponent(etat.appelsAtmo[0] || "").slice(-120));

  ok("une seule requête part, quelle que soit la refonte de la feuille",
    etat.appelsAtmo.length === 1, `${etat.appelsAtmo.length} requêtes`);
  await ctxOff.close();

  /* Sans réponse du service, la feuille se lit telle quelle : l'air de
     Copernicus est déjà là, et cette carte ne fait que s'ajouter. */
  etat.appelsAtmo.length = 0;
  etat.atmoLent = 0; etat.atmoMuet = true;
  const [ctxOffMuet, pgOffMuet] = await ctxReponse(METEO_NUE);
  await pgOffMuet.locator('.porte[data-feuille="air"]').click();
  const muetDit = await lignesApres(pgOffMuet, 1200);
  ok("un service muet ne prive la feuille de rien",
    muetDit.some(l => l.nom === "Maintenant") && etat.appelsAtmo.length > 0
    && !(await titresCartes(pgOffMuet)).includes("Indice ATMO officiel"),
    (await titresCartes(pgOffMuet)).join(" / "));
  await ctxOffMuet.close();
  etat.atmoMuet = false;

  /* Un air dégradé se dit dans ce qui est à savoir, et pas en deçà. Les deux
     contextes ne diffèrent que par l'air servi. */
  const conseilsDe = async profil => {
    etat.profilAir = profil;
    const [c, p] = await ctxReponse(METEO_NUE);
    const dit = (await phrasesConseils(p, "#ecran .conseils .cj-l")).join(" | ");
    await c.close();
    etat.profilAir = "base";
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
  etat.profilAir = "ambroisie";
  const [ctxPic, pgPic] = await ctxReponse(METEO_NUE);
  const ditPic = (await phrasesConseils(pgPic, "#ecran .conseils .cj-l")).join(" | ");
  await ctxPic.close();
  const [ctxSansAmbroisie, pgSansAmbroisie] = await ctxReponse(METEO_NUE,
    { ...FAIN, pollensMuets: ["ambroisie"] });
  const ditMuet = (await phrasesConseils(pgSansAmbroisie, "#ecran .conseils .cj-l")).join(" | ");
  await ctxSansAmbroisie.close();
  etat.profilAir = "base";
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
    etat.profilAir = profil;
    const [c, p] = await ctxReponse(meteoRes(() => 23, h => (h >= 9 && h < 15 ? 16 : 26)));
    const dit = (await txtDe(p, ".pt-rep")).trim();
    const rangees = await ouvrirAir(p);
    await c.close();
    etat.profilAir = "base";
    /* Les deux rangées de la première carte, non toutes celles qui portent un
       niveau : l'indice officiel en ajoute six plus bas, avec les mêmes mots. */
    return { dit, air: rangees.filter(l => l.nom === "Maintenant" || l.nom === "Au plus haut") };
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

  /* ---------- Le temps sensible, apaisé quand un seul modèle le voit ----------

     Défaut relevé sur téléphone le 9 septembre 2026 à Paris, à 7 h 43 : l'écran
     annonçait « Bruine » et peignait la pluie, quand rien ne tombait et que trois
     autres applications donnaient « très nuageux ». AROME rendait le code 51 avec
     deux dixièmes de millimètre, le modèle global le code 2 avec zéro. L'écran du
     temps disait « Pluie : aucune » au même instant : deux réponses à la même
     question, sur deux écrans.

     Mesuré le 9 septembre sur huit villes et soixante-douze heures : sur
     vingt-sept heures qu'AROME annonce pluvieuses, quinze ont zéro millimètre chez
     le modèle global, avec une lame médiane d'un dixième et six dixièmes au plus.
     Le désaccord porte donc toujours sur des pluies très faibles. */
};
