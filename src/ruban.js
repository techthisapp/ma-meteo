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

import { angleFleche, TRACE_FLECHE } from "./fleche.js";
import { nombreFr, jourCourt, heureTxt, esc, cleJourLocal } from "./horloge.js";
import { plagesDe, duCardinal, SEUIL_LAME, SEUIL_RISQUE, ECHELLE_UV, tendancePression } from "./previsions.js";
import { icoCiel, icoTemps, couleurT, couleurUV, tempsDe } from "./icones.js";
import { alignerSur, LAME } from "./ensemble.js";

/* La largeur du dessin, en unités, suit celle de l'écran à la densité du
   portrait : 358 unités pour 310 points d'écran. Elle était fixe, et en paysage
   ces 358 unités s'étiraient sur 764 points : textes, marges, épaisseurs et
   hauteurs grossissaient d'un facteur deux, relevé par Jérôme le
   24 septembre 2026. Le portrait garde exactement sa géométrie : jusqu'à 430
   points de large, la largeur reste 358. La largeur se lit sur la colonne des
   voies quand elle existe ; au premier rendu, où elle n'existe pas encore, sur
   l'écran, et le branchement corrige d'un seul rendu si la colonne posée
   dément l'estimation. */
const L_PORTRAIT = 358, POINTS_PORTRAIT = 318;
const M = 5, GOUT = 34;
let L = L_PORTRAIT, P = L - M - GOUT;

export function largeurVoulue() {
  if (typeof document === "undefined") return L_PORTRAIT;
  const v = document.querySelector(".mg-v");
  const e = document.getElementById("ecran");
  const px = v ? v.getBoundingClientRect().width
    : (e ? e.getBoundingClientRect().width - 76 : POINTS_PORTRAIT);
  return px <= 430 ? L_PORTRAIT : Math.round(px * L_PORTRAIT / POINTS_PORTRAIT);
}
const ZOOM = 2.5;
const H_VOIE = 86;
const H_TEMP = 66;   // amplitude réservée à la température dans sa voie
/* Deux bandes distinctes au-dessus du tracé, jamais superposées : les symboles
   en haut, les valeurs chiffrées dessous. Écrites au même niveau, les flèches du
   vent et les chiffres du vent se recouvraient. */
const H_SYM = 15;
const H_VAL = 12;
const MIN_BANDE = 60; // hauteur en deçà de laquelle la bande mangerait le tracé

let voieOuverte = null;
let serie = null;
let heureLue = -1;

/* La fenêtre glisse sur l'horizon. `decalage` est son premier indice dans la
   série, `ancre` dit qu'elle suit l'heure en cours : tant qu'on n'a pas fait
   glisser, une charge plus récente ramène la fenêtre sur maintenant. */
let decalage = 0;
let ancre = true;

export const ouvrir = c => { voieOuverte = voieOuverte === c ? null : c; };
// Ouverture franche, sans bascule : l'accueil désigne une voie, il ne la ferme pas.
export const poserVoie = c => { voieOuverte = c; };
export const serieCourante = () => serie;
export const heureCourante = () => heureLue;
export const poserHeure = k => { heureLue = k; };
export const decalageCourant = () => decalage;
export const auMaintenant = () => { ancre = true; };
/* La fenêtre calée sur le minuit du jour qui porte l'heure `k`, jalon 21,
   lot 2 : le choix du jour, et l'accueil qui désigne une heure lointaine. */
export const poserJour = k => {
  if (!serie) return;
  let m = Math.max(0, Math.min(serie.n - 1, k));
  while (m > 0 && serie.heure[m] !== 0) m--;
  decalage = Math.max(0, Math.min(serie.n - fenetre(), m));
  ancre = false;
  heureLue = -1;
};

/* Où commence la fenêtre calée sur maintenant. Non pas à l'heure en cours mais
   un sixième de fenêtre avant, quatre heures en portrait et huit en paysage.

   Les heures qui viennent de passer sont le premier repère qu'on cherche : « il
   fait plus chaud ou moins chaud qu'il y a deux heures » ne se lit pas sur une
   courbe qui commence à l'instant. Et le repère de l'heure en cours doit tomber
   dans le cadre pour se voir, alors que collé au bord gauche il se lisait comme
   un filet de cadre et restait caché. En début de journée la butée de minuit
   rend ce recul plus court, la série ne commençant pas avant. */
const pose = s => Math.max(0, s.ici - Math.round(fenetre() / 6));

/* Vingt-quatre heures sur la largeur en portrait, quarante-huit dès que la
   largeur le permet. La règle est une densité minimale : mesurée, la zone de
   tracé fait 283 points en portrait, soit 11,8 par heure sur vingt-quatre, et
   628 points en paysage sans bridage, soit 13,1 par heure sur quarante-huit.
   Soixante-douze heures tomberaient à 8,7, où la bande de symboles se touche et
   les valeurs ne tiennent plus. */
export const fenetre = () =>
  (typeof window !== "undefined" && window.innerWidth >= 700 ? 48 : 24);

/* La fenêtre visible, tranchée dans l'horizon. Tout ce qui s'écrit en parle : la
   lecture de droite, la phrase de résumé, les extrêmes marqués. Le dessin, lui,
   court sur l'horizon entier.

   La lame de secours n'est reprise que si elle couvre la fenêtre entière :
   tronquée, elle ferait croire à un désaccord entre modèles là où un seul
   parle. */
const CHAMPS = ["heure", "jour", "t", "res", "ros", "hum", "mm", "pb", "code",
  "nua", "pres", "v", "raf", "dir", "uv", "clair"];
const trancher = (s, a, b) => {
  const out = { n: b - a, dec: a };
  for (const c of CHAMPS) if (Array.isArray(s[c])) out[c] = s[c].slice(a, b);
  if (Array.isArray(s.mmS) && s.mmS.length >= b) out.mmS = s.mmS.slice(a, b);
  return out;
};

const u = v => v.toFixed(1);
const bornes = (t, unite = "") =>
  `${Math.round(Math.min(...t))} à ${Math.round(Math.max(...t))}${unite}`;

/* Les échelles nommées. Chaque entrée est une borne basse et le mot qui vaut
   à partir d'elle. Le mot sert deux fois : écrit dans le tracé sur sa ligne,
   et accolé au chiffre de tête pour dire ce que ce chiffre vaut. */
