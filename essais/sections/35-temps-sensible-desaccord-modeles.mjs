/* Le temps sensible et le désaccord entre modèles. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Le temps sensible et le désaccord entre modèles";
export const avecPage = false;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage } = T;
  etat.bruineArome = { heure: "2026-08-18T09:00", code: 51, mm: 0.2 };
  const ctxBruine = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxBruine.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxBruine);
  const pgBruine = await ctxBruine.newPage();
  await ouvrirPage(pgBruine);
  await pgBruine.waitForTimeout(900);

  ok("la règle se lit sur ses quatre cas",
    await pgBruine.evaluate(async () => {
      const P = await import("/src/previsions.js");
      /* Le cas du défaut : bruine faible qu'un seul modèle voit, sous un ciel
         couvert. Le mot redevient l'état du ciel. */
      if (P.apaiser(51, 0.2, 0, 100) !== 3) return `bruine sous ciel couvert : ${P.apaiser(51, 0.2, 0, 100)}`;
      if (P.apaiser(51, 0.2, 0, 30) !== 2) return `bruine sous éclaircies : ${P.apaiser(51, 0.2, 0, 30)}`;
      // Les deux modèles voient de l'eau : le code reste.
      if (P.apaiser(51, 0.2, 0.1, 100) !== 51) return "une pluie que les deux voient est effacée";
      // Une lame au-dessus du seuil de gêne : un seul modèle suffit.
      if (P.apaiser(61, 0.8, 0, 100) !== 61) return "une pluie franche est effacée";
      // Une seule voix, au delà de la portée d'AROME : rien à confronter.
      if (P.apaiser(51, 0.2, null, 100) !== 51) return "un code est effacé sans seconde voix";
      // La neige et l'orage ne s'apaisent jamais.
      if (P.apaiser(71, 0.2, 0, 100) !== 71) return "une neige est effacée";
      if (P.apaiser(95, 0.2, 0, 100) !== 95) return "un orage est effacé";
      return "";
    }) === "");

  /* Le défaut tel qu'il s'est produit, rejoué de bout en bout : AROME annonce une
     bruine à l'heure en cours, le modèle global reste sec. L'accueil ne doit pas
     écrire « Bruine », et la lame d'eau ne doit pas bouger pour autant. */
  const bruineDit = await pgBruine.evaluate(async () => {
    const t = document.querySelector("#ecran .bd-libelle, #ecran .bd-t b, #ecran .bd-ciel-mot");
    const P = await import("/src/previsions.js");
    const s = P.serieHoraire(0, 3, 1);
    const c = document.querySelector("#ecran");
    return {
      ecran: c ? c.textContent.slice(0, 400) : "",
      code: s ? s.code[0] : null,
      mm: s ? s.mm[0] : null,
      libelle: t ? t.textContent : null,
    };
  });
  ok("une bruine que le modèle global ne voit pas ne s'écrit pas",
    bruineDit.code === 3 && !/Bruine/.test(bruineDit.ecran),
    `code ${bruineDit.code}, écran « ${bruineDit.ecran.replace(/\s+/g, " ").slice(0, 120)} »`);

  ok("la lame d'eau n'est pas touchée par la règle",
    bruineDit.mm === 0.2, `lame ${bruineDit.mm}`);

  await ctxBruine.close();

  /* Une pluie que les deux modèles voient reste écrite : la règle ne fait pas
     taire la pluie, elle fait taire le désaccord. */
  etat.bruineArome = { heure: "2026-08-18T09:00", code: 61, mm: 1.4 };
  const ctxVraie = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxVraie.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxVraie);
  const pgVraie = await ctxVraie.newPage();
  await ouvrirPage(pgVraie);
  await pgVraie.waitForTimeout(900);
  ok("une pluie franche d'un seul modèle reste écrite",
    await pgVraie.evaluate(async () => {
      const P = await import("/src/previsions.js");
      const s = P.serieHoraire(0, 3, 1);
      return s && s.code[0] === 61 ? "" : `code ${s && s.code[0]}`;
    }) === "");
  await ctxVraie.close();
  etat.bruineArome = null;

  /* ---------- Les charges discordantes ----------

     Le défaut du 9 septembre a traversé sept cent dix-neuf contrôles parce
     qu'aucune charge d'essai ne portait de désaccord : elles sont toutes propres
     et cohérentes avec elles-mêmes, quand une source réelle ne l'est pas toujours.

     Ces charges portent donc ce qui se contredit : un code de pluie sans lame ni
     risque, un risque sans lame, une lame sans risque. L'invariant est le même
     pour toutes : le mot écrit dans le ciel et les chiffres écrits en dessous
     disent la même chose. */
};
