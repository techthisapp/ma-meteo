/* La pluie sur la carte et sa chronologie : la lecture de l'index du radar, la
   piste des images et leur lecture animée. Sorti de src/vues/carte.js le
   2 octobre 2026, docs/plan-chantiers-facultatifs.md. Les modules de la carte
   partagent l'objet d'état décrit dans src/vues/carte.js. */

import { heureJour } from "../horloge.js";
import { ico } from "../icones.js";
import * as Radar from "../radar.js";
import * as Reglages from "../reglages.js";
import * as Carte from "../carte.js";
import * as NappeCarte from "../nappe.js";
import * as Prevue from "../prevue.js";
import * as Deplacement from "../deplacement.js";
import { poidsDeplacement } from "../pluieproche.js";
import * as Piaf from "../piaf.js";
import { NAPPES_CARTE } from "./carte-gabarit.js";

/* Douze heures prévues après les images du radar, jalon 19, lot 5c,
   décision de Jérôme du 2 octobre 2026. */
export const HEURES_PREVUES = 12;

/* Les images poussées, version 185, remarque de Jérôme du 9 octobre 2026 :
   après la dernière image du radar, la piste passait aussitôt à la grille
   prévue, des pavés flous d'une maille de soixante kilomètres. Douze images
   au pas de dix minutes, jusqu'à deux heures après la dernière observée,
   montrent cette image poussée du déplacement mesuré, fondue dans la pluie
   prévue comme dans l'encart de l'accueil : pleinement jusqu'à une heure
   d'ici, de moins en moins ensuite. Les heures prévues reprennent après. */
export const POUSSEES = 12;
export const PAS_POUSSE = 10;

/* La pluie prévue, en millimètres par heure, sur une rampe proche de celle
   du radar : bleu pâle, bleu, vert, jaune, rouge, magenta. */
const ARRETS_PLUIE = [[0.1, 200], [1, 215], [3, 120], [6, 55], [12, 15], [25, 320]];
const teintePluie = v => {
  if (!Number.isFinite(v) || v < 0.1) return null;
  if (v >= 25) return 320;
  for (let k = 0; k < ARRETS_PLUIE.length - 1; k++) {
    const [a0, h0] = ARRETS_PLUIE[k], [a1, h1] = ARRETS_PLUIE[k + 1];
    if (v <= a1) return h0 + ((v - a0) / (a1 - a0)) * (h1 - h0);
  }
  return 320;
};

/* La couche de pluie, prise dans l'ordre de tracé de la carte : l'image du
   radar, ou la pluie de la grille prévue sur une heure à venir. */
export const couchePluie = E => (c, v, l, h) => {
  if (!E.pluieAllume) return 0;
  const cadre = E.cadres?.[E.cadre];
  /* La prévision immédiate de Météo-France, version 186, quand une clé est
     saisie : une image par échéance, posée sur la projection de la carte. */
  if (cadre?.piaf) return Piaf.peindre(c, v, l, h, cadre.t, () => E.revoir());
  if (cadre?.pousse && E.mouvement && E.images.length) {
    const w = poidsDeplacement((cadre.t - Date.now()) / 60000);
    let posees = 0;
    if (w < 1 && E.prevueVue) {
      posees += Carte.peindreNappe(c, v, l, h, NappeCarte.couche(E.prevueVue.pluie, teintePluie),
        { opacite: 0.72 * (1 - w), sat: 0.7, clarte: 0.5, libre: true });
    }
    if (w > 0) {
      const tau = (cadre.t - E.mouvement.tImage) / 60000, k = Math.pow(2, v.z - Deplacement.ZOOM);
      const a = c.globalAlpha;
      c.globalAlpha = a * w;
      posees += Radar.peindreDecale(c, v, l, h, E.hote, E.images[cadre.radar].chemin,
        E.mouvement.vx * tau * k, E.mouvement.vy * tau * k, () => E.revoir());
      c.globalAlpha = a;
    }
    return posees;
  }
  if (cadre?.prevue) {
    if (!E.prevueVue) return 0;
    return Carte.peindreNappe(c, v, l, h, NappeCarte.couche(E.prevueVue.pluie, teintePluie),
      { opacite: 0.72, sat: 0.7, clarte: 0.5, libre: true });
  }
  if (!E.images.length) return 0;
  return Radar.peindre(c, v, l, h, E.hote, E.images[E.rang].chemin,
    () => E.revoir());
};

