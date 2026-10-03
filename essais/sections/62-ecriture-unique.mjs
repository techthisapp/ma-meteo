/* Une seule écriture. Section écrite le 3 octobre 2026, décisions de Jérôme
   après le relevé des incohérences : la direction du vent « du nord », une
   heure à la minute « 19 h 25 », une plage « de 15 h à 18 h », les mêmes noms
   de grandeurs. Elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Une seule écriture";
export const avecPage = true;

const NORM = t => (t || "").replace(/[  ]/g, " ");

export default async T => {
  const { pg, ok, onglet, ecranCiel, ouvrirLeTemps, reposer } = T;

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

  /* Le ruban : la bulle dit la direction en toutes lettres et nomme les
     grandeurs comme la liste ; la phrase du vent aussi. */
  await ouvrirLeTemps(pg); await reposer(pg, 1500);
  await pg.locator('.mg-b[data-voie="v"]').click(); await reposer(pg, 600);
  const ruban = await pg.evaluate(() => ({
    noms: [...document.querySelectorAll(".mg-lu-g dt")].map(e => e.textContent),
    dir: document.querySelector(".mg-lu-g dd small")?.textContent || "",
    phrase: document.querySelector('.mg-v[data-cle="v"] .mg-l')?.textContent || "" }));
  ok("la bulle du ruban dit la direction du vent en toutes lettres et nomme les grandeurs comme la liste",
    /^(du (nord|sud)(-(est|ouest))?|de l'(est|ouest))$/.test(ruban.dir) && ruban.noms.includes("Risque de pluie")
    && ruban.noms.includes("Indice UV") && /Vent (du|de l')/.test(ruban.phrase) && !/Vent de [ns]/.test(ruban.phrase),
    JSON.stringify(ruban));
  await pg.locator('.mg-b[data-voie="v"]').click();
};
