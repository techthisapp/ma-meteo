/* Ma météo. Amorçage, couche navigation, écrans, coque de la feuille.

   Site statique, aucun service dorsal, aucune base de données. Trois sources :
   Open-Meteo pour la prévision, le jeu de vigilance archivée de Météo-France sur
   data.gouv.fr, et les données climatologiques de base du même producteur pour
   la pluie mesurée au poste.

   L'interface suit le design system consigné dans DESIGN-SYSTEM.md : trois
   couches, navigation par barre d'onglets, contenu posé sur le fond, feuilles
   pour les actions temporaires. */

import { nombreFr, esc, heureJour, enumerer, cleHeure } from "./horloge.js";
import { surveiller } from "./typo.js";
import * as P from "./previsions.js";
import * as Reglages from "./reglages.js";
import { ico, icoTemps, icoCiel, tempsDe } from "./icones.js";
import { conseils, conseilsHTML, titreJours, LIGNES_MAX, SEUILS } from "./conseils.js";
import * as Ruban from "./ruban.js";
import * as Feu from "./feu.js";
import * as Relief from "./relief.js";
import * as Temps from "./temps.js";
/* Les écrans viennent chacun de son fichier. La carte et le ciel n'en font pas
   partie : ils se chargent à la première ouverture de leur onglet, plus bas. */
import { vueTemps } from "./vues/heures.js";
import { vueSemaine, basculerSemaine, semaineEstEtendue } from "./vues/avenir.js";
import { vueVigilance } from "./vues/vigilance.js";
import { bandeauAccueil } from "./vues/astres.js";
import { vueCommunes, vueAjout } from "./vues/lieux.js";
import { vueReglages, vueParapluie, vueRessenti, vueActivites, vueBeauTemps, vueAir } from "./vues/feuilles.js";
import { vueClimat } from "./vues/climat.js";
import { vueNeige, vuePlage, vueEau } from "./vues/loisirs.js";
import { moments } from "./ecritures.js";
import * as Vig from "./vigilance.js";
import * as Astres from "./astres.js";
import * as Justesse from "./justesse.js";
import * as Ensemble from "./ensemble.js";
import * as Air from "./air.js";
import * as Parapluie from "./parapluie.js";
import * as Reponse from "./reponse.js";
import * as Pluie from "./pluieproche.js";
import * as Bande from "./bande.js";
import * as Version from "./version.js";
import * as Scenarios from "./scenarios.js";
import * as Neige from "./neige.js";
import * as Plage from "./plage.js";
import * as Eau from "./eau.js";
import * as Deplacement from "./deplacement.js";
import * as Radar from "./radar.js";

const $ = id => document.getElementById(id);

/* La comparaison entre mesure et modèle lisait les jeux archivés de
   Météo-France sur data.gouv.fr, dont l'alimentation s'est interrompue en
   juin 2026. Ses modules, `postes.js`, `reseau.js` et `reserve.js`, ont été
   retirés le 2 octobre 2026, audit du 1er octobre, constat 6.10 ; ils restent
   dans l'historique, au commit 62c0076, si la synchronisation reprend. */

const ctx = {};

/* La vigilance en vigueur, gardée pour le rendu qui est synchrone. Elle se lit
   après la prévision, sans la retarder : un bulletin manquant ne doit pas
   priver l'écran de son temps qu'il fait. Le contexte la porte aussi, la
   feuille du détail lisant le même bulletin que le panneau. */
let vigilance = null;
let vigilanceMuette = false;
let pluieProche = null;
let deplacement = null;

/* ---------- État de l'application ---------- */

const ONGLETS = [
  ["accueil", "maison", "Accueil"],
  /* « Le temps » a quitté la barre le 25 septembre 2026, jalon 10, lot 6 : il
     s'ouvre en page de détail depuis la bande horaire, les tuiles et les
     conseils, et depuis tout écran qui mène à une voie du ruban. */
  /* « À venir » depuis le 28 septembre 2026, demandé par Jérôme : l'écran va
     désormais jusqu'à cinq semaines, et « La semaine » ne le disait plus. */
  ["semaine", "semaine", "À venir"],
  /* Le soleil et la lune tiennent une seule destination depuis le 3 septembre
     2026 : deux écrans d'un même sujet, choisis par un sélecteur en tête de
     contenu. La place libérée est celle de La carte, et les étoiles du jalon 9
     s'ajouteront au même endroit. */
  ["ciel", "arc", "Le ciel"],
  /* La carte prend la cinquième place, celle que la fusion du soleil et de la
     lune a libérée. Elle vient en dernier : les quatre premières destinations
     se lisent en échelle de temps, de l'instant à la semaine, la carte lit
     l'espace. */
  ["carte", "carte", "La carte"],
];

let onglet = "accueil";
/* La page de détail ouverte depuis l'accueil, ou null. Voir allerAuDetail. */
let detail = null;
/* L'application restaure elle-même le défilement au retour d'une page de
   détail. Laissé au navigateur, le retour tombait juste parce que le
   navigateur rétablissait la position de l'entrée d'historique, par-dessus ce
   que faisait l'application : le bon comportement dépendait de lui, et une
   restauration fausse dans le code passait inaperçue. */
if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
let charge = "vide";           // vide, chargement, pret, erreur
let pile = [];
let vueCourante = null;

/* ---------- Retour sensoriel, rare et bref ---------- */

/* Safari sur iOS n'expose pas de retour haptique aux pages. La vibration reste
   donc silencieuse là-bas, et ne sert que là où elle existe. */
function sentir(motif) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate?.(motif);
}

/* ---------- Message d'état ---------- */

/* Deux choses séparées depuis le 2 octobre 2026, audit, constat 4.10. La bulle
   visible, `#etat`, que les lecteurs d'écran ignorent ; et l'annonce, dans deux
   régions jamais masquées, `#annonce` pour un message ordinaire et `#alerte`
   pour une erreur. Une région masquée au moment du changement n'était pas
   annoncée par VoiceOver, et un message répété ne l'était qu'une fois : la
   région est vidée puis réécrite à l'image suivante. Quand une feuille est
   ouverte, les régions passent dans la feuille, que `aria-modal` isole du
   reste de la page.

   Un message ordinaire reste quatre secondes ; une erreur reste jusqu'au geste
   suivant ou au message suivant, décision de Jérôme du 2 octobre 2026. */
let minuteurEtat = null;
let gesteEtat = null;
function majEtat(t, { erreur = false } = {}) {
  const z = $("etat");
  clearTimeout(minuteurEtat);
  if (gesteEtat) { document.removeEventListener("pointerdown", gesteEtat, true); document.removeEventListener("keydown", gesteEtat, true); gesteEtat = null; }
  if (!t) { z.hidden = true; return; }
  z.textContent = t;
  z.hidden = false;
  annoncer(t, erreur);
  if (erreur) {
    gesteEtat = () => majEtat("");
    /* Le geste qui a fait naître l'erreur ne doit pas l'effacer aussitôt. */
    setTimeout(() => {
      if (!gesteEtat) return;
      document.addEventListener("pointerdown", gesteEtat, true);
      document.addEventListener("keydown", gesteEtat, true);
    }, 0);
  } else {
    minuteurEtat = setTimeout(() => { z.hidden = true; }, 4000);
  }
}
function annoncer(t, erreur) {
  const r = $(erreur ? "alerte" : "annonce");
  const f = $("feuille");
  const hote = f && !f.hidden ? f : document.body;
  for (const id of ["annonce", "alerte"]) if ($(id).parentNode !== hote) hote.append($(id));
  r.textContent = "";
  requestAnimationFrame(() => { r.textContent = t; });
}

/* Les maximums de la journée en cours et du lendemain, pris à la même source
   que la table de la semaine : les deux écrans doivent s'accorder au degré.

   Un renversement de température se juge d'un maximum de journée à l'autre. La
   règle coupait en deux une fenêtre de vingt-quatre heures glissante, ce qui
   revenait à comparer un après-midi à une nuit : elle annonçait un
   refroidissement tous les jours de beau temps, et nommait « le plus chaud de
   demain » un relevé de dix heures du matin, très en dessous du maximum réel. */
function maximaJour() {
  const c = P.chargeCourante();
  const i = P.iJour();
  if (!c || i < 0 || i + 1 >= c.daily.time.length) return null;
  const tx = k => {
    const j = P.jourHoraire(c.daily.time[k]);
    const v = j && j.tx !== null && j.tx !== undefined ? j.tx : c.daily.temperature_2m_max[k];
    return Number.isFinite(v) ? v : null;
  };
  const a = tx(i), b = tx(i + 1);
  return a === null || b === null ? null : { aujourdhui: a, demain: b };
}

/* ---------- Fragments partagés ---------- */

const chevron = `<svg class="rangee-chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" `
  + `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
  + `<path d="M9 5l7 7-7 7"/></svg>`;

/* Le titre d'écran nomme l'écran. Le changement de commune vit dans la barre de
   tête, à la même place sur les cinq écrans : une seule cible, toujours au même
   endroit, plutôt qu'une cible différente par écran. */
/* Le titre d'écran peut porter un contrôle à sa droite, sur sa ligne. C'est ce
   qui remonte le ruban et la table en pleine page : un sélecteur posé sous le
   titre leur coûtait une bande de soixante points avant le premier chiffre. */
const titreEcran = (titre, sous, cote) =>
  `<div class="titre-ecran"><div class="te-ligne"><h1>${esc(titre)}</h1>`
  + (cote || "") + `</div>`
  + (sous ? `<p>${esc(sous)}</p>` : "")
  + `</div>`;

/* Le bandeau de mise à jour, au même endroit que celui du hors ligne : une
   version plus récente est publiée, et un toucher la charge. */
let versionPlusRecente = null;
const bandeauMiseAJour = () => !versionPlusRecente ? "" :
  `<div class="mise-a-jour" role="status">`
  + `<span>La version ${versionPlusRecente} est disponible.</span>`
  + `<button type="button" class="bouton-borde" data-action="recharger">Recharger</button></div>`;

const bandeauHorsLigne = () => navigator.onLine ? "" :
  `<div class="hors-ligne">${ico("sans_reseau", "")}`
  + `<span>Hors ligne. La dernière prévision reçue reste affichée.</span></div>`;

const etatVide = (symbole, titre, phrase, action, secondaire) =>
  `<div class="etat-vide">${ico(symbole, "")}<h2>${esc(titre)}</h2><p>${esc(phrase)}</p>`
  + (action ? `<button type="button" class="bouton-plein" data-feuille="communes">${esc(action)}</button>` : "")
  + (secondaire ? `<button type="button" class="bouton-borde" data-action="geo">`
    + ico("cible", "") + `<span>${esc(secondaire)}</span></button>` : "")
  + `</div>`;

const etatChargement = () =>
  `<div class="etat-vide"><div class="tourne" role="progressbar" aria-label="Chargement"></div>`
  + `<p>Lecture de la prévision.</p></div>`;

/* Première lecture de l'accueil : la forme du bandeau est connue d'avance, une
   ossature vaut mieux qu'un tourniquet. */
const ossatureAccueil = () =>
  `<div class="bandeau" aria-hidden="true"><div class="bd-haut">`
  + `<p class="bd-deg ossature">00°</p>`
  + `<div class="bd-etat"><p class="bd-ciel ossature">Temps en cours</p>`
  + `<p class="bd-bornes ossature">00° à 00° aujourd'hui</p></div></div>`
  + `<div class="bd-mesures">`
  + [1, 2, 3, 4].map(() => `<div class="bd-m"><i><span class="ossature">Mesure</span></i>`
    + `<b class="ossature">00</b></div>`).join("")
  + `</div></div>`
  + `<p class="pied" role="status">Lecture de la prévision.</p>`;

