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

/* Les instants d'alerte, au pas de la demi-heure. Ce sont les moments où l'on
   veut être prévenu, non les moments où l'on regarde s'il pleut : ce sont les
   occasions de prendre un parapluie avant de sortir.

   Chaque alerte couvre le temps qui la sépare de la suivante, la dernière
   s'arrêtant à minuit. L'alerte du matin répond donc de la pluie de quatorze
   heures, que l'on rencontrera sans être repassé chez soi.

   La tranche qui va de minuit à la première alerte n'est couverte par personne,
   et c'est voulu : on n'y sort pas, et prévenir d'une pluie de nuit ne donne
   aucune occasion de prendre quoi que ce soit. */
export const ALERTES_DEFAUT = [7.5, 17];

// Les périodes d'une journée, telles que les instants d'alerte les découpent.
export function periodes(alertes) {
  const a = [...new Set(alertes)].filter(h => h >= 0 && h < 24).sort((x, y) => x - y);
  return a.map((h, i) => [h, i + 1 < a.length ? a[i + 1] : 24]);
}

/* Une heure de prévision couvre `[h, h + 1)`. Elle rencontre la période dès que
   les deux intervalles se croisent, non quand son début tombe dedans : une
   alerte à sept heures et demie retient bien l'heure de sept heures, dont la
   seconde moitié est devant soi. */
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

/* Les salves de pluie d'une période : les suites d'heures consécutives au delà
   du seuil de gêne. Une averse de quatorze heures et une autre de dix-neuf
   heures sont deux salves, et les fondre en une seule ferait annoncer cinq
   heures de pluie là où il en tombe deux. */
function salvesDe(serie, jour, h0, h1, hMin) {
  const heures = [];
  let mm = 0, raf = 0;
  for (let k = 0; k < serie.n; k++) {
    if (serie.jour[k] !== jour) continue;
    const h = serie.heure[k];
    if (!chevauche(h, h0, h1) || h < hMin) continue;
    if ((serie.mm[k] || 0) < GENE) continue;
    heures.push(h);
    mm = Math.max(mm, serie.mm[k] || 0);
    raf = Math.max(raf, serie.raf[k] || 0);
  }
  if (!heures.length) return null;
  heures.sort((a, b) => a - b);
  const salves = [];
  for (const h of heures) {
    const der = salves[salves.length - 1];
    if (der && der[1] === h) der[1] = h + 1;
    else salves.push([h, h + 1]);
  }
  return { salves, mm, raf };
}

/* Toutes les périodes d'alerte à venir qui portent de la pluie gênante, du plus
   proche au plus lointain, sur tout l'horizon chargé.

   Une heure déjà passée ne compte pas : annoncer un parapluie pour huit heures
   à dix heures du matin n'aide personne. Une heure est passée quand elle est
   entièrement derrière, celle qui est en cours comptant encore. */
export function periodesPluvieuses(serie, alertes, maintenant = new Date()) {
  if (!serie || !Array.isArray(serie.jour)) return [];
  const aujourdhui = cleJour(maintenant);
  const hCourante = maintenant.getHours();
  const decoupe = periodes(alertes);
  const out = [];

  for (const jour of [...new Set(serie.jour)].sort()) {
    if (jour < aujourdhui) continue;
    const passe = jour === aujourdhui;
    for (const [alerte, fin] of decoupe) {
      /* Une seule condition écarte une heure, celle qui la dit passée. Une
         période entièrement derrière soi n'a plus une seule heure à venir et
         tombe donc d'elle-même : l'écarter une seconde fois sur sa borne de fin
         serait une garde que rien ne peut plus éprouver. */
      const p = salvesDe(serie, jour, alerte, fin, passe ? hCourante : -1);
      if (!p) continue;
      const [h0, h1] = p.salves[0];
      out.push({
        objet: p.raf >= RETOURNEMENT ? "capuche" : "parapluie",
        jour, alerte, fin, h0, h1, salves: p.salves,
        mm: Math.round(p.mm * 10) / 10, raf: Math.round(p.raf),
        cle: `${jour}|${alerte}`,
      });
    }
  }
  return out;
}

/* Le jeton du jour, ou `null`. C'est la première période pluvieuse de la
   journée en cours : la dernière alerte s'arrêtant à minuit, une pluie du
   lendemain relève de l'alerte du lendemain, et non de celle de ce soir. */
export function jeton(serie, alertes, maintenant = new Date()) {
  const jour = cleJour(maintenant);
  return periodesPluvieuses(serie, alertes, maintenant).find(p => p.jour === jour) || null;
}

// Les heures de pluie d'une période, écrites comme on les dirait.
export const pluieTxt = p => (p
  ? p.salves.map(([a, b]) => fenetreTxt(a, b)).join(" et ") : "");

// Ce que le jeton écrit, en une ligne.
export const motDe = j => (j
  ? `${OBJETS[j.objet][0]}, pluie de ${pluieTxt(j)}` : "");

/* Le fichier d'agenda, fabriqué sur l'appareil. C'est ce qui donne une vraie
   alerte sans aucun service dorsal : l'agenda du téléphone s'en charge ensuite.

   Le rappel se pose à l'instant d'alerte de la période, non à l'heure de la
   pluie : c'est en sortant qu'on prend un parapluie, et un rappel qui sonne
   quand la pluie tombe arrive trop tard. Quand l'instant d'alerte est déjà
   passé, il se pose au début de la pluie, l'alarme gardant son avance.

   Les horodatages sont écrits en heure locale flottante, sans fuseau : un
   rappel de sortie est attaché à l'heure du lieu, non à un instant absolu, et
   une heure flottante suit l'appareil sans table de fuseaux à embarquer. */

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

// Quinze minutes avant l'alerte : le temps de trouver le parapluie.
export const AVANCE = 15;

// Une demi-heure de rendez-vous, bornée à la fin de la journée.
const DUREE = 0.5;

/* L'heure à laquelle le rappel se pose. L'instant d'alerte tant qu'il est
   devant soi, le début de la pluie sinon. */
export function departDe(p, maintenant = new Date()) {
  const h = maintenant.getHours() + maintenant.getMinutes() / 60;
  return (p.jour > cleJour(maintenant) || p.alerte > h) ? p.alerte : p.h0;
}

export function ics(lots, commune, maintenant = new Date()) {
  const lot = (Array.isArray(lots) ? lots : [lots]).filter(Boolean);
  if (!lot.length) return "";
  const l = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Ma meteo//Rappel de parapluie//FR",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  for (const p of lot) {
    const titre = `${OBJETS[p.objet][0]}${commune ? ` à ${commune}` : ""}`;
    const debut = departDe(p, maintenant);
    l.push("BEGIN:VEVENT");
    l.push(`UID:${p.cle.replace(/[^0-9A-Za-z]+/g, "-")}@ma-meteo`);
    l.push(`DTSTAMP:${horoUTC(maintenant)}`);
    l.push(`DTSTART:${horoLocal(p.jour, debut)}`);
    l.push(`DTEND:${horoLocal(p.jour, Math.min(debut + DUREE, 23.75))}`);
    l.push(plier(`SUMMARY:${echapper(titre)}`));
    l.push(plier(`DESCRIPTION:${echapper(`Pluie de ${pluieTxt(p)}, `
      + `jusqu'à ${nombreVirgule(p.mm)} mm dans l'heure`
      + `, rafales jusqu'à ${p.raf} km/h.`)}`));
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
