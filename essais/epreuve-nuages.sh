#!/bin/bash
# Épreuve des gardes de la couche de nuages.
# Usage : essais/epreuve-nuages.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
# Chaque épreuve travaille sur sa copie du dépôt et son port : le dépôt
# d'origine n'est jamais touché, et une épreuve interrompue ne laisse rien.
COPIE=/tmp/copie-nuages-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8280 + N))

case "$N" in
  1) # La tuile est posée telle qu'elle arrive, donc opaque : la carte disparaît.
     perl -0pi -e "s/      transparence\(d\.data\);\n//" src/nuages.js
     ATTENDU="la carte laisse voir son fond là où le ciel est dégagé" ;;
  2) # La transparence s'inverse : le ciel reste, le nuage s'efface.
     perl -0pi -e "s/    let a = \(lum - seuil\) \/ plage;/    let a = (plage - (lum - seuil)) \/ plage;/" src/nuages.js
     ATTENDU="le ciel dégagé s'efface et le nuage reste" ;;
  3) # L'heure courante remplace le dernier pas publié.
     perl -0pi -e "s/  vu = \{ dernier \};/  vu = { dernier: Math.round(Date.now() \/ PAS) * PAS };/" src/nuages.js
     ATTENDU="la couche demande le dernier pas publié, au pas de dix minutes" ;;
  4) # Les capacités du service entier, deux cent quatre-vingts kilooctets.
     perl -0pi -e "s#export const CAPACITES = \"https://view\.eumetsat\.int/geoserver/mtg_fd/ir105_hrfi/ows\"#export const CAPACITES = \"https://view.eumetsat.int/geoserver/ows\"#" src/nuages.js
     ATTENDU="elle lit les capacités de la couche seule" ;;
  5) # Les nuages passent par-dessus la pluie au lieu de se poser dessous.
     perl -0pi -e "s/        \{ peindre: coucheNuages, gaine: false \},\n        couche, \{ peindre: coucheFoudre, gaine: false \},/        couche, { peindre: coucheNuages, gaine: false },\n        { peindre: coucheFoudre, gaine: false },/" src/vues.js
     ATTENDU="les nuages se posent sous la pluie, non par-dessus" ;;
  6) # La mention ne nomme que la foudre, les nuages étant passés sous silence.
     # Ôter le seul « || nuagesAllume » ne se verrait pas : la foudre étant
     # allumée au départ, la phrase resterait « Foudre et nuages ».
     perl -0pi -e "s/            \? \`<span>\\\${foudreAllume && nuagesAllume \? \"Foudre et nuages\"\n              : foudreAllume \? \"Foudre\" : \"Nuages\"\} \`/            ? \`<span>Foudre \`/" src/vues.js
     ATTENDU="la mention nomme EUMETSAT tant que les nuages sont allumés" ;;
  7) # La lecture part au départ même couche éteinte.
     perl -0pi -e "s/      if \(nuagesAllume\) lireNuages\(\);/      lireNuages();/" src/vues.js
     ATTENDU="une carte qui s'ouvre les nuages éteints ne demande rien au service" ;;
  8) # La tuile se dit allumée quel que soit le réglage.
     perl -0pi -e "s/export const nuagescarte = \(\) => etat\.nuagescarte === true;/export const nuagescarte = () => true;/" src/reglages.js
     ATTENDU="une carte qui s'ouvre les nuages éteints ne demande rien au service" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$OLD/src/nuages.js" src/nuages.js >/dev/null \
  && diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/src/reglages.js" src/reglages.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-nuages-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
