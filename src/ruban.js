/* Le ruban : une voie par grandeur, empilées sur le même axe des heures.

   Deux tracés ne partagent une voie que s'ils partagent l'unité et se lisent
   l'un par rapport à l'autre : la température avec le ressenti et le point de
   rosée, le vent avec ses rafales. Superposer la pluie en millimètres et le vent
   en kilomètres par heure aurait mis deux échelles sous une seule graduation.

   Le ciel ouvre la pile. C'est le dessin qui se lit en un coup d'œil, et sa
   bande de symboles est donc permanente, repliée comme dépliée. L'axe des heures
   la suit, sans quoi un symbole de pluie en tête de page ne dirait pas à quelle
   heure il tombe.

   Sept voies tiennent dans un écran de téléphone au prix d'une hauteur qui
   n'excède pas quatre-vingt-six points. Une voie touchée s'agrandit alors seule :
   sa courbe reprend du relief, et le dessin porte ce qu'il ne pouvait pas montrer
   replié. Les autres voies gardent leur taille. La hauteur dépliée est propre à
   la voie, le facteur commun de deux et demi ne valant que pour une courbe.

   ---------- La grammaire du tracé ----------

   Elle est la même sur les sept voies, et trois dispositifs y portent le sens.

   L'échelle vit dans une gouttière à droite, hors du dessin. Posée dedans, elle
   traversait les courbes : « 20 km/h » coupait la ligne du vent, « 15° 10° 5° »
   se collaient à celle de la température.

   Les seuils nommés s'écrivent à gauche, sur leur ligne, dans le tracé. « Élevé »
   dit ce que vaut sept d'indice ultraviolet mieux qu'une légende en bas de
   carte, et il le dit à l'endroit où on regarde.

   Une bande au-dessus du tracé porte une seconde grandeur en symboles : la
   direction du vent en flèches, le ciel en dessins, la tendance de la pression
   en flèches. Elle ne paraît que si la voie est assez haute pour la porter,
   soixante points, ce qui vaut toujours pour le vent et seulement une fois
   dépliées pour les voies courtes. Le ciel fait exception, la sienne est
   permanente.

   Une voie dépliée peut changer d'encodage quand le repli en trahissait la
   forme. Le ciel se dit en densité replié, faute de place, et en aire sous ses
   bandes nommées déplié : la teinte n'a pas d'échelle contre laquelle se lire,
   et une bascule s'y voyait comme un saut de gris entre deux lames.

   La couleur, enfin, n'est une donnée que sur deux voies, la température et
   l'indice ultraviolet, dont l'échelle se lit d'un coup d'œil. Ailleurs elle
   ferait du bruit : la forme, les symboles et les seuils nommés suffisent. */

import { nombreFr, jourCourt, heureTxt, esc } from "./horloge.js";
import { plagesDe, dCardinal, CARD_ABR, iCard } from "./previsions.js";
import { icoCiel, icoTemps, couleurT, couleurUV } from "./icones.js";

const L = 358, M = 5, GOUT = 34;
const P = L - M - GOUT;
const ZOOM = 2.5;
const H_VOIE = 86;
const H_TEMP = 66;   // amplitude réservée à la température dans sa voie
/* Deux bandes distinctes au-dessus du tracé, jamais superposées : les symboles
   en haut, les valeurs chiffrées dessous. Écrites au même niveau, les flèches du
   vent et les chiffres du vent se recouvraient. */
const H_SYM = 15;
const H_VAL = 12;
const H_AXE = 13;    // l'axe des heures, sous une voie dépliée
const MIN_BANDE = 60; // hauteur en deçà de laquelle la bande mangerait le tracé

let voieOuverte = null;
let serie = null;
let heureLue = -1;

export const ouvrir = c => { voieOuverte = voieOuverte === c ? null : c; };
// Ouverture franche, sans bascule : l'accueil désigne une voie, il ne la ferme pas.
export const poserVoie = c => { voieOuverte = c; };
export const voieCourante = () => voieOuverte;
export const serieCourante = () => serie;
export const heureCourante = () => heureLue;
export const poserHeure = k => { heureLue = k; };

const u = v => v.toFixed(1);
const bornes = (t, unite = "") =>
  `${Math.round(Math.min(...t))} à ${Math.round(Math.max(...t))}${unite}`;

/* Les échelles nommées. Chaque entrée est une borne basse et le mot qui vaut
   à partir d'elle. Le mot sert deux fois : écrit dans le tracé sur sa ligne,
   et accolé au chiffre de tête pour dire ce que ce chiffre vaut. */
const ECHELLES = {
  uv: [[0, "Faible"], [3, "Modéré"], [6, "Élevé"], [8, "Très élevé"], [11, "Extrême"]],
  v: [[0, "Calme"], [12, "Léger"], [30, "Modéré"], [50, "Fort"], [75, "Violent"]],
  hum: [[0, "Air sec"], [40, "Confortable"], [70, "Humide"], [90, "Saturé"]],
  mm: [[0, "Légère"], [2.5, "Modérée"], [7.5, "Forte"]],
  nua: [[0, "Dégagé"], [25, "Éclaircies"], [60, "Couvert"]],
};

