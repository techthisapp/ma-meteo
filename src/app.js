/* Ma météo. Amorçage, couche navigation, écrans, coque de la feuille.

   Site statique, aucun service dorsal, aucune base de données. Trois sources :
   Open-Meteo pour la prévision, le jeu de vigilance archivée de Météo-France sur
   data.gouv.fr, et les données climatologiques de base du même producteur pour
   la pluie mesurée au poste.

   L'interface suit le design system consigné dans DESIGN-SYSTEM.md : trois
   couches, navigation par barre d'onglets, contenu posé sur le fond, feuilles
   pour les actions temporaires. */

import { nombreFr, esc, departementDe, heureJour } from "./horloge.js";
import * as P from "./previsions.js";
import * as Reglages from "./reglages.js";
import { ico, icoTemps, icoCiel, tempsDe } from "./icones.js";
import { conseils, conseilsHTML, portee, titrePortee, SEUILS } from "./conseils.js";
import * as Ruban from "./ruban.js";
import * as Feu from "./feu.js";
import * as Relief from "./relief.js";
import * as Temps from "./temps.js";
import { vueTemps, vueSemaine, vueVigilance, vueSoleil, vueLune, vueCommunes, vueReglages,
  vueAjout, bandeauAccueil } from "./vues.js";
import { moments } from "./ecritures.js";
import * as Vig from "./vigilance.js";
import * as Astres from "./astres.js";

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
  ["soleil", "arc", "Le soleil"],
  ["lune", "lune", "La lune"],
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

/* ---------- Alertes de l'accueil ----------

   Elles ne répètent pas les conseils, qui portent les vingt-quatre heures à
   venir. L'alerte ne parle que de ce qui tombe hors de cette fenêtre, c'est-à-dire
   d'après-demain et au-delà. Les seuils sont ceux de la feuille : un même fait
   n'a qu'un seuil dans toute l'application. */

