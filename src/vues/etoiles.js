/* La voûte étoilée et l'écran « Le ciel », qui réunit le Soleil, la Lune et les étoiles. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc } from "../horloge.js";
import * as P from "../previsions.js";
import { liste } from "../ecritures.js";
import * as Reglages from "../reglages.js";
import * as Astres from "../astres.js";
import * as Ciel from "../ciel.js";
import { hm, valeur, aide } from "./communs.js";
import { nuitCivile, nuitNoire, vueLune, vueSoleil } from "./astres.js";

/* ---------- La destination Le ciel ---------- */

/* Le soleil et la lune sont deux écrans d'un même sujet, et ils étaient déjà
   deux jumeaux : même panneau de ciel, même grand chiffre, même sous-ligne à
   vignette, mêmes rangées d'évènement. Les fondre en une destination libère la
   cinquième place de la barre d'onglets, que la carte prendra, et donne aux
   étoiles du jalon 9 leur place sans qu'il faille reprendre la navigation une
   seconde fois.

   Le sélecteur se pose en tête du contenu, sous le ciel : le ciel est le sujet,
   on choisit ensuite lequel. Il ne peut pas se poser sur la ligne du titre comme
   celui de la page « Heure par heure », ces deux écrans portant leur titre peint dans le
   ciel et non dans la coque.

   Chaque écran garde son propre corps entier. La fusion ne mêle pas deux
   contenus, elle range deux écrans sous une même porte. */
/* ---------- Les étoiles ----------

   La voûte vue depuis la commune, à l'instant présent : les étoiles, les
   figures des constellations et leurs noms.

   Hors plein écran, l'écran suit la mise en page du Soleil et de la Lune : le
   ciel en bandeau fixe dans la partie haute, avec sa ligne de titre, et dessous
   les informations. Un toucher sur le bandeau l'ouvre en plein écran, et c'est
   là seulement que le doigt tourne la vue : un même geste sur le bandeau ne
   veut ainsi dire qu'une chose. Décidé le 21 septembre 2026.

   Sur iPhone, l'interface de plein écran du navigateur ne vaut que pour les
   vidéos : le plein écran est un calque qui couvre l'application, barre de
   navigation comprise, et respecte les bords de l'écran.

   Le fichier du ciel, 81 kilooctets comprimés, ne se charge qu'à l'ouverture de
   cet écran. Le fond reste celui d'une nuit quel que soit le thème : un ciel
   étoilé clair ne ressemble à rien. */
const CARDINAUX = [[0, "N"], [45, "NE"], [90, "E"], [135, "SE"], [180, "S"],
  [225, "SO"], [270, "O"], [315, "NO"]];

const DIRECTIONS = ["Nord", "Nord-est", "Est", "Sud-est", "Sud", "Sud-ouest", "Ouest", "Nord-ouest"];

const directionDe = az => DIRECTIONS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/* « l'est », « l'ouest », « le nord-est » : l'article suit la voyelle. */
const articleDe = d => (/^[EO]/.test(d) ? "l'" : "le ") + d.toLowerCase();

/* La visée, dite en plein écran pendant le glissement. Au-delà de 80 degrés,
   une direction ne veut plus rien dire : la vue est à la verticale. */
export const viseeDe = (az, haut) => haut > 80 ? "Au zénith"
  : `${directionDe(az)}, ${Math.round(haut)}°`;

/* La ligne de titre du bandeau, dans la grammaire du Soleil et de la Lune : le
   prochain événement du ciel. La nuit noire commence quand le Soleil passe à
   dix-huit degrés sous l'horizon. Près du solstice d'été, à la latitude de
   Paris, elle ne vient pas : l'écran le dit. */
function titreNuit(maintenant, g) {
  const c = Astres.crepuscules(maintenant, g.lat, g.lon).astronomique;
  if (c.matin && maintenant < c.matin) return ["Fin de la nuit noire", c.matin];
  if (c.soir && maintenant < c.soir) return ["Nuit noire", c.soir];
  if (!c.soir) return ["Pas de nuit noire cette nuit", null];
  const d = Astres.crepuscules(new Date(maintenant.getTime() + 86400000), g.lat, g.lon).astronomique;
  return d.matin ? ["Fin de la nuit noire", d.matin] : ["Les étoiles", null];
}

