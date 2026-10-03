/* Le point touché, la consultation et la recherche sur la carte. Section
   écrite le 3 octobre 2026 pour le jalon 19, lot 4 ; elle part d'un état neuf
   préparé par essais/banc.mjs. Le service d'adresses des faux services nomme
   tout point « Grenoble ». */
import { FAIN } from "../faux-services.mjs";

export const titre = "Le point touché et la recherche";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer, appuiLong } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false }, 0);
  await reposer(p, 2000);
  const boite = await p.locator("#caToile").boundingBox();
  const bulle = () => p.evaluate(() => {
    const b = document.getElementById("caBulle");
    return { ouverte: !b.hidden, nom: document.getElementById("caBulleNom").textContent,
      lignes: [...b.querySelectorAll(".cb-l")].map(x => x.textContent.trim()),
      marque: !document.getElementById("caBullePt").hidden, voir: !document.getElementById("caBulleVoir").disabled };
  });

  /* Un toucher bref n'ouvre rien depuis la version 154 : il ouvrait la bulle
     au début de chaque déplacement. L'appui long l'ouvre, et elle se
     remplit : le nom, le temps, le vent, l'eau. Les coordonnées envoyées sont
     arrondies au centième. */
  await p.mouse.click(boite.x + boite.width * 0.3, boite.y + boite.height * 0.6);
  await p.waitForTimeout(900);
  const bref = (await bulle()).ouverte;
  ok("un toucher bref sur la carte n'ouvre pas de bulle", !bref && etat.appelsPoint.length === 0);
  await appuiLong(p, boite.x + boite.width * 0.3, boite.y + boite.height * 0.6);
  await p.waitForTimeout(700);
  await reposer(p, 1500);
  const b1 = await bulle();
  const envoye = etat.appelsPoint.map(u => [new URL(u).searchParams.get("latitude"), new URL(u).searchParams.get("longitude")]);
  ok("un appui long ouvre la bulle du point, avec son nom, son temps, son vent et son eau",
    b1.ouverte && b1.marque && b1.voir && b1.nom === "Grenoble" && b1.lignes.some(l => /^21° pluie/.test(l))
    && b1.lignes.some(l => /^Vent 18 km\/h du sud-ouest, rafales 42 km\/h$/.test(l))
    && b1.lignes.some(l => /^Pluie en ce moment : 0,6 mm$/.test(l)) && b1.lignes.some(l => /Restriction d'eau|Aucune restriction/.test(l)),
    JSON.stringify(b1));
  ok("le point touché n'est envoyé qu'au centième de degré",
    envoye.length === 1 && envoye.every(c => c.every(v => /^-?\d+(\.\d{1,2})?$/.test(v))), JSON.stringify(envoye));
  /* Le nom vient du découpage administratif, qui nomme la commune contenant
     le point : le service d'adresses restait muet loin d'une adresse. */
  const geo = etat.appelsGeo.map(u => new URL(u).searchParams);
  ok("le nom du point vient de la commune qui le contient, au millième de degré",
    geo.length >= 1 && geo.every(q => /^-?\d+(\.\d{1,3})?$/.test(q.get("lat")) && /^-?\d+(\.\d{1,3})?$/.test(q.get("lon"))),
    JSON.stringify(etat.appelsGeo));

  /* Un glissement et un double appui n'ouvrent pas de bulle. */
  await p.locator("#caBulleFermer").click();
  /* Les gestes se font loin du centre, où l'étiquette de Fain prendrait les
     appuis. */
  const x0 = boite.x + boite.width * 0.25, y0 = boite.y + boite.height * 0.8;
  /* Un glissement lent, plus long que le délai de l'appui : le doigt bouge,
     l'appui s'annule. */
  await p.mouse.move(x0, y0); await p.mouse.down();
  for (let k = 1; k <= 8; k++) { await p.mouse.move(x0 + k * 8, y0 - k * 4); await p.waitForTimeout(100); }
  await p.mouse.up();
  await p.waitForTimeout(600);
  const apresGlisse = (await bulle()).ouverte;
  const zAvant = await p.evaluate(() => document.querySelector(".ca-echelle span").textContent);
  await p.mouse.dblclick(x0, y0);
  await p.waitForTimeout(700);
  const apresDouble = (await bulle()).ouverte;
  const zApres = await p.evaluate(() => document.querySelector(".ca-echelle span").textContent);
  ok("un glissement ou un double appui n'ouvre pas de bulle, le double appui zoome",
    !apresGlisse && !apresDouble && zAvant !== zApres, JSON.stringify({ apresGlisse, apresDouble, zAvant, zApres }));

  /* « Voir la prévision » ouvre le lieu en consultation : l'accueil s'ouvre
     sur lui, le bandeau le dit, la liste des lieux ne change pas ; « Revenir »
     rétablit Fain. */
  await appuiLong(p, boite.x + boite.width * 0.3, boite.y + boite.height * 0.6);
  await p.waitForTimeout(700);
  await reposer(p, 1500);
  await p.locator("#caBulleVoir").click();
  await reposer(p, 2000);
  const consulte = await p.evaluate(async () => {
    const R = await import("/src/reglages.js");
    return { onglet: document.querySelector('[data-onglet][aria-current="page"]')?.dataset.onglet,
      nom: document.getElementById("navLieuNom").textContent, bandeau: !document.getElementById("navConsult").hidden,
      texte: document.getElementById("navConsultTxt").textContent, revenir: document.getElementById("navRevenir").textContent,
      suivies: R.suivies().map(l => l.commune) };
  });
  await p.locator("#navRevenir").click();
  await reposer(p, 2000);
  const revenu = await p.evaluate(async () => ({ nom: document.getElementById("navLieuNom").textContent,
    bandeau: !document.getElementById("navConsult").hidden }));
  ok("« Voir la prévision » ouvre le lieu en consultation sans le suivre, et « Revenir » rétablit la commune",
    consulte.onglet === "accueil" && consulte.nom === "Grenoble" && consulte.bandeau && /Grenoble/.test(consulte.texte)
    && consulte.revenir === "Revenir à Fain-lès-Moutiers" && !consulte.suivies.includes("Grenoble")
    && revenu.nom === "Fain-lès-Moutiers" && !revenu.bandeau, JSON.stringify({ consulte, revenu }));

  /* « Suivre ce lieu » l'ajoute à la liste et lève le bandeau. */
  await p.locator('[data-onglet="carte"]').click();
  await reposer(p, 1500);
  await appuiLong(p, boite.x + boite.width * 0.3, boite.y + boite.height * 0.6);
  await p.waitForTimeout(700);
  await reposer(p, 1500);
  await p.locator("#caBulleVoir").click();
  await reposer(p, 1500);
  await p.locator("#navSuivre").click();
  await reposer(p, 1500);
  const suivi = await p.evaluate(async () => {
    const R = await import("/src/reglages.js");
    return { nom: document.getElementById("navLieuNom").textContent, bandeau: !document.getElementById("navConsult").hidden,
      suivies: R.suivies().map(l => l.commune), consultation: R.consultation() };
  });
  ok("« Suivre ce lieu » ajoute le lieu consulté à la liste et lève le bandeau",
    suivi.nom === "Grenoble" && !suivi.bandeau && suivi.suivies[0] === "Grenoble" && suivi.suivies.includes("Fain-lès-Moutiers")
    && suivi.consultation === null, JSON.stringify(suivi));

  /* La recherche : la loupe ouvre le champ, une commune trouvée centre la
     carte sur elle et ouvre sa bulle. */
  await p.locator('[data-onglet="carte"]').click();
  await reposer(p, 1500);
  await p.locator("#caChercher").click();
  await p.locator("#caRechercheChamp").fill("Gre");
  await p.waitForTimeout(600);
  await reposer(p, 1000);
  const trouves = await p.locator("#caRechercheListe button").count();
  if (trouves) await p.locator("#caRechercheListe button").first().click();
  await p.waitForTimeout(500);
  await reposer(p, 1500);
  const cherche = await p.evaluate(async () => {
    const cv = document.getElementById("caToile");
    const pt = document.getElementById("caBullePt");
    return { boite: !document.getElementById("caRecherche").hidden, nom: document.getElementById("caBulleNom").textContent,
      echelle: document.querySelector(".ca-echelle span").textContent,
      marqueX: parseFloat(pt.style.getPropertyValue("--rx")), marqueY: parseFloat(pt.style.getPropertyValue("--ry")),
      l: cv.clientWidth, h: cv.clientHeight };
  });
  ok("la recherche centre la carte sur la commune trouvée et ouvre sa bulle",
    trouves >= 1 && !cherche.boite && cherche.nom === "Grenoble" && /^(5|10) km$/.test(cherche.echelle)
    && Math.abs(cherche.marqueX - cherche.l / 2) < 3 && Math.abs(cherche.marqueY - cherche.h / 2) < 3,
    JSON.stringify({ trouves, ...cherche }));

  /* Au clavier : Entrée sur la carte ouvre la bulle du centre, Échap la
     ferme. */
  await p.locator("#caBulleFermer").click();
  await p.locator("#caToile").focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);
  const clavierOuvre = (await bulle()).ouverte;
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  const clavierFerme = !(await bulle()).ouverte;
  ok("au clavier, Entrée ouvre la bulle du centre de la carte et Échap la ferme",
    clavierOuvre && clavierFerme, JSON.stringify({ clavierOuvre, clavierFerme }));
};