/* ---------- La chronologie ----------

   Deux heures d'images observées au pas de dix minutes, et l'extrapolation
   du service quand il en publie. Elle ne se met pas en marche seule : une
   carte s'ouvre sur ce qu'il pleut maintenant, non sur un film.

   Depuis la version 151, jalon 19, lot 5c, douze heures prévues suivent les
   images du radar : la pluie s'y peint d'après la grille prévue, et les
   nappes qui changent d'heure en heure, température, vent moyen, rafales et
   pression, suivent l'heure choisie. Sans la pluie, la piste paraît quand une
   de ces nappes est choisie, de maintenant à douze heures. La grille prévue
   ne se lit qu'à la première heure prévue atteinte : la piste ne coûte rien
   tant qu'on reste sur le radar.

   La piste porte des cadres : une image du radar, ou une heure prévue. `E.rang`
   reste le rang de l'image du radar, que la foudre et les nuages suivent ; sur
   une heure prévue, il désigne l'image du moment présent. */
export function brancherChronologie(E) {
  const { bloc, cv } = E;
  const rangee = bloc.querySelector("#caTemps");
  const piste = bloc.querySelector("#caPiste");
  const jouer = bloc.querySelector("#caJouer");
  const heure = bloc.querySelector("#caHeure");
  let enLecture = false;

  const nappeHoraire = () => NAPPES_CARTE.some(n => n.cle === E.choisie && n.parHeure);
  E.cadres = []; E.cadre = 0; E.heurePrevue = 0;

  /* Le rang d'une heure prévue dans la grille, une fois la grille lue. */
  const rangPrevue = c => (E.prevue ? Math.max(0, Math.round((c.t / 1000 - E.prevue.t0) / 3600)) : 0);
  E.majHeure = () => {
    const c = E.cadres[E.cadre];
    E.heurePrevue = c?.prevue || c?.pousse || c?.piaf ? rangPrevue(c) : 0;
    if (E.prevue) E.prevueVue = Prevue.vue(E.prevue, E.heurePrevue);
    E.heureCadre = c?.prevue || c?.pousse || c?.piaf ? c.t : null;
    E.poserLegende?.();
    E.revoir();
    E.poserVent?.();
  };

  const poserRang = k => {
    E.cadre = Math.max(0, Math.min(E.cadres.length - 1, k));
    const c = E.cadres[E.cadre];
    if (!c) return;
    E.rang = c.radar !== undefined ? c.radar : (E.images.length ? Radar.rangCourant(E.images) : 0);
    const part = E.cadres.length > 1 ? E.cadre / (E.cadres.length - 1) : 1;
    piste.style.setProperty("--cp", `${(part * 100).toFixed(2)}%`);
    const dit = heureJour(new Date(c.t));
    piste.setAttribute("aria-valuenow", String(E.cadre));
    piste.setAttribute("aria-valuetext", c.futur ? `${dit}, prévu` : dit);
    piste.classList.toggle("ca-piste-futur", c.futur === true);
    heure.textContent = dit;
    heure.classList.toggle("ca-heure-futur", c.futur === true);
    /* Une heure prévue demande la grille prévue, lue une fois. */
    if ((c.prevue || c.pousse) && !E.prevue) E.lirePrevue?.();
    E.majHeure();
  };

  /* Les cadres de la piste : les images du radar quand la pluie est allumée,
     puis douze heures prévues ; sans pluie, maintenant puis douze heures,
     si une nappe horaire est choisie. La piste paraît dès deux cadres. */
  E.majChronologie = () => {
    const radar = E.pluieAllume ? E.images.map((im, k) => ({ t: im.t, futur: im.futur === true, radar: k })) : [];
    /* Avec une clé, les échéances de PIAF au pas de cinq minutes, de la
       dernière image observée à près de trois heures d'ici, version 186.
       Sans clé, les images poussées, quand le service du radar n'extrapole
       pas lui-même et que le déplacement s'est mesuré. */
    if (radar.length && Piaf.actif() && !radar.some(c => c.futur)) {
      const der = radar[radar.length - 1];
      const borne = Date.now() + Piaf.HORIZON * 60000;
      for (let t = der.t + Piaf.PAS * 60000; t <= borne; t += Piaf.PAS * 60000) {
        radar.push({ t, futur: true, radar: der.radar, piaf: true });
      }
    } else if (radar.length && E.mouvement && !radar.some(c => c.futur)) {
      const der = radar[radar.length - 1];
      for (let k = 1; k <= POUSSEES; k++) {
        radar.push({ t: der.t + k * PAS_POUSSE * 60000, futur: true, radar: der.radar, pousse: k });
      }
    }
    const horaire = E.pluieAllume || nappeHoraire();
    const fin = radar.length ? radar[radar.length - 1].t : Date.now();
    const prevues = [];
    if (horaire && (radar.length || !E.pluieAllume)) {
      const h0 = Math.floor(fin / 3600000) * 3600000 + 3600000;
      for (let k = 0; k < HEURES_PREVUES; k++) prevues.push({ t: h0 + k * 3600000, futur: true, prevue: true });
    }
    const avant = E.cadres[E.cadre];
    E.cadres = radar.length ? [...radar, ...prevues]
      : (prevues.length ? [{ t: Date.now(), futur: false }, ...prevues] : []);
    rangee.hidden = E.cadres.length < 2;
    if (rangee.hidden) { arreter(); E.cadre = 0; if (E.heurePrevue) E.majHeure(); else E.heurePrevue = 0; return; }
    piste.setAttribute("aria-valuemax", String(E.cadres.length - 1));
    piste.style.setProperty("--cn", String(E.cadres.length));
    /* Le cadre montré se garde quand les cadres changent, s'il existe encore ;
       sinon la piste revient au moment présent. */
    const garde = avant ? E.cadres.findIndex(c => c.t === avant.t && !!c.prevue === !!avant.prevue) : -1;
    poserRang(garde >= 0 ? garde : (radar.length ? Radar.rangCourant(E.images) : 0));
  };

  /* Le pas de la piste : le rang le plus proche du doigt. La piste est un
     curseur et non treize boutons : treize cibles sur trois cents points
     feraient vingt-deux points chacune, la moitié de ce qu'un doigt vise. */
  const versDoigt = x => {
    const r = piste.getBoundingClientRect();
    if (!r.width || E.cadres.length < 2) return;
    const part = Math.max(0, Math.min(1, (x - r.left) / r.width));
    poserRang(Math.round(part * (E.cadres.length - 1)));
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
    if (d) { arreter(); poserRang(E.cadre + d); ev.preventDefault(); return; }
    if (ev.key === "Home") { arreter(); poserRang(0); ev.preventDefault(); }
    if (ev.key === "End") { arreter(); poserRang(E.cadres.length - 1); ev.preventDefault(); }
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
    while (enLecture && cv.isConnected && E.cadres.length > 1) {
      const k = (E.cadre + 1) % E.cadres.length;
      const c = E.cadres[k];
      const l = cv.clientWidth, h = cv.clientHeight;
      if (c.piaf) await Piaf.preparer(c.t);
      else if (c.radar !== undefined) await Radar.preparer(E.vue, l, h, E.hote, E.images[c.radar].chemin);
      else if (c.prevue && !E.prevue && E.lirePrevue) await E.lirePrevue();
      if (!enLecture || !cv.isConnected) break;
      poserRang(k);
      await new Promise(t => setTimeout(t, k === E.cadres.length - 1 ? 1100 : 420));
    }
    if (!cv.isConnected) enLecture = false;
  }
  jouer.addEventListener("click", () => { if (enLecture) arreter(); else lire(); });

  /* L'index dit où sont les images et à quelle heure elles ont été prises.
     Le service publie parfois aucune image extrapolée : la couche ne
     l'invente pas et s'arrête alors à la dernière image observée. */
  const lireIndex = async () => {
    try {
      const d = await Radar.charger();
      if (!cv.isConnected) return;
      E.hote = d.hote; E.images = d.images;
      if (!E.images.length) { E.dire("Le radar n'a pas d'image."); return; }
      E.dire("");
      /* La chronologie appartient à la pluie et aux nappes horaires : une
         lecture qui arrive après que la couche a été éteinte ne la fait pas
         paraître. */
      E.cadres = [];
      E.majChronologie();
      lireMouvement();
    } catch {
      if (!cv.isConnected) return;
      E.dire("La pluie a besoin du réseau.");
    }
  };

  /* Le déplacement des averses pour la carte, version 185 : au centre de la
     vue, sur les images observées. Rien de plus ne se demande quand il ne se
     mesure pas : la piste garde alors ses heures prévues. */
  E.mouvement = null;
  const lireMouvement = async () => {
    if (!E.pluieAllume || E.mouvement || Piaf.actif() || !E.images.length || E.images.some(x => x.futur)) return;
    try {
      const m = await Deplacement.mouvementVue(E.vue.lat, E.vue.lon, E.hote, E.images.filter(x => !x.futur));
      if (!m || !cv.isConnected) return;
      E.mouvement = m;
      E.majChronologie();
    } catch { /* la piste se lit sans images poussées */ }
  };

  /* La pluie, superposition depuis le 19 septembre 2026. La chronologie la
     suit : elle paraît quand la pluie est allumée et que le service a rendu
     plus d'une image, et s'efface avec elle. */
  const pluieB = bloc.querySelector("#caPluie");
  pluieB.addEventListener("click", () => {
    E.pluieAllume = !E.pluieAllume;
    Reglages.poserPluiecarte(E.pluieAllume);
    pluieB.setAttribute("aria-checked", E.pluieAllume ? "true" : "false");
    E.mention();
    E.poserLegende();
    if (!E.pluieAllume) { arreter(); E.majChronologie(); E.revoir(); return; }
    E.dire("");
    if (E.images.length) { E.majChronologie(); E.revoir(); lireMouvement(); } else lireIndex();
  });

  /* Le départ, que la carte lance une fois tous ses modules branchés. */
  return () => { if (E.pluieAllume) lireIndex(); else E.majChronologie(); };
}
