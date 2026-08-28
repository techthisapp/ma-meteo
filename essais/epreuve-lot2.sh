#!/bin/bash
# Épreuve des gardes de la réponse du matin et du ressenti calibré.
# Usage : essais/epreuve-lot2.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-lot2
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/reponse.js src/reglages.js src/app.js src/vues.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() {
  cp "$SAUVE/src/reponse.js" "$SAUVE/src/reglages.js" \
     "$SAUVE/src/app.js" "$SAUVE/src/vues.js" src/
  cp "$SAUVE/styles.css" styles.css
}
trap restaurer EXIT

ATTENDU2=""
case "$N" in
  1) # Retirer la matière de l'encart, qui porte son contraste.
     perl -0pi -e 's/  background:rgba\(10,16,26,\.30\);\n  border:1px solid rgba\(255,255,255,\.18\);/  background:transparent;\n  border:1px solid transparent;/' styles.css
     perl -0pi -e 's/  backdrop-filter:blur\(14px\) saturate\(1\.2\);/  backdrop-filter:none;/' styles.css
     ATTENDU="l'encart de la réponse reste lisible sur un plafond de plein jour" ;;
  2) # Poser l'encart sous la ligne de date.
     perl -0pi -e 's/      \+ `<div class="plein-titre">`\n      \+ \(reponse \?/      + `<div class="plein-titre">`\n      + `<i>\${esc(jour.charAt(0).toUpperCase() + jour.slice(1))}<\/i>`\n      + (reponse ?/' src/app.js
     perl -0pi -e 's/      \+ `<i>\$\{esc\(jour\.charAt\(0\)\.toUpperCase\(\) \+ jour\.slice\(1\)\)\}<\/i>`\n      \+ `<div class="pt-temps">`/      + `<div class="pt-temps">`/' src/app.js
     ATTENDU="elle est posée au-dessus de la ligne de date et du grand chiffre" ;;
  3) # Retirer la borne du biais personnel.
     perl -0pi -e 's/  const b = Math\.max\(-borne, Math\.min\(borne, Math\.round\(Number\(v\) \|\| 0\)\)\);/  const b = Math.round(Number(v) || 0);/' src/reglages.js
     ATTENDU="le biais reste borné des deux côtés"
     ATTENDU2="et il se borne aussi vers le froid" ;;
  4) # Rendre le biais aveugle : ne plus le passer à la réponse.
     perl -0pi -e 's/    \{ biais: Reglages\.biais\(\) \}\);/    { biais: 0 });/' src/app.js
     ATTENDU="un degré de trop chaud allège la tenue d'un cran" ;;
  5) # Déplacer les degrés écrits en même temps que la tenue.
     perl -0pi -e 's/\$\{Math\.round\(serie\.res\[a\]\)\}°, puis \$\{nomB\.toLowerCase\(\)\} `/\${Math.round(serie.res[a] + biais)}°, puis \${nomB.toLowerCase()} `/' src/reponse.js
     ATTENDU="et ne déplace aucun des degrés écrits" ;;
  6) # Parler même quand la journée tient dans une seule tenue ordinaire.
     perl -0pi -e 's/    if \(!extreme\) return null;/    if (false) return null;/' src/reponse.js
     ATTENDU="une journée sans rien à décider ne fait paraître aucun encart" ;;
  7) # Conseiller d'aérer sans regarder si l'intérieur va se réchauffer.
     perl -0pi -e 's/  if \(chaud < INTERIEUR \+ ECART\) return null;/  if (false) return null;/' src/reponse.js
     ATTENDU="l'aération se tait quand l'intérieur ne va pas se réchauffer" ;;
  8) # Écrire la confiance à chaque fois.
     perl -0pi -e 's/  const partages = !!j && j\.etendue >= CONFIANCE_BASSE;/  const partages = true;/' src/reponse.js
     ATTENDU="des scénarios accordés ne se disent pas" ;;
  9) # Ne jamais écrire la confiance.
     perl -0pi -e 's/  const partages = !!j && j\.etendue >= CONFIANCE_BASSE;/  const partages = false;/' src/reponse.js
     ATTENDU="des scénarios partagés se disent dans la phrase" ;;
 10) # Faire dire le parapluie à la phrase.
     perl -0pi -e 's/  const r = habillement\(serie, k, opts\.biais \|\| 0\) \|\| aeration\(serie, k\);/  const r = { cle: "pluie", texte: "Parapluie aujourd\x27hui." };/' src/reponse.js
     ATTENDU="elle ne parle pas du parapluie, qui est l'affaire du jeton" ;;
 12) # Étendre le verre hors de la couche navigation et de son exception.
     perl -0pi -e 's/^\.carte,\.groupe\{/.carte,.groupe{backdrop-filter:blur(6px);/m' styles.css
     ATTENDU="le verre est réservé à la couche navigation et à la réponse du matin" ;;
 13) # Ordonner les deux moments du plus froid au plus chaud, non dans le temps.
     perl -0pi -e 's/  const \[a, b\] = kf <= kc \? \[kf, kc\] : \[kc, kf\];/  const [a, b] = [kf, kc];/' src/reponse.js
     ATTENDU="une journée qui se rafraîchit se dit dans l'ordre du temps" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/reponse.js" src/reponse.js >/dev/null \
  && diff -q "$SAUVE/src/reglages.js" src/reglages.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 440 node essais/controle.mjs 2>&1)
for A in "$ATTENDU" "$ATTENDU2"; do
  [ -z "$A" ] && continue
  if echo "$SORTIE" | grep -q "ÉCHEC  $A"; then
    echo "FAUTE $N vue par : $A"
  else
    echo "FAUTE $N NON VUE. Attendu : $A"
    echo "$SORTIE" | grep "ÉCHEC" | head -8
    echo "$SORTIE" | tail -2
  fi
done
