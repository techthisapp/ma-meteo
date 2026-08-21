/* Les deux autres écritures de la feuille du temps : la liste et les moments.

   Le ruban donne la forme, la liste donne les chiffres, les moments donnent le
   récit. Les trois lisent la même série de vingt-quatre heures glissantes. */

import { nombreFr, heureTxt, jourCourt, esc } from "./horloge.js";
import { graviteCiel, CARD_ABR, iCard } from "./previsions.js";
import { icoCiel, ico, icoTemps, tempsDe } from "./icones.js";

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

   « Demain, la nuit » s'écrivait pour la nuit qui commence dans quatre heures :
   le nom d'une tranche se décide sur son jour et sur celui du départ de la
   fenêtre, non sur la seule borne civile. */

const TRANCHES = [
  [0, "nuit", "la nuit"],
  [6, "matin", "le matin"],
  [12, "apres-midi", "l'après-midi"],
  [18, "soirée", "la soirée"],
];

const nomTranche = h => TRANCHES[Math.floor(h / 6)];

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

  const bloc = lot => {
    const i = lot.idx;
    const moy = f => i.reduce((a, k) => a + f(k), 0) / i.length;
    const max = f => Math.max(...i.map(f));
    const min = f => Math.min(...i.map(f));

    const tn = min(k => s.t[k]), tx = max(k => s.t[k]);
    const mm = i.reduce((a, k) => a + s.mm[k], 0);
    const pb = max(k => s.pb[k]);
    // L'humidité prend la moyenne de sa tranche, le vent son maximum.
    const hum = moy(k => s.hum[k]);
    const raf = max(k => s.raf[k]);
    const vent = max(k => s.v[k]);
    const uv = max(k => s.uv[k]);
    const code = i.reduce((a, k) => (graviteCiel(s.code[k]) > graviteCiel(a) ? s.code[k] : a), 0);
    const clair = i.some(k => s.clair[k]);

    const demain = lot.jour !== s.jour[0];
    const titre = (demain ? "Demain, " : "") + lot.tr[2];
    const h0 = s.heure[i[0]], h1 = (s.heure[i[i.length - 1]] + 1) % 24;

    const cases = [
      ["Température", `${nombreFr(tn)}° à ${nombreFr(tx)}°`],
      ["Ciel", tempsDe(code)[1]],
      mm >= 0.1 ? ["Pluie", `${nombreFr(mm)} mm`] : pb >= 5 ? ["Risque", `${Math.round(pb)} %`] : null,
      ["Vent", `${Math.round(vent)} km/h`],
      raf >= 30 ? ["Rafales", `${Math.round(raf)} km/h`] : null,
      ["Humidité", `${Math.round(hum)} %`],
      uv >= 0.5 ? ["UV", nombreFr(uv)] : null,
    ].filter(Boolean);

    return `<div class="mo-b"><p class="mo-t">${icoTemps(icoCiel(code, clair), "")}`
      + `<span>${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</span>`
      + `<em>${esc(heureTxt(h0))} à ${esc(heureTxt(h1))}</em></p>`
      + `<div class="mo-g">`
      + cases.map(([n, v]) => `<div class="mo-c"><i>${esc(n)}</i><b>${esc(v)}</b></div>`).join("")
      + `</div></div>`;
  };

  return `<div class="mo">${lots.map(bloc).join("")}</div>`;
}
