/* Les étiquettes de la carte : les prévisions des villes, la mer des plages,
   la neige des domaines et les cours d'eau, avec leurs interrupteurs et leurs
   lectures. Sorti de src/vues/carte.js le 2 octobre 2026,
   docs/plan-chantiers-facultatifs.md. Les modules de la carte partagent l'objet
   d'état décrit dans src/vues/carte.js. */

import { esc, cleHeure } from "../horloge.js";
import { ico, icoTemps, icoCiel } from "../icones.js";
import * as Reglages from "../reglages.js";
import * as Neige from "../neige.js";
import * as Plage from "../plage.js";
import * as Eau from "../eau.js";
import * as Villes from "../villes.js";
import * as Carte from "../carte.js";
import * as Fond from "../fond.js";

export function brancherEtiquettes(E) {
  const { bloc, cv, vue } = E;
  const zonePrev = bloc.querySelector("#caPrevs"), momentsEl = bloc.querySelector("#caMoments");
  /* Les villes qui portent une prévision, choisies dans la vue à chaque arrêt
     de la carte, et leurs prévisions dans le même ordre. */
  let villesChoisies = [], villesLues = null, merLue = null, neigeLue = null;
  let previMinuteur = null, previCle = "";
  /* Les cours d'eau : à partir d'un zoom de l'ordre du département, la zone
     visible élargie d'un tiers, lue une fois la carte immobile, réutilisée
     tant qu'on y reste pendant dix minutes. */
  const ZOOM_RIVIERES = 7.5;
  let rivLue = null, rivZone = null, rivT = 0, rivMinuteur = null;
  let momentPrev = Villes.momentDe(Number(cleHeure().slice(11, 13)));

  /* Les étiquettes des prévisions, dans l'ordre des villes : une étiquette
     qui en chevaucherait une autre, ou un repère de lieu, s'efface, pour
     que la carte du pays reste lisible. */
  /* Chaque étiquette se compare aux rectangles réels déjà posés, centrés
     sur leur point, avec deux points de marge : une première version
     comparait une seule largeur et une hauteur fixe, et laissait deux
     étiquettes se chevaucher. Les repères des lieux comptent pour un
     carré de trente points. */
  E.placerEtiquettes = (pris, l, h) => {
    zonePrev?.querySelectorAll(".ca-pv").forEach(el => {
      if (el.classList.contains("ca-pv-riv") && vue.z < ZOOM_RIVIERES) { el.hidden = true; return; }
      const p = Carte.surEcran(vue, Number(el.dataset.lat), Number(el.dataset.lon), l, h);
      el.hidden = false;
      const w = el.offsetWidth || 48, ht = el.offsetHeight || 22;
      const dehors = p.x < w / 2 || p.y < ht / 2 || p.x > l - w / 2 || p.y > h - ht / 2;
      const serre = pris.some(q => Math.abs(q.x - p.x) < (w + q.w) / 2 + 2 && Math.abs(q.y - p.y) < (ht + q.h) / 2 + 2);
      el.hidden = dehors || serre;
      if (!el.hidden) {
        el.style.setProperty("--rx", `${p.x.toFixed(1)}px`);
        el.style.setProperty("--ry", `${p.y.toFixed(1)}px`);
        pris.push({ x: p.x, y: p.y, w, h: ht });
      }
    });
    if (E.rivAllume) planRivieres();
    if (E.previAllume) planPrevis();
    /* Les étiquettes visibles, en texte pour VoiceOver : la couche dessinée
       reste masquée aux lecteurs d'écran. Audit, constat 4.9. */
    const liste = bloc.querySelector("#caListe");
    if (liste) {
      const lues = [...zonePrev.querySelectorAll(".ca-pv:not([hidden])")]
        .map(el => `${el.getAttribute("title") || ""} ${el.textContent}`.trim());
      const html = lues.map(x => `<li>${esc(x)}</li>`).join("");
      if (liste.innerHTML !== html) liste.innerHTML = html;
    }
  };

  /* Les prévisions des villes : l'interrupteur, le choix du moment, et les
     étiquettes, chacune avec l'icône du temps et sa température, ou le
     minimum et le maximum pour le lendemain. */
  /* Toutes les étiquettes passent par une même couche, si bien que
     l'effacement des chevauchements vaut entre elles. La neige et les plages
     passent d'abord : allumées, c'est leur information qu'on cherche, et les
     villes côtières, prioritaires, effaçaient presque toutes les plages. Les
     prévisions des villes remplissent le reste. */
  const fr1 = v => String(v).replace(".", ",");
  const poserPrevis = () => {
    momentsEl.hidden = !E.previAllume;
    momentsEl.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.moment === momentPrev ? "true" : "false"));
    const jour = cleHeure().slice(0, 10);
    /* Une étiquette porte le nom de sa ville sous le temps, depuis la
       version 143 : les villes changent avec la vue, et une icône sans nom ne
       disait plus de quel lieu elle parlait. */
    const previs = E.previAllume && villesLues ? villesChoisies.map((v, k) => {
      const m = Villes.tempsMoment(villesLues[k], momentPrev, jour);
      if (!m || m.code === null || m.t === null) return "";
      const t = momentPrev === "demain" ? `${m.min}° ${m.max}°` : `${m.t}°`;
      return `<span class="ca-pv ca-pv-ville" data-lat="${v[1]}" data-lon="${v[2]}" data-ville="${esc(v[0])}" title="${esc(v[0])}">`
        + `<span class="ca-pv-l">${icoTemps(icoCiel(m.code, m.jour), "")}<b>${t}</b></span><small>${esc(v[0])}</small></span>`;
    }).join("") : "";
    const neiges = E.neigeAllume && neigeLue ? neigeLue.filter(s => s.sol > 0).map(s => `<span class="ca-pv ca-pv-neige" data-lat="${s.lat}" `
      + `data-lon="${s.lon}" title="${esc(s.nom)}">${ico("neige", "")}<b>${s.sol} cm</b></span>`).join("") : "";
    const mers = E.plagesAllume && merLue ? merLue.map(p => `<span class="ca-pv ca-pv-mer" data-lat="${p.lat}" data-lon="${p.lon}" `
      + `title="${esc(p.nom)}">${ico("vague", "")}<b>${fr1(Math.round(p.eau))}°</b>${p.vagues !== null ? `<i>${fr1(p.vagues)} m</i>` : ""}</span>`).join("") : "";
    const rivs = E.rivAllume && rivLue ? rivLue.map(r => `<span class="ca-pv ca-pv-riv" data-lat="${r.lat}" data-lon="${r.lon}" `
      + `title="Station ${esc(r.code)}">${ico("riviere", "")}<b>${fr1((Math.round(r.h / 10) / 100).toFixed(2))} m</b>`
      + (r.ecart >= 20 ? `<span class="ca-t ca-t-haut" aria-label="en hausse"></span>` : r.ecart <= -20 ? `<span class="ca-t ca-t-bas" aria-label="en baisse"></span>` : "")
      + `</span>`).join("") : "";
    zonePrev.innerHTML = neiges + mers + rivs + previs;
    /* Les étiquettes se placent tout de suite ; la toile se redessine ensuite,
       les noms du fond évitant les étiquettes et taisant les villes qui en
       portent une. Placer seulement au tracé suivant laissait, sur une machine
       lente, des étiquettes empilées au coin le temps d'une image : relevé
       par la suite complète sur GitHub le 3 octobre 2026. */
    E.placer();
    E.revoir?.();
  };
  E.poserPrevis = poserPrevis;
  /* Le choix des villes de la vue : parmi les communes du fond, ou les
     trente-six villes de départ tant que le fond n'est pas lu. Les places
     prises sont celles des repères des lieux et des commandes ; les autres
     étiquettes, plages et neige, s'effacent ensuite d'elles-mêmes. */
  const choisir = () => {
    const l = cv.clientWidth, h = cv.clientHeight;
    const fond = Fond.villesChargees();
    const liste = fond || Villes.VILLES.map(([nom, lat, lon]) => ({ nom, lat, lon, pop: Infinity }));
    const ecran = v => (v.wx !== undefined
      ? { x: (v.wx - Carte.mx(vue.lon)) * Carte.echelle(vue.z) + l / 2, y: (v.wy - Carte.my(vue.lat)) * Carte.echelle(vue.z) + h / 2 }
      : Carte.surEcran(vue, v.lat, v.lon, l, h));
    return Villes.choisirVilles(liste, ecran, l, h, fond ? vue.z : 0, E.prisEcran ? E.prisEcran(l, h, { etiquettes: false }) : [])
      .map(v => [v.nom, v.lat ?? +Carte.latDe(v.wy).toFixed(3), v.lon ?? +Carte.lonDe(v.wx).toFixed(3)]);
  };
  const lireVilles = () => {
    const choix = choisir();
    const cle = choix.map(v => v[0]).join("|");
    if (cle === previCle && villesLues) return Promise.resolve();
    previCle = cle;
    return Villes.lireVillesDe(choix).then(l => {
      if (!cv.isConnected || previCle !== cle) return;
      villesChoisies = choix; villesLues = l; poserPrevis();
    }).catch(() => { previCle = ""; if (cv.isConnected) E.dire("Les prévisions ont besoin du réseau."); });
  };
  /* Le choix se refait quand la carte s'immobilise. */
  function planPrevis() {
    clearTimeout(previMinuteur);
    previMinuteur = setTimeout(() => { if (cv.isConnected && E.previAllume) lireVilles(); }, 500);
  }
  const previB = bloc.querySelector("#caPrevi");
  previB.addEventListener("click", () => {
    E.previAllume = !E.previAllume;
    Reglages.poserPrevicarte(E.previAllume);
    previB.setAttribute("aria-checked", E.previAllume ? "true" : "false");
    E.mention();
    if (E.previAllume) lireVilles();
    poserPrevis();
  });
  momentsEl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { momentPrev = b.dataset.moment; poserPrevis(); }));
  /* Les plages et la neige : un interrupteur chacune, une lecture chacune. Sans
     neige au sol dans aucun grand domaine, la carte le dit. */
  const lireMer = () => Plage.lireMerCarte(cleHeure()).then(l => { if (!cv.isConnected) return; merLue = l; poserPrevis(); })
    .catch(() => { if (cv.isConnected) E.dire("La mer a besoin du réseau."); });
  const lireNeigeC = () => Neige.lireNeigeCarte(cleHeure()).then(l => {
    if (!cv.isConnected) return;
    neigeLue = l; poserPrevis();
    if (E.neigeAllume && !l.some(s => s.sol > 0)) E.dire("Pas de neige au sol au sommet des grands domaines.");
  }).catch(() => { if (cv.isConnected) E.dire("La neige a besoin du réseau."); });
  const interrupteur = (id, lire, poserReglage, cle, deja) => {
    const b = bloc.querySelector(id);
    b.addEventListener("click", () => {
      const v = !E[cle];
      E[cle] = v;
      poserReglage(v);
      b.setAttribute("aria-checked", v ? "true" : "false");
      E.mention();
      if (v && !deja()) lire();
      poserPrevis();
    });
  };
  /* La lecture des cours d'eau, planifiée à chaque mouvement de la carte et
     lancée quand elle s'immobilise ; rien en deçà du zoom requis. */
  function planRivieres() {
    clearTimeout(rivMinuteur);
    rivMinuteur = setTimeout(() => {
      if (!cv.isConnected || !E.rivAllume || vue.z < ZOOM_RIVIERES) return;
      const l = cv.clientWidth, h = cv.clientHeight;
      const a = Carte.depuisEcran(vue, 0, 0, l, h), b = Carte.depuisEcran(vue, l, h, l, h);
      const bb = { o: a.lon, n: a.lat, e: b.lon, s: b.lat };
      const z0 = rivZone;
      if (z0 && bb.o >= z0.o && bb.e <= z0.e && bb.s >= z0.s && bb.n <= z0.n && Date.now() - rivT < 600000) return;
      const dlo = (bb.e - bb.o) / 3, dla = (bb.n - bb.s) / 3;
      const z = { o: bb.o - dlo, e: bb.e + dlo, s: bb.s - dla, n: bb.n + dla };
      rivZone = z; rivT = Date.now();
      Eau.lireRivieresCarte(z).then(lu => { if (!cv.isConnected) return; rivLue = lu; poserPrevis(); })
        .catch(() => { rivZone = null; if (cv.isConnected) E.dire("Les cours d'eau ont besoin du réseau."); });
    }, 900);
  }
  interrupteur("#caPlages", lireMer, Reglages.poserPlagecarte, "plagesAllume", () => merLue);
  const rivB = bloc.querySelector("#caRivieres");
  rivB.addEventListener("click", () => {
    E.rivAllume = !E.rivAllume;
    Reglages.poserRivierecarte(E.rivAllume);
    rivB.setAttribute("aria-checked", E.rivAllume ? "true" : "false");
    E.mention();
    if (E.rivAllume && vue.z < ZOOM_RIVIERES) E.dire("Zoomez sur la carte pour voir les cours d'eau.");
    poserPrevis();
  });
  interrupteur("#caNeige", lireNeigeC, Reglages.poserNeigecarte, "neigeAllume", () => neigeLue);

  /* Le départ, que la carte lance une fois tous ses modules branchés. */
  return () => {
    if (E.previAllume) lireVilles();
    if (E.plagesAllume) lireMer();
    if (E.neigeAllume) lireNeigeC();
    poserPrevis();
  };
}
