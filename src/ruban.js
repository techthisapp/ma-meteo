/* Le ruban : une voie par grandeur, empilées sur le même axe des heures.

   Deux tracés ne partagent une voie que s'ils partagent l'unité et se lisent
   l'un par rapport à l'autre : la température avec le ressenti et le point de
   rosée, le vent avec ses rafales. Superposer la pluie en millimètres et le vent
   en kilomètres par heure aurait mis deux échelles sous une seule graduation.

   Sept voies tiennent dans un écran de téléphone au prix d'une hauteur qui
   n'excède pas quatre-vingt-six points. Une voie touchée s'agrandit alors seule,
   d'un facteur deux et demi : sa courbe reprend du relief, et le dessin porte ce
   qu'il ne pouvait pas montrer replié. Les autres voies gardent leur taille. */

import { nombreFr, jourCourt, heureTxt, esc } from "./horloge.js";
import { plagesDe, dCardinal, CARD_ABR, iCard } from "./previsions.js";

const L = 358, M = 5, P = L - 2 * M;
const ZOOM = 2.5;
const H_VOIE = 86;
const H_TEMP = 66;   // amplitude réservée à la température dans sa voie

let voieOuverte = null;
let serie = null;
let heureLue = -1;

export const ouvrir = c => { voieOuverte = voieOuverte === c ? null : c; };
export const voieCourante = () => voieOuverte;
export const serieCourante = () => serie;
export const heureCourante = () => heureLue;
export const poserHeure = k => { heureLue = k; };

const u = v => v.toFixed(1);
const bornes = (t, unite = "") =>
  `${Math.round(Math.min(...t))} à ${Math.round(Math.max(...t))}${unite}`;

