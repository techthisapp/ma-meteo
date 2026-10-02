/* Le ressenti calibré. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { ENSEMBLE_LARGE } from "../faux-services.mjs";

export const titre = "Le ressenti calibré";
export const avecPage = false;

export default async T => {
  const { ok, txtDe, meteoRes, ctxReponse } = T;
  /* Une journée qui tient dans une seule tenue ordinaire n'a rien à décider. Le
     silence par défaut du dépôt s'applique : aucun encart, et le ciel reste nu. */
  const [ctxPlat, pgPlat] = await ctxReponse(meteoRes(() => 19, () => 19));
  ok("une journée sans rien à décider ne fait paraître aucun encart",
    await pgPlat.locator(".pt-rep").count() === 0,
    await pgPlat.locator(".pt-rep").innerText().catch(() => ""));
  ok("et le ciel garde sa ligne de date et son grand chiffre",
    await pgPlat.locator(".plein-titre > i").count() === 1
    && await pgPlat.locator(".bd-deg").count() === 1);
  await ctxPlat.close();

  /* L'aération. Elle ne parle que les jours où l'intérieur va devenir plus chaud
     que le dehors : l'hiver, où il fait toujours plus frais dehors, la règle se
     déclencherait tous les jours et cesserait d'être lue. La tenue est ici
     constante, l'aération a donc son tour. */
  const [ctxAerer, pgAerer] = await ctxReponse(
    meteoRes(() => 23, h => (h >= 9 && h < 12 ? 16 : 26)));
  ok("l'aération nomme sa fenêtre et la fraîcheur du dehors",
    (await txtDe(pgAerer, ".pt-rep")).trim() === "Aérer de 09 h à 12 h, 16° dehors.",
    await txtDe(pgAerer, ".pt-rep"));
  await ctxAerer.close();

  /* La même journée fraîche, mais sans après-midi chaud : ouvrir une fenêtre n'y
     gagnerait rien, et la règle se tait. */
  const [ctxHiver, pgHiver] = await ctxReponse(meteoRes(() => 23, () => 16));
  ok("l'aération se tait quand l'intérieur ne va pas se réchauffer",
    await pgHiver.locator(".pt-rep").count() === 0,
    await pgHiver.locator(".pt-rep").innerText().catch(() => ""));
  await ctxHiver.close();

  /* Le biais personnel. Il déplace la tenue et non les degrés écrits : ceux-ci
     viennent de la source, et le ruban, la table des moments et la semaine
     doivent s'accorder au degré. */
  const [ctxBiais, pgBiais, urlsBiais] = await ctxReponse(
    meteoRes(h => (h < 12 ? 8.6 : 14.6), () => 16));
  const sansBiais = (await txtDe(pgBiais, ".pt-rep")).trim();
  ok("sans correction, la tenue suit la température ressentie",
    /^Manteau, 9°, puis veste vers \d\d h, 15°\.$/.test(sansBiais), sansBiais);
  await pgBiais.locator(".pt-rep").click();
  await pgBiais.waitForTimeout(450);
  ok("l'encart ouvre la feuille du ressenti personnel",
    (await pgBiais.locator("#feuille-titre").innerText()).startsWith("Mon ressenti"),
    await pgBiais.locator("#feuille-titre").innerText());
  await pgBiais.locator('[data-biais="1"]').click();
  await pgBiais.waitForTimeout(400);
  const avecBiais = (await txtDe(pgBiais, ".pt-rep")).trim();
  ok("un degré de trop chaud allège la tenue d'un cran",
    /^Veste, 9°, puis pull léger vers \d\d h, 15°\.$/.test(avecBiais), avecBiais);
  ok("et ne déplace aucun des degrés écrits",
    sansBiais.match(/-?\d+°/g).join(",") === avecBiais.match(/-?\d+°/g).join(","),
    `${sansBiais} | ${avecBiais}`);
  /* La borne. Sans elle, une suite d'appuis finirait par conseiller un manteau en
     juillet, et le réglage cesserait d'être une correction. */
  for (let i = 0; i < 5; i++) {
    await pgBiais.locator('[data-biais="1"]').click();
    await pgBiais.waitForTimeout(220);
  }
  ok("le biais reste borné des deux côtés",
    await pgBiais.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais) === 3,
    String(await pgBiais.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais)));
  for (let i = 0; i < 8; i++) {
    await pgBiais.locator('[data-biais="-1"]').click();
    await pgBiais.waitForTimeout(220);
  }
  ok("et il se borne aussi vers le froid",
    await pgBiais.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais) === -3,
    String(await pgBiais.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1")).biais)));
  /* Le biais reste sur l'appareil. Aucune requête ne le porte, ce que le contrôle
     vérifie sur les adresses réellement émises depuis le réglage. */
  const urlsApres = urlsBiais.length;
  await pgBiais.locator('[data-biais="1"]').click();
  await pgBiais.waitForTimeout(400);
  ok("il n'entre dans aucune requête",
    urlsBiais.slice(urlsApres).every(u => !/biais|bias|ressenti/i.test(u)),
    urlsBiais.slice(urlsApres).join(" ") || "aucune requête nouvelle");
  await ctxBiais.close();

  /* La confiance. Elle ne s'écrit que lorsqu'elle est mauvaise : une mention à
     chaque fois se lirait une semaine, puis ne se lirait plus. */
  const [ctxLarge, pgLarge] = await ctxReponse(
    meteoRes(h => (h < 12 ? 8.6 : 14.6), () => 16), null, ENSEMBLE_LARGE);
  ok("des scénarios partagés se disent dans la phrase",
    /Scénarios partagés\.$/.test((await txtDe(pgLarge, ".pt-rep")).trim()),
    await txtDe(pgLarge, ".pt-rep"));
  await ctxLarge.close();

  /* Une journée qui se rafraîchit se dit dans l'ordre du temps, non du plus froid
     au plus chaud : on s'habille pour le premier des deux moments, et nommer une
     heure déjà passée en second serait une phrase à l'envers. */
  const [ctxRefroidit, pgRefroidit] = await ctxReponse(
    meteoRes(h => (h < 15 ? 22 : 10), () => 16));
  ok("une journée qui se rafraîchit se dit dans l'ordre du temps",
    (await txtDe(pgRefroidit, ".pt-rep")).trim()
      === "Manches courtes, 22°, puis veste vers 15 h, 10°.",
    await txtDe(pgRefroidit, ".pt-rep"));
  await ctxRefroidit.close();

  const [ctxSur, pgSur] = await ctxReponse(meteoRes(h => (h < 12 ? 8.6 : 14.6), () => 16));
  ok("des scénarios accordés ne se disent pas",
    !/Scénarios/.test(await txtDe(pgSur, ".pt-rep")), await txtDe(pgSur, ".pt-rep"));
  await ctxSur.close();

  /* ---------- Les activités sur des charges à la carte ---------- */
};
