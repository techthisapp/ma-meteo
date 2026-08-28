#!/bin/bash
# Épreuve des gardes de la sous-ligne des deux écrans jumeaux, Le soleil et
# La lune. Usage : essais/epreuve-jumeaux.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-jumeaux
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/vues.js src/feu.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() {
  cp "$SAUVE/src/vues.js" "$SAUVE/src/feu.js" src/
  cp "$SAUVE/styles.css" styles.css
}
trap restaurer EXIT

case "$N" in
  1) # Rendre au Soleil sa sous-ligne sans vignette.
     perl -0pi -e 's/      \+ `<em><canvas class="pt-astre" id="ptSoleil" `\n      \+ `data-chaud="\$\{bdCiel\.chaud\.toFixed\(3\)\}" aria-hidden="true"><\/canvas>`\n/      + `<em>`\n/' src/vues.js
     ATTENDU="le Soleil porte sa vignette devant son état" ;;
  2) # Poser la vignette sans jamais la peindre.
     perl -0pi -e 's/      Feu\.vignette\(bloc\.querySelector\("#ptSoleil"\),\n        Number\(bloc\.querySelector\("#ptSoleil"\)\?\.dataset\.chaud\)\);\n//' src/vues.js
     ATTENDU="elle est peinte, opaque et chaude" ;;
  3) # Donner à chaque écran sa propre taille de vignette.
     printf '\n#ptSoleil{width:30px;height:30px}\n' >> styles.css
     ATTENDU="les deux écrans jumeaux alignent leur sous-ligne au même endroit" ;;
  4) # Peindre la vignette froide, teinte figée hors de la règle du ciel.
     perl -0pi -e 's/  corps\(x, cote \/ 2, cote \* 0\.47, motifs\(teinte\), 6\.2, FORCE\);/  x.fillStyle = "#20304a"; x.beginPath();\n  x.arc(cote \/ 2, cote \/ 2, cote * 0.47, 0, Math.PI * 2); x.fill();/' src/feu.js
     ATTENDU="elle est peinte, opaque et chaude" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/feu.js" src/feu.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 440 node essais/controle.mjs 2>&1)
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
