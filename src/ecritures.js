/* Les deux autres écritures de la série horaire : la liste, sur la feuille du
   temps, et les moments, en bas de l'accueil.

   Le ruban donne la forme, la liste donne les chiffres heure par heure, les
   moments donnent le profil de la journée qui vient. Les trois lisent la même
   série de vingt-quatre heures glissantes. */

import { nombreFr, heureTxt, esc } from "./horloge.js";
import { graviteCiel, dCardinal, SEUIL_LAME, SEUIL_RISQUE } from "./previsions.js";
import { icoCiel, icoTemps, tempsDe } from "./icones.js";
import { aide } from "./aide.js";

/* ---------- La liste ----------

   Refaite au jalon 20, lot 4, à la demande de Jérôme : les heures se rangent
   sous leur moment, cette nuit, ce matin, cet après-midi, ce soir, puis ceux
   de demain. Chaque heure tient une ligne : l'heure, le ciel, la température
   en grand, et la pluie seulement quand il pleut. Le reste, ressenti, rosée,
   vent, humidité, risque de pluie, indice UV et pression, s'ouvre en touchant
   la ligne, un élément natif qui se lit au clavier et aux lecteurs d'écran.

   Plus de table à défiler de côté : douze colonnes ne tenaient pas dans la
   largeur d'un téléphone. */

/* Le nom du moment, comme on le dirait à l'oral, dans l'ordre du temps depuis
   maintenant : la première nuit est « cette nuit », la suivante « la nuit
   suivante » ; les autres moments du lendemain prennent « demain ». */
function titresMoments(s) {
  const lots = [];
  for (let k = 0; k < s.n; k++) {
    const tr = nomTranche(s.heure[k]);
    const cle = `${s.jour[k]}|${tr[1]}`;
    if (!lots.length || lots[lots.length - 1].cle !== cle) lots.push({ cle, tr, jour: s.jour[k], idx: [] });
    lots[lots.length - 1].idx.push(k);
  }
  let nuitVue = false;
  for (const lot of lots) {
    if (lot.tr[1] === "nuit") { lot.titre = nuitVue ? lot.tr[3] : lot.tr[2]; nuitVue = true; }
    else lot.titre = lot.jour === s.jour[0] ? lot.tr[2] : lot.tr[3];
  }
  return lots;
}

const LIGNES_DETAIL = [
  ["Ressenti", h => `${Math.round(h.res)}°`],
  ["Rosée", h => `${Math.round(h.ros)}°`],
  ["Vent", h => `${Math.round(h.v)} km/h ${dCardinal(h.dir)}`],
  ["Rafales", h => `${Math.round(h.raf)} km/h`],
  ["Humidité", h => `${Math.round(h.hum)} %`],
  ["Risque de pluie", h => `${Math.round(h.pb)} %`],
  ["Indice UV", h => (h.uv >= 0.5 ? nombreFr(h.uv) : null)],
  ["Pression", h => `${Math.round(h.pres)} hPa`],
];

export function liste(s) {
  const ligne = k => {
    const h = {
      t: s.t[k], res: s.res[k], ros: s.ros[k], hum: s.hum[k], mm: s.mm[k],
      pb: s.pb[k], code: s.code[k], pres: s.pres[k],
      v: s.v[k], raf: s.raf[k], dir: s.dir[k], uv: s.uv[k], clair: s.clair[k],
    };
    const cls = ["hl", k === 0 ? "hl-ici" : "", h.clair ? "" : "hl-nuit"].filter(Boolean).join(" ");
    const pluie = h.mm >= SEUIL_LAME ? `<span class="hl-p">${nombreFr(h.mm)} mm</span>` : "";
    const detail = LIGNES_DETAIL.map(([n, f]) => [n, f(h)]).filter(([, v]) => v !== null)
      .map(([n, v]) => `<dt>${esc(n)}</dt><dd>${esc(v)}</dd>`).join("");
    return `<details class="${cls}"><summary>`
      + `<span class="hl-h">${k === 0 ? "Maint." : esc(heureTxt(s.heure[k]))}</span>`
      + `<span class="ic">${icoTemps(icoCiel(h.code, h.clair), "ic")}</span>`
      + `<span class="titre-lu">${esc(tempsDe(h.code)[1])}</span>`
      + `<b class="hl-t">${Math.round(h.t)}°</b>${pluie}`
      + `</summary><dl class="hl-d">${detail}</dl></details>`;
  };
  return titresMoments(s).map(lot => `<div class="section hl-moment"><h2>${esc(lot.titre)}</h2>`
    + `<div class="carte hl-carte">${lot.idx.map(ligne).join("")}</div></div>`).join("")
    + aide("Touchez une heure pour lire le ressenti, la rosée, le vent, l'humidité, le risque de pluie, l'indice UV "
      + "et la pression. Températures en degrés, pluie en millimètres, vent en kilomètres par heure.");
}

