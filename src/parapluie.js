/* Le rappel de parapluie.

   Sans service dorsal, aucune notification ne peut être poussée. Trois
   mécanismes contournent la limite, du plus léger au plus engageant : un jeton
   dans la barre de tête, l'objet qui convient, et un rappel posé dans l'agenda
   du téléphone.

   Le silence est l'état par défaut. Une journée sèche ne produit ni jeton, ni
   proposition d'agenda. */

import { heureTxt } from "./horloge.js";
import { SEUILS } from "./conseils.js";

/* La gêne. Une bruine à un dixième de millimètre par heure ne trempe personne,
   et un jeton qui paraîtrait pour elle finirait par ne plus se lire. Un demi-
   millimètre est le seuil au delà duquel on rentre mouillé.

   Le retournement. Un parapluie ne tient pas au delà de quarante kilomètres par
   heure de rafale : l'annoncer alors est un mauvais conseil, et c'est une
   capuche qu'il faut. Le seuil est celui de la règle des rafales, repris de
   `conseils.js` plutôt que recopié : deux nombres égaux écrits à deux endroits
   finissent par diverger. */
export const GENE = 0.5;
export const RETOURNEMENT = SEUILS.rafale;

/* Les heures de sortie, au pas de la demi-heure. Deux fenêtres, matin et soir.
   Une seule manquerait le retour du soir, ou couvrirait la journée entière et ne
   dirait plus rien.

   La source est horaire, mais une fenêtre au pas de la demi-heure reste juste :
   une heure de prévision couvre l'intervalle qui la suit, et elle compte dès
   qu'elle rencontre la fenêtre. Une sortie à sept heures et demie retient bien
   l'heure de sept heures, dont la seconde moitié est dehors. */
export const SORTIES_DEFAUT = [[7.5, 9], [17, 19]];

/* Une heure de prévision couvre `[h, h + 1)`. Elle rencontre la fenêtre dès que
   les deux intervalles se croisent, non quand son début tombe dedans. */
const chevauche = (h, h0, h1) => h + 1 > h0 && h < h1;

// « 07:30 » quand la demie est prise, « 09 h » sinon.
export const heureDemie = h => (h % 1
  ? `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`
  : heureTxt(h));

export const fenetreTxt = (h0, h1) => `${heureDemie(h0)} à ${heureDemie(h1)}`;

export const OBJETS = {
  parapluie: ["Parapluie", "parapluie"],
  capuche: ["Capuche", "capuche"],
};

