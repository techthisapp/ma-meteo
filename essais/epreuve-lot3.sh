#!/bin/bash
# Épreuve des gardes de l'écran de questions.
# Usage : essais/epreuve-lot3.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-lot3
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/activites.js src/previsions.js src/reponse.js src/app.js "$SAUVE/src/"

restaurer() {
  cp "$SAUVE/src/activites.js" "$SAUVE/src/previsions.js" \
     "$SAUVE/src/reponse.js" "$SAUVE/src/app.js" src/
}
trap restaurer EXIT

case "$N" in
  1) # Rendre le premier créneau à défaut, sans regarder si l'activité l'accepte.
     perl -0pi -e 's/    if \(!c\) return \{ \.\.\.nu, quand: "Aucun créneau", detail: a\.sans \};/    if (!c) return { ...nu, quand: quandTxt(serie, [k[0], k[0] + 1]),\n      detail: a.dit(serie, [k[0], k[0] + 1]) };/' src/activites.js
     ATTENDU="sans créneau favorable, chaque activité le dit et ne propose rien" ;;
  2) # Ignorer l'évapotranspiration : le bilan suit la pluie seule.
     perl -0pi -e 's/  const manque = -bilan\.bilan;/  const manque = -bilan.pluie;/' src/activites.js
     ATTENDU="un sol qui a beaucoup évaporé demande un arrosage" ;;
  3) # Ne pas exiger que les douze heures qui suivent le lavage soient sèches.
     perl -0pi -e 's/      return premierCreneau\(serie, k, i => serie\.clair\[i\] === 1 && suiteSeche\(i\), 1\);/      return premierCreneau(serie, k, i => serie.clair[i] === 1, 1);/' src/activites.js
     ATTENDU="une averse de l'après-midi repousse le lavage au delà d'elle" ;;
  4) # Laisser courir et rouler à n'importe quelle heure.
     perl -0pi -e 's/const dansEffort = \(serie, i\) =>\n  serie\.heure\[i\] >= S\.effort\[0\] && serie\.heure\[i\] < S\.effort\[1\];/const dansEffort = () => true;/' src/activites.js
     ATTENDU="les créneaux d'effort restent dans les heures où l'on sort" ;;
  5) # Rendre à la réponse du matin sa propre règle d'aération, seconde vérité
     # sur la même question. Les contrôles de l'aération, écrits au lot 2, la
     # voient : la règle partagée est ce qui les fait passer.
     perl -0pi -e 's/  const c = Activites\.creneauAerer\(serie, k\);/  const c = k.length ? [k[0], k[0] + 1] : null;/' src/reponse.js
     ATTENDU="l'aération se tait quand l'intérieur ne va pas se réchauffer" ;;
  6) # Ne plus demander l'évapotranspiration à la source.
     perl -0pi -e 's/^  "et0_fao_evapotranspiration",\n\]\.join\(","\);/].join(",");/mg' src/previsions.js
     ATTENDU="l'évapotranspiration est demandée en horaire et en quotidien" ;;
  7) # Retirer la signature des colonnes de la clé du cache.
     perl -0pi -e 's/\$\{PASSE_H\}p\|\$\{COLONNES\}c`;/\${PASSE_H}p`;/' src/previsions.js
     ATTENDU="la signature des colonnes entre dans la clé du cache" ;;
  8) # Poser la porte des questions au-dessus des mesures du jour.
     perl -0pi -e 's/        \(mesures\.length \? `<div class="bd-mesures">`/        (s ? `<button type="button" class="carte rangee act-porte" data-feuille="activites">`\n          + ico("horloge", "") + `<span class="rangee-txt"><b>Quand faire quoi<\/b>`\n          + `<span>Courir, étendre, aérer, arroser, laver<\/span><\/span>`\n          + chevron + `<\/button>` : "")\n        + (mesures.length ? `<div class="bd-mesures">`/' src/app.js
     perl -0pi -e 's/        \+ \(s \? `<button type="button" class="carte rangee act-porte" data-feuille="activites">`\n          \+ ico\("horloge", ""\) \+ `<span class="rangee-txt"><b>Quand faire quoi<\/b>`\n          \+ `<span>Courir, étendre, aérer, arroser, laver<\/span><\/span>`\n          \+ chevron \+ `<\/button>` : ""\)\n        \+ \(lJour/        + (lJour/' src/app.js
     ATTENDU="l'accueil porte la porte de l'écran de questions, sous les mesures du jour" ;;
  9) # Fondre les six activités en un seul verdict, sans leur raison propre.
     perl -0pi -e 's/    if \(!c\) return \{ \.\.\.nu, quand: "Aucun créneau", detail: a\.sans \};/    if (!c) return { ...nu, quand: "Aucun créneau", detail: "." };/' src/activites.js
     ATTENDU="et chacune dit pourquoi, non seulement qu'il n'y en a pas" ;;
 10) # Faire dire à l'arrosage qu'il n'y a aucun créneau quand il pleut.
     perl -0pi -e 's/    if \(!c && eau\) return \{ \.\.\.nu, quand: "La pluie s\x27en charge", detail: eau\.chiffre \};/    if (!c \&\& eau) return { ...nu, quand: "Aucun créneau", detail: eau.chiffre };/' src/activites.js
     ATTENDU="sous la pluie, l'arrosage dit que la pluie s'en charge" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/activites.js" src/activites.js >/dev/null \
  && diff -q "$SAUVE/src/previsions.js" src/previsions.js >/dev/null \
  && diff -q "$SAUVE/src/reponse.js" src/reponse.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 460 node essais/controle.mjs 2>&1)
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
