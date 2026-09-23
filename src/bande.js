/* La bande horaire de l'accueil.

   Jalon 10, lot 1, ouvert le 23 septembre 2026. L'accueil ne montrait que des
   maximums : il fallait passer par « Le temps » pour voir quand la pluie arrive
   ou quand la température tombe. La bande donne cette évolution d'un coup
   d'œil, sous le ciel, et glisse au-delà des heures visibles.

   Chaque heure porte son icône, le risque de pluie dès vingt pour cent, la
   température, et le vent avec ses rafales sur deux lignes. Un trait relie les
   températures ; une barre marque les heures de pluie ; le lever et le coucher
   du Soleil s'intercalent en colonnes étroites à leur minute. Une phrase résume
   la pluie ou les rafales quand il y a lieu.

   Les colonnes ont une largeur fixe, ce qui permet de placer le trait des
   températures dès l'écriture, sans mesurer la page après coup. */

import { icoCiel, icoTemps, ico } from "./icones.js";
import { esc } from "./horloge.js";
import * as Astres from "./astres.js";

export const HEURES = 24;
export const LARGEUR_HEURE = 56;
export const LARGEUR_SOLEIL = 46;
export const SEUIL_RISQUE = 20;
/* Une heure compte comme pluvieuse dès un dixième de millimètre, le seuil que
   l'accueil retient pour dire une quantité, ou dès un risque d'une chance sur
   deux. */
export const SEUIL_MM = 0.1;
export const SEUIL_PLUIE = 50;
export const SEUIL_RAFALES = 50;

export const pluvieuse = (s, k) =>
  (s.mm[k] ?? 0) >= SEUIL_MM || (s.pb[k] ?? 0) >= SEUIL_PLUIE;

/* Les plages de pluie, en rangs de la série : [début, fin] inclus. */
export function plagesDePluie(s, n = Math.min(HEURES, s.n)) {
  const out = [];
  let debut = null;
  for (let k = 0; k < n; k++) {
    if (pluvieuse(s, k)) { if (debut === null) debut = k; }
    else if (debut !== null) { out.push([debut, k - 1]); debut = null; }
  }
  if (debut !== null) out.push([debut, n - 1]);
  return out;
}

const heureDite = h => `${h} h`;
const momentDe = h => h < 6 ? "cette nuit" : h < 12 ? "ce matin"
  : h < 18 ? "cet après-midi" : "ce soir";

/* La phrase sous la bande : la première plage de pluie, puis les rafales
   quand elles atteignent cinquante kilomètres par heure. Rien quand la journée
   n'a rien à dire. */
export function phraseBande(s, n = Math.min(HEURES, s.n)) {
  const parties = [];
  const [plage] = plagesDePluie(s, n);
  if (plage) {
    const [a, b] = plage;
    const mm = s.mm.slice(a, b + 1).reduce((x, y) => x + (y ?? 0), 0);
    const fin = (s.heure[b] + 1) % 24;
    /* Le moment se dit avec les heures : une pluie de deux à huit heures du
       matin, lue à neuf heures, tombe la nuit prochaine. */
    const quand = momentDe(s.heure[a]);
    parties.push(a === b
      ? `Pluie ${quand} vers ${heureDite(s.heure[a])}`
      : `Pluie ${quand} de ${heureDite(s.heure[a])} à ${heureDite(fin)}`);
    if (mm >= SEUIL_MM) parties[0] += `, ${mm.toFixed(1).replace(".", ",")} mm`;
  }
  let kMax = -1;
  for (let k = 0; k < n; k++) if (kMax < 0 || s.raf[k] > s.raf[kMax]) kMax = k;
  if (kMax >= 0 && s.raf[kMax] >= SEUIL_RAFALES) {
    parties.push(`${parties.length ? "rafales" : "Rafales"} jusqu'à ${Math.round(s.raf[kMax])} km/h `
      + momentDe(s.heure[kMax]));
  }
  return parties.length ? parties.join(", ") + "." : null;
}

/* Le lever et le coucher du Soleil qui tombent dans la fenêtre, chacun rangé
   après l'heure qui le contient. */
