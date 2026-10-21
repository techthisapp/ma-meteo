/* La page « Heure par heure ». Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md.

   Reprise en version 232, choix de Jérôme du 21 octobre 2026 sur maquette :
   la porte décide de la vue. Une tuile, la grande température, l'état du
   ciel, un conseil ou une heure de la bande ouvrent la vue ciblée, un seul
   graphique en grand, celui de la grandeur touchée, sa phrase en tête et ses
   heures en liste dessous ; un sélecteur passe d'une grandeur à l'autre.
   « Plus de détails » et une journée d'« À venir » ouvrent la vue d'ensemble,
   la liste des heures avec le ciel, la température, la pluie et le vent. Les
   sept voies empilées et la bascule entre ruban et liste sont retirées. */

import { esc } from "../horloge.js";
import * as P from "../previsions.js";
import { tempsDe, ico } from "../icones.js";
import * as Ruban from "../ruban.js";
import { listeEnsemble, listeGrandeur } from "../ecritures.js";
import { aide } from "../aide.js";

/* Les grandeurs du sélecteur : clé de la voie, titre de la page, nom court
   de la pastille, icône. Elles suivent l'ordre des tuiles des mesures du
   jour de l'accueil depuis la version 238, demande de Jérôme : ressenti,
   pluie, vent, ciel, humidité, indice UV, pression. Sept pastilles, quatre
   puis trois, tiennent sur deux rangées sans défilement de côté. */
export const GRANDEURS = [
  ["t", "Température", "Temp.", "thermo"],
  ["mm", "Pluie", "Pluie", "parapluie"],
  ["v", "Vent", "Vent", "vent"],
  ["nua", "Ciel", "Ciel", "nuage"],
  ["hum", "Humidité", "Humidité", "goutte"],
  ["uv", "Indice UV", "UV", "soleil"],
  ["pres", "Pression", "Pression", "jauge"],
];

export function vueTemps(ctx, rendre) {
  /* Une seule portée pour les deux vues : l'horizon entier, de minuit du jour
     en cours au bout de la charge. La vue ciblée y fait glisser sa fenêtre, la
     liste en lit la même tranche. */
  const s = P.serieHorizon();
  if (!s) {
    return {
      titre: "Heure par heure",
      corps: `<div class="carte"><p class="vide">La prévision heure par heure n'est pas `
        + `disponible pour le moment. Rouvrir dans un instant.</p></div>`,
    };
  }

  const ici = Math.max(0, Math.min(s.n - 1, s.ici));
  const etat = `${Math.round(s.t[ici])}° et ${tempsDe(s.code[ici])[1].toLowerCase()}`;
  const cle = Ruban.voieCourante();
  const gr = GRANDEURS.find(x => x[0] === cle);

  if (!gr) {
    const [a, b] = Ruban.bornesListe(s);
    return {
      titre: "Heure par heure",
      sousEcran: etat,
      corps: `<div class="hh-page" data-vue="ensemble">`
        + `<h1 class="hh-grand">Heure par heure</h1><p class="hh-phrase">${esc(etat)}</p>`
        + `<div class="hh-jours">${Ruban.navJours(s)}</div>`
        + listeEnsemble(s, a, b, Ruban.porteCourante()) + `</div>`,
      brancher(bloc) { Ruban.brancherJours(bloc, rendre); },
    };
  }

  const dessin = Ruban.dessiner(s, { seule: true });
  const lu = Ruban.lectureSeule();
  const [a, b] = Ruban.bornesListe(s);
  const porte = Ruban.porteCourante();
  /* La phrase de la voie, sans la notice de lecture que porte parfois sa
     seconde moitié : la première phrase répond à la question. */
  const phrase = (lu.resume || lu.droite || "").replace(/\s+(L'aire|L'ombre|Sur les|Une baisse)[^]*$/, "");
  const puces = `<div class="hh-puces" role="group" aria-label="Grandeur">` + GRANDEURS.map(([c, , court, ic]) =>
    `<button type="button" class="hh-puce" data-grandeur="${c}" aria-pressed="${c === cle}">`
    + `${ico(ic, "hh-puce-ic")}<span>${esc(court)}</span></button>`).join("") + `</div>`;
  return {
    titre: gr[1],
    sousEcran: etat,
    // Le graphique prend toute la largeur : sa densité fait sa lisibilité.
    large: true,
    corps: `<div class="hh-page" data-vue="ciblee" data-cle="${esc(cle)}">`
      + `<h1 class="hh-grand">${esc(gr[1])}</h1>`
      /* Ouverte par un conseil, la page le redit en tête, version 233. */
      + (porte?.phrase ? `<p class="hh-retenir">${esc(porte.phrase)}</p>` : `<p class="hh-phrase">${esc(phrase)}</p>`)
      + puces + `<div class="hh-jours">${Ruban.navJours(s)}</div>`
      + `<div class="carte hh-graphe">${dessin}`
      + (lu.resume && (lu.resume !== phrase || porte?.phrase) ? `<div class="hh-aide">${aide(lu.resume)}</div>` : "") + `</div>`
      + listeGrandeur(s, cle, a, b, porte) + `</div>`,
    brancher(bloc) {
      for (const p of bloc.querySelectorAll("[data-grandeur]")) {
        p.addEventListener("click", () => {
          Ruban.poserVoie(p.dataset.grandeur); Ruban.poserPorte(null); Ruban.poserHeure(-1); rendre();
        });
      }
      Ruban.brancher(bloc, rendre);
    },
  };
}
