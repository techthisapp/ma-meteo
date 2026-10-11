/* La feuille des risques de la commune, version 191 : ce que Géorisques
   recense, les catastrophes naturelles reconnues, et le sol, séisme,
   argiles et radon. Rien ne remonte à l'accueil, ces risques ne changeant
   pas d'un jour à l'autre ; une porte y mène. */

import { esc } from "../horloge.js";
import * as Risques from "../risques.js";
import { aide } from "./communs.js";

const date = j => new Date(`${j}T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

export function vueRisques(ctx, rendre) {
  const titre = "Les risques", sous = ctx?.commune || "";
  const d = Risques.garde(ctx);
  if (!d) {
    Risques.charger(ctx).then(x => { if (x) rendre(); }).catch(() => {});
    return { titre, sous, corps: `<div class="carte"><p class="note">Lecture des risques…</p></div>` };
  }
  const familles = d.risques && d.risques.length
    ? `<ul class="rq-liste">${d.risques.map(f => `<li><b>${esc(f.nom)}</b>`
      + (f.details.length ? `<span>${esc(f.details.join(" ; "))}</span>` : "") + `</li>`).join("")}</ul>`
    : `<p class="note">Aucun risque recensé pour la commune.</p>`;
  const c = d.catnat;
  const catnat = !c ? `<p class="note">Les arrêtés n'ont pas pu être lus.</p>`
    : !c.n ? `<p>Aucun arrêté de catastrophe naturelle depuis 1982.</p>`
    : `<p>${c.n} arrêté${c.n > 1 ? "s" : ""} de catastrophe naturelle depuis 1982 : `
      + `${esc(Object.entries(c.parType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t.toLowerCase()}, ${n}`).join(" ; "))}.</p>`
      + `<dl class="ng-val">${c.derniers.map(x => `<dt>${esc(date(x.debut))}</dt><dd>${esc(x.type)}</dd>`).join("")}</dl>`;
  const sol = `<dl class="ng-val">`
    + `<dt>Séisme</dt><dd>${d.seisme ? `zone ${d.seisme} sur 5, ${esc(Risques.SEISMES[d.seisme - 1])}` : "—"}</dd>`
    + `<dt>Retrait-gonflement des argiles</dt><dd>${d.argiles !== null ? `exposition ${esc(Risques.ARGILES[d.argiles])}` : "hors des zones cartographiées"}</dd>`
    + `<dt>Radon</dt><dd>${d.radon ? `potentiel ${esc(Risques.RADON[d.radon - 1])}, ${d.radon} sur 3` : "—"}</dd></dl>`;
  return { titre, sous, corps:
    `<div class="carte"><h3>Risques recensés</h3>${familles}</div>`
    + `<div class="carte"><h3>Catastrophes naturelles</h3>${catnat}</div>`
    + `<div class="carte"><h3>Le sol</h3>${sol}`
    + aide("Le retrait-gonflement des argiles fissure les maisons après les sécheresses ; le radon, gaz naturel du sous-sol, "
      + "s'accumule dans les pièces mal aérées.") + `</div>`
    + `<a class="pl-fiche" href="https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi" `
    + `target="_blank" rel="noopener">Le rapport complet, sur Géorisques</a>` };
}