export function soleilDansBande(s, g, depart, n = Math.min(HEURES, s.n)) {
  const out = [];
  const fin = depart.getTime() + n * 3600000;
  for (const d of [0, 1]) {
    const jour = new Date(depart.getTime() + d * 86400000);
    const ev = Astres.evenements("soleil", jour, g.lat, g.lon);
    for (const [type, t] of [["lever", ev.lever], ["coucher", ev.coucher]]) {
      if (!t || t.getTime() < depart.getTime() || t.getTime() >= fin) continue;
      const rang = Math.floor((t.getTime() - depart.getTime()) / 3600000);
      out.push({ type, date: t, rang });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

const hm = d => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/* La bande, écrite d'un seul tenant. Le départ est le début de l'heure en
   cours, premier rang de la série. */
export function bandeHoraire(s, g, maintenant = new Date()) {
  if (!s) return "";
  const n = Math.min(HEURES, s.n);
  const depart = new Date(maintenant);
  depart.setMinutes(0, 0, 0);
  const soleil = soleilDansBande(s, g, depart, n);

  /* Les colonnes, dans l'ordre : chaque heure, suivie du lever ou du coucher
     qu'elle contient. La barre de pluie d'une colonne du Soleil suit ses deux
     voisines. */
  const colonnes = [];
  for (let k = 0; k < n; k++) {
    colonnes.push({ k });
    for (const e of soleil.filter(x => x.rang === k)) colonnes.push({ soleil: e, k });
  }
  /* Trois rangées de colonnes de même largeur, alignées sans mesure : les
     heures avec leur icône, leur risque et leur degré ; le trait des
     températures ; le vent et les rafales, qui portent la barre de pluie.
     Seule la première rangée se touche, et porte la description complète de
     l'heure pour la lecture à voix haute. */
  let x = 0;
  const points = [];
  const tMin = Math.min(...s.t.slice(0, n)), tMax = Math.max(...s.t.slice(0, n));
  const yDe = t => tMax === tMin ? 9 : 15 - (t - tMin) / (tMax - tMin) * 12;
  /* La rangée des risques ne paraît que si une heure au moins atteint le seuil :
     une rangée vide de bout en bout coûtait une ligne au premier écran. */
  const avecRisque = s.pb.slice(0, n).some(p => (p ?? 0) >= SEUIL_RISQUE);
  const haut = [], bas = [];
  for (const c of colonnes) {
    if (c.soleil) {
      const pluie = pluvieuse(s, c.k) && c.k + 1 < n && pluvieuse(s, c.k + 1);
      x += LARGEUR_SOLEIL;
      const lib = c.soleil.type === "lever" ? "Lever" : "Coucher";
      haut.push(`<div class="bh bh-soleil" role="listitem" `
        + `aria-label="${lib} du Soleil à ${hm(c.soleil.date)}">`
        + `<span class="bh-h">${hm(c.soleil.date)}</span>`
        + ico(c.soleil.type === "lever" ? "lever" : "coucher", "bh-ic")
        + `<span class="bh-lib">${lib}</span></div>`);
      bas.push(`<div class="bv bh-soleil${pluie ? " bh-pluie" : ""}"></div>`);
      continue;
    }
    const k = c.k;
    points.push([x + LARGEUR_HEURE / 2, yDe(s.t[k])]);
    x += LARGEUR_HEURE;
    const pb = Math.round(s.pb[k] ?? 0);
    const risque = pb >= SEUIL_RISQUE ? `${pb} %` : "";
    const h = k === 0 ? "Maint." : heureDite(s.heure[k]);
    const t = Math.round(s.t[k]);
    const v = Math.round(s.v[k]), r = Math.round(s.raf[k]);
    const label = `${k === 0 ? "Maintenant" : heureDite(s.heure[k])}, ${t} degrés`
      + (risque ? `, risque de pluie ${pb} %` : "")
      + `, vent ${v} km/h, rafales ${r} km/h`;
    haut.push(`<button type="button" class="bh bh-heure${k === 0 ? " bh-maint" : ""}" `
      + `role="listitem" data-detail="t" data-heure="${k}" aria-label="${esc(label)}">`
      + `<span class="bh-h">${h}</span>`
      /* Le symbole de temps en deux tons, comme la table de la semaine : la
         bande décrit le ciel heure par heure. `icoCiel` rend son nom, jour ou
         nuit, et `icoTemps` le dessin, à taille fixée par attribut. */
      + icoTemps(icoCiel(s.code[k], s.clair[k] === 1), "bh-ic", 26)
      + (avecRisque ? `<span class="bh-pb">${risque}</span>` : "")
      + `<span class="bh-t">${t}°</span></button>`);
    bas.push(`<div class="bv${pluvieuse(s, k) ? " bh-pluie" : ""}" aria-hidden="true">`
      + `<span class="bh-v">${k === 0 ? "Vent " : ""}${v}</span>`
      + `<span class="bh-r">${k === 0 ? "Raf. " : ""}${r}</span></div>`);
  }
  const trait = `<svg class="bh-courbe" width="${x}" height="18" viewBox="0 0 ${x} 18" aria-hidden="true">`
    + `<polyline points="${points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ")}" `
    + `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  const html = `<div class="bande-ligne" role="list">${haut.join("")}</div>`
    + trait + `<div class="bande-ligne">${bas.join("")}</div>`;

  const phrase = phraseBande(s, n);
  return `<div class="carte bande" id="bande">`
    + `<div class="bande-tete"><h3>Prochaines heures</h3>`
    + `<button type="button" class="bande-plus" data-detail="t">Plus de détails</button></div>`
    + `<div class="bande-defil"><div class="bande-rang" style="width:${x}px">`
    + html + `</div></div>`
    + (phrase ? `<p class="bande-phrase">${esc(phrase)}</p>` : "")
    + `</div>`;
}
