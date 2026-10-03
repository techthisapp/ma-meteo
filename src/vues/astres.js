/* Le ciel de l'accueil, le Soleil et la Lune : bandeaux, trajectoires, ruban de la lumière, nuits. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { nombreFr, hhmm, jourLong, esc } from "../horloge.js";
import * as P from "../previsions.js";
import { liste } from "../ecritures.js";
import * as Reglages from "../reglages.js";
import * as Astres from "../astres.js";
import * as Feu from "../feu.js";
import * as Relief from "../relief.js";
import * as Temps from "../temps.js";
import { anglePhase, hm, rangeeAstre, valeur, versCardinal, aide } from "./communs.js";

/* ---------- Le soleil ---------- */

/* Le bandeau du ciel.

   Il occupe toute la largeur et passe sous la barre de tête : c'est le seul
   endroit de l'application où le contenu monte jusqu'au bord haut. Sa couleur
   vient de la hauteur du Soleil, non du thème de l'appareil : un ciel de midi
   reste clair en thème sombre, sans quoi midi ressemblerait à minuit. */

const CIELS = {
  nuit: ["#0A1120", "#16203A"],
  aube: ["#1E2E52", "#C6764A"],
  jour: ["#4F8FC4", "#BBD9EE"],
  soir: ["#22325A", "#C2643F"],
};

const enRVB = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

const ecritRVB = v => `rgb(${v[0]} ${v[1]} ${v[2]})`;

const melange = (a, b, t) => {
  const [r1, g1, b1] = enRVB(a), [r2, g2, b2] = enRVB(b);
  const v = (x, y) => Math.round(x + (y - x) * t);
  return [v(r1, r2), v(g1, g2), v(b1, b2)];
};

/* Le sol se déduit du bas du ciel par assombrissement : une bande ardoise fixe
   ferait nuit à midi, et un sol clair ferait jour à minuit. */
const assombrir = (v, k) => v.map(x => Math.round(x * k));

export function cielDe(hauteur, montant) {
  const bord = montant ? CIELS.aube : CIELS.soir;
  let de, vers, t;
  if (hauteur <= -12) { de = CIELS.nuit; vers = CIELS.nuit; t = 0; }
  else if (hauteur < 2) { de = CIELS.nuit; vers = bord; t = (hauteur + 12) / 14; }
  else if (hauteur < 20) { de = bord; vers = CIELS.jour; t = (hauteur - 2) / 18; }
  else { de = CIELS.jour; vers = CIELS.jour; t = 0; }
  const haut = melange(de[0], vers[0], t);
  const bas = melange(de[1], vers[1], t);
  const borne = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  return {
    haut: ecritRVB(haut), bas: ecritRVB(bas),
    // Les composantes servent aussi à teindre les nuages, qui prennent leur
    // couleur du ciel : elles sont donc rendues telles quelles.
    hautRVB: haut, basRVB: bas,
    solHaut: ecritRVB(assombrir(bas, 0.80)), sol: ecritRVB(assombrir(bas, 0.66)),
    nuit: borne(-hauteur, 2, 12),
    jour: borne(hauteur, -4, 4),
    chaud: borne(25 - hauteur, 0, 25),
    // Un pour un ciel de plein jour : c'est lui qui pâlit la Lune.
    clarte: borne(hauteur, -8, 6),
  };
}

/* Étoiles réparties par hachage : une suite arithmétique dessinait une
   diagonale. Elles ne paraissent qu'au-dessous de l'horizon. */
const ETOILES = (() => {
  const bruit = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  let out = "";
  for (let k = 0; k < 46; k++) {
    out += `<i style="left:${(bruit(k + 1) * 98).toFixed(1)}%;`
      + `top:${(bruit(k + 71) * 70).toFixed(1)}%;`
      + `animation-delay:${(bruit(k + 131) * 3.4).toFixed(1)}s"></i>`;
  }
  return out;
})();

/* Ordonnée du disque dans le panneau, tirée de sa hauteur. L'horizon est à
   quatre-vingt-cinq pour cent, le zénith à treize. */
const ordonnee = hauteur => 85 - Math.max(-14, Math.min(90, hauteur)) / 90 * (85 - 13);

/* Abscisse du disque, tirée de son azimut. L'heure ne convient pas : deux
   astres dans un même ciel doivent partager la même règle, et l'heure ne dit
   rien de la place de la Lune, qui se lève cinquante minutes plus tard chaque
   jour. L'arc couvert va de l'est-nord-est à l'ouest-nord-ouest, ce qui contient
   les levers et les couchers aux latitudes françaises en toute saison. */
const abscisse = azimut => {
  const az = ((azimut % 360) + 360) % 360;
  return Math.max(3, Math.min(97, (az - 55) / 250 * 100));
};

// Le panneau est plus large que haut : un écart vertical compte moins qu'un
// écart horizontal de même valeur en pour cent.
const PANNEAU = 306 / 390;

/* Le panneau, commun aux trois bandeaux. Il ne sait rien des astres qu'il
   porte : chacun lui passe sa place et sa toile. Il en prend un, deux, ou
   aucun, le dernier de la liste étant devant. */
/* `clarte` dit sur quoi le titre s'écrit : zéro pour un ciel de nuit, près d'un
   pour un plafond de plein jour. Les voiles de lisibilité et l'ombre du titre
   s'y règlent. */
