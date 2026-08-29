#!/bin/bash
# Épreuve des gardes de « Où est le beau temps ».
# Usage : essais/epreuve-lot4.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-lot4
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/beautemps.js src/previsions.js src/vues.js src/app.js "$SAUVE/src/"

restaurer() {
  cp "$SAUVE/src/beautemps.js" "$SAUVE/src/previsions.js" \
     "$SAUVE/src/vues.js" "$SAUVE/src/app.js" src/
}
trap restaurer EXIT

case "$N" in
  1) # Classer sur la température seule.
     perl -0pi -e 's/  return out\.sort\(\(a, b\) => b\.score - a\.score\);/  return out.sort((a, b) => b.tmax - a.tmax);/' src/beautemps.js
     ATTENDU="les lieux suivis sont classés du plus beau au moins beau" ;;
  2) # Classer sur l'ensoleillement seul, sans la correction de pluie.
     perl -0pi -e 's/  return out\.sort\(\(a, b\) => b\.score - a\.score\);/  return out.sort((a, b) => b.soleil - a.soleil);/' src/beautemps.js
     ATTENDU="le point le plus ensoleillé, mais pluvieux, n'est pas en tête" ;;
  3) # Retirer la pluie du score.
     perl -0pi -e 's/  poidsPluie: 25,/  poidsPluie: 0,/' src/beautemps.js
     ATTENDU="le point le plus ensoleillé, mais pluvieux, n'est pas en tête" ;;
  4) # Retirer l'ensoleillement du score, qu'il est censé porter.
     perl -0pi -e 's/  poidsSoleil: 60,/  poidsSoleil: 0,/' src/beautemps.js
     ATTENDU="à pluie et température égales, le plus ensoleillé passe devant" ;;
  5) # Compter l'ensoleillement en heures, non en part de la durée du jour.
     perl -0pi -e 's/  const soleil = Math\.max\(0, Math\.min\(1, j\.soleil \/ j\.jour\)\);/  const soleil = Math.max(0, Math.min(1, j.soleil \/ 12));/' src/beautemps.js
     ATTENDU="le même ensoleillement vaut plus sur une journée courte" ;;
  6) # Envoyer au meilleur point quel que soit l'écart.
     perl -0pi -e 's/  return m\.score - ici\.score >= S\.ecartUtile \? m : null;/  return m;/' src/beautemps.js
     ATTENDU="un écart trop faible laisse le beau temps ici" ;;
  7) # Ne pas borner la grille à son rayon.
     perl -0pi -e 's/      if \(p\.km > rayon\) continue;\n//' src/beautemps.js
     ATTENDU="la grille tient dans son rayon et porte un seul centre" ;;
  8) # Dire la distance sans la direction.
     perl -0pi -e 's/    : `à \$\{Math\.round\(l\.km\)\} km \$\{versCardinal\(l\.cap\)\}`\);/    : `à \${Math.round(l.km)} km`);/' src/beautemps.js
     ATTENDU="un point nommé garde sa distance et sa direction" ;;
  9) # Ne rien garder en mémoire : chaque ouverture redemande tout.
     perl -0pi -e 's/const TTL_JOURNEES = 30 \* 60 \* 1000;/const TTL_JOURNEES = 0;/' src/previsions.js
     ATTENDU="rouvrir la feuille ne redemande rien à la source" ;;
 10) # Perdre la rangée d'ici quand elle n'est pas dans les cinq premières.
     perl -0pi -e 's/        if \(iciG && !montres\.includes\(iciG\)\) montres\.push\(iciG\);\n//' src/vues.js
     ATTENDU="la grille montre cinq points, plus celui d'ici" ;;
 11) # Lire la grille à l'ouverture de la feuille, sans qu'on l'ait demandée.
     perl -0pi -e 's/      P\.journees\(lieux\)\.then\(\(\{ liste, age \}\) => \{/      P.journees(points);\n      P.journees(lieux).then(({ liste, age }) => {/' src/vues.js
     ATTENDU="la grille ne part pas d'elle-même" ;;
 12) # Nommer les soixante-neuf points, non les six montrés.
     perl -0pi -e 's/        nommer\(montres\);/        nommer(cl);/' src/vues.js
     ATTENDU="seuls les points montrés sont nommés" ;;
 13) # Ne pas lire le sélecteur de journée.
     perl -0pi -e 's/          j = Number\(b\.dataset\.jour\);/          j = 0;/' src/vues.js
     ATTENDU="le sélecteur de journée change le classement" ;;
 14) # Séparer les deux portes de l'accueil, qui cessent de se lire ensemble.
     perl -0pi -e 's/        \+ `<button type="button" class="carte rangee porte" data-feuille="beautemps">`/        + `<p class="note">Deux questions.<\/p>`\n        + `<button type="button" class="carte rangee porte" data-feuille="beautemps">`/' src/app.js
     ATTENDU="les deux portes se suivent et partagent leur gabarit" ;;
 15) # Montrer les cinq premiers du classement, voisins ou non.
     perl -0pi -e 's/    if \(pris\.some\(p => km\(p, l\) < ecart\)\) continue;\n//' src/beautemps.js
     ATTENDU="deux points montrés ne sont jamais voisins" ;;
 16) # Écrire « 0 mm » sur une journée sèche.
     perl -0pi -e 's/ : ""\}`;/ : ", 0 mm"}`;/' src/beautemps.js
     ATTENDU="la pluie ne s'écrit que s'il en tombe" ;;
 17) # Redemander à l'interface adresse le nom du lieu courant.
     perl -0pi -e 's/        const rangees = montres\.map\(l => \(l\.ici \? \{ \.\.\.l, nom: ici\.nom \} : l\)\);/        const rangees = montres;/' src/vues.js
     ATTENDU="la rangée d'ici porte le nom du lieu courant" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/beautemps.js" src/beautemps.js >/dev/null \
  && diff -q "$SAUVE/src/previsions.js" src/previsions.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 560 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-lot4-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
