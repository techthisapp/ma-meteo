#!/bin/bash
# Épreuve des gardes du ciel étoilé, première partie : les calculs.
# Usage : essais/epreuve-ciel-etoiles.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
COPIE=/tmp/copie-etoiles-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8340 + N))
JUSQUA="Le ciel étoilé"

case "$N" in
  1) # Les coordonnées passées en radians à un module qui travaille en degrés :
     # c'est le défaut commis le 20 septembre 2026, qui laissait passer les cinq
     # mille étoiles, y compris celles sous les pieds de l'observateur.
     perl -0pi -e 's/  return horizon\(\{ ascension: ra \* 15, declinaison: dec \}, jj, lat, lon\);/  return horizon({ ascension: ra * Math.PI \/ 12, declinaison: dec * Math.PI \/ 180 }, jj, lat, lon);/' src/ciel.js
     ATTENDU="les étoiles sous l'horizon sont écartées" ;;
  2) # Le filtre d'horizon saute.
     perl -0pi -e 's/    if \(hauteur < 0\) continue;\n    const p = projeter\(azimut, hauteur, azCentre, hautCentre, champ\);\n    if \(!p \|\| Math\.abs\(p\.x\) > 1\.2/    const p = projeter(azimut, hauteur, azCentre, hautCentre, champ);\n    if (!p || Math.abs(p.x) > 1.2/' src/ciel.js
     ATTENDU="les étoiles sous l'horizon sont écartées" ;;
  3) # Le Soleil revient parmi les étoiles.
     python3 - <<'PY'
import json, io
d = json.load(open("donnees/ciel.json"))
d["etoiles"].insert(0, [0, 0, -26.7, 0.65, "Sol", "", ""])
io.open("donnees/ciel.json", "w", encoding="utf-8").write(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
PY
     ATTENDU="le Soleil ne figure pas parmi les étoiles" ;;
  4) # L'échelle des rayons à l'endroit : une étoile faible deviendrait un disque.
     perl -0pi -e 's/  const r = 0\.5 \+ \(6 - Math\.min\(mag, 6\)\) \* 0\.42;/  const r = 0.5 + Math.min(mag, 6) * 0.42;/' src/ciel.js
     ATTENDU="le rayon d'une étoile suit sa magnitude, à l'envers" ;;
  5) # Un point derrière l'observateur se projette quand même.
     perl -0pi -e 's/  if \(cosC <= 0\) return null;//' src/ciel.js
     ATTENDU="un point derrière l'observateur ne se projette pas" ;;
  6) # Le fichier du ciel se charge dès l'écran du Soleil : tout le monde le paie.
     perl -0pi -e 's/  const quel = Reglages\.ciel\(\);\n  const f = quel === "lune"/  const quel = Reglages.ciel();\n  Ciel.charger().catch(() => {});\n  const f = quel === "lune"/' src/vues.js
     ATTENDU="le fichier du ciel ne se charge qu.à l.ouverture de l.écran" ;;
  7) # La toile reste vide une fois les données chargées.
     perl -0pi -e 's/        if \(!pret\) return;\n        const unite = Math\.min\(l, h\) \/ 2;/        return;\n        const unite = Math.min(l, h) \/ 2;/' src/vues.js
     ATTENDU="la toile porte des étoiles" ;;
  8) # Le doigt ne tourne plus la vue.
     perl -0pi -e 's/      cv\.addEventListener\("pointermove", ev => \{\n        if \(!depart\) return;/      cv.addEventListener("pointermove", ev => {\n        return;/' src/vues.js
     ATTENDU="le doigt tourne la vue" ;;
  9) # La mention oublie le catalogue des étoiles.
     perl -0pi -e 's/Étoiles du catalogue HYG, licence/Étoiles, licence/' src/vues.js
     ATTENDU="la mention nomme les deux sources" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if diff -q "$OLD/src/ciel.js" src/ciel.js >/dev/null \
  && diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/donnees/ciel.json" donnees/ciel.json >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-etoiles-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