export const ECHELLES = {
  // L'échelle de l'indice UV est partagée avec la tuile de l'accueil.
  uv: ECHELLE_UV.map(([b, n]) => [b, n.charAt(0).toUpperCase() + n.slice(1)]),
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

/* Le nom d'un jour, compté depuis celui de l'heure en cours. « demain 14 h » sur
   une fenêtre calée sur jeudi désignerait mercredi, ce qui est faux. Au delà
   d'avant-hier et d'après-demain le jour se nomme.

   La référence est le jour de l'heure en cours, non le premier indice de la
   série : celui-ci tombe deux journées plus tôt depuis que l'horizon porte le
   passé, et tout se serait décalé d'autant. */
const MOTS_JOUR = {
  "-2": "avant-hier ", "-1": "hier ", 0: "", 1: "demain ", 2: "après-demain ",
};
const ecartJours = (a, b) =>
  Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
const jourRef = s => s.jour[Math.max(0, Math.min(s.n - 1, s.ici))];
const nomJour = (s, jour) => {
  const e = ecartJours(jourRef(s), jour);
  return MOTS_JOUR[e] !== undefined ? MOTS_JOUR[e] : `${jourCourt(jour)} `;
};

/* La bulle de lecture, jalon 21, lot 2, décision de Jérôme du 3 octobre
   2026 : toutes les grandeurs d'une heure au même endroit, sous l'axe collant.
   Chaque voie écrivait sa valeur à droite de son titre, et lire une heure
   demandait de regarder à sept endroits. */
/* Le nom d'un jour sur l'axe et dans la bulle, le même aux deux endroits :
   « Aujourd'hui », « Demain », « Hier », puis « Lundi 5 ». */
function jourBandeau(s, j) {
  const auj = s.jour[Math.max(0, Math.min(s.n - 1, s.ici))];
  const e = ecartJours(auj, j);
  if (e === 0) return "Aujourd'hui";
  if (e === 1) return "Demain";
  if (e === -1) return "Hier";
  return new Date(`${j}T12:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })
    .replace(/^./, c => c.toUpperCase());
}

function bulle(s, k) {
  if (!s || k < 0 || k >= s.n) return "";
  const j = jourBandeau(s, s.jour[k]);
  const quand = k === s.ici ? "Maintenant"
    : j === "Aujourd'hui" ? heureTxt(s.heure[k]) : `${j}, ${heureTxt(s.heure[k])}`;
  const cases = [
    ["Ressenti", `${Math.round(s.res[k])}°`],
    ["Pluie", s.mm[k] >= SEUIL_LAME ? `${nombreFr(s.mm[k])} mm` : "0 mm"],
    ["Risque de pluie", `${Math.round(s.pb[k])} %`],
    /* La direction dite en toutes lettres, « du sud-ouest », sous la vitesse,
       3 octobre 2026 : « SO » ne s'écrivait qu'ici. */
    ["Vent", `${Math.round(s.v[k])} km/h`, duCardinal(s.dir[k])],
    ["Rafales", `${Math.round(s.raf[k])} km/h`],
    ["Indice UV", s.uv[k] >= 0.5 ? nombreFr(s.uv[k]) : "0"],
    ["Humidité", `${Math.round(s.hum[k])} %`],
    ["Pression", `${Math.round(s.pres[k])} hPa`],
  ];
  return `<div class="mg-lu-t"><span class="mg-lu-h">${esc(quand.charAt(0).toUpperCase() + quand.slice(1))}</span>`
    + `<span class="mg-lu-c">${icoTemps(icoCiel(s.code[k], s.clair[k]), "mg-lu-ic")}<b>${Math.round(s.t[k])}°</b></span>`
    + `<span class="mg-lu-m">${esc(tempsDe(s.code[k])[1])}</span></div>`
    + `<dl class="mg-lu-g">${cases.map(([n, v, sous]) => `<div><dt>${esc(n)}</dt><dd>${esc(v)}`
      + `${sous ? `<small>${esc(sous)}</small>` : ""}</dd></div>`).join("")}</dl>`;
}

export function dessiner(s) {
  L = largeurVoulue();
  P = L - M - GOUT;
  serie = s;
  /* Les scénarios, alignés sur la série une fois pour toutes : la voie de
     température s'en sert, et la phrase de résumé aussi. Ils manquent tant que
     la requête d'ensemble n'a pas abouti, et le ruban se dessine sans eux. */
  const ens = alignerSur(s);
  const FEN = fenetre();
  if (ancre) decalage = pose(s);
  decalage = Math.max(0, Math.min(Math.max(0, s.n - FEN), decalage));
  const dec = decalage;
  /* L'heure lue, jalon 21, lot 2 : toujours une, pour que la bulle ne soit
     jamais vide. L'heure en cours sur la fenêtre de maintenant, midi sur un
     jour choisi, tant qu'aucun doigt n'en a désigné une autre dans la
     fenêtre. */
  if (heureLue < dec || heureLue >= Math.min(s.n, dec + FEN)) {
    heureLue = ancre && s.ici >= dec && s.ici < dec + FEN ? s.ici : Math.min(s.n - 1, dec + 12);
  }

  /* L'abscisse est celle de la fenêtre : l'heure `dec` tombe sur la marge
     gauche, l'heure `dec + FEN` sur la gouttière. Les heures d'avant et d'après
     sont dessinées quand même, hors du cadre, et la découpe les cache : le
     glissement n'a alors qu'une translation à appliquer, sans redessiner. */
  const X = k => M + ((k - dec) / FEN) * P;
  const LA = P / FEN;

  /* La bande dessinée est la fenêtre visible, plus une heure de chaque côté
     pour ouvrir et fermer les courbes. Elle débordait d'une fenêtre de part
     et d'autre pour servir le glissement, retiré au jalon 21, lot 2. */
  const kA = Math.max(0, dec - 1);
  const kB = Math.min(s.n - 1, dec + FEN);

  // La fenêtre visible, pour tout ce qui s'écrit.
  const w = trancher(s, dec, Math.min(s.n, dec + FEN));

  /* Les montants et les libellés de l'axe. Ils tombent sur les six heures, et
     minuit porte le nom du jour plutôt qu'un « 00 h » qui ne dit pas lequel. */
  const montants = [];
  for (let k = kA; k <= kB; k++) {
    if (s.heure[k] % 6 !== 0) continue;
    montants.push([k, s.heure[k] === 0 ? jourCourt(s.jour[k]) : heureTxt(s.heure[k])]);
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
      if (b < kA || a > kB) continue;
      o += `<rect class="mg-nuit" x="${u(X(a))}" y="${u(y0)}" `
        + `width="${u(X(b + 1) - X(a))}" height="${u(hl)}"/>`;
    }
    /* Minuit se trace dans chaque voie, plus marqué que les autres
       montants. Le trait continu posé derrière toute la pile, du 28 septembre
       2026, traversait aussi les titres et les phrases : relevé dans le
       simulateur le 3 octobre 2026, il s'arrête désormais aux tracés. */
    for (const [k] of montants) {
      o += `<line class="${s.heure[k] === 0 ? "mg-mp" : "mg-mont"}" x1="${u(X(k))}" `
        + `y1="${u(y0)}" x2="${u(X(k))}" y2="${u(y1)}"/>`;
    }
    return o;
  };

  /* Le passé de la journée est tracé, mais en retrait : la série commence à
     minuit, et « il a fait combien ce matin » se lit sans rien demander de plus.
     Un voile à la couleur de la carte l'éloigne sans le cacher. */
  const passe = (y0, y1) => (s.ici <= 0 || s.ici <= kA ? ""
    : `<rect class="mg-passe" x="${u(X(kA))}" y="${u(y0)}" `
      + `width="${u(X(Math.min(s.ici, kB + 1)) - X(kA))}" height="${u(y1 - y0)}"/>`);

  /* Le repère de l'heure en cours, sur les sept voies. Calée sur maintenant, la
     fenêtre commence à cette heure : le repère tombe alors sur le bord gauche du
     cadre, où il se lit comme un filet de cadre et ne dit plus rien. Il ne
     paraît donc qu'une fois la fenêtre déplacée. */
  const repere = (y0, y1) => {
    if (s.ici <= dec || s.ici < kA || s.ici > kB) return "";
    const x = u(X(s.ici));
    /* Deux traits pour un seul repère. Il traverse sept voies, des lavis de
       nuit, des aires pleines et des barres : une gaine à la couleur de la carte
       le détache de tout ce qu'il croise, comme le liseré des noms de seuil.
       Pointillé et à demi transparent, il se perdait dans le tracé. */
    return `<line class="mg-ici-g" x1="${x}" y1="${u(y0)}" x2="${x}" y2="${u(y1)}"/>`
      + `<line class="mg-ici" x1="${x}" y1="${u(y0)}" x2="${x}" y2="${u(y1)}"/>`;
  };

  const pts = (vals, y0, y1, mn, mx) => {
    const o = [];
    for (let k = kA; k <= kB; k++) {
      o.push(`${u(X(k + 0.5))},${u(y1 - ((vals[k] - mn) / ((mx - mn) || 1)) * (y1 - y0))}`);
    }
    return o.join(" ");
  };

  const aire = (vals, y0, y1, mn, mx) =>
    `M${u(X(kA + 0.5))},${u(y1)} L${pts(vals, y0, y1, mn, mx).replace(/ /g, " L")} `
    + `L${u(X(kB + 0.5))},${u(y1)} Z`;

  const yDe = (v, y0, y1, mn, mx) => y1 - ((v - mn) / ((mx - mn) || 1)) * (y1 - y0);

  /* La phrase qui dit ce que l'ombre porte. Sans elle, deux bandes grises sous
     une courbe ne se lisent pas : elles passent pour un effet de dessin. Le
     chiffre nommé est l'écart le plus large de la fenêtre, non celui de l'heure
     en cours, qui est toujours petit et ne dirait rien. */
  const phraseOmbre = (cle, unite, unites) => {
    const q = ens && ens.q[cle];
    if (!q) return "";
    let kw = -1, large = 0;
    for (let k = dec; k < Math.min(s.n, dec + FEN); k++) {
      if (q.mini[k] === null || q.maxi[k] === null) continue;
      const e = q.maxi[k] - q.mini[k];
      if (e > large) { large = e; kw = k; }
    }
    if (kw < 0) return "";
    const n = Math.round(large);
    return ` L'ombre porte les ${ens.membres || 40} scénarios de la source, `
      + `écartés de ${n} ${n >= 2 ? unites : unite} au plus large vers ${HJ(kw)}.`;
  };

  /* Ce que le comptage des scénarios ajoute sur la pluie, et que la probabilité
     affichée ne sait pas dire : la quantité et son étalement.

     Mesuré et comparé avant d'être écrit : la probabilité de la source et la
     part des scénarios mouillés s'accordent à dix points près sur quatre-vingt-
     douze pour cent des heures, et rien ne dit lequel tombe le plus juste là où
     ils divergent. La phrase ne pose donc pas une seconde probabilité à côté de
     la première, elle parle de millimètres. Relevé à Brest le 29 août à six
     heures, la source annonçait quatre-vingt-trois pour cent et un virgule un
     millimètre quand la médiane des scénarios donnait un virgule cinq et le plus
     arrosé quatre virgule six.

     L'heure nommée est la plus arrosée que les scénarios envisagent dans la
     fenêtre : c'est celle sur laquelle une décision se prend. */
  const phraseLame = () => {
    const q = ens && ens.q.mm;
    if (!q) return "";
    let kw = -1, pointe = 0;
    for (let k = dec; k < Math.min(s.n, dec + FEN); k++) {
      if (q.maxi[k] === null || q.maxi[k] === undefined) continue;
      if (q.maxi[k] > pointe) { pointe = q.maxi[k]; kw = k; }
    }
    if (kw < 0 || pointe < LAME) return "";
    const med = q.med[kw];
    return ` Sur les ${ens.membres || 40} scénarios, la moitié `
      + (med < LAME ? `n'en donnent aucune vers ${HJ(kw)}`
        : `donnent moins de ${nombreFr(med)} mm vers ${HJ(kw)}`)
      + `, le plus arrosé ${nombreFr(pointe)} mm.`;
  };

  /* Une bande entre deux séries, pour l'enveloppe des scénarios. Elle se dessine
     par tronçons : l'ensemble ne porte pas les journées écoulées et s'arrête où
     il s'arrête, et coudre ses bords manquants à zéro aurait tiré la bande au
     bas de la voie. Un tronçon d'un seul point ne se peint pas, une bande sans
     largeur n'étant rien.

     L'étendue des quarante scénarios déborde l'échelle, laquelle est prise sur
     la prévision servie : l'élargir aurait aplati la courbe d'un quart pour
     loger une bande qui n'est pas une valeur à lire mais une marge à voir. Ce
     qui déborde sort du cadre et la découpe le retient, ce qui est la bonne
     lecture : au delà de l'échelle, on ne sait plus. */
  const enveloppe = (haut, bas, y0, y1, mn, mx) => {
    const Y = v => yDe(v, y0, y1, mn, mx);
    let o = "";
    let k = kA;
    while (k <= kB) {
      if (haut[k] === null || haut[k] === undefined
        || bas[k] === null || bas[k] === undefined) { k++; continue; }
      let j = k;
      while (j + 1 <= kB && haut[j + 1] !== null && haut[j + 1] !== undefined
        && bas[j + 1] !== null && bas[j + 1] !== undefined) j++;
      if (j > k) {
        const av = [], ar = [];
        for (let i = k; i <= j; i++) {
          av.push(`${u(X(i + 0.5))},${u(Y(haut[i]))}`);
          ar.unshift(`${u(X(i + 0.5))},${u(Y(bas[i]))}`);
        }
        o += `<path d="M${av.join(" L")} L${ar.join(" L")} Z"/>`;
      }
      k = j + 1;
    }
    return o;
  };

  /* Deux couches par voie. Le dessin glisse, l'écriture d'échelle ne glisse
     pas : un « Élevé » ou un « 20 km/h » emporté par le doigt sortirait du
     cadre alors qu'il nomme une hauteur, laquelle ne dépend pas de l'heure
     regardée. Les deux helpers ci-dessous versent donc dans une couche fixe,
     posée par `poser` au-dessus du groupe mobile, et ne rendent rien à
     l'appelant. L'ordre d'empilement des voies est ainsi conservé sans qu'aucun
     corps de voie ait à le savoir. */
  let fixe = "";

  /* Le chiffre de l'échelle, dans la gouttière : rien ne passe derrière lui.
     Deux chiffres à moins de sept points l'un de l'autre se chevauchaient et se
     lisaient « 2,8 m2,5 » : le second est écarté. La réserve se vide à chaque
     voie. */
  let prises = [];
  const chiffre = (y, txt) => {
    if (prises.some(p => Math.abs(p - y) < 7)) return "";
    prises.push(y);
    fixe += `<text class="mg-g" x="${L - 4}" y="${u(y)}" text-anchor="end">${esc(txt)}</text>`;
    return "";
  };

  // Le nom d'un seuil, dans le tracé, sur sa ligne.
  const nomSeuil = (x, y, txt) => {
    fixe += `<text class="mg-bn" x="${u(x)}" y="${u(y - 2.5)}">${esc(txt)}</text>`;
    return "";
  };

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
      // L'encre à éviter est celle qu'on voit : le tracé de la fenêtre, non
      // celui de l'horizon entier, dont la plus grande part est hors du cadre.
      for (let k = dec; k < Math.min(s.n, dec + FEN); k++) {
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

  /* Les filets horizontaux vivent dans le groupe mobile, pour rester sous les
     courbes de leur voie. Ils courent donc sur toute la bande dessinée, et non
     sur la seule largeur du cadre : bornés au cadre, le glissement en découvrait
     le bout et le filet s'arrêtait au milieu du tracé. */
  const XA = X(kA), XB = X(kB + 1);

  /* Les seuils nommés d'une échelle, avec leur filet. Seuls ceux qui tombent
     dans la fenêtre paraissent, et le premier, qui vaut zéro, n'a pas de filet :
     il serait le plancher du tracé. */
  const seuils = (cle, y0, y1, mn, mx, chiffrer, encres) => {
    const ec = (encres || []).map(([genre, vals]) =>
      [genre, vals.map(v => yDe(v, y0, y1, mn, mx))]);
    let traits = "";
    for (const [borne, nom] of ECHELLES[cle]) {
      if (borne <= mn || borne >= mx) continue;
      const y = yDe(borne, y0, y1, mn, mx);
      traits += `<line x1="${u(XA)}" y1="${u(y)}" x2="${u(XB)}" y2="${u(y)}" `
        + `stroke="currentColor" opacity=".16" stroke-dasharray="2 3"/>`;
      placerNom(y, nom, ec);
      if (chiffrer) chiffre(y + 3, chiffrer(borne));
    }
    return traits;
  };

  /* Une graduation horizontale au pas donné, sur les seules valeurs couvertes.
     `sauf` écarte les valeurs que porte déjà un seuil nommé. */
  const graduation = (y0, y1, mn, mx, pas, ecrire, sauf = []) => {
    let traits = "";
    for (let d = Math.ceil(mn / pas) * pas; d < mx; d += pas) {
      if (sauf.some(x => Math.abs(d - x) < 0.001)) continue;
      const yd = yDe(d, y0, y1, mn, mx);
      traits += `<line x1="${u(XA)}" y1="${u(yd)}" x2="${u(XB)}" y2="${u(yd)}" `
        + `stroke="currentColor" opacity=".08"/>`;
      chiffre(yd + 3, ecrire(d));
    }
    return traits;
  };

  /* La bande de symboles, au-dessus du tracé. Un dessin toutes les trois heures
     repliée, toutes les deux dépliée : plus serré, les symboles se touchent. */
  /* Le rang des symboles est calé sur l'horizon, non sur la fenêtre : compté
     depuis le bord gauche, un pas de trois heures aurait fait sauter tous les
     symboles d'un cran à chaque heure de glissement. */
  const bande = (large, faire) => {
    const pas = large ? 2 : 3;
    let o = "";
    for (let k = Math.max(1, kA); k <= kB; k++) {
      if (k % pas !== 1 % pas) continue;
      const t = faire(k);
      if (!t) continue;
      o += `<g transform="translate(${u(X(k + 0.5) - 7)},1)">${t}</g>`;
    }
    return o;
  };

  /* La flèche montre où va le vent : voir fleche.js, partagé avec la bande. */
  const flecheVent = d =>
    `<g class="mg-fl" transform="rotate(${angleFleche(d)} 7 7)">${TRACE_FLECHE}</g>`;

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

  /* Chaque valeur est centrée sur son heure, sans exception aux deux bords : la
     découpe du cadre s'en charge. Ancrées au bord, elles se recollaient au
     montant dès que le doigt les y amenait, puis repartaient au relâchement. */
  const etiq = (k, y, txt, cls) => {
    // Une valeur vide ne laisse pas d'élément derrière elle : un texte creux
    // reste un nœud dans le dessin, et la voie du ciel en portait une file.
    if (txt === "" || txt === null || txt === undefined) return "";
    return `<text class="${cls}" x="${u(X(k + 0.5))}" y="${u(y)}" `
      + `text-anchor="middle">${esc(txt)}</text>`;
  };

  /* Les valeurs heure par heure. Elles vivent dans la bande, au-dessus du
     tracé, non au-dessus de leur point : posées sur la courbe elles la
     coupaient, et sur les barres elles se chevauchaient. */
  const valeurs = (vals, ecrire, y) => {
    let o = "";
    for (let k = Math.max(1, kA); k <= kB; k++) {
      if (k % 2 !== 1) continue;
      o += etiq(k, y, ecrire(vals[k]), "mg-p");
    }
    return o;
  };

  /* La découpe du cadre. Chaque dessin porte la sienne plutôt que d'en partager
     une seule : une référence d'un fragment SVG à un autre tient dans le même
     document HTML, mais rien n'y oblige les moteurs, et le ruban a déjà payé une
     divergence de ce genre. Le rectangle déborde en hauteur, la découpe n'ayant
     à mordre que sur les côtés. */
  let nCadre = 0;
  const cadre = haut => {
    const id = `mgc${++nCadre}`;
    return [id, `<defs><clipPath id="${id}">`
      + `<rect x="${M}" y="-4" width="${P}" height="${u(haut + 8)}"/></clipPath></defs>`];
  };

  /* La hauteur dépliée est propre à la voie. L'agrandissement vaut pour une
     courbe, qui gagne du relief, il ne donne rien à une bande de densité, qui
     reste plate qu'elle fasse quarante ou cent dix points. */
  const grand = c => voieOuverte === c;
  const H = (c, base, ouvert) =>
    (grand(c) ? (ouvert || Math.round(base * ZOOM)) : base);

  const voies = [];
  let n = 0;

  const poser = (nom, droite, haut, dedans, resume, cle) => {
    const dedansFixe = fixe;
    prises = []; fixe = "";
    const val = `<span class="mg-r" data-plage="${esc(droite)}">${esc(droite)}</span>`;
    if (!haut) { voies.push(`<div class="mg-v"><p class="mg-t">${esc(nom)}${val}</p></div>`); return; }
    const g = grand(cle);
    const [id0, defs] = cadre(haut);
    /* Le voile du passé et le repère de l'heure closent le groupe mobile : ils
       glissent avec le dessin et couvrent tout ce qui y a été posé. L'écriture
       d'échelle, elle, vient après, hors du groupe, et reste lisible. */
    const dessin = `<svg class="mg-s" viewBox="0 0 ${L} ${haut}" aria-hidden="true">${defs}`
      + `<g clip-path="url(#${id0})"><g class="mg-mob">${dedans}`
      + `${passe(0, haut)}${repere(0, haut)}</g></g>${dedansFixe}`
      /* Le montant de l'heure lue se tait sur l'heure en cours, que le repère
         marque déjà : deux traits voisins se lisaient comme un seul épais. */
      + `<line class="mg-cur" x1="${u(X(heureLue + 0.5))}" y1="0" x2="${u(X(heureLue + 0.5))}" y2="${haut}"`
      + `${heureLue === s.ici ? ' style="display:none"' : ""}/></svg>`;
    const id = `mgl${++n}`;
    /* La phrase de la voie dépliée se range derrière le « i », jalon 21,
       lot 2. */
    const bas = !resume ? "" : g ? `<details class="aide mg-aide"><summary aria-label="Explication">`
      + `<span class="aide-i" aria-hidden="true">i</span></summary><p class="mg-l" id="${id}">${esc(resume)}</p></details>`
      : `<p class="mg-l" id="${id}" hidden>${esc(resume)}</p>`;
    voies.push(`<div class="mg-v${g ? " mg-grand" : ""}" data-cle="${esc(cle)}">`
      + `<button type="button" class="mg-t mg-b" data-voie="${esc(cle)}" aria-expanded="${g}"`
      + (resume ? ` aria-controls="${id}"` : "") + ">"
      + `<span class="mg-n">${esc(nom)}<i aria-hidden="true">${g ? "−" : "+"}</i></span>`
      + `${val}</button>${dessin}${bas}</div>`);
  };

  /* Les phrases de résumé. Un fait tiré de la série, non une notice : « Écran
     solaire de 11 h à 16 h » se lit, « indice ultraviolet heure par heure » se
     saute. */
  /* Le jour se nomme depuis aujourd'hui, l'horizon portant deux journées
     écoulées et sept annoncées. */
  const HJ = k => nomJour(s, s.jour[k]) + heureTxt(s.heure[k]);
  /* Les extrêmes se cherchent dans la fenêtre visible et se disent en indice
     d'horizon : le maximum de jeudi n'a rien à faire dans la phrase d'une
     fenêtre calée sur mardi. */
  const iMax = t => dec + t.indexOf(Math.max(...t));
  const iMin = t => dec + t.indexOf(Math.min(...t));
  // Les plages de la fenêtre, ramenées aux indices de l'horizon.
  const plagesW = pred => plagesDe(w.n, pred).map(([a, b]) => [a + dec, b + dec]);
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
      for (let k = kA; k <= kB; k++) {
        const x0 = X(k), x1 = X(k + 1);
        d += `<rect x="${x0.toFixed(3)}" y="${hb}" width="${(x1 - x0).toFixed(3)}" `
          + `height="${u(h - hb)}" fill="currentColor" `
          + `opacity="${(0.06 + (s.nua[k] / 100) * 0.4).toFixed(3)}" `
          + `shape-rendering="crispEdges"/>`;
      }
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
      d += seuils("nua", y0, y1, 0, 100, v => `${v}`, [["aire", s.nua]]);
      d += `<path d="${aire(s.nua, y0, y1, 0, 100)}" fill="currentColor" opacity=".16"/>`;
      d += `<polyline points="${pts(s.nua, y0, y1, 0, 100)}" fill="none" stroke="currentColor" `
        + `stroke-width="1.7" stroke-linejoin="round"/>`;
      /* Un ciel dégagé n'a pas de chiffre : une file de zéros se lisait comme du
         bruit, et le symbole du soleil dit déjà tout. */
      d += valeurs(s.nua, v => (v >= 5 ? Math.round(v) : ""), hs + 9);
    }
    d += bande(g, k => icoTemps(icoCiel(s.code[k], s.clair[k]), "mg-ic", 14));
    /* Le premier basculement du ciel dans la fenêtre : c'est lui qu'on cherche
       en ouvrant la voie, non la moyenne de la fenêtre. */
    const seuil = 60;
    let bascule = -1;
    for (let k = 1; k < w.n; k++) {
      if ((w.nua[k - 1] < seuil) !== (w.nua[k] < seuil)) { bascule = dec + k; break; }
    }
    poser("Ciel", `${bornes(w.nua)} %, ${motDe("nua", Math.max(...w.nua))} au plus`, h, d,
      bascule < 0
        ? `Ciel ${motDe("nua", w.nua[0])} sur toute la fenêtre.`
        : `Ciel ${motDe("nua", w.nua[0])} jusqu'à ${HJ(bascule)}, `
          + `${motDe("nua", s.nua[bascule])} ensuite.`, cle);
  }

  // ---- 2. Température, ressenti et point de rosée ----
  {
    const cle = "t";
    const g = grand(cle);
    const h = H(cle, H_VOIE);
    const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
    const marge = (h - hb - (g ? H_TEMP * ZOOM : H_TEMP)) / 2;
    const y0 = hb + marge, y1 = h - marge;
    /* L'échelle est commune à tout l'horizon, non propre à la fenêtre : recalée
       à chaque glissement, la courbe se serait déformée sous le doigt et deux
       journées n'auraient plus été comparables. Elle est donc prise sur les sept
       jours, une fois pour toutes. */
    /* Les quartiles entrent dans l'échelle, l'étendue non. Les premiers serrent
       la courbe et ne la déplacent guère ; la seconde l'aurait aplatie d'un
       quart pour loger une bande qui n'est pas une valeur à lire. */
    const tous = [...s.t, ...s.res, ...s.ros];
    if (ens?.q.t) {
      for (const c of ["bas", "haut"]) {
        for (const v of ens.q.t[c]) if (v !== null && v !== undefined) tous.push(v);
      }
    }
    let mn = Math.min(...tous), mx = Math.max(...tous);
    if (mx - mn < 4) { const c = (mn + mx) / 2; mn = c - 2; mx = c + 2; }
    const pas = mx - mn > 24 ? 10 : mx - mn > 10 ? 5 : 2;
    const tr = graduation(y0, y1, mn, mx, pas, d => `${Math.round(d)}°`);

    /* La rampe se pose deux fois. En hauteur elle remplit la colonne du
       thermomètre, froide en bas, chaude en haut, et l'aire y puise sa teinte à
       la hauteur de chaque point. En largeur elle colore la courbe elle-même,
       heure par heure : à seize heures le trait est de la couleur de seize
       heures. */
    const arretsY = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = mx - f * (mx - mn);
      return `<stop offset="${f}" stop-color="${couleurT(v)}"/>`;
    }).join("");
    const arretsX = [];
    for (let k = kA; k <= kB; k++) {
      arretsX.push(`<stop offset="${((k - kA) / Math.max(1, kB - kA)).toFixed(4)}" `
        + `stop-color="${couleurT(s.t[k])}"/>`);
    }
    const defs = `<defs>`
      + `<linearGradient id="mgTy" x1="0" y1="${u(y0)}" x2="0" y2="${u(y1)}" `
      + `gradientUnits="userSpaceOnUse">${arretsY}</linearGradient>`
      + `<linearGradient id="mgTx" x1="${u(X(kA + 0.5))}" y1="0" x2="${u(X(kB + 0.5))}" y2="0" `
      + `gradientUnits="userSpaceOnUse">${arretsX.join("")}</linearGradient></defs>`;

    let d = defs + fond(hb, h) + tr;
    /* L'enveloppe des scénarios, sous les courbes et au-dessus du lavis de nuit.
       Deux bandes : l'étendue des quarante membres, puis la moitié centrale.
       La première dit ce qui est possible, la seconde ce qui est probable, et
       leur superposition fait un dégradé sans qu'aucune n'ait à en porter un.
       Elles s'élargissent avec l'échéance, ce qui est tout le propos. */
    if (ens?.q.t) {
      d += `<g class="mg-sc-e">`
        + `${enveloppe(ens.q.t.maxi, ens.q.t.mini, y0, y1, mn, mx)}</g>`;
      d += `<g class="mg-sc-q">`
        + `${enveloppe(ens.q.t.haut, ens.q.t.bas, y0, y1, mn, mx)}</g>`;
    }
    d += `<path d="${aire(s.t, y0, y1, mn, mx)}" fill="url(#mgTy)" opacity=".28"/>`;
    d += `<polyline points="${pts(s.ros, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".3" stroke-dasharray="3 2"/>`;
    d += `<polyline points="${pts(s.res, y0, y1, mn, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1" opacity=".42"/>`;
    d += `<polyline points="${pts(s.t, y0, y1, mn, mx)}" fill="none" stroke="url(#mgTx)" `
      + `stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const kx = iMax(w.t), kn = iMin(w.t);
    d += marque(kx, yDe(s.t[kx], y0, y1, mn, mx)) + marque(kn, yDe(s.t[kn], y0, y1, mn, mx));
    if (g) d += valeurs(s.t, v => `${Math.round(v)}°`, hs + 9);
    /* La phrase dit ce que l'ombre porte. Sans elle, deux bandes grises sous une
       courbe ne se lisent pas : elles passent pour un effet de dessin. Le
       chiffre nommé est l'écart le plus large de la fenêtre, non celui de
       l'heure en cours, qui vaut un demi-degré et ne dirait rien. */
    const mot = phraseOmbre("t", "degré", "degrés");
    poser("Température", `${bornes(w.t)}°`, h, d,
      `Minimum ${Math.round(s.t[kn])}° vers ${HJ(kn)}, maximum ${Math.round(s.t[kx])}° `
      + `vers ${HJ(kx)}. Trait fin le ressenti, pointillé le point de rosée.${mot}`, cle);
  }

  // ---- 3. Pluie ----
  {
    const cle = "mm";
    const g = grand(cle);
    const tot = w.mm.reduce((a, b) => a + b, 0);
    /* La voie ne se dessine que s'il pleut dans la fenêtre, jalon 21, lot 2 :
       sans glissement, la pile ne saute plus sous le doigt, et une voie vide
       tenait une grande hauteur pour rien. */
    const h = Math.max(...w.mm) >= SEUIL_LAME ? H(cle, 48) : 0;
    const rx = Math.round(Math.max(...w.pb));
    const pointe = Math.max(...w.mm);
    const droite = tot >= SEUIL_LAME
      ? `${nombreFr(tot)} mm, ${motDe("mm", pointe)}`
      : rx >= SEUIL_RISQUE ? `risque ${rx} %` : "aucune";
    if (!h) { poser("Pluie", droite, 0); }
    else {
      const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
      const y0 = hb + 3, y1 = h - 3;
      // Échelle commune à l'horizon, comme pour la température.
      const mx = Math.max(1, Math.max(...s.mm) * 1.15);
      let d = fond(hb, h);
      /* Les bandes nommées tiennent lieu de graduation : une lame horaire en
         millimètres n'est pas un nombre qu'on porte en tête, « modérée » l'est. */
      d += seuils("mm", y0, y1, 0, mx, null, [["aire", s.mm]]);
      /* Le risque passe derrière les barres, en aire très faible : deux
         questions sur une voie, combien et quelle chance. En pointillé par
         dessus, il traçait un trapèze qu'on prenait pour une seconde lame. */
      if (Math.max(...s.pb) >= SEUIL_RISQUE) {
        d += `<path d="${aire(s.pb, y0, y1, 0, 100)}" fill="currentColor" opacity=".12"/>`;
      }
      for (let k = kA; k <= kB; k++) {
        if (s.mm[k] < SEUIL_LAME) continue;
        const hh = Math.max(1.5, (s.mm[k] / mx) * (y1 - y0));
        d += `<rect x="${u(X(k) + LA * 0.16)}" y="${u(y1 - hh)}" width="${u(LA * 0.68)}" `
          + `height="${u(hh)}" rx="1" fill="currentColor" opacity=".6"/>`;
      }
      if (g) d += valeurs(s.mm, v => (v >= SEUIL_LAME ? nombreFr(v) : ""), hs + 9);
      const quand = dire(plagesW(k => w.mm[k] >= SEUIL_LAME));
      poser("Pluie", droite, h, d, (tot < SEUIL_LAME
        ? `Aucune pluie sur la fenêtre. Risque maximal ${rx} %. `
          + `L'aire pâle derrière les barres porte le risque, de zéro à cent pour cent.`
        : `${nombreFr(tot)} mm attendus, ${quand}. Risque maximal ${rx} %. `
          + `L'aire pâle derrière les barres porte le risque, de zéro à cent pour cent.`)
        + phraseLame(), cle);
    }
  }

  // ---- 4. Vent et rafales ----
  {
    const cle = "v";
    const g = grand(cle);
    const h = H(cle, H_VOIE);
    const hs = h >= MIN_BANDE ? H_SYM : 0, hv = g ? H_VAL : 0, hb = hs + hv;
    const y0 = hb + 5, y1 = h - 4;
    /* Les quartiles de la rafale entrent dans l'échelle, l'étendue non, comme
       sur la température : l'y faire entrer aurait écrasé les deux tracés vers
       le bas de la voie. */
    const hautsR = ens?.q.raf
      ? ens.q.raf.haut.filter(v => v !== null && v !== undefined) : [];
    const mx = Math.max(30, Math.max(...s.raf, ...hautsR) * 1.08);
    let d = fond(hb, h);
    /* L'enveloppe se pose sur la rafale et non sur le vent moyen. C'est la
       rafale qui décide, c'est elle que la règle des faits marquants regarde et
       que le maximum de la voie marque ; et le vent moyen est déjà tracé en
       aire pleine, sous laquelle une bande n'aurait pas paru. */
    if (ens?.q.raf) {
      d += `<g class="mg-sc-e">`
        + `${enveloppe(ens.q.raf.maxi, ens.q.raf.mini, y0, y1, 0, mx)}</g>`;
      d += `<g class="mg-sc-q">`
        + `${enveloppe(ens.q.raf.haut, ens.q.raf.bas, y0, y1, 0, mx)}</g>`;
    }
    // Les bandes nommées tiennent lieu de graduation : cinq chiffres de plus
    // dans la gouttière ne diraient rien que « modéré » ne dise déjà.
    // C'est la rafale qui recouvre, elle passe au-dessus du vent.
    d += seuils("v", y0, y1, 0, mx, v => `${v}`, [["aire", s.v], ["trait", s.raf]]);
    /* La rafale est l'enveloppe, le vent est le corps. Le pointillé disait la
       même chose une troisième fois : la position, au-dessus, et le
       remplissage, plein contre nu, suffisent à les distinguer. */
    d += `<path d="${aire(s.v, y0, y1, 0, mx)}" fill="currentColor" opacity=".14"/>`;
    d += `<polyline points="${pts(s.raf, y0, y1, 0, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.3" opacity=".55" stroke-linejoin="round"/>`;
    d += `<polyline points="${pts(s.v, y0, y1, 0, mx)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`;
    const kr = iMax(w.raf);
    d += marque(kr, yDe(s.raf[kr], y0, y1, 0, mx));
    if (hs) d += bande(g, k => flecheVent(s.dir[k]));
    if (g) d += valeurs(s.v, v => Math.round(v), hs + 9);
    const rafMax = Math.round(Math.max(...w.raf));
    const fortes = plagesW(k => w.raf[k] >= 40);
    poser("Vent", `${bornes(w.v)} km/h, ${motDe("v", Math.max(...w.v))}`, h, d,
      (fortes.length
        ? `Rafales au-dessus de quarante ${dire(fortes)}, jusqu'à ${rafMax} km/h. `
          + `Vent ${duCardinal(w.dir[0])} en début de fenêtre.`
        : `Vent ${duCardinal(w.dir[0])} en début de fenêtre, rafales jusqu'à ${rafMax} km/h `
          + `vers ${HJ(kr)}. Les flèches montrent où va le vent.`)
      + phraseOmbre("raf", "km/h", "km/h"), cle);
  }

  // ---- 5. Indice ultraviolet ----
  {
    const cle = "uv";
    const g = grand(cle);
    const mxUV = Math.max(...w.uv);
    const h = mxUV >= 0.5 ? H(cle, 48) : 0;
    if (!h) { poser("Indice UV", "nul", 0); }
    else {
      const hs = 0, hv = g ? H_VAL : 0, hb = hs + hv;
      const y0 = hb + 3, y1 = h - 3;
      const mx = Math.max(3, Math.ceil(Math.max(...s.uv)));
      let d = fond(hb, h);
      d += seuils("uv", y0, y1, 0, mx, v => `${v}`, [["aire", s.uv]]);
      for (let k = kA; k <= kB; k++) {
        if (s.uv[k] < 0.1) continue;
        const hh = Math.max(1.2, (s.uv[k] / mx) * (y1 - y0));
        d += `<rect x="${u(X(k) + LA * 0.16)}" y="${u(y1 - hh)}" width="${u(LA * 0.68)}" `
          + `height="${u(hh)}" rx="1" fill="${couleurUV(s.uv[k])}"/>`;
      }
      const ku = iMax(w.uv);
      d += marque(ku, yDe(s.uv[ku], y0, y1, 0, mx));
      if (g) d += valeurs(s.uv, v => (v >= 0.5 ? nombreFr(v) : ""), hs + 9);
      const forts = plagesW(k => w.uv[k] >= 3);
      poser("Indice UV",
        mxUV >= 0.5 ? `${nombreFr(mxUV)} au plus, ${motDe("uv", mxUV)}` : "nul", h, d,
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
    d += seuils("hum", y0, y1, mn, 100, v => `${v}`, [["aire", s.hum]]);
    d += `<path d="${aire(s.hum, y0, y1, mn, 100)}" fill="currentColor" opacity=".14"/>`;
    d += `<polyline points="${pts(s.hum, y0, y1, mn, 100)}" fill="none" stroke="currentColor" `
      + `stroke-width="1.7" stroke-linejoin="round"/>`;
    const kh = iMax(w.hum);
    d += marque(kh, yDe(s.hum[kh], y0, y1, mn, 100));
    if (g) d += valeurs(s.hum, v => Math.round(v), hs + 9);
    const satures = plagesW(k => w.hum[k] >= 90);
    poser("Humidité", `${bornes(w.hum)} %, ${motDe("hum", Math.max(...w.hum))} au plus`, h, d,
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
    const kx = iMax(w.pres), kn = iMin(w.pres);
    d += marque(kx, yDe(s.pres[kx], y0, y1, mn, mx)) + marque(kn, yDe(s.pres[kn], y0, y1, mn, mx));
    chiffre(y0 + 4, `${Math.round(mx)}`);
    chiffre(y1, `${Math.round(mn)}`);
    /* La tendance heure par heure, en flèches : c'est le sens du mouvement
       qu'on demande à une pression, non sa valeur absolue. */
    if (hs) {
      d += bande(g, k => flecheTend(k === 0 ? 0 : s.pres[k] - s.pres[Math.max(0, k - 3)]));
    }
    if (g) d += valeurs(s.pres, v => Math.round(v), hs + 9);
    /* La pression de l'heure lue au repos, l'heure en cours ou midi du jour
       choisi, et la tendance des six heures qui suivent, la règle de la tuile
       de l'accueil depuis le 3 octobre 2026 : le ruban écrivait la valeur du
       début de sa fenêtre, quatre heures avant maintenant, avec sa propre
       règle, et contredisait la tuile. */
    const kp = s.ici >= dec && s.ici < dec + FEN ? s.ici : Math.min(s.n - 1, dec + 12);
    const tend = tendancePression(s.pres, kp) || "stable";
    const ecart = Math.max(...w.pres) - Math.min(...w.pres);
    poser("Pression", `${Math.round(s.pres[kp])} hPa, ${tend}`, h, d,
      ecart < 2
        ? `Stable autour de ${Math.round(s.pres[kp])} hPa sur la fenêtre : pas de changement annoncé.`
        : `${Math.round(ecart)} hPa d'écart sur la fenêtre, creux vers ${HJ(kn)}. `
          + `Une baisse marquée annonce une dégradation.`, cle);
  }

  /* Le choix du jour, jalon 21, lot 2, décision de Jérôme du 3 octobre 2026 :
     des boutons remplacent les deux flèches et le glissement de côté, que le
     doigt déclenchait sans le vouloir et qui décalait la fenêtre d'une durée
     sans repère. « Maint. » cale la fenêtre sur l'heure en cours ; chaque
     jour suivant la cale sur son minuit, tant que l'horizon porte la fenêtre
     entière. Tous les boutons tiennent sur une ligne, sans défilement. */
  const jours = [];
  for (let k = s.ici + 1; k + FEN <= s.n; k++) if (s.heure[k] === 0) jours.push(k);
  const JOURS_SEM = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const bouton = (k, haut, bas, dit, actif, attr) => `<button type="button" class="mg-j${actif ? " mg-j-on" : ""}" ${attr}`
    + ` aria-pressed="${actif}" aria-label="${esc(dit)}"><span>${esc(haut)}</span><b>${esc(bas)}</b></button>`;
  const nav = `<div class="mg-nav mg-jours" style="--n:${jours.length + 1}">`
    + bouton(s.ici, "Maint.", heureTxt(s.heure[Math.max(0, s.ici)]), "Maintenant", ancre, 'data-maintenant="1"')
    + jours.map(k => {
      const d = new Date(`${s.jour[k]}T12:00`);
      const nom = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      return bouton(k, JOURS_SEM[d.getDay()], String(d.getDate()), nomJour(s, s.jour[k]).trim() === "demain" ? `Demain, ${nom}` : nom,
        !ancre && dec === k, `data-jour="${k}"`);
    }).join("")
    + `</div>`;

  /* Le découpage par jour, demandé par Jérôme le 28 septembre 2026. Un trait
     continu à chaque minuit traverse toute la pile des voies, titres compris,
     sur un calque posé derrière elles à la même échelle horizontale ; il glisse
     avec le dessin puisqu'il porte, lui aussi, un groupe mobile. Et un bandeau
     collant, en tête du ruban, garde sous la barre de tête le nom du jour et
     les heures de la journée pendant qu'on descend dans les voies. */
  const minuits = [];
  const graduations = [];
  for (let k = kA; k <= kB; k++) {
    if (s.heure[k] === 0) minuits.push(k);
    else if (s.heure[k] % 3 === 0) graduations.push(k);
  }
  const H_BANDEAU = 34;
  const [idB, defsB] = cadre(H_BANDEAU);
  /* L'axe unique du ruban depuis le 3 octobre 2026 : les axes posés sous
     certaines voies écrivaient « dim » et « 06 h » là où le bandeau écrivait
     « Demain » et « 3 h ». Les heures s'écrivent ici comme partout dans
     l'application, « 03 h ». Un libellé ne s'écrit que s'il tient entier dans
     le cadre : coupé au bord, il se lisait « 2 h » ou « Lundi 5 ». Les
     largeurs sont estimées d'après la taille des caractères. */
  const dedansCadre = (x0, x1) => x0 >= M - 0.5 && x1 <= M + P + 0.5;
  const LJ = t => t.length * 6.9, LH = t => t.length * 5.4;
  const minuitsVus = minuits.filter(k => X(k) >= M && X(k) <= M + P);
  const nomsMinuit = minuitsVus.filter(k => dedansCadre(X(k) + 4, X(k) + 4 + LJ(jourBandeau(s, s.jour[k]))));
  /* Le jour du bord gauche est écrit à la marge, sauf si le nom d'un minuit
     tombe trop près pour que les deux tiennent. */
  const nomGauche = jourBandeau(s, s.jour[dec]);
  const premier = nomsMinuit[0];
  const gaucheTient = premier === undefined || X(premier) - M >= LJ(nomGauche) + 10;
  const jourGauche = !gaucheTient || (premier !== undefined && X(premier) - M < 1) ? ""
    : `<text class="mg-bj" x="${u(M + 2)}" y="13">${esc(nomGauche)}</text>`;
  const heuresVues = graduations.filter(k => {
    const t = heureTxt(s.heure[k]), x0 = X(k) - LH(t) / 2, x1 = X(k) + LH(t) / 2;
    return dedansCadre(x0, x1);
  });
  const ici = s.ici >= dec && s.ici < dec + FEN
    ? `<circle class="mg-ici-p" cx="${u(X(s.ici))}" cy="${H_BANDEAU - 3}" r="2.8"/>` : "";
  const bandeau = `<div class="mg-bandeau"><svg class="mg-bd" viewBox="0 0 ${L} ${H_BANDEAU}" aria-hidden="true">${defsB}`
    + `<g clip-path="url(#${idB})"><g class="mg-mob">`
    + minuitsVus.map(k => `<line class="mg-bm" x1="${u(X(k))}" y1="0" x2="${u(X(k))}" y2="${H_BANDEAU}"/>`).join("")
    + nomsMinuit.map(k => `<text class="mg-bj" x="${u(X(k) + 4)}" y="13">${esc(jourBandeau(s, s.jour[k]))}</text>`).join("")
    + heuresVues.map(k => `<line class="mg-bt" x1="${u(X(k))}" y1="${H_BANDEAU - 7}" x2="${u(X(k))}" y2="${H_BANDEAU}"/>`
      + `<text class="mg-bh" x="${u(X(k))}" y="${H_BANDEAU - 10}">${heureTxt(s.heure[k])}</text>`).join("")
    + ici + `</g></g>${jourGauche}</svg>`
    + `<div class="mg-lu" aria-live="polite">${bulle(s, heureLue)}</div></div>`;
  return `${nav}${bandeau}<div class="mg">${voies.join("")}</div>`;
}

/* Lecture au doigt. Le montant est posé dès le dessin, replié : le faire naître
   au toucher obligerait à recomposer le dessin à chaque déplacement. */
export function brancher(bloc, surVoie) {
  /* La colonne posée dit sa vraie largeur : si elle dément l'estimation du
     rendu, un seul rendu de correction suit. Au second, la largeur mesurée est
     celle que le dessin porte déjà, et rien ne se refait. */
  if (Math.abs(largeurVoulue() - L) >= 8) { requestAnimationFrame(() => surVoie()); return; }
  const s = serie;
  if (!s) return;
  const FEN = fenetre();
  const dec = decalage;
  const X = k => M + ((k - dec) / FEN) * P;

  /* La lecture, jalon 21, lot 2 : la bulle sous l'axe et le montant de
     chaque voie suivent l'heure lue, qui reste posée après le geste. */
  const lu = bloc.querySelector(".mg-lu");
  const lire = k => {
    heureLue = k;
    if (lu) lu.innerHTML = bulle(s, k);
    const x = u(X(k + 0.5));
    for (const cur of bloc.querySelectorAll(".mg-cur")) {
      cur.setAttribute("x1", x); cur.setAttribute("x2", x);
      cur.style.display = k === s.ici ? "none" : "";
    }
  };

  const kDe = ev => {
    const b = ev.currentTarget.getBoundingClientRect();
    const rel = ((ev.clientX - b.left) / b.width) * L;
    return Math.max(dec, Math.min(Math.min(s.n, dec + FEN) - 1, dec + Math.floor(((rel - M) / P) * FEN)));
  };

  /* Deux issues pour un appui, jalon 21, lot 2. Un toucher bref lit l'heure
     touchée ; un déplacement à l'horizontale fait suivre la lecture au doigt,
     à la verticale la page défile. La lecture reste posée au relâchement.
     L'appui maintenu d'un quart de seconde que demandait la lecture ne se
     devinait pas : un toucher ne faisait rien. Le glissement de la fenêtre a
     disparu, remplacé par le choix du jour.

     `touch-action: pan-y` laisse le navigateur mener le défilement vertical,
     et nous réserve l'horizontale. */
  const TANGENTE = Math.tan(40 * Math.PI / 180);
  const SEUIL = 8;

  for (const svg of bloc.querySelectorAll(".mg-s, .mg-bd")) {
    let x0 = 0, y0 = 0, mode = null, kAppui = 0, actif = false;

    svg.addEventListener("pointerdown", ev => {
      x0 = ev.clientX; y0 = ev.clientY; mode = null; actif = true;
      kAppui = kDe(ev);
    });

    svg.addEventListener("pointermove", ev => {
      if (!actif || !ev.buttons) return;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (mode === null) {
        if (Math.hypot(dx, dy) < SEUIL) return;
        mode = Math.abs(dy) <= Math.abs(dx) * TANGENTE ? "lit" : "defile";
        if (mode === "defile") return;
        try { svg.setPointerCapture(ev.pointerId); } catch { /* souris déjà prise */ }
      }
      if (mode !== "lit") return;
      ev.preventDefault();
      lire(kDe(ev));
    });

    const fin = () => {
      if (actif && mode === null) lire(kAppui);
      actif = false; mode = null;
    };
    svg.addEventListener("pointerup", fin);
    svg.addEventListener("pointercancel", () => { actif = false; mode = null; });
  }

  for (const b of bloc.querySelectorAll(".mg-b")) {
    b.addEventListener("click", () => { ouvrir(b.dataset.voie); surVoie(); });
  }

  for (const b of bloc.querySelectorAll("[data-jour]")) {
    b.addEventListener("click", () => { poserJour(Number(b.dataset.jour)); surVoie(); });
  }

  for (const b of bloc.querySelectorAll("[data-maintenant]")) {
    b.addEventListener("click", () => { auMaintenant(); heureLue = -1; surVoie(); });
  }
}
