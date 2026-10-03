/* Les indicateurs du ciel. Section écrite le 3 octobre 2026 pour le jalon 20,
   lot 3 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Les indicateurs du ciel";
export const avecPage = true;

export default async T => {
  const { pg, ok, ecranCiel, reposer } = T;

  /* Le Soleil et la Lune : les trois mesures en tête, au-dessus de la
     trajectoire. */
  const lire = () => pg.evaluate(() => {
    const e = document.getElementById("ecran");
    const durees = e.querySelector(".ci-durees");
    const traj = [...e.querySelectorAll("h2")].find(h => h.textContent === "Trajectoire");
    return { noms: [...(durees?.querySelectorAll(".tm > div > i") || [])].map(x => x.textContent),
      avant: !!(durees && traj && (durees.compareDocumentPosition(traj) & Node.DOCUMENT_POSITION_FOLLOWING)),
      tm: e.querySelectorAll(".tm").length };
  });
  await ecranCiel(pg, "soleil"); await reposer(pg, 1500);
  const soleil = await lire();
  ok("les durées du Soleil se lisent au-dessus de la trajectoire",
    soleil.noms.join("/") === "Durée du jour/Clarté/Nuit noire" && soleil.avant && soleil.tm === 1, JSON.stringify(soleil));
  await ecranCiel(pg, "lune"); await reposer(pg, 1500);
  const lune = await lire();
  ok("les mesures de la Lune se lisent au-dessus de la trajectoire",
    lune.noms.join("/") === "Au-dessus de l'horizon/Âge/Lunaison" && lune.avant && lune.tm === 1, JSON.stringify(lune));

  /* Les Étoiles : les trois indicateurs de la nuit au même format, un nom,
     une valeur, une précision. */
  await ecranCiel(pg, "etoiles"); await reposer(pg, 1500);
  const nuit = await pg.evaluate(() => [...document.querySelectorAll(".ci-nuit .tm > div")].map(d => ({
    i: d.querySelector("i")?.textContent, b: d.querySelector("b")?.textContent, em: d.querySelector("em")?.textContent })));
  ok("les trois indicateurs de la nuit des Étoiles ont le format des durées du Soleil",
    nuit.length === 3 && nuit.every(x => x.b && x.em) && nuit.map(x => x.i).join("/") === "Nuit noire/Nuages/Lune",
    JSON.stringify(nuit));
};
