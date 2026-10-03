/* Le bouton « i » d'une carte, jalon 20, lot 1, demande de Jérôme du
   3 octobre 2026 : l'explication d'un écran se replie derrière lui, et ne
   garde que ce qui aide à comprendre. Un élément natif, qui s'ouvre et se
   ferme au doigt, au clavier et à VoiceOver sans script. `texte` est du HTML
   déjà échappé. */
export const aide = texte => `<details class="aide"><summary aria-label="Explication">`
  + `<span class="aide-i" aria-hidden="true">i</span></summary><p class="note aide-txt">${texte}</p></details>`;
