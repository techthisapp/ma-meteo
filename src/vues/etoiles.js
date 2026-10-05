/* La voûte étoilée et l'écran « Le ciel », qui réunit le Soleil, la Lune et les étoiles. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc, cleHeure } from "../horloge.js";
import * as Voute from "../voute.js";
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
const DIRECTIONS = ["Nord", "Nord-est", "Est", "Sud-est", "Sud", "Sud-ouest", "Ouest", "Nord-ouest"];

const directionDe = az => DIRECTIONS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/* « l'est », « l'ouest », « le nord-est » : l'article suit la voyelle. */
const articleDe = d => (/^[EO]/.test(d) ? "l'" : "le ") + d.toLowerCase();

/* La visée, dite en plein écran pendant le glissement. Au-delà de 80 degrés,
   une direction ne veut plus rien dire : la vue est à la verticale. */
export const viseeDe = (az, haut) => haut > 80 ? "Au zénith" : haut < -80 ? "Sous les pieds"
  : `${directionDe(az)}, ${Math.round(haut)}°`;

/* Les bornes du regard et du champ, version 176 : la vue descend jusque sous
   les pieds et monte jusqu'au zénith, et le champ va de vingt à cent degrés. */
export const HAUT_MIN = -89, HAUT_MAX = 89, CHAMP_MIN = 20, CHAMP_MAX = 100;
/* Le pincement agit à la puissance 0,7 de l'écart des doigts : proportionnel,
   un geste moyen menait d'un coup de 60 à 20 degrés, vu dans le simulateur le
   6 octobre 2026. */
export const PINCE = 0.7;

/* La recherche d'une constellation, en deux groupes : les visibles, de la plus
   haute à la plus basse, puis celles sous l'horizon, par ordre alphabétique.
   Le nom se compare sans accents, et le nom latin compte aussi. */
const sansAccent = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function chercherConstellations(q, date, g) {
  const d = Ciel.chargees();
  if (!d) return { visibles: [], cachees: [] };
  const jj = Astres.jourJulien(date);
  const cle = sansAccent(q.trim());
  const l = Object.entries(d.noms)
    .filter(([, [nom, , , latin]]) => !cle || sansAccent(nom).includes(cle) || sansAccent(latin || "").includes(cle))
    .map(([sigle, [nom, ra, dec]]) => ({ sigle, nom, ...Ciel.surHorizon(ra, dec, jj, g.lat, g.lon) }));
  return {
    visibles: l.filter(x => x.hauteur > 0).sort((a, b) => b.hauteur - a.hauteur),
    cachees: l.filter(x => x.hauteur <= 0).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  };
}

/* Le chemin vers une constellation cherchée : l'écart en azimut, signé, vers la
   droite quand il est positif, l'écart en hauteur, la distance angulaire et la
   consigne écrite. */
export function chemin(vue, cible) {
  const daz = ((cible.azimut - vue.az + 540) % 360) - 180;
  const dh = cible.hauteur - vue.haut;
  const r = Math.PI / 180;
  const dist = Math.round(Math.acos(Math.max(-1, Math.min(1,
    Math.sin(cible.hauteur * r) * Math.sin(vue.haut * r)
    + Math.cos(cible.hauteur * r) * Math.cos(vue.haut * r) * Math.cos(daz * r)))) / r);
  const sens = Math.abs(daz) > 20 ? (daz > 0 ? "à droite" : "à gauche") : "";
  const vert = Math.abs(dh) > 15 ? (dh > 0 ? "plus haut" : "plus bas") : "";
  return { daz, dh, dist, consigne: [sens, vert].filter(Boolean).join(" et ") || "tout près" };
}

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

/* La peinture vit dans `src/voute.js` depuis la version 176, jalon 24 : le
   bandeau et le plein écran la partagent. */
function peindreCiel(cv, vue, g, options = {}) {
  return Voute.peindre(cv, vue, g, { affichage: options.affichage || Reglages.affichageCiel(), ...options });
}

/* La couverture nuageuse prévue à un instant, en part de un, lue sur la série
   horaire de la prévision ; `null` hors de la série. */
