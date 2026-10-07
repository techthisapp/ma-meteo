/* Le plein écran et la mémoire de la carte. Section écrite le 3 octobre 2026
   pour le jalon 19, lot 7 ; elle part d'un état neuf préparé par
   essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Le plein écran et la mémoire de la carte";
export const avecPage = false;

export default async T => {
  const { ok, ouvrirCarte, ouvrirPage, reposer } = T;
  const [c, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(p, 1500);

  /* Le plein écran retire les deux barres et donne toute la hauteur à la
     carte ; le même bouton les ramène. */
  const mesure = () => p.evaluate(() => ({
    nav: getComputedStyle(document.getElementById("nav")).display, onglets: getComputedStyle(document.getElementById("onglets")).display,
    haut: Math.round(document.querySelector(".ca-cadre").getBoundingClientRect().height), fenetre: window.innerHeight,
    presse: document.getElementById("caPlein").getAttribute("aria-pressed"),
    outils: Math.round(document.querySelector(".ca-outils").getBoundingClientRect().top) }));
  await p.locator("#caPlein").click();
  await reposer(p, 600);
  const plein = await mesure();
  await p.locator("#caPlein").click();
  await reposer(p, 600);
  const normal = await mesure();
  ok("le plein écran retire les barres et donne toute la hauteur à la carte, le même bouton les ramène",
    plein.nav === "none" && plein.onglets === "none" && plein.haut === plein.fenetre && plein.presse === "true"
    && normal.nav !== "none" && normal.onglets !== "none" && normal.haut < normal.fenetre - 80 && normal.presse === "false",
    JSON.stringify({ plein, normal }));

  /* La mémoire : un cadrage sur Fain se retrouve en revenant d'un autre
     onglet, puis après un relancement ; un second appui sur l'onglet ramène
     la France. */
  const echelle = q => q.evaluate(() => document.querySelector(".ca-echelle span").textContent);
  const france = await echelle(p);
  await p.locator("#caIci").click();
  await p.locator("#caToile").press("+");
  await reposer(p, 1500);
  const pres = await echelle(p);
  await p.locator('[data-onglet="accueil"]').click();
  await reposer(p, 800);
  await p.locator('[data-onglet="carte"]').click();
  await reposer(p, 1200);
  const retour = await echelle(p);
  const p2 = await c.newPage();
  await ouvrirPage(p2);
  await p2.locator('[data-onglet="carte"]').click();
  await reposer(p2, 1500);
  const relance = await echelle(p2);
  await p2.locator('[data-onglet="carte"]').click();
  await reposer(p2, 1200);
  const remis = await echelle(p2);
  ok("la carte rouvre sur son dernier cadrage, même relancée, et un second appui sur l'onglet ramène la France",
    pres !== france && retour === pres && relance === pres && remis === france,
    JSON.stringify({ france, pres, retour, relance, remis }));

  /* La légende réunie, version 155 : la nappe, le vent, la foudre et les feux
     dans une seule boîte basse ; un appui la replie en une pastille, le choix
     se garde, un autre appui la déplie. Depuis la version 180, le curseur de
     la période des feux y ajoute une ligne : la boîte ouverte tient en 130
     points. */
  const [, q] = await ouvrirCarte({ ...FAIN, nappe: "temp", ventcarte: true, foudrecarte: true, feuxcarte: true,
    pluiecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(q, 1500);
  const boite = () => q.evaluate(async () => {
    const b = document.getElementById("caLegendes");
    return { boites: [...document.querySelectorAll(".ca-legendes")].length, haut: Math.round(b.getBoundingClientRect().height),
      vus: ["caLegende", "caLegVent", "caLegFoudre", "caLegFeux"].filter(id => !document.getElementById(id).hidden).length,
      replie: (await import("/src/reglages.js")).legendeRepliee() };
  });
  const ouverte = await boite();
  await q.locator("#caLegendes").click();
  await q.waitForTimeout(300);
  const repliee = await boite();
  await q.locator("#caLegendes").click();
  await q.waitForTimeout(300);
  const rouverte = await boite();
  ok("les légendes tiennent dans une seule boîte basse, qu'un appui replie et déplie",
    ouverte.boites === 1 && ouverte.vus === 4 && ouverte.haut <= 130 && !ouverte.replie
    && repliee.haut <= 32 && repliee.replie && rouverte.haut === ouverte.haut && !rouverte.replie,
    JSON.stringify({ ouverte, repliee, rouverte }));
};
