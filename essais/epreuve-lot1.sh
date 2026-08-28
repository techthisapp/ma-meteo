#!/bin/bash
# Épreuve des gardes du lot 1 : chaque faute est rétablie, la suite est relancée,
# et le contrôle censé la voir doit tomber. Un seul numéro de faute par appel.
# Usage : essais/epreuve-lot1.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-lot1
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src" "$SAUVE/essais"
cp src/parapluie.js src/reglages.js src/app.js src/vues.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() {
  cp "$SAUVE/src/parapluie.js" "$SAUVE/src/reglages.js" \
     "$SAUVE/src/app.js" "$SAUVE/src/vues.js" src/
  cp "$SAUVE/styles.css" styles.css
}
trap restaurer EXIT

case "$N" in
  1) # Retirer le seuil de gêne.
     perl -0pi -e 's/if \(mm < GENE\) return null;/if (false) return null;/' src/parapluie.js
     ATTENDU="une journée sèche ne fait paraître aucun jeton de parapluie" ;;
  2) # Rendre le jeton aveugle à la rafale.
     perl -0pi -e 's/objet: raf >= RETOURNEMENT \? "capuche" : "parapluie"/objet: "parapluie"/' src/parapluie.js
     ATTENDU="un vent au delà du seuil fait écrire capuche et non parapluie" ;;
  3) # Ne pas garder la prise du jeton.
     perl -0pi -e 's/  poser\(\{ jetonsPris: \[\.\.\.gardes, cle\] \}\);/  etat.jetonsPris = [...gardes, cle];/' src/reglages.js
     ATTENDU="et ne revient pas au rechargement" ;;
  4) # Comparer la fenêtre à la journée et non à l'heure. Une seule faute, deux
     # contrôles : la fenêtre entièrement passée et l'heure déjà tombée.
     perl -0pi -e 's/if \(!chevauche\(h, h0, h1\) \|\| h < hMaintenant\) continue;/if (!chevauche(h, h0, h1)) continue;/' src/parapluie.js
     ATTENDU="le jeton disparaît une fois la fenêtre passée"
     ATTENDU2="dans une fenêtre commencée, la pluie déjà tombée ne fait rien paraître" ;;
  5) # Poser l'alarme sur l'heure de l'évènement.
     perl -0pi -e 's/TRIGGER:-PT\$\{AVANCE\}M/TRIGGER:PT0M/' src/parapluie.js
     ATTENDU="son alarme tombe quinze minutes avant l'évènement" ;;
  6) # Ne pas replier les lignes du fichier d'agenda.
     perl -0pi -e 's/^const plier = ligne => \{/const plier = ligne => ligne; const plierMort = ligne => {/m' src/parapluie.js
     ATTENDU="une ligne longue se replie et se déplie sur son texte" ;;
 14) # Replier sur des caractères et non sur des octets.
     perl -0pi -e 's/    if \(n \+ o > 75\) \{ out\.push\(cour\); cour = " "; n = 1; \}/    if (n + 1 > 75) { out.push(cour); cour = " "; n = 1; }/' src/parapluie.js
     perl -0pi -e 's/^    n \+= o;$/    n += 1;/m' src/parapluie.js
     ATTENDU="une ligne longue se replie et se déplie sur son texte" ;;
  7) # Accepter une fenêtre dont la fin précède le début.
     perl -0pi -e 's/&& f\[0\] >= 0 && f\[0\] < f\[1\] && f\[1\] <= 24\)/\&\& f[0] >= 0 \&\& f[1] <= 24)/' src/reglages.js
     ATTENDU="une fenêtre dont la fin précède le début est refusée" ;;
  8) # Laisser le jeton grandir la barre de tête.
     perl -0pi -e 's/  height:32px;flex:0 0 auto;margin-right:var\(--espace-xs\);/  height:60px;flex:0 0 auto;margin-right:var(--espace-xs);/' styles.css
     ATTENDU="la barre de tête garde sa hauteur et le jeton tient dedans" ;;
  9) # Recopier le seuil de retournement au lieu de le reprendre.
     perl -0pi -e 's/export const RETOURNEMENT = SEUILS\.rafale;/export const RETOURNEMENT = 45;/' src/parapluie.js
     ATTENDU="le seuil de retournement est celui de la règle des rafales" ;;
 10) # Ne poser le jeton que sur l'accueil.
     perl -0pi -e 's/^  poserJeton\(\);$/  if (onglet === "accueil") poserJeton();/m' src/app.js
     ATTENDU="un jeton pris se retire aussi depuis un écran qui n'est pas l'accueil" ;;
 11) # Ne pas refaire l'écran quand un réglage change la barre de tête.
     perl -0pi -e 's/    if \(options\?\.ecranSeul\) \{ rendre\(\); return; \}/    if (options?.ecranSeul) { return; }/' src/app.js
     ATTENDU="une fenêtre ramenée sur la pluie fait reparaître le jeton" ;;
 12) # Priver la feuille des réglages de la recette du raccourci.
     perl -0pi -e 's/^const RECETTE = \[/const RECETTE = []; const RECETTE_MORTE = [/m' src/vues.js
     ATTENDU="la recette du raccourci se donne étape par étape" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/parapluie.js" src/parapluie.js >/dev/null \
  && diff -q "$SAUVE/src/reglages.js" src/reglages.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 420 node essais/controle.mjs 2>&1)
for A in "$ATTENDU" "${ATTENDU2:-}"; do
  [ -z "$A" ] && continue
  if echo "$SORTIE" | grep -q "ÉCHEC  $A"; then
    echo "FAUTE $N vue par : $A"
  else
    echo "FAUTE $N NON VUE. Attendu : $A"
    echo "$SORTIE" | grep "ÉCHEC" | head -8
    echo "$SORTIE" | tail -2
  fi
done