const etatErreur = () =>
  `<div class="etat-vide">${ico("sans_reseau", "")}<h2>Prévision indisponible</h2>`
  + `<p>La source n'a pas répondu. Vérifier la connexion, puis réessayer.</p>`
  + `<button type="button" class="bouton-plein" id="btnReessayer">Réessayer</button></div>`;

/* Le panneau de vigilance. Il ne paraît que s'il y a quelque chose à signaler,
   et il paraît alors en premier : une vigilance orange ne se lit pas après la
   température. Sans vigilance, rien du tout, pas même une rangée d'accès. Un
   bandeau permanent qui dit « rien à signaler » finit par ne plus se lire, et
   le jour où il dit autre chose, personne ne le voit. */
/* La phrase d'annonce du lendemain, groupée par niveau, le plus grave devant :
   « Demain, vigilance orange canicule et orages ». Plusieurs phénomènes de même
   niveau se joignent dans la même phrase plutôt que d'en ouvrir chacun une. */
export function phraseAnnonce(annonces) {
  if (!annonces || !annonces.length) return "";
  const par = new Map();
  for (const a of annonces) {
    if (!par.has(a.niveau)) par.set(a.niveau, []);
    par.get(a.niveau).push(a.nom.toLowerCase());
  }
  const parts = [...par.keys()].sort((x, y) => y - x).map(k =>
    `vigilance ${Vig.NIVEAUX[k].nom} ${enumerer(par.get(k))}`);
  return `Demain, ${parts.join(", ")}`;
}

function panneauVigilance() {
  const v = vigilance;
  if (!v) return "";
  /* La couleur du panneau suit ce qui est en vigueur. Quand rien ne l'est, elle
     suit l'annonce : un département vert aujourd'hui et orange demain doit
     paraître, et paraître en orange. */
  const enCours = v.niveau !== undefined;
  const n = Vig.NIVEAUX[enCours ? v.niveau : v.niveauLendemain];

  /* La fenêtre de chaque phénomène se dit en clair. Une plage déjà commencée se
     dit par sa fin, c'est la seule chose qui reste à savoir. Une borne qui
     tombe un autre jour le dit, sans quoi « jusqu'à 06 h » se lirait comme
     dans une heure. */
  const quand = a => (a.debut.getTime() > Date.now()
    ? `de ${heureJour(a.debut)} à ${heureJour(a.fin)}`
    : `jusqu'à ${heureJour(a.fin)}`);

  /* Le niveau tient la ligne forte, la conduite ouvre la ligne effacée. Le rouge
     fait exception : sa conduite officielle est « Vigilance absolue », et les
     deux lignes écrivaient alors le mot deux fois. C'est elle qui tient la ligne
     forte dans ce cas, le niveau passant en dessous. Il reste écrit en toutes
     lettres, il a seulement changé de ligne.

     Sans rien en vigueur, la ligne forte porte le mot demain : le panneau ne
     doit pas se lire comme une alerte en cours. */
  const double = /vigilance/i.test(n.conduite);
  const fort = !enCours ? `Vigilance ${n.nom} demain`
    : double ? n.conduite : `Vigilance ${n.nom}`;
  const suite = !enCours ? n.conduite : double ? `Niveau ${n.nom}` : n.conduite;

  /* La borne écrite dans la tête est la fin du phénomène qui va le plus loin,
     non la fin de validité du bulletin. « Bulletin valable jusqu'à » est de
     l'administration, et écrire « jusqu'à demain 00 h » au-dessus d'une ligne
     qui dit « jusqu'à demain 12 h » se contredit. */
  const bout = enCours
    ? new Date(Math.max(...v.alertes.map(a => a.fin.getTime())))
    : null;

  const ligne = phraseAnnonce(v.annonces);

  /* Quel bulletin le panneau porte. La publication se fait à 06 h et à 16 h, et
     la révision tombe quelques minutes après : l'heure ronde dit lequel des
     deux est en main, la minute exacte reste dans la feuille. Sans elle, un
     panneau ouvert le matin ne se distinguait pas d'un panneau de la veille. */
  const bulletin = v.maj
    ? `bulletin de ${heureJour(new Date(new Date(v.maj).setMinutes(0, 0, 0)))}` : "";

  /* Les faits d'horloge tiennent leur propre ligne, sous la conduite. Écrits à
     la suite du département, ils faisaient une phrase de quatre membres qui
     repassait à la ligne d'elle-même, au même prix en hauteur et sans le
     découpage qui la rend lisible. */
  const horloge = [bout ? `jusqu'à ${heureJour(bout)}` : "", bulletin]
    .filter(Boolean).join(", ");

  /* Le panneau porte son titre lui-même. Un titre de section au-dessus d'une
     carte qui dit déjà « soyez attentif » annonçait deux fois la même chose et
     coûtait trente points en tête d'écran, ce qui suffisait à repousser le bloc
     du jour hors de la première vue. Le niveau reste écrit en toutes lettres,
     il a seulement changé de ligne. */
  return `<div class="section vg vg-${esc(n.nom)}">`
    + `<button type="button" class="carte vg-c" data-feuille="vigilance" `
    /* Le libellé remplace le contenu du bouton : il porte donc aussi les
       phénomènes et leur période, sans quoi VoiceOver ne disait ni lesquels ni
       quand. Audit du 1er octobre 2026, constat 4.2. */
    + `aria-label="${esc([fort, n.conduite, ...(enCours ? v.alertes : v.annonces)
      .map(a => `${a.nom}, ${Vig.NIVEAUX[a.niveau].nom}, ${enCours ? quand(a) : "demain"}`), "voir le détail"].join(", "))}">`
    + `<span class="vg-tete">${ico("alerte", "vg-ic")}`
    + `<span class="vg-txt"><b>${esc(fort)}</b>`
    + `<em>${esc(suite)}, ${esc(v.nom || `Département ${v.dep}`)}</em>`
    + (horloge ? `<em class="vg-q">${esc(horloge)}</em>` : "")
    + `</span>${chevron}</span>`
    /* En vigueur, les phénomènes portent leur plage ; sans rien en vigueur, ce
       sont les phénomènes annoncés qui prennent la place de la liste, chacun
       portant le mot demain à la place de sa plage horaire. */
    + `<span class="vg-l">` + (enCours ? v.alertes : v.annonces).map(a =>
      `<span class="vg-a n-${a.niveau}">${ico(a.symbole, "vg-as")}`
      + `<b>${esc(a.nom)}</b><i>${esc(Vig.NIVEAUX[a.niveau].nom)}, `
      + `${esc(enCours ? quand(a) : "demain")}</i></span>`).join("")
    /* La ligne d'annonce ne se pose que sous une liste en vigueur : sans rien en
       vigueur elle redirait la liste juste au-dessus. Vide, elle ne laisse aucun
       élément derrière elle. */
    + (enCours && ligne
      ? `<span class="vg-a vg-d n-${v.niveauLendemain}"><i>${esc(ligne)}</i></span>` : "")
    + `</span></button></div>`;
}

/* La pluie dans l'heure.

   Elle vient juste après la vigilance et avant tout le reste : c'est la seule
   chose de l'écran qui se démente en vingt minutes, et la seule qu'on lise la
   main sur la poignée.

   Elle se tait quand il n'y a rien à dire, et se tait aussi là où le produit
   n'est pas disponible. Une heure entièrement sèche annoncée à chaque ouverture
   cesse d'être lue, et l'application dit déjà le temps qu'il fait juste en
   dessous ; une heure sans radar annoncée au sec serait fausse.

   Le graphe porte les neuf échéances de la source, non un tracé continu : le pas
   est de cinq minutes puis de dix, et une courbe lissée donnerait à ces neuf
   points une continuité qu'ils n'ont pas. */
function panneauPluieProche() {
  const l = pluieProche;
  if (!l || !l.dispo) return "";
  const ev = Pluie.evenement(l);
  if (!ev) return "";
  const dit = Pluie.phrase(ev, Date.now(), l.pasMinutes);
  if (!dit) return "";

  const pas = l.pas.filter(x => x.t >= Date.now() - (l.pasMinutes || 5) * 60000);
  if (pas.length < 2) return "";
  const t0 = pas[0].t, t1 = pas[pas.length - 1].t;
  const etendue = Math.max(1, t1 - t0);

  /* Chaque échéance porte sa hauteur et sa place, la place venant de l'heure et
     non du rang : les pas ne sont pas égaux, et les ranger à intervalle constant
     mentirait sur la durée. */
  const barres = pas.map(x => {
    /* Une échéance sèche garde un talon visible : le graphe porte neuf moments,
       et un moment sans pluie doit se voir comme un moment, non comme un trou.
       L'échéance sans valeur, elle, reste au ras : elle n'est pas un moment sec,
       elle est un moment qu'on ne connaît pas. */
    const h = [4, 20, 48, 74, 100][Math.max(0, Math.min(4, x.i))];
    return `<i class="pp-b${estPluieRang(x.i) ? " pp-b-eau" : ""}" `
      + `style="--x:${(((x.t - t0) / etendue) * 100).toFixed(2)}%;--h:${h}%"></i>`;
  }).join("");

  const finPlage = heureJour(new Date(t1));
  /* Le sens d'arrivée, quand la mesure a abouti. Il tient sous la phrase, en
     ligne effacée : il précise ce que la phrase annonce, il ne l'annonce pas. */
  const venue = Deplacement.phrase(deplacement);

  return `<div class="section pp">`
    + `<div class="carte pp-c">`
    + `<p class="pp-tete">${ico("goutte", "pp-ic")}<b>${esc(dit)}</b></p>`
    + (venue ? `<p class="pp-venue">${esc(venue)}</p>` : "")
    + `<div class="pp-g" role="img" aria-label="${esc(resumeGraphe(pas))}">${barres}</div>`
    + `<p class="pp-axe"><span>maintenant</span><span>${esc(finPlage)}</span></p>`
    /* Le repli vient d'un modèle et non du radar : il le dit. Audit, constat
       2.6, le service du radar pouvant aussi se taire. */
    + (l.source === "repli" ? `<p class="pp-venue pp-repli">Estimation d'un modèle, au quart d'heure.</p>` : "")
    + `</div></div>`;
}

