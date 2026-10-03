/* Les couches de la carte qui se peignent sur la toile ou à côté d'elle : les
   nappes de valeurs, les restrictions d'eau, la vigilance, les nuages, les feux,
   la foudre et le vent, avec leurs lectures et leurs interrupteurs. Sorti de
   src/vues/carte.js le 2 octobre 2026, docs/plan-chantiers-facultatifs.md. Les
   modules de la carte partagent l'objet d'état décrit dans src/vues/carte.js. */

import * as Reglages from "../reglages.js";
import * as VigiEau from "../vigieau.js";
import * as Carte from "../carte.js";
import * as Radar from "../radar.js";
import * as Foudre from "../foudre.js";
import * as Atmo from "../atmo.js";
import * as Nuages from "../nuages.js";
import * as Feux from "../feux.js";
import * as NappeCarte from "../nappe.js";
import * as Vent from "../vent.js";
import * as Vig from "../vigilance.js";
import * as Prevue from "../prevue.js";
import * as ZonesEau from "../zones-eau.js";
import { NAPPES_CARTE } from "./carte-gabarit.js";
import { couchePluie } from "./carte-chronologie.js";

/* ---------- Les couches ----------

   Elles se glissent entre le fond et les traits. La carte ne sait pas ce
   qu'elle peint là, et les couches ne savent rien du fond. */
