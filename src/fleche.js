/* La flèche du vent, partagée par le ruban et la bande horaire. Le module
   s'appelle fleche.js : vent.js porte les particules de vent de la carte, et
   une première version l'avait écrasé sous ce nom.

   Elle montre où va le vent : un vent du nord, direction 0°, pousse vers le
   sud. Le dessin pointe vers le bas au repos ; la rotation vaut donc la
   direction elle-même, un vent d'est, 90°, pointant vers l'ouest.

   Le ruban tournait sa flèche de la direction plus cent quatre-vingts degrés :
   ses flèches montraient d'où venait le vent, à l'inverse de son propre
   commentaire. Relevé le 24 septembre 2026 en reprenant la flèche pour la
   bande, que rien ne vérifiait jusque-là. */

export const angleFleche = d => ((Math.round(d) % 360) + 360) % 360;

export const TRACE_FLECHE = `<path d="M7 1.5v11M3.4 9.2 7 12.9l3.6-3.7" fill="none" `
  + `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

export const flecheSVG = (d, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">`
  + `<g transform="rotate(${angleFleche(d)} 7 7)">${TRACE_FLECHE}</g></svg>`;
