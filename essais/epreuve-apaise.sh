#!/bin/bash
# Épreuve des gardes du temps sensible apaisé.
# Usage : essais/epreuve-apaise.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-apaise
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/previsions.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/previsions.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Croire le seul modèle qui parle, ce qui est le défaut d'origine.
     perl -0pi -e 's/export function apaiser\(code, mm, mmAutre, nua\) \{/export function apaiser(code, mm, mmAutre, nua) {\n  return code;/' src/previsions.js
     ATTENDU="une bruine que le modèle global ne voit pas ne s'écrit pas" ;;
  2) # Ne pas passer la règle sur la charge, la fonction restant juste.
     perl -0pi -e 's/        apaiserCharge\(charge\);//' src/previsions.js
     ATTENDU="une bruine que le modèle global ne voit pas ne s'écrit pas" ;;
  3) # Effacer aussi la lame d'eau en même temps que le code.
     perl -0pi -e 's/    return apaiser\(code, h\.precipitation \? h\.precipitation\[i\] : 0, autre,\n      h\.cloud_cover \? h\.cloud_cover\[i\] : null\);/    const r = apaiser(code, h.precipitation ? h.precipitation[i] : 0, autre,\n      h.cloud_cover ? h.cloud_cover[i] : null);\n    if (r !== code && h.precipitation) h.precipitation[i] = 0;\n    return r;/' src/previsions.js
     ATTENDU="la lame d'eau n'est pas touchée par la règle" ;;
  4) # Apaiser sans regarder le seuil de gêne : une pluie franche s'efface.
     perl -0pi -e 's/  if \(\(mm \?\? 0\) >= SEUIL_DIT\) return code;//' src/previsions.js
     ATTENDU="une pluie franche d'un seul modèle reste écrite" ;;
  5) # Apaiser la neige et l'orage, qui changent la nature de la journée.
     perl -0pi -e 's/const CODES_APAISABLES = new Set\(\[51, 53, 55, 56, 57, 61, 80\]\);/const CODES_APAISABLES = new Set([51, 53, 55, 56, 57, 61, 80, 71, 73, 75, 95, 96, 99]);/' src/previsions.js
     ATTENDU="la règle se lit sur ses quatre cas" ;;
  6) # Apaiser même sans seconde voix, au delà de la portée d'AROME.
     perl -0pi -e 's/  if \(mmAutre === null \|\| mmAutre === undefined\) return code;//' src/previsions.js
     ATTENDU="la règle se lit sur ses quatre cas" ;;
  7) # Servir une charge écrite avant la règle.
     perl -0pi -e 's/\$\{COLONNES\}c\|apaise1`;/\$\{COLONNES\}c`;/' src/previsions.js
     ATTENDU="la signature des colonnes entre dans la clé du cache" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/previsions.js" src/previsions.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 700 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-apaise-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
