#!/bin/bash
# Épreuve des gardes de la couche de foudre.
# Usage : essais/epreuve-foudre.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
# Chaque épreuve travaille sur sa copie du dépôt et son port : dix épreuves
# tournent alors ensemble en dix minutes, là où la séquence en prenait cent.
# Le dépôt d'origine n'est jamais touché, donc rien à restaurer ni à verrouiller.
COPIE=/tmp/copie-foudre-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8200 + N))

case "$N" in
  1) # Demander l'heure courante arrondie au pas, non le dernier pas publié.
     perl -0pi -e 's/  vu = \{ dernier \};/  vu = { dernier: Math.floor(Date.now() \/ PAS) * PAS };/' src/foudre.js
     ATTENDU="elle demande le dernier pas publié et non l'heure courante" ;;
  2) # Un seul pas au lieu de six.
     perl -0pi -e 's/export const FENETRE = 6;/export const FENETRE = 1;/' src/foudre.js
     ATTENDU="elle pose six pas de cinq minutes, trente minutes de foudre" ;;
  3) # Des tuiles jusqu'au zoom sept, comme le radar.
     perl -0pi -e 's/export const ZMAX_TUILE = 6;/export const ZMAX_TUILE = 7;/' src/foudre.js
     ATTENDU="les tuiles de foudre s'arrêtent au zoom six" ;;
  4) # La couche retirée de l'ordre de tracé.
     perl -0pi -e 's/        couche, \{ peindre: coucheFoudre, gaine: false \},\n/        couche,\n/' src/vues.js
     ATTENDU="le pas le plus récent est peint par-dessus les autres" ;;
  5) # Les pas posés du plus récent au plus ancien : le plus ancien dessus.
     perl -0pi -e 's/  for \(let k = n - 1; k >= 0; k--\) out\.push\(fin - k \* PAS\);/  for (let k = 0; k < n; k++) out.push(fin - k * PAS);/' src/foudre.js
     ATTENDU="le pas le plus récent est peint par-dessus les autres" ;;
  6) # La mention nomme EUMETSAT même couche éteinte.
     perl -0pi -e 's/          \+ \(foudreAllume\n            \? `<span>Foudre /          + (true\n            ? `<span>Foudre /' src/vues.js
     ATTENDU="la foudre éteinte quitte la mention et la légende" ;;
  7) # La lecture part au départ même couche éteinte.
     perl -0pi -e 's/      if \(foudreAllume\) lireFoudre\(\);/      lireFoudre();/' src/vues.js
     ATTENDU="une carte qui s'ouvre la foudre éteinte ne demande rien au service" ;;
  8) # La chronologie n'entraîne pas la foudre.
     perl -0pi -e 's/        if \(allume && images\.length && rang !== Radar\.rangCourant\(images\)\) \{/        if (false) {/' src/vues.js
     ATTENDU="la chronologie de la pluie entraîne la foudre au pas le plus proche" ;;
  9) # Les capacités du service entier, deux cent quatre-vingts kilooctets.
     perl -0pi -e 's/export const CAPACITES = "https:\/\/view\.eumetsat\.int\/geoserver\/mtg_fd\/li_afa\/ows"/export const CAPACITES = "https:\/\/view.eumetsat.int\/geoserver\/ows"/' src/foudre.js
     ATTENDU="elle lit les capacités de la couche seule, non celles du service entier" ;;
  10) # La tuile se dit allumée quel que soit le réglage.
     perl -0pi -e 's/aria-checked="\$\{Reglages\.foudrecarte\(\) \? "true" : "false"\}"/aria-checked="true"/' src/vues.js
     ATTENDU="et son réglage est retenu d'une ouverture à l'autre" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/src/foudre.js" src/foudre.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-foudre-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
