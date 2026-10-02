/* La carte et le ciel sans le doigt. Section écrite le 2 octobre 2026 pour le
   constat 4.9 de l'audit : la carte et la voûte étoilée se lisaient seulement
   à l'œil et se pilotaient seulement au doigt. Elle part d'un état neuf
   préparé par essais/banc.mjs. */

export const titre = "La carte et le ciel sans le doigt";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ecranCiel, reposer } = T;

  /* La carte : un résumé lu qui suit les couches, la liste des étiquettes
     visibles, et les flèches du clavier qui déplacent la vue. */
  await onglet("carte");
  await reposer(pg, 1500);
  const resume = () => pg.evaluate(() => document.getElementById("caResume")?.textContent || "");
  const avant = await resume();
  await pg.locator("#caCouches").click();
  await pg.waitForTimeout(200);
  const pluieAvant = await pg.locator("#caPluie").getAttribute("aria-checked");
  await pg.locator("#caPluie").click();
  await pg.waitForTimeout(200);
  await pg.locator("#caPrevi").click();
  await reposer(pg, 1500);
  const apres = await resume();
  const etiquettes = await pg.evaluate(() => [...document.querySelectorAll("#caListe li")].map(l => l.textContent));
  await pg.locator("#caCouches").click();
  await pg.waitForTimeout(200);
  const repere = () => pg.evaluate(() => document.querySelector(".ca-r-ici")?.style.getPropertyValue("--rx") || "");
  const xAvant = await repere();
  await pg.locator("#caToile").focus();
  await pg.keyboard.press("ArrowRight");
  await pg.waitForTimeout(300);
  const xApres = await repere();
  const pluieDite = pluieAvant === "true" ? !/pluie/.test(apres) : /pluie/.test(apres);
  ok("la carte se lit par un résumé qui suit les couches, ses étiquettes en liste, et se déplace au clavier",
    /^(Nappe|Aucune nappe)/.test(avant) && avant !== apres && pluieDite && /prévisions des villes/.test(apres)
    && etiquettes.length > 0 && etiquettes.every(e => /\d/.test(e)) && xAvant !== "" && xApres !== xAvant,
    JSON.stringify({ avant, apres, etiquettes: etiquettes.slice(0, 3), xAvant, xApres }));

  /* Le ciel plein écran : la toile porte la visée, des boutons tournent le
     regard et ne paraissent qu'au clavier, la liste des constellations du
     champ ouvre leur fiche. */
  await ecranCiel(pg, "etoiles");
  await reposer(pg, 2000);
  let cielDit = { erreur: "bandeau absent" };
  if (await pg.locator("#ciBandeau").count()) {
    await pg.locator("#ciBandeau").click();
    await pg.waitForTimeout(600);
    const masque = await pg.evaluate(() => document.getElementById("ciDirs").getBoundingClientRect().width);
    await pg.locator('#ciDirs [data-dir="N"]').focus();
    const visible = await pg.evaluate(() => document.getElementById("ciDirs").getBoundingClientRect().width);
    await pg.keyboard.press("Enter");
    await pg.waitForTimeout(400);
    const nord = await pg.evaluate(() => ({ visee: document.getElementById("ciVisee").textContent,
      libelle: document.getElementById("ciToilePE").getAttribute("aria-label") }));
    /* Trois flèches font quarante-cinq degrés : la visée passe au nord-est. */
    await pg.keyboard.press("ArrowRight", { delay: 30 });
    await pg.keyboard.press("ArrowRight", { delay: 30 });
    await pg.keyboard.press("ArrowRight", { delay: 30 });
    await pg.waitForTimeout(300);
    const tourne = await pg.evaluate(() => document.getElementById("ciVisee").textContent);
    const objets = await pg.locator("#ciObjets button").count();
    if (objets) {
      await pg.locator("#ciObjets button").first().evaluate(b => b.click());
      await pg.waitForTimeout(300);
    }
    const fiche = await pg.evaluate(() => !document.getElementById("ciFiche").hidden);
    cielDit = { masque, visible, ...nord, tourne, objets, fiche };
    await pg.locator("#ciFermer").click();
  }
  ok("le ciel plein écran se lit et se tourne sans le doigt, les boutons paraissant au clavier",
    cielDit.masque <= 1 && cielDit.visible > 100 && /^Nord/.test(cielDit.visee) && /^Nord/.test(cielDit.libelle)
    && /^Nord-est/.test(cielDit.tourne) && cielDit.objets > 0 && cielDit.fiche,
    JSON.stringify(cielDit));
};