const motDe = (cle, v) => {
  const e = ECHELLES[cle];
  let m = e[0][1];
  for (const [borne, nom] of e) if (v >= borne) m = nom;
  return m.toLowerCase();
};

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
    // Le libellé commence au montant, il ne le chevauche pas : c'est son bord
    // gauche qui doit rester à droite du premier libellé.
    if (X(k) + 2 < finIci) continue;
    montants.push([k, lib]);
  }

  /* La nuit est lavée sur les sept voies, sans exception. Présente sur quatre
     d'entre elles et absente des trois autres, elle se lisait comme un
     rectangle posé au hasard ; continue d'un bout à l'autre de la pile, elle
     redevient ce qu'elle est, une colonne de nuit qui traverse le ruban.

     Minuit garde son pointillé plus marqué : c'est une frontière de journée,
     non une graduation. */
  const fond = (y0, y1, hLavis) => {
    const hl = hLavis === undefined ? y1 - y0 : hLavis;
    let o = "";
    for (const [a, b] of plagesDe(s.n, k => !s.clair[k])) {
      o += `<rect class="mg-nuit" x="${u(X(a))}" y="${u(y0)}" `
        + `width="${u(X(b + 1) - X(a))}" height="${u(hl)}"/>`;
    }
    for (const [k] of montants) {
      const nuit = s.heure[k] === 0;
      o += `<line class="mg-mont${nuit ? " mg-minuit" : ""}" x1="${u(X(k))}" `
        + `y1="${u(y0)}" x2="${u(X(k))}" y2="${u(y1)}"/>`;
    }
    return o;
  };

  const pts = (vals, y0, y1, mn, mx) => vals.map((v, k) =>
    `${u(X(k + 0.5))},${u(y1 - ((v - mn) / ((mx - mn) || 1)) * (y1 - y0))}`).join(" ");

  const aire = (vals, y0, y1, mn, mx) =>
    `M${u(X(0.5))},${u(y1)} L${pts(vals, y0, y1, mn, mx).replace(/ /g, " L")} L${u(X(s.n - 0.5))},${u(y1)} Z`;

  const yDe = (v, y0, y1, mn, mx) => y1 - ((v - mn) / ((mx - mn) || 1)) * (y1 - y0);

  /* Le chiffre de l'échelle, dans la gouttière : rien ne passe derrière lui.
     Deux chiffres à moins de sept points l'un de l'autre se chevauchaient et se
     lisaient « 2,8 m2,5 » : le second est écarté. La réserve se vide à chaque
     voie. */
  let prises = [];
  const chiffre = (y, txt) => {
    if (prises.some(p => Math.abs(p - y) < 7)) return "";
    prises.push(y);
    return `<text class="mg-g" x="${L - 4}" y="${u(y)}" text-anchor="end">${esc(txt)}</text>`;
  };

  // Le nom d'un seuil, dans le tracé, sur sa ligne.
  const nomSeuil = (x, y, txt) =>
    `<text class="mg-bn" x="${u(x)}" y="${u(y - 2.5)}">${esc(txt)}</text>`;

  /* Le mot se pose là où l'encre ne passe pas. La largeur est balayée de gauche
     à droite ; on retient la place que le tracé recouvre le moins, puis, à
     égalité, celle dont il s'écarte le plus. Fixé à gauche, « Confortable »
     tombait sur l'aire pleine de l'humidité et s'y noyait.

     Une aire et un trait ne salissent pas de la même façon : l'aire couvre tout
     ce qui est sous sa courbe, le trait ne couvre que son propre passage. Une
     ligne entièrement prise garde son mot : le liseré le porte alors seul. */
  const placerNom = (y, txt, encres) => {
    const larg = 7 + txt.length * 4.7;
    const xMin = M + 3, xMax = L - GOUT - 3 - larg;
    if (!encres || !encres.length || xMax <= xMin) return nomSeuil(xMin, y, txt);
    const yt = y - 6;                    // milieu vertical du mot
    let mieux = null;
    /* Le balayage part de la gauche et garde la première place nette : le mot ne
       s'éloigne qu'autant qu'il le faut, et deux mots d'une même voie ne se
       retrouvent pas alignés au milieu sans raison. */
    const pasX = Math.max(4, (xMax - xMin) / 24);
    for (let x = xMin; x <= xMax + 0.01; x += pasX) {
      let couvre = 0, loin = 1e9;
      for (let k = 0; k < s.n; k++) {
        const xk = X(k + 0.5);
        if (xk < x - 4 || xk > x + larg + 4) continue;
        for (const [genre, ys] of encres) {
          const d = Math.abs(ys[k] - yt);
          if (genre === "aire" ? ys[k] < y + 3 : d < 5.5) couvre++;
          loin = Math.min(loin, d);
        }
      }
      if (!mieux || couvre < mieux.c || (couvre === mieux.c && loin > mieux.l + 0.01)) {
        mieux = { c: couvre, l: loin, x };
      }
    }
    return nomSeuil(mieux.x, y, txt);
  };

  /* Les seuils nommés d'une échelle, avec leur filet. Seuls ceux qui tombent
     dans la fenêtre paraissent, et le premier, qui vaut zéro, n'a pas de filet :
     il serait le plancher du tracé. */
  const seuils = (cle, y0, y1, mn, mx, chiffrer, encres) => {
    const ec = (encres || []).map(([genre, vals]) =>
      [genre, vals.map(v => yDe(v, y0, y1, mn, mx))]);
    let traits = "", noms = "";
    for (const [borne, nom] of ECHELLES[cle]) {
      if (borne <= mn || borne >= mx) continue;
      const y = yDe(borne, y0, y1, mn, mx);
      traits += `<line x1="${M}" y1="${u(y)}" x2="${L - GOUT}" y2="${u(y)}" `
        + `stroke="currentColor" opacity=".16" stroke-dasharray="2 3"/>`;
      noms += placerNom(y, nom, ec);
      if (chiffrer) noms += chiffre(y + 3, chiffrer(borne));
    }
    return [traits, noms];
  };

  /* Une graduation horizontale au pas donné, sur les seules valeurs couvertes.
     `sauf` écarte les valeurs que porte déjà un seuil nommé. */
  const graduation = (y0, y1, mn, mx, pas, ecrire, sauf = []) => {
    let traits = "", chiffres = "";
    for (let d = Math.ceil(mn / pas) * pas; d < mx; d += pas) {
      if (sauf.some(x => Math.abs(d - x) < 0.001)) continue;
      const yd = yDe(d, y0, y1, mn, mx);
      traits += `<line x1="${M}" y1="${u(yd)}" x2="${L - GOUT}" y2="${u(yd)}" `
        + `stroke="currentColor" opacity=".08"/>`;
      chiffres += chiffre(yd + 3, ecrire(d));
    }
    return [traits, chiffres];
  };

  /* La bande de symboles, au-dessus du tracé. Un dessin toutes les trois heures
     repliée, toutes les deux dépliée : plus serré, les symboles se touchent. */
  const bande = (large, faire) => {
    const pas = large ? 2 : 3;
    let o = "";
    for (let k = 1; k < s.n; k += pas) {
      const t = faire(k);
      if (!t) continue;
      o += `<g transform="translate(${u(X(k + 0.5) - 7)},1)">${t}</g>`;
    }
    return o;
  };

  const flecheVent = d => {
    /* La flèche montre où va le vent, non d'où il vient : un vent de nord
       pousse vers le sud. Zéro degré pointe donc vers le bas. */
    const a = (((d % 360) + 360) % 360) + 180;
    return `<g class="mg-fl" transform="rotate(${a.toFixed(0)} 7 7)">`
      + `<path d="M7 1.5v11M3.4 9.2 7 12.9l3.6-3.7" fill="none" stroke="currentColor" `
      + `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  };

  const flecheTend = d =>
    `<g class="mg-fl">` + (Math.abs(d) < 0.4
      ? `<path d="M2.5 7h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
      : d > 0
        ? `<path d="M7 12.5v-10M3.4 5.8 7 2.2l3.6 3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<path d="M7 1.5v10M3.4 8.2 7 11.8l3.6-3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    + `</g>`;

  // Le point qui marque un extrême. Le chiffre est en tête, il ne se redit pas.
  const marque = (k, y) =>
    `<circle class="mg-x" cx="${u(X(k + 0.5))}" cy="${u(y)}" r="2.6"/>`;

  const etiq = (k, y, txt, cls) => {
    // Une valeur vide ne laisse pas d'élément derrière elle : un texte creux
    // reste un nœud dans le dessin, et la voie du ciel en portait une file.
    if (txt === "" || txt === null || txt === undefined) return "";
    const anc = k < 2 ? "start" : k > s.n - 3 ? "end" : "middle";
    const x = k < 2 ? M + 1 : k > s.n - 3 ? L - GOUT - 1 : X(k + 0.5);
    return `<text class="${cls}" x="${u(x)}" y="${u(y)}" text-anchor="${anc}">${esc(txt)}</text>`;
  };

  /* Les valeurs heure par heure. Elles vivent dans la bande, au-dessus du
     tracé, non au-dessus de leur point : posées sur la courbe elles la
     coupaient, et sur les barres elles se chevauchaient. */
  const valeurs = (vals, ecrire, y) => {
    let o = "";
    for (let k = 1; k < s.n; k += 2) o += etiq(k, y, ecrire(vals[k]), "mg-p");
    return o;
  };

  // L'axe des heures, aux abscisses exactes des montants.
  const axeSvg = () => `<svg class="mg-a" viewBox="0 0 ${L} ${H_AXE}" aria-hidden="true">`
    + `<text class="mg-c" x="${M}" y="9">${esc(ICI)}</text>`
    + montants.map(([k, lib]) =>
      `<text class="mg-c" x="${u(X(k) + 2)}" y="9">${esc(lib)}</text>`).join("")
    + `</svg>`;

  /* La hauteur dépliée est propre à la voie. L'agrandissement vaut pour une
     courbe, qui gagne du relief, il ne donne rien à une bande de densité, qui
     reste plate qu'elle fasse quarante ou cent dix points. */
  const grand = c => voieOuverte === c;
  const H = (c, base, ouvert) =>
    (grand(c) ? (ouvert || Math.round(base * ZOOM)) : base);

  const voies = [];
  let n = 0;

  const poser = (nom, droite, haut, dedans, resume, cle, axe) => {
    prises = [];
    const val = `<span class="mg-r" data-plage="${esc(droite)}">${esc(droite)}</span>`;
    if (!haut) { voies.push(`<div class="mg-v"><p class="mg-t">${esc(nom)}${val}</p></div>`); return; }
    const g = grand(cle);
    const dessin = `<svg class="mg-s" viewBox="0 0 ${L} ${haut}" aria-hidden="true">${dedans}`
      + `<line class="mg-cur" x1="0" y1="0" x2="0" y2="${haut}" hidden/></svg>`;
    const id = `mgl${++n}`;
    const bas = resume ? `<p class="mg-l" id="${id}"${g ? "" : " hidden"}>${esc(resume)}</p>` : "";
    voies.push(`<div class="mg-v${g ? " mg-grand" : ""}" data-cle="${esc(cle)}">`
      + `<button type="button" class="mg-t mg-b" data-voie="${esc(cle)}" aria-expanded="${g}"`
      + (resume ? ` aria-controls="${id}"` : "") + ">"
      + `<span class="mg-n">${esc(nom)}<i aria-hidden="true">${g ? "−" : "+"}</i></span>`
      + `${val}</button>${dessin}${g || axe ? axeSvg() : ""}${bas}</div>`);
  };

  /* Les phrases de résumé. Un fait tiré de la série, non une notice : « Écran
     solaire de 11 h à 16 h » se lit, « indice ultraviolet heure par heure » se
     saute. */
  const HJ = k => (s.jour[k] !== s.jour[0] ? `demain ${heureTxt(s.heure[k])}` : heureTxt(s.heure[k]));
  const iMax = t => t.indexOf(Math.max(...t));
  const iMin = t => t.indexOf(Math.min(...t));
  /* Plusieurs plages disjointes ne se disent pas comme une seule : « de 09 h à
     demain 08 h » pour deux épisodes séparés par douze heures de calme est
     faux. On dit alors la plus longue, et qu'il y en a d'autres. */
  const dire = plages => {
    if (!plages.length) return "";
    const dit = ([a, b]) => (a === b ? `vers ${HJ(a)}`
      : `de ${HJ(a)} à ${HJ(Math.min(s.n - 1, b + 1))}`);
    if (plages.length === 1) return dit(plages[0]);
    const large = plages.reduce((m, p) => (p[1] - p[0] > m[1] - m[0] ? p : m), plages[0]);
    return `${dit(large)}, et par moments ailleurs`;
  };

  // ---- 1. Couverture du ciel ----
  {
    const cle = "nua";
    const g = grand(cle);
    /* La bande de symboles est ici permanente : le dessin du ciel est ce qui se
       lit en un coup d'œil, il n'attend pas qu'on déplie la voie. Dépliée, la
       voie tient dans la hauteur commune : agrandie de deux fois et demie, elle
       n'offrait qu'une bande de densité plus haute, donc rien de plus. */
    const h = H(cle, 41, H_VOIE);
    const hs = H_SYM, hv = g ? H_VAL : 0, hb = hs + hv;
    let d = "";
    if (!g) {
      /* Repliée, la couverture se dit en densité, une lame par heure. Les
         rectangles se joignent exactement : une largeur arrondie au dixième
         laissait un liseré plus sombre entre deux heures, qui se lisait comme
         une graduation. */
      s.nua.forEach((v, k) => {
        const x0 = X(k), x1 = X(k + 1);
        d += `<rect x="${x0.toFixed(3)}" y="${hb}" width="${(x1 - x0).toFixed(3)}" `
          + `height="${u(h - hb)}" fill="currentColor" opacity="${(0.06 + (v / 100) * 0.4).toFixed(3)}" `
          + `shape-rendering="crispEdges"/>`;
      });
      /* Le lavis de nuit se réduit ici à un bandeau de cinq points. Étendu à
         toute la hauteur, il s'ajouterait à la densité et fausserait la
         lecture : la colonne de nuit continue, la valeur reste juste. */
      d += fond(hb, h, 5);
    } else {
      /* Dépliée, la voie prend la grammaire des autres : une aire de zéro à
         cent pour cent sous ses bandes nommées. La densité disait la valeur par
         une teinte, sans échelle contre laquelle la lire, et sa bascule se
         voyait comme un saut de gris entre deux lames. */
      const y0 = hb + 4, y1 = h - 3;
      d = fond(hb, h);
      const [snTr, snNo] = seuils("nua", y0, y1, 0, 100, v => `${v}`, [["aire", s.nua]]);
      d += snTr;
      d += `<path d="${aire(s.nua, y0, y1, 0, 100)}" fill="currentColor" opacity=".16"/>`;
      d += `<polyline points="${pts(s.nua, y0, y1, 0, 100)}" fill="none" stroke="currentColor" `
        + `stroke-width="1.7" stroke-linejoin="round"/>`;
      d += snNo;
      /* Un ciel dégagé n'a pas de chiffre : une file de zéros se lisait comme du
         bruit, et le symbole du soleil dit déjà tout. */
      d += valeurs(s.nua, v => (v >= 5 ? Math.round(v) : ""), hs + 9);
    }
    d += bande(g, k => icoTemps(icoCiel(s.code[k], s.clair[k]), "mg-ic", 14));
    /* Le premier basculement du ciel : c'est lui qu'on cherche en ouvrant la
       voie, non la moyenne de la fenêtre. */
    const seuil = 60;
    let bascule = -1;
    for (let k = 1; k < s.n; k++) {
      if ((s.nua[k - 1] < seuil) !== (s.nua[k] < seuil)) { bascule = k; break; }
    }
    poser("Ciel", `${bornes(s.nua)} %, ${motDe("nua", Math.max(...s.nua))} au plus`, h, d,
      bascule < 0
        ? `Ciel ${motDe("nua", s.nua[0])} sur toute la fenêtre.`
        : `Ciel ${motDe("nua", s.nua[0])} jusqu'à ${HJ(bascule)}, `
          + `${motDe("nua", s.nua[bascule])} ensuite.`, cle, true);
  }

  // ---- 2. Température, ressenti et point de rosée ----
  {
    const cle = "t";
    const g = grand(cle);
    const h = H(cle, H_VOIE);
    const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
    const marge = (h - hb - (g ? H_TEMP * ZOOM : H_TEMP)) / 2;
    const y0 = hb + marge, y1 = h - marge;
    const tous = [...s.t, ...s.res, ...s.ros];
    let mn = Math.min(...tous), mx = Math.max(...tous);
    if (mx - mn < 4) { const c = (mn + mx) / 2; mn = c - 2; mx = c + 2; }
    const pas = mx - mn > 24 ? 10 : mx - mn > 10 ? 5 : 2;
    const [tr, ch] = graduation(y0, y1, mn, mx, pas, d => `${Math.round(d)}°`);

    /* La rampe se pose deux fois. En hauteur elle remplit la colonne du
       thermomètre, froide en bas, chaude en haut, et l'aire y puise sa teinte à
       la hauteur de chaque point. En largeur elle colore la courbe elle-même,
       heure par heure : à seize heures le trait est de la couleur de seize
       heures. */
    const arretsY = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = mx - f * (mx - mn);
      return `<stop offset="${f}" stop-color="${couleurT(v)}"/>`;
    }).join("");
    const arretsX = s.t.map((v, k) =>
      `<stop offset="${(k / (s.n - 1)).toFixed(4)}" stop-color="${couleurT(v)}"/>`).join("");
    const defs = `<defs>`
      + `<linearGradient id="mgTy" x1="0" y1="${u(y0)}" x2="0" y2="${u(y1)}" `
      + `gradientUnits="userSpaceOnUse">${arretsY}</linearGradient>`
      + `<linearGradient id="mgTx" x1="${u(X(0.5))}" y1="0" x2="${u(X(s.n - 0.5))}" y2="0" `
      + `gradientUnits="userSpaceOnUse">${arretsX}</linearGradient></defs>`;

    let d = defs + fond(hb, h) + tr;
    d += `<path d="${aire(s.t, y0, y1, mn, mx)}" fill="url(#mgTy)" opacity=".28"/>`;
    d += `<polyline points="${pts(s.ros, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".3" stroke-dasharray="3 2"/>`;
    d += `<polyline points="${pts(s.res, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".42"/>`;
    d += `<polyline points="${pts(s.t, y0, y1, mn, mx)}" fill="none" stroke="url(#mgTx)" `
      + `stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const kx = iMax(s.t), kn = iMin(s.t);
    d += marque(kx, yDe(s.t[kx], y0, y1, mn, mx)) + marque(kn, yDe(s.t[kn], y0, y1, mn, mx));
    if (g) d += valeurs(s.t, v => `${Math.round(v)}°`, hs + 9);
    d += ch;
    poser("Température", `${bornes(s.t)}°`, h, d,
      `Minimum ${Math.round(s.t[kn])}° vers ${HJ(kn)}, maximum ${Math.round(s.t[kx])}° `
      + `vers ${HJ(kx)}. Trait fin le ressenti, pointillé le point de rosée.`, cle);
  }

  // ---- 3. Pluie ----
  {
    const cle = "mm";
    const g = grand(cle);
    const tot = s.mm.reduce((a, b) => a + b, 0);
    const h = tot >= 0.1 ? H(cle, 48) : 0;
    const rx = Math.round(Math.max(...s.pb));
    const pointe = Math.max(...s.mm);
    const droite = tot >= 0.1
      ? `${nombreFr(tot)} mm, ${motDe("mm", pointe)}`
      : rx >= 5 ? `risque ${rx} %` : "aucune";
    if (!h) { poser("Pluie", droite, 0); }
    else {
      const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
      const y0 = hb + 3, y1 = h - 3;
      const mx = Math.max(1, pointe * 1.15);
      let d = fond(hb, h);
      /* Les bandes nommées tiennent lieu de graduation : une lame horaire en
         millimètres n'est pas un nombre qu'on porte en tête, « modérée » l'est. */
      const [smTr, smNo] = seuils("mm", y0, y1, 0, mx, null, [["aire", s.mm]]);
      d += smTr;
      /* Le risque passe derrière les barres, en aire très faible : deux
         questions sur une voie, combien et quelle chance. En pointillé par
         dessus, il traçait un trapèze qu'on prenait pour une seconde lame. */
      if (rx >= 5) {
        d += `<path d="${aire(s.pb, y0, y1, 0, 100)}" fill="currentColor" opacity=".12"/>`;
      }
      s.mm.forEach((v, k) => {
        if (v < 0.05) return;
        const hh = Math.max(1.5, (v / mx) * (y1 - y0));
        d += `<rect x="${u(X(k) + LA * 0.16)}" y="${u(y1 - hh)}" width="${u(LA * 0.68)}" `
          + `height="${u(hh)}" rx="1" fill="currentColor" opacity=".6"/>`;
      });
      d += smNo;
      if (g) d += valeurs(s.mm, v => (v >= 0.1 ? nombreFr(v) : ""), hs + 9);
      const quand = dire(plagesDe(s.n, k => s.mm[k] >= 0.1));
      poser("Pluie", droite, h, d,
        `${nombreFr(tot)} mm attendus, ${quand}. Risque maximal ${rx} %. `
        + `L'aire pâle derrière les barres porte le risque, de zéro à cent pour cent.`, cle);
    }
  }

  // ---- 4. Vent et rafales ----
  {
    const cle = "v";
    const g = grand(cle);
    const h = H(cle, H_VOIE);
    const hs = h >= MIN_BANDE ? H_SYM : 0, hv = g ? H_VAL : 0, hb = hs + hv;
    const y0 = hb + 5, y1 = h - 4;
    const mx = Math.max(30, Math.max(...s.raf) * 1.08);
    let d = fond(hb, h);
    // Les bandes nommées tiennent lieu de graduation : cinq chiffres de plus
    // dans la gouttière ne diraient rien que « modéré » ne dise déjà.
    // C'est la rafale qui recouvre, elle passe au-dessus du vent.
    const [svTr, svNo] = seuils("v", y0, y1, 0, mx, v => `${v}`, [["aire", s.v], ["trait", s.raf]]);
    d += svTr;
    /* La rafale est l'enveloppe, le vent est le corps. Le pointillé disait la
       même chose une troisième fois : la position, au-dessus, et le
       remplissage, plein contre nu, suffisent à les distinguer. */
    d += `<path d="${aire(s.v, y0, y1, 0, mx)}" fill="currentColor" opacity=".14"/>`;
    d += `<polyline points="${pts(s.raf, y0, y1, 0, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.3" opacity=".55" stroke-linejoin="round"/>`;
    d += `<polyline points="${pts(s.v, y0, y1, 0, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`;
    const kr = iMax(s.raf);
    d += marque(kr, yDe(s.raf[kr], y0, y1, 0, mx));
    d += svNo;
    if (hs) d += bande(g, k => flecheVent(s.dir[k]));
    if (g) d += valeurs(s.v, v => Math.round(v), hs + 9);
    const rafMax = Math.round(Math.max(...s.raf));
    const fortes = plagesDe(s.n, k => s.raf[k] >= 40);
    poser("Vent", `${bornes(s.v)} km/h, ${motDe("v", Math.max(...s.v))}`, h, d,
      fortes.length
        ? `Rafales au-dessus de quarante ${dire(fortes)}, jusqu'à ${rafMax} km/h. `
          + `Vent ${dCardinal(s.dir[0])} à l'heure en cours.`
        : `Vent ${dCardinal(s.dir[0])} à l'heure en cours, rafales jusqu'à ${rafMax} km/h `
          + `vers ${HJ(kr)}. Les flèches montrent où va le vent.`, cle);
  }

  // ---- 5. Indice ultraviolet ----
  {
    const cle = "uv";
    const g = grand(cle);
    const mxUV = Math.max(...s.uv);
    const h = mxUV >= 0.5 ? H(cle, 48) : 0;
    if (!h) { poser("Indice UV", "nul", 0); }
    else {
      const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
      const y0 = hb + 3, y1 = h - 3;
      const mx = Math.max(3, Math.ceil(mxUV));
      let d = fond(hb, h);
      const [suTr, suNo] = seuils("uv", y0, y1, 0, mx, v => `${v}`, [["aire", s.uv]]);
      d += suTr;
      s.uv.forEach((v, k) => {
        if (v < 0.1) return;
        const hh = Math.max(1.2, (v / mx) * (y1 - y0));
        d += `<rect x="${u(X(k) + LA * 0.16)}" y="${u(y1 - hh)}" width="${u(LA * 0.68)}" `
          + `height="${u(hh)}" rx="1" fill="${couleurUV(v)}"/>`;
      });
      d += suNo;
      const ku = iMax(s.uv);
      d += marque(ku, yDe(s.uv[ku], y0, y1, 0, mx));
      if (g) d += valeurs(s.uv, v => (v >= 0.5 ? nombreFr(v) : ""), hs + 9);
      const forts = plagesDe(s.n, k => s.uv[k] >= 3);
      poser("Indice UV", `${nombreFr(mxUV)} au plus, ${motDe("uv", mxUV)}`, h, d,
        forts.length
          ? `Protection recommandée ${dire(forts)}, indice ${nombreFr(mxUV)} vers ${HJ(ku)}.`
          : `Indice faible sur toute la fenêtre, ${nombreFr(mxUV)} au plus vers ${HJ(ku)}.`, cle);
    }
  }

  // ---- 6. Humidité relative ----
  {
    const cle = "hum";
    const g = grand(cle);
    const h = H(cle, 52);
    const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
    const y0 = hb + 4, y1 = h - 3;
    /* L'échelle part de la dizaine sous le plancher du jour, sans dépasser
       soixante pour cent : une humidité qui ne descend jamais sous quatre-vingts
       dessinait sinon une ligne plate au sommet de sa voie. */
    const mn = Math.min(60, Math.floor(Math.min(...s.hum) / 10) * 10);
    let d = fond(hb, h);
    const [shTr, shNo] = seuils("hum", y0, y1, mn, 100, v => `${v}`, [["aire", s.hum]]);
    d += shTr;
    d += `<path d="${aire(s.hum, y0, y1, mn, 100)}" fill="currentColor" opacity=".14"/>`;
    d += `<polyline points="${pts(s.hum, y0, y1, mn, 100)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.7" stroke-linejoin="round"/>`;
    d += shNo;
    const kh = iMax(s.hum);
    d += marque(kh, yDe(s.hum[kh], y0, y1, mn, 100));
    if (g) d += valeurs(s.hum, v => Math.round(v), hs + 9);
    const satures = plagesDe(s.n, k => s.hum[k] >= 90);
    poser("Humidité", `${bornes(s.hum)} %, ${motDe("hum", Math.max(...s.hum))} au plus`, h, d,
      satures.length
        ? `Air saturé ${dire(satures)} : le feuillage reste mouillé.`
        : `Maximum ${Math.round(s.hum[kh])} % vers ${HJ(kh)}, sans saturation.`, cle);
  }

  // ---- 7. Pression au niveau de la mer ----
  {
    const cle = "pres";
    const g = grand(cle);
    const h = H(cle, 44);
    const hs = h >= MIN_BANDE ? H_SYM : 0, hv = g ? H_VAL : 0, hb = hs + hv;
    const y0 = hb + 4, y1 = h - 3;
    /* La fenêtre ne descend pas sous six hectopascals : une pression stable
       dessinait sinon un relief de montagne sur deux dixièmes de variation. */
    let mn = Math.min(...s.pres), mx = Math.max(...s.pres);
    if (mx - mn < 6) { const c = (mn + mx) / 2; mn = c - 3; mx = c + 3; }
    let d = fond(hb, h);
    d += `<path d="${aire(s.pres, y0, y1, mn, mx)}" fill="currentColor" opacity=".10"/>`;
    d += `<polyline points="${pts(s.pres, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.7" stroke-linejoin="round"/>`;
    const kx = iMax(s.pres), kn = iMin(s.pres);
    d += marque(kx, yDe(s.pres[kx], y0, y1, mn, mx)) + marque(kn, yDe(s.pres[kn], y0, y1, mn, mx));
    d += chiffre(y0 + 4, `${Math.round(mx)}`);
    d += chiffre(y1, `${Math.round(mn)}`);
    /* La tendance heure par heure, en flèches : c'est le sens du mouvement
       qu'on demande à une pression, non sa valeur absolue. */
    if (hs) {
      d += bande(g, k => flecheTend(k === 0 ? 0 : s.pres[k] - s.pres[Math.max(0, k - 3)]));
    }
    if (g) d += valeurs(s.pres, v => Math.round(v), hs + 9);
    /* « Stable » se disait sur la seule différence entre le premier et le dernier
       point, ce qui manquait un creux au milieu. La tendance regarde l'écart le
       plus large de la fenêtre. */
    const ecart = Math.max(...s.pres) - Math.min(...s.pres);
    const sens = s.pres[s.n - 1] - s.pres[0];
    const tend = ecart < 2 ? "stable"
      : Math.abs(sens) < 1.5 ? "variable"
      : sens > 0 ? "en hausse" : "en baisse";
    poser("Pression", `${Math.round(s.pres[0])} hPa, ${tend}`, h, d,
      tend === "stable"
        ? `Stable autour de ${Math.round(s.pres[0])} hPa : pas de changement annoncé.`
        : `${Math.round(ecart)} hPa d'écart sur la fenêtre, creux vers ${HJ(kn)}. `
          + `Une baisse marquée annonce une dégradation.`, cle);
  }

  return `<div class="mg">${voies.join("")}</div>${axeSvg()}`;
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
      t: `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.t[k])}°`,
      mm: s.mm[k] >= 0.1
        ? `${prefixe}${heureTxt(s.heure[k])}, ${nombreFr(s.mm[k])} mm`
        : `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.pb[k])} %`,
      v: `${prefixe}${heureTxt(s.heure[k])}, ${Math.round(s.v[k])} et ${Math.round(s.raf[k])} km/h`
        + ` ${CARD_ABR[iCard(s.dir[k])]}`,
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
        /* `hidden` est une propriété de HTMLElement, non de SVGElement :
           l'affecter sur une ligne SVG posait une propriété sans effet et
           laissait l'attribut en place. Le montant de lecture ne paraissait
           donc jamais. L'attribut se pose et se retire à la main. */
        cur.removeAttribute("hidden");
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
      if (cur) cur.setAttribute("hidden", "");
    }
  };

  const kDe = ev => {
    const svg = ev.currentTarget;
    const b = svg.getBoundingClientRect();
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left;
    const rel = (px / b.width) * L;
    return Math.max(0, Math.min(s.n - 1, Math.floor(((rel - M) / P) * s.n)));
  };

  /* Lecture au doigt, et défilement de la page, sur la même surface.

     Le geste n'est pas tranché à l'appui : il l'est au premier déplacement franc,
     et une fois tranché il ne se remet pas en cause. La lecture accepte donc un
     déplacement oblique jusqu'à quarante degrés de l'horizontale, ce qu'un doigt
     fait naturellement en suivant une courbe. Au delà, la page défile et la
     lecture se retire.

     `touch-action: pan-y` laisse le navigateur mener le défilement vertical, ce
     qui reste plus fluide que de le simuler. */
  const TANGENTE = Math.tan(40 * Math.PI / 180);
  const SEUIL = 8;

  for (const svg of bloc.querySelectorAll(".mg-s")) {
    let x0 = 0, y0 = 0, mode = null;

    svg.addEventListener("pointerdown", ev => {
      x0 = ev.clientX; y0 = ev.clientY; mode = null;
      lire(kDe(ev));
    });

    svg.addEventListener("pointermove", ev => {
      if (!ev.buttons) return;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (mode === null) {
        if (Math.hypot(dx, dy) < SEUIL) { lire(kDe(ev)); return; }
        mode = Math.abs(dy) <= Math.abs(dx) * TANGENTE ? "lit" : "defile";
        if (mode === "defile") { relacher(); return; }
        try { svg.setPointerCapture(ev.pointerId); } catch { /* souris déjà capturée */ }
      }
      if (mode !== "lit") return;
      ev.preventDefault();
      lire(kDe(ev));
    });

    const fin = () => { mode = null; relacher(); };
    svg.addEventListener("pointerup", fin);
    svg.addEventListener("pointercancel", fin);

    /* La prise du pointeur fait sortir le curseur de l'élément aux yeux du
       navigateur, qui émet aussitôt un `pointerleave`. Le traiter comme une fin
       de geste coupait la lecture au premier déplacement. */
    svg.addEventListener("pointerleave", () => { if (mode !== "lit") fin(); });
  }

  for (const b of bloc.querySelectorAll(".mg-b")) {
    b.addEventListener("click", () => { ouvrir(b.dataset.voie); surVoie(); });
  }
}