const estPluieRang = i => Pluie.estPluie(i);

/* Le graphe se lit aussi sans le voir : la description dit les épisodes, non les
   neuf valeurs, une liste de neuf intensités ne s'écoutant pas. */
function resumeGraphe(pas) {
  const bouts = [];
  let debut = null;
  for (let k = 0; k < pas.length; k++) {
    const eau = Pluie.estPluie(pas[k].i);
    if (eau && debut === null) debut = k;
    if (!eau && debut !== null) { bouts.push([debut, k - 1]); debut = null; }
  }
  if (debut !== null) bouts.push([debut, pas.length - 1]);
  if (!bouts.length) return "Aucune pluie dans l'heure";
  return enumerer(bouts.map(([a, b]) => {
    const nom = Pluie.nomDe(Math.max(...pas.slice(a, b + 1).map(x => x.i))).toLowerCase();
    return a === b ? `${nom} vers ${heureJour(new Date(pas[a].t))}`
      : `${nom} de ${heureJour(new Date(pas[a].t))} à ${heureJour(new Date(pas[b].t))}`;
  }));
}

/* Le prochain lever ou coucher du Soleil, calculé sur l'appareil. Il n'entre
   dans la liste que s'il tombe dans les heures qui viennent : au-delà, ce n'est
   plus un fait de la journée mais une donnée d'almanach, et l'écran du soleil
   est là pour cela. */
function prochainAstre() {
  const g = Reglages.lire();
  if (g.lat === null) return null;
  try {
    const e = Astres.evenements("soleil", new Date(), g.lat, g.lon);
    const suite = [e.lever, e.coucher].filter(x => x && x > new Date());
    if (!suite.length) return null;
    const date = suite.sort((a, b) => a - b)[0];
    return { date, lever: e.lever && date.getTime() === e.lever.getTime() };
  } catch { return null; }
}

/* ---------- Écran d'accueil ---------- */

/* Ce qu'un lecteur d'écran dit d'une tuile qui ouvre une feuille : la feuille
   qu'elle ouvre. Jusqu'à la version 119, toutes disaient « voir l'air qu'on
   respire », la tuile de l'eau comprise. */
const TUILE_VERS = { air: "voir l'air qu'on respire", eau: "voir l'eau" };