export function dessiner(s) {
  serie = s;
  const X = k => M + (k / s.n) * P;
  const LA = P / s.n;

  /* Les montants et les libellés de l'axe sont décidés ensemble : un montant
     sans libellé laisserait une graduation muette. Le premier libellé est
     l'heure en cours ; les suivants tombent sur les six heures, et l'un d'eux
     est écarté s'il vient se coller au premier. */
  const CHASSE = 6;
  const ICI = heureTxt(s.heure[0]);
  const finIci = M + ICI.length * CHASSE + 7;
  const montants = [];
  for (let k = 1; k < s.n; k++) {
    if (s.heure[k] % 6 !== 0) continue;
    const lib = s.heure[k] === 0 ? jourCourt(s.jour[k]) : heureTxt(s.heure[k]);
    if (X(k) - (lib.length * CHASSE) / 2 < finIci) continue;
    montants.push([k, lib]);
  }

  /* La nuit est lavée dans toutes les voies, et un montant marque chaque tranche
     de six heures. Minuit garde son pointillé plus marqué : c'est une frontière
     de journée, non une graduation. Le lavis est facultatif : sur les bandes de
     valeur il se confondrait avec ce qu'elles montrent. */
  const fond = (h, lavis = true) => {
    let o = "";
    if (lavis) {
      for (const [a, b] of plagesDe(s.n, k => !s.clair[k])) {
        o += `<rect x="${u(X(a))}" y="0" width="${u(X(b + 1) - X(a))}" height="${h}" `
          + `fill="currentColor" opacity=".05"/>`;
      }
    }
    for (const [k] of montants) {
      const nuit = s.heure[k] === 0;
      o += `<line x1="${u(X(k))}" y1="0" x2="${u(X(k))}" y2="${h}" stroke="currentColor" `
        + `opacity="${nuit ? ".22" : ".10"}"${nuit ? ' stroke-dasharray="2 3"' : ""}/>`;
    }
    return o;
  };

  const pts = (vals, y0, y1, mn, mx) => vals.map((v, k) =>
    `${u(X(k + 0.5))},${u(y1 - ((v - mn) / ((mx - mn) || 1)) * (y1 - y0))}`).join(" ");

  const aire = (vals, y0, y1, mn, mx) =>
    `M${u(X(0.5))},${u(y1)} L${pts(vals, y0, y1, mn, mx).replace(/ /g, " L")} L${u(X(s.n - 0.5))},${u(y1)} Z`;

  /* Le chiffre d'un repère se pose au bord droit, par-dessus les tracés : un
     filet passe sous une courbe sans dommage, un nombre coupé par elle ne se lit
     plus. Le liseré de papier de la classe fait le reste. */
  const chiffre = (y, txt) =>
    `<text class="mg-g" x="${L - M}" y="${u(y)}" text-anchor="end">${esc(txt)}</text>`;

  const filSeuil = (y, txt) =>
    `<line x1="${M}" y1="${u(y)}" x2="${L - M}" y2="${u(y)}" stroke="currentColor" `
    + `opacity=".28" stroke-dasharray="2 3"/>` + chiffre(y - 2.5, txt);

  /* Une graduation horizontale au pas donné, sur les seules valeurs couvertes.
     `sauf` écarte la valeur que porte déjà un filet de seuil : sans lui, le
     chiffre de la graduation et celui du seuil se posaient au même point et se
     lisaient « 20 km20 ». */
  const graduation = (y0, y1, mn, mx, pas, ecrire, sauf) => {
    let traits = "", chiffres = "";
    for (let d = Math.ceil(mn / pas) * pas; d < mx; d += pas) {
      if (sauf !== undefined && Math.abs(d - sauf) < 0.001) continue;
      const yd = y1 - ((d - mn) / ((mx - mn) || 1)) * (y1 - y0);
      traits += `<line x1="${M}" y1="${u(yd)}" x2="${L - M}" y2="${u(yd)}" `
        + `stroke="currentColor" opacity=".08"/>`;
      chiffres += chiffre(yd - 2.5, ecrire(d));
    }
    return [traits, chiffres];
  };

  const etiq = (k, y, txt, cls) => {
    const anc = k < 2 ? "start" : k > s.n - 3 ? "end" : "middle";
    const x = k < 2 ? M + 1 : k > s.n - 3 ? L - M - 1 : X(k + 0.5);
    return `<text class="${cls}" x="${u(x)}" y="${u(y)}" text-anchor="${anc}">${esc(txt)}</text>`;
  };

  const grand = c => voieOuverte === c;
  const H = (c, base) => (grand(c) ? Math.round(base * ZOOM) : base);

  /* Les valeurs heure par heure, écrites au-dessus de leur point. Elles ne
     paraissent qu'agrandies : à hauteur repliée elles se toucheraient. Une heure
     sur trois suffit à donner l'échelle sans doubler la courbe d'une ligne de
     chiffres. Les dernières heures se calent là où les chiffres de graduation
     sont posés : la série s'arrête avant. */
  const jalons = (vals, y0, y1, mn, mx, ecrire, dy = -7) => {
    let o = "";
    for (let k = 1; k < s.n - 2; k += 3) {
      o += etiq(k, y1 - ((vals[k] - mn) / ((mx - mn) || 1)) * (y1 - y0) + dy, ecrire(vals[k]), "mg-p");
    }
    return o;
  };

  const voies = [];
  let n = 0;

  const poser = (nom, droite, haut, dedans, legende, cle) => {
    const val = `<span class="mg-r" data-plage="${esc(droite)}">${esc(droite)}</span>`;
    if (!haut) { voies.push(`<div class="mg-v"><p class="mg-t">${esc(nom)}${val}</p></div>`); return; }
    const dessin = `<svg class="mg-s" viewBox="0 0 ${L} ${haut}" aria-hidden="true">${dedans}`
      + `<line class="mg-cur" x1="0" y1="0" x2="0" y2="${haut}" hidden/></svg>`;
    const g = grand(cle);
    const id = `mgl${++n}`;
    const leg = legende ? `<p class="mg-l" id="${id}"${g ? "" : " hidden"}>${esc(legende)}</p>` : "";
    voies.push(`<div class="mg-v${g ? " mg-grand" : ""}" data-cle="${esc(cle)}">`
      + `<button type="button" class="mg-t mg-b" data-voie="${esc(cle)}" aria-expanded="${g}"`
      + (legende ? ` aria-controls="${id}"` : "") + ">"
      + `<span class="mg-n">${esc(nom)}<i aria-hidden="true">${g ? "−" : "+"}</i></span>`
      + `${val}</button>${dessin}${leg}</div>`);
  };

  // ---- 1. Température, ressenti et point de rosée ----
  {
    const cle = "t";
    const h = H(cle, H_VOIE);
    const marge = (h - (grand(cle) ? H_TEMP * ZOOM : H_TEMP)) / 2;
    const y0 = marge, y1 = h - marge;
    const tous = [...s.t, ...s.res, ...s.ros];
    let mn = Math.min(...tous), mx = Math.max(...tous);
    if (mx - mn < 4) { const c = (mn + mx) / 2; mn = c - 2; mx = c + 2; }
    const pas = mx - mn > 24 ? 10 : mx - mn > 10 ? 5 : 2;
    const [tr, ch] = graduation(y0, y1, mn, mx, pas, d => `${Math.round(d)}°`);
    let d = fond(h) + tr;
    d += `<path d="${aire(s.t, y0, y1, mn, mx)}" fill="currentColor" opacity=".07"/>`;
    d += `<polyline points="${pts(s.ros, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".35" stroke-dasharray="3 2"/>`;
    d += `<polyline points="${pts(s.res, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".45"/>`;
    d += `<polyline points="${pts(s.t, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (grand(cle)) d += jalons(s.t, y0, y1, mn, mx, v => `${Math.round(v)}°`);
    d += ch;
    poser("Température", `${bornes(s.t)}°`, h, d,
      "Trait plein la température, trait fin le ressenti, pointillé le point de rosée. "
      + "Un point de rosée qui rejoint la température annonce brouillard ou rosée.", cle);
  }

  // ---- 2. Pluie ----
  {
    const cle = "mm";
    const tot = s.mm.reduce((a, b) => a + b, 0);
    const h = tot >= 0.1 ? H(cle, 44) : 0;
    const rx = Math.round(Math.max(...s.pb));
    const droite = tot >= 0.1
      ? `${nombreFr(tot)} mm`
      : rx >= 5 ? `risque ${rx} %` : "aucune";
    if (!h) { poser("Pluie", droite, 0); }
    else {
      const mx = Math.max(1, Math.max(...s.mm));
      let d = fond(h, false);
      s.mm.forEach((v, k) => {
        if (v < 0.05) return;
        const hb = Math.max(1.5, (v / mx) * (h - 12));
        d += `<rect x="${u(X(k) + LA * 0.16)}" y="${u(h - hb)}" width="${u(LA * 0.68)}" `
          + `height="${u(hb)}" rx="1" fill="currentColor" opacity=".55"/>`;
      });
      d += chiffre(10, `${nombreFr(mx)} mm`);
      if (grand(cle)) {
        for (let k = 1; k < s.n - 2; k += 3) {
          if (s.mm[k] < 0.1) continue;
          d += etiq(k, h - Math.max(1.5, (s.mm[k] / mx) * (h - 12)) - 3, nombreFr(s.mm[k]), "mg-p");
        }
      }
      poser("Pluie", droite, h, d,
        `Lame horaire en millimètres. Risque maximal ${rx} % sur la fenêtre. `
        + "Une barre absente vaut zéro, non une valeur manquante.", cle);
    }
  }

  // ---- 3. Vent et rafales ----
  {
    const cle = "v";
    const h = H(cle, H_VOIE);
    const y0 = 8, y1 = h - 4;
    const mx = Math.max(30, Math.max(...s.raf) * 1.08);
    const [tr, ch] = graduation(y0, y1, 0, mx, mx > 80 ? 40 : 20, d => `${Math.round(d)}`, 20);
    let d = fond(h) + tr;
    d += `<path d="${aire(s.raf, y0, y1, 0, mx)}" fill="currentColor" opacity=".07"/>`;
    d += `<polyline points="${pts(s.raf, y0, y1, 0, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".45" stroke-dasharray="3 2"/>`;
    d += `<polyline points="${pts(s.v, y0, y1, 0, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.7" stroke-linejoin="round"/>`;
    // Le filet de vingt kilomètres par heure, chiffré : au-delà, un vent se sent.
    if (mx > 20) d += filSeuil(y1 - (20 / mx) * (y1 - y0), "20 km/h");
    if (grand(cle)) d += jalons(s.raf, y0, y1, 0, mx, v => Math.round(v));
    d += ch;
    const dir = CARD_ABR[iCard(s.dir[0])];
    poser("Vent", `${bornes(s.v)} km/h ${dir}`, h, d,
      `Trait plein le vent moyen, pointillé les rafales. Vent ${dCardinal(s.dir[0])} `
      + `à l'heure en cours. Le filet marque vingt kilomètres par heure.`, cle);
  }

  // ---- 4. Couverture du ciel ----
  {
    const cle = "nua";
    const h = H(cle, 40);
    let d = fond(h, false);
    /* Les rectangles se joignent exactement. Une largeur arrondie au dixième
       laissait un liseré plus sombre entre deux heures, qui se lisait comme une
       graduation. */
    s.nua.forEach((v, k) => {
      const x0 = X(k), x1 = X(k + 1);
      d += `<rect x="${x0.toFixed(3)}" y="0" width="${(x1 - x0).toFixed(3)}" height="${h}" `
        + `fill="currentColor" opacity="${(0.06 + (v / 100) * 0.4).toFixed(3)}" `
        + `shape-rendering="crispEdges"/>`;
    });
    d += fond(h, false);
    if (grand(cle)) {
      for (let k = 1; k < s.n - 2; k += 3) d += etiq(k, h / 2 + 3, `${Math.round(s.nua[k])}`, "mg-p");
    }
    poser("Ciel", `${bornes(s.nua)} %`, h, d,
      "Bande d'autant plus dense que le ciel est couvert. Les chiffres sont en pour cent "
      + "de couverture nuageuse.", cle);
  }

  // ---- 5. Indice ultraviolet ----
  {
    const cle = "uv";
    const mxUV = Math.max(...s.uv);
    const h = mxUV >= 0.5 ? H(cle, 40) : 0;
    if (!h) { poser("Indice UV", "nul", 0); }
    else {
      const mx = Math.max(3, Math.ceil(mxUV));
      let d = fond(h, false);
      s.uv.forEach((v, k) => {
        if (v < 0.1) return;
        const hb = Math.max(1.2, (v / mx) * (h - 10));
        d += `<rect x="${u(X(k) + LA * 0.16)}" y="${u(h - hb)}" width="${u(LA * 0.68)}" `
          + `height="${u(hb)}" rx="1" fill="currentColor" opacity=".5"/>`;
      });
      d += chiffre(9, String(mx));
      if (grand(cle)) {
        for (let k = 1; k < s.n - 2; k += 3) {
          if (s.uv[k] < 0.5) continue;
          d += etiq(k, h - Math.max(1.2, (s.uv[k] / mx) * (h - 10)) - 3, nombreFr(s.uv[k]), "mg-p");
        }
      }
      poser("Indice UV", `max ${nombreFr(mxUV)}`, h, d,
        "Indice ultraviolet heure par heure. Au-dessus de sept, l'exposition demande "
        + "une protection.", cle);
    }
  }

  // ---- 6. Humidité relative ----
  {
    const cle = "hum";
    const h = H(cle, 48);
    const y0 = 8, y1 = h - 3;
    /* L'échelle part de la dizaine sous le plancher du jour, sans dépasser
       soixante pour cent : une humidité qui ne descend jamais sous quatre-vingts
       dessinait sinon une ligne plate au sommet de sa voie. */
    const mn = Math.min(60, Math.floor(Math.min(...s.hum) / 10) * 10);
    let d = fond(h);
    d += `<path d="${aire(s.hum, y0, y1, mn, 100)}" fill="currentColor" opacity=".07"/>`;
    d += `<polyline points="${pts(s.hum, y0, y1, mn, 100)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.5"/>`;
    // Le filet de quatre-vingt-dix pour cent, chiffré : au-delà, l'air est saturé.
    if (mn < 90) d += filSeuil(y1 - ((90 - mn) / (100 - mn)) * (y1 - y0), "90 %");
    if (grand(cle)) d += jalons(s.hum, y0, y1, mn, 100, v => Math.round(v));
    poser("Humidité", `${bornes(s.hum)} %`, h, d,
      "Humidité relative. Le filet marque quatre-vingt-dix pour cent, au-delà desquels "
      + "l'air est saturé et le feuillage reste mouillé.", cle);
  }

  // ---- 7. Pression au niveau de la mer ----
  {
    const cle = "pres";
    const h = H(cle, 40);
    const y0 = 8, y1 = h - 3;
    /* La fenêtre ne descend pas sous six hectopascals : une pression stable
       dessinait sinon un relief de montagne sur deux dixièmes de variation. */
    let mn = Math.min(...s.pres), mx = Math.max(...s.pres);
    if (mx - mn < 6) { const c = (mn + mx) / 2; mn = c - 3; mx = c + 3; }
    let d = fond(h);
    d += `<polyline points="${pts(s.pres, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.5"/>`;
    d += chiffre(y0 + 1, `${Math.round(mx)}`);
    d += chiffre(y1, `${Math.round(mn)}`);
    if (grand(cle)) d += jalons(s.pres, y0, y1, mn, mx, v => Math.round(v));
    /* « Stable » se disait sur la seule différence entre le premier et le dernier
       point, ce qui manquait un creux au milieu. La tendance regarde l'écart le
       plus large de la fenêtre. */
    const ecart = mx - mn;
    const sens = s.pres[s.n - 1] - s.pres[0];
    const tend = ecart < 2 ? "stable"
      : Math.abs(sens) < 1.5 ? "variable"
      : sens > 0 ? "en hausse" : "en baisse";
    poser("Pression", `${Math.round(s.pres[0])} hPa, ${tend}`, h, d,
      "Pression au niveau de la mer, en hectopascals. Une baisse marquée annonce "
      + "une dégradation, une hausse un temps plus calme.", cle);
  }

  // Axe des heures, sous la pile.
  const axe = `<div class="mg-axe"><span>${esc(ICI)}</span>`
    + montants.map(([, lib]) => `<span>${esc(lib)}</span>`).join("")
    + `</div>`;

  return `<div class="mg">${voies.join("")}</div>${axe}`;
}

