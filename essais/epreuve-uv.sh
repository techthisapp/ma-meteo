#!/bin/bash
# Épreuve des gardes de la rampe de l'indice ultraviolet.
# Usage : essais/epreuve-uv.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
# Chaque épreuve travaille sur sa copie du dépôt et son port : elles tournent
# toutes ensemble en dix minutes, et le dépôt d'origine n'est jamais touché.
COPIE=/tmp/copie-uv-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8240 + N))

case "$N" in
  1) # Revenir à l'échelle chaude, du vert au rouge.
     perl -0pi -e 's/const ARRETS_UV = \[\[1, 252\], \[2\.5, 270\], \[4\.5, 296\], \[6, 318\], \[8, 338\]\];/const ARRETS_UV = [[0, 132], [3, 54], [6, 32], [8, 14], [11, 0]];/' src/icones.js
     ATTENDU="elle va du violet au fuchsia, sans traverser le vert ni le rouge" ;;
  2) # Une saturation constante : la rampe ne monte plus en intensité.
     perl -0pi -e 's/const SATS_UV = \[\[1, 0\.42\], \[2\.5, 0\.56\], \[4\.5, 0\.78\], \[6, 0\.95\], \[8, 1\.0\]\];/const SATS_UV = [[1, 0.62], [8, 0.62]];/' src/icones.js
     ATTENDU="la rampe de l'indice monte en intensité avec la valeur" ;;
  3) # Une clarté constante : seule la moitié du contrat d'intensité tombe.
     perl -0pi -e 's/const CLARTES_UV = \[\[1, 0\.80\], \[2\.5, 0\.70\], \[4\.5, 0\.55\], \[6, 0\.43\], \[8, 0\.34\]\];/const CLARTES_UV = [[1, 0.46], [8, 0.46]];/' src/icones.js
     ATTENDU="la rampe de l'indice monte en intensité avec la valeur" ;;
  4) # Les arrêts de l'échelle entière, où toute la France tient dans le premier.
     perl -0pi -e 's/    arrets: \[0, 2, 4, 6, 8\], unite: "", couleur: couleurUV \},/    arrets: [0, 3, 6, 8, 11], unite: "", couleur: couleurUV },/' src/vues.js
     ATTENDU="la légende porte les arrêts de la plage utile, non ceux de l'échelle entière" ;;
  5) # La nappe reprend une saturation fixe : l'intensité de la carte est perdue.
     perl -0pi -e 's/    champ: "uv", teinte: teinteUV, sat: satUV, clarte: clarteUV,/    champ: "uv", teinte: teinteUV, sat: 0.62, clarte: 0.46,/' src/vues.js
     ATTENDU="la nappe d'indice ultraviolet teinte selon sa propre rampe" ;;
  6) # La nappe peint la rampe de la température au lieu de la sienne.
     perl -0pi -e 's/    champ: "uv", teinte: teinteUV, sat: satUV, clarte: clarteUV,/    champ: "uv", teinte: teinteT, sat: satUV, clarte: clarteUV,/' src/vues.js
     ATTENDU="la nappe d'indice ultraviolet teinte selon sa propre rampe" ;;
  7) # La carte ignore les fonctions et retombe sur ses valeurs par défaut.
     perl -0pi -e 's/  const satDe = typeof sat === "function" \? sat : \(\) => sat;/  const satDe = () => 0.54;/' src/carte.js
     ATTENDU="la nappe d'indice ultraviolet teinte selon sa propre rampe" ;;
  8) # Le premier réglage, publié puis repris : trop plat là où se serre le pays.
     perl -0pi -e 's/const ARRETS_UV = \[\[1, 252\], \[2\.5, 270\], \[4\.5, 296\], \[6, 318\], \[8, 338\]\];/const ARRETS_UV = [[0, 268], [2, 276], [4, 288], [6, 306], [9, 322]];/' src/icones.js
     perl -0pi -e 's/const SATS_UV = \[\[1, 0\.42\], \[2\.5, 0\.56\], \[4\.5, 0\.78\], \[6, 0\.95\], \[8, 1\.0\]\];/const SATS_UV = [[0, 0.38], [2, 0.50], [4, 0.66], [6, 0.84], [9, 0.95]];/' src/icones.js
     perl -0pi -e 's/const CLARTES_UV = \[\[1, 0\.80\], \[2\.5, 0\.70\], \[4\.5, 0\.55\], \[6, 0\.43\], \[8, 0\.34\]\];/const CLARTES_UV = [[0, 0.76], [2, 0.63], [4, 0.53], [6, 0.45], [9, 0.42]];/' src/icones.js
     ATTENDU="elle sépare les valeurs où se serre le pays, de 5 à 6" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$OLD/src/icones.js" src/icones.js >/dev/null \
  && diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/src/carte.js" src/carte.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-uv-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
