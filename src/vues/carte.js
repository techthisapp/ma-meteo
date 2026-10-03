/* La carte : le cadre, les repères des lieux, le geste et le zoom, et
   l'assemblage des modules qui la composent. Découpé de src/vues.js le
   2 octobre 2026, docs/plan-decoupage-vues.md, puis en modules le même jour,
   docs/plan-chantiers-facultatifs.md :
   - carte-gabarit.js, la table des nappes et le document de l'écran ;
   - carte-couches.js, les couches peintes, leurs lectures et leurs interrupteurs ;
   - carte-chronologie.js, la pluie et sa chronologie ;
   - carte-etiquettes.js, les prévisions des villes, la mer, la neige, les cours d'eau ;
   - carte-legende.js, la mention des sources et les légendes.

   Les modules partagent un objet d'état, `E`, créé ici à chaque branchement.
   Il porte le document et le cadrage, l'état de chaque interrupteur, la nappe
   choisie, les images de la pluie et les grilles de mesures, et les fonctions
   que les modules s'empruntent : redessiner, dire un message, refaire la
   mention, la légende ou les étiquettes, reposer le vent. */

import { esc } from "../horloge.js";
import { ico } from "../icones.js";
import * as P from "../previsions.js";
import * as Reglages from "../reglages.js";
import * as Carte from "../carte.js";
import * as Fond from "../fond.js";
import { poserRedimension } from "./communs.js";
import { gabaritCarte } from "./carte-gabarit.js";
import { brancherCouches } from "./carte-couches.js";
import { brancherChronologie } from "./carte-chronologie.js";
import { brancherEtiquettes } from "./carte-etiquettes.js";
import { brancherLegende } from "./carte-legende.js";
import { brancherPoint } from "./carte-point.js";

/* ---------- La carte ---------- */