/* Lecture au doigt. Le montant est posé dès le dessin, replié : le faire naître
   au toucher obligerait à recomposer le dessin à chaque déplacement. */
export function brancher(bloc, surVoie) {
  const s = serie;
  if (!s) return;

  const lire = k => {
    heureLue = k;
    const prefixe = s.jour[k] !== s.jour[0] ? "demain " : "";
    const lit = {
      t: `${prefixe}${heureTxt(s.heure[k])}, ${nombreFr(s.t[k])}°`,
      mm: s.mm[k] >= 0.1
        ? `${prefixe}${heureTxt(s.heure[k])}, ${nombreFr(s.mm[k])} mm`
        : `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.pb[k])} %`,
      v: `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.v[k])} et ${Math.round(s.raf[k])} km/h`,
      nua: `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.nua[k])} %`,
      uv: `${prefixe}${heureTxt(s.heure[k])}, ${nombreFr(s.uv[k])}`,
      hum: `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.hum[k])} %`,
      pres: `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.pres[k])} hPa`,
    };
    for (const v of bloc.querySelectorAll(".mg-v")) {
      const cle = v.dataset.cle;
      const r = v.querySelector(".mg-r");
      if (r && lit[cle]) r.textContent = lit[cle];
      const cur = v.querySelector(".mg-cur");
      if (cur) {
        const svg = cur.closest("svg");
        const x = M + ((k + 0.5) / s.n) * P;
        cur.setAttribute("x1", x); cur.setAttribute("x2", x);
        cur.hidden = false;
        if (svg) svg.style.color = "";
      }
    }
  };

  const relacher = () => {
    heureLue = -1;
    for (const v of bloc.querySelectorAll(".mg-v")) {
      const r = v.querySelector(".mg-r");
      if (r && r.dataset.plage) r.textContent = r.dataset.plage;
      const cur = v.querySelector(".mg-cur");
      if (cur) cur.hidden = true;
    }
  };

  const kDe = ev => {
    const svg = ev.currentTarget;
    const b = svg.getBoundingClientRect();
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left;
    const rel = (px / b.width) * L;
    return Math.max(0, Math.min(s.n - 1, Math.floor(((rel - M) / P) * s.n)));
  };

  for (const svg of bloc.querySelectorAll(".mg-s")) {
    svg.addEventListener("pointerdown", ev => { ev.preventDefault(); lire(kDe(ev)); });
    svg.addEventListener("pointermove", ev => { if (ev.buttons) lire(kDe(ev)); });
    svg.addEventListener("pointerup", relacher);
    svg.addEventListener("pointerleave", relacher);
    svg.addEventListener("pointercancel", relacher);
  }

  for (const b of bloc.querySelectorAll(".mg-b")) {
    b.addEventListener("click", () => { ouvrir(b.dataset.voie); surVoie(); });
  }
}
