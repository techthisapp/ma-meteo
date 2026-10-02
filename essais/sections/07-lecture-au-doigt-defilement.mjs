/* Lecture au doigt et défilement. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Lecture au doigt et défilement";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt } = T;
  /* L'état de départ : « Heure par heure », ouvert par le grand chiffre de
     l'accueil, la voie de la température agrandie. */
  await pg.locator(".bd-deg").click();
  await pg.waitForTimeout(900);
  const boite = await pg.locator('.mg-v[data-cle="t"] .mg-s').boundingBox();
  const cx = boite.x + boite.width * 0.5, cy = boite.y + boite.height * 0.5;
  const lu = () => pg.locator('.mg-v[data-cle="t"] .mg-cur:not([hidden])').count();
  const fenLue = () => txt(".mg-fenl");

  /* Trois issues pour un même appui. L'appui bref ne fait rien : la lecture et le
     glissement se disputaient le même geste, et la lecture partait au moindre
     effleurement de la courbe. */
  await pg.mouse.move(cx, cy);
  await pg.mouse.down();
  await pg.waitForTimeout(90);
  ok("un appui bref ne lit pas la courbe", await lu() === 0);
  await pg.mouse.up();
  await pg.waitForTimeout(200);

  // L'appui maintenu ouvre la lecture, qui suit ensuite le doigt où qu'il aille.
  await pg.mouse.move(cx, cy);
  await pg.mouse.down();
  await pg.waitForTimeout(420);
  ok("un appui maintenu ouvre la lecture", await lu() === 1);
  for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 12, cy + k * 7);
  ok("la lecture ouverte suit le doigt en oblique", await lu() === 1);
  const lecture = await txt('.mg-v[data-cle="t"] .mg-r');
  ok("la lecture porte une heure et un degré",
    /^(demain |après-demain |[a-zéû]{3}\.? )?\d{2} h, -?\d+°$/.test(lecture), lecture);
  await pg.mouse.up();
  await pg.waitForTimeout(250);
  ok("le relâchement retire la lecture", await lu() === 0);
  ok("le relâchement d'une lecture ne fait pas glisser la fenêtre",
    (await fenLue()).startsWith("05 h à"), await fenLue());

  // Déplacement à quatre-vingts degrés sans appui maintenu : la page défile.
  await pg.mouse.move(cx, cy);
  await pg.mouse.down();
  for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 2, cy + k * 12);
  ok("un déplacement vertical rend la main au défilement", await lu() === 0);
  await pg.mouse.up();
  await pg.waitForTimeout(250);
  ok("le défilement vertical reste au navigateur", await pg.evaluate(() =>
    getComputedStyle(document.querySelector(".mg-s")).touchAction === "pan-y"));

  // La voie ouverte par l'accueil se referme : la suite éprouve l'agrandissement.
  await pg.locator('.mg-b[data-voie="t"]').click();
  await pg.waitForTimeout(400);
};
