/* La feuille de la vigilance. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc, heureJour } from "../horloge.js";
import { ico } from "../icones.js";
import * as Reglages from "../reglages.js";
import * as Vig from "../vigilance.js";
import { aide } from "./communs.js";

/* ---------- Vigilance ----------

   Le détail du bulletin en vigueur, ouvert depuis le panneau de l'accueil. Le
   bulletin est celui que `vigilance.js` a lu, porté par le contexte : la
   feuille et le panneau disent la même chose, à deux niveaux de détail.

   Les conséquences possibles et les conseils de comportement restent sur
   Météo-France, qui fait foi. Les recopier ici les figerait. */

export function vueVigilance(ctx) {
  const g = Reglages.lire();
  const dep = Reglages.departementDu(g);
  const v = ctx && ctx.vigilance;
  const lien = Vig.lienDe(dep);
  const externe = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" `
    + `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`
    + `</svg>`;
  const bouton = `<a class="lien-plein" href="${lien}" target="_blank" rel="noopener noreferrer">`
    + `<span>Ouvrir la vigilance${Vig.nomDe(dep) ? ` de ${esc(Vig.nomDe(dep))}` : ""} sur Météo-France</span>`
    + `${externe}</a>`;

  /* Sans vigilance en vigueur ni annonce, la feuille reste atteignable par
     l'historique : elle le dit alors, plutôt que de montrer un cadre vide. */
  if (!v) {
    return {
      titre: "Vigilance",
      corps: `<div class="carte">`
        + `<p class="prose">Aucune vigilance en vigueur`
        + (Vig.nomDe(dep) ? ` sur ${esc(Vig.nomDe(dep))}` : "")
        + `. Le bulletin de Météo-France fait foi et se `
        + `consulte à tout moment.</p>${bouton}</div>`,
    };
  }

  /* La feuille suit le panneau : la couleur et la conduite viennent de ce qui
     est en vigueur, et de l'annonce quand rien ne l'est. */
  const enCours = v.niveau !== undefined;
  const n = Vig.NIVEAUX[enCours ? v.niveau : v.niveauLendemain];
  const rangee = (a, quand) => {
    const na = Vig.NIVEAUX[a.niveau];
    return `<div class="rangee vg-r n-${a.niveau}">${ico(a.symbole, "")}`
      + `<span class="rangee-txt"><b>${esc(a.nom)}</b>`
      + `<span>${esc(quand)}</span></span>`
      + `<span class="rangee-val"><b>${esc(na.nom)}</b></span></div>`;
  };
  const lignes = v.alertes.map(a =>
    rangee(a, `${heureJour(a.debut)} à ${heureJour(a.fin)}`)).join("");
  const lignesDemain = v.annonces.map(a => rangee(a, "Demain")).join("");

  /* La borne écrite sous la conduite est la fin du phénomène qui va le plus
     loin. « Bulletin valable jusqu'à » est de l'administration, et la carte dit
     une vigilance : la borne ne peut porter que sur elle. */
  const bout = enCours
    ? new Date(Math.max(...v.alertes.map(a => a.fin.getTime()))) : null;

  return {
    titre: "Vigilance",
    sous: `${n.nom.charAt(0).toUpperCase()}${n.nom.slice(1)}`
      + `${enCours ? "" : " demain"} sur ${v.nom || `le département ${dep}`}`,
    corps: `<div class="carte vg-f vg-${esc(n.nom)}">`
      + `<div class="vg-tete">${ico("alerte", "vg-ic")}`
      + `<span class="vg-txt"><b>${esc(n.conduite)}</b>`
      + (bout ? `<em>Jusqu'à ${esc(heureJour(bout))}</em>` : "")
      + `</span></div>${bouton}</div>`

      + (lignes ? `<div class="section"><h2>Phénomènes signalés</h2>`
        + `<div class="carte groupe-plat">${lignes}</div></div>` : "")

      + (lignesDemain ? `<div class="section"><h2>Annoncé pour demain</h2>`
        + `<div class="carte groupe-plat">${lignesDemain}</div></div>` : "")

      /* La source passe dans les réglages, jalon 20 ; restent l'heure de la
         dernière révision et le renvoi vers Météo-France, derrière le « i ». */
      + aide(`${v.maj ? `Bulletin révisé à ${esc(heureJour(v.maj))}. ` : ""}`
        + "Le détail, les conséquences et les conseils se lisent sur Météo-France, qui fait foi."),
  };
}
