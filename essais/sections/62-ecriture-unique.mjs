/* Une seule écriture. Section écrite le 3 octobre 2026, décisions de Jérôme
   après le relevé des incohérences : la direction du vent « du nord », une
   heure à la minute « 19 h 25 », une plage « de 15 h à 18 h », les mêmes noms
   de grandeurs. Elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Une seule écriture";
export const avecPage = true;
/* La table des moments sur l'accueil, au lieu de la bande, depuis la
   version 195. */
export const reglagesPage = { heuresaccueil: "moments" };

const NORM = t => (t || "").replace(/[  ]/g, " ");

export default async T => {
  const { pg, ok, onglet, ecranCiel, ouvrirLeTemps, ouvrirVoie, reposer } = T;

  /* Aucune heure ne s'écrit plus « 19:25 », sur l'accueil, le ciel et les
     réglages. */
  const textes = [];
  await onglet("accueil"); await reposer(pg, 1500); textes.push(NORM(await pg.locator("#ecran").textContent()));
  for (const c of ["soleil", "lune", "etoiles"]) { await ecranCiel(pg, c); await reposer(pg, 1200); textes.push(NORM(await pg.locator("#ecran").textContent())); }
  await pg.locator("#btnReglages").click(); await pg.waitForTimeout(500);
  textes.push(NORM(await pg.locator("#feuille-corps").textContent()));
  await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(300);
  const deuxPoints = textes.flatMap(t => t.match(/\b\d{1,2}:\d{2}\b/g) || []);
  ok("aucune heure ne s'écrit plus avec deux points, sur l'accueil, le ciel et les réglages",
    deuxPoints.length === 0 && textes.some(t => /\b\d{2} h \d{2}\b/.test(t)), deuxPoints.slice(0, 5).join(" "));

  /* Le tableau des heures écrit ses plages sans trait. */
  await onglet("accueil"); await reposer(pg, 800);
  const plages = (await pg.locator("#ecran .mt-t").allTextContents()).map(NORM);
  ok("le tableau des heures écrit ses plages « 12 h à 18 h »", plages.length >= 3 && plages.every(t => /\d\d h à \d\d h/.test(t) && !/\d-\d/.test(t)),
    plages.join(" | "));

  /* La vue ciblée du vent : la lecture dit la direction en toutes lettres ;
     la phrase du vent aussi. La liste nomme les grandeurs comme la bulle le
     faisait, depuis la version 232. */
  await ouvrirVoie(pg, "v"); await reposer(pg, 1500);
  const ruban = await pg.evaluate(() => ({
    lu: (document.querySelector(".mg-lu-s span")?.textContent || "").replace(/[\u00A0\u202F]/g, " "),
    phrase: document.querySelector(".hh-phrase")?.textContent || "" }));
  await ouvrirLeTemps(pg); await reposer(pg, 1500);
  await pg.locator("details.hh summary").first().click();
  const noms = await pg.locator("details.hh[open] .hh-d dt").allTextContents();
  ok("la lecture du vent dit sa direction en toutes lettres et la liste nomme les grandeurs comme ailleurs",
    /km\/h (du (nord|sud)(-(est|ouest))?|de l'(est|ouest)),/.test(ruban.lu) && noms.includes("Risque de pluie")
    && noms.includes("Indice UV") && /Vent (du|de l')/.test(ruban.phrase) && !/Vent de [ns]/.test(ruban.phrase),
    JSON.stringify({ ...ruban, noms }));
};
