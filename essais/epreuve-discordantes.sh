#!/bin/bash
# Épreuve des gardes des charges discordantes.
# Usage : essais/epreuve-discordantes.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-discordantes
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/previsions.js src/app.js src/conseils.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/previsions.js" "$SAUVE/src/app.js" "$SAUVE/src/conseils.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Croire un code de pluie que rien d'autre ne soutient, ni lame ni risque.
     perl -0pi -e 's/  if \(\(mm \?\? 0\) < SEUIL_LAME && \(pb \?\? 0\) < SEUIL_RISQUE\) return codeCiel\(nua\);//' src/previsions.js
     ATTENDU="un code de pluie sans lame ni risque ne s'écrit pas" ;;
  2) # La tuile préfère la lame au risque, même quand il n'y a pas de lame.
     perl -0pi -e 's/      : jh && jh\.mm >= SEUILS\.lame/      : jh \&\& jh.mm >= 0/' src/app.js
     ATTENDU="un risque sans lame se dit en risque et non en pluie" ;;
  3) # La tuile préfère le risque à la lame, même sous trois millimètres.
     perl -0pi -e 's/      : jh && jh\.mm >= SEUILS\.lame/      : false/' src/app.js
     ATTENDU="une lame franche sans risque se dit en millimètres" ;;
  4) # Ne plus passer la reprise quand AROME manque : la source garde ses codes.
     perl -0pi -e 's/  const seule = !b \|\| h === b \|\| !Array\.isArray\(b\.precipitation\);/  if (!b || h === b || !Array.isArray(b.precipitation)) return c;\n  const seule = false;/' src/previsions.js
     ATTENDU="le mot du ciel et les chiffres ne se contredisent pas" ;;
  5) # Réécrire le seuil de lame dans la table au lieu de le reprendre.
     perl -0pi -e 's/  lame: SEUIL_LAME,       /  lame: 0.1,              /' src/conseils.js
     ATTENDU="les seuils que la reprise du ciel partage ne sont écrits qu'une fois" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/previsions.js" src/previsions.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null \
  && diff -q "$SAUVE/src/conseils.js" src/conseils.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-discordantes-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
