#!/bin/bash
# Épreuve des gardes de la destination Le ciel.
# Usage : essais/epreuve-ciel.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-ciel
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/vues.js src/reglages.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/vues.js" "$SAUVE/src/reglages.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Ne pas marquer l'écran courant dans le sélecteur.
     perl -0pi -e 's/    \+ ` aria-current="\$\{c === quel\}">\$\{esc\(n\)\}<\/button>`\)\.join\(""\) \+ `<\/div>`;/    + `>\${esc(n)}<\/button>`).join("") + `<\/div>`;/' src/vues.js
     ATTENDU="la destination porte deux écrans, un seul courant" ;;
  2) # Poser le sélecteur après le contenu, non en tête.
     perl -0pi -e 's/      \+ `<div class="ecran-corps">\$\{seg\}\$\{f\.dedans\}<\/div>`,/      + `<div class="ecran-corps">\${f.dedans}\${seg}<\/div>`,/' src/vues.js
     ATTENDU="le sélecteur ouvre le contenu, sous le ciel" ;;
  3) # Rendre le sélecteur inerte.
     perl -0pi -e 's/          if \(b\.dataset\.ciel === quel\) return;\n          Reglages\.poserCiel\(b\.dataset\.ciel\);\n          rendre\(\);/          if (b.dataset.ciel === quel) return;/' src/vues.js
     ATTENDU="le sélecteur ouvre l'autre écran" ;;
  4) # Ne pas relire le choix enregistré.
     perl -0pi -e 's/export const ciel = \(\) => \(ECRANS_CIEL\.some\(\(\[c\]\) => c === etat\.ciel\) \? etat\.ciel : "soleil"\);/export const ciel = () => "soleil";/' src/reglages.js
     ATTENDU="le choix se garde d'une visite à l'autre" ;;
  5) # Ne pas garder le choix sur l'appareil.
     perl -0pi -e 's/  if \(!ECRANS_CIEL\.some\(\(\[c\]\) => c === e\)\) return;\n  poser\(\{ ciel: e \}\);/  if (!ECRANS_CIEL.some(([c]) => c === e)) return;/' src/reglages.js
     ATTENDU="et il est gardé sur l'appareil" ;;
  6) # Ouvrir la destination sur la lune.
     perl -0pi -e 's/  ciel: "soleil",      \/\/ écran ouvert dans la destination Le ciel/  ciel: "lune",        \/\/ écran ouvert dans la destination Le ciel/' src/reglages.js
     ATTENDU="sur une installation neuve, le soleil ouvre la destination" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/reglages.js" src/reglages.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 600 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-ciel-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
