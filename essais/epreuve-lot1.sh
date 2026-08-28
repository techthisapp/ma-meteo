#!/bin/bash
# Épreuve des gardes du rappel de parapluie : chaque faute est rétablie, la suite
# est relancée, et le contrôle censé la voir doit tomber. Un numéro par appel.
# Usage : essais/epreuve-lot1.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-lot1
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/parapluie.js src/reglages.js src/app.js src/vues.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() {
  cp "$SAUVE/src/parapluie.js" "$SAUVE/src/reglages.js" \
     "$SAUVE/src/app.js" "$SAUVE/src/vues.js" src/
  cp "$SAUVE/styles.css" styles.css
}
trap restaurer EXIT

ATTENDU2=""
case "$N" in
  1) # Retirer le seuil de gêne.
     perl -0pi -e 's/    if \(\(serie\.mm\[k\] \|\| 0\) < GENE\) continue;/    if (false) continue;/' src/parapluie.js
     ATTENDU="une journée sèche ne fait paraître aucun jeton de parapluie" ;;
  2) # Rendre le jeton aveugle à la rafale.
     perl -0pi -e 's/objet: p\.raf >= RETOURNEMENT \? "capuche" : "parapluie"/objet: "parapluie"/' src/parapluie.js
     ATTENDU="un vent au delà du seuil fait écrire capuche et non parapluie" ;;
  3) # Ne pas garder la prise du jeton.
     perl -0pi -e 's/  poser\(\{ jetonsPris: \[\.\.\.gardes, cle\] \}\);/  etat.jetonsPris = [...gardes, cle];/' src/reglages.js
     ATTENDU="et ne revient pas au rechargement" ;;
  4) # Chercher la pluie dans la seule heure d'alerte, et non jusqu'à la suivante.
     perl -0pi -e 's/      const p = salvesDe\(serie, jour, alerte, fin, passe \? hCourante : -1\);/      const p = salvesDe(serie, jour, alerte, alerte + 1, passe ? hCourante : -1);/' src/parapluie.js
     ATTENDU="une pluie de l'après-midi est annoncée dès avant la première alerte"
     ATTENDU2="le jeton est là quand la période d'alerte est en cours" ;;
  5) # Faire couvrir la nuit par la dernière alerte, jusqu'à la première du lendemain.
     perl -0pi -e 's/    if \(jour < aujourdhui\) continue;/    if (false) continue;/' src/parapluie.js
     perl -0pi -e 's/  return a\.map\(\(h, i\) => \[h, i \+ 1 < a\.length \? a\[i \+ 1\] : 24\]\);/  return [[0, a[0]], ...a.map((h, i) => [h, i + 1 < a.length ? a[i + 1] : 24])];/' src/parapluie.js
     ATTENDU="une pluie tombée avant la première alerte ne fait rien paraître"
     ATTENDU2="aucune pluie de nuit n'entre dans les rappels de l'horizon" ;;
  6) # Poser le rappel à l'heure de la pluie plutôt qu'à l'heure d'alerte.
     perl -0pi -e 's/  return \(p\.jour > cleJour\(maintenant\) \|\| p\.alerte > h\) \? p\.alerte : p\.h0;/  return p.h0;/' src/parapluie.js
     ATTENDU="le rappel se pose à l'heure d'alerte tant qu'elle est devant soi" ;;
  7) # Poser l'alarme sur l'heure de l'évènement.
     perl -0pi -e 's/TRIGGER:-PT\$\{AVANCE\}M/TRIGGER:PT0M/' src/parapluie.js
     ATTENDU="son alarme tombe quinze minutes avant l'évènement" ;;
  8) # Ne pas replier les lignes du fichier d'agenda.
     perl -0pi -e 's/^const plier = ligne => \{/const plier = ligne => ligne; const plierMort = ligne => {/m' src/parapluie.js
     ATTENDU="une ligne longue se replie et se déplie sur son texte" ;;
  9) # Replier sur des caractères et non sur des octets.
     perl -0pi -e 's/    if \(n \+ o > 75\) \{ out\.push\(cour\); cour = " "; n = 1; \}/    if (n + 1 > 75) { out.push(cour); cour = " "; n = 1; }/' src/parapluie.js
     perl -0pi -e 's/^    n \+= o;$/    n += 1;/m' src/parapluie.js
     ATTENDU="une ligne longue se replie et se déplie sur son texte" ;;
 10) # Accepter une seconde alerte antérieure à la première.
     perl -0pi -e 's/    && v\[0\] >= 0 && v\[0\] < v\[1\] && v\[1\] < 24;/    \&\& v[0] >= 0 \&\& v[1] < 24;/' src/reglages.js
     ATTENDU="une seconde alerte antérieure à la première est refusée" ;;
 11) # Laisser le jeton grandir la barre de tête.
     perl -0pi -e 's/  height:32px;flex:0 0 auto;margin-right:var\(--espace-xs\);/  height:60px;flex:0 0 auto;margin-right:var(--espace-xs);/' styles.css
     ATTENDU="la barre de tête garde sa hauteur et le jeton tient dedans" ;;
 12) # Recopier le seuil de retournement au lieu de le reprendre.
     perl -0pi -e 's/export const RETOURNEMENT = SEUILS\.rafale;/export const RETOURNEMENT = 45;/' src/parapluie.js
     ATTENDU="le seuil de retournement est celui de la règle des rafales" ;;
 13) # Ne poser le jeton que sur l'accueil.
     perl -0pi -e 's/^  poserJeton\(\);$/  if (onglet === "accueil") poserJeton();/m' src/app.js
     ATTENDU="un jeton pris se retire aussi depuis un écran qui n'est pas l'accueil" ;;
 14) # Ne pas refaire l'écran quand un réglage change la barre de tête.
     perl -0pi -e 's/    if \(options\?\.dessous\) rendre\(\);/    if (false) rendre();/' src/app.js
     ATTENDU="une alerte ramenée avant la pluie fait reparaître le jeton" ;;
 15) # Priver la feuille des réglages de la recette du raccourci.
     perl -0pi -e 's/^const RECETTE = \[/const RECETTE = []; const RECETTE_MORTE = [/m' src/vues.js
     ATTENDU="la recette du raccourci se donne étape par étape" ;;
 16) # Écrire l'heure d'alerte sur le jeton plutôt que l'heure de la pluie.
     perl -0pi -e 's/  \$\("navJetonTxt"\)\.textContent = Parapluie\.fenetreTxt\(j\.h0, j\.h1\);/  \$("navJetonTxt").textContent = Parapluie.fenetreTxt(j.alerte, j.fin);/' src/app.js
     ATTENDU="le jeton nomme les heures de la pluie" ;;
 17) # Jeter l'ancien réglage de plages au lieu de le reprendre.
     perl -0pi -e 's/^if \(Array\.isArray\(etat\.sorties\)\) \{/if (false) {/m' src/reglages.js
     ATTENDU="un réglage de plages de sortie se reprend en instants d'alerte" ;;
 18) # Ne pas écarter les heures déjà passées.
     perl -0pi -e 's/    if \(!chevauche\(h, h0, h1\) \|\| h < hMin\) continue;/    if (!chevauche(h, h0, h1)) continue;/' src/parapluie.js
     ATTENDU="une pluie déjà tombée ne fait rien paraître" ;;
 19) # Fondre les salves séparées en une seule plage.
     perl -0pi -e 's/    if \(der && der\[1\] === h\) der\[1\] = h \+ 1;/    if (der) der[1] = h + 1;/' src/parapluie.js
     ATTENDU="la feuille nomme les deux averses, non la plage qui les enjambe" ;;
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
