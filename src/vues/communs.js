/* Les petites aides partagées par plusieurs écrans. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc } from "../horloge.js";
import * as P from "../previsions.js";
import { ico } from "../icones.js";

/* ---------- Fragments communs ---------- */

export const hm = ms => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/* Les huit points cardinaux vivaient ici et dans `previsions.js`, à l'identique.
   Deux listes pour une même rose finiraient par ne plus dire la même chose. */
export const versCardinal = P.versCardinal;

// L'angle de phase se déduit de la part éclairée, qui vaut (1 + cos i) / 2.
export const anglePhase = eclairee =>
  Math.acos(Math.max(-1, Math.min(1, 2 * eclairee - 1))) / (Math.PI / 180);

/* Une rangée de course du jour, sur l'écran du soleil comme sur celui de la
   lune. La valeur ne porte que l'heure : le point cardinal et la hauteur sont
   des précisions sur l'évènement, elles tiennent sous son nom. Les heures
   s'alignent alors en colonne, ce qu'une valeur composée interdisait. */
export const rangeeAstre = (maintenant, prochain) => ([sym, nom, sous, parts, quand]) => {
  const passe = quand && quand < maintenant;
  const courant = prochain && quand && quand.getTime() === prochain[0].getTime();
  return `<div class="rangee${passe ? " passe" : ""}${courant ? " courant" : ""}">`
    + ico(sym, /^lune/.test(sym) ? "pa-lune" : "pa-soleil")
    + `<span class="rangee-txt"><b>${esc(nom)}</b>`
    + (sous ? `<span>${esc(sous)}</span>` : "") + `</span>`
    + valeur(...parts) + `</div>`;
};

export const rangees = lignes => lignes.map(([n, v]) =>
  `<div class="rangee"><span class="rangee-txt">${esc(n)}</span>`
  + `<span class="rangee-val"><b>${esc(v)}</b></span></div>`).join("");

/* Valeur composée d'une rangée. Chaque partie forte reste insécable, la coupure
   se fait entre les parties : sur un grand corps de texte, « 16:05, sud-est »
   d'un seul tenant débordait de la carte, l'heure ne pouvant pas se couper.
   Une partie passée en objet `{ doux }` est secondaire, et se coupe. */
export const valeur = (...parties) => `<span class="rangee-val">`
  + parties.filter(Boolean).map(p => typeof p === "string"
    ? `<b>${esc(p)}</b>` : `<i>${esc(p.doux)}</i>`).join(" ")
  + `</span>`;

/* Le fond est dessiné, non chargé en tuiles : la mesure et ses raisons sont dans
   `carte.js` et dans `geographie.js`. Cet écran ne fait que poser la toile, les
   repères et les quelques commandes autour.

   Il ne défile pas. La toile occupe tout ce qui reste entre les deux barres, et
   le doigt qui glisse déplace la carte : il n'y a rien d'autre à faire défiler,
   et le geste n'a donc rien à disputer à la page, ce qui est l'inverse du ruban.

   Les repères sont des boutons du document, non des dessins sur la toile : un
   repère se touche, se nomme et s'atteint au clavier, ce qu'un pixel peint ne
   fait pas. Ils sont replacés à chaque image plutôt que redessinés. */
/* Les écouteurs de redimensionnement des écrans redessinés à chaque rendu :
   un par nom, le précédent retiré avant que le suivant se pose. */
const redimensions = new Map();

export function poserRedimension(nom, f) {
  const avant = redimensions.get(nom);
  if (avant) window.removeEventListener("resize", avant);
  redimensions.set(nom, f);
  window.addEventListener("resize", f, { passive: true });
}