export function nuagesA(instant, charge = P.chargeCourante()) {
  const h = charge?.hourly;
  if (!h?.time || !h.cloud_cover) return null;
  const cle = cleHeure(instant);
  const i = h.time.indexOf(cle);
  return i >= 0 && Number.isFinite(h.cloud_cover[i]) ? h.cloud_cover[i] / 100 : null;
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
        if (cv.isConnected) peindreCiel(cv, fixe, g, { cardinaux: false, sousHorizon: false });
      };

      const ouvrir = () => {
        if (!Ciel.chargees() || document.getElementById("ciPleinEcran")) return;
        const vue = { ...fixe, cible: null, sel: null };
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
        const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const icone = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" `
          + `stroke-width="2" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
        /* La nébulosité de la nuit, teinte du rail du curseur : bleu nuit quand
           le ciel est dégagé, gris quand il est couvert. */
        const rail = Array.from({ length: 40 }, (_, k) => {
          const c = nuagesA(instantDe(Math.round((k + 0.5) / 40 * pas)));
          if (c === null) return `<i style="background:rgba(255,255,255,.18)"></i>`;
          const m = (x, y) => Math.round(x + (y - x) * c);
          return `<i style="background:rgb(${m(40, 120)},${m(80, 126)},${m(150, 138)})"></i>`;
        }).join("");
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
          + `<div class="ci-haut">`
          + `<p class="ci-visee" id="ciVisee" aria-live="polite">${viseeDe(vue.az, vue.haut)}</p>`
          + `<button type="button" class="ci-rond" id="ciChercher" aria-label="Chercher une constellation">`
          + icone('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>') + `</button>`
          + `<button type="button" class="ci-rond" id="ciRouge" aria-pressed="false" aria-label="Lumière rouge, pour garder les yeux habitués à la nuit">`
          + icone('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="#E0565B" stroke="#E0565B"/>') + `</button>`
          + `<button type="button" class="ci-rond" id="ciVoile" aria-pressed="${Reglages.voileCiel()}" aria-label="Voile des nuages prévus">`
          + icone('<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.6 4.2 4.2 0 0 0 7 18z"/>') + `</button>`
          + `<button type="button" class="ci-rond ci-sources" id="ciSources" aria-label="Sources">`
          + icone('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".6" fill="currentColor"/>') + `</button>`
          /* Une croix plutôt que « Fermer » : la visée garde sa place, version
             177. */
          + `<button type="button" class="ci-rond ci-fermer" id="ciFermer" aria-label="Fermer">`
          + icone('<path d="M6 6l12 12M18 6 6 18"/>') + `</button>`
          + `</div>`
          + `<div class="ci-dirs" id="ciDirs" role="group" aria-label="Tourner le regard">`
          + [["N", "Nord"], ["E", "Est"], ["S", "Sud"], ["O", "Ouest"], ["+", "Plus haut"], ["-", "Plus bas"]]
            .map(([c, n]) => `<button type="button" class="ci-bouton" data-dir="${c}">${n}</button>`).join("")
          + `</div>`
          + `<ul class="titre-lu" id="ciObjets" aria-label="Constellations dans le champ"></ul>`
          + `<div class="ci-recherche" id="ciRecherche" hidden>`
          + `<input type="search" id="ciChamp" placeholder="Lyre, Orion, Cygne…" autocomplete="off" aria-label="Nom de la constellation">`
          + `<ul id="ciResultats"></ul></div>`
          + (jour ? `<p class="ci-jour" id="ciJour">Il fait jour : la lumière du Soleil efface ces étoiles.</p>` : "")
          + `<div class="ci-cible" id="ciCible" hidden>`
          + `<span class="ci-cible-nom" id="ciCibleNom" aria-live="polite"></span>`
          + `<button type="button" class="ci-bouton" id="ciYAller">Y aller</button>`
          + `<button type="button" class="ci-bouton" id="ciOublier">Oublier</button></div>`
          + `<div class="ci-bas">`
          + `<div class="ci-curseur" id="ciBarreTemps">`
          + `<button type="button" class="ci-rond" id="ciLecture" aria-label="Faire défiler la nuit">▶</button>`
          + `<div class="ci-piste"><div class="ci-rail" aria-hidden="true">${rail}</div>`
          + `<input type="range" id="ciCurseur" min="0" max="${pas}" step="1" `
          + `value="${rangDepart}" aria-label="Heure du ciel"></div>`
          + `<span class="ci-heure"><span id="ciHeure">${hm(instantDe(rangDepart).getTime())}</span><small id="ciCiel"></small></span>`
          + `<button type="button" class="ci-bouton" id="ciMaintenant">Maintenant</button>`
          + `</div>`
          + `<div class="ci-ligne">`
          + `<div class="ci-choix" id="ciChoix" role="group" aria-label="Étoiles affichées">`
          + Ciel.AFFICHAGES.map(([cle, court, long]) => `<button type="button" `
            + `data-affichage="${cle}" aria-label="${long}" `
            + `aria-pressed="${cle === Reglages.affichageCiel()}">${court}</button>`).join("")
          + `</div>`
          + `<button type="button" class="ci-rond" id="ciMoins" aria-label="Élargir le champ">−</button>`
          + `<button type="button" class="ci-rond" id="ciPlus" aria-label="Resserrer le champ">+</button>`
          + `</div></div>`
          + `<div class="ci-fiche" id="ciFiche" role="dialog" aria-live="polite" hidden></div>`
          + `<div class="ci-fenetre" id="ciFenetre" hidden>${MENTIONS}`
          + `<button type="button" class="ci-bouton" id="ciFenetreFermer">Fermer</button></div>`;
        document.body.appendChild(fe);
        const pe = fe.querySelector("#ciToilePE");
        const visee = fe.querySelector("#ciVisee");
        const objets = fe.querySelector("#ciObjets");
        const cibleBarre = fe.querySelector("#ciCible");
        const cibleNom = fe.querySelector("#ciCibleNom");
        const yAller = fe.querySelector("#ciYAller");
        let champVu = -1e9;
        const majVisee = (zoome = false) => {
          if (zoome) champVu = performance.now();
          const champ = performance.now() - champVu < 1500 ? `, champ ${Math.round(vue.champ)}°` : "";
          visee.textContent = `${viseeDe(vue.az, vue.haut)}${champ}`;
          if (zoome) setTimeout(() => { if (fe.isConnected) majVisee(); }, 1600);
        };
        /* La liste des constellations dont le nom tombe dans le champ, refaite
           à chaque image dessinée ; chacune ouvre sa fiche. */
        let derniersNoms = "";
        const majObjets = () => {
          const r = pe.getBoundingClientRect();
          const unite = Math.min(r.width, r.height) / 2 || 1;
          const noms = Ciel.nomsVus(vue.instant || new Date(), g.lat, g.lon, vue.az, vue.haut, vue.champ,
            [r.width / 2 / unite, r.height / 2 / unite]);
          const cle = noms.map(n => n.sigle).join();
          if (cle !== derniersNoms) {
            derniersNoms = cle;
            objets.innerHTML = noms.map(n => `<li><button type="button" data-sigle="${esc(n.sigle)}">${esc(n.nom)}</button></li>`).join("");
          }
          pe.setAttribute("aria-label", `${viseeDe(vue.az, vue.haut)}${noms.length ? `, ${noms.length} constellations` : ""}`);
        };

        /* La flèche de la recherche, tant que la constellation n'est pas dans
           le champ ; trouvée, elle s'illumine elle-même dans la peinture. */
        const fleche = (t, pos) => {
          if (!vue.cible) return;
          const d = Ciel.chargees().noms[vue.cible];
          const jj = Astres.jourJulien(vue.instant || new Date());
          const c = Ciel.surHorizon(d[1], d[2], jj, g.lat, g.lon);
          const W = pe.clientWidth, H = pe.clientHeight;
          if (pos && pos.x > 60 && pos.x < W - 60 && pos.y > 110 && pos.y < H - 200) {
            cibleNom.textContent = `${d[0]} est là`;
            yAller.hidden = true;
            return;
          }
          const ch = chemin(vue, c);
          cibleNom.textContent = `${d[0]}, ${c.hauteur < 0 && ch.dh < -15 ? ch.consigne.replace("plus bas", "sous l'horizon") : ch.consigne}`;
          yAller.hidden = false;
          const ctx = pe.getContext("2d");
          const angle = pos ? Math.atan2(pos.y - H / 2, pos.x - W / 2) : Math.atan2(-ch.dh, ch.daz);
          const rx = W / 2 - 46, ry = H / 2 - 160;
          const k = 1 / Math.max(Math.abs(Math.cos(angle)) / rx, Math.abs(Math.sin(angle)) / ry);
          const x = W / 2 + Math.cos(angle) * k, y = H / 2 + Math.sin(angle) * k;
          const pouls = calme ? 0 : 4 * Math.sin(t / 300);
          ctx.save();
          ctx.translate(x, y); ctx.rotate(angle); ctx.translate(pouls, 0);
          ctx.shadowColor = "rgba(255,220,150,.8)"; ctx.shadowBlur = 14;
          ctx.fillStyle = "rgba(255,236,190,.98)";
          ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.font = "600 12px -apple-system, system-ui, sans-serif"; ctx.textAlign = "center";
          ctx.shadowColor = "rgba(3,6,30,.95)"; ctx.shadowBlur = 6;
          ctx.fillStyle = "rgba(255,236,190,1)";
          ctx.fillText(`${d[0]}, ${ch.dist}°`, Math.max(60, Math.min(W - 60, x - Math.cos(angle) * 52)), y - Math.sin(angle) * 40 + 4);
          ctx.restore();
        };

        /* Une image : la voûte, puis la flèche. L'animation tourne tant que le
           plein écran est ouvert et l'application au premier plan, pour le
           scintillement, la respiration de la constellation cherchée et la
           flèche ; elle ne tourne pas sous mouvement réduit. */
        const image = t => {
          const pos = peindreCiel(pe, vue, g, { t, calme,
            nuages: Reglages.voileCiel() ? nuagesA(vue.instant || new Date()) || 0 : 0 });
          fleche(t, pos);
          majObjets();
        };
        let boucle = null, demande = false;
        const animer = t => {
          boucle = null;
          if (!pe.isConnected || document.hidden) return;
          image(t);
          boucle = requestAnimationFrame(animer);
        };
        const redessiner = () => {
          if (!calme) { if (boucle === null && pe.isConnected) boucle = requestAnimationFrame(animer); return; }
          if (demande || !pe.isConnected) return;
          demande = true;
          requestAnimationFrame(t => { demande = false; if (pe.isConnected) image(t); });
        };
        const surVisibilite = () => { if (!document.hidden) redessiner(); };
        document.addEventListener("visibilitychange", surVisibilite);

        const borner = () => {
          vue.az = ((vue.az % 360) + 360) % 360;
          vue.haut = Math.max(HAUT_MIN, Math.min(HAUT_MAX, vue.haut));
          vue.champ = Math.max(CHAMP_MIN, Math.min(CHAMP_MAX, vue.champ));
        };
        const tourner = (daz, dhaut) => {
          vue.az += daz; vue.haut += dhaut;
          borner(); majVisee(); redessiner();
        };
        const zoomer = facteur => { vue.champ *= facteur; borner(); majVisee(true); redessiner(); };
        /* Recaler la vue pour que le point du ciel `ancre` tombe en (mx, my),
           en unités de projection : trois pas de correction suffisent. */
        const ancrer = (ancre, mx, my) => {
          for (let k = 0; k < 3; k++) {
            const ici = Voute.depuisEcran(mx, my, vue.az, vue.haut, vue.champ);
            vue.az += ((ancre.azimut - ici.azimut + 540) % 360) - 180;
            vue.haut += ancre.hauteur - ici.hauteur;
            borner();
          }
        };
        for (const b of fe.querySelectorAll("[data-dir]")) {
          b.addEventListener("click", () => {
            const d = b.dataset.dir;
            if (d === "+") tourner(0, 15);
            else if (d === "-") tourner(0, -15);
            else tourner({ N: 0, E: 90, S: 180, O: 270 }[d] - vue.az, 0);
          });
        }
        fe.querySelector("#ciPlus").addEventListener("click", () => zoomer(1 / 1.25));
        fe.querySelector("#ciMoins").addEventListener("click", () => zoomer(1.25));
        /* Les flèches du clavier tournent le regard, sauf sur le curseur de
           l'heure et dans le champ de recherche, qui ont les leurs. */
        fe.addEventListener("keydown", ev => {
          if (ev.target.id === "ciCurseur" || ev.target.id === "ciChamp") return;
          const d = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[ev.key];
          if (!d) return;
          ev.preventDefault();
          tourner(d[0], d[1]);
        });
        /* Un doigt tourne la vue, deux doigts pincent pour zoomer ; la molette
           zoome aussi. */
        const doigts = new Map();
        let depart = null, pince = null;
        pe.addEventListener("pointerdown", ev => {
          pe.setPointerCapture?.(ev.pointerId);
          doigts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          if (doigts.size === 1) depart = { x: ev.clientX, y: ev.clientY, az: vue.az, haut: vue.haut };
          if (doigts.size === 2) {
            const [a, b] = [...doigts.values()];
            /* Le ciel sous le milieu des doigts reste sous eux pendant le
               pincement. */
            const r = pe.getBoundingClientRect(), unite = Math.min(r.width, r.height) / 2;
            const mx = ((a.x + b.x) / 2 - r.left - r.width / 2) / unite, my = ((a.y + b.y) / 2 - r.top - r.height / 2) / unite;
            pince = { d: Math.hypot(a.x - b.x, a.y - b.y), champ: vue.champ, mx, my,
              ancre: Voute.depuisEcran(mx, my, vue.az, vue.haut, vue.champ) };
            depart = null;
          }
        });
        pe.addEventListener("pointermove", ev => {
          if (!doigts.has(ev.pointerId)) return;
          doigts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          if (pince && doigts.size === 2) {
            const [a, b] = [...doigts.values()];
            vue.champ = pince.champ * (pince.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))) ** PINCE;
            borner();
            ancrer(pince.ancre, pince.mx, pince.my);
            majVisee(true); redessiner();
            return;
          }
          if (!depart) return;
          const unite = Math.min(pe.clientWidth, pe.clientHeight) / 2;
          vue.az = depart.az - (ev.clientX - depart.x) / unite * vue.champ;
          vue.haut = depart.haut + (ev.clientY - depart.y) / unite * vue.champ;
          borner(); majVisee(); redessiner();
        });
        pe.addEventListener("wheel", ev => {
          ev.preventDefault();
          zoomer(1 + ev.deltaY / 500);
        }, { passive: false });

        const curseur = fe.querySelector("#ciCurseur");
        const heure = fe.querySelector("#ciHeure");
        const etatCiel = fe.querySelector("#ciCiel");
        const direCiel = t => {
          const c = nuagesA(t);
          etatCiel.textContent = c === null ? "" : c < 0.2 ? "Dégagé" : c < 0.6 ? `Voilé, ${Math.round(c * 100)} %` : `Couvert, ${Math.round(c * 100)} %`;
        };
        const poserInstant = k => {
          const t = instantDe(k);
          /* Le moment présent se rend par son absence : la carte suit alors
             l'heure qui passe. */
          vue.instant = Math.abs(t - new Date()) < PAS ? null : t;
          heure.textContent = hm(t.getTime());
          direCiel(t);
          redessiner();
        };
        curseur.addEventListener("input", () => poserInstant(Number(curseur.value)));
        fe.querySelector("#ciMaintenant").addEventListener("click", () => {
          curseur.value = String(rang(Date.now()));
          poserInstant(Number(curseur.value));
        });
        /* La lecture fait défiler la nuit, un pas de cinq minutes à la fois. */
        const lecture = fe.querySelector("#ciLecture");
        let defile = null;
        const arreterLecture = () => { clearInterval(defile); defile = null; lecture.textContent = "▶"; lecture.setAttribute("aria-label", "Faire défiler la nuit"); };
        lecture.addEventListener("click", () => {
          if (defile) { arreterLecture(); return; }
          lecture.textContent = "❚❚";
          lecture.setAttribute("aria-label", "Arrêter le défilement");
          defile = setInterval(() => {
            curseur.value = String((Number(curseur.value) + 1) % (pas + 1));
            poserInstant(Number(curseur.value));
          }, calme ? 400 : 90);
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
          doigts.delete(ev.pointerId);
          if (doigts.size < 2) pince = null;
          const d = depart;
          if (!doigts.size) depart = null;
          if (!d || doigts.size || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) return;
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

        /* La recherche : un nom, deux groupes, puis la flèche vise la
           constellation jusqu'à la trouver. */
        const panneau = fe.querySelector("#ciRecherche");
        const champ = fe.querySelector("#ciChamp");
        const resultats = fe.querySelector("#ciResultats");
        const remplir = () => {
          const { visibles, cachees } = chercherConstellations(champ.value, vue.instant || new Date(), g);
          const ligne = x => `<li><button type="button" data-cherche="${esc(x.sigle)}">${esc(x.nom)}`
            + `<small>${x.hauteur > 0 ? `${Math.round(x.hauteur)}° de haut` : `${Math.round(-x.hauteur)}° sous l'horizon`}</small></button></li>`;
          resultats.innerHTML = (visibles.length ? `<li class="ci-groupe">Visibles maintenant, ${visibles.length}</li>` + visibles.map(ligne).join("") : "")
            + (cachees.length ? `<li class="ci-groupe">Sous l'horizon, ${cachees.length}</li>` + cachees.map(ligne).join("") : "")
            || `<li class="ci-groupe">Aucune constellation de ce nom</li>`;
        };
        fe.querySelector("#ciChercher").addEventListener("click", () => {
          panneau.hidden = !panneau.hidden;
          if (!panneau.hidden) { champ.value = ""; remplir(); champ.focus(); }
        });
        champ.addEventListener("input", remplir);
        resultats.addEventListener("click", ev => {
          const b = ev.target.closest("[data-cherche]");
          if (!b) return;
          vue.cible = b.dataset.cherche;
          panneau.hidden = true;
          cibleBarre.hidden = false;
          redessiner();
        });
        fe.querySelector("#ciOublier").addEventListener("click", () => {
          vue.cible = null; cibleBarre.hidden = true; redessiner();
        });
        yAller.addEventListener("click", () => {
          const d = Ciel.chargees().noms[vue.cible];
          const c = Ciel.surHorizon(d[1], d[2], Astres.jourJulien(vue.instant || new Date()), g.lat, g.lon);
          const ch = chemin(vue, c);
          const a0 = vue.az, h0 = vue.haut;
          const dh = Math.max(HAUT_MIN, Math.min(HAUT_MAX, c.hauteur)) - h0;
          const t0 = performance.now(), duree = calme ? 1 : 900;
          const pas1 = now => {
            const u = Math.min(1, (now - t0) / duree);
            const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
            vue.az = a0 + ch.daz * e; vue.haut = h0 + dh * e;
            borner(); majVisee(); redessiner();
            if (u < 1) requestAnimationFrame(pas1);
          };
          requestAnimationFrame(pas1);
        });

        fe.querySelector("#ciVoile").addEventListener("click", ev => {
          const on = ev.currentTarget.getAttribute("aria-pressed") !== "true";
          ev.currentTarget.setAttribute("aria-pressed", String(on));
          Reglages.poserVoileCiel(on);
          redessiner();
        });
        /* La lumière rouge garde les yeux habitués à l'obscurité. */
        fe.querySelector("#ciRouge").addEventListener("click", ev => {
          const on = ev.currentTarget.getAttribute("aria-pressed") !== "true";
          ev.currentTarget.setAttribute("aria-pressed", String(on));
          fe.classList.toggle("ci-rouge", on);
        });

        const fenetre = fe.querySelector("#ciFenetre");
        fe.querySelector("#ciSources").addEventListener("click", () => { fenetre.hidden = false; });
        fe.querySelector("#ciFenetreFermer").addEventListener("click", () => { fenetre.hidden = true; });
        const fermer = () => {
          arreterLecture();
          if (boucle !== null) cancelAnimationFrame(boucle);
          boucle = null;
          fe.remove();
          tracerBandeau();
          window.removeEventListener("resize", redessiner);
          document.removeEventListener("keydown", touche);
          document.removeEventListener("visibilitychange", surVisibilite);
          bandeau.focus?.();
        };
        const touche = ev => {
          if (ev.key !== "Escape") return;
          if (!panneau.hidden) { panneau.hidden = true; return; }
          fermer();
        };
        fe.querySelector("#ciFermer").addEventListener("click", fermer);
        window.addEventListener("resize", redessiner);
        document.addEventListener("keydown", touche);
        /* À l'ouverture, la carte montre l'instant présent, même de jour ; le
           curseur, lui, se pose sur la nuit. */
        direCiel(new Date());
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
