#!/bin/bash
# Épreuve des gardes du Soleil couché.
# Usage : essais/epreuve-soleil-couche.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-soleil-couche
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/vues.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/vues.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Peindre le disque quelle que soit sa hauteur : le défaut d'origine, vu
     # sur téléphone le 29 août à 22 h 09.
     perl -0pi -e 's/    corps: soleilVu\(p\.hauteur\) \? corpsSoleil\(c\) : "" \}\]\), chaud: c\.chaud \};/    corps: corpsSoleil(c) }]), chaud: c.chaud };/' src/vues.js
     ATTENDU="à moins treize degrés, les deux écrans montrent le même Soleil" ;;
  2) # Éteindre le disque dès l'horizon, sans laisser le crépuscule civil.
     perl -0pi -e 's/export const soleilVu = hauteur => hauteur > SOUS_HORIZON;/export const soleilVu = hauteur => hauteur > 0;/' src/vues.js
     ATTENDU="à moins quatre degrés, les deux écrans montrent le même Soleil" ;;
  3) # Faire tomber le ciel en nuit pleine à la hauteur même où le disque
     # s'éteint : la lueur disparaîtrait alors d'un coup.
     perl -0pi -e 's/  if \(hauteur <= -12\) \{ de = CIELS\.nuit; vers = CIELS\.nuit; t = 0; \}\n  else if \(hauteur < 2\) \{ de = CIELS\.nuit; vers = bord; t = \(hauteur \+ 12\) \/ 14; \}/  if (hauteur <= -6) { de = CIELS.nuit; vers = CIELS.nuit; t = 0; }\n  else if (hauteur < 2) { de = CIELS.nuit; vers = bord; t = (hauteur + 6) \/ 8; }/' src/vues.js
     ATTENDU="le disque éteint, le ciel porte encore la lueur du crépuscule" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 560 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-soleil-couche-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
