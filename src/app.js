/* Ma météo. Amorçage, écran d'accueil, coque de la feuille.

   Site statique, aucun service dorsal, aucune base de données. Trois sources :
   Open-Meteo pour la prévision, le jeu de vigilance archivée de Météo-France sur
   data.gouv.fr, et les données climatologiques de base du même producteur pour
   la pluie mesurée au poste. */

import { nombreFr, esc } from "./horloge.js";
import * as P from "./previsions.js";
import * as Reglages from "./reglages.js";
import { ico, icoCiel, tempsDe } from "./icones.js";
import { conseilsHTML, SEUILS } from "./conseils.js";
import { vueTemps, vueSemaine, vueVigilance, vueLumiere, vueReglages } from "./vues.js";

const $ = id => document.getElementById(id);

/* Deux modules restent écrits et contrôlés sans être branchés : `vigilance.js`
   et `postes.js`. Ils lisent les jeux archivés de Météo-France sur data.gouv.fr,
   dont l'alimentation s'est interrompue. Sondé le 19 août 2026, le dernier
   bulletin de vigilance datait du 5 août et les relevés de pluie du 22 juin, les
   fichiers n'ayant pas été modifiés depuis le 24 juin.

   Une application météorologique ne peut pas servir une vigilance de quatorze
   jours ni comparer une prévision du jour à une mesure de juin. La vigilance
   renvoie donc vers Météo-France, seule source à jour, et la comparaison entre
   mesure et modèle est retirée. Les deux modules se rebranchent en trois lignes
   si la synchronisation reprend. */

const ctx = {};

let pile = [];
let vueCourante = null;

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
   venir : c'est la règle qui manquait à « Mon jardin » et qui faisait paraître
   « Rafales à 48 km/h aujourd'hui » juste au-dessus de « Rafales à 48 km/h de
   09 h à demain 09 h ». L'alerte ne parle donc que de ce qui tombe hors de cette
   fenêtre, c'est-à-dire d'après-demain et au-delà.

   Les seuils sont ceux de la feuille : un même fait n'a qu'un seuil dans toute
   l'application. */

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

  /* La fenêtre des conseils couvre aujourd'hui et une partie de demain. Les
     alertes commencent après-demain : le premier jour entièrement hors fenêtre. */
  for (let k = i + 2; k <= Math.min(i + 4, d.time.length - 1); k++) {
    const tn = tMin(k), tx = tMax(k);
    if (tn !== null && tn <= SEUILS.gel) {
      out.push({ ton: "froid", i: "alerte", t: `Gel probable ${quand(k)}, jusqu'à ${Math.round(tn)} °C` });
      break;
    }
    if (tx !== null && tx >= SEUILS.chaleur) {
      out.push({ ton: "chaud", i: "soleil", t: `${Math.round(tx)} °C ${quand(k)}` });
      break;
    }
  }

  for (let k = i + 2; k <= Math.min(i + 4, d.time.length - 1); k++) {
    const p = d.precipitation_sum[k];
    if (p !== null && p >= SEUILS.alerteLame) {
      out.push({ ton: "eau", i: "goutte", t: `${Math.round(p)} mm annoncés ${quand(k)}` });
      break;
    }
  }

  return out.slice(0, 2);
}

/* ---------- Écran d'accueil ---------- */

