#!/bin/bash
# Épreuve des gardes de la pluie dans l'heure.
# Usage : essais/epreuve-pluieproche.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-pluieproche
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/pluieproche.js src/app.js src/vigilance.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/pluieproche.js" "$SAUVE/src/app.js" \
  "$SAUVE/src/vigilance.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Parler même quand l'heure est sèche.
     perl -0pi -e 's/  const debut = mouille/  const debut = mouille/' src/pluieproche.js
     perl -0pi -e 's/  if \(debut < 0\) return null;/  if (debut < 0) return { genre: "encore", force: 1, t: null, fin: null };/' src/pluieproche.js
     ATTENDU="une heure entièrement sèche ne dit rien" ;;
  2) # Annoncer la force de la première échéance et non celle de l'épisode.
     perl -0pi -e 's/  const force = Math\.max\(\.\.\.pas\.slice\(debut, bout\)\.map\(x => x\.i\)\);/  const force = pas[debut].i;/' src/pluieproche.js
     ATTENDU="la force annoncée est celle de tout l.épisode" ;;
  3) # Poser le panneau après le bloc du jour.
     perl -0pi -e 's/      \+ panneauVigilance\(\)\n      \+ panneauPluieProche\(\)/      + panneauVigilance()/' src/app.js
     perl -0pi -e 's/    if \(s\) \{\n      corps \+= bloc\("h24"/    corps += panneauPluieProche();\n    if (s) {\n      corps += bloc("h24"/' src/app.js
     ATTENDU="le panneau vient après la vigilance et avant le bloc du jour" ;;
  4) # Ranger les barres à intervalle constant, sur leur rang.
     perl -0pi -e 's/      \+ `style="--x:\$\{\(\(\(x\.t - t0\) \/ etendue\) \* 100\)\.toFixed\(2\)\}%;--h:\$\{h\}%"><\/i>`;/      + `style="--x:\${((pas.indexOf(x) \/ (pas.length - 1)) * 100).toFixed(2)}%;--h:\${h}%"><\/i>`;/' src/app.js
     ATTENDU="le graphe pose chaque échéance à son heure et non à son rang" ;;
  5) # Colorer toutes les barres.
     perl -0pi -e 's/    return `<i class="pp-b\$\{estPluieRang\(x\.i\) \? " pp-b-eau" : ""\}" `/    return `<i class="pp-b pp-b-eau" `/' src/app.js
     ATTENDU="seules les échéances mouillées portent la couleur de l.eau" ;;
  6) # Décrire le graphe par ses neuf valeurs.
     perl -0pi -e 's/  if \(!bouts\.length\) return "Aucune pluie dans l.heure";/  return pas.map(x => x.i).join(", ");\n  if (!bouts.length) return "Aucune pluie dans l\x27heure";/' src/app.js
     ATTENDU="le graphe se lit sans le voir" ;;
  7) # Ne pas dire la fin d'une pluie en cours.
     perl -0pi -e 's/    if \(fin < 0\) return \{ genre: "encore", force, t: null, fin: null \};\n    return \{ genre: "fin", force, t: pas\[fin\]\.t, fin: pas\[fin\]\.t \};/    return { genre: "encore", force, t: null, fin: null };/' src/pluieproche.js
     ATTENDU="une pluie en cours se dit par sa fin" ;;
  8) # Inventer une fin à une pluie qui déborde l'heure.
     perl -0pi -e 's/  if \(ev\.genre === "encore"\) return `\$\{nom\}, sans accalmie dans l.heure\.`;/  if (ev.genre === "encore") return `\${nom}, qui s\x27arrête dans une heure.`;/' src/pluieproche.js
     ATTENDU="une pluie sans accalmie ne s.invente pas de fin" ;;
  9) # Ignorer le drapeau de disponibilité.
     perl -0pi -e 's/  if \(!l \|\| !l\.dispo\) return null;/  if (!l) return null;/' src/pluieproche.js
     perl -0pi -e 's/  if \(!l \|\| !l\.dispo\) return "";/  if (!l) return "";/' src/app.js
     ATTENDU="une lecture non couverte ne conclut rien" ;;
  10) # Traiter l'absence de valeur comme du temps sec.
     perl -0pi -e 's/  const eau = x => \(x\.i === 0 \? null : estPluie\(x\.i\)\);/  const eau = x => estPluie(x.i);/' src/pluieproche.js
     ATTENDU="une échéance sans valeur n.invente pas une fin de pluie" ;;
  11) # Traiter l'absence de valeur comme du temps sec, côté début.
     perl -0pi -e 's/    if \(etat\[k\] === null\) break;\n    if \(etat\[k\] === true\) \{ debut = k; break; \}/    if (etat[k] === true) { debut = k; break; }/' src/pluieproche.js
     perl -0pi -e 's/  if \(etat\[0\] === null\) return null;/  if (false) return null;/' src/pluieproche.js
     ATTENDU="une échéance sans valeur arrête la lecture avant la pluie" ;;
  12) # Redemander la source à chaque écran.
     perl -0pi -e 's/  if \(g && Date\.now\(\) < g\.exp\) return g\.d;/  if (false) return g.d;/' src/pluieproche.js
     ATTENDU="un lieu déjà lu ne redemande pas le produit" ;;
  13) # Recopier le jeton au lieu de le lire là où il vit.
     perl -0pi -e 's/import \{ JETON \} from "\.\/vigilance\.js";/const JETON = "__recopie__";/' src/pluieproche.js
     ATTENDU="le jeton du service est celui de la vigilance" ;;
  14) # Annoncer que la pluie est indisponible au lieu de se taire.
     perl -0pi -e 's{  if \(!l \|\| !l\.dispo\) return "";}{  if (!l) return \x27<div class="section pp"><div class="carte pp-c"><p class="pp-tete"><b>Pluie indisponible.</b></p></div></div>\x27;\n  if (!l.dispo) return "";}' src/app.js
     ATTENDU="un produit muet ne prive pas l.écran" ;;
  15) # Arrondir le délai à la minute.
     perl -0pi -e 's/  Math\.max\(0, Math\.round\(\(t - maintenant\) \/ 60000 \/ 5\) \* 5\);/  Math.max(0, Math.round((t - maintenant) \/ 60000));/' src/pluieproche.js
     ATTENDU="le délai s.arrondit au pas de la source" ;;
  16) # Ne jamais partir sur le repli.
     perl -0pi -e 's/  if \(!d \|\| !d\.dispo\) d = await chargerRepli\(lat, lon, fetcheur\);/  if (false) d = await chargerRepli(lat, lon, fetcheur);/' src/pluieproche.js
     ATTENDU="sans couverture radar, le repli prend le relais" ;;
  17) # Partir sur le repli même là où le radar couvre.
     perl -0pi -e 's/  if \(!d \|\| !d\.dispo\) d = await chargerRepli\(lat, lon, fetcheur\);/  d = await chargerRepli(lat, lon, fetcheur);/' src/pluieproche.js
     ATTENDU="avec couverture radar, le repli ne part pas" ;;
  18) # Annoncer le repli au pas de cinq minutes.
     perl -0pi -e 's/  return \{ dispo: true, nom: null, maj: null, pas, source: "repli", pasMinutes: PAS_REPLI \};/  return { dispo: true, nom: null, maj: null, pas, source: "repli", pasMinutes: PAS_MF };/' src/pluieproche.js
     ATTENDU="le repli annonce au pas du quart d.heure" ;;
  19) # Prendre la lame d'eau du quart d'heure pour un taux horaire.
     perl -0pi -e 's/    const taux = mm \* parHeure;/    const taux = mm;/' src/pluieproche.js
     ATTENDU="la lame d.eau du repli devient un rang d.intensité" ;;
  20) # Demander au repli plus de pas que l'heure n'en porte.
     perl -0pi -e 's/const REPLI_PAS = 5;/const REPLI_PAS = 9;/' src/pluieproche.js
     ATTENDU="le graphe du repli porte ses cinq pas" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if ! git diff --quiet -- src/; then
  echo "faute $N posée"
else
  echo "faute $N : le fichier n'a pas changé, la substitution a raté"
  exit 3
fi

node essais/controle.mjs > /tmp/ep-pp-$N.txt 2>&1
LIGNE=$(grep -n "ÉCHEC" /tmp/ep-pp-$N.txt | head -20)
echo "--- échecs relevés ---"
echo "$LIGNE"
if echo "$LIGNE" | grep -qi "$ATTENDU"; then
  echo "OK : la garde « $ATTENDU » est tombée."
else
  echo "MANQUE : « $ATTENDU » n'est pas tombée."
  tail -3 /tmp/ep-pp-$N.txt
fi
