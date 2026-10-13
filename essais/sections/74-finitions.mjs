/* Les finitions de l'audit d'usage, version 202 : symboles des activités,
   activités au choix, graphique de la semaine, climat en phrases, réglages
   groupés, coordonnées à la française, beau temps et liens hors saison.
   Section écrite le 14 octobre 2026 ; elle part d'un état neuf préparé par
   essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Les finitions de l'audit d'usage";
export const avecPage = false;

const SUIVIES = [
  { commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3 },
  { commune: "Troyes", codePostal: "10000", lat: 48.3, lon: 4.07 },
  { commune: "Autun", codePostal: "71400", lat: 46.95, lon: 4.3 },
];

export default async T => {
  const { ok, ctxReponse, METEO_NUE, reposer } = T;
  const [c, p] = await ctxReponse(() => METEO_NUE(), { ...FAIN, suivies: SUIVIES, activitesMuettes: ["voiture"] });
  await reposer(p, 2500);

  /* Les activités : chacune son symbole, et la voiture retirée ne paraît plus. */
  await p.locator('[data-feuille="activites"]').first().click();
  await reposer(p, 1200);
  const act = await p.evaluate(async () => {
    const I = await import("/src/icones.js");
    const trace = n => { const d = document.createElement("div"); d.innerHTML = I.ico(n, ""); return d.querySelector("path,rect,circle")?.outerHTML || "x"; };
    const lignes = [...document.querySelectorAll("#feuille-corps .rangee")];
    return { noms: lignes.map(l => l.querySelector("b").textContent).join(","),
      symboles: lignes.every((l, k) => l.querySelector("svg path,svg rect,svg circle")?.outerHTML === trace(["course", "velo", "linge", "fenetre", "arrosoir"][k])) };
  });
  ok("chaque activité a son symbole, et une activité retirée ne paraît plus",
    act.noms === "Courir,Rouler à vélo,Étendre le linge,Aérer pour rafraîchir,Arroser" && act.symboles, JSON.stringify(act));
  await p.locator("#feuille-fermer").click(); await p.waitForTimeout(500);

  /* Les réglages : quatre groupes, les activités, les sources repliées, les
     coordonnées à la française. */
  await p.locator("#btnReglages").click(); await reposer(p, 1200);
  const rg = await p.evaluate(() => ({
    groupes: [...document.querySelectorAll("#feuille-corps .rg-groupe")].map(h => h.textContent).join(" / "),
    activites: [...document.querySelectorAll("[data-activite]")].map(b => `${b.dataset.activite}:${b.getAttribute("aria-checked")}`).join(" "),
    sources: (d => (d ? `${d.tagName}:${d.open}` : ""))(document.getElementById("rgSources")),
    coord: [...document.querySelectorAll("#feuille-corps .rangee")].find(r => /Coordonnées/.test(r.textContent))?.querySelector(".rangee-val")?.textContent || "" }));
  ok("les réglages se rangent en quatre groupes, choisissent les activités, replient les sources et écrivent les coordonnées à la française",
    rg.groupes === "Alertes / Ce qui s'affiche / Justesse et Météo-France / Application"
    && rg.activites === "courir:true velo:true linge:true aerer:true arroser:true voiture:false"
    && rg.sources === "DETAILS:false" && rg.coord === "47,5 ; 4,3", JSON.stringify(rg));
  /* Une activité au moins reste suivie. */
  const garde = await p.evaluate(async () => {
    const R = await import("/src/reglages.js");
    const toutes = ["courir", "velo", "linge", "aerer", "arroser", "voiture"];
    for (const a of toutes) if (R.activiteSuivie(a)) R.basculerActivite(a, toutes);
    return toutes.filter(R.activiteSuivie).join(",");
  });
  ok("une activité au moins reste suivie", garde === "arroser", garde);
  await p.locator("#feuille-fermer").click(); await p.waitForTimeout(500);

  /* Où est le beau temps : le verdict, son critère, la pastille du premier. */
  await p.locator('[data-feuille="beautemps"]').first().click();
  await reposer(p, 2500);
  const bt = await p.evaluate(() => ({ avis: document.querySelector("#btLieux .bt-avis")?.textContent || "",
    critere: document.querySelector("#btLieux .note")?.textContent || "",
    premier: document.querySelector("#btLieux .rangee")?.querySelector(".bt-pastille")?.textContent || "",
    autres: document.querySelectorAll("#btLieux .bt-pastille").length }));
  ok("le beau temps dit son verdict, son critère, et marque le premier lieu",
    /^(Plus beau aujourd'hui à .+, \d+(,\d)? h de soleil\.|Ici, aujourd'hui, le plus beau temps de vos lieux\.|Ici, aujourd'hui, le temps vaut celui de vos autres lieux\.)$/.test(bt.avis)
    && bt.critere === "Classés par le soleil, la pluie et la température." && bt.premier === "Le plus beau" && bt.autres === 1,
    JSON.stringify(bt));
  await p.locator("#feuille-fermer").click(); await p.waitForTimeout(500);

  /* Le graphique de la semaine dit ses unités, et un seul « Voir plus ». */
  await p.locator('[data-onglet="semaine"]').click(); await reposer(p, 1500);
  const sem = await p.evaluate(() => ({ unites: document.querySelector(".sem-graphe .sg-unites")?.textContent || "",
    plus: document.querySelectorAll("#ecran [data-semaine-plus]").length }));
  ok("le graphique de la semaine dit ses unités, et un seul bouton déplie la suite",
    sem.unites === "maximum minimum en degrés, rafales en km/h, pluie en mm" && sem.plus === 1, JSON.stringify(sem));
  await c.close();

  /* Le climat en phrases, et la phrase des jours semblables. */
  const [c2, p2] = await ctxReponse(() => METEO_NUE(), FAIN);
  await reposer(p2, 1500);
  const climat = await p2.evaluate(async () => {
    const V = await import("/src/vues/climat.js");
    return [V.phrasePercentile(69, "18 août", 1950), V.phrasePercentile(20, "18 août", 1950), V.phrasePercentile(100, "18 août", 1950)].join(" | ");
  });
  ok("le rang du jour se dit en phrase, plus chaud ou plus frais que les mêmes dates",
    climat === "Un peu plus chaud que d'ordinaire : plus chaud que 69 % des 18 août depuis 1950"
      + " | Plus frais que trois journées sur quatre : plus frais que 80 % des 18 août depuis 1950"
      + " | Plus chaud que toutes les journées relevées à cette date", climat);
  await c2.close();

  /* Hors saison, la neige reste à portée, par un lien discret. Le 18 août,
     la neige est hors saison ; à Grenoble, des stations sont à moins d'une
     heure, estimée à vol d'oiseau faute d'OSRM dans les contrôles. Fain n'en
     a aucune. */
  const [c3, p3] = await ctxReponse(() => METEO_NUE(), { ...FAIN, commune: "Grenoble", codePostal: "38000", lat: 45.19, lon: 5.72 });
  await reposer(p3, 3000);
  const hors = await p3.evaluate(() => ({ liens: [...document.querySelectorAll("#ecran .porte-hors")].map(b => `${b.dataset.feuille}:${b.textContent}`).join(" | "),
    porteNeige: !!document.querySelector('#ecran .porte[data-feuille="neige"]') }));
  await p3.locator('#ecran .porte-hors[data-feuille="neige"]').click({ timeout: 5000 }).catch(() => {});
  await reposer(p3, 1500);
  const feuilleNeige = await p3.evaluate(() => ({ titre: document.getElementById("feuille")?.hidden ? "" : document.getElementById("feuille-titre")?.textContent || "",
    texte: (document.getElementById("feuille-corps")?.textContent || "").replace(/\s+/g, " ").slice(0, 120) }));
  ok("hors saison, la neige reste à portée par un lien discret, qui ouvre sa feuille",
    /neige:La neige et les stations/.test(hors.liens) && !hors.porteNeige && /neige/i.test(feuilleNeige.titre) && feuilleNeige.texte.trim().length > 20,
    JSON.stringify({ ...hors, feuilleNeige }));
  await c3.close();
};