function rendreAccueil() {
  const g = Reglages.lire();
  const c = P.chargeCourante();
  const i = P.iJour();
  const s = P.serieHoraire();

  $("lieuNom").textContent = g.commune || "Situer";

  const situe = Reglages.situe();
  $("invite").hidden = situe;
  for (const id of ["bandeau", "alertes", "conseils", "tuiles", "pied"]) $(id).hidden = !situe;
  if (!situe) return;

  // ---- Bandeau ----
  const bd = $("bandeau");
  if (!c || i < 0) {
    bd.innerHTML = `<p class="vide">Prévision indisponible. Vérifier la connexion.</p>`;
  } else {
    const d = c.daily;
    const jh = P.jourHoraire(d.time[i]);
    const tn = jh ? jh.tn : d.temperature_2m_min[i];
    const tx = jh ? jh.tx : d.temperature_2m_max[i];
    const t = s ? s.t[0] : (tn + tx) / 2;
    const code = s ? s.code[0] : d.weather_code[i];
    const clair = s ? s.clair[0] : 1;
    const [, lib] = tempsDe(code);

    /* Les quatre mesures que le grand chiffre ne peut pas tenir. Le ressenti n'y
       est pas redit sous les bornes : il occupait deux lignes pour un seul
       chiffre. */
    const mesures = s ? [
      ["Ressenti", `${nombreFr(s.res[0])}°`, ""],
      ["Vent", `${Math.round(s.v[0])} km/h`, `rafales ${Math.round(s.raf[0])}`],
      ["Humidité", `${Math.round(s.hum[0])} %`, ""],
      ["Indice UV", nombreFr(s.uv[0]), s.uv[0] >= SEUILS.uv ? "élevé" : ""],
    ] : [];

    bd.innerHTML = `<div class="bd-haut">`
      + `<p class="bd-deg">${Math.round(t)}<sup>°</sup></p>`
      + `<div class="bd-etat">`
      + `<p class="bd-ciel">${ico(icoCiel(code, clair))}<span>${esc(lib)}</span></p>`
      + `<p class="bd-bornes"><b>${Math.round(tn)}°</b> à <b>${Math.round(tx)}°</b> aujourd'hui</p>`
      + `</div></div>`
      + (mesures.length ? `<div class="bd-mesures">` + mesures.map(([n, v, e]) =>
        `<div class="bd-m"><i>${esc(n)}</i><b>${esc(v)}</b><em>${esc(e)}</em></div>`).join("")
        + `</div>` : "");
  }

  // ---- Alertes ----
  const az = $("alertes");
  const lignes = alertes().map(a =>
    `<div class="al t-${a.ton}">${ico(a.i)}<span>${esc(a.t)}</span></div>`);
  az.innerHTML = lignes.join("");
  az.hidden = !lignes.length;

  // ---- Conseils ----
  const cz = $("conseils");
  const cj = s ? conseilsHTML(s) : "";
  cz.innerHTML = cj;
  cz.hidden = !cj;

  // ---- Tuiles ----
  const tuiles = [
    ["temps", "horloge", "Le temps", s
      ? `${s.n} heures, ${nombreFr(s.mm.reduce((a, b) => a + b, 0))} mm attendus`
      : "prévision horaire"],
    ["semaine", "semaine", "La semaine", "sept jours"],
    ["lumiere", "arc", "La lumière", c && i >= 0
      ? new Date(c.daily.sunset[i]).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + " au coucher"
      : "lever et coucher"],
    ["vigilance", "alerte", "Vigilance", "sur Météo-France"],
  ];
  $("tuiles").innerHTML = tuiles.map(([v, ic, nom, sous]) =>
    `<button type="button" class="tu" data-vue="${v}">${ico(ic, "")}`
    + `<span class="tu-txt"><span class="tu-nom">${esc(nom)}</span>`
    + `<span class="tu-sous">${esc(sous)}</span></span></button>`).join("");

  $("pied").textContent = "Source : Open-Meteo, modèle AROME de Météo-France. "
    + "Mise à jour toutes les heures.";
}

/* ---------- Coque de la feuille ---------- */

const VUES = {
  temps: vueTemps,
  semaine: vueSemaine,
  vigilance: vueVigilance,
  lumiere: vueLumiere,
  reglages: vueReglages,
};

function rendreVue() {
  if (!vueCourante) return;
  const f = VUES[vueCourante](ctx, options => {
    if (options?.recharger) { fermerFeuille(); charger(); return; }
    rendreVue();
  }, majEtat);
  $("feuille-titre").innerHTML = esc(f.titre)
    + (f.sous ? `<span>${esc(f.sous)}</span>` : "");
  const corps = $("feuille-corps");
  corps.innerHTML = f.corps;
  if (typeof f.brancher === "function") f.brancher(corps);
  for (const b of corps.querySelectorAll("[data-vue]")) {
    b.addEventListener("click", () => ouvrirVue(b.dataset.vue));
  }
}

function ouvrirVue(vue, enRetour) {
  if (!VUES[vue]) return;
  if (!enRetour && vueCourante && !$("feuille").hidden) pile.push(vueCourante);
  vueCourante = vue;
  rendreVue();
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
  setTimeout(() => { f.hidden = true; $("voile").hidden = true; }, 240);
  pile = [];
  vueCourante = null;
}

function retour() {
  const v = pile.pop();
  if (!v) { fermerFeuille(); return; }
  ouvrirVue(v, true);
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
    f.style.transform = `translateY(${dy}px)`;
    if (window.innerWidth >= 560) f.style.transform = `translate(-50%, ${dy}px)`;
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

async function charger() {
  const g = Reglages.lire();
  if (!Reglages.situe()) { rendreAccueil(); return; }
  await P.charger({ lat: g.lat, lon: g.lon });
  rendreAccueil();
  if (vueCourante) rendreVue();
}

/* ---------- Amorçage ---------- */

$("btnLieu").addEventListener("click", () => ouvrirVue("reglages"));
$("btnReglages").addEventListener("click", () => ouvrirVue("reglages"));
$("feuille-fermer").addEventListener("click", () => history.back());
$("feuille-retour").addEventListener("click", retour);
$("voile").addEventListener("click", () => history.back());

document.addEventListener("click", ev => {
  const b = ev.target.closest("#ecran [data-vue]");
  if (b) ouvrirVue(b.dataset.vue);
});

window.addEventListener("keydown", ev => {
  if (ev.key === "Escape" && !$("feuille").hidden) history.back();
});

window.addEventListener("popstate", () => {
  if (!$("feuille").hidden) { if (pile.length) retour(); else fermerFeuille(); }
});

const tete = document.querySelector(".tete");
window.addEventListener("scroll", () => {
  tete.classList.toggle("pose", window.scrollY > 4);
}, { passive: true });

brancherGlissement();

// Le retour au premier plan relit la charge quand l'heure a changé.
P.surRetourAuPremierPlan(() => charger());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* hors ligne indisponible */ });
  });
}

charger();
