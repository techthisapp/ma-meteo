/* Les deux autres écritures de la série horaire : les listes de la page
   « Heure par heure », et les moments, en bas de l'accueil.

   Le ruban donne la forme d'une grandeur, les listes donnent les heures, les
   moments donnent le profil de la journée qui vient. */

import { nombreFr, heureTxt, esc } from "./horloge.js";
import { graviteCiel, duCardinal, SEUIL_LAME, SEUIL_RISQUE, SEUIL_RAFALE } from "./previsions.js";
import { icoCiel, icoTemps, tempsDe, couleurT, couleurUV } from "./icones.js";
import { aide } from "./aide.js";
import { flecheSVG } from "./fleche.js";
import { SEUILS_REPLI } from "./pluieproche.js";
import { jourBandeau } from "./ruban.js";

/* ---------- Les listes ----------

   Refaites en version 232, choix de Jérôme du 21 octobre 2026 sur maquette,
   à la manière de la liste par jour d'« À venir » : chaque heure tient une
   ligne qui se lit d'un coup d'œil, en dessins plutôt qu'en chiffres seuls.

   La liste d'ensemble, ouverte par « Plus de détails » et par une journée
   d'« À venir », porte sur chaque ligne le ciel, la température placée sur
   l'échelle de la fenêtre, la pluie et le vent ; le reste s'ouvre en touchant
   la ligne, un élément natif qui se lit au clavier et aux lecteurs d'écran.
   La liste d'une grandeur, sous le graphique de la vue ciblée, ne porte que
   cette grandeur, en barre.

   Les heures se rangent par jour, de l'heure en cours ou du minuit du jour
   choisi jusqu'au bout de la fenêtre. */

// Le risque de pluie s'écrit sous le ciel à partir de trente pour cent, comme dans « À venir ».
const RISQUE_MARQUE = 30;

/* La provenance du vent comme on la dit, demande de Jérôme du 3 octobre
   2026 : « du nord », « de l'est », « du sud-ouest », « de l'ouest », par
   `duCardinal` de src/previsions.js, la même partout. */
const LIGNES_DETAIL = [
  ["Ressenti", h => `${Math.round(h.res)}°`],
  ["Rosée", h => `${Math.round(h.ros)}°`],
  ["Humidité", h => `${Math.round(h.hum)} %`],
  ["Risque de pluie", h => `${Math.round(h.pb)} %`],
  ["Vent", h => `${Math.round(h.v)} km/h, ${duCardinal(h.dir)}`],
  ["Rafales", h => `${Math.round(h.raf)} km/h`],
  ["Indice UV", h => (h.uv >= 0.5 ? nombreFr(h.uv) : null)],
  ["Pression", h => `${Math.round(h.pres)} hPa`],
];

const niveauPluie = mm => (mm >= SEUILS_REPLI.forte ? "sp-forte" : mm >= SEUILS_REPLI.moderee ? "sp-moderee" : "sp-faible");
const pc = v => `${Math.max(0, Math.min(100, v)).toFixed(1)}%`;
const heureDe = (s, k) => (k === s.ici ? "Maint." : heureTxt(s.heure[k]));

/* Les heures de [a, b) rangées par jour. */
function parJour(s, a, b) {
  const lots = [];
  for (let k = a; k < b; k++) {
    if (!lots.length || lots[lots.length - 1].jour !== s.jour[k]) lots.push({ jour: s.jour[k], idx: [] });
    lots[lots.length - 1].idx.push(k);
  }
  return lots;
}

/* La température placée sur l'échelle de la fenêtre : la piste porte le
   dégradé des couleurs de température de bout en bout, le point dit l'heure. */
function pisteT(t, tn, tx) {
  const fond = `linear-gradient(90deg,${couleurT(tn)},${couleurT((tn + tx) / 2)},${couleurT(tx)})`;
  return `<span class="hh-piste hh-piste-t"><b style="background:${fond}"></b>`
    + `<i class="hh-point" style="left:${pc(((t - tn) / ((tx - tn) || 1)) * 100)}"></i></span>`;
}

