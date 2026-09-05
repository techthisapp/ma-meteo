/* Ma météo. Amorçage, couche navigation, écrans, coque de la feuille.

   Site statique, aucun service dorsal, aucune base de données. Trois sources :
   Open-Meteo pour la prévision, le jeu de vigilance archivée de Météo-France sur
   data.gouv.fr, et les données climatologiques de base du même producteur pour
   la pluie mesurée au poste.

   L'interface suit le design system consigné dans DESIGN-SYSTEM.md : trois
   couches, navigation par barre d'onglets, contenu posé sur le fond, feuilles
   pour les actions temporaires. */

import { nombreFr, esc, departementDe, heureJour, enumerer } from "./horloge.js";
import * as P from "./previsions.js";
import * as Reglages from "./reglages.js";
import { ico, icoTemps, icoCiel, tempsDe } from "./icones.js";
import { conseils, conseilsHTML, titreJours, LIGNES_MAX, SEUILS } from "./conseils.js";
import * as Ruban from "./ruban.js";
import * as Feu from "./feu.js";
import * as Relief from "./relief.js";
import * as Temps from "./temps.js";
import { vueTemps, vueSemaine, vueVigilance, vueCiel, vueCarte, vueCommunes, vueReglages,
  vueAjout, vueParapluie, vueRessenti, vueActivites, vueBeauTemps, vueAir,
  bandeauAccueil } from "./vues.js";
import { moments } from "./ecritures.js";
import * as Vig from "./vigilance.js";
import * as Astres from "./astres.js";
import * as Justesse from "./justesse.js";
import * as Ensemble from "./ensemble.js";
import * as Air from "./air.js";
import * as Parapluie from "./parapluie.js";
import * as Reponse from "./reponse.js";

const $ = id => document.getElementById(id);

/* Deux modules restent écrits et contrôlés sans être branchés : `vigilance.js`
   et `postes.js`. Ils lisent les jeux archivés de Météo-France sur data.gouv.fr,
   dont l'alimentation s'est interrompue. Sondé le 19 août 2026, le dernier
   bulletin de vigilance datait du 5 août et les relevés de pluie du 22 juin.

   Une application météorologique ne peut pas servir une vigilance de quatorze
   jours ni comparer une prévision du jour à une mesure de juin. La vigilance
   renvoie donc vers Météo-France, seule source à jour, et la comparaison entre
   mesure et modèle est retirée. Les deux modules se rebranchent en trois lignes
   si la synchronisation reprend. */

const ctx = {};

/* La vigilance en vigueur, gardée pour le rendu qui est synchrone. Elle se lit
   après la prévision, sans la retarder : un bulletin manquant ne doit pas
   priver l'écran de son temps qu'il fait. Le contexte la porte aussi, la
   feuille du détail lisant le même bulletin que le panneau. */
let vigilance = null;

/* ---------- État de l'application ---------- */

