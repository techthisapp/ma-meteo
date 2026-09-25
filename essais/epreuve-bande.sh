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
  1) # La bande descend sous les tuiles des paramètres.
     perl -0pi -e 's/        Bande\.bandeHoraire\(s, g\)\n        \+ \(lJour/        (lJour/' src/app.js
     perl -0pi -e 's/(          \+ `<\/div>` : ""\)), true\);/$1 + Bande.bandeHoraire(s, g), true);/' src/app.js
     ATTENDU="la bande horaire se pose sous les avis urgents, avant les tuiles et les portes" ;;
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
  8) # Les tuiles passent sur une colonne quelle que soit la taille du texte.
     perl -0pi -e 's/\@container \(max-width:18rem\)\{\n  \.bd-mesures\.tuiles\{/\@container (max-width:60rem){\n  .bd-mesures.tuiles{/' styles.css
     ATTENDU="les huit tuiles des paramètres se rangent sur deux colonnes" ;;
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
  24) # La tuile de l'air perd sa feuille.
     perl -0pi -e 's/"pas de mesure", "", null, "brume", "nuage", "air"\]/"pas de mesure", "", "air", "brume", "nuage", null]/' src/app.js
     ATTENDU="chaque tuile mène au détail de son paramètre" ;;
  25) # Le conseil ne se coupe plus en titre et précision.
     perl -0pi -e 's/    const m = \/\^\(\.\*\?\)\(\?:, \|\\\. \)\(\.\*\)\$\/\.exec\(phrase\);/    const m = null;/' src/conseils.js
     ATTENDU="un conseil se lit en deux lignes, titre et précision, avec son chevron" ;;
  26) # Les conseils perdent leur destination.
     perl -0pi -e 's/d = DESTINATIONS\[i\] \|\| null\) =>/d = null) =>/' src/conseils.js
     ATTENDU="chaque conseil de l.accueil mène au détail qu.il décrit" ;;
  27) # La journée entière retombe dans la forme mécanique.
     perl -0pi -e 's/  if \(ha === 0 && hb === 23 && ja === jb/  if (false \&\& ha === 0 \&\& hb === 23 \&\& ja === jb/' src/conseils.js
     ATTENDU="une journée entière se dit « toute la journée », avec l.élision" ;;
  28) # La flèche retrouve ses cent quatre-vingts degrés de trop.
     perl -0pi -e 's/export const angleFleche = d => \(\(Math\.round\(d\) % 360\) \+ 360\) % 360;/export const angleFleche = d => (((Math.round(d) + 180) % 360) + 360) % 360;/' src/fleche.js
     ATTENDU="la flèche du vent montre où il va" ;;
  29) # Les rafales paraissent à toute heure.
     perl -0pi -e 's/\$\{r >= SEUIL_RAFALES \? `raf\. \$\{r\}` : ""\}/raf. \$\{r\}/; s/const avecRafales = s\.raf\.slice\(0, n\)\.some\(r => \(r \?\? 0\) >= SEUIL_RAFALES\);/const avecRafales = true;/' src/bande.js
     ATTENDU="les rafales ne paraissent dans la bande que fortes" ;;
  30) # La colonne du moment présent perd son fond.
     perl -0pi -e 's/    \+ `<span class="bh-fond" aria-hidden="true"><\/span>`\n//' src/bande.js
     ATTENDU="la colonne du moment présent se détache, sous le titre « Maintenant et prochaines heures »" ;;
  31) # Un fichier listé deux fois dans la coque.
     perl -0pi -e 's/  "\.\/src\/fleche\.js",\n/  "\.\/src\/fleche\.js",\n  "\.\/src\/vent\.js",\n/' sw.js
     ATTENDU="la coque hors ligne ne liste aucun fichier deux fois" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if diff -q "$OLD/src/bande.js" src/bande.js >/dev/null \
  && diff -q "$OLD/src/app.js" src/app.js >/dev/null \
  && diff -q "$OLD/styles.css" styles.css >/dev/null \
  && diff -q "$OLD/src/ecritures.js" src/ecritures.js >/dev/null \
  && diff -q "$OLD/src/ruban.js" src/ruban.js >/dev/null \
  && diff -q "$OLD/src/version.js" src/version.js >/dev/null \
  && diff -q "$OLD/sw.js" sw.js >/dev/null \
  && diff -q "$OLD/src/conseils.js" src/conseils.js >/dev/null \
  && diff -q "$OLD/src/fleche.js" src/fleche.js >/dev/null; then
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