const ciel = (s, k, risque = true) => `<span class="hh-ciel">${icoTemps(icoCiel(s.code[k], s.clair[k]), "hh-ic")}`
  + (risque && s.pb[k] >= RISQUE_MARQUE ? `<small>${Math.round(s.pb[k])} %</small>` : "")
  + `<span class="titre-lu">${esc(tempsDe(s.code[k])[1])}</span></span>`;

export function listeEnsemble(s, a, b) {
  const tn = Math.min(...s.t.slice(a, b)), tx = Math.max(...s.t.slice(a, b));
  const ligne = k => {
    const h = {
      res: s.res[k], ros: s.ros[k], hum: s.hum[k], pb: s.pb[k], pres: s.pres[k],
      v: s.v[k], raf: s.raf[k], dir: s.dir[k], uv: s.uv[k],
    };
    const detail = LIGNES_DETAIL.map(([n, f]) => [n, f(h)]).filter(([, v]) => v !== null)
      .map(([n, v]) => `<div><dt>${esc(n)}</dt><dd>${esc(v)}</dd></div>`).join("");
    const mm = s.mm[k];
    const pluie = mm >= SEUIL_LAME
      ? `<span class="hh-goutte ${niveauPluie(mm)}" style="height:${(6 + Math.min(1, mm / 5) * 16).toFixed(1)}px"></span>`
        + `<span class="titre-lu">${nombreFr(mm)} mm</span>`
      : `<span class="hh-goutte hh-sec"></span>`;
    return `<details class="hh${k === s.ici ? " hh-ici" : ""}${s.clair[k] ? "" : " hh-nuit"}"><summary class="hh-l hh-l5">`
      + `<span class="hh-h">${heureDe(s, k)}</span>${ciel(s, k)}`
      + `<span class="hh-t"><b>${Math.round(s.t[k])}°</b>${pisteT(s.t[k], tn, tx)}</span>`
      + `<span class="hh-p">${pluie}</span>`
      + `<span class="hh-v">${flecheSVG(s.dir[k], "hh-fl")}<b>${Math.round(s.v[k])}</b></span>`
      + `</summary><dl class="hh-d">${detail}</dl></details>`;
  };
  const entetes = `<div class="hh-entetes hh-l hh-l5" aria-hidden="true"><span></span><span>Ciel</span>`
    + `<span>Température</span><span>Pluie</span><span>Vent</span></div>`;
  return parJour(s, a, b).map(lot => {
    const t = lot.idx.map(k => s.t[k]);
    return `<div class="carte hh-bloc"><h2 class="hh-titre">${esc(jourBandeau(s, lot.jour))}, `
      + `de ${Math.round(Math.min(...t))} à ${Math.round(Math.max(...t))}°</h2>`
      + entetes + lot.idx.map(ligne).join("") + `</div>`;
  }).join("")
    + aide("Touchez une heure pour lire le ressenti, la rosée, l'humidité, le risque de pluie, le vent, "
      + "les rafales, l'indice UV et la pression. Le point place la température de l'heure entre la plus "
      + "basse et la plus haute de la liste. Pluie en millimètres, vent en kilomètres par heure.");
}

