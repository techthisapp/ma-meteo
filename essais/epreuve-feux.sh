#!/bin/bash
# Épreuve des gardes de la couche des feux.
# Usage : essais/epreuve-feux.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
# Chaque épreuve travaille sur sa copie du dépôt et son port ; l'arrêt anticipé
# borne la passe à la section visée.
COPIE=/tmp/copie-feux-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8320 + N))
JUSQUA="Les nappes de la carte"

case "$N" in
  1) # Un seul jour au lieu de deux : la moitié des foyers manque.
     perl -0pi -e 's/export const FENETRE = 2;/export const FENETRE = 1;/' src/feux.js
     ATTENDU="la couche demande deux jours, le jour même et la veille" ;;
  2) # La date disparaît de la requête : le service rend l'année 2020 et une
     # image vide, le piège de cette source.
     perl -0pi -e 's/&time=\$\{jour\}`;/`;/' src/feux.js
     ATTENDU="chaque tuile porte sa date" ;;
  3) # La couche est retirée de l'ordre de tracé.
     perl -0pi -e 's/        \{ peindre: coucheFeux, gaine: false \},\n//' src/vues.js
     ATTENDU="les foyers se posent sur la carte" ;;
  4) # La légende promet des incendies là où le satellite ne voit qu'un point chaud.
     perl -0pi -e 's/Foyers vus par satellite, 48 h/Incendies en cours, 48 h/' src/vues.js
     ATTENDU="la légende dit des foyers vus par satellite, non des incendies" ;;
  5) # La mention oublie la source.
     perl -0pi -e 's/          \+ \(feuxAllume/          + (false/' src/vues.js
     ATTENDU="la mention nomme Copernicus tant que les feux sont allumés" ;;
  6) # La tuile se dit allumée quel que soit le réglage.
     perl -0pi -e 's/export const feuxcarte = \(\) => etat\.feuxcarte === true;/export const feuxcarte = () => true;/' src/reglages.js
     ATTENDU="une carte qui s'ouvre les feux éteints ne demande rien au service" ;;
  7) # La mention revient au gris clair, illisible sur une couche colorée.
     perl -0pi -e 's/  font-size:var\(--texte-note\);color:var\(--etiquette-2\);text-align:right;/  font-size:var(--texte-note);color:var(--etiquette-3);text-align:right;/' styles.css
     ATTENDU="la mention se lit assez pour être une attribution" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if diff -q "$OLD/src/feux.js" src/feux.js >/dev/null \
  && diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/styles.css" styles.css >/dev/null \
  && diff -q "$OLD/src/reglages.js" src/reglages.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-feux-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
