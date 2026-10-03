/* Lecture au doigt et défilement. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Lecture au doigt et défilement";
export const avecPage = true;

export default async T => {
  const { pg, ok } = T;
  /* L'état de départ : « Heure par heure », ouvert par le grand chiffre de
     l'accueil, la voie de la température agrandie. */
  await pg.locator(".bd-deg").click();
  await pg.waitForTimeout(900);
  const boite = await pg.locator('.mg-v[data-cle="t"] .mg-s').boundingBox();
  const cx = boite.x + boite.width * 0.5, cy = boite.y + boite.height * 0.5;
  /* Depuis le jalon 21, lot 2 : la lecture se fait dans la bulle sous l'axe,
     un toucher bref suffit, et elle reste posée au relâchement. */
  const bulle = () => pg.evaluate(() => ({ h: document.querySelector(".mg-lu-h")?.textContent || "",
    t: document.querySelector(".mg-lu-c b")?.textContent || "",
    cur: [...document.querySelectorAll('.mg-v[data-cle="t"] .mg-cur')].filter(c => c.style.display !== "none").length }));
  const depart = await bulle();
  ok("au repos, la bulle lit l'heure en cours", depart.h === "Maintenant" && /^-?\d+°$/.test(depart.t), JSON.stringify(depart));

  await pg.mouse.move(cx, cy);
  await pg.mouse.down();
  await pg.waitForTimeout(60);
  await pg.mouse.up();
  await pg.waitForTimeout(200);
  const touche = await bulle();
  ok("un toucher bref lit l'heure touchée et pose le montant", touche.h !== depart.h && touche.cur === 1, JSON.stringify(touche));
  ok("la lecture porte une heure et un degré",
    /^(Demain |Après-demain |[a-zéû]{3}\.? )?\d{2} h$/i.test(touche.h) && /^-?\d+°$/.test(touche.t), JSON.stringify(touche));
  await pg.waitForTimeout(400);
  ok("la lecture reste posée après le relâchement", (await bulle()).h === touche.h);

  // Le doigt qui court à l'horizontale fait suivre la lecture.
  await pg.mouse.move(cx, cy);
  await pg.mouse.down();
  for (let k = 1; k <= 6; k++) await pg.mouse.move(cx + k * 14, cy + k * 2);
  await pg.mouse.up();
  await pg.waitForTimeout(200);
  const suivie = await bulle();
  ok("la lecture suit le doigt à l'horizontale", suivie.h !== touche.h && suivie.cur === 1, JSON.stringify(suivie));

  // Déplacement à quatre-vingts degrés : la page défile, la lecture ne bouge pas.
  await pg.mouse.move(cx - 60, cy);
  await pg.mouse.down();
  for (let k = 1; k <= 6; k++) await pg.mouse.move(cx - 60 + k * 2, cy + k * 12);
  await pg.mouse.up();
  await pg.waitForTimeout(250);
  ok("un déplacement vertical rend la main au défilement", (await bulle()).h === suivie.h);
  ok("le défilement vertical reste au navigateur", await pg.evaluate(() =>
    getComputedStyle(document.querySelector(".mg-s")).touchAction === "pan-y"));

  // La voie ouverte par l'accueil se referme : la suite éprouve l'agrandissement.
  await pg.locator('.mg-b[data-voie="t"]').click();
  await pg.waitForTimeout(400);
};
