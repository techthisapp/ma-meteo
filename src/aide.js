/* Le bouton « i » d'une carte, jalon 20, lot 1, demande de Jérôme du
   3 octobre 2026 : l'explication d'un écran se replie derrière lui, et ne
   garde que ce qui aide à comprendre. Un élément natif, qui s'ouvre et se
   ferme au doigt, au clavier et à VoiceOver sans script. `texte` est du HTML
   déjà échappé. */
export const aide = texte => `<details class="aide"><summary aria-label="Explication">`
  + `<span class="aide-i" aria-hidden="true">i</span></summary><p class="note aide-txt">${texte}</p></details>`;

/* Le « i » à hauteur du titre, demande de Jérôme du 3 octobre 2026 : posé au
   pied de la carte, il laissait un vide sous le contenu et se cherchait loin
   de ce qu'il explique. Une carte qui porte un titre reçoit son « i » juste
   après lui ; la feuille de style le pose à droite du titre, et l'explication
   ouverte se lit sous le titre. Une carte sans titre le garde au pied. Les
   écrans se bâtissent en chaîne de caractères : le rangement se fait sur la
   page, à chaque ajout, une seule fois par « i ». */
const TITRE = ":scope > .carte-tete, :scope > h3";

export function ranger(racine) {
  if (!racine.querySelectorAll) return;
  /* Un « i » déjà rangé ne se range plus : son déplacement est lui-même un
     ajout, qui relançait le rangement sans fin. */
  const aides = racine.matches?.("details.aide:not([data-range])") ? [racine]
    : racine.querySelectorAll("details.aide:not([data-range])");
  for (const d of aides) {
    d.dataset.range = "1";
    if (d.classList.contains("mg-aide")) continue;
    const carte = d.parentElement?.closest(".carte");
    const titre = carte?.querySelector(TITRE);
    if (!titre || titre.contains(d)) continue;
    titre.after(d);
    carte.classList.add("aide-tete");
  }
}

export function surveillerAides(racine = document.body) {
  ranger(racine);
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) ranger(n); })
    .observe(racine, { subtree: true, childList: true });
}