function panneauCiel(c, astres, temps = "", clarte = 0) {
  return `<div class="ci" style="`
    + `--ci-haut:${c.haut};--ci-bas:${c.bas};--ci-sol-haut:${c.solHaut};--ci-sol:${c.sol};`
    + `--ci-nuit:${c.nuit.toFixed(2)};--ci-jour:${c.jour.toFixed(2)};`
    + `--ci-clarte:${clarte.toFixed(3)}">`
    + `<div class="ci-etoiles" aria-hidden="true">${ETOILES}</div>`
    + astres.filter(a => a.corps).map(a =>
      `<div class="ci-astre${a.sous ? " sous" : ""}" `
      + `style="--ax:${a.x.toFixed(1)}%;--ay:${a.y.toFixed(1)}%">${a.corps}</div>`).join("")
    + temps
    + `<div class="ci-sol"></div><div class="ci-horizon"></div>`
    + `<div class="ci-voile-haut"></div><div class="ci-voile-bas"></div>`
    + `</div>`;
}

/* Qui se montre dans le ciel de l'accueil.

   Le Soleil dès qu'il n'est pas trop bas sous l'horizon, la lueur du crépuscule
   comptant encore pour lui. La Lune dès qu'elle est levée, de jour comme de
   nuit, et de nuit même couchée, faute de quoi le panneau serait vide.

   Deux réserves de jour, chacune sa raison. Un croissant trop mince est une
   Lune trop proche du Soleil pour être vue, un huitième éclairé valant environ
   quarante degrés d'écart. Et deux disques ne se recouvrent pas : leurs rayons
   font ensemble près d'un tiers de la largeur du panneau.

   La règle est sortie de la vue pour être éprouvée sur des cas que la charge
   d'essai ne contient pas, une Lune neuve de plein jour et deux astres qui se
   frôlent. */
export function astresVus(ps, pl, eclairee) {
  const ecart = Math.hypot(
    (abscisse(ps.azimut) - abscisse(pl.azimut)) / 100,
    ((ordonnee(ps.hauteur) - ordonnee(pl.hauteur)) / 100) * PANNEAU);
  const soleil = soleilVu(ps.hauteur);
  const lune = soleil
    ? pl.hauteur > Astres.SEUIL.lune && eclairee > 0.12 && ecart > 0.30
    : true;
  return { soleil, lune, ecart };
}

/* Jusqu'où le Soleil se peint. Six degrés sous l'horizon, la fin du crépuscule
   civil : au-dessus, il éclaire encore le bas du ciel et son disque enfoncé se
   lit comme cette lueur ; en dessous, il n'y a plus rien à peindre à sa place.

   La règle sert aux trois panneaux. L'accueil l'appliquait, l'écran du Soleil
   non, et son disque restait donc allumé au ras du sol à onze heures du soir,
   sur un ciel que `cielDe` avait déjà passé en nuit pleine à moins douze degrés.
   Défaut vu sur téléphone le 29 août, à 22 h 09 sur Paris, le Soleil étant
   couché depuis une heure et quart.

   Le relais est continu : de zéro à moins six degrés le disque porte la lueur,
   de moins six à moins douze c'est le dégradé du ciel qui la porte seul, et au
   delà la nuit est pleine. */
const SOUS_HORIZON = -6;

export const soleilVu = hauteur => hauteur > SOUS_HORIZON;

const corpsSoleil = c =>
  `<canvas class="ci-feu" id="ciFeu" data-chaud="${c.chaud.toFixed(3)}" `
  + `role="img" aria-label="Le Soleil dans le ciel"></canvas>`;

const corpsLune = (c, ph, pl, maintenant, g) =>
  `<canvas class="ci-lune" id="ciLune" `
  + `data-phase="${anglePhase(ph.eclairee).toFixed(1)}" `
  + `data-angle="${Astres.angleLimbe(maintenant, g.lat, g.lon).toFixed(4)}" `
  + `data-eclairee="${ph.eclairee.toFixed(3)}" data-clarte="${c.clarte.toFixed(3)}" `
  + `data-chaud="${Math.max(0, Math.min(1, (12 - pl.hauteur) / 20)).toFixed(3)}" `
  + `role="img" aria-label="La Lune dans le ciel"></canvas>`;

