#!/bin/bash
# Épreuve des gardes de la bande horaire de l'accueil, jalon 10, lot 1.
# Usage : essais/epreuve-bande.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
COPIE=/tmp/copie-bande-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8360 + N))
JUSQUA="La bande horaire"

case "$N" in
  1) # La bande descend sous les chiffres du jour. Une bande posée au-dessus des
     # avis urgents ne se voit que quand un avis paraît, ce que la page des
     # contrôles n'a pas à cet endroit.
     perl -0pi -e 's/      \+ Bande\.bandeHoraire\(s, g\)\n      \+ bloc\("jour", "Aujourd.hui",/      + bloc("jour", "Aujourd\x27hui",/' src/app.js
     perl -0pi -e 's/(    if \(s\) \{\n      corps \+= bloc\("h24")/    corps += Bande.bandeHoraire(s, g);\n$1/' src/app.js
     ATTENDU="la bande horaire se pose sous les avis urgents, avant les chiffres du jour" ;;
  2) # Douze heures seulement.
     perl -0pi -e 's/export const HEURES = 24;/export const HEURES = 12;/' src/bande.js
     ATTENDU="elle compte vingt-quatre heures, qui glissent sous le doigt" ;;
  3) # Le Soleil ne s'intercale plus.
     perl -0pi -e 's/      if \(!t \|\| t\.getTime\(\) < depart\.getTime\(\) \|\| t\.getTime\(\) >= fin\) continue;/      continue;/' src/bande.js
     ATTENDU="le coucher et le lever du Soleil s.intercalent à leur minute" ;;
  4) # La phrase oublie le moment de la pluie.
     perl -0pi -e 's/      : `Pluie \$\{quand\} de /      : `Pluie de /' src/bande.js
     ATTENDU="la phrase dit la pluie avec son moment, et les rafales fortes" ;;
  5) # Le trait des températures ne relie plus rien.
     perl -0pi -e 's/    points\.push\(\[x \+ LARGEUR_HEURE \/ 2, yDe\(s\.t\[k\]\)\]\);\n//' src/bande.js
     ATTENDU="un trait relie les températures des vingt-quatre heures" ;;
  6) # Le symbole de temps s'écrit en toutes lettres, le défaut de la première capture.
     perl -0pi -e 's/      \+ icoTemps\(icoCiel\(s\.code\[k\], s\.clair\[k\] === 1\), "bh-ic", 26\)/      + icoCiel(s.code[k], s.clair[k] === 1)/' src/bande.js
     ATTENDU="chaque heure porte son symbole, son degré, son vent et ses rafales" ;;
  7) # Le ciel de l'accueil reprend sa hauteur d'origine.
     perl -0pi -e 's/\.plein-accueil \.ci\{aspect-ratio:390 \/ 250\}/.plein-accueil .ci{aspect-ratio:390 \/ 306}/' styles.css
     ATTENDU="le ciel de l.accueil est plus bas que celui des autres écrans" ;;
  8) # Les chiffres repassent sur deux colonnes quelle que soit la taille du texte.
     perl -0pi -e 's/\@container \(max-width:18rem\)\{\n  \.bd-mesures\{/\@container (max-width:60rem){\n  .bd-mesures{/' styles.css
     ATTENDU="les quatre chiffres du jour tiennent sur une ligne en taille ordinaire" ;;
  9) # La bande compte de nouveau les heures à fort risque sans quantité, le
     # défaut qui la faisait contredire la suite de la page.
     perl -0pi -e 's/export const pluvieuse = \(s, k\) => \(s\.mm\[k\] \?\? 0\) >= SEUIL_LAME;/export const pluvieuse = (s, k) => (s.mm[k] ?? 0) >= SEUIL_LAME || (s.pb[k] ?? 0) >= 50;/' src/bande.js
     ATTENDU="la bande dit les mêmes heures de pluie que la suite de la page" ;;
  10) # Le risque d'une période devient la moyenne de ses heures.
     perl -0pi -e 's/      pb: max\(k => s\.pb\[k\]\),/      pb: moy(k => s.pb[k]),/' src/ecritures.js
     ATTENDU="le risque d.une période est le plus fort de ses heures" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if diff -q "$OLD/src/bande.js" src/bande.js >/dev/null \
  && diff -q "$OLD/src/app.js" src/app.js >/dev/null \
  && diff -q "$OLD/styles.css" styles.css >/dev/null \
  && diff -q "$OLD/src/ecritures.js" src/ecritures.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-bande-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