const cleJour = d => `${d.getFullYear()}-`
  + `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Le jeton du jour, ou `null`.

   La fenêtre retenue est la première de la journée qui porte encore des heures
   à venir : le jeton nomme la sortie qui vient. Une fenêtre déjà commencée
   compte pour ses heures restantes, il est utile de savoir qu'il pleut pendant
   celle qu'on traverse ; une fenêtre entièrement passée est écartée, annoncer
   un parapluie pour huit heures à dix heures du matin n'aidant personne.

   Une seule condition écarte une heure, celle qui la dit passée. La fenêtre
   n'est pas jugée une seconde fois sur l'heure qu'il est : deux gardes pour un
   même fait se couvrent l'une l'autre, et aucune ne se contrôle plus.

   La sortie qui vient décide seule. Une matinée sèche ne renvoie pas au soir :
   le jeton dit ce qu'il faut prendre maintenant, et le soir aura son tour. */
export function jeton(serie, sorties, maintenant = new Date()) {
  if (!serie || !Array.isArray(serie.heure)) return null;
  const jour = cleJour(maintenant);
  const hMaintenant = maintenant.getHours();

  for (const [h0, h1] of [...sorties].sort((a, b) => a[0] - b[0])) {
    let mm = 0, raf = 0, vu = false;
    for (let k = 0; k < serie.n; k++) {
      if (serie.jour[k] !== jour) continue;
      const h = serie.heure[k];
      if (!chevauche(h, h0, h1) || h < hMaintenant) continue;
      vu = true;
      mm = Math.max(mm, serie.mm[k] || 0);
      raf = Math.max(raf, serie.raf[k] || 0);
    }
    if (!vu) continue;                 // fenêtre passée, ou hors de la charge
    if (mm < GENE) return null;        // la sortie qui vient est sèche
    return {
      objet: raf >= RETOURNEMENT ? "capuche" : "parapluie",
      jour, h0, h1, mm: Math.round(mm * 10) / 10, raf: Math.round(raf),
      cle: `${jour}|${h0}-${h1}`,
    };
  }
  return null;
}

// Ce que le jeton écrit, en une ligne.
export const motDe = j => (j
  ? `${OBJETS[j.objet][0]}, ${fenetreTxt(j.h0, j.h1)}` : "");

/* Les journées pluvieuses de l'horizon, une par jour, pour la variante qui pose
   un évènement par journée. La fenêtre retenue est celle des sorties, non la
   journée entière : un rappel à trois heures du matin n'a pas d'objet. */
export function journeesPluvieuses(serie, sorties, maintenant = new Date()) {
  if (!serie || !Array.isArray(serie.jour)) return [];
  const par = new Map();
  const t0 = maintenant.getTime();
  for (let k = 0; k < serie.n; k++) {
    const h = serie.heure[k];
    const f = sorties.find(([a, b]) => chevauche(h, a, b));
    if (!f) continue;
    /* Une heure compte jusqu'à sa fin : celle qui est en cours n'est pas passée,
       et le jeton comme l'agenda retiennent la même. */
    const [aa, mo, jj] = serie.jour[k].split("-").map(Number);
    if (new Date(aa, mo - 1, jj, h + 1).getTime() <= t0) continue;
    const cle = `${serie.jour[k]}|${f[0]}-${f[1]}`;
    const d = par.get(cle) || { jour: serie.jour[k], h0: f[0], h1: f[1], mm: 0, raf: 0 };
    d.mm = Math.max(d.mm, serie.mm[k] || 0);
    d.raf = Math.max(d.raf, serie.raf[k] || 0);
    par.set(cle, d);
  }
  return [...par.values()]
    .filter(d => d.mm >= GENE)
    .map(d => ({ ...d, objet: d.raf >= RETOURNEMENT ? "capuche" : "parapluie",
      mm: Math.round(d.mm * 10) / 10, raf: Math.round(d.raf),
      cle: `${d.jour}|${d.h0}-${d.h1}` }))
    .sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : a.h0 - b.h0));
}

/* Le fichier d'agenda, fabriqué sur l'appareil. C'est ce qui donne une vraie
   alerte sans aucun service dorsal : l'agenda du téléphone s'en charge ensuite.

   Les horodatages sont écrits en heure locale flottante, sans fuseau : un
   rappel de sortie est attaché à l'heure du lieu, non à un instant absolu, et
   une heure flottante suit l'appareil sans table de fuseaux à embarquer.

   Les lignes se replient à soixante-quinze octets, comme la norme le demande,
   et se terminent par un retour chariot suivi d'un saut de ligne. */
/* Le repli compte des octets et non des caractères, comme la norme le demande :
   un nom accentué pèse plus que sa longueur. La coupure tombe entre deux points
   de code, jamais au milieu d'un caractère, et la ligne de suite commence par
   une espace, qui compte dans les soixante-quinze. */
const OCTETS = c => (c.codePointAt(0) < 0x80 ? 1
  : c.codePointAt(0) < 0x800 ? 2 : c.codePointAt(0) < 0x10000 ? 3 : 4);

const plier = ligne => {
  const out = [];
  let cour = "", n = 0;
  for (const c of ligne) {
    const o = OCTETS(c);
    if (n + o > 75) { out.push(cour); cour = " "; n = 1; }
    cour += c;
    n += o;
  }
  out.push(cour);
  return out.join("\r\n");
};

const echapper = t => String(t)
  .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
  .replace(/\r?\n/g, "\\n");

const horoLocal = (jour, h) => `${jour.replace(/-/g, "")}T`
  + `${String(Math.floor(h)).padStart(2, "0")}`
  + `${String(Math.round((h % 1) * 60)).padStart(2, "0")}00`;

const horoUTC = d => `${d.getUTCFullYear()}`
  + `${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  + `${String(d.getUTCDate()).padStart(2, "0")}T`
  + `${String(d.getUTCHours()).padStart(2, "0")}`
  + `${String(d.getUTCMinutes()).padStart(2, "0")}`
  + `${String(d.getUTCSeconds()).padStart(2, "0")}Z`;

// Quinze minutes avant la sortie : le temps de trouver le parapluie.
export const AVANCE = 15;

export function ics(jetons, commune, maintenant = new Date()) {
  const lot = (Array.isArray(jetons) ? jetons : [jetons]).filter(Boolean);
  if (!lot.length) return "";
  const l = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Ma meteo//Rappel de parapluie//FR",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  for (const j of lot) {
    const titre = `${OBJETS[j.objet][0]}${commune ? ` à ${commune}` : ""}`;
    l.push("BEGIN:VEVENT");
    l.push(`UID:${j.cle.replace(/[^0-9A-Za-z-]/g, "")}@ma-meteo`);
    l.push(`DTSTAMP:${horoUTC(maintenant)}`);
    l.push(`DTSTART:${horoLocal(j.jour, j.h0)}`);
    l.push(`DTEND:${horoLocal(j.jour, j.h1)}`);
    l.push(plier(`SUMMARY:${echapper(titre)}`));
    l.push(plier(`DESCRIPTION:${echapper(`${nombreVirgule(j.mm)} mm attendus`
      + `, rafales jusqu'à ${j.raf} km/h.`)}`));
    l.push("BEGIN:VALARM", "ACTION:DISPLAY",
      plier(`DESCRIPTION:${echapper(titre)}`), `TRIGGER:-PT${AVANCE}M`, "END:VALARM");
    l.push("END:VEVENT");
  }
  l.push("END:VCALENDAR");
  return `${l.join("\r\n")}\r\n`;
}

// La virgule décimale, comme partout ailleurs dans l'application.
const nombreVirgule = v =>
  (Math.abs(v) >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(".", ","));
