/* Les espaces insécables, audit du 1er octobre 2026, constat 4.12. Sans elles,
   « 17 » et « % », ou « « » et le mot qu'il ouvre, pouvaient se séparer en fin
   de ligne.

   Règles décidées par Jérôme le 2 octobre 2026, selon l'usage français :
   - une espace fine insécable avant « ; », « : », « ! », « ? » et « % », et à
     l'intérieur des guillemets ;
   - une espace insécable ordinaire entre un nombre et son unité.

   Les textes ne sont pas corrigés un à un dans le code : la règle se perdrait
   à la première chaîne nouvelle. Une passe sur les nœuds de texte de la page
   s'applique à tout ce qui y entre, au premier rendu comme aux textes posés
   ensuite, et aux libellés lus par VoiceOver. Elle saute les dessins SVG, dont
   les tracés emploient « h » et « m » comme commandes, et les champs de
   saisie. */

const FINE = " ";
const INSECABLE = " ";
const UNITES = "km\\/h|km|mm|cm|m|hPa|h|min|s|°C|degrés|degré|jours|jour|heures|heure|minutes|minute|"
  + "secondes|kilomètres|millimètres|centimètres|mètres|points|ans|grains";
const NOMBRE_UNITE = new RegExp(`(\\d) (${UNITES})(?![\\p{L}\\d])`, "gu");

/* La règle sur une chaîne : elle est idempotente, et un texte déjà traité ne
   change plus. */
export function insec(t) {
  if (!t || !/[ «»]/.test(t)) return t;
  return t
    .replace(NOMBRE_UNITE, `$1${INSECABLE}$2`)
    .replace(/ ([;:!?%])/g, `${FINE}$1`)
    .replace(/« /g, `«${FINE}`)
    .replace(/ »/g, `${FINE}»`);
}

const EXCLUS = "svg, script, style, textarea, input, code";
const ATTRIBUTS = ["aria-label", "title", "aria-valuetext"];

function traiterTexte(n) {
  if (n.parentElement?.closest(EXCLUS)) return;
  const v = insec(n.nodeValue);
  if (v !== n.nodeValue) n.nodeValue = v;
}
function traiterElement(el) {
  if (el.closest(EXCLUS)) return;
  for (const a of ATTRIBUTS) {
    const v = el.getAttribute(a);
    if (v) { const w = insec(v); if (w !== v) el.setAttribute(a, w); }
  }
}

/* La passe sur un sous-arbre. */
export function typographier(racine) {
  if (racine.nodeType === Node.TEXT_NODE) { traiterTexte(racine); return; }
  if (racine.nodeType !== Node.ELEMENT_NODE) return;
  if (racine.closest(EXCLUS)) return;
  traiterElement(racine);
  const pas = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => (n.nodeType === Node.ELEMENT_NODE && n.matches(EXCLUS)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = pas.nextNode(); n; n = pas.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) traiterTexte(n);
    else traiterElement(n);
  }
}

/* Une seule surveillance de la page : tout nœud ajouté, tout texte changé et
   tout libellé posé passe par la règle. La réécriture d'un texte déclenche
   une mutation de plus, sans effet puisque la règle ne change plus rien. */
export function surveiller(racine = document.body) {
  typographier(racine);
  new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === "characterData") traiterTexte(m.target);
      else if (m.type === "attributes") traiterElement(m.target);
      else for (const n of m.addedNodes) typographier(n);
    }
  }).observe(racine, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ATTRIBUTS });
}