export function vueCarte(ctx, rendre, majEtat) {
  const g = Reglages.lire();
  if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon)) {
    return {
      titre: "La carte",
      corps: `<div class="carte"><p class="vide">Aucun lieu courant.</p></div>`,
    };
  }

  const suivies = Reglages.suivies();
  const lieux = [{ nom: Reglages.nomAffiche(g) || "Ici", lat: g.lat, lon: g.lon, ici: true },
    ...suivies.filter(l => l.lat !== g.lat || l.lon !== g.lon)
      .map(l => ({ nom: Reglages.nomAffiche(l) || "Commune", lat: l.lat, lon: l.lon, ici: false }))];

  /* Le cadrage vit dans le contexte et survit aux rendus. Chaque source qui
     arrive déclenche un rendu, et sans cette mémoire la carte reviendrait à son
     cadrage d'ouverture pendant qu'on la déplace.

     Un appui sur l'onglet La carte efface ce cadrage, que l'onglet change ou
     qu'on appuie de nouveau dessus. La carte s'ouvre alors sur la France
     entière : elle sert d'abord à voir où il pleut, et la réponse est régionale
     avant d'être locale. Le bouton de retour ramène ensuite sur la commune. */
  const vue = ctx.cadreCarte || (ctx.cadreCarte = Reglages.vueCarte() || { lat: g.lat, lon: g.lon, z: null });

  return {
    titre: "La carte",
    carte: true,
    corps: gabaritCarte(g),

    brancher(bloc) {
      const cv = bloc.querySelector("#caToile");
      const zone = bloc.querySelector("#caReperes");
      const barre = bloc.querySelector("#caEchelle");
      if (!cv) return;
      const mot = bloc.querySelector("#caMot");

      const E = {
        bloc, cv, vue, g,
        choisie: Reglages.nappe(),
        pluieAllume: Reglages.pluiecarte(), hote: "", images: [], rang: 0,
        mesures: null, mesuresAir: null,
        ventAllume: Reglages.ventcarte(), vigiAllume: Reglages.vigicarte(),
        nuagesAllume: Reglages.nuagescarte(), feuxAllume: Reglages.feuxcarte(),
        foudreAllume: Reglages.foudrecarte(),
        previAllume: Reglages.previcarte(), plagesAllume: Reglages.plagecarte(),
        neigeAllume: Reglages.neigecarte(), rivAllume: Reglages.rivierecarte(),
      };
      E.dire = t => {
        mot.textContent = t || "";
        mot.hidden = !t;
      };

      /* Les repères sont créés une fois et déplacés ensuite : les recréer à
         chaque image perdrait le focus du clavier au milieu d'un geste. */
      zone.innerHTML = lieux.map((l, k) => `<button type="button" class="ca-r`
        + `${l.ici ? " ca-r-ici" : ""}" data-lieu="${k}">`
        + `<span class="ca-r-pt"></span>`
        + `<span class="ca-r-nom">${esc(l.nom)}<em data-deg></em></span></button>`).join("");
      const boutons = [...zone.querySelectorAll(".ca-r")];

      const placer = () => {
        const l = cv.clientWidth, h = cv.clientHeight;
        boutons.forEach((b, k) => {
          const p = Carte.surEcran(vue, lieux[k].lat, lieux[k].lon, l, h);
          /* Un repère hors du cadre est caché plutôt que posé au bord : une
             pastille collée au bord dirait un lieu qui n'est pas là. */
          const dehors = p.x < -40 || p.y < -40 || p.x > l + 40 || p.y > h + 40;
          b.hidden = dehors;
          if (!dehors) {
            b.style.setProperty("--rx", `${p.x.toFixed(1)}px`);
            b.style.setProperty("--ry", `${p.y.toFixed(1)}px`);
            /* Un repère près du bord droit porte son nom à gauche du point.
               Sinon le nom sort du cadre et se coupe, ce qu'on voit dès que la
               carte montre la France entière. */
            const nom = b.querySelector(".ca-r-nom");
            const large = nom ? nom.offsetWidth : 0;
            b.classList.toggle("ca-r-gauche", p.x + 26 + large > l - 8);
          }
        });
        /* Les étiquettes se posent ensuite, en évitant les repères des lieux. */
        const pris = boutons.filter(b => !b.hidden).map(b => ({
          x: parseFloat(b.style.getPropertyValue("--rx")), y: parseFloat(b.style.getPropertyValue("--ry")), w: 30, h: 30 }));
        E.placerEtiquettes(pris, l, h);
        E.poserBulle?.();
        /* Le cadrage se garde sur l'appareil, une fois la carte immobile. */
        clearTimeout(E.minuteurVue);
        E.minuteurVue = setTimeout(() => { if (vue.z !== null) Reglages.poserVueCarte(vue); }, 800);
        const e = Carte.echelleBarre(vue, cv.clientWidth);
        barre.style.setProperty("--eb", `${Math.round(e.px)}px`);
        barre.querySelector("span").textContent = `${e.km} km`;
      };
      E.placer = placer;

      /* Les modules se branchent : chacun pose ses écouteurs et ses fonctions
         sur l'objet d'état, puis rend son départ. */
      brancherLegende(E);
      const departCouches = brancherCouches(E);
      const departPluie = brancherChronologie(E);
      const departEtiquettes = brancherEtiquettes(E);

      /* Le fond enrichi, jalon 19, lot 2 : les noms des villes et des cours
         d'eau évitent les repères des lieux et les étiquettes posées par le
         document, recalculés pour la vue en cours ; une ville qui porte déjà
         une étiquette de prévision ne se nomme pas une seconde fois. */
      const zonePrev = bloc.querySelector("#caPrevs");
      E.prisEcran = (l, h, { etiquettes = true } = {}) => {
        const out = [];
        boutons.forEach((b, k) => {
          const p = Carte.surEcran(vue, lieux[k].lat, lieux[k].lon, l, h);
          const w = 26 + (b.querySelector(".ca-r-nom")?.offsetWidth || 0);
          const gauche = b.classList.contains("ca-r-gauche");
          out.push({ x: gauche ? p.x + 11 - w / 2 : p.x - 11 + w / 2, y: p.y, w, h: 26 });
        });
        /* Les commandes posées sur la carte : boutons, légendes, échelle,
           chronologie. Un nom passé dessous ne se lirait pas. */
        const base = cv.getBoundingClientRect();
        bloc.querySelectorAll(".ca-outils, .ca-legende:not([hidden]), .ca-bas, .ca-temps:not([hidden]), .ca-moments:not([hidden])").forEach(el => {
          const b = el.getBoundingClientRect();
          if (!b.width) return;
          out.push({ x: b.left - base.left + b.width / 2, y: b.top - base.top + b.height / 2, w: b.width + 4, h: b.height + 4 });
        });
        if (etiquettes) zonePrev?.querySelectorAll(".ca-pv:not([hidden])").forEach(el => {
          const p = Carte.surEcran(vue, Number(el.dataset.lat), Number(el.dataset.lon), l, h);
          out.push({ x: p.x, y: p.y, w: el.offsetWidth || 48, h: el.offsetHeight || 22 });
        });
        return out;
      };
      Carte.reglerFond(cv, {
        pris: (l, h) => E.prisEcran(l, h),
        taire: () => new Set([...(zonePrev?.querySelectorAll(".ca-pv:not([hidden])") || [])]
          .map(el => el.dataset.ville).filter(Boolean)),
        noms: poses => { E.nomsPoses = poses; },
      });
      Fond.charger().then(() => { if (cv.isConnected) E.revoir(); });

      brancherPoint(E, rendre);
      const main = Carte.poser(cv, vue, placer, E.COUCHES, { surAppui: (x, y) => E.ouvrirPoint(x, y) });
      /* Chaque nouveau tracé refait aussi le résumé lu : une grille arrivée
         donne la valeur au lieu courant. */
      E.revoir = () => { main.redessiner(); E.resumer?.(); };

      /* Le premier tracé attend que la toile ait sa taille. Le cadrage
         d'ouverture aussi : il fait tenir la France dans le cadre, et la
         largeur du cadre décide du zoom. */
      requestAnimationFrame(() => {
        if (vue.z === null) {
          Object.assign(vue, Carte.vueSur(Carte.FRANCE, cv.clientWidth, cv.clientHeight));
        }
        Carte.dessiner(cv, vue, E.COUCHES);
        placer();
        /* Le vent posé avant ce cadrage, quand les mesures arrivent vite, ne
           trouvait aucune échelle et ne traçait rien ; sous mouvement réduit,
           il ne se redessinait plus. Il se repose donc une fois la vue
           cadrée. Défaut révélé le 2 octobre 2026 par le chargement différé de
           la carte, qui a changé l'ordre des arrivées. */
        if (E.mesures) E.poserVent();
      });

      const pas = d => {
        Object.assign(vue, Carte.borner({ ...vue, z: vue.z + d }));
        E.revoir();
      };
      /* Les flèches déplacent la vue d'un quart de cadre, plus et moins la
         zooment, quand la toile a le focus. Audit, constat 4.9. */
      cv.addEventListener("keydown", ev => {
        if (ev.key === "+" || ev.key === "=") { pas(1); ev.preventDefault(); return; }
        if (ev.key === "-") { pas(-1); ev.preventDefault(); return; }
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
        if (!d) return;
        ev.preventDefault();
        const l = cv.clientWidth, h = cv.clientHeight;
        const c = Carte.depuisEcran(vue, l / 2 + d[0] * l / 4, h / 2 + d[1] * h / 4, l, h);
        Object.assign(vue, Carte.borner({ lat: c.lat, lon: c.lon, z: vue.z }));
        E.revoir();
      });
      bloc.querySelector("#caIci").addEventListener("click", () => {
        Object.assign(vue, Carte.borner({ lat: g.lat, lon: g.lon, z: Carte.ZDEFAUT }));
        E.revoir();
      });

      /* Un appui sur un repère bascule la commune, comme une rangée de la liste
         des lieux. Le repère du lieu courant ne bascule rien et ramène la vue
         sur lui : c'est déjà là qu'on est. */
      for (const b of boutons) {
        b.addEventListener("click", () => {
          const l = lieux[Number(b.dataset.lieu)];
          if (l.ici) {
            Object.assign(vue, Carte.borner({ lat: l.lat, lon: l.lon, z: vue.z }));
            E.revoir();
            return;
          }
          const cible = suivies.find(x => x.lat === l.lat && x.lon === l.lon);
          if (cible) { Reglages.poserLieu(cible); rendre({ recharger: true }); }
        });
      }

      /* Les températures arrivent après coup, d'un seul appel pour toute la
         liste, celui-là même que sert la feuille des lieux. */
      P.apercus(lieux).then(({ par }) => {
        boutons.forEach((b, k) => {
          const a = par[`${lieux[k].lat},${lieux[k].lon}`];
          const em = b.querySelector("[data-deg]");
          if (a && em) em.textContent = `${Math.round(a.t)}°`;
        });
      });

      /* Le panneau des couches. Quatre interrupteurs empilés dans la colonne
         auraient pris la moitié de la hauteur du cadre, et chaque couche à venir
         en aurait pris un de plus. Un bouton ouvre la liste, la liste porte les
         noms : une icône seule ne dit pas ce qu'elle allume. */
      const ouvrir = bloc.querySelector("#caCouches");
      const panneau = bloc.querySelector("#caPanneau");
      const momentsEl = bloc.querySelector("#caMoments");
      const montrer = v => {
        panneau.hidden = !v;
        ouvrir.setAttribute("aria-expanded", v ? "true" : "false");
        /* Le choix du moment des prévisions se retire derrière le panneau ouvert. */
        momentsEl?.classList.toggle("sous-panneau", v);
      };
      ouvrir.addEventListener("click", e => {
        e.stopPropagation();
        montrer(panneau.hidden);
      });
      E.fermerPanneau = () => montrer(false);

      /* Le plein écran, jalon 19, lot 7 : les barres du haut et du bas se
         retirent, la carte prend tout l'écran. Le même bouton, ou Échap, les
         ramène. */
      const plein = bloc.querySelector("#caPlein");
      const poserPlein = v => {
        document.documentElement.classList.toggle("carte-plein", v);
        plein.setAttribute("aria-pressed", v ? "true" : "false");
        plein.setAttribute("aria-label", v ? "Quitter le plein écran" : "Carte en plein écran");
        plein.innerHTML = ico(v ? "reduire" : "agrandir", "");
        requestAnimationFrame(() => E.revoir());
      };
      poserPlein(document.documentElement.classList.contains("carte-plein"));
      plein.addEventListener("click", e => { e.stopPropagation(); poserPlein(!document.documentElement.classList.contains("carte-plein")); });
      bloc.addEventListener("keydown", ev => {
        if (ev.key === "Escape" && document.documentElement.classList.contains("carte-plein")) poserPlein(false);
      });
      panneau.addEventListener("click", e => e.stopPropagation());
      /* Un appui sur la carte referme le panneau : il couvre le coin de la vue,
         et le refermer par son propre bouton demanderait de viser deux fois. */
      cv.addEventListener("pointerdown", () => montrer(false), { passive: true });

      /* Les sources, derrière leur bouton : une bulle au-dessus de l'échelle,
         refermée par un second appui ou par un appui sur la carte. */
      const sources = bloc.querySelector("#caSources");
      const credit = bloc.querySelector("#caCredit");
      const montrerSources = v => {
        credit.hidden = !v;
        sources.setAttribute("aria-expanded", v ? "true" : "false");
      };
      sources.addEventListener("click", e => {
        e.stopPropagation();
        montrerSources(credit.hidden);
      });
      cv.addEventListener("pointerdown", () => montrerSources(false), { passive: true });

      /* Les départs, dans l'ordre d'avant le découpage : les étiquettes et les
         restrictions d'eau, puis la mention, la légende, la pluie et les autres
         lectures. */
      departEtiquettes();
      departCouches.eau();
      E.mention();
      E.poserLegende();
      departPluie();
      departCouches.reste();

      /* Un seul écouteur à la fois : chaque rendu de la carte en ajoutait un,
         qui gardait l'ancienne carte en mémoire et la redessinait à chaque
         rotation. Audit du 1er octobre 2026, constat 5.3. */
      poserRedimension("carte", E.revoir);
    },
  };
}