export function brancherCouches(E) {
  const { bloc, cv } = E;

  /* Les nappes de valeurs : une grille de points, une couleur étalée entre
     eux. Les rampes sont celles du ruban et de la table de la semaine, et la
     table des nappes dit laquelle va avec quel champ : le tracé ne connaît
     pas les grandeurs, il connaît une valeur et une teinte. */
  /* La grille d'une nappe : celle de la prévision pour trois d'entre elles,
     celle de la qualité de l'air pour la quatrième. Les deux se posent sur
     les mêmes points et se peignent de la même façon ; seule la lecture
     diffère. */
  /* Depuis la version 149, une troisième grille, la prévue, sert les nappes
     du jalon 19, lot 5 : sa vue de l'heure choisie porte chaque champ. */
  /* Sur une heure prévue de la chronologie, la température se lit dans la
     grille prévue, à cette heure : lot 5c. */
  const grilleDe = n => (!n ? E.mesures : n.source === "air" ? E.mesuresAir
    : n.source === "prevue" ? E.prevueVue : n.source === "pollens" ? E.grillePollens
      : n.source === "mer" ? E.grilleMer
        : n.parHeure && E.heurePrevue > 0 && E.prevueVue ? E.prevueVue : E.mesures);
  E.grilleDe = grilleDe;
  const coucheValeur = (c, v, l, h) => {
    const n = NAPPES_CARTE.find(x => x.cle === E.choisie && x.champ);
    const g = grilleDe(n);
    if (!n || !g) return 0;
    const posees = Carte.peindreNappe(c, v, l, h,
      NappeCarte.couche(g[n.champ], n.teinte, n.mer === true),
      { opacite: 0.62, sat: n.sat, clarte: n.clarte, mer: n.mer === true });
    /* Les isolignes, par-dessus la nappe : les isobares, le trait du gel. */
    if (n.isolignes) {
      const cs = getComputedStyle(cv);
      Carte.peindreIsolignes(c, v, l, h, g[n.champ], n.isolignes, { unite: n.unite === "°" ? "°" : "",
        trait: cs.getPropertyValue("--etiquette").trim() || "#2b3542", halo: cs.getPropertyValue("--ca-fond").trim() || "#fff",
        epais: n.cle === "gel" ? 2 : 1.1 });
    }
    /* Les tuiles de l'indice officiel se posent par-dessus l'interpolation,
       sur la France seule : elles y séparent bien mieux les zones, et
       l'interpolation garde le reste de l'Europe. */
    if (!n.officiel) return posees;
    return posees + Atmo.peindre(c, v, l, h, Radar.tuilesVues,
      () => E.revoir());
  };

  /* Le vent, sur sa propre toile posée devant celle de la carte. Il ne
     couvre pas le fond, il n'entre donc pas dans le choix exclusif des
     nappes : il se coche à part et se pose sur ce qui est dessous.

     Sa toile est séparée parce que les deux tracés n'ont pas la même
     cadence. La carte se refait à la demande, les particules trente fois
     par seconde ; les mêler ferait redessiner tout le fond à chaque
     image. */
  const cvVent = bloc.querySelector("#caToileVent");
  const etatVent = () => ({
    vue: E.vue,
    emprise: { S: NappeCarte.S, N: NappeCarte.N, O: NappeCarte.O, E: NappeCarte.E },
    champ: !E.mesures ? null : (la, lo) => {
      /* Sur une heure prévue, le vent de cette heure. */
      const g = E.heurePrevue > 0 && E.prevueVue ? E.prevueVue : E.mesures;
      const vitesse = NappeCarte.valeurA(g.vent, la, lo);
      const direction = NappeCarte.valeurA(g.dir, la, lo);
      return vitesse === null || direction === null ? null : { vitesse, direction };
    },
  });
  E.poserVent = () => {
    if (E.ventAllume && E.mesures) Vent.poser(cvVent, etatVent);
    else Vent.poser(null);
  };

  /* La vigilance. Le vert ne se teinte pas, une vigilance verte n'étant pas
     une vigilance.

     Elle se peint de deux façons. En fond sous la pluie, laquelle est
     tachetée et laisse voir ce qu'il y a dessous. En liseré par-dessus une
     nappe pleine, qui couvrirait un fond teinté : une alerte doit rester
     visible quelle que soit la couche choisie. */
  let vigiNiveaux = null;
  const vigiEnTrait = () => NAPPES_CARTE.some(n => n.cle === E.choisie && (n.champ || n.departements));
  /* Les restrictions d'eau teintent les départements ; la vigilance météo
     passe alors en liseré, comme au-dessus des nappes de valeurs. */
  let eauNiveaux = null;
  /* Les zones d'alerte, jalon 19, lot 6 : à partir du zoom d'un département,
     les zones de VigiEau remplacent les départements. Les tuiles de la vue se
     lisent à la demande ; tant qu'aucune n'est arrivée, les départements
     restent peints. Les zones se peignent de la moins grave à la plus grave,
     sur une toile à part à pleine couleur, posée ensuite d'une seule
     transparence : trois zones superposées, eau de surface, souterraine et
     potable, ne s'assombrissent pas l'une l'autre. */
  const zonesLues = new Map(), zonesEnCours = new Set();
  let toileZones = null;
  E.modeZones = false;
  const peindreZones = (c, v, l, h) => {
    const [zmin, zmax] = ZonesEau.bornesZoom();
    const tz = Math.max(zmin, Math.min(zmax, Math.floor(v.z)));
    const n = 2 ** tz, e = Carte.echelle(v.z);
    const cx = Carte.mx(v.lon), cy = Carte.my(v.lat);
    const x0 = Math.floor((cx - l / 2 / e) * n), x1 = Math.floor((cx + l / 2 / e) * n);
    const y0 = Math.floor((cy - h / 2 / e) * n), y1 = Math.floor((cy + h / 2 / e) * n);
    const zones = [];
    let lues = 0;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const cle = `${tz}/${x}/${y}`;
        if (zonesLues.has(cle)) { lues++; zones.push(...(zonesLues.get(cle) || [])); continue; }
        if (zonesEnCours.has(cle)) continue;
        zonesEnCours.add(cle);
        ZonesEau.zonesTuile(tz, x, y).then(z => {
          zonesEnCours.delete(cle);
          zonesLues.set(cle, z);
          if (cv.isConnected) E.revoir();
        });
      }
    }
    if (!lues) return -1;
    const cs = getComputedStyle(cv);
    const plein = k => (cs.getPropertyValue(`--ca-ve${k}`).trim() || "#999").replace(/rgba\((\d+),\s*(\d+),\s*(\d+),[^)]*\)/, "rgb($1,$2,$3)");
    if (!toileZones) toileZones = document.createElement("canvas");
    const dpr = c.getTransform().a || 1;
    if (toileZones.width !== Math.round(l * dpr) || toileZones.height !== Math.round(h * dpr)) {
      toileZones.width = Math.round(l * dpr); toileZones.height = Math.round(h * dpr);
    }
    const t = toileZones.getContext("2d");
    t.setTransform(dpr, 0, 0, dpr, 0, 0);
    t.clearRect(0, 0, l, h);
    const avecRang = zones.map(z => ({ z, r: VigiEau.rangDe(z.niveau) })).filter(x => x.r > 0).sort((a, b) => a.r - b.r);
    for (const { z, r } of avecRang) {
      t.beginPath();
      for (const a of z.anneaux) {
        a.forEach(([wx, wy], k) => {
          const px = (wx - cx) * e + l / 2, py = (wy - cy) * e + h / 2;
          if (k === 0) t.moveTo(px, py); else t.lineTo(px, py);
        });
        t.closePath();
      }
      t.fillStyle = plein(r);
      t.fill("evenodd");
      t.strokeStyle = "rgba(0,0,0,.18)"; t.lineWidth = 0.6; t.stroke();
    }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 0.55;
    c.drawImage(toileZones, 0, 0);
    c.restore();
    return avecRang.length;
  };
  const coucheEau = (c, v, l, h) => {
    if (E.choisie !== "eau") return 0;
    const zones = v.z >= ZonesEau.ZOOM_ZONES;
    if (zones !== E.modeZones) { E.modeZones = zones; setTimeout(() => E.poserLegende?.(), 0); }
    if (zones) {
      const k = peindreZones(c, v, l, h);
      if (k >= 0) return k;
    }
    if (!eauNiveaux) return 0;
    return Carte.peindreDepartements(cv, c, v, l, h, eauNiveaux, { palette: "ve" });
  };
  const coucheVigiFond = (c, v, l, h) => {
    if (!E.vigiAllume || !vigiNiveaux || vigiEnTrait()) return 0;
    return Carte.peindreDepartements(cv, c, v, l, h, vigiNiveaux);
  };
  const coucheVigiTrait = (c, v, l, h) => {
    if (!E.vigiAllume || !vigiNiveaux || !vigiEnTrait()) return 0;
    return Carte.peindreDepartements(cv, c, v, l, h, vigiNiveaux, { trait: true });
  };

  /* Les nuages, sous la pluie : la pluie tombe de la masse nuageuse et doit
     rester lisible par-dessus elle. La tuile arrive opaque et se rend
     transparente à son arrivée, un ciel dégagé laissant voir la carte. */
  let nuagesDernier = 0;
  const finNuages = () => {
    if (!nuagesDernier) return 0;
    if (E.pluieAllume && E.images.length && E.rang !== Radar.rangCourant(E.images)) {
      return Nuages.pasProche(E.images[E.rang].t, nuagesDernier);
    }
    return nuagesDernier;
  };
  const coucheNuages = (c, v, l, h) => {
    if (!E.nuagesAllume) return 0;
    return Nuages.peindre(c, v, l, h, finNuages(), () => E.revoir());
  };

  /* Les feux, par-dessus tout le reste : quelques points par département,
     qui se perdraient sous une averse. */
  const coucheFeux = (c, v, l, h) => {
    if (!E.feuxAllume) return 0;
    return Feux.peindre(c, v, l, h, Date.now(), () => E.revoir());
  };

  /* La foudre, par-dessus la pluie : clairsemée, elle se lit sur toute
     nappe. La fenêtre finit au dernier pas publié, ou au pas le plus
     proche de l'image de pluie regardée quand la chronologie est
     parcourue : l'orage se lit à l'heure de la pluie qu'on regarde. */
  let foudreDernier = 0;
  const finFoudre = () => {
    if (!foudreDernier) return 0;
    if (E.pluieAllume && E.images.length && E.rang !== Radar.rangCourant(E.images)) {
      return Foudre.pasProche(E.images[E.rang].t, foudreDernier);
    }
    return foudreDernier;
  };
  const coucheFoudre = (c, v, l, h) => {
    if (!E.foudreAllume) return 0;
    return Foudre.peindre(c, v, l, h, finFoudre(), () => E.revoir());
  };

  /* L'ordre de tracé, écrit une fois : la pose du geste et le premier tracé
     prennent la même liste. */
  /* La foudre ne demande pas la gaine des traits : ses tuiles comptent
     comme posées même vides, et un liseré le long des limites ferait lire
     une couche là où il n'y a pas d'orage. */
  const couche = couchePluie(E);
  const COUCHES = [coucheEau, coucheVigiFond, { peindre: coucheValeur, gaine: false },
    { peindre: coucheNuages, gaine: false },
    couche, { peindre: coucheFoudre, gaine: false },
    { peindre: coucheFeux, gaine: false },
    { peindre: coucheVigiTrait, gaine: false }];
  E.COUCHES = COUCHES;

  /* Les grilles de mesures. Une lecture sert les trois nappes de la
     prévision et le vent ; la qualité de l'air a la sienne, sur les mêmes
     points mais sur un autre service. Ni l'une ni l'autre ne part si aucune
     couche qui en vit n'est allumée. */
  const lireMesures = async () => {
    try {
      const d = await NappeCarte.charger();
      if (!cv.isConnected) return;
      if (!d) { E.dire("La nappe a besoin du réseau."); return; }
      E.mesures = d;
      E.dire("");
      E.revoir();
      E.poserVent();
    } catch {
      if (cv.isConnected) E.dire("La nappe a besoin du réseau.");
    }
  };

  /* La grille prévue, trente-six heures, lue à la première nappe qui en vit. */
  let prevueEnCours = null;
  const lirePrevue = () => prevueEnCours || (prevueEnCours = (async () => {
    try {
      E.dire("Lecture de la prévision de la carte…");
      const d = await Prevue.charger();
      if (!cv.isConnected) return;
      if (!d) { E.dire("La nappe a besoin du réseau."); return; }
      E.prevue = d;
      E.dire("");
      if (E.majHeure) E.majHeure();
      else { E.prevueVue = Prevue.vue(d, 0); E.revoir(); }
    } catch {
      if (cv.isConnected) E.dire("La nappe a besoin du réseau.");
    } finally { prevueEnCours = null; }
  })());
  E.lirePrevue = lirePrevue;

  /* Les pollens et la mer, lot 5b : une lecture chacune, comme l'air. */
  const lireGrille = async (charger, cle, vide) => {
    try {
      const d = await charger();
      if (!cv.isConnected) return;
      if (!d) { E.dire("La nappe a besoin du réseau."); return; }
      E[cle] = d;
      E.dire(vide && vide(d) ? vide(d) : "");
      E.revoir();
    } catch {
      if (cv.isConnected) E.dire("La nappe a besoin du réseau.");
    }
  };
  const lirePollens = () => lireGrille(NappeCarte.chargerPollens, "grillePollens",
    d => (d.pollens.some(v => v >= 1) ? "" : "Aucun pollen en saison sur la carte."));
  const lireMer = () => lireGrille(NappeCarte.chargerMer, "grilleMer");

  const lireAir = async () => {
    try {
      const d = await NappeCarte.chargerAir();
      if (!cv.isConnected) return;
      if (!d) { E.dire("La nappe a besoin du réseau."); return; }
      E.mesuresAir = d;
      E.dire("");
      E.revoir();
    } catch {
      if (cv.isConnected) E.dire("La nappe a besoin du réseau.");
    }
  };

  /* Les restrictions d'eau de tout le pays, une lecture de VigiEau. */
  const lireEau = async () => {
    try {
      const t = await VigiEau.departements();
      if (!cv.isConnected) return;
      eauNiveaux = t;
      E.revoir();
    } catch { if (cv.isConnected) E.dire("La nappe a besoin du réseau."); }
  };

  /* Le choix de nappe. Une seule à la fois, ou aucune : ce sont des
     étalements de couleur sur toute la surface. Le choix se garde d'une
     visite à l'autre, et une nappe éteinte ne demande rien à sa source. */
  const rangs = new Map(NAPPES_CARTE.map(n => [n.cle, bloc.querySelector(`#${n.id}`)]));
  const sans = bloc.querySelector("#caSansNappe");

  const poserChoix = c => {
    E.choisie = c;
    Reglages.poserNappe(c);
    for (const [cle, el] of rangs) el.setAttribute("aria-checked", cle === c ? "true" : "false");
    sans.setAttribute("aria-checked", c === null ? "true" : "false");
    E.mention();
    E.poserLegende();
    E.majChronologie?.();
    if (c === "eau") {
      if (eauNiveaux) E.revoir(); else lireEau();
      return;
    }
    const n = NAPPES_CARTE.find(x => x.cle === c && x.champ);
    if (n) {
      /* La grille propre à la nappe, non celle qu'une heure prévue lui
         prête : la température choisie sur une heure prévue doit avoir la
         grille du moment pour quand la piste revient à maintenant. */
      if (n.source ? grilleDe(n) : E.mesures) E.revoir();
      else if (n.source === "air") lireAir();
      else if (n.source === "prevue") lirePrevue();
      else if (n.source === "pollens") lirePollens();
      else if (n.source === "mer") lireMer();
      else lireMesures();
      return;
    }
    E.dire("");
    E.revoir();
  };

  for (const [cle, el] of rangs) el.addEventListener("click", () => poserChoix(cle));
  sans.addEventListener("click", () => poserChoix(null));

  /* L'interrupteur du vent. Éteint au départ : la couche anime une toile en
     permanence, ce qui se paie en batterie. Allumé, il lit la grille si elle
     n'est pas déjà là, celle-là même que la nappe de température emploie. */
  const ventB = bloc.querySelector("#caVent");
  ventB.addEventListener("click", async () => {
    E.ventAllume = !E.ventAllume;
    Reglages.poserVentcarte(E.ventAllume);
    ventB.setAttribute("aria-checked", E.ventAllume ? "true" : "false");
    E.mention();
    E.poserLegende();
    if (E.ventAllume && !E.mesures) await lireMesures();
    E.poserVent();
  });

  /* La vigilance de tout le pays, une lecture de mille deux cents octets. Un
     département au vert ne paraît pas dans la table : la couche ne teinte
     que ce qui est en vigilance. */
  const vigi = bloc.querySelector("#caVigi");
  const lireVigi = async () => {
    try {
      const d = await Vig.pays();
      if (!cv.isConnected) return;
      if (E.vigiMuette !== Vig.paysMuet) { E.vigiMuette = Vig.paysMuet; E.mention(); }
      if (!d) return;
      const t = new Map();
      for (const [code, niveau] of d.niveaux) if (niveau >= 2) t.set(code, niveau);
      vigiNiveaux = t;
      E.revoir();
    } catch { /* la carte se lit sans la vigilance */ }
  };
  vigi.addEventListener("click", () => {
    E.vigiAllume = !E.vigiAllume;
    Reglages.poserVigicarte(E.vigiAllume);
    vigi.setAttribute("aria-checked", E.vigiAllume ? "true" : "false");
    E.mention();
    if (E.vigiAllume && !vigiNiveaux) lireVigi(); else E.revoir();
  });

  /* La foudre. Une lecture de sept kilooctets dit le dernier pas publié ;
     les tuiles suivent au tracé. Sans réseau la carte se lit sans elle. */
  const foudreB = bloc.querySelector("#caFoudre");
  const lireFoudre = async () => {
    try {
      const d = await Foudre.charger();
      if (!cv.isConnected || !d) return;
      foudreDernier = d.dernier;
      E.revoir();
    } catch { /* la carte se lit sans la foudre */ }
  };

  const feuxB = bloc.querySelector("#caFeux");
  feuxB.addEventListener("click", () => {
    E.feuxAllume = !E.feuxAllume;
    Reglages.poserFeuxcarte(E.feuxAllume);
    feuxB.setAttribute("aria-checked", E.feuxAllume ? "true" : "false");
    E.mention();
    E.poserLegende();
    E.revoir();
  });

  const nuagesB = bloc.querySelector("#caNuages");
  const lireNuages = async () => {
    try {
      const d = await Nuages.charger();
      if (!cv.isConnected || !d) return;
      nuagesDernier = d.dernier;
      E.revoir();
    } catch { /* la carte se lit sans les nuages */ }
  };
  nuagesB.addEventListener("click", () => {
    E.nuagesAllume = !E.nuagesAllume;
    Reglages.poserNuagescarte(E.nuagesAllume);
    nuagesB.setAttribute("aria-checked", E.nuagesAllume ? "true" : "false");
    E.mention();
    if (E.nuagesAllume && !nuagesDernier) lireNuages(); else E.revoir();
  });
  foudreB.addEventListener("click", () => {
    E.foudreAllume = !E.foudreAllume;
    Reglages.poserFoudrecarte(E.foudreAllume);
    foudreB.setAttribute("aria-checked", E.foudreAllume ? "true" : "false");
    E.mention();
    E.poserLegende();
    if (E.foudreAllume && !foudreDernier) lireFoudre(); else E.revoir();
  });

  /* Les départs, que la carte lance une fois tous ses modules branchés : les
     restrictions d'eau d'abord, comme avant le découpage, puis le reste. */
  return {
    eau: () => { if (E.choisie === "eau") lireEau(); },
    reste: () => {
      if (E.foudreAllume) lireFoudre();
      if (E.nuagesAllume) lireNuages();
      /* Chaque source ne part que si une couche qui en vit est allumée. La
         grille de la prévision sert trois nappes et le vent, celle de la
         qualité de l'air ne sert qu'elle-même. */
      const auDepart = NAPPES_CARTE.find(n => n.cle === E.choisie && n.champ);
      if ((auDepart && !auDepart.source) || E.ventAllume) lireMesures();
      if (auDepart && auDepart.source === "air") lireAir();
      if (auDepart && auDepart.source === "prevue") lirePrevue();
      if (auDepart && auDepart.source === "pollens") lirePollens();
      if (auDepart && auDepart.source === "mer") lireMer();
      if (E.vigiAllume) lireVigi();
    },
  };
}
