/* La pluie sur la carte et sa chronologie : la lecture de l'index du radar, la
   piste des images et leur lecture animée. Sorti de src/vues/carte.js le
   2 octobre 2026, docs/plan-chantiers-facultatifs.md. Les modules de la carte
   partagent l'objet d'état décrit dans src/vues/carte.js. */

import { heureJour } from "../horloge.js";
import { ico } from "../icones.js";
import * as Radar from "../radar.js";
import * as Reglages from "../reglages.js";

/* La couche de pluie, prise dans l'ordre de tracé de la carte. */
export const couchePluie = E => (c, v, l, h) => {
  if (!E.pluieAllume || !E.images.length) return 0;
  return Radar.peindre(c, v, l, h, E.hote, E.images[E.rang].chemin,
    () => E.revoir());
};

/* ---------- La chronologie ----------

   Deux heures d'images observées au pas de dix minutes, et l'extrapolation
   du service quand il en publie. Elle ne se met pas en marche seule : une
   carte s'ouvre sur ce qu'il pleut maintenant, non sur un film. */
export function brancherChronologie(E) {
  const { bloc, cv } = E;
  const rangee = bloc.querySelector("#caTemps");
  const piste = bloc.querySelector("#caPiste");
  const jouer = bloc.querySelector("#caJouer");
  const heure = bloc.querySelector("#caHeure");
  let enLecture = false;

  const poserRang = k => {
    E.rang = Math.max(0, Math.min(E.images.length - 1, k));
    const im = E.images[E.rang];
    const part = E.images.length > 1 ? E.rang / (E.images.length - 1) : 1;
    piste.style.setProperty("--cp", `${(part * 100).toFixed(2)}%`);
    const dit = heureJour(new Date(im.t));
    piste.setAttribute("aria-valuenow", String(E.rang));
    piste.setAttribute("aria-valuetext", im.futur ? `${dit}, prévu` : dit);
    piste.classList.toggle("ca-piste-futur", im.futur === true);
    heure.textContent = dit;
    heure.classList.toggle("ca-heure-futur", im.futur === true);
    E.revoir();
  };

  /* Le pas de la piste : le rang le plus proche du doigt. La piste est un
     curseur et non treize boutons : treize cibles sur trois cents points
     feraient vingt-deux points chacune, la moitié de ce qu'un doigt vise. */
  const versDoigt = x => {
    const r = piste.getBoundingClientRect();
    if (!r.width || E.images.length < 2) return;
    const part = Math.max(0, Math.min(1, (x - r.left) / r.width));
    poserRang(Math.round(part * (E.images.length - 1)));
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
    if (d) { arreter(); poserRang(E.rang + d); ev.preventDefault(); return; }
    if (ev.key === "Home") { arreter(); poserRang(0); ev.preventDefault(); }
    if (ev.key === "End") { arreter(); poserRang(E.images.length - 1); ev.preventDefault(); }
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
      const k = (E.rang + 1) % E.images.length;
      const l = cv.clientWidth, h = cv.clientHeight;
      await Radar.preparer(E.vue, l, h, E.hote, E.images[k].chemin);
      if (!enLecture || !cv.isConnected) break;
      poserRang(k);
      await new Promise(t => setTimeout(t, k === E.images.length - 1 ? 1100 : 420));
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
      piste.setAttribute("aria-valuemax", String(E.images.length - 1));
      piste.style.setProperty("--cn", String(E.images.length));
      /* La chronologie appartient à la pluie : une lecture qui arrive après
         que la couche a été éteinte ne doit pas la faire paraître. */
      rangee.hidden = !E.pluieAllume || E.images.length < 2;
      poserRang(Radar.rangCourant(E.images));
    } catch {
      if (!cv.isConnected) return;
      E.dire("La pluie a besoin du réseau.");
    }
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
    if (!E.pluieAllume) { arreter(); rangee.hidden = true; E.revoir(); return; }
    E.dire("");
    if (E.images.length) { rangee.hidden = E.images.length < 2; E.revoir(); } else lireIndex();
  });

  /* Le départ, que la carte lance une fois tous ses modules branchés. */
  return () => { if (E.pluieAllume) lireIndex(); };
}
