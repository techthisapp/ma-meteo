/* Couche navigation. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Couche navigation";
export const avecPage = true;

export default async T => {
  const { pg, etat, ok, txt, onglet } = T;
  /* Quatre destinations depuis le 25 septembre 2026 : « Le temps » a quitté la
     barre et s'ouvre en page de détail. Les trois premières se lisent en
     échelle de temps, de l'instant au ciel de la nuit ; la carte lit l'espace,
     elle vient après. */
  ok("la barre d'onglets porte quatre destinations",
    await pg.locator(".onglet").count() === 4, String(await pg.locator(".onglet").count()));
  const nomsOnglets = (await pg.locator(".onglet span").allInnerTexts()).join(",");
  ok("les destinations sont les bonnes",
    nomsOnglets === "Accueil,À venir,Le ciel,La carte", nomsOnglets);
  ok("aucun libellé d'onglet n'est tronqué", await pg.evaluate(() =>
    [...document.querySelectorAll(".onglet span")]
      .every(e => e.scrollWidth <= e.clientWidth + 1)));
  ok("un seul onglet est courant",
    await pg.locator('.onglet[aria-current="page"]').count() === 1);
  ok("la barre d'onglets est ancrée en bas", await pg.evaluate(() => {
    const b = document.querySelector(".onglets").getBoundingClientRect();
    return Math.abs(b.bottom - window.innerHeight) < 2;
  }));
  ok("la barre de tête porte la commune", (await txt("#navLieuNom")) === "Fain-lès-Moutiers",
    await txt("#navLieuNom"));
  ok("le bouton de commune ouvre la feuille des communes",
    await pg.getAttribute("#navLieu", "data-feuille") === "communes");
  /* La charge d'essai est sèche : le rappel de parapluie n'a rien à dire, et le
     silence est son état par défaut. Le reste de ses contrôles est plus bas, sur
     des contextes qui portent de la pluie. */
  ok("une journée sèche ne fait paraître aucun jeton de parapluie",
    await pg.locator("#navJeton").isHidden());
  /* Une feuille refermée avant la première image de son ouverture reste fermée,
     et une feuille rouverte pendant les 260 ms de sa fermeture reste ouverte.
     L'image d'écran est retenue à la main : l'ordre des événements ne dépend
     pas de la vitesse du poste. Sur un Mac rapide, le contrôle de la rivière
     refermait la feuille de l'eau avant cette image, et la feuille restait
     ouverte sans entrée d'historique, le 1er octobre 2026. */
  const feuilleCourse = await pg.evaluate(async () => {
    const f = document.getElementById("feuille"), reglages = document.getElementById("btnReglages");
    const etat = () => `${f.hidden ? "masquée" : "visible"} ${f.classList.contains("ouverte") ? "ouverte" : "fermée"}`
      + ` ${history.state?.feuille ? "historique" : "sans"}`;
    const attendre = ms => new Promise(r => setTimeout(r, ms));
    const retour = () => { const p = new Promise(r => addEventListener("popstate", () => setTimeout(r, 0), { once: true }));
      history.back(); return p; };
    const raf = window.requestAnimationFrame, retenues = [];
    window.requestAnimationFrame = cb => { retenues.push(cb); return 0; };
    reglages.click();
    await retour();
    window.requestAnimationFrame = raf;
    retenues.forEach(cb => cb(performance.now()));
    await attendre(400);
    const avantImage = etat();
    if (!f.hidden && !history.state?.feuille) return { avantImage };
    reglages.click();
    await attendre(400);
    await retour();
    await attendre(50);
    reglages.click();
    await attendre(400);
    const pendantFermeture = etat();
    /* Sans entrée d'historique, un retour quitterait la page d'essai. */
    if (history.state?.feuille) await retour();
    await attendre(400);
    return { avantImage, pendantFermeture, apres: etat() };
  });
  ok("une feuille refermée avant sa première image reste fermée, et rouverte pendant sa fermeture reste ouverte",
    feuilleCourse.avantImage === "masquée fermée sans" && feuilleCourse.pendantFermeture === "visible ouverte historique"
    && feuilleCourse.apres === "masquée fermée sans", JSON.stringify(feuilleCourse));
};