function bandeauCiel(g, maintenant, meridien) {
  const p = Astres.position("soleil", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const montant = meridien ? maintenant < meridien : minutes < 720;
  const c = cielDe(p.hauteur, montant);

  /* L'abscisse suit l'azimut, l'ordonnée la hauteur : le disque est à sa place,
     non sur un arc supposé.

     La teinte du feu est rendue à côté du panneau : la vignette de la sous-ligne
     la reprend, et la recalculer là-bas ferait deux fois la même règle, dont la
     part la plus fragile est de savoir si le Soleil monte ou descend. */
  return { ciel: panneauCiel(c, [{ x: abscisse(p.azimut), y: ordonnee(p.hauteur),
    sous: p.hauteur < Astres.SEUIL.soleil,
    corps: soleilVu(p.hauteur) ? corpsSoleil(c) : "" }]), chaud: c.chaud };
}

/* Le bandeau de la Lune. Le ciel est celui du Soleil : une Lune levée en plein
   jour se voit sur un ciel bleu, pâle et peu contrastée, comme dans le ciel
   réel. La Lune, elle, se place par son azimut : elle se lève à ses propres
   heures, qui reculent d'environ cinquante minutes par jour, et l'heure ne dit
   donc rien de sa position. */
function bandeauLune(g, maintenant, phase) {
  const ps = Astres.position("soleil", maintenant, g.lat, g.lon);
  const pl = Astres.position("lune", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const c = cielDe(ps.hauteur, minutes < 720);

  return panneauCiel(c, [{ x: abscisse(pl.azimut), y: ordonnee(pl.hauteur),
    sous: pl.hauteur < Astres.SEUIL.lune,
    corps: corpsLune(c, phase, pl, maintenant, g) }]);
}

/* Le bandeau de l'accueil. Même panneau que les deux autres, avec le temps
   qu'il fait peint par-dessus les astres : un nuage passe devant le Soleil, non
   derrière. Sous une couche fermée aucun disque n'est dessiné, seule reste la
   lueur diffuse à l'endroit où l'astre se tient.

   Le Soleil et la Lune partagent le ciel quand ils sont levés tous les deux, ce
   qui arrive une bonne partie du mois : la Lune se voit en plein jour, pâle,
   dès qu'elle s'écarte du Soleil. Ne montrer que l'un des deux donnait un ciel
   faux la moitié des après-midi.

   Deux réserves. Trop près du Soleil, la Lune est une Lune nouvelle noyée dans
   sa lueur : elle n'est pas dessinée, elle ne se voit pas davantage dans le vrai
   ciel, et les deux disques se recouvriraient. Et de nuit la Lune reste
   dessinée sous l'horizon, faute de quoi le panneau serait vide. */
export function bandeauAccueil(g, maintenant, p, vent) {
  const ps = Astres.position("soleil", maintenant, g.lat, g.lon);
  const pl = Astres.position("lune", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const c = cielDe(ps.hauteur, minutes < 720);
  const voile = Temps.voileDe(p);
  const visible = voile < Temps.SEUIL_VOILE;

  const xs = abscisse(ps.azimut), ys = ordonnee(ps.hauteur);
  const xl = abscisse(pl.azimut), yl = ordonnee(pl.hauteur);
  const { soleil: soleilVu, lune: luneVue } =
    astresVus(ps, pl, Astres.phase(maintenant).eclairee);

  /* L'astre pâlit et se dilue sous une couche mince : le voile est porté par le
     panneau, la toile de l'astre n'a rien à en savoir. */
  const voiler = corps => (corps && voile > 0
    ? `<div class="ci-voile" style="--voile:${voile.toFixed(2)}">${corps}</div>` : corps);

  // La Lune d'abord, le Soleil devant : c'est lui qui l'emporte s'ils se frôlent.
  const astres = [];
  if (luneVue) {
    astres.push({ x: xl, y: yl, sous: pl.hauteur < Astres.SEUIL.lune,
      corps: visible ? voiler(corpsLune(c, Astres.phase(maintenant), pl, maintenant, g)) : "" });
  }
  if (soleilVu) {
    astres.push({ x: xs, y: ys, sous: ps.hauteur < Astres.SEUIL.soleil,
      corps: visible ? voiler(corpsSoleil(c)) : "" });
  }

  /* La lueur qui traverse la couche vient du Soleil quand il est levé, de la
     Lune sinon : c'est lui qui éclaire les nuages, elle ne les éclaire qu'en
     son absence. */
  const astre = soleilVu
    ? { sorte: "soleil", x: xs / 100, y: ys / 100 }
    : { sorte: "lune", x: xl / 100, y: yl / 100 };
  const toile = `<canvas class="ci-temps" id="ciTemps" aria-hidden="true" `
    + Temps.attributs(p, c, vent, astre) + `></canvas>`;

  /* La clarté du ciel peint est rendue à côté du panneau, et non posée sur lui
     seul. Le titre et la réponse du matin sont hors du panneau, à côté de lui :
     posée sur `.ci`, la variable ne les atteignait pas et l'ombre du titre se
     calculait depuis le début sur une clarté nulle, c'est-à-dire jamais réglée.
     L'écran la pose sur le cadre, où tout ce qui est écrit sur le ciel la lit. */
  const clarte = Temps.clarteDe(c, p);
  return { ciel: panneauCiel(c, astres, toile, clarte), clarte };
}

/* La trajectoire du jour : la hauteur du Soleil de minuit à minuit. Le trait
   plein est au-dessus de l'horizon, le pointillé au-dessous. */
function trajectoire(courbe, lever, coucher, minutes, opts = {}) {
  const W = 342, H = 170, G = 24, D = 16, BAS = 20;
  const hx = m => G + (m / 1440) * (W - G - D);
  const hy = h => {
    const t = (Math.max(-30, Math.min(90, h)) + 30) / 120;
    return (H - BAS) - t * (H - BAS - 10);
  };
  const sol = hy(0);

  const trait = pts => pts.map((p, k) =>
    `${k ? "L" : "M"}${hx(p.m).toFixed(1)},${hy(p.h).toFixed(1)}`).join(" ");

  /* Un astre peut être levé en début et en fin de journée, avec un coucher au
     milieu : la courbe se découpe en tronçons contigus, sans quoi un trait
     droit relierait les deux passages en rasant l'horizon. */
  const troncons = dedans => {
    const out = []; let cur = [];
    for (const p of courbe) {
      if (dedans(p)) cur.push(p);
      else { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  const hauts = troncons(p => p.h >= 0);
  const bas = troncons(p => p.h < 0);

  const aire = hauts.map(t => `${trait(t)} L${hx(t[t.length - 1].m).toFixed(1)},${sol.toFixed(1)} `
    + `L${hx(t[0].m).toFixed(1)},${sol.toFixed(1)} Z`).join(" ");

  let ici = courbe[0];
  for (const p of courbe) if (Math.abs(p.m - minutes) < Math.abs(ici.m - minutes)) ici = p;
  const cx = hx(minutes), cy = hy(ici.h);
  const teinte = opts.teinte === "lune" ? "tr-lune" : "";

  const deuxCh = n => String(n).padStart(2, "0");
  const grille = [0, 6, 12, 18, 24].map(h =>
    `<line class="tr-grille" x1="${hx(h * 60).toFixed(1)}" y1="10" `
    + `x2="${hx(h * 60).toFixed(1)}" y2="${(H - BAS).toFixed(1)}"/>`
    + `<text class="tr-txt" x="${hx(h * 60).toFixed(1)}" y="${H - 6}" text-anchor="middle">`
    + `${deuxCh(h)} h</text>`).join("");

  const echelle = [0, 30, 60, 90].map(v =>
    `<text class="tr-txt" x="2" y="${(hy(v) + 3).toFixed(1)}">${v}°</text>`).join("");

  const borne = m => m === null ? ""
    : `<circle class="tr-borne" cx="${hx(m).toFixed(1)}" cy="${sol.toFixed(1)}" r="3.4"/>`;

  return `<svg class="tr ${teinte}" viewBox="0 0 ${W} ${H}" role="img" `
    + `aria-label="${esc(opts.titre || "Hauteur du Soleil dans le ciel, de minuit à minuit")}">`
    + `<defs><linearGradient id="grJour" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${opts.teinte === "lune" ? "var(--ic-lune)" : "var(--ic-soleil)"}" stop-opacity=".26"/>`
    + `<stop offset="1" stop-color="${opts.teinte === "lune" ? "var(--ic-lune)" : "var(--ic-soleil)"}" stop-opacity=".04"/>`
    + `</linearGradient></defs>`
    + grille + echelle
    + (aire ? `<path class="tr-jour" d="${aire}"/>` : "")
    + (opts.fond ? `<path class="tr-fond" d="${trait(opts.fond)}"/>` : "")
    + bas.map(t => `<path class="tr-ligne-nuit" d="${trait(t)}"/>`).join("")
    + hauts.map(t => `<path class="tr-ligne" d="${trait(t)}"/>`).join("")
    + `<line class="tr-sol" x1="${G}" y1="${sol.toFixed(1)}" x2="${W - D}" y2="${sol.toFixed(1)}"/>`
    + borne(lever) + borne(coucher)
    + `<line class="tr-fil" x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" `
    + `x2="${cx.toFixed(1)}" y2="${(H - BAS).toFixed(1)}"/>`
    + `<circle class="tr-halo" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9"/>`
    + `<circle class="tr-astre" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4"/>`
    + `</svg>`;
}

/* ---------- Le ruban de la lumière ----------

   Les vingt-quatre heures du jour, teintées par la hauteur du Soleil. Cinq
   états se suivent du plein jour à la nuit noire, séparés par les trois seuils
   de crépuscule. Les bornes se placent par interpolation entre deux points de
   la courbe : à cinq minutes de pas, la hauteur varie assez peu pour que la
   droite suffise. */

const SEUILS_LUM = [-0.833, -6, -12, -18];

const ZONES_LUM = ["jour", "civil", "naut", "astro", "nuit"];

const zoneLum = h => {
  for (let z = 0; z < SEUILS_LUM.length; z++) if (h >= SEUILS_LUM[z]) return z;
  return SEUILS_LUM.length;
};

export function bandesLum(courbe) {
  const out = [];
  let m0 = courbe[0].m;
  let z = zoneLum(courbe[0].h);
  const poser = (m1, zone) => {
    if (m1 > m0 + 0.01) out.push({ a: m0, b: m1, z: zone });
    m0 = Math.max(m0, m1);
  };

  for (let k = 1; k < courbe.length; k++) {
    const a = courbe[k - 1], b = courbe[k];
    const za = zoneLum(a.h), zb = zoneLum(b.h);
    if (za === zb) continue;
    const pas = zb > za ? 1 : -1;
    /* Une même paire de points peut franchir plusieurs seuils aux latitudes
       hautes : ils se traitent dans l'ordre où le temps les rencontre. */
    const franchis = [];
    for (let q = za; q !== zb; q += pas) franchis.push(pas > 0 ? q : q - 1);
    for (const q of franchis) {
      const t = (SEUILS_LUM[q] - a.h) / (b.h - a.h);
      const part = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
      poser(a.m + part * (b.m - a.m), z);
      z += pas;
    }
  }
  poser(courbe[courbe.length - 1].m, z);
  return out;
}

function rubanLumiere(courbe, minutes) {
  const W = 342, H = 54, G = 4, D = 4, Y = 8, EP = 30;
  const x = m => G + (m / 1440) * (W - G - D);

  const rects = bandesLum(courbe).map(b =>
    `<rect class="lm lm-${ZONES_LUM[b.z]}" x="${x(b.a).toFixed(1)}" y="${Y}" `
    + `width="${Math.max(0.6, x(b.b) - x(b.a)).toFixed(1)}" height="${EP}"/>`).join("");

  const deuxCh = n => String(n).padStart(2, "0");
  const traits = [6, 12, 18].map(h =>
    `<line class="lm-grille" x1="${x(h * 60).toFixed(1)}" y1="${Y}" `
    + `x2="${x(h * 60).toFixed(1)}" y2="${Y + EP}"/>`).join("");
  const heures = [0, 6, 12, 18, 24].map((h, k) =>
    `<text class="lm-txt" x="${x(h * 60).toFixed(1)}" y="${H - 2}" `
    + `text-anchor="${k === 0 ? "start" : k === 4 ? "end" : "middle"}">`
    + `${deuxCh(h)} h</text>`).join("");

  const cx = x(Math.max(0, Math.min(1440, minutes)));
  const marque = `<path class="lm-marque" d="M${(cx - 4).toFixed(1)},0 `
    + `L${(cx + 4).toFixed(1)},0 L${cx.toFixed(1)},6 Z"/>`
    + `<line class="lm-fil" x1="${cx.toFixed(1)}" y1="${Y}" `
    + `x2="${cx.toFixed(1)}" y2="${Y + EP}"/>`;

  return `<svg class="lm-r" viewBox="0 0 ${W} ${H}" role="img" `
    + `aria-label="Ruban de la lumière, de minuit à minuit">`
    + `<defs><clipPath id="lmClip">`
    + `<rect x="${G}" y="${Y}" width="${W - G - D}" height="${EP}" rx="7"/></clipPath></defs>`
    + `<g clip-path="url(#lmClip)">${rects}${traits}</g>`
    + marque + heures + `</svg>`;
}

export function vueSoleil() {
  const c = P.chargeCourante();
  const i = P.iJour();
  const g = Reglages.lire();
  if (!c || i < 0 || !Reglages.situe()) {
    return { titre: "Le soleil", dedans: `<div class="carte"><p class="vide">Indisponible.</p></div>` };
  }

  const d = c.daily;
  const lever = new Date(d.sunrise[i]).getTime();
  const coucher = new Date(d.sunset[i]).getTime();
  const maintenant = new Date();
  const duree = d.daylight_duration[i];
  const veille = i > 0 ? d.daylight_duration[i - 1] : duree;
  const delta = Math.round((duree - veille) / 60);

  /* Les heures de lever et de coucher viennent d'Open-Meteo, qui fait foi ici.
     Les azimuts, le midi solaire et les crépuscules se calculent sur l'appareil :
     la source ne les porte pas. */
  const e = Astres.evenements("soleil", maintenant, g.lat, g.lon);
  const cr = Astres.crepuscules(maintenant, g.lat, g.lon);
  const courbe = Astres.courbe("soleil", maintenant, g.lat, g.lon, 5);

  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const enMinutes = ms => (ms - minuit.getTime()) / 60000;
  const minutes = enMinutes(maintenant.getTime());

  /* Le jour de passage du seuil de dix heures, dans un sens ou dans l'autre.
     C'est la borne au-delà de laquelle la lumière change de régime. */
  let passage = null;
  const SEUIL = 10 * 3600;
  for (let k = i; k < d.time.length - 1; k++) {
    const a = d.daylight_duration[k], b = d.daylight_duration[k + 1];
    if (a === null || b === null) continue;
    if ((a < SEUIL && b >= SEUIL) || (a >= SEUIL && b < SEUIL)) {
      passage = { date: d.time[k + 1], sens: b >= SEUIL ? "franchit" : "repasse sous" };
      break;
    }
  }

  /* Le prochain évènement, celui que le bandeau annonce en grand. Passé les
     dernières lueurs, c'est l'aube du lendemain. */
  const suite = [
    [cr.civil.matin, "Premières lueurs"],
    [new Date(lever), "Lever du soleil"],
    [e.meridien, "Midi solaire"],
    [new Date(coucher), "Coucher du soleil"],
    [cr.civil.soir, "Dernières lueurs"],
  ].filter(([x]) => x);
  const prochain = suite.find(([x]) => x > maintenant)
    || (cr.civil.matin ? [cr.civil.matin, "Premières lueurs demain"] : null);

  const p = Astres.position("soleil", maintenant, g.lat, g.lon);
  const etat = p.hauteur >= -0.833
    ? `Soleil à ${Math.round(p.hauteur)}° au-dessus de l'horizon`
    : p.hauteur >= -6 ? "Crépuscule civil, il fait encore clair"
      : p.hauteur >= -12 ? "Crépuscule nautique, le jour s'est retiré"
        : p.hauteur >= -18 ? "Crépuscule astronomique, dernière lueur"
          : "Nuit noire, aucune lueur du Soleil";

  /* Course du jour : les instants du disque, dans l'ordre où ils se vivent. Les
     crépuscules ont leur propre carte, où les trois seuils se comparent ; les
     redire ici en ferait lire deux fois les mêmes heures. */
  const chrono = [
    ["lever", "Lever", e.azimutLever === null ? null : versCardinal(e.azimutLever),
      [hm(lever)], new Date(lever)],
    ["midi", "Midi solaire",
      e.hauteurMax === null ? null : `${Math.round(e.hauteurMax)}° de hauteur`,
      [e.meridien ? hm(e.meridien.getTime()) : "—"], e.meridien],
    ["coucher", "Coucher", e.azimutCoucher === null ? null : versCardinal(e.azimutCoucher),
      [hm(coucher)], new Date(coucher)],
  ];

  const lignes = chrono.map(rangeeAstre(maintenant, prochain)).join("");

  /* Les trois durées qui se partagent les vingt-quatre heures : le disque
     au-dessus de l'horizon, la clarté lueurs comprises, et la part sans aucune
     lueur. La nuit noire se mesure d'un soir à l'aube du lendemain : celle du
     jour même en tient lieu, à deux ou trois minutes près. */
  const clarte = cr.civil.matin && cr.civil.soir
    ? Math.round((cr.civil.soir - cr.civil.matin) / 1000) : null;
  const nuitNoire = cr.astronomique.matin && cr.astronomique.soir
    ? 86400 - Math.round((cr.astronomique.soir - cr.astronomique.matin) / 1000) : 0;

  const mesures = `<div class="tm">`
    + `<div><i>Durée du jour</i><b>${hhmm(duree)}</b>`
    + `<em>${delta === 0 ? "comme hier"
      : `${Math.abs(delta)} min de ${delta > 0 ? "plus" : "moins"} qu'hier`}</em></div>`
    + `<div><i>Clarté</i><b>${clarte === null ? "—" : hhmm(clarte)}</b>`
    + `<em>lueurs comprises</em></div>`
    + `<div><i>Nuit noire</i><b>${nuitNoire > 0 ? hhmm(nuitNoire) : "aucune"}</b>`
    + `<em>${nuitNoire > 0 ? "sans lueur du Soleil" : "le Soleil reste trop haut"}</em></div>`
    + `</div>`;

  /* Les trois seuils, du plus clair au plus sombre, chacun avec son heure du
     matin et son heure du soir. Les deux colonnes disent de quel côté de la
     journée tombe chaque heure : « 05:45 et 21:45 » ne le disait pas. */
  const CREPS = [
    ["civil", "Crépuscule civil", "on distingue encore sans lampe", cr.civil],
    ["naut", "Crépuscule nautique", "l'horizon reste visible en mer", cr.nautique],
    ["astro", "Crépuscule astronomique", "au-delà, la nuit noire", cr.astronomique],
  ];

  const heureCrep = d => {
    if (!d) return `<b class="cp-h">—</b>`;
    const ici = prochain && prochain[0].getTime() === d.getTime() ? " courant" : "";
    return `<b class="cp-h${ici}">${hm(d.getTime())}</b>`;
  };

  const creps = `<div class="cp">`
    + `<span class="cp-t"></span><span class="cp-t">Le matin</span><span class="cp-t">Le soir</span>`
    + CREPS.map(([cle, nom, quoi, v]) =>
      `<span class="cp-n"><i class="cp-p p-${cle}"></i>`
      + `<span><b>${esc(nom)}</b><em>${esc(quoi)}</em></span></span>`
      + (v.matin || v.soir
        ? heureCrep(v.matin) + heureCrep(v.soir)
        : `<span class="cp-abs">le Soleil ne descend pas si bas</span>`)).join("")
    + `</div>`;

  const bdCiel = bandeauCiel(g, maintenant, e.meridien);

  return {
    titre: "Le soleil",
    plein: `<div class="plein">${bdCiel.ciel}`
      + `<div class="plein-titre">`
      + (prochain ? `<i>${esc(prochain[1])}</i><b>${hm(prochain[0].getTime())}</b>` : `<b>Le soleil</b>`)
      /* Le disque, à côté de son état, comme la Lune porte le sien à côté du
         nom de sa phase. Dans le ciel du bandeau le Soleil est à sa place
         réelle : couché, il ne s'y voit pas. La vignette le montre toujours, et
         les deux écrans jumeaux commencent alors leur sous-ligne au même
         endroit. */
      + `<em><canvas class="pt-astre" id="ptSoleil" `
      + `data-chaud="${bdCiel.chaud.toFixed(3)}" aria-hidden="true"></canvas>`
      + `<span>${esc(etat)}</span></em></div></div>`,

    /* Jalon 20, lot 3 : les trois durées passent au-dessus de la trajectoire,
       elles se lisent les premières. */
    dedans: `<div class="carte ci-durees">${mesures}`
      + (passage ? `<p class="note">La durée du jour ${esc(passage.sens)} dix heures `
        + `le ${esc(jourLong(passage.date))}.</p>` : "")
      + `</div>`

      + `<div class="section"><h2>Trajectoire</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Hauteur dans le ciel</h3>`
      + `<em>Maintenant ${hm(maintenant.getTime())}</em></div>`
      + trajectoire(courbe, enMinutes(lever), enMinutes(coucher), minutes)
      + `</div></div>`

      + `<div class="section"><h2>Course du jour</h2>`
      + `<div class="carte groupe-plat ch">${lignes}</div></div>`

      + `<div class="section"><h2>Les crépuscules</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Du jour à la nuit noire</h3></div>`
      + rubanLumiere(courbe, minutes)
      + creps
      + aide("Le Soleil passe à 6° sous l'horizon pour le crépuscule civil, 12° pour le nautique, "
        + "18° pour l'astronomique ; ensuite, la nuit est noire.")
      + `</div></div>`,

    brancher(bloc) {
      Feu.vignette(bloc.querySelector("#ptSoleil"),
        Number(bloc.querySelector("#ptSoleil")?.dataset.chaud));
      Feu.poser(bloc.querySelector("#ciFeu"));
    },
  };
}

/* ---------- La lune ---------- */

export function vueLune() {
  const g = Reglages.lire();
  if (!Reglages.situe()) {
    return { titre: "La lune", dedans: `<div class="carte"><p class="vide">Indisponible.</p></div>` };
  }

  const maintenant = new Date();
  const p = Astres.phase(maintenant);
  const e = Astres.evenements("lune", maintenant, g.lat, g.lon);
  const l = Astres.lunaison(maintenant);
  const phases = Astres.prochainesPhases(maintenant);

  const courbe = Astres.courbe("lune", maintenant, g.lat, g.lon, 10);
  const fond = Astres.courbe("soleil", maintenant, g.lat, g.lon, 10);

  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const enMinutes = ms => (ms - minuit.getTime()) / 60000;
  const minutes = enMinutes(maintenant.getTime());

  /* Durée au-dessus de l'horizon : la somme des tronçons levés. Un lever du
     soir et un coucher du matin appartiennent à deux passages, leur écart ne
     dirait rien. La courbe suffit à la mesurer au quart d'heure près. */
  let leves = 0;
  for (let k = 1; k < courbe.length; k++) {
    const a = courbe[k - 1].h > Astres.SEUIL.lune;
    const b = courbe[k].h > Astres.SEUIL.lune;
    leves += (a && b) ? 10 : (a || b) ? 5 : 0;
  }
  const duree = leves ? leves * 60 : null;

  /* Le prochain évènement, dans la même grammaire que l'écran du soleil : ce
     qui vient, et à quelle heure.

     Les trois évènements de la Lune ne se suivent pas dans un ordre fixe, la
     journée pouvant commencer avec la Lune déjà levée : ils se trient. Et quand
     la journée n'en garde plus aucun, c'est le premier du lendemain qui vient,
     recalculé plutôt que repris : les heures de la Lune reculent d'environ
     cinquante minutes par jour. */
  const trier = ev => [
    [ev.lever, "Lever de la lune"],
    [ev.meridien, "Passage au méridien"],
    [ev.coucher, "Coucher de la lune"],
  ].filter(([x]) => x).sort((a, b) => a[0] - b[0]);

  let prochain = trier(e).find(([x]) => x > maintenant) || null;
  if (!prochain) {
    const lendemain = new Date(minuit.getFullYear(), minuit.getMonth(), minuit.getDate() + 1);
    const p2 = trier(Astres.evenements("lune", lendemain, g.lat, g.lon))[0];
    if (p2) prochain = [p2[0], `${p2[1]}, demain`];
  }

  const pct = Math.round(p.eclairee * 100);
  const etat = `${p.nom}, ${pct} % éclairée`;

  /* Course du jour : les instants du disque seulement, comme sur l'écran du
     soleil. Les durées sont des mesures, elles ont leur ligne à part. */
  const aucun = [{ doux: "aucun ce jour" }];
  const chrono = [
    ["lever", "Lever", e.lever ? versCardinal(e.azimutLever) : null,
      e.lever ? [hm(e.lever.getTime())] : aucun, e.lever],
    ["meridien", "Passage au méridien",
      e.hauteurMax === null ? null : `${Math.round(e.hauteurMax)}° de hauteur`,
      e.meridien ? [hm(e.meridien.getTime())] : aucun, e.meridien],
    ["coucher", "Coucher", e.coucher ? versCardinal(e.azimutCoucher) : null,
      e.coucher ? [hm(e.coucher.getTime())] : aucun, e.coucher],
  ];

  const lignes = chrono.map(rangeeAstre(maintenant, prochain)).join("");

  /* La part éclairée est déjà dite dans le ciel, en toutes lettres et en
     image : la redire ici ferait lire deux fois la même chose. La place revient
     au temps passé au-dessus de l'horizon, qui ne se lit nulle part ailleurs. */
  const mesures = `<div class="tm">`
    + `<div><i>Au-dessus de l'horizon</i><b>${duree === null ? "—" : hhmm(duree)}</b>`
    + `<em>de minuit à minuit</em></div>`
    + `<div><i>Âge</i><b>${nombreFr(p.age)} j</b><em>depuis la nouvelle</em></div>`
    + `<div><i>Lunaison</i><b>${nombreFr(l.duree)} j</b><em>du cycle en cours</em></div>`
    + `</div>`;

  /* Les quatre prochaines phases : dessins géométriques, non toiles. À quarante
     points, un relief ne se verrait pas et coûterait quatre textures. */
  const bande = `<div class="ph">` + phases.map(x => {
    const eclairee = /Nouvelle/.test(x.nom) ? 0 : /Pleine/.test(x.nom) ? 1 : 0.5;
    const court = x.nom.replace("Nouvelle lune", "Nouvelle").replace("Pleine lune", "Pleine")
      .replace("Premier quartier", "1<sup>er</sup> quartier").replace("Dernier quartier", "Dern. quartier");
    const quand = x.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    /* Le délai autant que la date : « 20 août » ne dit pas si c'est dans deux
       jours ou dans trois semaines. Le jour même se dit, il ne se compte pas. */
    const jours = Math.round((x.date - maintenant) / 86400000);
    const delai = jours <= 0 ? "aujourd'hui" : jours === 1 ? "demain" : `dans ${jours} j`;
    return `<div>${Astres.dessinPhase(eclairee, /Premier/.test(x.nom), 18)}`
      + `<b>${court}</b><em>${esc(quand)}</em><u>${esc(delai)}</u></div>`;
  }).join("") + `</div>`;

  return {
    titre: "La lune",
    plein: `<div class="plein">${bandeauLune(g, maintenant, p)}`
      + `<div class="plein-titre">`
      + (prochain ? `<i>${esc(prochain[1])}</i><b>${hm(prochain[0].getTime())}</b>`
        : `<b>La lune</b>`)
      /* La forme du disque, à côté de son nom. Dans le ciel du bandeau la Lune
         est à sa place réelle : sous l'horizon, basse derrière le sol ou pâlie
         par le jour, elle ne se voit pas. La vignette la montre toujours. */
      + `<em><canvas class="pt-astre" id="ptLune" `
      + `data-phase="${anglePhase(p.eclairee).toFixed(1)}" `
      + `data-angle="${Astres.angleLimbe(maintenant, g.lat, g.lon).toFixed(4)}" `
      + `data-eclairee="${p.eclairee.toFixed(3)}" aria-hidden="true"></canvas>`
      + `<span>${esc(etat)}</span></em></div></div>`,

    /* Jalon 20, lot 3 : les trois mesures au-dessus de la trajectoire. */
    dedans: `<div class="carte ci-durees">${mesures}</div>`

      + `<div class="section"><h2>Trajectoire</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Hauteur dans le ciel</h3>`
      + `<em>Maintenant ${hm(maintenant.getTime())}</em></div>`
      + trajectoire(courbe, e.lever ? enMinutes(e.lever.getTime()) : null,
        e.coucher ? enMinutes(e.coucher.getTime()) : null, minutes,
        { fond, teinte: "lune", titre: "Hauteur de la Lune dans le ciel, de minuit à minuit" })
      + `<div class="tr-leg"><span><i></i>Lune</span><span><i class="s"></i>Soleil</span></div>`
      + `</div></div>`

      + `<div class="section"><h2>Course du jour</h2>`
      + `<div class="carte groupe-plat ch ch-lune">${lignes}</div></div>`

      + `<div class="section"><h2>Prochaines phases</h2>`
      /* Le calcul sur l'appareil se dit dans les sources des réglages,
         jalon 20. */
      + `<div class="carte">${bande}</div></div>`,

    brancher(bloc) {
      Relief.poser(bloc.querySelector("#ciLune"));
      Relief.vignette(bloc.querySelector("#ptLune"));
    },
  };
}

/* Le tracé, commun au bandeau et au plein écran. Le bandeau se passe des
   points cardinaux : sa ligne de titre occupe le bas, là où ils tombaient, et
   l'heure recouvrait « SE ». Sa vue, fixe, regarde vers le sud, ce que la note
   sous le bandeau dit. */
/* La nuit parcourue par le curseur, du crépuscule civil du soir à l'aube
   civile : c'est le temps où le ciel se regarde. Rend null quand le Soleil ne
   se couche pas assez, ce qui n'arrive pas aux latitudes de la France. */
export function nuitCivile(maintenant, g) {
  const jour = 86400000;
  const cr = t => Astres.crepuscules(new Date(t), g.lat, g.lon).civil;
  const c = cr(maintenant.getTime());
  if (c.matin && maintenant < c.matin) {
    const veille = cr(maintenant.getTime() - jour);
    return veille.soir ? { debut: veille.soir, fin: c.matin } : null;
  }
  if (!c.soir) return null;
  const d = cr(maintenant.getTime() + jour);
  return d.matin ? { debut: c.soir, fin: d.matin } : null;
}

/* ---------- Sous le bandeau des étoiles ----------

   Trois sections, décidées le 21 septembre 2026. « Cette nuit » répond à la
   question qu'on se pose en ouvrant cet écran, voir les étoiles ce soir : la
   nuit noire, les nuages, la Lune. « À voir ce soir » donne les constellations
   les plus hautes au début de la nuit noire. « Étoiles filantes » donne le
   prochain grand essaim. Tout se calcule sur place, sans source nouvelle : la
   nébulosité vient de la prévision déjà chargée. */

/* La nuit noire en cours ou à venir, du crépuscule astronomique du soir à
   celui du matin. Rend null quand elle ne vient pas. */
export function nuitNoire(maintenant, g) {
  const jour = 86400000;
  const cr = t => Astres.crepuscules(new Date(t), g.lat, g.lon).astronomique;
  const c = cr(maintenant.getTime());
  if (c.matin && maintenant < c.matin) {
    const veille = cr(maintenant.getTime() - jour);
    return veille.soir ? { debut: veille.soir, fin: c.matin } : null;
  }
  if (!c.soir) return null;
  const d = cr(maintenant.getTime() + jour);
  return d.matin ? { debut: c.soir, fin: d.matin } : null;
}