function ecranAccueil() {
  const g = Reglages.lire();
  const c = P.chargeCourante();
  const i = P.iJour();
  const s = P.serieHoraire();

  const jour = new Date().toLocaleDateString("fr-FR",
    { weekday: "long", day: "numeric", month: "long" });

  /* La réponse du matin se calcule sur l'horizon, non sur la fenêtre de vingt-
     quatre heures : elle porte sur ce qui reste de la journée civile, et la
     fenêtre glissante déborderait sur demain. Le contexte la garde pour la
     feuille du ressenti, qui lit la même. */
  /* Le jeton est celui de la barre de tête, calculé une fois : la réponse du
     matin le reprend plutôt que de le recalculer, et un jeton déjà pris ne
     revient donc pas par l'encart. */
  const jetonEncart = ctx.jeton && !Reglages.jetonPris(ctx.jeton.cle) ? ctx.jeton : null;
  const reponse = Reponse.repondre(P.serieHorizon(), new Date(),
    { biais: Reglages.biais(), jeton: jetonEncart });
  ctx.reponse = reponse;

  let corps = "";
  let plein = false;

  if (!c || i < 0) {
    corps = etatErreur();
  } else {
    const d = c.daily;
    const jh = P.jourHoraire(d.time[i]);
    const tn = jh ? jh.tn : d.temperature_2m_min[i];
    const tx = jh ? jh.tx : d.temperature_2m_max[i];
    const t = s ? s.t[0] : (tn + tx) / 2;
    const code = s ? s.code[0] : d.weather_code[i];
    const clair = s ? s.clair[0] : 1;
    const [, lib] = tempsDe(code);

    /* Les quatre mesures que le grand chiffre ne peut pas tenir.

       Elles portent sur la journée civile entière, non sur l'heure en cours ni
       sur une fenêtre glissante. À dix heures du soir, « indice UV 0 » et « vent
       11 km/h » ne disaient rien d'une journée montée à sept d'indice et à
       quatre-vingts de rafale. Le maximum du jour est ce qu'on retient d'une
       journée, et c'est ce que portent déjà le titre du bandeau, « 18° à 32°
       aujourd'hui », et celui du bloc. Ce dernier dit le jour une fois pour
       toutes : les tuiles se contentent de « au plus » et « de risque ».

       Le ressenti ne s'affichait que s'il s'écartait de la température, la
       probabilité de pluie prenant sinon sa place. Depuis les tuiles du
       jalon 11, chaque paramètre a la sienne, et celle du ressenti paraît
       toujours.

       L'indice UV s'écrit sans décimale : « 0,0 » donne une fausse impression de
       mesure fine.

       Une valeur ne prend une couleur que lorsqu'elle passe un seuil : colorer
       une valeur ordinaire ferait du bruit et userait le signal. Le chiffre
       porte l'information, la couleur ne fait que la doubler. */
    /* Une valeur absente de la journée reste absente et s'écrit « — ».
       Audit, constat 1.11. */
    const arrondi = v => (Number.isFinite(v) ? Math.round(v) : null);
    const pb = jh ? arrondi(jh.pb) : null;
    const uv = jh ? arrondi(jh.uv) : null;
    const raf = jh ? arrondi(jh.raf) : null;
    const vent = jh ? arrondi(jh.v) : null;
    const hum = jh ? arrondi(jh.hum) : null;
    const res = jh ? arrondi(jh.res) : null;

    /* Chaque mesure désigne la voie du ruban qui la déplie : un chiffre de
       l'accueil est une porte vers ses vingt-quatre heures. */

    const chevronM = ico("chevron_bas", "bd-chev");
    /* Le nombre à la taille du titre, l'unité plus petite : sur une ligne de
       quatre, « 23 km/h » d'un seul corps débordait la cellule. Le texte lu
       reste le même. Jalon 10, lot 2. */
    const valeurUnite = v => {
      const m = /^(-?[\d,.]+)( .+)$/.exec(v);
      return m ? `${esc(m[1])}<small class="bd-u">${esc(m[2])}</small>` : esc(v);
    };

    /* Le ciel porte le temps qu'il fait, et le titre est posé dedans : la
       couverture nuageuse donne les nuages, le code donne la précipitation et
       le brouillard, la lame d'eau donne l'intensité, le vent la dérive.

       Le symbole de temps disparaît de la ligne d'état : un petit nuage dessiné
       devant un ciel peint dirait deux fois la même chose. Les bornes perdent
       leur couleur d'information pour la même raison qu'elles la portaient sur
       fond de page, la lisibilité : un chiffre orange sur un ciel de couchant
       ne se lit plus. */
    const params = Temps.depuis(code, s ? s.nua[0] : null, s ? s.mm[0] : null);
    plein = true;
    const bd = bandeauAccueil(g, new Date(), params, s ? s.v[0] : 0);
    /* Le ciel de l'accueil est plus bas que celui des autres écrans : la bande
       horaire et les chiffres du jour doivent tenir dans le premier écran.
       Jalon 10, lot 2. */
    corps += `<div class="plein plein-accueil" style="--ci-clarte:${bd.clarte.toFixed(3)}">`
      + bd.ciel
      /* La réponse du matin, en matière verre sur le ciel. Elle traverse la
         largeur au-dessus de la ligne de date : c'est la seule bande du ciel qui
         ne rencontre jamais rien, les astres étant posés à leur azimut réel et
         pouvant tomber n'importe où au-dessus, le grand chiffre et les bornes du
         jour occupant tout ce qui est en dessous. */
      + `<div class="plein-titre">`
      /* Une ligne par fait, chacune sa cible : l'objet mène au rappel d'agenda,
         le vêtement au réglage du ressenti. Une seule cible pour les deux
         enverrait l'un des deux appuis au mauvais endroit. */
      + (reponse ? `<div class="pt-rep">`
        + reponse.lignes.map(l => `<button type="button" class="pt-l" `
          + `data-feuille="${esc(l.feuille)}" aria-label="${esc(l.texte)}">`
          + `${ico(l.symbole, "pt-rep-ic")}<span>${esc(l.texte)}</span></button>`).join("")
        + `</div>` : "")
      + `<i>${esc(jour.charAt(0).toUpperCase() + jour.slice(1))}</i>`
      + `<div class="pt-temps">`
      + `<button type="button" class="bd-deg" data-detail="t" `
      /* Le libellé porte le texte visible, la température : VoiceOver la lisait
         « Température » sans le chiffre. Audit du 1er octobre 2026, 4.1. */
      + `aria-label="${Math.round(t)} degrés, voir heure par heure">`
      + `${Math.round(t)}<sup>°</sup></button>`
      + `<div class="bd-etat">`
      + `<button type="button" class="bd-ciel" data-detail="nua" `
      + `aria-label="${esc(lib)}, voir heure par heure">${esc(lib)}</button>`
      /* Les bornes restent du texte : elles mènent au même endroit que le grand
         chiffre, juste au-dessus. Deux cibles pour une destination, c'est une de
         trop, et chacune coûte 44 points de hauteur. */
      + `<p class="bd-bornes"><b>${Math.round(tn)}°</b> à `
      + `<b>${Math.round(tx)}°</b> aujourd'hui</p>`
      + `</div></div></div></div>`;

    /* La page se lit en échelle de temps, du plus proche au plus lointain, et
       chaque bloc répond à une question distincte.

       Aujourd'hui : ce qu'il fait et ce qui reste de la journée en cours.
       Les vingt-quatre prochaines heures : la table des moments, systématique.
       Demain, après-demain : ce qui mérite d'être su au-delà.

       Un fait appartient au premier bloc dont la fenêtre le contient. Les deux
       blocs de phrases et la table ne se répètent pas : l'une montre tout,
       les autres ne retiennent que ce qui sort de l'ordinaire. */
    const cejour = d.time[i];
    const restant = 24 - new Date().getHours();
    const sJour = P.serieHoraire(0, restant, 1);
    const sDemain = P.serieHoraire(restant, 24, 12);

    /* La comparaison avec la veille ne se pose que sur la fenêtre de la journée
       en cours : c'est la seule dont l'heure en cours fasse partie. */
    /* L'air et le profil d'allergies accompagnent les trois fenêtres, comme les
       scénarios et les maxima : le moteur de règles reste une fonction de sa
       série et de ce qu'on lui passe. */
    const suivis = Air.POLLENS.map(p => p.cle).filter(Reglages.pollenSuivi);
    const lJour = sJour
      ? conseils(sJour, { evenement: prochainAstre(), aujourdhui: cejour,
        veille: P.ecartVeille(), air: Air.alignerSur(sJour), pollens: suivis }) : [];
    /* La neige, jalon 16 : en saison et s'il existe une station à une heure de
       route, une porte large au-dessus de la grille, et un conseil en tête des
       conseils du jour quand une chute notable s'annonce, décidé par Jérôme le
       30 septembre 2026. */
    const nz = Neige.etatNeige(Reglages.lire());
    const saisonNeige = !!nz && nz.resumes.length > 0 && Neige.enSaison(cleHeure().slice(0, 10), nz.resumes);
    const notable = saisonNeige ? Neige.chuteNotable(nz.resumes) : null;
    if (notable) lJour.unshift({ i: "neige", g: 6, t: notable.phrase, d: "feuille:neige" });
    /* La plage, jalon 15 : la même porte large, de juin à septembre et au-delà
       tant que l'eau de la plage la plus proche dépasse 20°. */
    const pz = Plage.etatPlage(Reglages.lire());
    const saisonPlage = !!pz && pz.resumes.length > 0 && Plage.enSaisonPlage(cleHeure().slice(0, 10), pz.resumes);
    /* L'eau, jalon 18 : une restriction d'alerte ou plus grave se dit parmi les
       conseils du jour, et mène à la feuille de l'eau. */
    const ez = Eau.etatEau(Reglages.lire());
    const rEau = ez?.restriction;
    if (rEau && rEau.rang >= 2) lJour.push({ i: "goutte", g: 4, d: "feuille:eau",
      t: `Restriction d'eau : ${rEau.niveau.toLowerCase()}, usages de l'eau encadrés par arrêté.` });
    /* Les conseils de la neige et de l'eau s'ajoutent après le calcul du jour :
       ils reprennent leur rang de gravité, et le bloc garde ses trois lignes au
       plus. Ajoutés au bout, ils en faisaient une quatrième, ce que la garde des
       blocs a relevé le 30 septembre 2026. */
    lJour.sort((a, b) => b.g - a.g);
    lJour.splice(LIGNES_MAX);
    /* Le renversement de température ne se dit qu'avec demain : c'est de cette
       journée qu'il parle. L'évènement du Soleil, lui, ne vaut que pour les
       heures qui viennent. */
    /* Les scénarios de la journée dont parle le bloc : la fourchette du maximum
       s'écrit avec la journée qu'elle concerne, non sur l'accueil au dessus du
       grand chiffre où elle n'aurait rien à dire, la dispersion de l'heure en
       cours valant un demi-degré. */
    /* Le bloc de l'accueil ne parle plus que de demain : après-demain se lit
       dans La semaine seulement, demandé par Jérôme le 27 septembre 2026. */
    const lSuite = [
      ...(sDemain ? conseils(sDemain, { maxima: maximaJour(), aujourdhui: cejour,
        decalage: restant, scenarios: Ensemble.journee(d.time[i + 1]),
        medianes: Ensemble.alignerSur(sDemain)?.q.t.med,
        air: Air.alignerSur(sDemain), pollens: suivis }) : []),
    ].sort((a, b) => b.g - a.g).slice(0, LIGNES_MAX);

    /* Un titre peut n'être lu que par la voix de synthèse : celui des chiffres du
       jour, que la bande horaire rend redondant à l'œil et qui coûtait une
       ligne au premier écran. Jalon 10. */
    const bloc = (cle, titre, dedans, luSeul = false) => (dedans
      ? `<div class="section" data-bloc="${cle}"><h2${luSeul ? ' class="titre-lu"' : ""}>`
        + `${esc(titre)}</h2>${dedans}</div>` : "");

    /* Les tuiles des paramètres, jalon 11, lot 1. Elles couvrent la totalité
       des paramètres que l'application suit, sept dans le ruban et l'air dans
       sa feuille, une tuile chacun, et chacune mène à son détail. Elles
       remplacent les quatre chiffres du jour et se placent après la bande et
       les conseils, demandé par Jérôme le 24 septembre 2026. Chaque symbole
       sert une seule fois : le parapluie pour la pluie, la goutte pour
       l'humidité, la brume pour l'air. La pastille prend la couleur des
       symboles de temps ; le libellé porte toujours l'information. */
    const serieJour = sJour || s;
    const nuaMax = serieJour ? Math.round(Math.max(...serieJour.nua.filter(Number.isFinite))) : null;
    const pres0 = serieJour && Number.isFinite(serieJour.pres[0]) ? serieJour.pres[0] : null;
    const presFin = serieJour ? serieJour.pres[Math.min(serieJour.n - 1, 6)] : null;
    const tendance = pres0 === null || !Number.isFinite(presFin) ? ""
      : presFin - pres0 > 1 ? "en hausse" : presFin - pres0 < -1 ? "en baisse" : "stable";
    const airJour = serieJour ? Air.pire(Air.alignerSur(serieJour)) : null;
    const tuiles = jh ? [
      ["Ressenti", res === null ? "—" : `${res}°`, "au plus chaud",
        res === null ? "" : res >= SEUILS.chaleur ? "v-chaud" : res <= SEUILS.gel ? "v-froid" : "", "t", "thermo", "soleil"],
      jh.mm >= SEUILS.lame
        ? ["Pluie", `${nombreFr(jh.mm)} mm`, "aujourd'hui", jh.mm >= 5 ? "v-eau" : "", "mm", "parapluie", "pluie"]
        : ["Pluie", pb === null ? "—" : `${pb} %`, pb === null ? "de risque" : pb === 0 ? "Aucun risque" : "de risque",
          pb >= 60 ? "v-eau" : "", "mm", "parapluie", "pluie"],
      ["Vent", vent === null ? "—" : `${vent} km/h`, raf === null ? "rafales" : `rafales ${raf} km/h`,
        raf >= SEUILS.rafale || vent >= SEUILS.ventMoyen ? "v-attention" : "", "v", "vent", "nuage"],
      ["Ciel", nuaMax === null ? "—" : `${nuaMax} %`, "de nuages au plus", "", "nua", "nuage", "nuage"],
      ["Humidité", hum === null ? "—" : `${hum} %`, "au plus", hum >= SEUILS.humidite ? "v-eau" : "", "hum", "goutte", "pluie"],
      ["Indice UV", uv === null ? "—" : `${uv}`, uv >= SEUILS.uv ? "élevé" : "au plus",
        uv >= 8 ? "v-brulant" : uv >= SEUILS.uv ? "v-chaud" : uv >= 3 ? "v-attention" : "", "uv", "soleil", "soleil"],
      ["Pression", pres0 === null ? "—" : `${Math.round(pres0)} hPa`, tendance || "maintenant", "", "pres", "jauge", "nuage"],
      ["Air", airJour ? `${airJour.indice}` : "—",
        airJour ? (Air.niveauDe(airJour.indice)?.nom || "indice européen") : "pas de mesure", "", null, "brume", "nuage", "air"],
      /* L'eau, jalon 18 : la restriction en grand, la nappe dessous ; elle
         ouvre la feuille de l'eau. */
      ...(Eau.tuileEau(ez) ? [["L'eau", Eau.tuileEau(ez).valeur, Eau.tuileEau(ez).sous, Eau.tuileEau(ez).classe,
        null, "goutte", "pluie", "eau"]] : []),
    ] : [];

    /* Les quatre portes, en grille de deux sur deux. Jérôme les a voulues tout
       en bas de l'accueil le 24 septembre 2026, après « Demain et
       après-demain » : l'accueil dit le temps d'abord, les portes mènent
       ailleurs. Elles avaient été gardées sous les chiffres pour être atteintes
       sans dérouler la page ; la bande et le tableau disent désormais
       l'essentiel avant elles. Sans titre, elles ne s'ajoutent pas aux trois
       blocs de temps. */
    const portesHTML = ""
      + (saisonNeige ? `<button type="button" class="carte rangee porte porte-large" data-feuille="neige">`
        + ico("neige", "") + `<span class="rangee-txt"><b>La neige</b>`
        + `<span>${esc(Neige.phraseNeige(nz.resumes))}</span></span>` + chevron + `</button>` : "")
      + (saisonPlage ? `<button type="button" class="carte rangee porte porte-large" data-feuille="plage">`
        + ico("goutte", "") + `<span class="rangee-txt"><b>La plage</b>`
        + `<span>${esc(Plage.phrasePlage(pz.resumes))}</span></span>` + chevron + `</button>` : "")
      + `<div class="portes">`
        /* L'écran de questions s'ouvre d'ici.

           La seconde rangée mène à l'autre question, celle du lieu. Les deux se
           lisent comme une paire, quand et où, et gardent le même gabarit : une
           rangée pleine largeur qui porte son symbole, son titre et son
           chevron. */
        + (s ? `<button type="button" class="carte rangee porte" data-feuille="activites">`
          + ico("horloge", "") + `<span class="rangee-txt"><b>Quand faire quoi</b>`
          + `<span>Courir, étendre, aérer, arroser, laver</span></span>`
          + chevron + `</button>` : "")
        + `<button type="button" class="carte rangee porte" data-feuille="beautemps">`
        + ico("lieu", "") + `<span class="rangee-txt"><b>Où est le beau temps</b>`
        + `<span>Mes lieux, et cent kilomètres à la ronde</span></span>`
        + chevron + `</button>`
        /* La troisième porte : ce qui entre dans les poumons, que le temps
           qu'il fait ne dit pas. */
        + `<button type="button" class="carte rangee porte" data-feuille="air">`
        + ico("brume", "") + `<span class="rangee-txt"><b>L'air qu'on respire</b>`
        + `<span>Indice européen, polluants et pollens</span></span>`
        + chevron + `</button>`
        /* La quatrième porte : la même journée, mais replacée dans
           quatre-vingts ans de relevés au même endroit. */
        + `<button type="button" class="carte rangee porte" data-feuille="climat">`
        + ico("jauge", "") + `<span class="rangee-txt"><b>Le climat d'ici</b>`
        + `<span>Records, normales et réchauffement</span></span>`
        + chevron + `</button>`
        + `</div>`
      ;

    corps += `<div class="ecran-corps">`
      + panneauVigilance()
      + panneauPluieProche()
      /* Sous les avis urgents, la bande horaire, puis les conseils du jour,
         puis les tuiles des paramètres : l'ordre du second dessin, jalon 11,
         demandé par Jérôme le 24 septembre 2026. Les quatre portes ferment la
         page, voir plus bas. */
      + bloc("jour", "Aujourd'hui",
        /* La bande horaire : l'évolution de la journée d'un coup d'œil, qu'il
           fallait aller chercher dans « Le temps ». Jalon 10, lot 1. */
        Bande.bandeHoraire(s, g)
        + (lJour.length ? `<div class="carte retenir">`
          + `<div class="conseils">${conseilsHTML(lJour)}</div></div>` : "")
        + (tuiles.length ? `<div class="bd-mesures tuiles">`
          + tuiles.map(([n, v, e, c, voie, sym, teinte, feuille]) =>
            `<button type="button" class="bd-m tuile" `
            + (feuille ? `data-feuille="${feuille}" aria-label="${esc(n)}, ${esc(v)}, ${esc(e)}, ${TUILE_VERS[feuille]}">`
              : `data-detail="${esc(voie)}" aria-label="${esc(n)}, ${esc(v)}, ${esc(e)}, voir heure par heure">`)
            + `<span class="tu-pa pa-${teinte}">${ico(sym, "")}</span>`
            + `<span class="tu-t"><i>${esc(n)}</i><b${c ? ` class="${c}"` : ""}>${valeurUnite(v)}</b>`
            + `<em>${esc(e)}</em></span>${chevronM}</button>`).join("")
          + `</div>` : ""), true);

    /* La table des moments couvre exactement les vingt-quatre heures qui
       viennent, tranche par tranche. Elle s'appelait « la journée qui vient »,
       ce qui promettait une journée civile alors qu'elle traverse minuit. */
    if (s) {
      corps += bloc("h24", "Les 24 prochaines heures", `<div class="carte">${moments(s)}</div>`);
    }

    corps += bloc("suite", titreJours(lSuite), lSuite.length
      ? `<div class="carte retenir"><div class="conseils">${conseilsHTML(lSuite)}</div></div>`
      : "");

    corps += `<div class="section" data-bloc="portes">${portesHTML}</div>`;

    const lecture = Vig.etatLecture();
    corps += `<p class="pied">Source : Open-Meteo, modèle AROME de Météo-France. `
      + `Mise à jour toutes les heures.</p>`
      /* La vigilance que le service ne rend plus, audit, constat 2.6 : une ligne
         discrète, près de la source, décision de Jérôme. */
      + (lecture.muette && Reglages.departementDu(g) ? `<p class="pied pied-vig">Vigilance Météo-France non lue`
        + (lecture.depuis ? ` depuis le ${esc(lecture.depuis.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }))} `
          + `à ${esc(heureJour(lecture.depuis))}` : "")
        + ` : le service ne répond pas.</p>` : "")
      + `</div>`;
  }

  /* La commune est dans la barre de tête, à la même place sur les cinq écrans.
     La répéter en grand titre laissait deux fois le même mot à l'écran : le
     grand titre porte donc le jour. Il est maintenant posé dans le ciel, avec
     la température et le temps qu'il fait ; il ne reste de titre d'écran que
     pour les états où le ciel manque. */
  return {
    titre: g.commune ? jour.charAt(0).toUpperCase() + jour.slice(1) : "Ma météo",
    sous: "",
    pleinCadre: plein,
    corps: bandeauMiseAJour() + bandeauHorsLigne() + corps,
    brancher(bloc) {
      Feu.poser(bloc.querySelector("#ciFeu"));
      Relief.poser(bloc.querySelector("#ciLune"));
      Temps.poser(bloc.querySelector("#ciTemps"));
    },
  };
}