function peindreCiel(cv, vue, g, options = {}) {
  const affichage = options.affichage || Reglages.affichageCiel();
  const cardinaux = options.cardinaux !== false;
  /* Densité plafonnée à 2, comme les toiles du ciel : à 3, une carte plein écran
     d'iPhone pesait 2,5 millions de pixels par toile au lieu de 1,1. Audit du
     1er octobre 2026, constat 5.7. */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const l = cv.clientWidth, h = cv.clientHeight;
  if (!l || !h) return;
  if (cv.width !== Math.round(l * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(l * dpr); cv.height = Math.round(h * dpr);
  }
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = "#0b1220";
  c.fillRect(0, 0, l, h);
  if (!Ciel.chargees()) return;
  const unite = Math.min(l, h) / 2;
  const ecran = p => [l / 2 + p.x * unite, h / 2 + p.y * unite];
  /* L'instant du curseur, ou le moment présent quand il n'a pas bougé. */
  const date = vue.instant || new Date();
  /* Le cadre en unités de projection : un écran haut en porte plus en hauteur
     qu'en largeur, et un cadre carré laissait vide le haut du plein écran. */
  const bords = [l / 2 / unite + 0.05, h / 2 / unite + 0.05];

  const figures = Ciel.figuresVues(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, true);
  const etoiles = Ciel.etoilesVues(date, g.lat, g.lon, vue.az, vue.haut, vue.champ,
    affichage, bords, true);
  const tracer = (f, couleur, epaisseur) => {
    c.beginPath();
    f.points.forEach((p, k) => { const [x, y] = ecran(p); if (k) c.lineTo(x, y); else c.moveTo(x, y); });
    c.strokeStyle = couleur;
    c.lineWidth = epaisseur;
    c.stroke();
  };

  /* Sous l'horizon d'abord : les étoiles et les traits qui s'y trouvent se
     voient à travers l'eau posée ensuite par-dessus. Chaque étoile y est un
     disque aux bords fondus par un dégradé radial, ce qui donne le flou sans
     dépendre du filtre de la toile, que Safari ne gère que depuis peu : le
     rendu est le même partout et se vérifie dans les contrôles. L'eau filtre la
     couleur, d'où une seule teinte pâle. */
  for (const f of figures) if (f.sous) tracer(f, "rgba(140, 170, 225, 0.22)", 1);
  for (const e of etoiles) {
    if (!e.sous) continue;
    const [x, y] = ecran(e);
    const r = Ciel.rayon(e.mag, unite / 170) * 2.6 + 1;
    const flou = c.createRadialGradient(x, y, 0, x, y, r);
    flou.addColorStop(0, "rgba(205, 225, 245, 0.6)");
    flou.addColorStop(1, "rgba(205, 225, 245, 0)");
    c.fillStyle = flou;
    c.beginPath();
    c.arc(x, y, r, 0, 2 * Math.PI);
    c.fill();
  }

  /* Au-dessus : la figure désignée se détache des autres, plus claire et plus
     épaisse. */
  for (const f of figures) {
    if (f.sous) continue;
    const choisie = f.sigle === vue.sel;
    tracer(f, choisie ? "rgba(210, 225, 255, 0.95)" : "rgba(140, 170, 225, 0.45)", choisie ? 2 : 1);
  }
  for (const e of etoiles) {
    if (e.sous) continue;
    const [x, y] = ecran(e);
    c.beginPath();
    c.arc(x, y, Ciel.rayon(e.mag, unite / 170), 0, 2 * Math.PI);
    c.fillStyle = Ciel.couleur(e.ci);
    c.fill();
  }

  /* La Lune et les planètes, posées par-dessus les étoiles : plus grosses et
     nommées, elles ne se confondent pas avec elles. Celles qui sont sous
     l'horizon restent dans l'eau, pâlies comme le reste. */
  const astres = Ciel.astresVus(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, bords, true);
  c.font = "600 11px -apple-system, system-ui, sans-serif";
  c.textAlign = "center";
  c.lineJoin = "round";
  for (const a of astres) {
    const [x, y] = ecran(a);
    const r = a.cle === "lune" ? unite * 0.035 : unite * 0.012 + 1.5;
    if (a.sous) {
      const flou = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
      flou.addColorStop(0, a.cle === "lune" ? "rgba(235, 232, 216, 0.5)" : "rgba(255, 228, 175, 0.5)");
      flou.addColorStop(1, "rgba(255, 228, 175, 0)");
      c.fillStyle = flou;
      c.beginPath(); c.arc(x, y, r * 2.2, 0, 2 * Math.PI); c.fill();
      continue;
    }
    c.beginPath();
    c.arc(x, y, r, 0, 2 * Math.PI);
    c.fillStyle = a.cle === "lune" ? "#ebe8d8" : "#ffe4af";
    c.fill();
    /* Le nom reste dans le cadre, comme ceux des constellations : un nom coupé
       au bord ne se lit pas. */
    const demiA = c.measureText(a.nom).width / 2 + 4;
    const xn = Math.max(demiA, Math.min(l - demiA, x));
    const yn = y + r + 13;
    if (yn > h - 2) continue;
    c.strokeStyle = "rgba(11, 18, 32, 0.9)";
    c.lineWidth = 3;
    c.strokeText(a.nom, xn, yn);
    c.fillStyle = "rgba(245, 238, 220, 0.95)";
    c.fillText(a.nom, xn, yn);
  }

  /* Les noms, détachés des traits par un halo de la couleur du ciel, et tenus
     dans le cadre : un nom coupé au bord ne se lit pas. */
  c.font = "11px -apple-system, system-ui, sans-serif";
  c.textAlign = "center";
  c.lineJoin = "round";
  for (const n of Ciel.nomsVus(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, bords)) {
    let [x, y] = ecran(n);
    const demi = c.measureText(n.nom).width / 2 + 4;
    x = Math.max(demi, Math.min(l - demi, x));
    if (y < 14 || y > h - 4) continue;
    c.strokeStyle = "rgba(11, 18, 32, 0.9)";
    c.lineWidth = 3;
    c.strokeText(n.nom, x, y);
    c.fillStyle = "rgba(170, 190, 230, 0.8)";
    c.fillText(n.nom, x, y);
  }

  /* L'eau : l'horizon projeté, et dessous une étendue teintée, plus sombre en
     s'éloignant, à travers laquelle se devine ce qui a été peint plus haut. Une
     ligne claire marque la surface, et quelques rides qui se resserrent vers
     l'horizon donnent la profondeur. */
  const bord = [];
  for (let az = 0; az <= 360; az += 3) {
    const p = Ciel.projeter(az, 0, vue.az, vue.haut, vue.champ);
    if (p) bord.push(ecran(p));
  }
  if (bord.length > 1) {
    bord.sort((a, b) => a[0] - b[0]);
    const eau = new Path2D();
    eau.moveTo(-10, h + 10);
    for (const [x, y] of bord) eau.lineTo(x, y);
    eau.lineTo(l + 10, h + 10);
    eau.closePath();
    const surface = Math.max(0, Math.min(...bord.map(p => p[1])));
    const teinte = c.createLinearGradient(0, surface, 0, h);
    teinte.addColorStop(0, "rgba(34, 74, 104, 0.62)");
    teinte.addColorStop(1, "rgba(10, 30, 48, 0.86)");
    c.fillStyle = teinte;
    c.fill(eau);
    c.save();
    c.clip(eau);
    c.strokeStyle = "rgba(210, 230, 250, 0.05)";
    c.lineWidth = 1;
    for (let k = 1; k <= 7; k++) {
      const y = surface + k * k * 5;
      if (y > h) break;
      c.beginPath(); c.moveTo(0, y); c.lineTo(l, y); c.stroke();
    }
    c.restore();
    c.beginPath();
    bord.forEach(([x, y], k) => { if (k) c.lineTo(x, y); else c.moveTo(x, y); });
    c.strokeStyle = "rgba(180, 205, 235, 0.35)";
    c.lineWidth = 1;
    c.stroke();
  }
  c.fillStyle = "rgba(220, 230, 245, 0.9)";
  c.font = "600 12px -apple-system, system-ui, sans-serif";
  for (const [az, nom] of cardinaux ? CARDINAUX : []) {
    const p = Ciel.projeter(az, 0, vue.az, vue.haut, vue.champ);
    if (!p || Math.abs(p.x) > 1.1) continue;
    const [x, y] = ecran(p);
    if (y < 0 || y > h - 4) continue;
    c.fillText(nom, x, Math.min(y + 14, h - 6));
  }
}

/* Les heures dégagées de la nuit, d'après la nébulosité de la prévision : une
   heure compte comme dégagée sous le seuil que le reste de l'application
   retient pour un ciel dégagé. Rend la plus longue plage, ou un mot. */
export function cielDeLaNuit(nuit, charge) {
  const h = charge?.hourly;
  if (!nuit || !h?.time || !h.cloud_cover) return null;
  const heures = [];
  h.time.forEach((t, i) => {
    const d = new Date(t);
    if (d >= nuit.debut && d < nuit.fin && Number.isFinite(h.cloud_cover[i])) {
      heures.push({ d, degage: h.cloud_cover[i] <= P.SEUIL_DEGAGE });
    }
  });
  if (!heures.length) return null;
  const n = heures.filter(x => x.degage).length;
  if (n === 0) return { mot: "Couvert", sous: "toute la nuit noire" };
  if (n === heures.length) return { mot: "Dégagé", sous: "toute la nuit noire" };
  let meilleur = null, courant = null;
  for (const x of heures) {
    if (x.degage) {
      courant = courant ? { ...courant, fin: x.d } : { debut: x.d, fin: x.d };
      if (!meilleur || courant.fin - courant.debut > meilleur.fin - meilleur.debut) meilleur = courant;
    } else courant = null;
  }
  const fin = new Date(meilleur.fin.getTime() + 3600000);
  return { mot: "Dégagé", sous: `de ${hm(meilleur.debut.getTime())} à ${hm(fin.getTime())}` };
}

/* La Lune pendant la nuit noire : sa part éclairée et le temps où elle est
   levée, relevé toutes les vingt minutes. Une Lune mince ou couchée ne gêne
   pas l'observation. */
export function luneDeLaNuit(nuit, g) {
  if (!nuit) return null;
  const pas = 20 * 60000;
  let levee = 0, total = 0, premiere = null, derniere = null;
  for (let t = nuit.debut.getTime(); t <= nuit.fin.getTime(); t += pas) {
    total++;
    if (Astres.position("lune", new Date(t), g.lat, g.lon).hauteur > 0) {
      levee++;
      if (premiere === null) premiere = t;
      derniere = t;
    }
  }
  const milieu = new Date((nuit.debut.getTime() + nuit.fin.getTime()) / 2);
  const pct = Math.round(Astres.phase(milieu).eclairee * 100);
  if (!levee) return { pct, sous: "couchée toute la nuit noire", gene: false };
  const part = levee / total;
  const sous = part > 0.95 ? "levée toute la nuit noire"
    : premiere === nuit.debut.getTime() ? `couchée à ${hm(derniere)}`
    : `levée à ${hm(premiere)}`;
  return { pct, sous, gene: pct >= 25 && part >= 0.3 };
}

/* Les grands essaims d'étoiles filantes, au maximum de leur activité. Dates et
   taux horaires zénithaux de l'Organisation internationale des météores, en
   valeurs rondes : ce sont des maximums sous un ciel idéal, que la Lune et les
   lumières de la ville réduisent. */
export const ESSAIMS = [
  [1, 3, "Quadrantides", 110], [4, 22, "Lyrides", 18], [5, 6, "Êta Aquarides", 50],
  [8, 12, "Perséides", 100], [10, 8, "Draconides", 10], [10, 21, "Orionides", 20],
  [11, 17, "Léonides", 15], [12, 14, "Géminides", 150],
];

export function prochainEssaim(maintenant) {
  const an = maintenant.getFullYear();
  const jour = new Date(an, maintenant.getMonth(), maintenant.getDate());
  for (const k of [0, 1]) {
    for (const [m, d, nom, taux] of ESSAIMS) {
      const date = new Date(an + k, m - 1, d);
      if (date >= jour) return { date, nom, taux };
    }
  }
  return null;
}

const rangeeCiel = (nom, sous, val, doux = "") => `<div class="rangee">`
  + `<span class="rangee-txt"><b>${esc(nom)}</b><span>${esc(sous)}</span></span>`
  + valeur(val, doux ? { doux } : null) + `</div>`;

function infosEtoiles(maintenant, g) {
  const nuit = nuitNoire(maintenant, g);
  const ciel = cielDeLaNuit(nuit, P.chargeCourante());
  const lune = luneDeLaNuit(nuit, g);
  const essaim = prochainEssaim(maintenant);
  const jourMois = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  /* Jalon 20, lot 3 : les trois indicateurs de la nuit au format des durées
     du Soleil et de la Lune, un nom, une valeur, une précision. */
  const case_ = (nom, val, sous, cls = "") => `<div${cls ? ` class="${cls}"` : ""}><i>${esc(nom)}</i>`
    + `<b>${esc(val)}</b><em>${esc(sous)}</em></div>`;
  return `<div class="carte ci-nuit"><div class="carte-tete"><h3>Cette nuit</h3></div><div class="tm">`
    + (nuit ? case_("Nuit noire", hm(nuit.debut.getTime()), `jusqu'à ${hm(nuit.fin.getTime())}`)
      : case_("Nuit noire", "aucune", "le Soleil ne descend pas assez bas"))
    + case_("Nuages", ciel ? ciel.mot : "—", ciel ? ciel.sous : "prévision absente")
    + (lune ? case_("Lune", `${lune.pct} %`, lune.gene ? `${lune.sous}, gêne` : lune.sous, lune.gene ? "tm-gene" : "")
      : case_("Lune", "—", "position inconnue"))
    + `</div></div>`
    + `<div class="carte ci-avoir"><div class="carte-tete"><h3>À voir ce soir</h3></div>`
    + `<div id="ciAVoir"><p class="note">Calcul en cours…</p></div></div>`
    + (essaim
      ? `<div class="carte ci-filantes"><div class="carte-tete"><h3>Étoiles filantes</h3></div>`
        + rangeeCiel(essaim.nom, `jusqu'à ${essaim.taux} par heure au plus fort`,
          jourMois(essaim.date))
        + `</div>`
      : "");
}

/* Les constellations les plus hautes au début de la nuit noire, ou tout de
   suite s'il fait déjà nuit, avec leur direction. Rempli après le chargement
   du fichier du ciel. */
export function aVoirCeSoir(maintenant, g, n = 5) {
  const nuit = nuitNoire(maintenant, g);
  const instant = nuit && nuit.debut > maintenant ? nuit.debut : maintenant;
  const d = Ciel.chargees();
  if (!d) return [];
  const jj = Astres.jourJulien(instant);
  return Object.entries(d.noms)
    .map(([sigle, [nom, ra, dec]]) => ({ sigle, nom, ...Ciel.surHorizon(ra, dec, jj, g.lat, g.lon) }))
    .filter(x => x.hauteur > 20)
    .sort((a, b) => b.hauteur - a.hauteur)
    .slice(0, n)
    .map(x => ({ ...x, instant }));
}

const MENTIONS = `<p>Étoiles du catalogue HYG, version 4.1, qui réunit Hipparcos, Yale `
  + `Bright Star et Gliese, sous licence Creative Commons Attribution et partage `
  + `dans les mêmes conditions.</p><p>Figures et noms des constellations de `
  + `d3-celestial, Olaf Frohn, sous licence BSD à trois clauses.</p>`;

export function vueEtoiles() {
  const g = Reglages.lire();
  if (!Reglages.situe()) {
    return { titre: "Les étoiles", dedans: `<div class="carte"><p class="vide">Indisponible.</p></div>` };
  }
  const maintenant = new Date();
  const jour = Astres.position("soleil", maintenant, g.lat, g.lon).hauteur > -6;
  const [libelle, quand] = titreNuit(maintenant, g);
  return {
    titre: "Les étoiles",
    plein: `<div class="plein">`
      + `<div class="ci ci-voute" id="ciBandeau" role="button" tabindex="0" `
      + `aria-label="Ouvrir le ciel de ${esc(g.commune || "la commune")} en plein écran">`
      + `<canvas class="ci-toile" id="ciToile" aria-hidden="true"></canvas>`
      + `<p class="ci-etat" id="ciEtat">Chargement du ciel…</p></div>`
      + `<div class="plein-titre">`
      + (quand ? `<i>${esc(libelle)}</i><b>${hm(quand.getTime())}</b>` : `<b>${esc(libelle)}</b>`)
      + `</div></div>`,
    dedans: infosEtoiles(maintenant, g)
      + aide("Le ciel est vu vers le sud. Le toucher l'ouvre en plein écran."),
    brancher(bloc) {
      const bandeau = bloc.querySelector("#ciBandeau");
      const cv = bloc.querySelector("#ciToile");
      const etat = bloc.querySelector("#ciEtat");
      if (!cv || !bandeau) return;
      const fixe = { az: 180, haut: 40, champ: 60 };
      const tracerBandeau = () => {
        if (cv.isConnected) peindreCiel(cv, fixe, g, { cardinaux: false });
      };

      const ouvrir = () => {
        if (!Ciel.chargees() || document.getElementById("ciPleinEcran")) return;
        const vue = { ...fixe };
        /* Le curseur parcourt la nuit par pas de cinq minutes. Il part de
           l'instant présent quand il tombe dedans, du début de la nuit sinon,
           ce qui est le cas en plein jour. */
        const maintenant = new Date();
        const nuit = nuitCivile(maintenant, g)
          || { debut: new Date(maintenant.getTime() - 6 * 3600000),
               fin: new Date(maintenant.getTime() + 6 * 3600000) };
        const PAS = 5 * 60000;
        const pas = Math.max(1, Math.round((nuit.fin - nuit.debut) / PAS));
        const instantDe = k => new Date(nuit.debut.getTime() + k * PAS);
        const rang = t => Math.max(0, Math.min(pas, Math.round((t - nuit.debut) / PAS)));
        const rangDepart = rang(maintenant.getTime());
        const fe = document.createElement("div");
        fe.className = "ci-plein-ecran";
        fe.id = "ciPleinEcran";
        fe.setAttribute("role", "dialog");
        fe.setAttribute("aria-modal", "true");
        fe.setAttribute("aria-label", "Le ciel en plein écran");
        /* Le ciel se lit aussi sans le voir et sans le doigt, audit du
           1er octobre 2026, constat 4.9 : la toile porte la visée en libellé,
           des boutons tournent le regard, et la liste des constellations du
           champ ouvre leur fiche. Les boutons ne paraissent qu'au clavier,
           décision de Jérôme du 2 octobre 2026 ; VoiceOver les atteint. */
        fe.innerHTML = `<canvas class="ci-toile-pe" id="ciToilePE" role="img" aria-label="${viseeDe(vue.az, vue.haut)}"></canvas>`
          + `<p class="ci-visee" id="ciVisee" aria-live="polite">${viseeDe(vue.az, vue.haut)}</p>`
          + `<div class="ci-dirs" id="ciDirs" role="group" aria-label="Tourner le regard">`
          + [["N", "Nord"], ["E", "Est"], ["S", "Sud"], ["O", "Ouest"], ["+", "Plus haut"], ["-", "Plus bas"]]
            .map(([c, n]) => `<button type="button" class="ci-bouton" data-dir="${c}">${n}</button>`).join("")
          + `</div>`
          + `<ul class="titre-lu" id="ciObjets" aria-label="Constellations dans le champ"></ul>`
          + (jour ? `<p class="ci-jour" id="ciJour">Il fait jour : la lumière du Soleil efface ces étoiles.</p>` : "")
          + `<button type="button" class="ci-bouton ci-fermer" id="ciFermer">Fermer</button>`
          + `<button type="button" class="ci-bouton ci-sources" id="ciSources">Sources</button>`
          + `<div class="ci-curseur" id="ciBarreTemps">`
          + `<input type="range" id="ciCurseur" min="0" max="${pas}" step="1" `
          + `value="${rangDepart}" aria-label="Heure du ciel">`
          + `<span id="ciHeure">${hm(instantDe(rangDepart).getTime())}</span>`
          + `<button type="button" class="ci-bouton" id="ciMaintenant">Maintenant</button>`
          + `</div>`
          + `<div class="ci-choix" id="ciChoix" role="group" aria-label="Étoiles affichées">`
          + Ciel.AFFICHAGES.map(([cle, court, long]) => `<button type="button" `
            + `data-affichage="${cle}" aria-label="${long}" `
            + `aria-pressed="${cle === Reglages.affichageCiel()}">${court}</button>`).join("")
          + `</div>`
          + `<div class="ci-fiche" id="ciFiche" role="dialog" aria-live="polite" hidden></div>`
          + `<div class="ci-fenetre" id="ciFenetre" hidden>${MENTIONS}`
          + `<button type="button" class="ci-bouton" id="ciFenetreFermer">Fermer</button></div>`;
        document.body.appendChild(fe);
        const pe = fe.querySelector("#ciToilePE");
        const visee = fe.querySelector("#ciVisee");
        const objets = fe.querySelector("#ciObjets");
        let demande = false;
        /* La liste des constellations dont le nom tombe dans le champ, refaite à
           chaque image dessinée ; chacune ouvre sa fiche. */
        const majObjets = () => {
          const r = pe.getBoundingClientRect();
          const unite = Math.min(r.width, r.height) / 2 || 1;
          const noms = Ciel.nomsVus(vue.instant || new Date(), g.lat, g.lon, vue.az, vue.haut, vue.champ,
            [r.width / 2 / unite, r.height / 2 / unite]);
          objets.innerHTML = noms.map(n => `<li><button type="button" data-sigle="${esc(n.sigle)}">${esc(n.nom)}</button></li>`).join("");
          pe.setAttribute("aria-label", `${viseeDe(vue.az, vue.haut)}${noms.length ? `, ${noms.length} constellations` : ""}`);
        };
        const redessiner = () => {
          if (demande || !pe.isConnected) return;
          demande = true;
          requestAnimationFrame(() => { demande = false; if (pe.isConnected) { peindreCiel(pe, vue, g); majObjets(); } });
        };
        const tourner = (daz, dhaut) => {
          vue.az = ((vue.az + daz) % 360 + 360) % 360;
          vue.haut = Math.max(5, Math.min(85, vue.haut + dhaut));
          visee.textContent = viseeDe(vue.az, vue.haut);
          redessiner();
        };
        for (const b of fe.querySelectorAll("[data-dir]")) {
          b.addEventListener("click", () => {
            const d = b.dataset.dir;
            if (d === "+") tourner(0, 15);
            else if (d === "-") tourner(0, -15);
            else tourner({ N: 0, E: 90, S: 180, O: 270 }[d] - vue.az, 0);
          });
        }
        /* Les flèches du clavier tournent le regard, sauf sur le curseur de
           l'heure, qui a les siennes. */
        fe.addEventListener("keydown", ev => {
          if (ev.target.id === "ciCurseur") return;
          const d = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[ev.key];
          if (!d) return;
          ev.preventDefault();
          tourner(d[0], d[1]);
        });
        let depart = null;
        pe.addEventListener("pointerdown", ev => {
          depart = { x: ev.clientX, y: ev.clientY, az: vue.az, haut: vue.haut };
          pe.setPointerCapture?.(ev.pointerId);
        });
        pe.addEventListener("pointermove", ev => {
          if (!depart) return;
          const unite = Math.min(pe.clientWidth, pe.clientHeight) / 2;
          vue.az = ((depart.az - (ev.clientX - depart.x) / unite * vue.champ) % 360 + 360) % 360;
          vue.haut = Math.max(5, Math.min(85, depart.haut + (ev.clientY - depart.y) / unite * vue.champ));
          visee.textContent = viseeDe(vue.az, vue.haut);
          redessiner();
        });
        const curseur = fe.querySelector("#ciCurseur");
        const heure = fe.querySelector("#ciHeure");
        const poserInstant = k => {
          const t = instantDe(k);
          /* Le moment présent se rend par son absence : la carte suit alors
             l'heure qui passe. */
          vue.instant = Math.abs(t - new Date()) < PAS ? null : t;
          heure.textContent = hm(t.getTime());
          redessiner();
        };
        curseur.addEventListener("input", () => poserInstant(Number(curseur.value)));
        fe.querySelector("#ciMaintenant").addEventListener("click", () => {
          curseur.value = String(rang(Date.now()));
          poserInstant(Number(curseur.value));
        });

        const ficheEl = fe.querySelector("#ciFiche");
        const montrer = sigle => {
          vue.sel = sigle;
          if (!sigle) { ficheEl.hidden = true; redessiner(); return; }
          const quand = vue.instant || new Date();
          const f = Ciel.fiche(sigle, quand, g.lat, g.lon, nuitNoire(quand, g));
          if (!f) { ficheEl.hidden = true; return; }
          const lieu = h => h < 0 ? "sous l'horizon"
            : `${Math.round(h)}° vers ${articleDe(directionDe(f.azimut))}`;
          const vis = !f.visible ? "" : f.visible.jamais ? "pas au-dessus de 10° cette nuit"
            : f.visible.toute ? "toute la nuit noire"
            : `de ${hm(f.visible.debut.getTime())} à ${hm(f.visible.fin.getTime())}`;
          const etoile = f.brillante ? `${f.brillante.nom || f.brillante.lettre || "sans nom"}, `
            + `magnitude ${f.brillante.mag.toFixed(1).replace(".", ",")}`
            + (f.brillante.jamais ? ", ne se lève jamais ici" : "") : "";
          const mois = new Date(2026, f.moisCulmine, 1).toLocaleDateString("fr-FR", { month: "long" });
          ficheEl.innerHTML = `<p class="ci-fiche-nom">${esc(f.nom)}</p>`
            + `<p class="ci-fiche-latin">${esc(f.latin || "")}</p>`
            + `<dl><dt>Maintenant</dt><dd>${esc(lieu(f.hauteur))}</dd>`
            + (vis ? `<dt>Cette nuit</dt><dd>${esc(vis)}</dd>` : "")
            + (etoile ? `<dt>Étoile la plus brillante</dt><dd>${esc(etoile)}</dd>` : "")
            + `<dt>Au plus haut à minuit</dt><dd>en ${esc(mois)}</dd></dl>`
            + `<button type="button" class="ci-bouton" id="ciFicheFermer">Fermer</button>`;
          ficheEl.querySelector("#ciFicheFermer").addEventListener("click", () => montrer(null));
          ficheEl.hidden = false;
          redessiner();
        };
        /* Un toucher sans mouvement désigne ; un glissement tourne la vue. */
        const lacher = ev => {
          const d = depart;
          depart = null;
          if (!d || !ev || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) return;
          const r = pe.getBoundingClientRect();
          const unite = Math.min(r.width, r.height) / 2;
          const ux = (ev.clientX - r.left - r.width / 2) / unite;
          const uy = (ev.clientY - r.top - r.height / 2) / unite;
          const bords = [r.width / 2 / unite + 0.05, r.height / 2 / unite + 0.05];
          const date = vue.instant || new Date();
          const figures = Ciel.figuresVues(date, g.lat, g.lon, vue.az, vue.haut, vue.champ);
          const noms = Ciel.nomsVus(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, bords);
          montrer(Ciel.designee(ux, uy, figures, noms));
        };
        objets.addEventListener("click", ev => {
          const b = ev.target.closest("[data-sigle]");
          if (b) montrer(b.dataset.sigle);
        });
        pe.addEventListener("pointerup", lacher);
        pe.addEventListener("pointercancel", lacher);
        for (const b of fe.querySelectorAll("[data-affichage]")) {
          b.addEventListener("click", () => {
            Reglages.poserAffichageCiel(b.dataset.affichage);
            for (const x of fe.querySelectorAll("[data-affichage]")) {
              x.setAttribute("aria-pressed", String(x === b));
            }
            redessiner();
          });
        }
        const fenetre = fe.querySelector("#ciFenetre");
        fe.querySelector("#ciSources").addEventListener("click", () => { fenetre.hidden = false; });
        fe.querySelector("#ciFenetreFermer").addEventListener("click", () => { fenetre.hidden = true; });
        const fermer = () => {
          fe.remove();
          tracerBandeau();
          window.removeEventListener("resize", redessiner);
          document.removeEventListener("keydown", touche);
          bandeau.focus?.();
        };
        const touche = ev => { if (ev.key === "Escape") fermer(); };
        fe.querySelector("#ciFermer").addEventListener("click", fermer);
        window.addEventListener("resize", redessiner);
        document.addEventListener("keydown", touche);
        redessiner();
      };
      bandeau.addEventListener("click", ouvrir);
      bandeau.addEventListener("keydown", ev => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrir(); }
      });

      tracerBandeau();
      Ciel.charger().then(() => {
        if (!cv.isConnected) return;
        if (etat) etat.hidden = true;
        requestAnimationFrame(tracerBandeau);
        const liste = bloc.querySelector("#ciAVoir");
        if (liste) {
          const vus = aVoirCeSoir(new Date(), g);
          const hauteurDite = h => h > 70 ? "presque au zénith" : h > 45 ? "haut" : "à mi-hauteur";
          liste.innerHTML = vus.length
            ? vus.map(x => rangeeCiel(x.nom,
              `${hauteurDite(x.hauteur)}, vers ${viseeDe(x.azimut, 30).split(",")[0].toLowerCase()}`,
              `${Math.round(x.hauteur)}°`)).join("")
              + `<p class="note">À ${hm(vus[0].instant.getTime())}, les constellations les plus hautes.</p>`
            : `<p class="note">Aucune constellation haute à cette heure.</p>`;
        }
      }).catch(() => {
        if (etat) etat.textContent = "Le ciel n'a pas pu se charger.";
      });
    },
  };
}

export function vueCiel(ctx, rendre) {
  const quel = Reglages.ciel();
  const f = quel === "lune" ? vueLune() : quel === "etoiles" ? vueEtoiles() : vueSoleil();

  const seg = `<div class="seg">` + Reglages.ECRANS_CIEL.map(([c, n]) =>
    `<button type="button" data-ciel="${c}"${c === quel ? ' class="actif"' : ""}`
    + ` aria-current="${c === quel}">${esc(n)}</button>`).join("") + `</div>`;

  return {
    titre: f.titre,
    // Sans ciel peint, l'écran n'est pas en plein cadre : la coque pose alors
    // son titre, et le sélecteur reste en tête du contenu.
    pleinCadre: !!f.plein,
    corps: (f.plein || "")
      + `<div class="ecran-corps">${seg}${f.dedans}</div>`,
    brancher(bloc) {
      if (typeof f.brancher === "function") f.brancher(bloc);
      for (const b of bloc.querySelectorAll("[data-ciel]")) {
        b.addEventListener("click", () => {
          if (b.dataset.ciel === quel) return;
          Reglages.poserCiel(b.dataset.ciel);
          rendre();
        });
      }
    },
  };
}