/* Une ligne par grandeur : ce qui précède la barre, la barre, la valeur. */
const GRANDEURS = {
  nua: { unite: "en pour cent du ciel couvert",
    ligne: (s, k) => [ciel(s, k, false), barre(s.nua[k], 100), `<b>${Math.round(s.nua[k])} %</b>`] },
  t: { unite: "en degrés",
    ligne: (s, k, c) => [ciel(s, k, false), pisteT(s.t[k], c.tn, c.tx),
      `<b>${Math.round(s.t[k])}°</b><small>res. ${Math.round(s.res[k])}°</small>`] },
  mm: { unite: "en millimètres",
    ligne: (s, k, c) => [ciel(s, k),
      s.mm[k] >= SEUIL_LAME ? barre(s.mm[k], c.mmx, niveauPluie(s.mm[k])) : barre(0, 1),
      s.mm[k] >= SEUIL_LAME ? `<b>${nombreFr(s.mm[k])} mm</b>` : `<small>${Math.round(s.pb[k])} %</small>`] },
  v: { unite: "en kilomètres par heure",
    ligne: (s, k, c) => [flecheSVG(s.dir[k], "hh-fl"),
      `<span class="hh-piste"><b class="hh-vent" style="width:${pc((s.v[k] / c.vx) * 100)}"></b>`
        + `<b class="hh-rafale" style="left:${pc((s.v[k] / c.vx) * 100)};width:${pc(((s.raf[k] - s.v[k]) / c.vx) * 100)}"></b></span>`,
      `<b>${Math.round(s.v[k])}</b><small>raf. ${Math.round(s.raf[k])}</small>`] },
  uv: { unite: "en indice UV",
    ligne: (s, k, c) => [ciel(s, k, false), barre(s.uv[k], c.uvx, "", couleurUV(s.uv[k])),
      `<b>${s.uv[k] >= 0.5 ? nombreFr(Math.round(s.uv[k])) : "0"}</b>`] },
  hum: { unite: "en pour cent d'humidité",
    ligne: (s, k) => [ciel(s, k, false), barre(s.hum[k], 100), `<b>${Math.round(s.hum[k])} %</b>`] },
  pres: { unite: "en hectopascals",
    ligne: (s, k, c) => [ciel(s, k, false),
      `<span class="hh-piste"><i class="hh-point" style="left:${pc(((s.pres[k] - c.pn) / ((c.px - c.pn) || 1)) * 100)}"></i></span>`,
      `<b>${Math.round(s.pres[k])}</b>`] },
};

function barre(v, mx, cls = "", couleur = "") {
  return `<span class="hh-piste"><b class="hh-plein ${cls}" style="width:${pc((v / (mx || 1)) * 100)}`
    + `${couleur ? `;background:${couleur}` : ""}"></b></span>`;
}

export function listeGrandeur(s, cle, a, b, porte = null) {
  const g = GRANDEURS[cle];
  if (!g) return "";
  const tr = c => s[c].slice(a, b);
  const c = {
    tn: Math.min(...tr("t")), tx: Math.max(...tr("t")),
    mmx: Math.max(2.5, ...tr("mm")),
    vx: Math.max(30, ...tr("raf")),
    uvx: Math.max(8, ...tr("uv")),
    pn: Math.min(...tr("pres")), px: Math.max(...tr("pres")),
  };
  const ligne = k => {
    const [avant, piste, val] = g.ligne(s, k, c);
    /* Les heures de l'événement désigné par un conseil se surlignent. */
    const mis = porte && k >= porte.de && k <= porte.a ? " hh-mis" : "";
    return `<div class="hh hh-l hh-l4${k === s.ici ? " hh-ici" : ""}${s.clair[k] ? "" : " hh-nuit"}${mis}">`
      + `<span class="hh-h">${heureDe(s, k)}</span><span class="hh-a">${avant}</span>${piste}`
      + `<span class="hh-val">${val}</span></div>`;
  };
  return parJour(s, a, b).map(lot => `<div class="carte hh-bloc hh-de-${esc(cle)}">`
    + `<h2 class="hh-titre">${esc(jourBandeau(s, lot.jour))}, ${esc(g.unite)}</h2>`
    + lot.idx.map(ligne).join("") + `</div>`).join("");
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
const ventCase = m => `<b>${Math.round(m.v)}</b>${m.raf >= SEUIL_RAFALE ? `<i>raf. ${Math.round(m.raf)}</i>` : ""}`;

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
    /* La plage s'écrit « 12 h à 18 h », sans trait, 3 octobre 2026. */
    `<span class="mt-t${col(x, k)}"><b>${esc(x.titre)}</b>${deux(x.h0)} h à ${deux(x.h1)} h</span>`).join("");

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