/* ---------- Écrans branchés sur les vues ---------- */

const VUES_ONGLET = { temps: vueTemps, semaine: vueSemaine };

/* La carte et le ciel se chargent à la première ouverture de leur onglet : la
   carte, ses couches, le contour de la France et la voûte étoilée, environ
   quatre-vingt-dix kilooctets compressés, quittent le chemin du lancement. Ils
   restent dans la coque hors ligne. Le temps de l'import, l'écran montre le
   chargement ; un import manqué le dit et propose de recharger l'application.
   Le navigateur garde en mémoire l'échec d'un module, dépendances comprises :
   un nouvel import dans la même page échouerait sans rien relire, constaté
   le 2 octobre 2026. docs/plan-decoupage-vues.md, étape 4, version 134. */
const DIFFERES = {
  ciel: { titre: "Le ciel", charger: () => import("./vues/etoiles.js").then(m => m.vueCiel) },
  carte: { titre: "La carte", charger: () => import("./vues/carte.js").then(m => m.vueCarte) },
};
const differesEnCours = new Set();
const differesManques = new Set();
function chargerDiffere(nom) {
  if (differesEnCours.has(nom) || differesManques.has(nom)) return;
  differesEnCours.add(nom);
  DIFFERES[nom].charger()
    .then(v => { VUES_ONGLET[nom] = v; }, () => { differesManques.add(nom); })
    .finally(() => { differesEnCours.delete(nom); if (onglet === nom && !detail) rendre(); });
}
function ecranDiffere(nom) {
  const manque = differesManques.has(nom);
  chargerDiffere(nom);
  return {
    titre: DIFFERES[nom].titre,
    corps: manque
      ? `<div class="etat-vide" data-differe-manque><h2>Écran indisponible</h2>`
        + `<p>Cet écran n'a pas pu se charger.</p>`
        + `<button type="button" class="bouton-plein" data-action="recharger">Recharger l'application</button></div>`
      : `<div class="etat-vide" data-differe><div class="tourne" role="progressbar" aria-label="Chargement"></div>`
        + `<p>Ouverture de l'écran.</p></div>`,
  };
}

/* Un écran peut demander une relecture de la prévision, non seulement un rendu :
   la carte bascule de commune depuis un repère, comme la liste des lieux le fait
   depuis une rangée. Les feuilles avaient déjà cette voie, les écrans non. */
function ecranVue(nom) {
  if (!VUES_ONGLET[nom]) return ecranDiffere(nom);
  const f = VUES_ONGLET[nom](ctx, o => {
    /* La carte ouvre un lieu en consultation : la prévision se relit et
       l'accueil s'ouvre sur elle. */
    if (o?.accueil) { poserOnglet("accueil"); charger(); return; }
    if (o?.recharger) { charger(); return; }
    rendre();
  }, majEtat);
  return {
    titre: f.titre,
    /* La carte ne défile pas : elle occupe ce qui reste entre les deux barres,
       et le doigt qui glisse la déplace. */
    carte: f.carte === true,
    /* Le plein cadre porte son propre titre, dans le ciel : la coque ne pose
       pas le sien par-dessus. */
    pleinCadre: f.pleinCadre === true,
    large: f.large === true,
    cote: f.cote || "",
    /* La commune est dans la barre de tête : la répéter sous chaque titre
       d'écran occupait une ligne pour une information déjà présente. */
    sous: f.sousEcran || "",
    corps: bandeauMiseAJour() + bandeauHorsLigne() + f.corps,
    brancher: f.brancher,
  };
}

/* ---------- Le jeton du rappel de parapluie ---------- */

/* Le jeton se pose dans la barre de tête, à la même place sur les cinq écrans.
   Le silence est l'état par défaut : une journée sèche, une période d'alerte
   déjà passée ou un jeton déjà pris ne font rien paraître.

   Il écrit les heures de la pluie et non l'instant d'alerte : c'est la pluie
   qu'on veut situer, l'alerte étant seulement le moment où on la dit.

   Il se recalcule à chaque rendu et non une fois pour toutes : le rendu suit le
   changement de commune, la fin d'une période et la prise du jeton. */
function poserJeton() {
  const bouton = $("navJeton");
  const j = charge === "pret"
    ? Parapluie.jeton(P.serieHorizon(), Reglages.alertes(Parapluie.ALERTES_DEFAUT))
    : null;
  ctx.jeton = j;
  const lieu = Reglages.lire();
  ctx.commune = lieu.commune || "";
  /* Le point de la commune, pour les feuilles qui lisent une source à la
     demande plutôt qu'au chargement : l'indice officiel de la qualité de
     l'air, dont le service met une vingtaine de secondes. */
  ctx.lat = lieu.lat;
  ctx.lon = lieu.lon;
  const vu = !!j && !Reglages.jetonPris(j.cle);
  bouton.hidden = !vu;
  if (!vu) return;
  $("navJetonIco").innerHTML = ico(j.objet, "");
  $("navJetonTxt").textContent = Parapluie.fenetreTxt(j.h0, j.h1);
  bouton.setAttribute("aria-label", `${Parapluie.motDe(j)}. Ouvrir le rappel.`);
}

/* ---------- Rendu de l'écran courant ---------- */

/* Le focus survit aux rendus, audit du 1er octobre 2026, constat 4.6. Chaque
   rendu remplace tout le contenu de l'écran ou de la feuille : l'élément qui
   avait le focus disparaissait, et VoiceOver retombait au début de la page.
   L'élément se reconnaît à son identifiant, sinon à ses attributs `data-*` ;
   son pendant dans le nouveau contenu reprend le focus, sans défilement. */
function cleFocus(el) {
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const donnees = [...el.attributes].filter(a => a.name.startsWith("data-"))
    .map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join("");
  return donnees ? `${el.tagName.toLowerCase()}${donnees}` : null;
}
function garderFocus(racine, remplacer) {
  const a = document.activeElement;
  const cle = a && racine.contains(a) && a !== racine ? cleFocus(a) : null;
  remplacer();
  if (!cle) return;
  const b = racine.querySelector(cle);
  if (b && document.activeElement !== b) b.focus({ preventScroll: true });
}

