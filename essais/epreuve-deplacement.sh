#!/bin/bash
# Épreuve des gardes du sens d'arrivée de la pluie.
# Usage : essais/epreuve-deplacement.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-deplacement
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/deplacement.js src/app.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/deplacement.js" "$SAUVE/src/app.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Prendre la direction où la pluie va pour celle d'où elle vient.
     perl -0pi -e 's/  const provenance = \(\(Math\.atan2\(-dx, dy\) \* 180\) \/ Math\.PI \+ 360\) % 360;/  const provenance = ((Math.atan2(dx, -dy) * 180) \/ Math.PI + 360) % 360;/' src/deplacement.js
     ATTENDU="le panneau dit d'où vient la pluie" ;;
  2) # Mesurer sur le zoom de la carte au lieu du zoom régional.
     perl -0pi -e 's/export const ZOOM = 5;/export const ZOOM = 8;/' src/deplacement.js
     ATTENDU="la mesure lit deux tuiles de zoom cinq et pas davantage" ;;
  3) # Mesurer même quand le panneau n'a rien à dire.
     perl -0pi -e 's/  if \(!pluieProche \|\| !pluieProche\.dispo \|\| !Pluie\.evenement\(pluieProche\)\) return;/  if (!pluieProche || !pluieProche.dispo) return;/' src/app.js
     ATTENDU="sur un temps sec, rien n'est demandé au radar" ;;
  4) # Accepter n'importe quelle corrélation.
     perl -0pi -e 's/export const SCORE_MIN = 0\.35;/export const SCORE_MIN = 0;/' src/deplacement.js
     ATTENDU="la mesure se tait quand elle ne sait pas" ;;
  5) # Ne rien garder d'une lecture à l'autre.
     perl -0pi -e 's/  if \(garde && garde\.cle === cle && t < garde\.exp\) return garde\.d;//' src/deplacement.js
     ATTENDU="une seconde lecture ne redemande pas les tuiles" ;;
  6) # Annoncer une heure d'arrivée, que la mesure ne sait pas donner.
     perl -0pi -e 's/  return `Elle vient \$\{duCardinal\(d\.provenance\)\}, environ \$\{Math\.round\(d\.kmh \/ 5\) \* 5\} km\/h\.`;/  return `Elle vient \$\{duCardinal(d.provenance)\}, ici dans 20 min.`;/' src/deplacement.js
     ATTENDU="le sens d'arrivée ne dit pas d'heure" ;;
  7) # Comparer deux images séparées d'un seul pas, où l'arrondi domine.
     perl -0pi -e 's/export const PAS_ECART = 3;/export const PAS_ECART = 1;/' src/deplacement.js
     ATTENDU="la mesure retrouve le déplacement de la charge" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/deplacement.js" src/deplacement.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 700 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-deplacement-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
