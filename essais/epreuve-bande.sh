#!/bin/bash
# Épreuve des gardes de la bande horaire de l'accueil, jalon 10, lot 1.
# Usage : essais/epreuve-bande.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
COPIE=/tmp/copie-bande-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8360 + N))
JUSQUA="La bande horaire"

case "$N" in
  1) # La bande repasse au-dessus des chiffres du jour, l'ordre d'avant le
     # 24 septembre 2026.
     perl -0pi -e 's/\n        \+ Bande\.bandeHoraire\(s, g\)\n/\n/' src/app.js
     perl -0pi -e 's/(      \+ bloc\("jour", "Aujourd.hui",)/      + Bande.bandeHoraire(s, g)\n$1/' src/app.js
     ATTENDU="la bande horaire se pose sous les avis urgents et les chiffres du jour, avant les portes" ;;
  2) # Douze heures seulement.
     perl -0pi -e 's/export const HEURES = 24;/export const HEURES = 12;/' src/bande.js
     ATTENDU="elle compte vingt-quatre heures, qui glissent sous le doigt" ;;
  3) # Le Soleil ne s'intercale plus.
     perl -0pi -e 's/      if \(!t \|\| t\.getTime\(\) < depart\.getTime\(\) \|\| t\.getTime\(\) >= fin\) continue;/      continue;/' src/bande.js
     ATTENDU="le coucher et le lever du Soleil s.intercalent à leur minute" ;;
  4) # La phrase oublie le moment de la pluie.
     perl -0pi -e 's/      : `Pluie \$\{quand\} de /      : `Pluie de /' src/bande.js
     ATTENDU="la phrase dit la pluie avec son moment, et les rafales fortes" ;;
  5) # Le trait des températures ne relie plus rien.
     perl -0pi -e 's/    points\.push\(\[x \+ LARGEUR_HEURE \/ 2, yDe\(s\.t\[k\]\)\]\);\n//' src/bande.js
     ATTENDU="un trait relie les températures des vingt-quatre heures" ;;
  6) # Le symbole de temps s'écrit en toutes lettres, le défaut de la première capture.
     perl -0pi -e 's/      \+ icoTemps\(icoCiel\(s\.code\[k\], s\.clair\[k\] === 1\), "bh-ic", 26\)/      + icoCiel(s.code[k], s.clair[k] === 1)/' src/bande.js
     ATTENDU="chaque heure porte son symbole, son degré, son vent et ses rafales" ;;
  7) # Le ciel de l'accueil reprend sa hauteur d'origine.
     perl -0pi -e 's/\.plein-accueil \.ci\{aspect-ratio:390 \/ 250\}/.plein-accueil .ci{aspect-ratio:390 \/ 306}/' styles.css
     ATTENDU="le ciel de l.accueil est plus bas que celui des autres écrans" ;;
  8) # Les chiffres repassent sur deux colonnes quelle que soit la taille du texte.
     perl -0pi -e 's/\@container \(max-width:18rem\)\{\n  \.bd-mesures\{/\@container (max-width:60rem){\n  .bd-mesures{/' styles.css
     ATTENDU="les quatre chiffres du jour tiennent sur une ligne en taille ordinaire" ;;
  9) # La bande compte de nouveau les heures à fort risque sans quantité, le
     # défaut qui la faisait contredire la suite de la page.
     perl -0pi -e 's/export const pluvieuse = \(s, k\) => \(s\.mm\[k\] \?\? 0\) >= SEUIL_LAME;/export const pluvieuse = (s, k) => (s.mm[k] ?? 0) >= SEUIL_LAME || (s.pb[k] ?? 0) >= 50;/' src/bande.js
     ATTENDU="la bande dit les mêmes heures de pluie que la suite de la page" ;;
  10) # Le risque d'une période devient la moyenne de ses heures.
     perl -0pi -e 's/      pb: max\(k => s\.pb\[k\]\),/      pb: moy(k => s.pb[k]),/' src/ecritures.js
     ATTENDU="le risque d.une période est le plus fort de ses heures" ;;
  11) # L'heure touchée ne cale plus le ruban.
     perl -0pi -e 's/        Ruban\.poserHeure\(cible\);\n//' src/app.js
     ATTENDU="le ruban s.y cale sur l.heure touchée" ;;
  12) # Le retour renvoie en haut de l'accueil.
     perl -0pi -e 's/  rendre\(\);\n  window\.scrollTo\(\{ top: y, behavior: "instant" \}\);/  rendre();\n  window.scrollTo({ top: 0, behavior: "instant" });/' src/app.js
     ATTENDU="le retour ramène l.accueil à l.endroit quitté" ;;
  13) # Un onglet ne referme plus la page de détail.
     perl -0pi -e 's/  if \(detail\) detail = null;\n  onglet = nom;/  onglet = nom;/' src/app.js
     ATTENDU="un onglet referme la page de détail" ;;
  14) # Une lecture reste d'une ouverture précédente.
     perl -0pi -e 's/    if \(heure === null\) Ruban\.poserHeure\(-1\);\n//' src/app.js
     ATTENDU="sans heure désignée, aucune lecture ne reste d.une ouverture précédente" ;;
  15) # Le dessin revient à zéro avant le rendu : la saccade du glissement.
     perl -0pi -e 's/      deporter\(-reel \* LA\);/      deporter(0);/' src/ruban.js
     ATTENDU="au lâcher d.un glissement, le dessin reste là où le rendu le pose" ;;
  16) # La version du module n'est pas montée avec celle de la coque.
     perl -0pi -e 's/export const VERSION = "ma-meteo-v(\d+)";/export const VERSION = "ma-meteo-v1";/' src/version.js
     ATTENDU="le numéro de version est celui de la coque" ;;
  17) # Toute version publiée différente fait paraître l'offre, même plus ancienne.
     perl -0pi -e 's/p !== null && n !== null && p > n \? p : null/p !== null \&\& n !== null \&\& p !== n ? p : null/' src/version.js
     ATTENDU="une version plus ancienne publiée ne propose rien" ;;
  18) # La recherche ne se relance plus au retour au premier plan.
     perl -0pi -e 's/document\.addEventListener\("visibilitychange", \(\) => \{ if \(!document\.hidden\) chercherVersion\(\); \}\);//' src/app.js
     ATTENDU="une version plus récente publiée fait paraître l.offre de recharger" ;;
  19) # Le service worker repasse par le cache du navigateur.
     perl -0pi -e 's/fetch\(ev\.request, \{ cache: "no-cache" \}\)/fetch(ev.request)/' sw.js
     ATTENDU="le service worker redemande la coque sans le cache du navigateur" ;;
  20) # La découpe revient sur le groupe qui glisse, et glisse avec lui.
     perl -0pi -e 's/<g clip-path="url\(#\$\{id0\}\)"><g class="mg-mob">/<g><g class="mg-mob" clip-path="url(#\$\{id0\})">/' src/ruban.js
     ATTENDU="pendant le glissement, la suite du ruban paraît sous le doigt" ;;
  21) # La largeur du dessin redevient fixe : le paysage grossit tout.
     perl -0pi -e 's/  L = largeurVoulue\(\);/  L = L_PORTRAIT;/' src/ruban.js
     ATTENDU="le ruban garde en paysage la densité du portrait" ;;
  22) # Les portes repassent sur une colonne.
     perl -0pi -e 's/\.portes\{display:grid;grid-template-columns:1fr 1fr;/.portes{display:grid;grid-template-columns:1fr;/' styles.css
     ATTENDU="les quatre portes se rangent en grille de deux sur deux" ;;
  23) # Les portes remontent au-dessus des chiffres du jour.
     perl -0pi -e 's/    corps \+= `<div class="section" data-bloc="portes">\$\{portesHTML\}<\/div>`;\n//' src/app.js
     perl -0pi -e 's/(      \+ panneauPluieProche\(\)\n)/$1      + `<div class="section" data-bloc="portes">\$\{portesHTML\}<\/div>`\n/' src/app.js
     ATTENDU="les quatre portes ferment l.accueil, après demain et après-demain" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if diff -q "$OLD/src/bande.js" src/bande.js >/dev/null \
  && diff -q "$OLD/src/app.js" src/app.js >/dev/null \
  && diff -q "$OLD/styles.css" styles.css >/dev/null \
  && diff -q "$OLD/src/ecritures.js" src/ecritures.js >/dev/null \
  && diff -q "$OLD/src/ruban.js" src/ruban.js >/dev/null \
  && diff -q "$OLD/src/version.js" src/version.js >/dev/null \
  && diff -q "$OLD/sw.js" sw.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-bande-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
