/* La projection de la carte, sans le fond : la pluie dans l'heure et le sens
   d'arrivée de la pluie s'en servent dès le lancement, alors que la carte et
   ses contours ne se chargent qu'à l'ouverture de son onglet, depuis la
   version 134. Ces lignes viennent de src/carte.js, qui les réexporte. */

/* Les bornes de zoom. Cinq montre le pays entier sur un téléphone, dix montre
   une commune et ses alentours. Au delà, le pas de la grille des contours, cent
   cinquante mètres, se verrait. */
export const ZMIN = 5;
export const ZMAX = 10;
export const ZDEFAUT = 8;

export const TUILE = 256;

/* La projection de Mercator, en coordonnées de monde entre zéro et un. C'est
   celle de toutes les tuiles matricielles, et la couche de pluie, elle, viendra
   bien en tuiles : les deux doivent se superposer sans transformation. */
export const mx = lon => (lon + 180) / 360;
export const my = lat => {
  const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
export const lonDe = x => x * 360 - 180;
export const latDe = y => 90 - (360 * Math.atan(Math.exp((y - 0.5) * 2 * Math.PI))) / Math.PI;

// L'échelle, en pixels par tour de monde.
export const echelle = z => TUILE * Math.pow(2, z);
