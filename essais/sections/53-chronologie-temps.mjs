/* La chronologie dans le temps. Section écrite le 3 octobre 2026 pour le
   jalon 19, lot 5c ; elle part d'un état neuf préparé par essais/banc.mjs. Le
   radar fabriqué porte treize images observées et deux extrapolées, la
   dernière à 9 h 20 ; la grille prévue est décrite dans `prevueCorps`. */
import { FAIN } from "../faux-services.mjs";

export const titre = "La chronologie dans le temps";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer } = T;
  const piste = p => p.evaluate(() => {
    const x = document.getElementById("caPiste");
    return { cache: document.getElementById("caTemps").hidden, max: x.getAttribute("aria-valuemax"),
      rang: x.getAttribute("aria-valuenow"), texte: x.getAttribute("aria-valuetext"),
      heure: document.getElementById("caHeure").textContent, titre: document.getElementById("caLegTitre").textContent,
      resume: document.getElementById("caResume").textContent };
  });
  const touche = async (p, k, n = 1) => {
    await p.locator("#caPiste").focus();
    for (let i = 0; i < n; i++) await p.keyboard.press(k);
    await reposer(p, 1200);
  };

  /* La pluie allumée : le radar, puis douze heures prévues. Rester sur le
     radar ne lit pas la grille prévue ; la dernière heure la lit, une fois. */
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: true, foudrecarte: false, vigicarte: false }, 2, { sansFond: true });
  await reposer(p, 1500);
  const ouverte = await piste(p);
  await touche(p, "ArrowLeft", 3);
  const surRadar = etat.appelsPrevue.length;
  await touche(p, "End");
  const bout = await piste(p);
  ok("après le radar, la piste porte douze heures prévues, et la grille prévue ne se lit qu'en y allant",
    ouverte.max === "26" && ouverte.rang === "12" && surRadar === 0 && etat.appelsPrevue.length === 1
    && bout.rang === "26" && bout.heure === "21 h" && /, prévu$/.test(bout.texte),
    JSON.stringify({ ouverte, surRadar, bout, appels: etat.appelsPrevue.length }));

  /* Sur une heure prévue, la pluie se peint d'après la grille : la Bretagne
     pleut, Lyon reste sec ; le radar ne se peint pas. */
  const pixel = (la, lo) => p.evaluate(async ([la, lo]) => {
    const C = await import("/src/carte.js");
    const cv = document.getElementById("caToile");
    const q = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
    return [...cv.getContext("2d").getImageData(Math.round(q.x * 2), Math.round(q.y * 2), 1, 1).data].slice(0, 3).join(",");
  }, [la, lo]);
  await touche(p, "Home");
  await touche(p, "ArrowRight", 15);
  const prevue = { bretagne: await pixel(48.2, -2.4), lyon: await pixel(45.75, 4.85), rang: (await piste(p)).rang };
  await p.locator("#caCouches").click();
  await p.locator("#caPluie").click();
  await p.locator("#caCouches").click();
  await reposer(p, 800);
  const nu = { bretagne: await pixel(48.2, -2.4), lyon: await pixel(45.75, 4.85), cache: (await piste(p)).cache };
  ok("sur une heure prévue, la pluie vient de la grille prévue, et sans pluie ni nappe horaire la piste disparaît",
    prevue.rang === "15" && prevue.bretagne !== nu.bretagne && prevue.lyon === nu.lyon && nu.cache,
    JSON.stringify({ prevue, nu }));

  /* Sans la pluie, une nappe horaire fait paraître la piste, de maintenant
     à douze heures ; la légende et le résumé disent l'heure prévue et sa
     valeur. */
  const choisir = async id => {
    await p.locator("#caCouches").click();
    await p.waitForTimeout(150);
    await p.locator(`#${id}`).click();
    await p.locator("#caCouches").click();
    await reposer(p, 1200);
  };
  await choisir("caVentMoy");
  const vent0 = await piste(p);
  await touche(p, "ArrowRight", 6);
  const vent6 = await piste(p);
  const nombre = t => Number((/(\d+) km\/h au lieu courant/.exec(t) || [])[1]);
  ok("une nappe horaire fait paraître la piste sans la pluie, et la légende dit l'heure prévue",
    !vent0.cache && vent0.max === "12" && vent0.titre === "Vent moyen, maintenant (km/h)"
    && vent6.titre === "Vent moyen, prévue à 15 h (km/h)" && nombre(vent6.resume) > nombre(vent0.resume),
    JSON.stringify({ vent0, vent6 }));

  /* La température suit l'heure : à 21 h, la nuit de la grille prévue. */
  await choisir("caTemp");
  await touche(p, "Home");
  const t0 = await piste(p);
  await touche(p, "End");
  const t12 = await piste(p);
  const degres = t => Number((/(-?\d+) degrés au lieu courant/.exec(t) || [])[1]);
  ok("la température suit l'heure de la piste",
    t12.heure === "21 h" && /prévue à 21 h/.test(t12.titre) && degres(t12.resume) < degres(t0.resume) - 5,
    JSON.stringify({ t0: t0.resume, t12: t12.resume, titre: t12.titre }));

  /* Une nappe qui ne change pas d'heure en heure ne fait pas paraître la
     piste. */
  await choisir("caUV");
  ok("une nappe du jour ne fait pas paraître la piste", (await piste(p)).cache);
};
