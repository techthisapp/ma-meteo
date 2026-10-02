/* La mention des sources et les légendes de la carte. Sorti de
   src/vues/carte.js le 2 octobre 2026, docs/plan-chantiers-facultatifs.md. Les
   modules de la carte partagent l'objet d'état décrit dans src/vues/carte.js. */

import { esc } from "../horloge.js";
import { ECHELLES } from "../ruban.js";
import * as Vent from "../vent.js";
import * as NappeCarte from "../nappe.js";
import { NAPPES_CARTE } from "./carte-gabarit.js";

export function brancherLegende(E) {
  const { bloc, cv } = E;
  const credit = bloc.querySelector("#caCredit");

  /* Le résumé lu de la carte : la nappe choisie et sa valeur au lieu courant,
     puis les couches allumées par-dessus. Il se refait avec la mention, à
     chaque interrupteur, et à l'arrivée des grilles. Audit, constat 4.9. */
  const resume = bloc.querySelector("#caResume");
  E.resumer = () => {
    if (!resume) return;
    const n = NAPPES_CARTE.find(x => x.cle === E.choisie);
    let nappe = "Aucune nappe.";
    if (n) {
      const grille = n.champ ? (n.source === "air" ? E.mesuresAir : E.mesures) : null;
      const v = grille && E.g ? NappeCarte.valeurA(grille[n.champ], E.g.lat, E.g.lon) : null;
      nappe = `Nappe ${n.nom.toLowerCase()}, ${n.porte}`
        + (Number.isFinite(v) ? `, ${Math.round(v)}${n.unite === "°" ? " degrés" : ""} au lieu courant.` : ".");
    }
    const dessus = [E.pluieAllume && "pluie", E.ventAllume && "vent", E.vigiAllume && "vigilance",
      E.foudreAllume && "foudre", E.nuagesAllume && "nuages", E.feuxAllume && "feux",
      E.previAllume && "prévisions des villes", E.plagesAllume && "plages", E.neigeAllume && "neige",
      E.rivAllume && "cours d'eau"].filter(Boolean);
    const dit = `${nappe} ${dessus.length ? `Par-dessus : ${dessus.join(", ")}.` : "Aucune couche par-dessus."}`;
    /* Un même texte n'est pas réécrit : la région se refait à chaque tuile
       posée, et VoiceOver redirait la même phrase. */
    if (resume.textContent !== dit) resume.textContent = dit;
  };

  /* La mention des sources. Deux lignes plutôt qu'une : sur trois cent
     quatre-vingt-dix points, les deux mentions bout à bout débordent la
     largeur et passent sous les commandes. */
  E.mention = () => {
    credit.innerHTML = (E.pluieAllume
      ? `<span>Pluie <a href="https://www.rainviewer.com" target="_blank" `
        + `rel="noopener noreferrer">RainViewer</a></span>`
      : "")
      + (() => {
        /* Deux couches de la même source ne la nomment qu'une fois. La
           nappe qui porte son propre crédit vient d'ailleurs et se nomme à
           part : la fondre avec le vent dirait une source pour l'autre. */
        const n = NAPPES_CARTE.find(x => x.cle === E.choisie && x.champ);
        const nOM = n && !n.credit ? n : null;
        const noms = [nOM && nOM.nom, E.ventAllume ? "vent" : null].filter(Boolean);
        const propre = n && n.credit ? `<span>${n.credit}</span>` : "";
        if (!noms.length) return propre;
        const brut = noms.length === 2 ? `${noms[0]} et ${noms[1]}` : noms[0];
        const dit = brut.charAt(0).toUpperCase() + brut.slice(1);
        return `<span>${dit} <a href="https://open-meteo.com" target="_blank" `
          + `rel="noopener noreferrer">Open-Meteo</a></span>` + propre;
      })()
      + (E.vigiAllume ? `<span>Vigilance Météo-France</span>` : "")
      + (E.previAllume || E.plagesAllume || E.neigeAllume ? `<span>${[E.previAllume && "Prévisions", E.plagesAllume && "mer",
        E.neigeAllume && "neige"].filter(Boolean).join(", ").replace(/^./, c => c.toUpperCase())} Open-Meteo</span>` : "")
      + (E.neigeAllume ? `<span>Stations OpenSkiMap, © contributeurs OpenStreetMap</span>` : "")
      + (E.rivAllume ? `<span>Cours d'eau Hub'eau</span>` : "")
      + (E.choisie === "eau" ? `<span>Restrictions <a href="https://vigieau.gouv.fr" target="_blank" `
        + `rel="noopener noreferrer">VigiEau</a></span>` : "")
      + (E.foudreAllume || E.nuagesAllume
        ? `<span>${E.foudreAllume && E.nuagesAllume ? "Foudre et nuages"
          : E.foudreAllume ? "Foudre" : "Nuages"} `
          + `<a href="https://www.eumetsat.int" target="_blank" `
          + `rel="noopener noreferrer">EUMETSAT</a></span>`
        : "")
      + (E.feuxAllume
        ? `<span>Feux <a href="https://effis.jrc.ec.europa.eu" target="_blank" `
          + `rel="noopener noreferrer">Copernicus</a></span>`
        : "")
      + `<span>Contours IGN et Natural Earth</span>`;
    E.resumer();
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
  E.poserLegende = () => {
    const n = NAPPES_CARTE.find(x => x.cle === E.choisie && (x.champ || x.departements));
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
    legFeux.hidden = !E.feuxAllume;
    legFoudre.hidden = !E.foudreAllume;
    legVent.hidden = !E.ventAllume;
    if (legVent.hidden) return;
    const rep = ECHELLES.v.filter(([v]) => v === 12 || v === 30 || v === 50);
    legVent.innerHTML = rep.map(([v, nom]) =>
      `<span class="ca-lv-r"><i style="width:${Vent.longueurTrace(v).toFixed(1)}px"></i>`
      + `${esc(nom.toLowerCase())}</span>`).join("");
    legVent.setAttribute("aria-label",
      `Vent moyen : ${rep.map(([v, nom]) => `${nom.toLowerCase()} ${v} kilomètres par heure`).join(", ")}`);
  };
}