/* ---------- Les moments ----------

   Bornes civiles de six heures : nuit, matin, après-midi, soirée. Une tranche
   d'une heure en fin de fenêtre est retirée, elle n'apprendrait rien.

   Le nom se dit comme on le dirait à l'oral : « ce soir » plutôt que « la
   soirée », « demain matin » plutôt que « demain, le matin ». La nuit fait
   exception. Elle porte la date du lendemain dès minuit passé, mais celle qui
   vient s'appelle « cette nuit » : personne ne dit « demain, la nuit » pour
   dans quatre heures. La première nuit de la fenêtre prend donc le nom proche,
   quelle que soit sa date. */

/* Heure de début, clé, nom proche, nom du lendemain, nom court, nom abrégé.

   Le nom court sert là où la journée est déjà nommée par ailleurs : la semaine
   dépliée n'a pas à redire « demain » sous la rangée « Demain ». Le nom abrégé
   ne diffère que sur l'après-midi, et ne sert qu'au tableau de l'accueil, qui
   tient cinq colonnes là où le volet de la semaine en tient quatre : à
   cinquante points de large, « après-midi » passe à la ligne et décale toute la
   ligne d'entête. */
export const TRANCHES = [
  [0, "nuit", "Cette nuit", "La nuit suivante", "nuit", "nuit"],
  [6, "matin", "Ce matin", "Demain matin", "matin", "matin"],
  [12, "apres-midi", "Cet après-midi", "Demain après-midi", "après-midi", "après-m."],
  [18, "soiree", "Ce soir", "Demain en soirée", "soirée", "soirée"],
];

const nomTranche = h => TRANCHES[Math.floor(h / 6)];

/* Les mesures du tableau, dans l'ordre où elles se lisent.

   `seuil` marque les lignes qui ne paraissent que si un moment au moins a
   quelque chose à y dire : une ligne « UV » vide de bout en bout n'apprend
   rien. Les autres tiennent toujours, elles font le profil de la journée.

   Une fois la ligne présente, chaque case porte sa valeur, même faible : le
   tiret est réservé à ce qui n'existe pas, non à ce qui est petit. */
/* Les deux bornes de température se séparent par une espace, non par un trait.
   « 13-15° » se lit encore, « -3--1° » ne se lit plus. La borne basse prend
   l'encre secondaire, ce qui dit laquelle est laquelle sans un mot de plus. */
/* Le tableau des vingt-quatre prochaines heures, redessiné au jalon 20,
   lot 2, demande de Jérôme du 3 octobre 2026 : quatre lignes au lieu de
   sept. Le maximum en gras au-dessus du minimum ; la pluie et son risque dans
   une case ; le vent et ses rafales dans une autre ; l'humidité, qui a sa
   tuile, quitte le tableau ; l'indice UV ne paraît qu'à partir de trois. */
const plage = m => (Math.round(m.tn) === Math.round(m.tx) ? `<b>${Math.round(m.tx)}°</b>`
  : `<b>${Math.round(m.tx)}°</b><i>${Math.round(m.tn)}°</i>`);
const pluieCase = m => (m.mm >= SEUIL_LAME
  ? `<b>${nombreFr(Math.round(m.mm * 10) / 10)}</b><i>${m.pb >= SEUIL_RISQUE ? `${Math.round(m.pb)} %` : "mm"}</i>`
  : m.pb >= SEUIL_RISQUE ? `<i>${Math.round(m.pb)} %</i>` : null);
const ventCase = m => `<b>${Math.round(m.v)}</b>${m.raf >= 30 ? `<i>raf. ${Math.round(m.raf)}</i>` : ""}`;

const MESURES = [
  { nom: "Temp.", brut: true, lire: plage },
  { nom: "Pluie", brut: true, seuil: m => m.mm >= SEUIL_LAME || m.pb >= SEUIL_RISQUE, lire: pluieCase },
  { nom: "Vent", brut: true, lire: ventCase },
  { nom: "UV", seuil: m => m.uv >= 3, lire: m => (m.uv >= 3 ? nombreFr(Math.round(m.uv)) : null) },
];

