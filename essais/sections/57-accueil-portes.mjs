/* Le tableau des heures, les portes et l'eau. Section écrite le 3 octobre
   2026 pour le jalon 20, lot 2 ; elle part d'un état neuf préparé par
   essais/banc.mjs. */

export const titre = "Le tableau, les portes et l'eau";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, reposer } = T;
  await onglet("accueil"); await reposer(pg, 2500);

  /* Le tableau : quatre lignes au plus, la température en maximum et minimum,
     une seule colonne pour le moment présent. */
  const tab = await pg.evaluate(() => {
    const t = document.querySelector("#ecran .mt");
    return { lignes: [...t.querySelectorAll(".mt-l")].map(x => x.textContent.trim()).filter(Boolean),
      ici: t.querySelectorAll(".mt-t.mt-ici").length,
      temp: [...t.querySelectorAll(".mt-v")].slice(0, 1).map(x => ({ b: x.querySelector("b")?.textContent, i: x.querySelector("i")?.textContent }))[0] };
  });
  ok("le tableau des heures tient en quatre lignes au plus, la température en maximum et minimum, le moment présent marqué une fois",
    tab.lignes.length <= 4 && tab.lignes[0] === "Temp." && !tab.lignes.includes("Humidité") && tab.ici === 1
    && /^-?\d+°$/.test(tab.temp?.b || "") && /^-?\d+°$/.test(tab.temp?.i || ""), JSON.stringify(tab));

  /* Les portes portent une information clé, plus la description d'avant. */
  const portes = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll("#ecran .porte-info")]
    .map(x => [x.dataset.info, x.textContent])));
  ok("les quatre portes portent une information clé, à la place de leur description",
    Object.keys(portes).sort().join(",") === "activites,air,beau,climat"
    && /^(Courir|Vélo|Linge|Aérer|Arroser|Voiture) : /.test(portes.activites)
    && /^Air /.test(portes.air) && !/[·]/.test(portes.air)
    && Object.values(portes).every(v => v && !/Records, normales|Mes lieux, et cent/.test(v)), JSON.stringify(portes));

  /* Le robinet dit l'eau, la goutte reste à l'humidité. */
  const icones = await pg.evaluate(async () => {
    const I = await import("/src/icones.js");
    /* Une icône se reconnaît au tracé de son premier chemin. */
    const trace = html => { const d = document.createElement("div"); d.innerHTML = html; return d.querySelector("path")?.getAttribute("d") || "x"; };
    const tuile = n => [...document.querySelectorAll("#ecran .bd-m")].find(x => x.textContent.includes(n));
    const dans = el => [...(el?.querySelectorAll("path") || [])].map(x => x.getAttribute("d"));
    return { eau: dans(tuile("L'eau")).includes(trace(I.ico("robinet", ""))),
      humidite: dans(tuile("Humidité")).includes(trace(I.ico("goutte", ""))) };
  });
  ok("la tuile de l'eau porte le robinet, celle de l'humidité garde la goutte", icones.eau && icones.humidite, JSON.stringify(icones));

  /* La fenêtre de l'eau : restriction, nappe et rivière d'abord ; l'étiage,
     la température de l'eau, le sol et l'arrosage derrière « Plus de
     détails », replié à l'ouverture. */
  await pg.locator("#ecran .bd-mesures .bd-m", { hasText: "L'eau" }).first().click();
  await pg.waitForFunction(() => /Étiage observé/.test(document.querySelector("#feuille-corps")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
  const eau = await pg.evaluate(() => {
    const c = document.getElementById("feuille-corps");
    const d = c.querySelector("details.plus");
    const dehors = [...c.querySelectorAll(":scope > .carte:not(details) h3")].map(x => x.textContent);
    return { dehors, ferme: d ? !d.open : null, resume: d?.querySelector("summary")?.textContent,
      dedans: [...(d?.querySelectorAll("h3") || [])].map(x => x.textContent),
      etiageVisible: [...c.querySelectorAll(".pl-lieu")].filter(x => /Étiage observé/.test(x.textContent)).some(x => x.checkVisibility()) };
  });
  await pg.locator("#feuille-corps details.plus > summary").click();
  const ouvert = await pg.evaluate(() => [...document.querySelectorAll("#feuille-corps .pl-lieu")]
    .filter(x => /Étiage observé/.test(x.textContent)).some(x => x.checkVisibility()));
  await pg.locator("#feuille-fermer").click(); await pg.waitForTimeout(400);
  ok("la fenêtre de l'eau montre la restriction, la nappe et la rivière, et replie le reste sous « Plus de détails »",
    eau.dehors.join("/") === "Restrictions/Nappe phréatique/Rivière" && eau.ferme === true && eau.resume === "Plus de détails"
    && eau.dedans.join("/") === "Étiage et température de l'eau/Le sol et l'arrosage" && !eau.etiageVisible && ouvert,
    JSON.stringify({ ...eau, ouvert }));
};