function rendre() {
  const ecran = $("ecran");
  const situe = Reglages.situe();
  const nom = ONGLETS.find(o => o[0] === onglet)?.[2] || "";

  /* Le jeton se pose avant que l'écran ne se bâtisse : la réponse du matin le
     reprend du contexte, et le calculer après lui donnerait celui du rendu
     précédent. */
  poserJeton();

  let f;
  if (!situe) {
    f = {
      titre: nom === "Accueil" ? "Ma météo" : nom,
      sous: "",
      corps: etatVide("lieu", "Aucune commune",
        "La prévision se lit pour une commune de France métropolitaine.",
        "Choisir une commune", "Utiliser ma position"),
    };
  } else if (charge === "chargement" && !P.chargeCourante()) {
    f = {
      titre: nom, sous: "",
      corps: onglet === "accueil" ? ossatureAccueil() : etatChargement(),
    };
  } else if (detail) {
    f = ecranVue("temps");
    f.retour = true;
    f.retourVers = (ONGLETS.find(o => o[0] === onglet) || [, , "Accueil"])[2];
  } else if (onglet === "accueil") {
    f = ecranAccueil();
  } else {
    f = ecranVue(onglet);
  }

  /* Le rendu remplace l'écran entier : sans cette précaution, agrandir une voie
     du ruban renverrait la page en haut. */
  const y = window.scrollY;

  /* En mode position, la barre de tête porte la commune relevée et une cible :
     le nom dit où l'appareil se trouve, la cible dit qu'il suivra. */
  const g = Reglages.lire();
  const enPos = Reglages.enPosition();
  /* Le bandeau de consultation, jalon 19, lot 4 : le lieu touché sur la carte
     se lit sans changer la commune suivie. */
  const consulte = Reglages.consultation();
  $("navConsult").hidden = !consulte;
  document.documentElement.classList.toggle("en-consultation", !!consulte);
  if (consulte) {
    $("navConsultTxt").innerHTML = `Vous consultez <b>${esc(g.commune || "ce lieu")}</b>`;
    $("navRevenir").textContent = consulte.auto ? "Revenir à ma position"
      : consulte.commune ? `Revenir à ${consulte.commune}` : "Revenir";
  }
  $("navLieuNom").textContent = enPos
    ? (g.commune || "Ma position") : (Reglages.nomAffiche(g) || "Ma météo");
  $("navPos").hidden = !enPos;
  /* Le département sous la commune, d'après la troisième maquette : il lève
     l'ambiguïté des homonymes. Il se déduit du code postal, et son nom vient
     de la table de la vigilance, qui porte les cent un départements. */
  const nomDep = Vig.nomDe(Reglages.departementDu(g));
  $("navLieuDep").textContent = nomDep || "";
  $("navLieuDep").hidden = !nomDep;
  $("navLieu").hidden = false;
  ecran.classList.toggle("plein-cadre", f.pleinCadre === true);
  ecran.classList.toggle("ecran-carte", f.carte === true);
  ecran.classList.toggle("ecran-large", f.large === true);
  ecran.classList.toggle("ecran-detail", f.retour === true);
  garderFocus(ecran, () => {
    ecran.innerHTML = (f.pleinCadre || f.carte ? "" : titreEcran(f.titre, f.sous, f.cote))
      + f.corps;
  });
  /* Le retour d'une page de détail prend, dans la barre de tête, la place du
     nom de la commune, comme dans les pages d'iOS. Posé au-dessus du titre, il
     descendait le ruban d'une ligne sous la ligne de flottaison. */
  const ancienRetour = $("btnRetour");
  if (ancienRetour) ancienRetour.remove();
  if (f.retour) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "retour nav-retour"; b.id = "btnRetour";
    b.innerHTML = ico("chevron_bas", "retour-ic") + `<span>${esc(f.retourVers || "Accueil")}</span>`;
    b.addEventListener("click", () => history.back());
    $("navLieu").before(b);
    $("navLieu").hidden = true;
  }
  if (typeof f.brancher === "function") f.brancher(ecran);
  if (y) window.scrollTo({ top: y, behavior: "instant" });

  const reessayer = ecran.querySelector("#btnReessayer");
  if (reessayer) {
    reessayer.addEventListener("click", () => {
      reessayer.setAttribute("aria-busy", "true");
      reessayer.textContent = "Lecture…";
      charger();
    });
  }

  majPose();
}

