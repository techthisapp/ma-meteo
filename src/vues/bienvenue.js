/* La présentation du premier lancement, version 200, audit d'usage du
   13 octobre 2026, choix de Jérôme : ce que fait l'application, son
   installation sur le téléphone, et la clé de Météo-France. Trois cartes
   empilées, sans glissement de côté, sous les deux boutons qui choisissent
   le lieu ; la même présentation se rouvre depuis les réglages. */

import { esc } from "../horloge.js";
import { ico } from "../icones.js";

export const PORTAIL = "https://portail-api.meteofrance.fr";

/* L'application tourne-t-elle déjà depuis l'écran d'accueil du téléphone ? */
export function installee(w = globalThis) {
  try {
    return w.matchMedia?.("(display-mode: standalone)")?.matches === true || w.navigator?.standalone === true;
  } catch { return false; }
}

/* Le système, pour dire le bon geste d'installation. */
export function systeme(ua = globalThis.navigator?.userAgent || "") {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return "ios";
  if (/Android/.test(ua)) return "android";
  return "autre";
}

const GESTES = {
  ios: "Dans Safari, touchez le bouton Partager en bas de l'écran, puis « Sur l'écran d'accueil ».",
  android: "Dans Chrome, ouvrez le menu en haut à droite, puis « Installer l'application ».",
  autre: "Ouvrez cette page dans le navigateur du téléphone, Safari sur iPhone ou Chrome sur Android, "
    + "puis ajoutez-la à l'écran d'accueil depuis son menu de partage.",
};

const carte = (symbole, titre, corps, cle) =>
  `<div class="carte bv-carte" data-bienvenue="${cle}"><div class="bv-tete">${ico(symbole, "bv-ic")}`
  + `<h3>${esc(titre)}</h3></div>${corps}</div>`;

export function presentationHTML({ dejaInstallee = installee(), os = systeme() } = {}) {
  return `<div class="bienvenue">`
    + carte("soleil", "Ce que fait Ma météo",
      `<p>La prévision de votre commune, la pluie de l'heure qui vient, des conseils pour s'habiller et `
      + `choisir le bon moment, la semaine avec sa confiance, la carte et le ciel.</p>`
      + `<p class="note">Sans compte ni publicité. Les services interrogés ne reçoivent que la position `
      + `arrondie, à un kilomètre près.</p>`, "objet")
    + (dejaInstallee ? "" : carte("maison", "L'installer sur le téléphone",
      `<p>${esc(GESTES[os])}</p>`
      + `<p class="note">Installée, l'application s'ouvre en plein écran et garde la dernière prévision `
      + `hors connexion.</p>`, "installer"))
    + carte("info", "La clé de Météo-France, facultative",
      `<p>Une clé gratuite du portail des API de Météo-France ajoute la prévision de la pluie au kilomètre, `
      + `les mesures de la station la plus proche, le danger d'incendie et les bulletins d'avalanche.</p>`
      + `<p class="note">Elle se crée sur <a href="${PORTAIL}" target="_blank" rel="noopener">le portail `
      + `de Météo-France</a> et se colle dans les réglages, carte « Prévision immédiate ».</p>`, "cle")
    + `</div>`;
}

/* La feuille, rouverte depuis les réglages. */
export function vueBienvenue() {
  return { titre: "Présentation", sous: "", corps: presentationHTML() };
}