const ONGLETS = [
  ["accueil", "maison", "Accueil"],
  ["temps", "horloge", "Le temps"],
  ["semaine", "semaine", "La semaine"],
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

let minuteurEtat = null;
function majEtat(t) {
  const z = $("etat");
  clearTimeout(minuteurEtat);
  if (!t) { z.hidden = true; return; }
  z.textContent = t;
  z.hidden = false;
  minuteurEtat = setTimeout(() => { z.hidden = true; }, 4200);
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
    + `aria-label="${esc(fort)}, ${esc(n.conduite)}, voir le détail">`
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

       Le ressenti ne s'affiche que s'il s'écarte de la température : « Ressenti
       32° » à côté d'un maximum de 32° occupe un quart de la carte sans rien
       apprendre. La probabilité de pluie prend alors sa place, plus utile.

       L'indice UV s'écrit sans décimale : « 0,0 » donne une fausse impression de
       mesure fine.

       Une valeur ne prend une couleur que lorsqu'elle passe un seuil : colorer
       une valeur ordinaire ferait du bruit et userait le signal. Le chiffre
       porte l'information, la couleur ne fait que la doubler. */
    const pb = jh ? Math.round(jh.pb) : 0;
    const uv = jh ? Math.round(jh.uv) : 0;
    const raf = jh ? Math.round(jh.raf) : 0;
    const vent = jh ? Math.round(jh.v) : 0;
    const hum = jh ? Math.round(jh.hum) : 0;
    const res = jh ? Math.round(jh.res) : 0;

    /* Chaque mesure désigne la voie du ruban qui la déplie : un chiffre de
       l'accueil est une porte vers ses vingt-quatre heures. */
    /* Deux degrés d'écart, non un seul : le ressenti se compare ici à un maximum
       de journée, non à la valeur de l'heure, et un degré de différence entre
       deux maximums ne vaut pas la place d'une tuile. */
    const premiere = jh && Math.abs(jh.res - tx) >= 2
      ? ["Ressenti", `${res}°`, "au plus chaud",
        res >= SEUILS.chaleur ? "v-chaud" : res <= SEUILS.gel ? "v-froid" : "", "t"]
      : jh && jh.mm >= SEUILS.lame
        ? ["Pluie", `${nombreFr(jh.mm)} mm`, "aujourd'hui", jh.mm >= 5 ? "v-eau" : "", "mm"]
        : ["Pluie", `${pb} %`, "de risque", pb >= 60 ? "v-eau" : "", "mm"];

    const mesures = jh ? [
      premiere,
      ["Vent", `${vent} km/h`, `rafales ${raf} km/h`,
        raf >= SEUILS.rafale || vent >= SEUILS.ventMoyen ? "v-attention" : "", "v"],
      ["Humidité", `${hum} %`, "au plus", hum >= SEUILS.humidite ? "v-eau" : "", "hum"],
      ["Indice UV", `${uv}`, uv >= SEUILS.uv ? "élevé" : "au plus",
        uv >= 8 ? "v-brulant" : uv >= SEUILS.uv ? "v-chaud" : uv >= 3 ? "v-attention" : "", "uv"],
    ] : [];

    const chevronM = ico("chevron_bas", "bd-chev");

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
    corps += `<div class="plein" style="--ci-clarte:${bd.clarte.toFixed(3)}">`
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
      + `aria-label="Température, voir les vingt-quatre heures">`
      + `${Math.round(t)}<sup>°</sup></button>`
      + `<div class="bd-etat">`
      + `<button type="button" class="bd-ciel" data-detail="nua" `
      + `aria-label="Ciel, voir les vingt-quatre heures">${esc(lib)}</button>`
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
    const sApres = P.serieHoraire(restant + 24, 24, 12);

    /* La comparaison avec la veille ne se pose que sur la fenêtre de la journée
       en cours : c'est la seule dont l'heure en cours fasse partie. */
    /* L'air et le profil d'allergies accompagnent les trois fenêtres, comme les
       scénarios et les maxima : le moteur de règles reste une fonction de sa
       série et de ce qu'on lui passe. */
    const suivis = Air.POLLENS.map(p => p.cle).filter(Reglages.pollenSuivi);
    const lJour = sJour
      ? conseils(sJour, { evenement: prochainAstre(), aujourdhui: cejour,
        veille: P.ecartVeille(), air: Air.alignerSur(sJour), pollens: suivis }) : [];
    /* Le renversement de température ne se dit qu'avec demain : c'est de cette
       journée qu'il parle. L'évènement du Soleil, lui, ne vaut que pour les
       heures qui viennent. */
    /* Les scénarios de la journée dont parle le bloc : la fourchette du maximum
       s'écrit avec la journée qu'elle concerne, non sur l'accueil au dessus du
       grand chiffre où elle n'aurait rien à dire, la dispersion de l'heure en
       cours valant un demi-degré. */
    const lSuite = [
      ...(sDemain ? conseils(sDemain, { maxima: maximaJour(), aujourdhui: cejour,
        decalage: restant, scenarios: Ensemble.journee(d.time[i + 1]),
        medianes: Ensemble.alignerSur(sDemain)?.q.t.med,
        air: Air.alignerSur(sDemain), pollens: suivis }) : []),
      ...(sApres ? conseils(sApres, { aujourdhui: cejour, decalage: restant + 24,
        scenarios: Ensemble.journee(d.time[i + 2]),
        medianes: Ensemble.alignerSur(sApres)?.q.t.med,
        air: Air.alignerSur(sApres), pollens: suivis }) : []),
    ].sort((a, b) => b.g - a.g).slice(0, LIGNES_MAX);

    const bloc = (cle, titre, dedans) => (dedans
      ? `<div class="section" data-bloc="${cle}"><h2>${esc(titre)}</h2>${dedans}</div>` : "");

    corps += `<div class="ecran-corps">`
      + panneauVigilance()
      + bloc("jour", "Aujourd'hui",
        (mesures.length ? `<div class="bd-mesures">`
          + mesures.map(([n, v, e, c, voie]) =>
            `<button type="button" class="bd-m" data-detail="${esc(voie)}" `
            + `aria-label="${esc(n)}, ${esc(v)}, voir les vingt-quatre heures">`
            + `<i>${esc(n)}${chevronM}</i><b${c ? ` class="${c}"` : ""}>${esc(v)}</b>`
            + `<em>${esc(e)}</em></button>`).join("")
          + `</div>` : "")
        /* L'écran de questions s'ouvre d'ici, sous les mesures du jour : c'est
           là que se lit ce qui concerne la journée en cours, et la rangée est
           atteignable sans dérouler la page entière.

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
        + (lJour.length ? `<div class="carte retenir">`
          + `<div class="conseils">${conseilsHTML(lJour)}</div></div>` : ""));

    /* La table des moments couvre exactement les vingt-quatre heures qui
       viennent, tranche par tranche. Elle s'appelait « la journée qui vient »,
       ce qui promettait une journée civile alors qu'elle traverse minuit. */
    if (s) {
      corps += bloc("h24", "Les 24 prochaines heures", `<div class="carte">${moments(s)}</div>`);
    }

    corps += bloc("suite", titreJours(lSuite), lSuite.length
      ? `<div class="carte retenir"><div class="conseils">${conseilsHTML(lSuite)}</div></div>`
      : "");

    corps += `<p class="pied">Source : Open-Meteo, modèle AROME de Météo-France. `
      + `Mise à jour toutes les heures.</p>`
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
    corps: bandeauHorsLigne() + corps,
    brancher(bloc) {
      Feu.poser(bloc.querySelector("#ciFeu"));
      Relief.poser(bloc.querySelector("#ciLune"));
      Temps.poser(bloc.querySelector("#ciTemps"));
    },
  };
}

/* ---------- Écrans branchés sur les vues ---------- */

const VUES_ONGLET = { temps: vueTemps, semaine: vueSemaine, ciel: vueCiel, carte: vueCarte };

/* Un écran peut demander une relecture de la prévision, non seulement un rendu :
   la carte bascule de commune depuis un repère, comme la liste des lieux le fait
   depuis une rangée. Les feuilles avaient déjà cette voie, les écrans non. */
function ecranVue(nom) {
  const f = VUES_ONGLET[nom](ctx, o => {
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
    corps: bandeauHorsLigne() + f.corps,
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
  ctx.commune = Reglages.lire().commune || "";
  const vu = !!j && !Reglages.jetonPris(j.cle);
  bouton.hidden = !vu;
  if (!vu) return;
  $("navJetonIco").innerHTML = ico(j.objet, "");
  $("navJetonTxt").textContent = Parapluie.fenetreTxt(j.h0, j.h1);
  bouton.setAttribute("aria-label", `${Parapluie.motDe(j)}. Ouvrir le rappel.`);
}

/* ---------- Rendu de l'écran courant ---------- */

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
  $("navLieuNom").textContent = enPos
    ? (g.commune || "Ma position") : (g.commune || "Ma météo");
  $("navPos").hidden = !enPos;
  $("navLieu").hidden = false;
  ecran.classList.toggle("plein-cadre", f.pleinCadre === true);
  ecran.classList.toggle("ecran-carte", f.carte === true);
  ecran.classList.toggle("ecran-large", f.large === true);
  ecran.innerHTML = (f.pleinCadre || f.carte ? "" : titreEcran(f.titre, f.sous, f.cote))
    + f.corps;
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
let largeAvant = Ruban.fenetre();
window.addEventListener("resize", () => {
  const f = Ruban.fenetre();
  if (f === largeAvant) return;
  largeAvant = f;
  if (onglet === "temps") rendre();
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
    majEtat(e.message);
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
  const avant = Reglages.position();
  if (!force && avant && Date.now() - avant.t < FRAICHE) return false;
  if (!await Reglages.positionAutorisee()) return false;
  releveEnCours = true;
  try {
    const apres = await Reglages.releverPosition();
    const bouge = !avant || Reglages.ecart(avant, apres) > BOUGE;
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
  air: vueAir };

/* Accroches : un contenu court n'occupe pas tout l'écran. */
const ACCROCHE = { vigilance: "moyenne", communes: "grande",
  ajout: "grande", reglages: "grande", parapluie: "moyenne",
  ressenti: "moyenne", activites: "moyenne", beautemps: "grande",
  air: "grande" };

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
  corps.innerHTML = f.corps;
  if (typeof f.brancher === "function") f.brancher(corps);
  for (const b of [...corps.querySelectorAll("[data-feuille]"),
    ...action.querySelectorAll("[data-feuille]")]) {
    b.addEventListener("click", () => ouvrirFeuille(b.dataset.feuille));
  }
}

function ouvrirFeuille(vue, enRetour) {
  if (!FEUILLES[vue]) return;
  if (!enRetour && vueCourante && !$("feuille").hidden) pile.push(vueCourante);
  vueCourante = vue;
  rendreFeuille();
  $("feuille").classList.toggle("moyenne", ACCROCHE[vue] === "moyenne");
  $("feuille-retour").hidden = !pile.length;
  $("feuille-corps").scrollTop = 0;

  if ($("feuille").hidden) {
    $("voile").hidden = false;
    $("feuille").hidden = false;
    document.body.classList.add("fige");
    requestAnimationFrame(() => {
      $("voile").classList.add("visible");
      $("feuille").classList.add("ouverte");
      $("feuille").focus();
    });
    history.pushState({ feuille: true }, "");
  }
}

function fermerFeuille() {
  const f = $("feuille");
  if (f.hidden) return;
  f.classList.remove("ouverte");
  $("voile").classList.remove("visible");
  document.body.classList.remove("fige");
  setTimeout(() => { f.hidden = true; $("voile").hidden = true; }, 260);
  pile = [];
  vueCourante = null;
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

/* La vigilance en vigueur, gardée pour le rendu qui est synchrone. Elle se lit
   après la prévision, sans la retarder : un bulletin manquant ne doit pas
   priver l'écran de son temps qu'il fait. */
async function lireVigilance() {
  const dep = departementDe(Reglages.lire().codePostal);
  const mien = generation;
  const v = await Vig.lire(dep);
  if (mien !== generation) return;
  const change = JSON.stringify(v) !== JSON.stringify(vigilance);
  vigilance = v;
  ctx.vigilance = v;
  if (change) { rendre(); if (vueCourante) rendreFeuille(); }
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
  lireAir(g);
  /* Le journal de justesse note ce qui vient d'être servi. Il n'affiche rien et
     ne conditionne rien : il est appelé après le rendu, une charge en échec ne
     lui donnant du reste rien à noter. */
  if (r) Justesse.noter(r, Justesse.lieuDe(g.lat, g.lon));
}

/* Les scénarios se lisent après la prévision et sans la retarder : ils ajoutent
   une marge à ce qui est déjà à l'écran, et une source d'ensemble muette ne doit
   pas priver l'application de son temps qu'il fait. La requête ne part que pour
   la commune affichée. */
async function lireEnsemble(g) {
  const mien = generation;
  const d = await Ensemble.charger({ lat: g.lat, lon: g.lon });
  if (mien !== generation || !d) return;
  rendre();
  if (vueCourante) rendreFeuille();
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
  rendre();
  if (vueCourante) rendreFeuille();
}

/* Le relevé peut avoir abouti alors que l'interface adresse était muette : la
   prévision est juste, mais la barre de tête ne nomme pas la commune servie.
   Le nom se rattrape seul, sans redemander la position à l'appareil. */
async function nommerPosition() {
  if (!Reglages.enPosition()) return;
  const p = Reglages.position();
  if (!p || p.lat === null || p.commune) return;
  const mien = generation;
  const l = await Reglages.communeDe(p.lat, p.lon);
  if (mien !== generation || !l) return;
  Reglages.nommerPosition(l);
  rendre();
  lireVigilance();
}

/* ---------- Amorçage ---------- */

$("btnReglages").addEventListener("click", () => ouvrirFeuille("reglages"));
$("navLieu").addEventListener("click", () => ouvrirFeuille("communes"));
$("navJeton").addEventListener("click", () => { sentir(8); ouvrirFeuille("parapluie"); });
$("feuille-fermer").addEventListener("click", () => history.back());
$("feuille-retour").addEventListener("click", retour);
$("voile").addEventListener("click", () => history.back());

/* Un chiffre de l'accueil mène à ses vingt-quatre heures : l'écran du temps
   s'ouvre en ruban, sur la voie correspondante déjà dépliée, et la page se
   place dessus. */
function allerAuDetail(cle) {
  Reglages.poserEcriture("ruban");
  Ruban.poserVoie(cle);
  sentir(8);
  poserOnglet("temps");
  requestAnimationFrame(() => {
    const v = document.querySelector(`.mg-v[data-cle="${cle}"]`);
    if (v) v.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

$("ecran").addEventListener("click", ev => {
  const f = ev.target.closest("[data-feuille]");
  if (f) { ouvrirFeuille(f.dataset.feuille); return; }
  const d = ev.target.closest("[data-detail]");
  if (d) { allerAuDetail(d.dataset.detail); return; }
  const a = ev.target.closest('[data-action="geo"]');
  if (a) situerParPosition(a);
});

window.addEventListener("keydown", ev => {
  if (ev.key === "Escape" && !$("feuille").hidden) history.back();
});

window.addEventListener("popstate", () => {
  if (!$("feuille").hidden) { if (pile.length) retour(); else fermerFeuille(); }
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

charger();

/* La prévision du dernier relevé paraît tout de suite ; le relevé suivant part
   derrière et ne recharge l'écran que s'il déplace le lieu. */
suivrePosition();
