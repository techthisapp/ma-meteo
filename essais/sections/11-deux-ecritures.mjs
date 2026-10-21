/* Les deux écritures. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs.

   Depuis la version 232, la bascule entre ruban et liste est retirée : la
   porte décide de la vue. « Plus de détails » ouvre la liste d'ensemble, une
   ligne visuelle par heure, rangée par jour ; une grandeur ouvre sa vue
   ciblée, son graphique et la liste de ses heures. */

export const titre = "Les deux écritures";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ouvrirVoie } = T;
  await onglet("temps");
  ok("la bascule entre ruban et liste n'existe plus",
    await pg.locator("[data-ecriture], .seg-menu").count() === 0);
  ok("la liste commence au-dessus de la ligne de flottaison", await pg.evaluate(() =>
    document.querySelector("#ecran .hh-bloc").getBoundingClientRect().top < 400));
  const groupes = (await pg.locator(".hh-bloc .hh-titre").allTextContents()).map(t => t.replace(/[  ]/g, " "));
  ok("la liste range ses heures par jour, avec les bornes du jour",
    groupes.length === 2 && /^Aujourd'hui, de -?\d+ à -?\d+°$/.test(groupes[0]) && /^Demain, de -?\d+ à -?\d+°$/.test(groupes[1]),
    groupes.join(" / "));
  ok("la liste porte vingt-quatre lignes", await pg.locator("details.hh").count() === 24, String(await pg.locator("details.hh").count()));
  const h1 = await pg.locator(".hh .hh-h").first().innerText();
  ok("la première ligne est l'heure en cours", h1.trim() === "Maint.", h1);
  /* Une ligne dit l'heure, le ciel, la température placée sur l'échelle de
     la liste, la pluie en barre et le vent ; le reste s'ouvre en la touchant. */
  const lignes = await pg.evaluate(() => [...document.querySelectorAll("details.hh")].map(d => ({
    t: d.querySelector(".hh-t b")?.textContent || "", point: !!d.querySelector(".hh-t .hh-point"),
    ic: !!d.querySelector(".hh-ciel svg"), pluie: !!d.querySelector(".hh-goutte[class*='sp-']"),
    sec: !!d.querySelector(".hh-sec"), vent: d.querySelector(".hh-v b")?.textContent || "",
    fl: !!d.querySelector(".hh-v svg"), risque: d.querySelector(".hh-ciel small")?.textContent || "",
    ouvert: d.open })));
  const pluvieuses = lignes.filter(l => l.pluie).length;
  ok("chaque ligne porte le ciel, la température sur son échelle, la pluie et le vent, et reste fermée",
    lignes.every(l => /^-?\d+°$/.test(l.t) && l.point && l.ic && l.pluie !== l.sec && /^\d+$/.test(l.vent) && l.fl && !l.ouvert)
    && pluvieuses > 0 && pluvieuses < 24, JSON.stringify(lignes.slice(17, 20)));
  ok("le risque de pluie ne s'écrit sous le ciel qu'à partir de trente pour cent",
    lignes.some(l => l.risque) && lignes.every(l => !l.risque || Number(l.risque.replace(/\D/g, "")) >= 30),
    lignes.map(l => l.risque || "-").join(" "));
  /* La température la plus haute de la liste est au bout de la piste, la
     plus basse au début. */
  ok("le point de température court d'un bout à l'autre de la piste", await pg.evaluate(() => {
    const p = [...document.querySelectorAll("details.hh .hh-point")].map(e => parseFloat(e.style.left));
    return Math.min(...p) < 1 && Math.max(...p) > 99 ? "" : `${Math.min(...p)} à ${Math.max(...p)}`;
  }) === "");
  await pg.locator("details.hh summary").nth(3).click();
  const detail = await pg.evaluate(() => {
    const d = document.querySelectorAll("details.hh")[3];
    const dd = [...d.querySelectorAll(".hh-d dt")].find(x => x.textContent === "Vent")?.nextElementSibling;
    return { ouvert: d.open, noms: [...d.querySelectorAll(".hh-d dt")].map(x => x.textContent),
      vent: (dd?.textContent || "").replace(/[  ]/g, " ") };
  });
  /* Le vent dit sa provenance comme on la dit, depuis le 3 octobre 2026. */
  ok("le vent du détail dit sa provenance « du nord » ou « de l'ouest »",
    /^\d+ km\/h, (du (nord|sud)(-(est|ouest))?|de l'(est|ouest))$/.test(detail.vent), detail.vent);
  ok("toucher une heure ouvre le ressenti, la rosée, le vent, les rafales, l'humidité et le risque de pluie",
    detail.ouvert && ["Ressenti", "Rosée", "Vent", "Rafales", "Humidité", "Risque de pluie"].every(n => detail.noms.includes(n)),
    JSON.stringify(detail));
  const haut = await pg.evaluate(() => Math.max(...[...document.querySelectorAll("details.hh:not([open]) > summary")]
    .map(x => x.getBoundingClientRect().height)));
  ok("les lignes fermées tiennent en quarante-huit points au plus", haut <= 48, String(haut));
  ok("l'explication de la liste se tient derrière le « i »", await pg.locator(".hh-page details.aide").count() === 1);

  /* La vue ciblée porte la liste de sa seule grandeur, toutes les heures de
     la fenêtre. */
  await ouvrirVoie(pg, "mm");
  const cib = await pg.evaluate(() => [...document.querySelectorAll(".hh-de-mm .hh")].map(l => ({
    val: l.querySelector(".hh-val")?.textContent.replace(/[  ]/g, " ") || "",
    barre: !!l.querySelector(".hh-plein") })));
  ok("la liste de la pluie porte toutes les heures de la fenêtre, en barre, les millimètres ou le risque",
    cib.length === 24 && cib.every(l => l.barre && /^(\d+(,\d)? mm|\d+ %)$/.test(l.val)) && cib.some(l => / mm$/.test(l.val)),
    JSON.stringify(cib.slice(16, 20)));
  await ouvrirVoie(pg, "v");
  const vent = await pg.evaluate(() => [...document.querySelectorAll(".hh-de-v .hh")].map(l => ({
    fl: !!l.querySelector(".hh-fl"), raf: !!l.querySelector(".hh-rafale"),
    val: l.querySelector(".hh-val")?.textContent.replace(/[  ]/g, " ") || "" })));
  ok("la liste du vent porte la direction, le vent et ses rafales",
    vent.length === 24 && vent.every(l => l.fl && l.raf && /^\d+ ?raf\. \d+$/.test(l.val)), JSON.stringify(vent.slice(0, 2)));
};
