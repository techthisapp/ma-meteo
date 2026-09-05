#!/bin/bash
# Épreuve des gardes de la couche de pluie.
# Usage : essais/epreuve-pluie.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-pluie
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/radar.js src/vues.js src/carte.js src/reglages.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/radar.js" "$SAUVE/src/vues.js" "$SAUVE/src/carte.js" \
  "$SAUVE/src/reglages.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Peindre la couche par-dessus les traits au lieu de dessous. La gaine reste
     # posée, sans quoi la faute en éprouverait deux à la fois.
     perl -0pi -e 's/  const posees = couche \? couche\(ctx, vue, l, h\) \|\| 0 : 0;/  const posees = 1;/' src/carte.js
     perl -0pi -e 's/    ctx\.strokeStyle = c\[teinte\] \|\| "#8895a6";\n    ctx\.lineWidth = epais \* gros;\n    ctx\.stroke\(\);\n  \}\n\}/    ctx.strokeStyle = c[teinte] || "#8895a6";\n    ctx.lineWidth = epais * gros;\n    ctx.stroke();\n  }\n  if (couche) couche(ctx, vue, l, h);\n}/' src/carte.js
     ATTENDU="la pluie se pose sous les traits, non dessus" ;;
  2) # Ouvrir la chronologie sur la dernière image, extrapolée comprise.
     perl -0pi -e 's/export function rangCourant\(images\) \{/export function rangCourant(images) {\n  return images.length - 1;/' src/radar.js
     ATTENDU="la carte s.ouvre sur la dernière image observée" ;;
  3) # Inventer des images extrapolées quand le service n'en publie pas.
     perl -0pi -e 's/    \.\.\.\(rad\.nowcast \|\| \[\]\)\.map\(i => \(\{ \.\.\.i, futur: true \}\)\),/    ...(rad.nowcast \&\& rad.nowcast.length ? rad.nowcast : (rad.past || []).slice(-3)).map(i => ({ ...i, futur: true })),/' src/radar.js
     ATTENDU="sans image extrapolée la chronologie s.arrête à maintenant" ;;
  4) # Ne pas distinguer l'extrapolation de l'observation.
     perl -0pi -e 's/        piste\.classList\.toggle\("ca-piste-futur", im\.futur === true\);/        piste.classList.toggle("ca-piste-futur", false);/' src/vues.js
     ATTENDU="une image extrapolée se distingue d.une observation" ;;
  5) # Mettre la chronologie en marche à l'ouverture.
     perl -0pi -e 's/          poserRang\(Radar\.rangCourant\(images\)\);/          poserRang(Radar.rangCourant(images));\n          lire();/' src/vues.js
     ATTENDU="la chronologie ne se met pas en marche seule" ;;
  6) # Charger toutes les images à l'ouverture.
     perl -0pi -e 's/          poserRang\(Radar\.rangCourant\(images\)\);/          poserRang(Radar.rangCourant(images));\n          for (const im of images) Radar.preparer(vue, cv.clientWidth, cv.clientHeight, hote, im.chemin);/' src/vues.js
     ATTENDU="l.ouverture ne charge qu.une image" ;;
  7) # Demander les tuiles en cinq cent douze points.
     perl -0pi -e 's/export const TAILLE = 256;/export const TAILLE = 512;/' src/radar.js
     ATTENDU="les tuiles se demandent en deux cent cinquante-six points" ;;
  8) # Vider le cache à chaque demande de tuile.
     perl -0pi -e 's/  let e = cache\.get\(cle\);/  let e = null;/' src/radar.js
     ATTENDU="une tuile déjà chargée ne se redemande pas" ;;
  9) # Charger l'index même quand la couche est éteinte.
     perl -0pi -e 's/      mention\(\);\n      if \(allume\) lireIndex\(\);/      mention();\n      lireIndex();/' src/vues.js
     ATTENDU="la couche éteinte ne demande rien au service" ;;
  10) # Ne pas garder le choix de la couche.
     perl -0pi -e 's/export function poserRadar\(v\) \{ poser\(\{ radar: v === true \}\); \}/export function poserRadar() { }/' src/reglages.js
     ATTENDU="le choix de la couche se garde" ;;
  11) # Se taire quand le réseau manque.
     perl -0pi -e 's/          dire\("La pluie a besoin du réseau\."\);/          dire("");/' src/vues.js
     ATTENDU="sans réseau la pluie le dit et la carte reste dessinée" ;;
  12) # Retirer la mention du service.
     perl -0pi -e 's/        credit\.innerHTML = allume/        credit.innerHTML = "Contours IGN et Natural Earth";\n        if \(0\) credit.innerHTML = allume/' src/vues.js
     ATTENDU="la mention du service paraît avec la couche" ;;
  13) # Laisser la lecture sauter les images non chargées.
     perl -0pi -e 's/          await Radar\.preparer\(vue, l, h, hote, images\[k\]\.chemin\);\n          if \(!enLecture \|\| !cv\.isConnected\) break;\n          poserRang\(k\);/          poserRang(k);/' src/vues.js
     perl -0pi -e 's/      jouer\.addEventListener\("click", \(\) => \{ if \(enLecture\) arreter\(\); else lire\(\); \}\);/      jouer.addEventListener("click", () => { if (enLecture) arreter(); });/' src/vues.js
     ATTENDU="la lecture avance d.image en image" ;;
  14) # Ignorer le doigt sur la piste.
     perl -0pi -e 's/        glisse = true; arreter\(\); versDoigt\(ev\.clientX\);/        glisse = true; arreter();/' src/vues.js
     ATTENDU="le doigt sur la piste change l.image montrée" ;;
  15) # Retirer la gaine des traits sous la couche.
     perl -0pi -e 's/    if \(posees\) \{\n      ctx\.strokeStyle = c\.fond \|\| "#eef2f6";/    if (false) {\n      ctx.strokeStyle = c.fond || "#eef2f6";/' src/carte.js
     ATTENDU="un trait posé sur la couche garde son écart de clarté" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if ! git diff --quiet -- src/; then
  echo "faute $N posée"
else
  echo "faute $N : le fichier n'a pas changé, la substitution a raté"
  exit 3
fi

node essais/controle.mjs > /tmp/ep-pluie-$N.txt 2>&1
LIGNE=$(grep -n "ÉCHEC" /tmp/ep-pluie-$N.txt | head -20)
echo "--- échecs relevés ---"
echo "$LIGNE"
if echo "$LIGNE" | grep -qi "$ATTENDU"; then
  echo "OK : la garde « $ATTENDU » est tombée."
else
  echo "MANQUE : « $ATTENDU » n'est pas tombée."
  tail -3 /tmp/ep-pluie-$N.txt
fi
