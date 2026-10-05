/* Les étoiles en plein écran reprises. Section écrite le 6 octobre 2026,
   version 176, jalon 24, d'après la maquette validée par Jérôme. Elle part d'un
   état neuf préparé par essais/banc.mjs. */

export const titre = "Les étoiles reprises";
export const avecPage = true;

export default async T => {
  const { pg, ok, ecranCiel, reposer } = T;
  await ecranCiel(pg, "etoiles");
  await reposer(pg, 2000);

  /* Les fonctions, d'abord. */
  const f = await pg.evaluate(async () => {
    const V = await import("/src/voute.js");
    const E = await import("/src/vues/etoiles.js");
    const C = await import("/src/ciel.js");
    await C.charger();
    const out = {};
    /* Deux noms au même endroit : le second se décale ; un troisième, le même
       encore, se décale plus loin ou renonce. */
    const cv = document.createElement("canvas");
    const pose = V.placeur(cv.getContext("2d"));
    const a = pose("CYGNE", 100, 100, "11px sans-serif");
    const b = pose("LYRE", 100, 100, "11px sans-serif");
    out.placement = a && b && a.y !== b.y ? "" : `${JSON.stringify(a)} ${JSON.stringify(b)}`;
    /* La Voie lactée : plus de matière vers le centre galactique, dans le
       Sagittaire, qu'à l'opposé, dans le Cocher ; de la poussière dans la
       Grande Faille. */
    const { voie, poussiere } = V.voie();
    const pres = (ra0, dec0, l) => l.filter(v => Math.abs(v.ra - ra0) < 0.8 && Math.abs(v.dec - dec0) < 8);
    const centre = pres(17.76, -29, voie).reduce((s, v) => s + v.i, 0);
    const oppose = pres(5.76, 29, voie).reduce((s, v) => s + v.i, 0);
    /* La poussière de la Grande Faille pèse bien plus que celle des filets
       ordinaires, mesurée dans le Cocher : 38 contre 6 à la version 176. */
    const poids = l => l.reduce((s, v) => s + v.p, 0);
    const faille = poids(pres(19.5, 15, poussiere)), ailleurs = poids(pres(5.5, 35, poussiere));
    out.voie = centre > oppose * 1.5 && faille > ailleurs * 3 ? ""
      : `centre ${centre.toFixed(1)}, opposé ${oppose.toFixed(1)}, faille ${faille.toFixed(1)}, ailleurs ${ailleurs.toFixed(1)}`;
    out.nadir = [E.viseeDe(10, -85), E.viseeDe(10, -40)].join(" | ");
    /* Le chemin vers une constellation : à droite pour un azimut plus grand,
       plus bas pour une hauteur plus basse ; la distance passe par le grand
       cercle. */
    const ch = E.chemin({ az: 180, haut: 40 }, { azimut: 270, hauteur: 10 });
    out.chemin = `${ch.consigne}, ${ch.dist}`;
    const ch2 = E.chemin({ az: 350, haut: 20 }, { azimut: 10, hauteur: 25 });
    out.chemin2 = `${ch2.consigne}, ${ch2.daz}`;
    const r = E.chercherConstellations("lyre", new Date(), { lat: 47.5, lon: 4.3 });
    const tous = E.chercherConstellations("", new Date(), { lat: 47.5, lon: 4.3 });
    const triee = tous.visibles.every((x, k) => !k || tous.visibles[k - 1].hauteur >= x.hauteur)
      && tous.cachees.every((x, k) => !k || tous.cachees[k - 1].nom.localeCompare(x.nom, "fr") <= 0);
    out.recherche = r.visibles.length + r.cachees.length === 1 && tous.visibles.length + tous.cachees.length === 88
      && tous.visibles.every(x => x.hauteur > 0) && tous.cachees.every(x => x.hauteur <= 0) && triee
      ? "" : `lyre ${r.visibles.length}+${r.cachees.length}, tout ${tous.visibles.length}+${tous.cachees.length}, triée ${triee}`;
    const sans = E.chercherConstellations("cephee", new Date(), { lat: 47.5, lon: 4.3 });
    out.accents = [...sans.visibles, ...sans.cachees].map(x => x.nom).join(",");
    out.nuages = [E.nuagesA(new Date()), E.nuagesA(new Date(2001, 0, 1))].map(v => (v === null ? "null" : typeof v)).join(",");
    return out;
  });
  ok("les noms se posent sans se chevaucher", f.placement === "", f.placement);
  ok("la Voie lactée est plus dense vers le Sagittaire et creusée par la Grande Faille", f.voie === "", f.voie);
  ok("la visée se dit sous les pieds", f.nadir === "Sous les pieds | Nord, -40°", f.nadir);
  ok("le chemin vers une constellation se dit par sa direction et sa distance",
    f.chemin === "à droite et plus bas, 84" && f.chemin2 === "tout près, 20", `${f.chemin} | ${f.chemin2}`);
  ok("la recherche range les visibles par hauteur, puis celles sous l'horizon par nom", f.recherche === "", f.recherche);
  ok("la recherche ignore les accents", f.accents === "Céphée", f.accents);
  ok("la nébulosité prévue se lit à l'heure, et rien hors de la prévision", f.nuages === "number,null", f.nuages);

  /* L'écran. */
  await pg.locator("#ciBandeau").click();
  await pg.waitForTimeout(700);
  const etat = () => pg.evaluate(() => ({
    visee: document.getElementById("ciVisee").textContent.replace(/[  ]/g, " "),
    cible: document.getElementById("ciCible").hidden ? null : document.getElementById("ciCibleNom").textContent.replace(/[  ]/g, " "),
    yAller: !document.getElementById("ciYAller").hidden,
  }));

  /* Le regard descend jusque sous les pieds. */
  await pg.locator("#ciMoins").focus();
  for (let k = 0; k < 14; k++) await pg.keyboard.press("ArrowDown");
  await pg.waitForTimeout(200);
  const bas = await etat();
  ok("le regard descend jusque sous les pieds", bas.visee === "Sous les pieds", bas.visee);
  for (let k = 0; k < 9; k++) await pg.keyboard.press("ArrowUp");

  /* Le zoom resserre le champ et le dit un moment. */
  await pg.locator("#ciPlus").click();
  await pg.waitForTimeout(150);
  const zoome = await etat();
  ok("le zoom resserre le champ et le dit", /, champ 48°$/.test(zoome.visee), zoome.visee);

  /* La recherche : deux groupes, puis la flèche guide jusqu'à la constellation. */
  await pg.locator("#ciChercher").click();
  await pg.waitForTimeout(200);
  const groupes = await pg.evaluate(() => [...document.querySelectorAll("#ciResultats .ci-groupe")].map(g => g.textContent.replace(/,.*/, "")));
  ok("la recherche sépare les constellations visibles et celles sous l'horizon",
    groupes.join(" | ") === "Visibles maintenant | Sous l'horizon", groupes.join(" | "));
  await pg.locator("#ciChamp").fill("grande ourse");
  await pg.waitForTimeout(150);
  await pg.locator("#ciResultats [data-cherche]").first().click();
  await pg.waitForTimeout(400);
  const guide = await etat();
  ok("une constellation cherchée hors du champ se signale avec sa direction",
    guide.cible && /^Grande Ourse, /.test(guide.cible) && !/est là/.test(guide.cible) && guide.yAller,
    JSON.stringify(guide));
  await pg.locator("#ciYAller").click();
  await pg.waitForTimeout(1500);
  const trouvee = await etat();
  ok("« Y aller » amène le regard sur la constellation cherchée",
    trouvee.cible === "Grande Ourse est là" && !trouvee.yAller, JSON.stringify(trouvee));
  await pg.locator("#ciOublier").click();
  await pg.waitForTimeout(150);
  ok("« Oublier » retire la recherche", (await etat()).cible === null);

  /* La lumière rouge. */
  await pg.locator("#ciRouge").click();
  await pg.waitForTimeout(100);
  const rouge = await pg.evaluate(() => document.getElementById("ciPleinEcran").classList.contains("ci-rouge"));
  await pg.locator("#ciRouge").click();
  ok("la lumière rouge passe tout l'écran au rouge", rouge);

  /* Le rail du curseur porte la nébulosité de la nuit, et la lecture fait
     défiler l'heure. */
  const rail = await pg.evaluate(() => {
    const t = [...document.querySelectorAll(".ci-rail i")].map(i => i.style.background);
    return { n: t.length, teintes: new Set(t).size };
  });
  ok("le rail du curseur porte la nébulosité de la nuit", rail.n === 40 && rail.teintes > 1, JSON.stringify(rail));
  const avant = await pg.locator("#ciCurseur").inputValue();
  await pg.locator("#ciLecture").click();
  await pg.waitForTimeout(600);
  await pg.locator("#ciLecture").click();
  const apres = await pg.locator("#ciCurseur").inputValue();
  ok("la lecture fait défiler la nuit", Number(apres) > Number(avant) + 2, `${avant} puis ${apres}`);
  await pg.locator("#ciFermer").click();
};