function poserOnglet(nom) {
  if (!ONGLETS.some(o => o[0] === nom)) return;
  const change = nom !== onglet;
  /* Un second appui sur La carte, déjà ouverte, efface le cadrage gardé : la
     carte revient sur la France entière. Venir d'un autre onglet la rouvre où
     on l'avait laissée, depuis la version 153, jalon 19, lot 7, demande de
     Jérôme ; avant, tout appui la ramenait sur la France. Sur les autres
     écrans, l'appui répété n'a rien à défaire. */
  if (nom === "carte" && onglet === "carte") { ctx.cadreCarte = null; Reglages.poserVueCarte(null); }
  /* Le plein écran de la carte ne survit pas au départ de la carte. */
  if (nom !== "carte") document.documentElement.classList.remove("carte-plein");
  /* Toucher un onglet referme la page de détail, comme sur iPhone : l'onglet
     courant ramène à sa racine. Le pas d'historique que la page avait posé est
     retiré aussi : laissé en place, il décalait tout retour suivant d'un cran,
     et la feuille ouverte ensuite ne se refermait plus au retour. */
  if (detail) { detail = null; history.back(); }
  onglet = nom;
  for (const b of $("onglets").children) {
    const actif = b.dataset.onglet === onglet;
    if (actif) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  rendre();
  if (change) window.scrollTo({ top: 0, behavior: "instant" });
}

/* ---------- Couche navigation ---------- */

$("onglets").innerHTML = ONGLETS.map(([cle, symbole, nom]) =>
  `<button type="button" class="onglet" data-onglet="${cle}"`
  + `${cle === onglet ? ' aria-current="page"' : ""}>`
  + ico(symbole, "") + `<span>${esc(nom)}</span></button>`).join("");

$("onglets").addEventListener("click", ev => {
  const b = ev.target.closest("[data-onglet]");
  if (b) poserOnglet(b.dataset.onglet);
});

/* Le grand titre se replie dans la barre de tête au défilement.

   Sur un écran à bandeau plein cadre, c'est le ciel qui passe sous la barre :
   elle reste transparente et blanche tant qu'il est dessous, et ne reprend sa
   matière de verre qu'une fois le bandeau dépassé. */
function majPose() {
  const nav = $("nav");
  const hauteurNav = nav.getBoundingClientRect().height;
  const ciel = $("ecran").querySelector(".ci");

  if (ciel) {
    const surCiel = ciel.getBoundingClientRect().bottom > hauteurNav;
    nav.classList.toggle("sur-ciel", surCiel);
    nav.classList.toggle("pose", !surCiel);
    return;
  }

  nav.classList.remove("sur-ciel");
  const h1 = $("ecran").querySelector(".titre-ecran h1");
  if (!h1) { nav.classList.remove("pose"); return; }
  const bas = h1.getBoundingClientRect().bottom;
  nav.classList.toggle("pose", bas < hauteurNav);
}
window.addEventListener("scroll", majPose, { passive: true });
window.addEventListener("resize", majPose);

/* La fenêtre du ruban vaut vingt-quatre heures en portrait et quarante-huit dès
   que la largeur le permet : basculer l'appareil change donc le dessin, non la
   seule mise en page. Le rendu se refait au passage du seuil, pas à chaque
   pixel de redimensionnement. */
let largeAvant = Ruban.fenetre(), traitAvant = Ruban.largeurVoulue();
window.addEventListener("resize", () => {
  /* La largeur du dessin suit aussi celle de l'écran : le rendu se refait
     quand elle change, et pas seulement au passage de la fenêtre de vingt-quatre
     à quarante-huit heures. Le ruban ouvert en page de détail depuis l'accueil
     se refait comme sur l'onglet. */
  const f = Ruban.fenetre(), l = Ruban.largeurVoulue();
  if (f === largeAvant && Math.abs(l - traitAvant) < 8) return;
  largeAvant = f; traitAvant = l;
  if (detail) rendre();
});

/* La hauteur réelle de la barre d'onglets dépend de la taille du texte : elle se
   mesure plutôt que de se supposer, sinon le pied de page passe dessous. */
function majHauteurOnglets() {
  const h = $("onglets").offsetHeight;
  if (h) document.documentElement.style.setProperty("--onglets-mesure", `${h}px`);
}
new ResizeObserver(majHauteurOnglets).observe($("onglets"));
majHauteurOnglets();

/* ---------- Situer par la position ---------- */

/* Le geste vient de l'utilisateur, la demande de position aussi : les deux
   navigateurs exigent ce lien direct. */
async function situerParPosition(bouton) {
  if (bouton) { bouton.disabled = true; bouton.setAttribute("aria-busy", "true"); }
  majEtat("Recherche de la position…");
  try {
    await Reglages.releverPosition();
    majEtat("");
    sentir(10);
    charger();
  } catch (e) {
    majEtat(e.message, { erreur: true });
  } finally {
    if (bouton) { bouton.disabled = false; bouton.removeAttribute("aria-busy"); }
  }
}

/* ---------- Suivi de la position ----------

   En mode position, le lieu courant suit l'appareil. Le relevé silencieux ne
   part que si l'autorisation est déjà accordée : sans geste de l'utilisateur,
   une première demande au chargement serait rejetée. La prévision n'est relue
   que si l'appareil a bougé de plus d'un demi-kilomètre, en deçà duquel elle
   est identique et la requête serait perdue. */

const BOUGE = 500;                 // mètres
const FRAICHE = 10 * 60 * 1000;    // un relevé plus récent que cela suffit

let releveEnCours = false;

async function suivrePosition({ force } = {}) {
  if (!Reglages.enPosition() || releveEnCours) return false;
  const dernier = Reglages.position();
  if (!force && dernier && Date.now() - dernier.t < FRAICHE) return false;
  if (!await Reglages.positionAutorisee()) return false;
  /* Le déplacement se mesure sur les relevés précis, qui restent sur
     l'appareil ; la position publique, arrondie au kilomètre, ne le dirait
     qu'à un kilomètre près. */
  const avant = Reglages.releve() || dernier;
  releveEnCours = true;
  try {
    await Reglages.releverPosition();
    const bouge = !avant || Reglages.ecart(avant, Reglages.releve()) > BOUGE;
    if (bouge) charger(); else rendre();
    return bouge;
  } catch {
    return false;   // position devenue indisponible : le dernier relevé reste servi
  } finally {
    releveEnCours = false;
  }
}

/* ---------- Couche superposition ---------- */

const FEUILLES = { vigilance: vueVigilance, communes: vueCommunes,
  ajout: vueAjout, reglages: vueReglages, parapluie: vueParapluie,
  ressenti: vueRessenti, activites: vueActivites, beautemps: vueBeauTemps,
  air: vueAir, climat: vueClimat, neige: vueNeige, plage: vuePlage, eau: vueEau };

/* Accroches : un contenu court n'occupe pas tout l'écran. */
const ACCROCHE = { vigilance: "moyenne", communes: "grande",
  ajout: "grande", reglages: "grande", parapluie: "moyenne",
  ressenti: "moyenne", activites: "moyenne", beautemps: "grande",
  air: "grande", climat: "grande" };

function rendreFeuille() {
  if (!vueCourante) return;
  const f = FEUILLES[vueCourante](ctx, options => {
    /* Le retour sensoriel accompagne une sélection décidée par l'utilisateur,
       jamais un rendu automatique. */
    if (options?.recharger) { sentir(10); fermerFeuille(); charger(); return; }
    /* La feuille se ferme et l'écran se refait : ce qui vient d'être décidé
       dedans se voit dehors, le jeton pris quittant la barre de tête. */
    if (options?.ecran) { sentir(10); fermerFeuille(); rendre(); return; }
    if (options?.fermer) { fermerFeuille(); return; }
    /* L'écran de dessous se refait avec la feuille, laquelle reste ouverte : un
       réglage change à la fois ce que la feuille écrit et la barre de tête. */
    if (options?.dessous) rendre();
    rendreFeuille();
  }, majEtat);
  $("feuille-titre").innerHTML = esc(f.titre)
    + (f.sous ? `<span>${esc(f.sous)}</span>` : "");
  /* La tête de feuille peut porter une action à droite du titre : c'est là que
     se range ce qui crée, plutôt que dans une carte au bas de la liste. */
  const action = $("feuille-action");
  action.innerHTML = f.action || "";
  const corps = $("feuille-corps");
  garderFocus(corps, () => { corps.innerHTML = f.corps; });
  if (typeof f.brancher === "function") f.brancher(corps);
  for (const b of [...corps.querySelectorAll("[data-feuille]"),
    ...action.querySelectorAll("[data-feuille]")]) {
    b.addEventListener("click", () => ouvrirFeuille(b.dataset.feuille));
  }
}

let ouvreur = null, cleOuvreur = null;
function ouvrirFeuille(vue, enRetour) {
  if (!FEUILLES[vue]) return;
  /* La feuille est ouverte tant qu'une vue est courante. L'attribut hidden ne
     le dit pas à temps : il tombe une image après l'ouverture et revient
     260 ms après la fermeture. Une fermeture demandée avant cette image était
     annulée par l'ouverture en attente, et une réouverture pendant ces 260 ms
     se perdait. */
  const dejaOuverte = vueCourante !== null;
  if (!enRetour && dejaOuverte) pile.push(vueCourante);
  vueCourante = vue;
  rendreFeuille();
  $("feuille").classList.toggle("moyenne", ACCROCHE[vue] === "moyenne");
  $("feuille-retour").hidden = !pile.length;
  $("feuille-corps").scrollTop = 0;

  if (!dejaOuverte) {
    /* Le bouton qui ouvre la feuille reprend le focus à sa fermeture, et le
       reste de la page devient inerte tant qu'elle est ouverte : la tabulation
       en sortait. Audit, constat 4.6. */
    ouvreur = document.activeElement !== document.body ? document.activeElement : null;
    cleOuvreur = cleFocus(ouvreur);
    for (const id of ["ecran", "nav", "onglets"]) $(id).inert = true;
    $("voile").hidden = false;
    $("feuille").hidden = false;
    document.body.classList.add("fige");
    requestAnimationFrame(() => {
      if (vueCourante === null) return;
      $("voile").classList.add("visible");
      $("feuille").classList.add("ouverte");
      $("feuille").focus();
    });
    history.pushState({ feuille: true }, "");
  }
}

function fermerFeuille() {
  const f = $("feuille");
  if (vueCourante === null) return;
  f.classList.remove("ouverte");
  $("voile").classList.remove("visible");
  document.body.classList.remove("fige");
  /* Une fois refermée, la feuille se vide : son contenu masqué restait dans la
     page, et les réglages y doublaient par exemple le sélecteur « Ruban » de
     l'écran du temps. Elle ne se vide que si rien ne l'a rouverte entre-temps. */
  setTimeout(() => {
    if (vueCourante !== null) return;
    f.hidden = true; $("voile").hidden = true;
    $("feuille-corps").innerHTML = "";
  }, 260);
  pile = [];
  vueCourante = null;
  for (const id of ["ecran", "nav", "onglets"]) $(id).inert = false;
  const retourFocus = ouvreur?.isConnected ? ouvreur : (cleOuvreur && document.querySelector(cleOuvreur));
  (retourFocus || $("ecran")).focus({ preventScroll: true });
  ouvreur = null; cleOuvreur = null;
}

function retour() {
  const v = pile.pop();
  if (!v) { fermerFeuille(); return; }
  ouvrirFeuille(v, true);
  $("feuille-retour").hidden = !pile.length;
}

/* Fermeture au doigt, par la poignée. La feuille suit le doigt sans
   amortissement pendant le geste, et se ferme au delà du quart de sa hauteur ou
   sur un geste rapide. */
function brancherGlissement() {
  const f = $("feuille");
  const poignee = f.querySelector(".feuille-poignee");
  let y0 = 0, t0 = 0, actif = false;

  const debut = ev => {
    actif = true; y0 = ev.clientY; t0 = Date.now();
    f.classList.add("suit");
    poignee.setPointerCapture?.(ev.pointerId);
  };
  const bouge = ev => {
    if (!actif) return;
    const dy = Math.max(0, ev.clientY - y0);
    f.style.transform = window.innerWidth >= 560
      ? `translate(-50%, ${dy}px)` : `translateY(${dy}px)`;
  };
  const fin = ev => {
    if (!actif) return;
    actif = false;
    f.classList.remove("suit");
    const dy = Math.max(0, ev.clientY - y0);
    const vite = dy / Math.max(1, Date.now() - t0) > 0.5;
    f.style.transform = "";
    if (dy > f.offsetHeight / 4 || vite) history.back();
  };

  poignee.addEventListener("pointerdown", debut);
  poignee.addEventListener("pointermove", bouge);
  poignee.addEventListener("pointerup", fin);
  poignee.addEventListener("pointercancel", fin);
}

/* ---------- Chargement ---------- */

/* Deux lectures peuvent se chevaucher, la position pouvant en déclencher une
   pendant qu'une autre court. Seule la plus récente écrit l'écran. */
let generation = 0;

/* Les sources secondaires arrivent l'une après l'autre dans les premières
   secondes, et chacune redessinait tout l'écran : treize à quinze rendus
   complets au lancement, toiles du ciel recréées à chaque fois. Leurs rendus
   se regroupent en un seul par image d'écran ; page masquée, il attend son
   retour au premier plan. Audit du 1er octobre 2026, constat 5.2. */
let rafraichissement = 0;
function rafraichir() {
  if (rafraichissement) return;
  rafraichissement = requestAnimationFrame(() => {
    rafraichissement = 0;
    rendre();
    if (vueCourante) rendreFeuille();
  });
}

/* La vigilance en vigueur, gardée pour le rendu qui est synchrone. Elle se lit
   après la prévision, sans la retarder : un bulletin manquant ne doit pas
   priver l'écran de son temps qu'il fait. */
async function lireVigilance() {
  const dep = Reglages.departementDu(Reglages.lire());
  const mien = generation;
  const v = await Vig.lire(dep);
  if (mien !== generation) return;
  const change = JSON.stringify(v) !== JSON.stringify(vigilance);
  vigilance = v;
  ctx.vigilance = v;
  /* Un service devenu muet, ou revenu, se dit en pied de page : le rendu se
     refait aussi quand seul cet état change. */
  const muette = Vig.etatLecture().muette;
  const bascule = muette !== vigilanceMuette;
  vigilanceMuette = muette;
  if (change || bascule) rafraichir();
}

async function charger() {
  const g = Reglages.lire();
  const mien = ++generation;
  /* La garde de la vigilance porte le département dans sa clé : un changement de
     commune sert le même bulletin quand il reste dans le même département, et
     en lit un autre sinon. L'oubli systématique qui se faisait ici relisait le
     bulletin à chaque chargement et défaisait la garde calée sur la
     publication. */
  vigilance = null;
  ctx.vigilance = null;
  if (!Reglages.situe()) { charge = "vide"; rendre(); return; }
  charge = "chargement";
  rendre();
  const r = await P.charger({ lat: g.lat, lon: g.lon });
  if (mien !== generation) return;
  charge = r ? "pret" : "erreur";
  rendre();
  if (vueCourante) rendreFeuille();
  nommerPosition();
  lireVigilance();
  lireEnsemble(g);
  lireScenarios(g);
  lireNeigeDe(g);
  lirePlageDe(g);
  lireEauDe(g);
  lireAir(g);
  lirePluieProche(g);
  /* Le journal de justesse note ce qui vient d'être servi. Il n'affiche rien et
     ne conditionne rien : il est appelé après le rendu, une charge en échec ne
     lui donnant du reste rien à noter. */
  if (r) Justesse.noter(r, Justesse.lieuDe(g.lat, g.lon));
}

/* Les scénarios se lisent après la prévision et sans la retarder : ils ajoutent
   une marge à ce qui est déjà à l'écran, et une source d'ensemble muette ne doit
   pas priver l'application de son temps qu'il fait. La requête ne part que pour
   la commune affichée. */
/* Les scénarios quotidiens des deux modèles, jalon 13 : ils règlent la
   confiance de La semaine, et se lisent eux aussi sans retarder la prévision. */
/* La neige des stations proches, jalon 16 : lue elle aussi sans retarder la
   prévision. Les stations proches se gardent trente jours, la neige une heure. */
async function lireNeigeDe(g) {
  const mien = generation;
  try { await Neige.chargerNeige(g, cleHeure()); } catch { return; }
  if (mien !== generation) return;
  rafraichir();
}

/* La mer des plages proches, jalon 15 : lue elle aussi sans retarder la
   prévision. */
async function lirePlageDe(g) {
  const mien = generation;
  try { await Plage.chargerPlage(g, cleHeure()); } catch { return; }
  if (mien !== generation) return;
  rafraichir();
}

/* L'eau de la commune, jalon 18 : la restriction en vigueur et la nappe la plus
   proche, lues sans retarder la prévision. */
async function lireEauDe(g) {
  const mien = generation;
  /* La rivière arrive après, plus lente : elle redessine à son arrivée. */
  const surRiviere = () => { if (mien === generation) rafraichir(); };
  try { await Eau.chargerEau(g, cleHeure().slice(0, 10), fetch, surRiviere); } catch { return; }
  if (mien !== generation) return;
  rafraichir();
}

async function lireScenarios(g) {
  const mien = generation;
  const d = await Scenarios.charger({ lat: g.lat, lon: g.lon });
  if (mien !== generation || !d) return;
  if (semaineEstEtendue()) await Scenarios.chargerTendance(g);
  if (mien !== generation) return;
  if (onglet === "semaine") rendre();
}

async function lireEnsemble(g) {
  const mien = generation;
  const d = await Ensemble.charger({ lat: g.lat, lon: g.lon });
  if (mien !== generation || !d) return;
  rafraichir();
  /* Le journal a déjà écrit ses lignes sans les scénarios, la prévision étant
     servie la première. Il repasse pour y poser la part des scénarios mouillés,
     à côté de la probabilité de la source. */
  const c = P.chargeCourante();
  if (c) Justesse.noter(c, Justesse.lieuDe(g.lat, g.lon), new Date(), d);
}

/* L'air se lit après la prévision et sans la retarder, comme les scénarios. Une
   source muette ne prive de rien : le temps qu'il fait est déjà à l'écran, la
   feuille de l'air dit que la source est muette, et la règle d'aération reprend
   sa forme d'avant, sans condition sur l'air. */
async function lireAir(g) {
  const mien = generation;
  const d = await Air.charger({ lat: g.lat, lon: g.lon });
  if (mien !== generation || !d) return;
  rafraichir();
}

/* La pluie dans l'heure, gardée pour le rendu qui est synchrone. Comme la
   vigilance et l'air, elle se lit après la prévision et sans la retarder : un
   produit muet ne doit pas priver l'écran de son temps qu'il fait. */
async function lirePluieProche(g) {
  const mien = generation;
  const d = await Pluie.charger(g.lat, g.lon);
  if (mien !== generation) return;
  pluieProche = d;
  ctx.pluieProche = d;
  rafraichir();
  lireDeplacement(g);
}

/* D'où vient la pluie. La mesure ne part que si le panneau a quelque chose à
   dire : elle coûte l'index du radar et deux tuiles, une soixantaine de
   kilooctets, et les jours secs elle ne coûte rien du tout.

   Elle ne dit jamais quand la pluie arrive. Cette réponse est celle du produit
   de Météo-France, juste au-dessus dans le même panneau, et deux réponses à la
   même question finiraient par se contredire. */
async function lireDeplacement(g) {
  deplacement = null;
  if (!pluieProche || !pluieProche.dispo || !Pluie.evenement(pluieProche)) return;
  const mien = generation;
  try {
    const idx = await Radar.charger();
    if (mien !== generation || !idx || !idx.images) return;
    const observees = idx.images.filter(x => !x.futur);
    const d = await Deplacement.lire(g.lat, g.lon, idx.hote, observees);
    if (mien !== generation || !d) return;
    deplacement = d;
    rendre();
  } catch { /* la pluie se lit sans son sens d'arrivée */ }
}

/* Le relevé peut avoir abouti alors que l'interface adresse était muette : la
   prévision est juste, mais la barre de tête ne nomme pas la commune servie.
   Le nom se rattrape seul, sans redemander la position à l'appareil. */
async function nommerPosition() {
  if (!Reglages.enPosition()) return;
  const p = Reglages.position();
  if (!p || p.lat === null || p.commune) return;
  const mien = generation;
  const r = Reglages.releve() || p;
  const l = await Reglages.communeDe(r.lat, r.lon);
  if (mien !== generation || !l) return;
  Reglages.nommerPosition(l);
  rendre();
  lireVigilance();
}

/* ---------- Amorçage ---------- */

$("btnReglages").addEventListener("click", () => ouvrirFeuille("reglages"));
/* Les deux boutons du bandeau de consultation. */
$("navSuivre").addEventListener("click", () => { sentir(10); Reglages.suivreConsulte(); charger(); });
$("navRevenir").addEventListener("click", () => { sentir(10); Reglages.revenir(); charger(); });
$("navLieu").addEventListener("click", () => ouvrirFeuille("communes"));
$("navJeton").addEventListener("click", () => { sentir(8); ouvrirFeuille("parapluie"); });
$("feuille-fermer").addEventListener("click", () => history.back());
$("feuille-retour").addEventListener("click", retour);
$("voile").addEventListener("click", () => history.back());

/* Un chiffre de l'accueil mène à ses vingt-quatre heures : l'écran du temps
   s'ouvre en ruban, sur la voie correspondante déjà dépliée, et la page se
   place dessus. */
/* « Le temps » en page de détail, jalon 10, lot 5. Depuis l'accueil, le détail
   s'ouvre comme une page d'iPhone : l'onglet Accueil reste le courant, un
   retour en haut à gauche ramène à l'accueil à l'endroit qu'on avait quitté,
   et l'historique du navigateur porte ce pas pour le geste de retour. Une
   heure touchée dans la bande cale le ruban sur elle : sa lecture s'y pose, et
   la fenêtre glisse si l'heure tombe au-delà. Depuis un autre écran, rien ne
   change encore : l'onglet « Le temps » existe jusqu'au lot 6. La variable
   `detail` est déclarée en tête, près de l'onglet courant : le premier rendu
   la lit avant que le fichier n'arrive ici. */

function quitterDetail() {
  if (!detail) return;
  const y = detail.y;
  detail = null;
  rendre();
  window.scrollTo({ top: y, behavior: "instant" });
}

/* « Le temps » tel qu'on l'a laissé, ruban ou liste, sans voie imposée : le
   lien « Plus de détails » de la bande. */
function ouvrirLeTemps() {
  sentir(8);
  Ruban.poserHeure(-1);
  detail = { y: window.scrollY };
  history.pushState({ detail: true }, "");
  rendre();
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* Une journée de La semaine ouvre « Le temps » calé sur elle : la fenêtre du
   ruban commence à son minuit. Jalon 12, lot 5. */
function ouvrirJour(jour) {
  ouvrirLeTemps();
  const sr = Ruban.serieCourante();
  if (!sr) return;
  /* Le ruban compte ses heures depuis le début de l'heure en cours : l'écart se
     mesure depuis lui. Mesuré depuis l'instant présent et arrondi, il ouvrait
     la fenêtre à 23 h la veille. */
  const debutHeure = new Date();
  debutHeure.setMinutes(0, 0, 0);
  const h = Math.round((new Date(`${jour}T00:00`) - debutHeure) / 3600000);
  const cible = Math.max(0, Math.min(sr.n - 1, sr.ici + h));
  Ruban.glisser(cible - Ruban.decalageCourant());
  rendre();
}

function allerAuDetail(cle, heure = null) {
  Reglages.poserEcriture("ruban");
  Ruban.poserVoie(cle);
  sentir(8);
  /* Depuis le 25 septembre 2026, la page de détail s'ouvre dans l'onglet où
     l'on se trouve, et non plus seulement sur l'accueil : l'onglet « Le temps »
     n'existe plus. */
  {
    /* Sans heure désignée, aucune lecture ne reste d'une ouverture précédente. */
    if (heure === null) Ruban.poserHeure(-1);
    detail = { y: window.scrollY };
    history.pushState({ detail: true }, "");
    rendre();
    window.scrollTo({ top: 0, behavior: "instant" });
    if (heure !== null) {
      const sr = Ruban.serieCourante();
      if (sr) {
        const cible = Math.min(sr.n - 1, sr.ici + heure);
        const fin = Ruban.decalageCourant() + Ruban.fenetre() - 1;
        if (cible > fin) Ruban.glisser(cible - fin);
        Ruban.poserHeure(cible);
        rendre();
      }
    }
  }
}

$("ecran").addEventListener("click", ev => {
  const f = ev.target.closest("[data-feuille]");
  if (f) { ouvrirFeuille(f.dataset.feuille); return; }
  if (ev.target.closest("[data-temps]")) { ouvrirLeTemps(); return; }
  /* « Voir plus » de La semaine, jalon 17 : la tendance se lit au premier
     dépliage, puis l'écran se redessine. */
  if (ev.target.closest("[data-semaine-plus]")) {
    if (basculerSemaine()) {
      const g = Reglages.lire();
      Scenarios.chargerTendance(g).finally(() => { if (onglet === "semaine") rendre(); });
    }
    rendre();
    return;
  }
  const jourH = ev.target.closest("[data-jour-heures]");
  if (jourH) { ouvrirJour(jourH.dataset.jourHeures); return; }
  const d = ev.target.closest("[data-detail]");
  if (d) {
    allerAuDetail(d.dataset.detail, d.dataset.heure != null ? Number(d.dataset.heure) : null);
    return;
  }
  const a = ev.target.closest('[data-action="geo"]');
  if (a) situerParPosition(a);
  if (ev.target.closest('[data-action="recharger"]')) location.reload();
});

window.addEventListener("keydown", ev => {
  if (ev.key === "Escape" && vueCourante !== null) history.back();
});

window.addEventListener("popstate", () => {
  if (vueCourante !== null) { if (pile.length) retour(); else fermerFeuille(); return; }
  if (detail) quitterDetail();
});

for (const ev of ["online", "offline"]) window.addEventListener(ev, () => rendre());

brancherGlissement();

/* Le retour au premier plan relit la charge quand l'heure a changé, et relève
   d'abord la position : revenir dans l'application après un trajet doit rendre
   le temps qu'il fait là où l'on est. Un relevé qui déplace la prévision la
   recharge lui-même, sans quoi elle serait lue deux fois. */
P.surRetourAuPremierPlan(async () => {
  if (await suivrePosition({ force: true })) return;
  charger();
});

/* La vigilance suit son propre rythme, celui des publications de 06 h et 16 h,
   et non celui de l'heure ronde. Le retour au premier plan la relit : rouvrir
   l'application à 16 h 10 doit rendre le bulletin de 16 h, même si la prévision
   de l'heure en cours est encore bonne. La garde décide seule s'il faut
   toucher au réseau, et un retour sous garde tenue ne coûte rien. */
document.addEventListener("visibilitychange", () => {
  if (document.hidden || charge !== "pret") return;
  lireVigilance();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* hors ligne indisponible */ });
  });
}

/* La recherche d'une version plus récente : quelques secondes après
   l'ouverture, pour ne pas disputer le réseau à la prévision, puis à chaque
   retour au premier plan. Le bandeau ne paraît que si la version publiée
   dépasse celle qui tourne. */
async function chercherVersion() {
  const v = await Version.plusRecente();
  if (v === versionPlusRecente) return;
  versionPlusRecente = v;
  rendre();
}
setTimeout(chercherVersion, 4000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) chercherVersion(); });

/* Les espaces insécables s'appliquent à tout texte de la page, audit,
   constat 4.12. */
surveiller();
charger();

/* La prévision du dernier relevé paraît tout de suite ; le relevé suivant part
   derrière et ne recharge l'écran que s'il déplace le lieu. */
suivrePosition();
