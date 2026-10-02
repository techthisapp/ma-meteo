/* Les charges discordantes. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Les charges discordantes";
export const avecPage = false;

export default async T => {
  const { nav, etat, ok, brancherRoutes, RACINE_HTTP } = T;
  /* Ce que l'accueil montre du temps qu'il fait : le mot du ciel, la tuile de
     pluie, et ce que la série porte à l'heure en cours. */
  const litAccueil = `async () => {
  const P = await import("/src/previsions.js");
  const s = P.serieHoraire(0, 3, 1);
  const tuile = document.querySelector('#ecran .bd-m[data-detail="mm"]');
  return {
    mot: (document.querySelector("#ecran .bd-ciel") || {}).textContent || "",
    tuile: tuile ? tuile.textContent.replace(/\\s+/g, " ").trim() : "",
    mm: s ? s.mm[0] : null,
    pb: s ? s.pb[0] : null,
    code: s ? s.code[0] : null,
  };
}`;

  const MOTS_PLUIE = /Pluie|Bruine|Averse|Orage|Neige|Grésil/i;

  const ouvrirDiscordante = async (sansModeleFin = false) => {
    etat.aromeMuet = sansModeleFin;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, FIGE));
    await brancherRoutes(c);
    const p = await c.newPage();
    await p.goto(RACINE_HTTP, { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    /* La lecture est une chaîne : elle s'évalue comme expression, il faut donc
       l'appeler. */
    const dit = await p.evaluate(`(${litAccueil})()`);
    await c.close();
    etat.aromeMuet = false;
    return dit;
  };

  /* Un code de pluie sans lame et sans risque : la source se contredit elle-même,
     et le mot ne tient à rien. C'est le cas relevé sur le modèle global le
     9 septembre, une heure sur six annoncées pluvieuses. */
  etat.retoucheGlobal = { heure: "2026-08-18T09:00", weather_code: 61, precipitation: 0,
    precipitation_probability: 0, cloud_cover: 20 };
  /* Sans le modèle fin, la source n'a qu'une voix : il n'y a pas de désaccord à
     trancher, seulement un code qui ne tient à rien. */
  const sansRien = await ouvrirDiscordante(true);
  ok("un code de pluie sans lame ni risque ne s'écrit pas",
    !MOTS_PLUIE.test(sansRien.mot),
    `mot « ${sansRien.mot} », ${sansRien.mm} mm, ${sansRien.pb} %`);

  /* Un risque franc sans lame : le mot ne dit pas qu'il pleut, mais la tuile doit
     porter le risque, faute de quoi l'écran ne dirait rien de ce qui menace. */
  etat.retoucheGlobal = { heure: "2026-08-18T09:00", weather_code: 1, precipitation: 0,
    precipitation_probability: 80, cloud_cover: 40 };
  const risqueSeul = await ouvrirDiscordante();
  ok("un risque sans lame se dit en risque et non en pluie",
    !MOTS_PLUIE.test(risqueSeul.mot) && /%/.test(risqueSeul.tuile),
    `mot « ${risqueSeul.mot} », tuile « ${risqueSeul.tuile} »`);

  /* Une lame franche sans risque annoncé : le mot dit la pluie, et la tuile porte
     des millimètres. Une tuile qui dirait « 0 % de risque » sous trois
     millimètres serait le défaut du 9 septembre à l'envers. */
  etat.retoucheGlobal = { heure: "2026-08-18T09:00", weather_code: 61, precipitation: 3,
    precipitation_probability: 0, cloud_cover: 90 };
  const lameSeule = await ouvrirDiscordante();
  ok("une lame franche sans risque se dit en millimètres",
    MOTS_PLUIE.test(lameSeule.mot) && /mm/.test(lameSeule.tuile),
    `mot « ${lameSeule.mot} », tuile « ${lameSeule.tuile} »`);

  /* L'invariant, sur les trois charges à la fois : ce que le ciel écrit et ce que
     les chiffres portent ne se contredisent jamais. */
  const accord = d => {
    if (!MOTS_PLUIE.test(d.mot)) return true;
    return (d.mm ?? 0) >= 0.1 || (d.pb ?? 0) >= 5;
  };
  ok("le mot du ciel et les chiffres ne se contredisent pas",
    [sansRien, risqueSeul, lameSeule].every(accord),
    [sansRien, risqueSeul, lameSeule].filter(d => !accord(d))
      .map(d => `« ${d.mot} » avec ${d.mm} mm et ${d.pb} %`).join(" ; "));

  etat.retoucheGlobal = null;

  /* ---------- La carte ---------- */
};
