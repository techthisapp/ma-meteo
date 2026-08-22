/* Les deux autres écritures de la série horaire : la liste, sur la feuille du
   temps, et les moments, en bas de l'accueil.

   Le ruban donne la forme, la liste donne les chiffres heure par heure, les
   moments donnent le profil de la journée qui vient. Les trois lisent la même
   série de vingt-quatre heures glissantes. */

import { nombreFr, heureTxt, jourCourt, esc } from "./horloge.js";
import { graviteCiel, CARD_ABR, iCard } from "./previsions.js";
import { icoCiel, icoTemps } from "./icones.js";

/* ---------- La liste ----------

   Douze colonnes de valeurs, plus la colonne d'heure collée au bord gauche.
   Treize colonnes ne tiennent pas dans la largeur d'un téléphone : la table
   défile latéralement, l'heure restant visible. */

const COLONNES = [
  ["Ciel", s => `<span class="ic">${icoTemps(icoCiel(s.code, s.clair), "ic")}</span>`],
  ["Temp.", s => `${nombreFr(s.t)}°`],
  ["Ress.", s => `${nombreFr(s.res)}°`],
  ["Rosée", s => `${nombreFr(s.ros)}°`],
  ["Pluie", s => (s.mm >= 0.1 ? `${nombreFr(s.mm)}` : "—")],
  ["Risque", s => (s.pb >= 5 ? `${Math.round(s.pb)} %` : "—")],
  ["Hum.", s => `${Math.round(s.hum)} %`],
  ["Vent", s => `${Math.round(s.v)}`],
  ["Raf.", s => `${Math.round(s.raf)}`],
  ["Dir.", s => CARD_ABR[iCard(s.dir)]],
  ["UV", s => (s.uv >= 0.5 ? nombreFr(s.uv) : "—")],
  ["Pres.", s => `${Math.round(s.pres)}`],
];

export function liste(s) {
  const lignes = [];
  for (let k = 0; k < s.n; k++) {
    const h = {
      t: s.t[k], res: s.res[k], ros: s.ros[k], hum: s.hum[k], mm: s.mm[k],
      pb: s.pb[k], code: s.code[k], nua: s.nua[k], pres: s.pres[k],
      v: s.v[k], raf: s.raf[k], dir: s.dir[k], uv: s.uv[k], clair: s.clair[k],
    };
    const nouveauJour = k > 0 && s.jour[k] !== s.jour[k - 1];
    const lib = nouveauJour ? `${jourCourt(s.jour[k])} 00 h` : heureTxt(s.heure[k]);
    const cls = [k === 0 ? "ici" : "", h.clair ? "" : "nuit"].filter(Boolean).join(" ");
    lignes.push(`<tr${cls ? ` class="${cls}"` : ""}><td>${esc(lib)}</td>`
      + COLONNES.map(([, f]) => `<td>${f(h)}</td>`).join("") + `</tr>`);
  }
  return `<div class="hh-cadre"><table class="hh">`
    + `<thead><tr><th>Heure</th>${COLONNES.map(([n]) => `<th>${esc(n)}</th>`).join("")}</tr></thead>`
    + `<tbody>${lignes.join("")}</tbody></table></div>`
    + `<p class="note">Températures en degrés, pluie en millimètres, vent et rafales en `
    + `kilomètres par heure, pression en hectopascals.</p>`;
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
const plage = m => (m.tn === m.tx ? `${Math.round(m.tx)}°`
  : `<i>${Math.round(m.tn)}</i> ${Math.round(m.tx)}°`);

const MESURES = [
  { nom: "Temp.", brut: true, lire: plage },
  { nom: "Pluie", seuil: m => m.mm >= 0.1, lire: m => (m.mm >= 0.1 ? nombreFr(m.mm) : null) },
  { nom: "Risque", seuil: m => m.pb >= 5, lire: m => (m.pb >= 5 ? `${Math.round(m.pb)} %` : null) },
  { nom: "Vent", lire: m => `${Math.round(m.v)}` },
  { nom: "Rafales", seuil: m => m.raf >= 30, lire: m => `${Math.round(m.raf)}` },
  { nom: "Humidité", lire: m => `${Math.round(m.hum)} %` },
  { nom: "UV", seuil: m => m.uv >= 0.5, lire: m => (m.uv >= 0.5 ? nombreFr(m.uv) : null) },
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
  const tete = `<span></span>` + mo.map(x =>
    `<span class="mt-t"><b>${esc(x.titre)}</b>${deux(x.h0)}-${deux(x.h1)} h</span>`).join("");

  const ciel = `<span class="mt-l"></span>` + mo.map(x =>
    `<span class="mt-c">${icoTemps(icoCiel(x.code, x.clair), "")}</span>`).join("");

  const gardees = MESURES.filter(r => !r.seuil || mo.some(r.seuil));
  const corps = gardees.map(r => `<span class="mt-l">${esc(r.nom)}</span>`
    + mo.map(x => {
      const v = r.lire(x);
      return v === null
        ? `<span class="mt-v mt-creux">—</span>`
        : `<span class="mt-v">${r.brut ? v : esc(v)}</span>`;
    }).join("")).join("");

  // Les unités des lignes retenues, et d'elles seules.
  const tenue = n => gardees.some(r => r.nom === n);
  const unites = [
    tenue("Pluie") ? "pluie en millimètres" : null,
    tenue("Rafales") ? "vent et rafales en kilomètres par heure"
      : "vent en kilomètres par heure",
  ].filter(Boolean);

  return `<div class="mt" style="grid-template-columns:62px repeat(${mo.length},1fr)">`
    + tete + ciel + corps + `</div>`
    + `<p class="note">${unites.join(", ").replace(/^./, c => c.toUpperCase())}.</p>`;
}
