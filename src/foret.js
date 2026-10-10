/* La météo des forêts de Météo-France, version 188, demande de Jérôme du
   10 octobre 2026.

   Le danger d'incendie de forêt par département, établi chaque jour à 17 h
   avec l'Office national des forêts pour le lendemain et le surlendemain, de
   juin à fin septembre. Quatre niveaux : faible, modéré, élevé, très élevé.
   Le danger dit la facilité avec laquelle un feu parti se propagerait, non
   les feux en cours ni les interdictions d'accès aux massifs.

   L'API du portail de Météo-France, avec la même clé que PIAF. Relevé le
   10 octobre 2026 : `carte/encours` rend un fichier CSV de 3,7 kilooctets
   pour les 96 départements, `reference_time;dep_code;niveau_j1;niveau_j2;
   dep_nom`, l'origine ouverte ; la variante par département répond une
   erreur du service. La dernière carte de la saison 2026 date du 6 octobre. */

import { chercherEn, cleJour, lireGardee, ecrireGardee } from "./horloge.js";
import * as Reglages from "./reglages.js";

export const SERVICE = "https://public-api.meteofrance.fr/public/DPMeteoForets/v1";
export const NIVEAUX = ["Faible", "Modéré", "Élevé", "Très élevé"];
export const nomDe = n => NIVEAUX[n - 1] || null;
const TABLE = "mameteo.foret.v1";
const GARDE = 3 * 3600000;

/* La lecture du CSV : les niveaux par département, et le jour de la carte. */
export function lire(texte) {
  const lignes = String(texte || "").trim().split(/\r?\n/);
  if (lignes.length < 2) return null;
  let ref = null;
  const deps = {};
  for (const l of lignes.slice(1)) {
    const c = l.split(";");
    if (c.length < 4) continue;
    const j1 = Number(c[2]), j2 = Number(c[3]);
    if (!ref) ref = Date.parse(c[0]);
    deps[c[1]] = { j1: Number.isFinite(j1) ? j1 : null, j2: Number.isFinite(j2) ? j2 : null, nom: c[4] || "" };
  }
  return Number.isFinite(ref) ? { ref, deps } : null;
}

/* Le jour que vise chaque échéance : la carte est faite la veille, J1 est
   le lendemain du jour de la carte, à l'heure de Paris. */
export const jourDe = (ref, k) => cleJour(new Date(ref + k * 86400000));

/* Le niveau d'un département pour un jour donné, ou `null`. */
export function niveau(carte, dep, jour) {
  const d = carte && carte.deps[normaliser(dep)];
  if (!d) return null;
  if (jour === jourDe(carte.ref, 1)) return d.j1;
  if (jour === jourDe(carte.ref, 2)) return d.j2;
  return null;
}
export const normaliser = dep => {
  const s = String(dep || "").toUpperCase();
  return /^\d$/.test(s) ? `0${s}` : s;
};

/* La carte est-elle encore celle de la saison ? Une carte de plus de deux
   jours ne vise plus aujourd'hui. */
export const aJour = (carte, maintenant = Date.now()) =>
  !!carte && maintenant - carte.ref < 2 * 86400000;

let memoire = null;
export async function charger(fetcheur = chercherEn(15000)) {
  if (memoire && Date.now() - memoire.quand < GARDE) return memoire.d;
  const g = lireGardee(TABLE, "carte", GARDE);
  if (g && g.d) { memoire = { d: g.d, quand: g.t }; return g.d; }
  const cle = Reglages.clePiaf();
  if (!cle) return null;
  try {
    const r = await fetcheur(`${SERVICE}/carte/encours?apikey=${encodeURIComponent(cle)}`);
    if (!r.ok) return null;
    const d = lire(await r.text());
    if (!d) return null;
    memoire = { d, quand: Date.now() };
    ecrireGardee(TABLE, "carte", { t: Date.now(), d }, GARDE);
    return d;
  } catch { return null; }
}
/* Le jour à montrer : aujourd'hui si la carte le couvre, sinon demain, entre
   17 h et minuit ; sinon le premier jour de la dernière carte, hors saison. */
export function jourMontre(carte, maintenant = Date.now()) {
  if (!carte) return null;
  const auj = cleJour(new Date(maintenant)), dem = cleJour(new Date(maintenant + 86400000));
  for (const [j, dit] of [[auj, "aujourd'hui"], [dem, "demain"]]) {
    if (j === jourDe(carte.ref, 1) || j === jourDe(carte.ref, 2)) return { jour: j, dit, saison: true };
  }
  const j1 = jourDe(carte.ref, 1);
  const d = new Date(`${j1}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return { jour: j1, dit: `le ${d}, hors saison`, saison: false };
}
/* Les niveaux du jour montré, département par département. */
export function niveaux(carte, jour) {
  const m = new Map();
  for (const code of Object.keys(carte?.deps || {})) {
    const n = niveau(carte, code, jour);
    if (Number.isFinite(n) && n >= 1) m.set(code, Math.min(4, n));
  }
  return m;
}
export const derniere = () => (memoire ? memoire.d : lireGardee(TABLE, "carte", GARDE)?.d || null);
export function oublier() { memoire = null; }
