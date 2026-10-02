/* La carte : fond, nappes et couches. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc, heureJour } from "../horloge.js";
import * as P from "../previsions.js";
import { ico, icoTemps, icoCiel, couleurT, teinteT, couleurUV, teinteUV, satUV, clarteUV, couleurAQI, teinteAQI } from "../icones.js";
import { ECHELLES } from "../ruban.js";
import { liste, moments } from "../ecritures.js";
import * as Reglages from "../reglages.js";
import * as Neige from "../neige.js";
import * as Plage from "../plage.js";
import * as VigiEau from "../vigieau.js";
import * as Eau from "../eau.js";
import * as Villes from "../villes.js";
import { cleHeure } from "../horloge.js";
import * as Carte from "../carte.js";
import * as Radar from "../radar.js";
import * as Foudre from "../foudre.js";
import * as Atmo from "../atmo.js";
import * as Nuages from "../nuages.js";
import * as Feux from "../feux.js";
import * as NappeCarte from "../nappe.js";
import * as Vent from "../vent.js";
import * as Vig from "../vigilance.js";
import { poserRedimension, valeur } from "./communs.js";

/* ---------- La carte ---------- */

/* Les nappes de la carte, exclusives entre elles. Ce sont des étalements de
   couleur sur toute la surface : deux superposés ne se liraient ni l'un ni
   l'autre. La vigilance n'entre pas dans cette liste, elle ne teinte que les
   départements en alerte et se pose sous la nappe.

   La pluie n'y figure plus depuis le 19 septembre 2026. Elle ne couvre qu'un
   cinquième de la vue un jour de pluie et laisse voir ce qui est dessous : elle
   est passée au-dessus, avec le vent, la vigilance, la foudre et les nuages, ce
   qui permet de la lire en même temps qu'une température ou une qualité de
   l'air. Sa place ici tenait à l'ordre dans lequel les couches sont venues. */
const NAPPES_CARTE = [
  /* Les restrictions d'eau, VigiEau, jalon 18 : une nappe par départements, sans
     grille de valeurs ; la légende nomme ses quatre classes. */
  { cle: "eau", id: "caEau", nom: "Restrictions d'eau", tuile: "Eau", ico: "goutte", porte: "en vigueur",
    departements: true, classes: ["Vigilance", "Alerte", "Renforcée", "Crise"] },
  { cle: "temp", id: "caTemp", nom: "Température", ico: "thermo", porte: "maintenant",
    champ: "temp", teinte: teinteT, sat: 0.54, clarte: 0.47,
    arrets: [-5, 5, 15, 25, 35], unite: "°", couleur: couleurT },
  { cle: "uv", id: "caUV", nom: "Indice UV", ico: "soleil", porte: "maximum du jour",
    champ: "uv", teinte: teinteUV, sat: satUV, clarte: clarteUV,
    arrets: [0, 2, 4, 6, 8], unite: "", couleur: couleurUV },
  /* La qualité de l'air vient d'un second service sur la même grille, d'où la
     source nommée : les trois autres nappes se partagent une seule lecture,
     celle-ci a la sienne, sa garde et sa mention. */
  /* `tuile` est le nom court du panneau ; la légende garde le nom entier. */
  /* La nappe de l'air est peinte en deux temps depuis le 20 septembre 2026.
     Copernicus interpolé couvre l'Europe, et les tuiles de l'indice officiel
     se posent par-dessus la France.

     La raison est le contraste. Les deux sources tombent dans la même classe
     neuf fois sur dix, mais l'indice ATMO retient le pire de ses cinq
     sous-indices et sépare bien mieux les zones : le 14 septembre, sur cinq
     villes, il prenait les valeurs 2, 3, 3, 3 et 4 quand l'indice européen
     restait entre 25 et 34, soit une seule classe. L'indice officiel ne couvre
     en revanche que la France, et une carte ouverte au zoom cinq montrerait un
     pays coloré dans un continent vide s'il était seul. */
  { cle: "air", id: "caAir", nom: "Qualité de l'air", tuile: "Air", ico: "brume", porte: "maintenant",
    champ: "aqi", source: "air", teinte: teinteAQI, sat: 0.58, clarte: 0.46,
    arrets: [0, 20, 40, 60, 80], unite: "", couleur: couleurAQI, officiel: true,
    credit: "Qualité de l'air Copernicus" },
];