function alertes() {
  const c = P.chargeCourante();
  const i = P.iJour();
  if (!c || i < 0) return [];

  const d = c.daily;
  const out = [];

  const jh = k => P.jourHoraire(d.time[k]);
  const tMin = k => { const j = jh(k); return j ? j.tn : d.temperature_2m_min[k]; };
  const tMax = k => { const j = jh(k); return j ? j.tx : d.temperature_2m_max[k]; };
  const quand = k => new Date(`${d.time[k]}T12:00`)
    .toLocaleDateString("fr-FR", { weekday: "long" });

  for (let k = i + 2; k <= Math.min(i + 4, d.time.length - 1); k++) {
    const tn = tMin(k), tx = tMax(k);
    if (tn !== null && tn <= SEUILS.gel) {
      out.push({ ton: "froid", i: "alerte", h: (k - i) * 24,
        t: `Gel probable ${quand(k)}, jusqu'à ${Math.round(tn)}°` });
      break;
    }
    if (tx !== null && tx >= SEUILS.chaleur) {
      out.push({ ton: "chaud", i: "soleil", h: (k - i) * 24,
        t: `${Math.round(tx)}° ${quand(k)}` });
      break;
    }
  }

  for (let k = i + 2; k <= Math.min(i + 4, d.time.length - 1); k++) {
    const p = d.precipitation_sum[k];
    if (p !== null && p >= SEUILS.alerteLame) {
      out.push({ ton: "eau", i: "goutte", h: (k - i) * 24,
        t: `${Math.round(p)} mm annoncés ${quand(k)}` });
      break;
    }
  }

  return out.slice(0, 2);
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
function panneauVigilance() {
  const v = vigilance;
  if (!v) return "";
  const n = Vig.NIVEAUX[v.niveau];

  /* La fenêtre de chaque phénomène se dit en clair. Une plage déjà commencée se
     dit par sa fin, c'est la seule chose qui reste à savoir. Une borne qui
     tombe un autre jour le dit, sans quoi « jusqu'à 06 h » se lirait comme
     dans une heure. */
  const quand = a => (a.debut.getTime() > Date.now()
    ? `de ${heureJour(a.debut)} à ${heureJour(a.fin)}`
    : `jusqu'à ${heureJour(a.fin)}`);

  return `<div class="section vg vg-${esc(n.nom)}">`
    + `<h2>Vigilance ${esc(n.nom)}</h2>`
    + `<button type="button" class="carte vg-c" data-feuille="vigilance" `
    + `aria-label="Vigilance ${esc(n.nom)}, ${esc(n.conduite)}, voir le détail">`
    + `<span class="vg-tete">${ico("alerte", "vg-ic")}`
    + `<span class="vg-txt"><b>${esc(n.conduite)}</b>`
    + `<em>${esc(v.nom || `Département ${v.dep}`)}`
    + (v.validite ? `, bulletin valable jusqu'à ${esc(heureJour(v.validite))}` : "")
    + `</em></span>${chevron}</span>`
    + `<span class="vg-l">` + v.alertes.map(a =>
      `<span class="vg-a n-${a.niveau}">${ico(a.symbole, "vg-as")}`
      + `<b>${esc(a.nom)}</b><i>${esc(Vig.NIVEAUX[a.niveau].nom)}, ${esc(quand(a))}</i></span>`)
      .join("")
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

       Le ressenti ne s'affiche que s'il s'écarte de la température : « Ressenti
       20° » à côté d'un grand 20° occupe un quart de la carte sans rien
       apprendre. La probabilité de pluie prend alors sa place, plus utile.

       L'indice UV s'écrit sans décimale : « 0,0 » à huit heures du matin donne
       une fausse impression de mesure fine. */
    /* Une valeur ne prend une couleur que lorsqu'elle passe un seuil : colorer
       une valeur ordinaire ferait du bruit et userait le signal. Le chiffre
       porte l'information, la couleur ne fait que la doubler. */
    const pb = s ? Math.round(Math.max(...s.pb)) : 0;
    const uv = s ? Math.round(s.uv[0]) : 0;
    const raf = s ? Math.round(s.raf[0]) : 0;
    const hum = s ? Math.round(s.hum[0]) : 0;
    const res = s ? Math.round(s.res[0]) : 0;

    /* Chaque mesure désigne la voie du ruban qui la déplie : un chiffre de
       l'accueil est une porte vers ses vingt-quatre heures. */
    const premiere = s && Math.abs(s.res[0] - t) >= 1
      ? ["Ressenti", `${res}°`, "",
        res >= SEUILS.chaleur ? "v-chaud" : res <= SEUILS.gel ? "v-froid" : "", "t"]
      : ["Pluie", `${pb} %`, "sur 24 h", pb >= 60 ? "v-eau" : "", "mm"];

    const mesures = s ? [
      premiere,
      ["Vent", `${Math.round(s.v[0])} km/h`, `rafales ${raf} km/h`,
        raf >= SEUILS.rafale || s.v[0] >= SEUILS.ventMoyen ? "v-attention" : "", "v"],
      ["Humidité", `${hum} %`, "", hum >= SEUILS.humidite ? "v-eau" : "", "hum"],
      ["Indice UV", `${uv}`, uv >= SEUILS.uv ? "élevé" : "",
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
    corps += `<div class="plein">`
      + bandeauAccueil(g, new Date(), params, s ? s.v[0] : 0)
      + `<div class="plein-titre"><i>${esc(jour.charAt(0).toUpperCase() + jour.slice(1))}</i>`
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

    corps += `<div class="ecran-corps">`
      + panneauVigilance()
      + (mesures.length ? `<div class="bd-mesures">`
        + mesures.map(([n, v, e, c, voie]) =>
          `<button type="button" class="bd-m" data-detail="${esc(voie)}" `
          + `aria-label="${esc(n)}, ${esc(v)}, voir les vingt-quatre heures">`
          + `<i>${esc(n)}${chevronM}</i><b${c ? ` class="${c}"` : ""}>${esc(v)}</b>`
          + `<em>${esc(e)}</em></button>`).join("")
        + `</div>` : "");

    /* Un seul en-tête pour ce qui est à savoir : les heures qui viennent
       d'abord, puis ce qui vient au-delà. Le titre annonce la portée réelle de
       ce qui suit, en heures ou en jours : le lecteur sait jusqu'où porte ce
       qu'il lit sans avoir à relire chaque phrase. Rien à dire, rien à
       l'écran : la section entière disparaît. */
    const al = alertes();
    const cl = s ? conseils(s, { evenement: prochainAstre() }) : [];
    const cj = conseilsHTML(cl);
    if (cj || al.length) {
      const h = Math.max(portee(cl), ...al.map(a => a.h || 0));
      corps += `<div class="section"><h2>${esc(titrePortee(h))}</h2>`
        + `<div class="carte retenir">`
        + (cj ? `<div class="conseils">${cj}</div>` : "")
        + (al.length ? `<div class="alertes">`
          + al.map(a => `<div class="al t-${a.ton}">${ico(a.i, "")}<span>${esc(a.t)}</span></div>`).join("")
          + `</div>` : "")
        + `</div></div>`;
    }

    /* Les moments ferment la page : ils racontent la journée qui vient, tranche
       par tranche, là où le haut de l'écran ne dit que l'instant. C'est le
       dernier bloc de contenu, la vigilance et la source formant la clôture. */
    if (s) {
      /* « Les prochaines heures » se confondait avec le titre de la section du
         dessus, qui annonce aussi des heures. Les moments couvrent le soir, la
         nuit et le lendemain : c'est la journée qui vient. */
      corps += `<div class="section"><h2>La journée qui vient</h2>`
        + `<div class="carte">${moments(s)}</div></div>`;
    }

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

const VUES_ONGLET = { temps: vueTemps, semaine: vueSemaine, soleil: vueSoleil, lune: vueLune };

function ecranVue(nom) {
  const f = VUES_ONGLET[nom](ctx, () => rendre(), majEtat);
  return {
    titre: f.titre,
    /* Le plein cadre porte son propre titre, dans le ciel : la coque ne pose
       pas le sien par-dessus. */
    pleinCadre: f.pleinCadre === true,
    cote: f.cote || "",
    /* La commune est dans la barre de tête : la répéter sous chaque titre
       d'écran occupait une ligne pour une information déjà présente. */
    sous: f.sousEcran || "",
    corps: bandeauHorsLigne() + f.corps,
    brancher: f.brancher,
  };
}

/* ---------- Rendu de l'écran courant ---------- */

function rendre() {
  const ecran = $("ecran");
  const situe = Reglages.situe();
  const nom = ONGLETS.find(o => o[0] === onglet)?.[2] || "";

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
  ecran.innerHTML = (f.pleinCadre ? "" : titreEcran(f.titre, f.sous, f.cote)) + f.corps;
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
  ajout: vueAjout, reglages: vueReglages };

/* Accroches : un contenu court n'occupe pas tout l'écran. */
const ACCROCHE = { vigilance: "moyenne", communes: "grande",
  ajout: "grande", reglages: "grande" };

function rendreFeuille() {
  if (!vueCourante) return;
  const f = FEUILLES[vueCourante](ctx, options => {
    /* Le retour sensoriel accompagne une sélection décidée par l'utilisateur,
       jamais un rendu automatique. */
    if (options?.recharger) { sentir(10); fermerFeuille(); charger(); return; }
    if (options?.fermer) { fermerFeuille(); return; }
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
  Vig.oublier();
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* hors ligne indisponible */ });
  });
}

charger();

/* La prévision du dernier relevé paraît tout de suite ; le relevé suivant part
   derrière et ne recharge l'écran que s'il déplace le lieu. */
suivrePosition();
