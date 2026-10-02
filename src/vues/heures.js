/* La page « Heure par heure ». Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc } from "../horloge.js";
import * as P from "../previsions.js";
import { tempsDe } from "../icones.js";
import * as Ruban from "../ruban.js";
import { liste, moments } from "../ecritures.js";
import * as Reglages from "../reglages.js";

/* ---------- L'écran du temps ---------- */

export function vueTemps(ctx, rendre) {
  const g = Reglages.lire();
  /* Deux portées pour deux écritures. La table lit les vingt-quatre heures à
     venir, qui sont ce qu'on lui demande. Le ruban lit l'horizon entier, de
     minuit du jour en cours au bout de la charge, et sa fenêtre glisse dessus. */
  const s = g.ecriture === "liste" ? P.serieHoraire() : P.serieHorizon();
  if (!s) {
    return {
      titre: "Heure par heure",
      corps: `<div class="carte"><p class="vide">La prévision heure par heure n'est pas `
        + `disponible pour le moment. Rouvrir dans un instant.</p></div>`,
    };
  }

  const e = g.ecriture;
  const ici = Math.max(0, Math.min(s.n - 1, s.ici));
  const corps = e === "liste" ? liste(s) : Ruban.dessiner(s);
  /* Le sélecteur se tient sur la ligne du titre, en petit : le ruban et la
     table commencent ainsi en haut de la page. */
  const seg = `<div class="seg seg-menu">` + Reglages.ECRITURES.map(([c, n]) =>
    `<button type="button" data-ecriture="${c}"${c === e ? ' class="actif"' : ""}>${esc(n)}</button>`)
    .join("") + `</div>`;

  /* Ce qui mérite d'être retenu se lit sur l'accueil, sous « À retenir », et
     les moments s'y lisent aussi, en bas de page. Les répéter ici redisait les
     mêmes phrases un écran plus loin, à l'endroit où l'on vient justement
     chercher le détail heure par heure. */
  return {
    titre: "Heure par heure",
    // Le ruban prend toute la largeur : c'est un graphique, sa densité fait sa
    // lisibilité. La table, elle, reste dans la largeur de lecture.
    large: e === "ruban",
    /* Le degré s'écrit sans décimale, ici comme partout : « 9,4° » sous un
       bandeau qui dit « 9° » ferait deux chiffres pour une même mesure. Le
       bandeau dit l'heure en cours, laquelle n'ouvre pas la série du ruban. */
    sousEcran: `${Math.round(s.t[ici])}° et ${tempsDe(s.code[ici])[1].toLowerCase()}`,
    cote: seg,
    corps: `<div class="carte">${corps}</div>`,
    brancher(bloc) {
      for (const b of bloc.querySelectorAll("[data-ecriture]")) {
        b.addEventListener("click", () => { Reglages.poserEcriture(b.dataset.ecriture); rendre(); });
      }
      if (e === "ruban") Ruban.brancher(bloc, rendre);
    },
  };
}