export function vueCarte(ctx, rendre, majEtat) {
  const g = Reglages.lire();
  if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon)) {
    return {
      titre: "La carte",
      corps: `<div class="carte"><p class="vide">Aucun lieu courant.</p></div>`,
    };
  }

  const suivies = Reglages.suivies();
  const lieux = [{ nom: g.commune || "Ici", lat: g.lat, lon: g.lon, ici: true },
    ...suivies.filter(l => l.lat !== g.lat || l.lon !== g.lon)
      .map(l => ({ nom: l.commune || "Commune", lat: l.lat, lon: l.lon, ici: false }))];

  /* Le cadrage vit dans le contexte et survit aux rendus. Chaque source qui
     arrive déclenche un rendu, et sans cette mémoire la carte reviendrait à son
     cadrage d'ouverture pendant qu'on la déplace.

     Un appui sur l'onglet La carte efface ce cadrage, que l'onglet change ou
     qu'on appuie de nouveau dessus. La carte s'ouvre alors sur la France
     entière : elle sert d'abord à voir où il pleut, et la réponse est régionale
     avant d'être locale. Le bouton de retour ramène ensuite sur la commune. */
  const vue = ctx.cadreCarte || (ctx.cadreCarte = { lat: g.lat, lon: g.lon, z: null });

  return {
    titre: "La carte",
    carte: true,
    corps: `<div class="ca-cadre">`
      + `<canvas class="ca" id="caToile" role="img" `
      + `aria-label="Carte de ${esc(g.commune || "la position")} et de ses alentours"></canvas>`
      + `<canvas class="ca-vent" id="caToileVent" aria-hidden="true"></canvas>`
      + `<div class="ca-reperes" id="caReperes"></div>`
      /* Les prévisions des villes, jalon 18 : une couche d'étiquettes posée sous
         les repères des lieux, et le choix du moment. */
      + `<div class="ca-prevs" id="caPrevs" aria-hidden="true"></div>`
      + `<div class="ca-moments" id="caMoments" role="group" aria-label="Moment des prévisions" hidden>`
      + Villes.MOMENTS.map(([m, n]) => `<button type="button" data-moment="${m}" aria-pressed="false">${n}</button>`).join("")
      + `</div>`
      + `<div class="ca-outils">`
      + `<button type="button" class="ca-o" id="caCouches" aria-expanded="false" `
      + `aria-controls="caPanneau" aria-label="Couches de la carte">`
      + ico("couches", "") + `</button>`
      + `<button type="button" class="ca-o" id="caPlus" aria-label="Zoomer">`
      + ico("plus", "") + `</button>`
      + `<button type="button" class="ca-o" id="caMoins" aria-label="Dézoomer">`
      + ico("moins", "") + `</button>`
      + `<button type="button" class="ca-o" id="caIci" aria-label="Revenir sur le lieu courant">`
      + ico("cible", "") + `</button>`
      + `</div>`
      /* Le panneau en tuiles, trois par rangée, l'icône au-dessus du nom : neuf
         entrées tiennent dans un tiers du cadre, là où sept en prenaient la
         moitié en liste. Chaque tuile garde son nom, voir `styles.css`. */
      + `<div class="ca-panneau" id="caPanneau" hidden>`
      + `<p class="ca-p-titre" id="caPnTitre">Nappe</p>`
      + `<div class="ca-grille" role="radiogroup" aria-labelledby="caPnTitre">`
      + NAPPES_CARTE.map(n => `<button type="button" class="ca-ch" id="${n.id}" `
        + `role="radio" aria-checked="${Reglages.nappe() === n.cle ? "true" : "false"}">`
        + ico(n.ico, "") + `<span>${n.tuile || n.nom}</span></button>`).join("")
      + `<button type="button" class="ca-ch" id="caSansNappe" role="radio" `
      + `aria-checked="${Reglages.nappe() === null ? "true" : "false"}">`
      + ico("interdit", "") + `<span>Aucune</span></button>`
      + `</div>`
      + `<p class="ca-p-titre" id="caPnTitre2">Par-dessus</p>`
      + `<div class="ca-grille" role="group" aria-labelledby="caPnTitre2">`
      + `<button type="button" class="ca-ch" id="caPluie" role="switch" `
      + `aria-checked="${Reglages.pluiecarte() ? "true" : "false"}">`
      + ico("goutte", "") + `<span>Pluie</span></button>`
      + `<button type="button" class="ca-ch" id="caVent" role="switch" `
      + `aria-checked="${Reglages.ventcarte() ? "true" : "false"}">`
      + ico("vent", "") + `<span>Vent</span></button>`
      + `<button type="button" class="ca-ch" id="caVigi" role="switch" `
      + `aria-checked="${Reglages.vigicarte() ? "true" : "false"}">`
      + ico("alerte", "") + `<span>Vigilance</span></button>`
      + `<button type="button" class="ca-ch" id="caFoudre" role="switch" `
      + `aria-checked="${Reglages.foudrecarte() ? "true" : "false"}">`
      + ico("orage", "") + `<span>Foudre</span></button>`
      + `<button type="button" class="ca-ch" id="caNuages" role="switch" `
      + `aria-checked="${Reglages.nuagescarte() ? "true" : "false"}">`
      + ico("nuage", "") + `<span>Nuages</span></button>`
      + `<button type="button" class="ca-ch" id="caFeux" role="switch" `
      + `aria-checked="${Reglages.feuxcarte() ? "true" : "false"}">`
      + ico("feu", "") + `<span>Feux</span></button>`
      + `<button type="button" class="ca-ch" id="caPrevi" role="switch" `
      + `aria-checked="${Reglages.previcarte() ? "true" : "false"}">`
      + ico("soleil", "") + `<span>Prévisions</span></button>`
      + `<button type="button" class="ca-ch" id="caPlages" role="switch" `
      + `aria-checked="${Reglages.plagecarte() ? "true" : "false"}">`
      + ico("vague", "") + `<span>Plages</span></button>`
      + `<button type="button" class="ca-ch" id="caNeige" role="switch" `
      + `aria-checked="${Reglages.neigecarte() ? "true" : "false"}">`
      + ico("neige", "") + `<span>Neige</span></button>`
      + `<button type="button" class="ca-ch" id="caRivieres" role="switch" `
      + `aria-checked="${Reglages.rivierecarte() ? "true" : "false"}">`
      + ico("riviere", "") + `<span>Cours d'eau</span></button>`
      + `</div>`
      + `</div>`
      + `<p class="ca-mot" id="caMot" role="status" hidden></p>`
      + `<div class="ca-pied">`
      + `<div class="ca-legendes" id="caLegendes">`
      + `<div class="ca-legende" id="caLegende" hidden>`
      + `<b class="ca-l-titre" id="caLegTitre"></b>`
      + `<i class="ca-rampe" id="caRampe"></i>`
      + `<div class="ca-graduations" id="caGrads"></div>`
      + `</div>`
      + `<div class="ca-legende ca-lv" id="caLegVent" hidden></div>`
      + `<div class="ca-legende ca-lv ca-lx" id="caLegFeux" hidden `
      + `aria-label="Foyers vus par satellite sur les deux derniers jours">`
      + `<span class="ca-lv-r"><i class="ca-pastille-feu"></i>Foyers vus par satellite, 48 h</span>`
      + `</div>`
      + `<div class="ca-legende ca-lv ca-lf" id="caLegFoudre" hidden `
      + `aria-label="Foudre des trente dernières minutes, du jaune pour un éclair au rouge sombre pour vingt et plus">`
      + `<span class="ca-lv-r"><i class="ca-rampe-foudre"></i>Foudre, 30 min</span>`
      + `</div>`
      + `</div>`
      + `<div class="ca-bas">`
      + `<div class="ca-echelle" id="caEchelle"><i></i><span></span></div>`
      + `<p class="ca-credit" id="caCredit">Contours IGN et Natural Earth</p>`
      + `</div>`
      + `<div class="ca-temps" id="caTemps" hidden>`
      + `<button type="button" class="ca-jouer" id="caJouer" `
      + `aria-label="Lire la chronologie">` + ico("lecture", "") + `</button>`
      + `<div class="ca-piste" id="caPiste" role="slider" tabindex="0" `
      + `aria-label="Instant de la chronologie de pluie" `
      + `aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="">`
      + `<i class="ca-graduation"></i><i class="ca-tete"></i></div>`
      + `<b class="ca-heure" id="caHeure"></b>`
      + `</div></div></div>`,

    brancher(bloc) {
      const cv = bloc.querySelector("#caToile");
      const zone = bloc.querySelector("#caReperes");
      const barre = bloc.querySelector("#caEchelle");
      if (!cv) return;
      const zonePrev = bloc.querySelector("#caPrevs"), momentsEl = bloc.querySelector("#caMoments");
      let previAllume = Reglages.previcarte(), villesLues = null;
      let plagesAllume = Reglages.plagecarte(), merLue = null, neigeAllume = Reglages.neigecarte(), neigeLue = null;
      /* Les cours d'eau : à partir d'un zoom de l'ordre du département, la zone
         visible élargie d'un tiers, lue une fois la carte immobile, réutilisée
         tant qu'on y reste pendant dix minutes. */
      const ZOOM_RIVIERES = 7.5;
      let rivAllume = Reglages.rivierecarte(), rivLue = null, rivZone = null, rivT = 0, rivMinuteur = null;
      let momentPrev = Villes.momentDe(Number(cleHeure().slice(11, 13)));

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
        /* Les étiquettes des prévisions, dans l'ordre des villes : une étiquette
           qui en chevaucherait une autre, ou un repère de lieu, s'efface, pour
           que la carte du pays reste lisible. */
        /* Chaque étiquette se compare aux rectangles réels déjà posés, centrés
           sur leur point, avec deux points de marge : une première version
           comparait une seule largeur et une hauteur fixe, et laissait deux
           étiquettes se chevaucher. Les repères des lieux comptent pour un
           carré de trente points. */
        const pris = boutons.filter(b => !b.hidden).map(b => ({
          x: parseFloat(b.style.getPropertyValue("--rx")), y: parseFloat(b.style.getPropertyValue("--ry")), w: 30, h: 30 }));
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
        const e = Carte.echelleBarre(vue, cv.clientWidth);
        barre.style.setProperty("--eb", `${Math.round(e.px)}px`);
        if (rivAllume) planRivieres();
        barre.querySelector("span").textContent = `${e.km} km`;
      };

      /* ---------- Les couches ----------

         Elles se glissent entre le fond et les traits. La carte ne sait pas ce
         qu'elle peint là, et les couches ne savent rien du fond. */
      let choisie = Reglages.nappe();
      let allume = Reglages.pluiecarte();
      let hote = "", images = [], rang = 0, enLecture = false;

      const couche = (c, v, l, h) => {
        if (!allume || !images.length) return 0;
        return Radar.peindre(c, v, l, h, hote, images[rang].chemin,
          () => main.redessiner());
      };

      /* Les nappes de valeurs : une grille de points, une couleur étalée entre
         eux. Les rampes sont celles du ruban et de la table de la semaine, et la
         table des nappes dit laquelle va avec quel champ : le tracé ne connaît
         pas les grandeurs, il connaît une valeur et une teinte. */
      let mesures = null;
      let mesuresAir = null;
      /* La grille d'une nappe : celle de la prévision pour trois d'entre elles,
         celle de la qualité de l'air pour la quatrième. Les deux se posent sur
         les mêmes points et se peignent de la même façon ; seule la lecture
         diffère. */
      const grilleDe = n => (n && n.source === "air" ? mesuresAir : mesures);
      const coucheValeur = (c, v, l, h) => {
        const n = NAPPES_CARTE.find(x => x.cle === choisie && x.champ);
        const g = grilleDe(n);
        if (!n || !g) return 0;
        const posees = Carte.peindreNappe(c, v, l, h,
          NappeCarte.couche(g[n.champ], n.teinte),
          { opacite: 0.62, sat: n.sat, clarte: n.clarte });
        /* Les tuiles de l'indice officiel se posent par-dessus l'interpolation,
           sur la France seule : elles y séparent bien mieux les zones, et
           l'interpolation garde le reste de l'Europe. */
        if (!n.officiel) return posees;
        return posees + Atmo.peindre(c, v, l, h, Radar.tuilesVues,
          () => main.redessiner());
      };

      /* Le vent, sur sa propre toile posée devant celle de la carte. Il ne
         couvre pas le fond, il n'entre donc pas dans le choix exclusif des
         nappes : il se coche à part et se pose sur ce qui est dessous.

         Sa toile est séparée parce que les deux tracés n'ont pas la même
         cadence. La carte se refait à la demande, les particules trente fois
         par seconde ; les mêler ferait redessiner tout le fond à chaque
         image. */
      const cvVent = bloc.querySelector("#caToileVent");
      let ventAllume = Reglages.ventcarte();
      const etatVent = () => ({
        vue,
        emprise: { S: NappeCarte.S, N: NappeCarte.N, O: NappeCarte.O, E: NappeCarte.E },
        couleur: getComputedStyle(cv).getPropertyValue("--ca-vent").trim() || "#7c8b9c",
        champ: !mesures ? null : (la, lo) => {
          const vitesse = NappeCarte.valeurA(mesures.vent, la, lo);
          const direction = NappeCarte.valeurA(mesures.dir, la, lo);
          return vitesse === null || direction === null ? null : { vitesse, direction };
        },
      });
      const poserVent = () => {
        if (ventAllume && mesures) Vent.poser(cvVent, etatVent);
        else Vent.poser(null);
      };

      /* La vigilance. Le vert ne se teinte pas, une vigilance verte n'étant pas
         une vigilance.

         Elle se peint de deux façons. En fond sous la pluie, laquelle est
         tachetée et laisse voir ce qu'il y a dessous. En liseré par-dessus une
         nappe pleine, qui couvrirait un fond teinté : une alerte doit rester
         visible quelle que soit la couche choisie. */
      let vigiAllume = Reglages.vigicarte();
      let vigiNiveaux = null;
      const vigiEnTrait = () => NAPPES_CARTE.some(n => n.cle === choisie && (n.champ || n.departements));
      /* Les restrictions d'eau teintent les départements ; la vigilance météo
         passe alors en liseré, comme au-dessus des nappes de valeurs. */
      let eauNiveaux = null;
      const coucheEau = (c, v, l, h) => {
        if (choisie !== "eau" || !eauNiveaux) return 0;
        return Carte.peindreDepartements(cv, c, v, l, h, eauNiveaux, { palette: "ve" });
      };
      const coucheVigiFond = (c, v, l, h) => {
        if (!vigiAllume || !vigiNiveaux || vigiEnTrait()) return 0;
        return Carte.peindreDepartements(cv, c, v, l, h, vigiNiveaux);
      };
      const coucheVigiTrait = (c, v, l, h) => {
        if (!vigiAllume || !vigiNiveaux || !vigiEnTrait()) return 0;
        return Carte.peindreDepartements(cv, c, v, l, h, vigiNiveaux, { trait: true });
      };

      /* Les nuages, sous la pluie : la pluie tombe de la masse nuageuse et doit
         rester lisible par-dessus elle. La tuile arrive opaque et se rend
         transparente à son arrivée, un ciel dégagé laissant voir la carte. */
      let nuagesAllume = Reglages.nuagescarte();
      let nuagesDernier = 0;
      const finNuages = () => {
        if (!nuagesDernier) return 0;
        if (allume && images.length && rang !== Radar.rangCourant(images)) {
          return Nuages.pasProche(images[rang].t, nuagesDernier);
        }
        return nuagesDernier;
      };
      const coucheNuages = (c, v, l, h) => {
        if (!nuagesAllume) return 0;
        return Nuages.peindre(c, v, l, h, finNuages(), () => main.redessiner());
      };

      /* Les feux, par-dessus tout le reste : quelques points par département,
         qui se perdraient sous une averse. */
      let feuxAllume = Reglages.feuxcarte();
      const coucheFeux = (c, v, l, h) => {
        if (!feuxAllume) return 0;
        return Feux.peindre(c, v, l, h, Date.now(), () => main.redessiner());
      };

      /* La foudre, par-dessus la pluie : clairsemée, elle se lit sur toute
         nappe. La fenêtre finit au dernier pas publié, ou au pas le plus
         proche de l'image de pluie regardée quand la chronologie est
         parcourue : l'orage se lit à l'heure de la pluie qu'on regarde. */
      let foudreAllume = Reglages.foudrecarte();
      let foudreDernier = 0;
      const finFoudre = () => {
        if (!foudreDernier) return 0;
        if (allume && images.length && rang !== Radar.rangCourant(images)) {
          return Foudre.pasProche(images[rang].t, foudreDernier);
        }
        return foudreDernier;
      };
      const coucheFoudre = (c, v, l, h) => {
        if (!foudreAllume) return 0;
        return Foudre.peindre(c, v, l, h, finFoudre(), () => main.redessiner());
      };

      /* L'ordre de tracé, écrit une fois : la pose du geste et le premier tracé
         prennent la même liste. */
      /* La foudre ne demande pas la gaine des traits : ses tuiles comptent
         comme posées même vides, et un liseré le long des limites ferait lire
         une couche là où il n'y a pas d'orage. */
      const COUCHES = [coucheEau, coucheVigiFond, { peindre: coucheValeur, gaine: false },
        { peindre: coucheNuages, gaine: false },
        couche, { peindre: coucheFoudre, gaine: false },
        { peindre: coucheFeux, gaine: false },
        { peindre: coucheVigiTrait, gaine: false }];
      const main = Carte.poser(cv, vue, placer, COUCHES);
      const revoir = () => { main.redessiner(); };

      /* Le premier tracé attend que la toile ait sa taille. Le cadrage
         d'ouverture aussi : il fait tenir la France dans le cadre, et la
         largeur du cadre décide du zoom. */
      requestAnimationFrame(() => {
        if (vue.z === null) {
          Object.assign(vue, Carte.vueSur(Carte.FRANCE, cv.clientWidth, cv.clientHeight));
        }
        Carte.dessiner(cv, vue, COUCHES);
        placer();
        /* Le vent posé avant ce cadrage, quand les mesures arrivent vite, ne
           trouvait aucune échelle et ne traçait rien ; sous mouvement réduit,
           il ne se redessinait plus. Il se repose donc une fois la vue
           cadrée. Défaut révélé le 2 octobre 2026 par le chargement différé de
           la carte, qui a changé l'ordre des arrivées. */
        if (mesures) poserVent();
      });

      const pas = d => {
        Object.assign(vue, Carte.borner({ ...vue, z: vue.z + d }));
        revoir();
      };
      bloc.querySelector("#caPlus").addEventListener("click", () => pas(1));
      bloc.querySelector("#caMoins").addEventListener("click", () => pas(-1));
      bloc.querySelector("#caIci").addEventListener("click", () => {
        Object.assign(vue, Carte.borner({ lat: g.lat, lon: g.lon, z: Carte.ZDEFAUT }));
        revoir();
      });

      /* Un appui sur un repère bascule la commune, comme une rangée de la liste
         des lieux. Le repère du lieu courant ne bascule rien et ramène la vue
         sur lui : c'est déjà là qu'on est. */
      for (const b of boutons) {
        b.addEventListener("click", () => {
          const l = lieux[Number(b.dataset.lieu)];
          if (l.ici) {
            Object.assign(vue, Carte.borner({ lat: l.lat, lon: l.lon, z: vue.z }));
            revoir();
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

      /* ---------- La chronologie ----------

         Deux heures d'images observées au pas de dix minutes, et l'extrapolation
         du service quand il en publie. Elle ne se met pas en marche seule : une
         carte s'ouvre sur ce qu'il pleut maintenant, non sur un film. */
      const rangee = bloc.querySelector("#caTemps");
      const piste = bloc.querySelector("#caPiste");
      const jouer = bloc.querySelector("#caJouer");
      const heure = bloc.querySelector("#caHeure");
      const mot = bloc.querySelector("#caMot");
      const credit = bloc.querySelector("#caCredit");

      const dire = t => {
        mot.textContent = t || "";
        mot.hidden = !t;
      };

      const poserRang = k => {
        rang = Math.max(0, Math.min(images.length - 1, k));
        const im = images[rang];
        const part = images.length > 1 ? rang / (images.length - 1) : 1;
        piste.style.setProperty("--cp", `${(part * 100).toFixed(2)}%`);
        const dit = heureJour(new Date(im.t));
        piste.setAttribute("aria-valuenow", String(rang));
        piste.setAttribute("aria-valuetext", im.futur ? `${dit}, prévu` : dit);
        piste.classList.toggle("ca-piste-futur", im.futur === true);
        heure.textContent = dit;
        heure.classList.toggle("ca-heure-futur", im.futur === true);
        revoir();
      };

      /* Le pas de la piste : le rang le plus proche du doigt. La piste est un
         curseur et non treize boutons : treize cibles sur trois cents points
         feraient vingt-deux points chacune, la moitié de ce qu'un doigt vise. */
      const versDoigt = x => {
        const r = piste.getBoundingClientRect();
        if (!r.width || images.length < 2) return;
        const part = Math.max(0, Math.min(1, (x - r.left) / r.width));
        poserRang(Math.round(part * (images.length - 1)));
      };
      let glisse = false;
      piste.addEventListener("pointerdown", ev => {
        /* La capture échoue si le pointeur n'est plus actif, ce qui arrive quand
           un doigt se lève entre l'évènement et son traitement. L'échec ne doit
           pas emporter le reste : le rang se pose quand même. */
        try { piste.setPointerCapture(ev.pointerId); } catch { /* sans capture */ }
        glisse = true; arreter(); versDoigt(ev.clientX);
      });
      piste.addEventListener("pointermove", ev => { if (glisse) versDoigt(ev.clientX); });
      const lacher = () => { glisse = false; };
      piste.addEventListener("pointerup", lacher);
      piste.addEventListener("pointercancel", lacher);
      piste.addEventListener("keydown", ev => {
        const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
        if (d) { arreter(); poserRang(rang + d); ev.preventDefault(); return; }
        if (ev.key === "Home") { arreter(); poserRang(0); ev.preventDefault(); }
        if (ev.key === "End") { arreter(); poserRang(images.length - 1); ev.preventDefault(); }
      });

      function arreter() {
        enLecture = false;
        jouer.innerHTML = ico("lecture", "");
        jouer.setAttribute("aria-label", "Lire la chronologie");
      }

      /* La lecture attend que l'image suivante soit entière avant de la montrer.
         Une animation qui saute les images non chargées montre une pluie qui
         bondit au lieu d'avancer. La dernière image tient plus longtemps :
         c'est celle qu'on regarde. */
      async function lire() {
        enLecture = true;
        jouer.innerHTML = ico("pause", "");
        jouer.setAttribute("aria-label", "Arrêter la chronologie");
        while (enLecture && cv.isConnected) {
          const k = (rang + 1) % images.length;
          const l = cv.clientWidth, h = cv.clientHeight;
          await Radar.preparer(vue, l, h, hote, images[k].chemin);
          if (!enLecture || !cv.isConnected) break;
          poserRang(k);
          await new Promise(t => setTimeout(t, k === images.length - 1 ? 1100 : 420));
        }
        if (!cv.isConnected) enLecture = false;
      }
      jouer.addEventListener("click", () => { if (enLecture) arreter(); else lire(); });

      /* La mention des sources. Deux lignes plutôt qu'une : sur trois cent
         quatre-vingt-dix points, les deux mentions bout à bout débordent la
         largeur et passent sous les commandes. */
      const mention = () => {
        credit.innerHTML = (allume
          ? `<span>Pluie <a href="https://www.rainviewer.com" target="_blank" `
            + `rel="noopener noreferrer">RainViewer</a></span>`
          : "")
          + (() => {
            /* Deux couches de la même source ne la nomment qu'une fois. La
               nappe qui porte son propre crédit vient d'ailleurs et se nomme à
               part : la fondre avec le vent dirait une source pour l'autre. */
            const n = NAPPES_CARTE.find(x => x.cle === choisie && x.champ);
            const nOM = n && !n.credit ? n : null;
            const noms = [nOM && nOM.nom, ventAllume ? "vent" : null].filter(Boolean);
            const propre = n && n.credit ? `<span>${n.credit}</span>` : "";
            if (!noms.length) return propre;
            const brut = noms.length === 2 ? `${noms[0]} et ${noms[1]}` : noms[0];
            const dit = brut.charAt(0).toUpperCase() + brut.slice(1);
            return `<span>${dit} <a href="https://open-meteo.com" target="_blank" `
              + `rel="noopener noreferrer">Open-Meteo</a></span>` + propre;
          })()
          + (vigiAllume ? `<span>Vigilance Météo-France</span>` : "")
          + (previAllume || plagesAllume || neigeAllume ? `<span>${[previAllume && "Prévisions", plagesAllume && "mer",
            neigeAllume && "neige"].filter(Boolean).join(", ").replace(/^./, c => c.toUpperCase())} Open-Meteo</span>` : "")
          + (neigeAllume ? `<span>Stations OpenSkiMap, © contributeurs OpenStreetMap</span>` : "")
          + (rivAllume ? `<span>Cours d'eau Hub'eau</span>` : "")
          + (choisie === "eau" ? `<span>Restrictions <a href="https://vigieau.gouv.fr" target="_blank" `
            + `rel="noopener noreferrer">VigiEau</a></span>` : "")
          + (foudreAllume || nuagesAllume
            ? `<span>${foudreAllume && nuagesAllume ? "Foudre et nuages"
              : foudreAllume ? "Foudre" : "Nuages"} `
              + `<a href="https://www.eumetsat.int" target="_blank" `
              + `rel="noopener noreferrer">EUMETSAT</a></span>`
            : "")
          + (feuxAllume
            ? `<span>Feux <a href="https://effis.jrc.ec.europa.eu" target="_blank" `
              + `rel="noopener noreferrer">Copernicus</a></span>`
            : "")
          + `<span>Contours IGN et Natural Earth</span>`;
      };

      /* La légende. Une rampe de couleur sans échelle ne se lit pas : deux
         teintes voisines ne disent rien si l'on ne sait pas à quels degrés elles
         répondent. Les graduations sont celles de la rampe écrite, non celles de
         la vue : une échelle qui bougerait au glissement ferait changer de
         couleur des lieux qui n'ont pas changé de température. */
      const legende = bloc.querySelector("#caLegende");
      const rampeEl = bloc.querySelector("#caRampe");
      const titreLeg = bloc.querySelector("#caLegTitre");
      const grads = bloc.querySelector("#caGrads");
      const legVent = bloc.querySelector("#caLegVent");
      const legFoudre = bloc.querySelector("#caLegFoudre");
      const legFeux = bloc.querySelector("#caLegFeux");
      const poserLegende = () => {
        const n = NAPPES_CARTE.find(x => x.cle === choisie && (x.champ || x.departements));
        legende.hidden = !n;
        if (n && n.departements) {
          const cs = getComputedStyle(cv);
          const ve = n.classes.map((_, i) => cs.getPropertyValue(`--ca-ve${i + 1}`).trim());
          const pas = 100 / ve.length;
          rampeEl.style.background = `linear-gradient(to right, ${ve.map((c, i) => `${c} ${(i * pas).toFixed(0)}% ${((i + 1) * pas).toFixed(0)}%`).join(", ")})`;
          titreLeg.textContent = `${n.nom}, ${n.porte}`;
          grads.innerHTML = n.classes.map(v => `<span>${esc(v)}</span>`).join("");
          legende.setAttribute("aria-label", `${n.nom} en vigueur, de la vigilance à la crise`);
        } else if (n) {
          const a = n.arrets;
          rampeEl.style.background = `linear-gradient(to right, ${
            a.map((v, i) => `${n.couleur(v)} ${(i / (a.length - 1) * 100).toFixed(0)}%`).join(", ")})`;
          /* La légende dit sur quoi la nappe porte : la température vaut pour
             l'instant, l'indice ultraviolet pour la journée. Deux registres sous
             le même sélecteur, et rien d'autre ne les distingue. */
          titreLeg.textContent = `${n.nom}, ${n.porte}`;
          grads.innerHTML = a.map(v => `<span>${v}${n.unite}</span>`).join("");
          legende.setAttribute("aria-label",
            `Échelle de ${n.nom.toLowerCase()}, ${n.porte}, de ${a[0]} à ${a[a.length - 1]}`);
        }
        /* Le vent ne porte pas de couleur : sa force se lit à la longueur des
           traînées. La légende montre donc trois traînées et les nomme, avec
           les mots de l'échelle du ruban. */
        legFeux.hidden = !feuxAllume;
        legFoudre.hidden = !foudreAllume;
        legVent.hidden = !ventAllume;
        if (legVent.hidden) return;
        const rep = ECHELLES.v.filter(([v]) => v === 12 || v === 30 || v === 50);
        legVent.innerHTML = rep.map(([v, nom]) =>
          `<span class="ca-lv-r"><i style="width:${Vent.longueurTrace(v).toFixed(1)}px"></i>`
          + `${esc(nom.toLowerCase())}</span>`).join("");
        legVent.setAttribute("aria-label",
          `Vent moyen : ${rep.map(([v, nom]) => `${nom.toLowerCase()} ${v} kilomètres par heure`).join(", ")}`);
      };

      /* L'index dit où sont les images et à quelle heure elles ont été prises.
         Le service publie parfois aucune image extrapolée : la couche ne
         l'invente pas et s'arrête alors à la dernière image observée. */
      const lireIndex = async () => {
        try {
          const d = await Radar.charger();
          if (!cv.isConnected) return;
          hote = d.hote; images = d.images;
          if (!images.length) { dire("Le radar n'a pas d'image."); return; }
          dire("");
          piste.setAttribute("aria-valuemax", String(images.length - 1));
          piste.style.setProperty("--cn", String(images.length));
          /* La chronologie appartient à la pluie : une lecture qui arrive après
             que la couche a été éteinte ne doit pas la faire paraître. */
          rangee.hidden = !allume || images.length < 2;
          poserRang(Radar.rangCourant(images));
        } catch {
          if (!cv.isConnected) return;
          dire("La pluie a besoin du réseau.");
        }
      };

      /* Les grilles de mesures. Une lecture sert les trois nappes de la
         prévision et le vent ; la qualité de l'air a la sienne, sur les mêmes
         points mais sur un autre service. Ni l'une ni l'autre ne part si aucune
         couche qui en vit n'est allumée. */
      const lireMesures = async () => {
        try {
          const d = await NappeCarte.charger();
          if (!cv.isConnected) return;
          if (!d) { dire("La nappe a besoin du réseau."); return; }
          mesures = d;
          dire("");
          revoir();
          poserVent();
        } catch {
          if (cv.isConnected) dire("La nappe a besoin du réseau.");
        }
      };

      const lireAir = async () => {
        try {
          const d = await NappeCarte.chargerAir();
          if (!cv.isConnected) return;
          if (!d) { dire("La nappe a besoin du réseau."); return; }
          mesuresAir = d;
          dire("");
          revoir();
        } catch {
          if (cv.isConnected) dire("La nappe a besoin du réseau.");
        }
      };

      /* Le choix de nappe. Une seule à la fois, ou aucune : ce sont des
         étalements de couleur sur toute la surface. Le choix se garde d'une
         visite à l'autre, et une nappe éteinte ne demande rien à sa source. */
      const rangs = new Map(NAPPES_CARTE.map(n => [n.cle, bloc.querySelector(`#${n.id}`)]));
      const sans = bloc.querySelector("#caSansNappe");

      const poserChoix = c => {
        choisie = c;
        Reglages.poserNappe(c);
        for (const [cle, el] of rangs) el.setAttribute("aria-checked", cle === c ? "true" : "false");
        sans.setAttribute("aria-checked", c === null ? "true" : "false");
        mention();
        poserLegende();
        if (c === "eau") {
          if (eauNiveaux) revoir(); else lireEau();
          return;
        }
        const n = NAPPES_CARTE.find(x => x.cle === c && x.champ);
        if (n) {
          if (grilleDe(n)) revoir();
          else if (n.source === "air") lireAir();
          else lireMesures();
          return;
        }
        dire("");
        revoir();
      };

      for (const [cle, el] of rangs) el.addEventListener("click", () => poserChoix(cle));
      sans.addEventListener("click", () => poserChoix(null));

      /* Le panneau des couches. Quatre interrupteurs empilés dans la colonne
         auraient pris la moitié de la hauteur du cadre, et chaque couche à venir
         en aurait pris un de plus. Un bouton ouvre la liste, la liste porte les
         noms : une icône seule ne dit pas ce qu'elle allume. */
      const ouvrir = bloc.querySelector("#caCouches");
      const panneau = bloc.querySelector("#caPanneau");
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
      panneau.addEventListener("click", e => e.stopPropagation());
      /* Un appui sur la carte referme le panneau : il couvre le coin de la vue,
         et le refermer par son propre bouton demanderait de viser deux fois. */
      cv.addEventListener("pointerdown", () => montrer(false), { passive: true });

      /* L'interrupteur du vent. Éteint au départ : la couche anime une toile en
         permanence, ce qui se paie en batterie. Allumé, il lit la grille si elle
         n'est pas déjà là, celle-là même que la nappe de température emploie. */
      const ventB = bloc.querySelector("#caVent");
      ventB.addEventListener("click", async () => {
        ventAllume = !ventAllume;
        Reglages.poserVentcarte(ventAllume);
        ventB.setAttribute("aria-checked", ventAllume ? "true" : "false");
        mention();
        poserLegende();
        if (ventAllume && !mesures) await lireMesures();
        poserVent();
      });

      /* La vigilance de tout le pays, une lecture de mille deux cents octets. Un
         département au vert ne paraît pas dans la table : la couche ne teinte
         que ce qui est en vigilance. */
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
        momentsEl.hidden = !previAllume;
        momentsEl.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.moment === momentPrev ? "true" : "false"));
        const jour = cleHeure().slice(0, 10);
        const previs = previAllume && villesLues ? Villes.VILLES.map((v, k) => {
          const m = Villes.tempsMoment(villesLues[k], momentPrev, jour);
          if (!m || m.code === null || m.t === null) return "";
          const t = momentPrev === "demain" ? `${m.min}° ${m.max}°` : `${m.t}°`;
          return `<span class="ca-pv" data-lat="${v[1]}" data-lon="${v[2]}" title="${esc(v[0])}">${icoTemps(icoCiel(m.code, m.jour), "")}<b>${t}</b></span>`;
        }).join("") : "";
        const neiges = neigeAllume && neigeLue ? neigeLue.filter(s => s.sol > 0).map(s => `<span class="ca-pv ca-pv-neige" data-lat="${s.lat}" `
          + `data-lon="${s.lon}" title="${esc(s.nom)}">${ico("neige", "")}<b>${s.sol} cm</b></span>`).join("") : "";
        const mers = plagesAllume && merLue ? merLue.map(p => `<span class="ca-pv ca-pv-mer" data-lat="${p.lat}" data-lon="${p.lon}" `
          + `title="${esc(p.nom)}">${ico("vague", "")}<b>${fr1(Math.round(p.eau))}°</b>${p.vagues !== null ? `<i>${fr1(p.vagues)} m</i>` : ""}</span>`).join("") : "";
        const rivs = rivAllume && rivLue ? rivLue.map(r => `<span class="ca-pv ca-pv-riv" data-lat="${r.lat}" data-lon="${r.lon}" `
          + `title="Station ${esc(r.code)}">${ico("riviere", "")}<b>${fr1((Math.round(r.h / 10) / 100).toFixed(2))} m</b>`
          + (r.ecart >= 20 ? `<span class="ca-t ca-t-haut" aria-label="en hausse"></span>` : r.ecart <= -20 ? `<span class="ca-t ca-t-bas" aria-label="en baisse"></span>` : "")
          + `</span>`).join("") : "";
        zonePrev.innerHTML = neiges + mers + rivs + previs;
        placer();
      };
      const lireVilles = () => Villes.lireVilles().then(l => { if (!cv.isConnected) return; villesLues = l; poserPrevis(); })
        .catch(() => { if (cv.isConnected) dire("Les prévisions ont besoin du réseau."); });
      const previB = bloc.querySelector("#caPrevi");
      previB.addEventListener("click", () => {
        previAllume = !previAllume;
        Reglages.poserPrevicarte(previAllume);
        previB.setAttribute("aria-checked", previAllume ? "true" : "false");
        mention();
        if (previAllume && !villesLues) lireVilles();
        poserPrevis();
      });
      momentsEl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { momentPrev = b.dataset.moment; poserPrevis(); }));
      if (previAllume) lireVilles();
      /* Les plages et la neige : un interrupteur chacune, une lecture chacune. Sans
         neige au sol dans aucun grand domaine, la carte le dit. */
      const lireMer = () => Plage.lireMerCarte(cleHeure()).then(l => { if (!cv.isConnected) return; merLue = l; poserPrevis(); })
        .catch(() => { if (cv.isConnected) dire("La mer a besoin du réseau."); });
      const lireNeigeC = () => Neige.lireNeigeCarte(cleHeure()).then(l => {
        if (!cv.isConnected) return;
        neigeLue = l; poserPrevis();
        if (neigeAllume && !l.some(s => s.sol > 0)) dire("Pas de neige au sol au sommet des grands domaines.");
      }).catch(() => { if (cv.isConnected) dire("La neige a besoin du réseau."); });
      const interrupteur = (id, lire, poserReglage, etat, majEtat, deja) => {
        const b = bloc.querySelector(id);
        b.addEventListener("click", () => {
          const v = !etat();
          majEtat(v);
          poserReglage(v);
          b.setAttribute("aria-checked", v ? "true" : "false");
          mention();
          if (v && !deja()) lire();
          poserPrevis();
        });
      };
      /* La lecture des cours d'eau, planifiée à chaque mouvement de la carte et
         lancée quand elle s'immobilise ; rien en deçà du zoom requis. */
      function planRivieres() {
        clearTimeout(rivMinuteur);
        rivMinuteur = setTimeout(() => {
          if (!cv.isConnected || !rivAllume || vue.z < ZOOM_RIVIERES) return;
          const l = cv.clientWidth, h = cv.clientHeight;
          const a = Carte.depuisEcran(vue, 0, 0, l, h), b = Carte.depuisEcran(vue, l, h, l, h);
          const bb = { o: a.lon, n: a.lat, e: b.lon, s: b.lat };
          const z0 = rivZone;
          if (z0 && bb.o >= z0.o && bb.e <= z0.e && bb.s >= z0.s && bb.n <= z0.n && Date.now() - rivT < 600000) return;
          const dlo = (bb.e - bb.o) / 3, dla = (bb.n - bb.s) / 3;
          const z = { o: bb.o - dlo, e: bb.e + dlo, s: bb.s - dla, n: bb.n + dla };
          rivZone = z; rivT = Date.now();
          Eau.lireRivieresCarte(z).then(lu => { if (!cv.isConnected) return; rivLue = lu; poserPrevis(); })
            .catch(() => { rivZone = null; if (cv.isConnected) dire("Les cours d'eau ont besoin du réseau."); });
        }, 900);
      }
      interrupteur("#caPlages", lireMer, Reglages.poserPlagecarte, () => plagesAllume, v => { plagesAllume = v; }, () => merLue);
      const rivB = bloc.querySelector("#caRivieres");
      rivB.addEventListener("click", () => {
        rivAllume = !rivAllume;
        Reglages.poserRivierecarte(rivAllume);
        rivB.setAttribute("aria-checked", rivAllume ? "true" : "false");
        mention();
        if (rivAllume && vue.z < ZOOM_RIVIERES) dire("Zoomez sur la carte pour voir les cours d'eau.");
        poserPrevis();
      });
      interrupteur("#caNeige", lireNeigeC, Reglages.poserNeigecarte, () => neigeAllume, v => { neigeAllume = v; }, () => neigeLue);
      if (plagesAllume) lireMer();
      if (neigeAllume) lireNeigeC();
      poserPrevis();

      /* Les restrictions d'eau de tout le pays, une lecture de VigiEau. */
      const lireEau = async () => {
        try {
          const t = await VigiEau.departements();
          if (!cv.isConnected) return;
          eauNiveaux = t;
          revoir();
        } catch { if (cv.isConnected) dire("La nappe a besoin du réseau."); }
      };
      if (choisie === "eau") lireEau();

      const vigi = bloc.querySelector("#caVigi");
      const lireVigi = async () => {
        try {
          const d = await Vig.pays();
          if (!cv.isConnected || !d) return;
          const t = new Map();
          for (const [code, niveau] of d.niveaux) if (niveau >= 2) t.set(code, niveau);
          vigiNiveaux = t;
          revoir();
        } catch { /* la carte se lit sans la vigilance */ }
      };
      vigi.addEventListener("click", () => {
        vigiAllume = !vigiAllume;
        Reglages.poserVigicarte(vigiAllume);
        vigi.setAttribute("aria-checked", vigiAllume ? "true" : "false");
        mention();
        if (vigiAllume && !vigiNiveaux) lireVigi(); else revoir();
      });

      /* La foudre. Une lecture de sept kilooctets dit le dernier pas publié ;
         les tuiles suivent au tracé. Sans réseau la carte se lit sans elle. */
      const foudreB = bloc.querySelector("#caFoudre");
      const lireFoudre = async () => {
        try {
          const d = await Foudre.charger();
          if (!cv.isConnected || !d) return;
          foudreDernier = d.dernier;
          revoir();
        } catch { /* la carte se lit sans la foudre */ }
      };
      /* La pluie, superposition depuis le 19 septembre 2026. La chronologie la
         suit : elle paraît quand la pluie est allumée et que le service a rendu
         plus d'une image, et s'efface avec elle. */
      const pluieB = bloc.querySelector("#caPluie");
      pluieB.addEventListener("click", () => {
        allume = !allume;
        Reglages.poserPluiecarte(allume);
        pluieB.setAttribute("aria-checked", allume ? "true" : "false");
        mention();
        poserLegende();
        if (!allume) { arreter(); rangee.hidden = true; revoir(); return; }
        dire("");
        if (images.length) { rangee.hidden = images.length < 2; revoir(); } else lireIndex();
      });

      const feuxB = bloc.querySelector("#caFeux");
      feuxB.addEventListener("click", () => {
        feuxAllume = !feuxAllume;
        Reglages.poserFeuxcarte(feuxAllume);
        feuxB.setAttribute("aria-checked", feuxAllume ? "true" : "false");
        mention();
        poserLegende();
        revoir();
      });

      const nuagesB = bloc.querySelector("#caNuages");
      const lireNuages = async () => {
        try {
          const d = await Nuages.charger();
          if (!cv.isConnected || !d) return;
          nuagesDernier = d.dernier;
          revoir();
        } catch { /* la carte se lit sans les nuages */ }
      };
      nuagesB.addEventListener("click", () => {
        nuagesAllume = !nuagesAllume;
        Reglages.poserNuagescarte(nuagesAllume);
        nuagesB.setAttribute("aria-checked", nuagesAllume ? "true" : "false");
        mention();
        if (nuagesAllume && !nuagesDernier) lireNuages(); else revoir();
      });
      foudreB.addEventListener("click", () => {
        foudreAllume = !foudreAllume;
        Reglages.poserFoudrecarte(foudreAllume);
        foudreB.setAttribute("aria-checked", foudreAllume ? "true" : "false");
        mention();
        poserLegende();
        if (foudreAllume && !foudreDernier) lireFoudre(); else revoir();
      });

      mention();
      poserLegende();
      if (allume) lireIndex();
      if (foudreAllume) lireFoudre();
      if (nuagesAllume) lireNuages();
      /* Chaque source ne part que si une couche qui en vit est allumée. La
         grille de la prévision sert trois nappes et le vent, celle de la
         qualité de l'air ne sert qu'elle-même. */
      const auDepart = NAPPES_CARTE.find(n => n.cle === choisie && n.champ);
      if ((auDepart && !auDepart.source) || ventAllume) lireMesures();
      if (auDepart && auDepart.source === "air") lireAir();
      if (vigiAllume) lireVigi();

      /* Un seul écouteur à la fois : chaque rendu de la carte en ajoutait un,
         qui gardait l'ancienne carte en mémoire et la redessinait à chaque
         rotation. Audit du 1er octobre 2026, constat 5.3. */
      poserRedimension("carte", revoir);
    },
  };
}
