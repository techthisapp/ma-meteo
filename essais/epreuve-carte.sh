#!/bin/bash
# Épreuve des gardes de la carte.
# Usage : essais/epreuve-carte.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-carte
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/carte.js src/vues.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() { cp "$SAUVE/src/carte.js" "$SAUVE/src/vues.js" src/; cp "$SAUVE/styles.css" .; }
trap restaurer EXIT

case "$N" in
  1) # Ne dessiner que ce qui est hors du cadre : la carte se vide.
     perl -0pi -e 's/      if \(mx\(x1\) < fo \|\| mx\(x0\) > fe \|\| my\(y0\) < fs \|\| my\(y1\) > fn\) return;/      if (!(mx(x1) < fo || mx(x0) > fe || my(y0) < fs || my(y1) > fn)) return;/' src/carte.js
     ATTENDU="la carte est peinte sur sa toile" ;;
  2) # Rendre la latitude linéaire au retour : la projection cesse de se répondre.
     perl -0pi -e 's/export const latDe = y => 90 - \(360 \* Math\.atan\(Math\.exp\(\(y - 0\.5\) \* 2 \* Math\.PI\)\)\) \/ Math\.PI;/export const latDe = y => 90 - y * 180;/' src/carte.js
     ATTENDU="la projection et son inverse se répondent" ;;
  3) # Ne pas borner la vue.
     perl -0pi -e 's/export function borner\(vue\) \{\n  return \{/export function borner(vue) {\n  return { ...vue };\n  return {/' src/carte.js
     ATTENDU="le zoom reste entre ses bornes" ;;
  4) # Ne pas suivre le doigt.
     perl -0pi -e 's/    Object\.assign\(vue, recentrer\(bornee, depart\.ancre, x, y, l, h\)\);\n    redessiner\(\);/    redessiner();/' src/carte.js
     ATTENDU="le doigt déplace la carte" ;;
  5) # Laisser un repère hors du cadre collé au bord.
     perl -0pi -e 's/          b\.hidden = dehors;/          b.hidden = false;/' src/vues.js
     ATTENDU="un repère hors du cadre est caché" ;;
  6) # Rendre à l'écran de la carte le rembourrage qui le fait défiler.
     perl -0pi -e 's/\.ecran-carte\{\n  padding:calc\(var\(--haut\) \+ var\(--nav-haut\)\) 0 var\(--onglets-mesure\);\n  gap:0;max-width:none;\n\}/.ecran-carte{gap:0;max-width:none}/' styles.css
     ATTENDU="l'écran de la carte ne défile pas" ;;
  7) # Ne pas ramener la carte sur le lieu courant.
     perl -0pi -e 's/        Object\.assign\(vue, Carte\.borner\(\{ lat: g\.lat, lon: g\.lon, z: Carte\.ZDEFAUT \}\)\);\n        revoir\(\);/        revoir();/' src/vues.js
     ATTENDU="le retour ramène la carte sur le lieu courant" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/carte.js" src/carte.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 700 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-carte-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