export function moments(s) {
  const lots = [];
  let courant = null;

  for (let k = 0; k < s.n; k++) {
    const tr = nomTranche(s.heure[k]);
    const cle = `${s.jour[k]}|${tr[1]}`;
    if (!courant || courant.cle !== cle) {
      courant = { cle, tr, jour: s.jour[k], idx: [] };
      lots.push(courant);
    }
    courant.idx.push(k);
  }

  // Une tranche d'une heure en fin de fenêtre est retirée.
  if (lots.length > 1 && lots[lots.length - 1].idx.length <= 1) lots.pop();

  /* Le nom entier tant qu'on est dans la journée en cours, le nom court ensuite.
     Les colonnes se suivent dans l'ordre du temps depuis maintenant : « Matin »
     après « Cette nuit » ne peut désigner que le lendemain, et les heures sous
     le nom achèvent de le situer. */
  let nuitVue = false;
  for (const lot of lots) {
    if (lot.tr[1] === "nuit") { lot.titre = nuitVue ? lot.tr[5] : lot.tr[2]; nuitVue = true; }
    else lot.titre = lot.jour === s.jour[0] ? lot.tr[2] : lot.tr[5];
  }

  const m = lot => {
    const i = lot.idx;
    const moy = f => i.reduce((a, k) => a + f(k), 0) / i.length;
    const max = f => Math.max(...i.map(f));
    const min = f => Math.min(...i.map(f));
    return {
      titre: lot.titre,
      h0: s.heure[i[0]], h1: (s.heure[i[i.length - 1]] + 1) % 24,
      tn: min(k => s.t[k]), tx: max(k => s.t[k]),
      mm: i.reduce((a, k) => a + s.mm[k], 0),
      pb: max(k => s.pb[k]),
      // L'humidité prend la moyenne de sa tranche, le vent son maximum.
      hum: moy(k => s.hum[k]),
      raf: max(k => s.raf[k]),
      v: max(k => s.v[k]),
      uv: max(k => s.uv[k]),
      code: i.reduce((a, k) => (graviteCiel(s.code[k]) > graviteCiel(a) ? s.code[k] : a), 0),
      clair: i.some(k => s.clair[k]),
    };
  };

  const mo = lots.map(m);
  const deux = n => String(n).padStart(2, "0");

  /* Les moments en colonnes, les mesures en lignes. Le libellé s'écrit une
     fois : le répéter à chaque moment allongeait la carte de moitié sans rien
     apprendre, et les retours à la ligne tombaient chaque fois ailleurs. */
  /* Le moment présent se distingue, la nuit se teinte : la colonne se lit
     d'un coup d'œil. */
  const col = (x, k) => (k === 0 ? " mt-ici" : "") + (x.clair ? "" : " mt-nuit");
  const tete = `<span></span>` + mo.map((x, k) =>
    `<span class="mt-t${col(x, k)}"><b>${esc(x.titre)}</b>${deux(x.h0)}-${deux(x.h1)} h</span>`).join("");

  const ciel = `<span class="mt-l"></span>` + mo.map((x, k) =>
    `<span class="mt-c${col(x, k)}">${icoTemps(icoCiel(x.code, x.clair), "")}</span>`).join("");

  const gardees = MESURES.filter(r => !r.seuil || mo.some(r.seuil));
  const corps = gardees.map(r => `<span class="mt-l">${esc(r.nom)}</span>`
    + mo.map((x, k) => {
      const v = r.lire(x);
      return v === null
        ? `<span class="mt-v mt-creux${col(x, k)}">—</span>`
        : `<span class="mt-v${col(x, k)}">${r.brut ? v : esc(v)}</span>`;
    }).join("")).join("");

  // Les unités des lignes retenues, et d'elles seules.
  const tenue = n => gardees.some(r => r.nom === n);
  const unites = [
    tenue("Pluie") ? "pluie en millimètres, avec le risque en pour cent" : null,
    "vent et rafales en kilomètres par heure",
  ].filter(Boolean);

  return `<div class="mt" style="grid-template-columns:62px repeat(${mo.length},1fr)">`
    + tete + ciel + corps + `</div>`
    + aide(`${unites.join(", ").replace(/^./, c => c.toUpperCase())}.`);
}
