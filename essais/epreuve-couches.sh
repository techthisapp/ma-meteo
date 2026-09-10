#!/bin/bash
# Épreuve des gardes du panneau des couches en tuiles.
# Usage : essais/epreuve-couches.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-couches
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/vues.js "$SAUVE/src/"; cp styles.css "$SAUVE/"

restaurer() { cp "$SAUVE/src/vues.js" src/; cp "$SAUVE/styles.css" .; }
trap restaurer EXIT

case "$N" in
  1) # Revenir à la liste : une tuile par rangée.
     perl -0pi -e 's/\.ca-grille\{display:grid;grid-template-columns:repeat\(3,1fr\)/.ca-grille{display:grid;grid-template-columns:repeat(1,1fr)/' styles.css
     ATTENDU="le panneau ouvert tient dans un tiers du cadre" ;;
  2) # Deux tuiles par rangée.
     perl -0pi -e 's/\.ca-grille\{display:grid;grid-template-columns:repeat\(3,1fr\)/.ca-grille{display:grid;grid-template-columns:repeat(2,1fr)/' styles.css
     ATTENDU="les tuiles vont par trois sur une rangée" ;;
  3) # Retirer le nom des tuiles de nappe : l'icône seule.
     perl -0pi -e 's/\+ ico\(n\.ico, ""\) \+ `<span>\$\{n\.tuile \|\| n\.nom\}<\/span><\/button>`\)\.join\(""\)/+ ico(n.ico, "") + `<\/button>`).join("")/' src/vues.js
     ATTENDU="chaque tuile porte son nom sous son icône" ;;
  4) # L'icône à côté du nom et non au-dessus.
     perl -0pi -e 's/  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;\n  min-height:56px;/  display:flex;flex-direction:row;align-items:center;justify-content:center;gap:4px;\n  min-height:56px;/' styles.css
     ATTENDU="chaque tuile porte son nom sous son icône" ;;
  5) # Un panneau plus large que la place à gauche du bouton.
     perl -0pi -e 's/  width:258px;padding:var\(--espace-sm\);/  width:400px;padding:var(--espace-sm);/' styles.css
     ATTENDU="le panneau reste dans l'écran" ;;
  6) # La légende prend le nom court de la tuile.
     perl -0pi -e 's/          titreLeg\.textContent = `\$\{n\.nom\}, \$\{n\.porte\}`;/          titreLeg.textContent = `\${n.tuile || n.nom}, \${n.porte}`;/' src/vues.js
     ATTENDU="la légende garde le nom entier quand la tuile porte le court" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-couches-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
