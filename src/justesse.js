/* Le journal de justesse.

   Rien ne s'affiche ici. Ce module écrit, à chaque chargement, ce que la source
   annonçait pour quelques échéances, puis, quand l'heure visée est passée, ce
   qui a été relevé. Deux mois de ces couples permettront de dire à quelle
   distance la prévision tombe, par échéance, et cette phrase-là ne peut pas
   s'écrire sans avoir attendu. C'est le seul endroit de la feuille de route où
   retarder d'une semaine coûte une semaine de plus à l'arrivée : le journal part
   donc avant tout ce qui l'exploitera.

   Le relevé est écrit ici, alors que rien ne l'exigeait, parce qu'il n'est
   récupérable nulle part ailleurs : la charge horaire porte deux journées
   écoulées, au delà l'heure visée a disparu de la source et la comparaison
   n'aurait plus de terme. */

import { cleHeure } from "./horloge.js";

const CACHE = "mameteo.justesse.v1";

/* Les heures visées : la plus chaude et la plus fraîche de chaque journée. Une
   prévision se juge sur ses extrêmes, non sur une heure quelconque, et deux
   points par jour suffisent à mesurer une dérive.

   Les échéances : les paliers auxquels on veut pouvoir répondre. Une prévision
   est notée sous le palier qu'elle vient de franchir, une seule fois par palier
   et par heure visée. Sans paliers, chaque chargement d'une même heure aurait
   écrit sa ligne et le journal aurait grossi de vingt-quatre entrées par jour
   et par heure visée, pour dire vingt-quatre fois la même chose. */
const HEURES_VISEES = [6, 15];
const PALIERS = [6, 12, 24, 48, 72, 96, 120, 144, 168];

/* Le journal ne grandit pas sans fin. Quatre-vingt-dix jours d'entrées portent
   de quoi établir une justesse par échéance, au delà la donnée est de
   l'histoire ancienne : le climat de la commune est un autre sujet, et il a son
   propre jalon. Le plafond en nombre est un garde-fou contre un quota de
   réserve locale atteint sur un appareil qui en a peu. */
const JOURS_GARDES = 90;
const LIGNES_MAX = 2000;

// Le lieu, arrondi : deux relevés à trente mètres l'un de l'autre sont le même.
export const lieuDe = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

export function lire() {
  try {
    const j = JSON.parse(localStorage.getItem(CACHE) || "null");
    return j && Array.isArray(j.lignes) ? j : { v: 1, lignes: [] };
  } catch { return { v: 1, lignes: [] }; }
}

function ecrire(j) {
  try { localStorage.setItem(CACHE, JSON.stringify(j)); }
  catch { /* quota atteint, le journal n'est pas indispensable au temps qu'il fait */ }
}

// Le palier franchi par une échéance, ou `null` en deçà du premier.
export function palier(heures) {
  let p = null;
  for (const x of PALIERS) if (heures >= x) p = x;
  return p;
}

/* Note ce que la charge annonce, et relève ce qu'elle donne des heures visées
   déjà passées. Rend le nombre de lignes écrites et de relevés posés, ce dont
   les contrôles se servent : rien ne paraît à l'écran.

   La charge est celle qui vient d'être servie, quelle que soit sa source : c'est
   la prévision que l'application a montrée qu'on juge, non celle qu'un modèle
   aurait pu rendre. */
export function noter(charge, lieu, maintenant = new Date()) {
  const h = charge && charge.hourly;
  if (!Array.isArray(h?.time) || !Array.isArray(h?.temperature_2m) || !lieu) {
    return { notes: 0, releves: 0 };
  }
  const j = lire();
  const rang = new Map(j.lignes.map((l, k) => [`${l.l}|${l.c}|${l.e}`, k]));
  const t0 = maintenant.getTime();
  const nouvelles = [];
  let releves = 0;

  for (let i = 0; i < h.time.length; i++) {
    const heure = Number(h.time[i].slice(11, 13));
    if (!HEURES_VISEES.includes(heure)) continue;
    const t = h.temperature_2m[i];
    if (t === null || t === undefined) continue;
    const cible = h.time[i].slice(0, 13);
    const ecart = (Date.parse(`${h.time[i]}:00`) - t0) / 3600000;

    /* Une heure passée est un relevé : il se pose sur les lignes déjà notées
       pour elle, et n'en ouvre aucune. Une heure à venir est une prévision. */
    if (ecart < 0) {
      for (const l of j.lignes) {
        if (l.l === lieu && l.c === cible && l.r === undefined) {
          l.r = Math.round(t * 10) / 10;
          l.vu = cleHeure(maintenant).slice(0, 13);
          releves++;
        }
      }
      continue;
    }
    const p = palier(ecart);
    if (p === null) continue;
    const cle = `${lieu}|${cible}|${p}`;
    if (rang.has(cle)) continue;
    rang.set(cle, -1);
    nouvelles.push({
      l: lieu, c: cible, e: p,
      t: Math.round(t * 10) / 10,
      mm: Math.round((h.precipitation?.[i] ?? 0) * 10) / 10,
      pb: Math.round(h.precipitation_probability?.[i] ?? 0),
      le: cleHeure(maintenant).slice(0, 13),
    });
  }

  if (!nouvelles.length && !releves) return { notes: 0, releves: 0 };
  j.lignes = j.lignes.concat(nouvelles);

  // L'oubli : par l'âge d'abord, par le nombre ensuite, les plus vieilles en tête.
  const limite = t0 - JOURS_GARDES * 86400000;
  j.lignes = j.lignes.filter(l => Date.parse(`${l.c}:00:00`) >= limite);
  if (j.lignes.length > LIGNES_MAX) j.lignes = j.lignes.slice(j.lignes.length - LIGNES_MAX);
  ecrire(j);
  return { notes: nouvelles.length, releves };
}

// Vide le journal. Sert aux essais, et à un réglage de remise à zéro si un jour
// il en faut un.
export function oublier() {
  try { localStorage.removeItem(CACHE); } catch { /* rien à faire */ }
}
