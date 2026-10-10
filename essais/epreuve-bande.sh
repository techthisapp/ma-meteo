#!/bin/bash
# Épreuve des gardes de la bande horaire de l'accueil, jalon 10, lot 1.
# Usage : essais/epreuve-bande.sh <n>
set -u
# Le navigateur des contrôles : celui du poste de développement de claude.ai
# s'il existe, sinon celui que Playwright installe (npx playwright install
# chromium). Le chemin était écrit en dur jusqu'au 1er octobre 2026, ce qui
# empêchait les contrôles de démarrer ailleurs, sur un poste avec Claude Code.
if [ -z "${CHROMIUM:-}" ] && [ -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ]; then
  CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
fi
. "$(dirname "$0")/borne.sh"
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
JUSQUA="${JUSQUA_EPREUVE:-La bande horaire}"

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
     ATTENDU="chaque heure porte son symbole, son degré et son vent" ;;
  7) # Le ciel de l'accueil reprend sa hauteur d'origine.
     perl -0pi -e 's/\.plein-accueil \.ci\{aspect-ratio:390 \/ 250\}/.plein-accueil .ci{aspect-ratio:390 \/ 306}/' styles.css
     ATTENDU="le ciel de l.accueil est plus bas que celui des autres écrans" ;;
  8) # Les tuiles passent sur une colonne quelle que soit la taille du texte.
     perl -0pi -e 's/\@container \(max-width:18rem\)\{\n  \.bd-mesures\.tuiles\{/\@container (max-width:60rem){\n  .bd-mesures.tuiles{/' styles.css
     ATTENDU="les neuf tuiles des paramètres se rangent sur deux colonnes, l.eau sur toute la largeur" ;;
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
     perl -0pi -e 's/  if \(detail\) \{ detail = null; history\.back\(\); \}\n  onglet = nom;/  onglet = nom;/' src/app.js
     ATTENDU="un onglet referme la page de détail" ;;
  14) # Une lecture reste d'une ouverture précédente.
     perl -0pi -e 's/    if \(heure === null\) Ruban\.poserHeure\(-1\);\n//' src/app.js
     ATTENDU="sans heure désignée, aucune lecture ne reste d.une ouverture précédente" ;;
  15) # Retirée le 3 octobre 2026 : le glissement du ruban n'existe plus, jalon 21, lot 2.
     echo "ÉPREUVE 15 RETIRÉE : le glissement du ruban n'existe plus, jalon 21, lot 2."; exit 0 ;;
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
  20) # Retirée le 3 octobre 2026 : le glissement du ruban n'existe plus, jalon 21, lot 2.
     echo "ÉPREUVE 20 RETIRÉE : le glissement du ruban n'existe plus, jalon 21, lot 2."; exit 0 ;;
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
  32) # Le département n'est plus écrit.
     perl -0pi -e 's/  \$\("navLieuDep"\)\.textContent = nomDep \|\| "";\n//' src/app.js
     ATTENDU="l.en-tête porte le département sous la commune, sans grandir" ;;
  33) # Les cartes de l'accueil perdent leur arrondi. Depuis le jalon 12, lot 6,
     # toute carte le reçoit de la règle générale : les deux règles se retirent.
     perl -0pi -e 's/\[data-bloc\] \.carte,\.portes \.porte\{border-radius:var\(--rayon-carte\)\}//' styles.css
     perl -0pi -e 's/(\.carte,\.groupe\{\n  background:var\(--surface\);\n)  border-radius:var\(--rayon-carte\);\n/$1/' styles.css
     ATTENDU="les cartes de l.accueil prennent l.arrondi de 24 points" ;;
  34) # L'onglet « Le temps » revient dans la barre.
     perl -0pi -e 's/(  \["accueil", "maison", "Accueil"\],\n)/$1  ["temps", "horloge", "Le temps"],\n/' src/app.js
     ATTENDU="les destinations sont les bonnes" ;;
  35) # Le niveau de confiance ne paraît plus sur la ligne.
     perl -0pi -e 's/      \+ \(accord \? `<em class="sem-conf">/      + (false \&\& accord ? `<em class="sem-conf">/' src/vues/avenir.js
     ATTENDU="chaque journée à venir porte son niveau de confiance, en un mot" ;;
  36) # La barre ne s'estompe plus.
     perl -0pi -e 's/<s class="sem-plage\$\{accord \? ` sem-\$\{accord\}` : ""\}" `/<s class="sem-plage" `/' src/vues/avenir.js
     ATTENDU="la barre s.estompe aux journées moins sûres, et elles seules" ;;
  37) # La semaine perd son graphique.
     perl -0pi -e 's/    corps: grapheSemaine\(jours, boutonSemaine\(plusDispo\)\) \+ /    corps: boutonSemaine(plusDispo) + /' src/vues/avenir.js
     ATTENDU="La semaine s.ouvre sur son graphique, un point par journée" ;;
  38) # Les jours passés ne sont plus atténués dans le graphique.
     perl -0pi -e 's/  const fonds = jours\.map\(\(j, k\) => \(j\.passe \|\| j\.auj \|\| j\.tend\)/  const fonds = jours.map((j, k) => (j.auj || j.tend)/' src/vues/avenir.js
     ATTENDU="le graphique atténue les jours passés et repère aujourd.hui" ;;
  39) # Le graphique n'est plus borné en largeur.
     perl -0pi -e 's/\.sg\{display:block;width:100%;max-width:520px;margin:0 auto\}/.sg{display:block;width:100%;margin:0 auto}/' styles.css
     ATTENDU="le graphique borne sa largeur, et se résume en une phrase" ;;
  40) # La chaleur n'est plus relevée.
     perl -0pi -e 's/  if \(chaud\.tx >= SEUILS\.chaleur\) \{/  if (chaud.tx >= 99) {/' src/conseils.js
     ATTENDU="les grandes lignes disent l.orage, la chaleur et la pluie la plus forte, par gravité" ;;
  41) # Une semaine sans pluie ne se dit plus.
     perl -0pi -e 's/    dire\("soleil", 5, `Semaine sèche, aucune pluie notable d.ici \$\{jours\[jours\.length - 1\]\.nom\}\.`\);//' src/conseils.js
     ATTENDU="une semaine sans pluie se dit sèche" ;;
  42) # Le jour de l'orage se répète toujours.
     perl -0pi -e 's/mm attendus\$\{orages\.length > 1 \? ` \$\{o\.nom\}` : ""\}\./mm attendus \$\{o.nom\}./' src/conseils.js
     ATTENDU="un orage seul ne répète pas son jour" ;;
  43) # La journée ouvre le ruban sans le caler sur son minuit.
     perl -0pi -e 's/  Ruban\.glisser\(cible - Ruban\.decalageCourant\(\)\);\n//' src/app.js
     ATTENDU="une journée dépliée mène à ses heures, le ruban ouvert à son minuit" ;;
  44) # Le week-end n'est plus repéré.
     perl -0pi -e 's/\$\{weekEnd \? " sem-we" : ""\}//' src/vues/avenir.js
     ATTENDU="le week-end de La semaine se repère d.un fond léger, et lui seul" ;;
  45) # Les cartes reprennent l'ancien arrondi.
     perl -0pi -e 's/\.carte,\.groupe\{\n  background:var\(--surface\);\n  border-radius:var\(--rayon-carte\);/.carte,.groupe{\n  background:var(--surface);\n  border-radius:var(--rayon-lg);/' styles.css
     ATTENDU="toute carte prend l.arrondi de 24 points, Le ciel compris" ;;
  46) # Le symbole de rangée perd sa pastille.
     perl -0pi -e 's/  border-radius:var\(--rayon-md\);background:color-mix\(in srgb, currentColor 14%, transparent\);\n\}/  border-radius:var(--rayon-md);\n}/' styles.css
     ATTENDU="le premier symbole d.une rangée se pose dans une pastille, teintée du Soleil dans la course du jour" ;;
  47) # La part se compte à un degré près au lieu de deux.
     perl -0pi -e 's/part2: Math\.round\(d\.filter\(v => Math\.abs\(v\) <= 2\)/part2: Math.round(d.filter(v => Math.abs(v) <= 1)/' src/justesse.js
     ATTENDU="la justesse se calcule par échéance : écart, biais et part à 2° près" ;;
  48) # Une échéance paraît même sans assez de relevés.
     perl -0pi -e 's/export const COUPLES_MIN = 5;/export const COUPLES_MIN = 1;/' src/justesse.js
     ATTENDU="une échéance ne paraît qu.avec assez de relevés" ;;
  49) # Après-demain revient dans le bloc de l'accueil.
     perl -0pi -e 's/(    const lSuite = \[\n)/$1      ...((x => x ? conseils(x, { aujourdhui: cejour, decalage: restant + 24 }) : [])(P.serieHoraire(restant + 24, 24, 12))),\n/' src/app.js
     ATTENDU="l.accueil ne parle que de demain, après-demain restant dans La semaine" ;;
  50) # La phrase sur le délai revient dans la carte de la justesse.
     perl -0pi -e 's/  return tete \+ lignes\n/  return tete + `<p class="note">12 jours relevés, sur les 60 qui assiéront les chiffres.<\/p>` + lignes\n/' src/vues/feuilles.js
     ATTENDU="les réglages disent la justesse sans phrase sur le délai" ;;
  51) # Le plafond ne se peint plus : l'ancienne nappe floutée revient seule.
     perl -0pi -e 's/  if \(d\.nappe > 0 && fer > 0\) \{/  if (false \&\& d.nappe > 0 \&\& fer > 0) {/' src/temps.js
     ATTENDU="un ciel couvert se peint en bancs de nuages, de jour comme de nuit, et non en flou" ;;
  52) # Le plafond de jour reprend les teintes de nuit.
     perl -0pi -e 's/  const lourd = poids;/  const lourd = 1;/' src/temps.js
     ATTENDU="un couvert sec de plein jour reste clair, la pluie l.assombrit" ;;
  53) # Le voile du bas retrouve la moitié du cadre.
     perl -0pi -e 's/position:absolute;left:0;right:0;bottom:0;height:44%;z-index:1;/position:absolute;left:0;right:0;bottom:0;height:52%;z-index:1;/' styles.css
     ATTENDU="les voiles de lisibilité se resserrent sur le texte, en bleu-gris" ;;
  54) # La quantité de pluie ne s'écrit plus au-dessus des barres.
     perl -0pi -e 's/      \+ `<text class="sg-mm\$\{j\.passe \? " sg-p" : ""\}" x="\$\{x\(k\)\.toFixed\(1\)\}" y="\$\{\(pied - h - 3\)\.toFixed\(1\)\}">\$\{q\}<\/text>`;/      ;/' src/vues/avenir.js
     ATTENDU="la pluie du graphique porte sa quantité, en millimètres" ;;
  55) # La ligne du vent disparaît.
     perl -0pi -e 's/\+ fonds \+ pluie \+ vent \+ ligne/+ fonds + pluie + ligne/' src/vues/avenir.js
     ATTENDU="le graphique trace les rafales du jour, avec la flèche de leur direction" ;;
  56) # Le graphique tasse seize jours dans la largeur de l'écran.
     perl -0pi -e 's/  const defile = n > 10;/  const defile = n > 99;/' src/vues/avenir.js
     ATTENDU="sur seize jours, le graphique défile à colonnes fixes et nomme la seconde semaine" ;;
  57) # La confiance ne réunit plus les deux modèles.
     perl -0pi -e 's/const reunis = resume\(\[\.\.\.\(icon \? vi : \[\]\), \.\.\.\(ecmwf \? ve : \[\]\)\]\);/const reunis = resume(ecmwf ? ve : vi);/' src/scenarios.js
     ATTENDU="la confiance réunit les deux modèles où ils se recouvrent, ECMWF seul au-delà, rien après" ;;
  58) # Les seuils de l'ensemble horaire reviennent.
     perl -0pi -e 's/  \[4, "moyenne"\],\n  \[7, "faible"\],/  [3, "moyenne"],\n  [6, "faible"],/' src/scenarios.js
     ATTENDU="les seuils de la confiance quotidienne tombent à quatre et à sept degrés" ;;
  59) # La semaine ignore les scénarios quotidiens.
     perl -0pi -e 's/    const sc = prevue \? Scenarios\.jour\(dd\.time\[k\]\) : null;/    const sc = null;/' src/vues/avenir.js
     ATTENDU="La semaine tire sa confiance des deux modèles, et le volet les compare" ;;
  60) # Les scénarios quotidiens ne demandent plus que sept jours.
     # Sa garde est dans la section « Les scénarios » : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/^const JOURS = 15;/const JOURS = 7;/m' src/scenarios.js
     ATTENDU="les deux modèles se demandent ensemble, sur quinze jours" ;;
  61) # La phrase ne dit plus que les modèles s'écartent.
     perl -0pi -e 's/const accord = s\.ecart >= 2 \?/const accord = s.ecart >= 99 ?/' src/vues/avenir.js
     ATTENDU="la confiance dit quand les deux modèles s.écartent, et nomme ECMWF seul au-delà" ;;
  62) # La tendance ne voit plus les écarts de température.
     perl -0pi -e 's/const sens = ecart >= 2 \? "plus chaude" : ecart <= -2 \?/const sens = ecart >= 20 ? "plus chaude" : ecart <= -20 ?/' src/conseils.js
     ATTENDU="la semaine suivante se dit en une ligne de tendance, et seulement avec cinq jours" ;;
  63) # La tendance se colle à la charge sans écarter les dates déjà prévues.
     perl -0pi -e 's/  const plus = tend\.filter\(t => t\.date > dernier\);/  const plus = tend;/' src/vues/avenir.js
     ATTENDU="la tendance prolonge la charge quotidienne, sans doublon, le symbole tiré de la pluie" ;;
  64) # Le bouton « Voir plus » disparaît.
     perl -0pi -e 's/  const plusDispo = lim >= i;/  const plusDispo = false;/' src/vues/avenir.js
     ATTENDU="La semaine se déplie d.un « Voir plus » commun au graphique et à la liste, jusqu.à la tendance" ;;
  65) # Une journée de tendance affiche une moyenne de pluie.
     perl -0pi -e 's/    const eau = k >= nPrev \? \(pb >= SEUILS\.risque/    const eau = false ? (pb >= SEUILS.risque/' src/vues/avenir.js
     ATTENDU="une journée de tendance dit la part de ses scénarios pluvieux, sans mot de confiance" ;;
  66) # Le plafond se cale de nouveau au point entier.
     perl -0pi -e 's/    const dx = \(\(t \* derive \* 0\.22\) % larg\) - larg;/    const dx = Math.round(((t * derive * 0.22) % larg) - larg);/' src/temps.js
     ATTENDU="le plafond du ciel couvert avance à chaque image, sans à-coup" ;;
  67) # L'onglet reprend son ancien nom.
     perl -0pi -e 's/  \["semaine", "semaine", "À venir"\],/  ["semaine", "semaine", "La semaine"],/' src/app.js
     ATTENDU="l.onglet des jours à venir s.appelle « À venir »" ;;
  68) # La rangée prise ne suit plus le doigt.
     # Sa garde est dans une section plus loin : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/    const suivre = \(\) => \{ el\.style\.transform = [^\n]*\n/    const suivre = () => {};\n/' src/vues/lieux.js
     ATTENDU="la rangée prise suit le doigt" ;;
  69) # La page reprend son ancien nom.
     perl -0pi -e 's/titre: "Heure par heure"/titre: "Le temps"/g' src/vues/heures.js
     ATTENDU="la page des heures s.appelle « Heure par heure »" ;;
  70) # Le bandeau ne colle plus.
     perl -0pi -e 's/  position:sticky;top:calc\(env\(safe-area-inset-top, 0px\) \+ var\(--nav-haut\)\);z-index:3;/  position:relative;z-index:3;/' styles.css
     ATTENDU="un bandeau collant porte le jour et les heures, et glisse avec le ruban" ;;
  71) # Retirée le 3 octobre 2026 : le calque de minuit a disparu en version 160 ; l'erreur 283 éprouve son retour.
     echo "ÉPREUVE 71 RETIRÉE : le calque de minuit a disparu en version 160 ; l'erreur 283 éprouve son retour."; exit 0 ;;
  72) # La semaine commence le dimanche.
     perl -0pi -e 's/  const decal = \(d\.getDay\(\) \+ 6\) % 7;/  const decal = d.getDay();/' src/comparaison.js
     ATTENDU="la semaine va du lundi au dimanche, un 29 février devient le 28" ;;
  73) # La pluie se juge à la moindre différence.
     perl -0pi -e 's/    : Math\.abs\(p1 - p2\) >= seuilPluie\(avecPluie\.length\)/    : Math.abs(p1 - p2) >= 0.5/' src/comparaison.js
     ATTENDU="le bilan de la comparaison dit l.écart de température, et la pluie au-delà de dix millimètres" ;;
  74) # La carte de la comparaison n'est plus branchée.
     # Sa garde est dans la section du climat : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/      brancherComparaison\(bloc\.querySelector\("#clComparer"\), bloc, g, c, date\);\n//' src/vues/climat.js
     ATTENDU="la feuille du climat compare les 7 derniers jours aux mêmes jours de l.an dernier, dans l.archive" ;;
  75) # Une semaine sans pluie notable nomme quand même un lieu arrosé.
     perl -0pi -e 's/: arrose\.mm < 1 \? `sec partout/: arrose.mm < 0 ? `sec partout/' src/comparaison.js
     ATTENDU="les lieux se demandent ensemble, et une semaine sans pluie notable se dit sèche partout" ;;
  76) # Tous les lieux reçoivent la charge du premier.
     # Sa garde est dans la section du climat : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/journeesDe\(tab\[k\]\?\.daily\)/journeesDe(tab[0]?.daily)/' src/comparaison.js
     ATTENDU="la feuille du climat compare les 7 derniers jours entre lieux suivis, en une requête à l.archive" ;;
  77) # Les périodes passées finissent aujourd'hui au lieu d'hier.
     perl -0pi -e 's/x\.setDate\(d\.getDate\(\) \+ \(passe \? -\(n - k\) : k \+ 1\)\);/x.setDate(d.getDate() + (passe ? -(n - 1 - k) : k + 1));/' src/comparaison.js
     ATTENDU="le passé finit hier, l.avenir commence demain, et le seuil de la pluie croît avec la durée" ;;
  78) # Le seuil de la pluie reste celui d'une semaine.
     perl -0pi -e 's/export const seuilPluie = n => Math\.round\(10 \* Math\.sqrt\(n \/ 7\)\);/export const seuilPluie = () => 10;/' src/comparaison.js
     ATTENDU="le passé finit hier, l.avenir commence demain, et le seuil de la pluie croît avec la durée" ;;
  79) # Le choix de la période n'est plus écouté.
     # Sa garde est dans la section du climat : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/    cmp\.querySelector\("\.cmp-p-temps"\)\.addEventListener\("change", e => \{ periodeTemps = e\.target\.value; montrer\(\); \}\);\n//' src/vues/climat.js
     ATTENDU="une période passée se lit dans l.archive jusqu.à hier, une période à venir dans la prévision dès demain" ;;
  80) # Les lieux du passé se lisent dans la prévision.
     # Sa garde est dans la section du climat : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/Comparaison\.lireLieux\(lieux, dates, Comparaison\.estPassee\(periodeLieux\)\)/Comparaison.lireLieux(lieux, dates, false)/' src/vues/climat.js
     ATTENDU="la feuille du climat compare les 7 derniers jours entre lieux suivis, en une requête à l.archive" ;;
  81) # Une station a son pied au-dessus de son sommet.
     perl -0pi -e 's/\["Megève", "FR", 45\.8544, 6\.6575, 820, 2371,/["Megève", "FR", 45.8544, 6.6575, 2371, 820,/' src/stations.js
     ATTENDU="la liste des stations couvre la France et ses voisins, le pied sous le sommet, rangées sous leur domaine" ;;
  84) # Les stations ne sont plus rangées sous les Trois Vallées.
     perl -0pi -e 's/, "Les Trois Vallées"\]/, null]/g' src/stations.js
     ATTENDU="la liste des stations couvre la France et ses voisins, le pied sous le sommet, rangées sous leur domaine" ;;
  82) # Une station à dix heures de route passe pour proche.
     perl -0pi -e 's/^export const MINUTES_MAX = 60;/export const MINUTES_MAX = 600;/m' src/trajets.js
     ATTENDU="les stations proches sont celles à une heure de route, en une requête à OSRM" ;;
  83) # Sans OSRM, plus aucune station.
     perl -0pi -e 's/  \} catch \{\n    return cands\.filter\(p => p\.vol <= KM_PAR_HEURE_ESTIMEE\)/  } catch {\n    return [];\n    return cands.filter(p => p.vol <= KM_PAR_HEURE_ESTIMEE)/' src/trajets.js
     ATTENDU="sans réponse d.OSRM, une estimation à vol d.oiseau prend le relais, marquée comme telle" ;;
  85) # Une chute ordinaire passe pour notable.
     perl -0pi -e 's/if \(\(trois >= 20 \|\| jourMax >= 10\)/if ((trois >= 2 || jourMax >= 1)/' src/neige.js
     ATTENDU="une chute notable se dit à la station où il en tombera le plus, un temps calme se tait" ;;
  86) # La porte de la neige paraît toute l'année.
     perl -0pi -e 's/  if \(m >= 11 \|\| m <= 4\) return true;/  return true;/' src/neige.js
     ATTENDU="la saison de la neige va de novembre à avril, et au-delà tant que la neige tient" ;;
  87) # La porte large disparaît de l'accueil.
     perl -0pi -e 's/      \+ \(saisonNeige \? `<button type="button" class="carte rangee porte porte-large"/      + (false \&\& saisonNeige ? `<button type="button" class="carte rangee porte porte-large"/' src/app.js
     ATTENDU="en saison, une porte large mène à la neige, au-dessus de la grille, et une chute notable se dit en tête" ;;
  88) # La neige fraîche ne compte plus que les dernières 24 heures.
     perl -0pi -e 's/h\.snowfall\.slice\(Math\.max\(0, k - 71\), k \+ 1\)/h.snowfall.slice(Math.max(0, k - 23), k + 1)/' src/neige.js
     ATTENDU="la neige d.un point se résume : au sol, fraîche sur 24 et 72 heures, chutes à venir, isotherme, rafales" ;;
  89) # Les noms des plages reviennent en capitales.
     perl -0pi -e 's/\["Côte des Basques", "FR"/["COTE DES BASQUES", "FR"/' src/plages.js
     ATTENDU="la liste des plages couvre la France et ses côtes voisines, chaque plage française située, les noms lisibles" ;;
  90) # Une plage à dix heures de route passe pour proche.
     perl -0pi -e 's/^export const MINUTES_MAX = 60;/export const MINUTES_MAX = 600;/m' src/trajets.js
     ATTENDU="les plages proches sont celles à une heure de route, en une requête à OSRM" ;;
  91) # Les durées d'OSRM se décalent d'une destination.
     perl -0pi -e 's/\(durees\[k \+ 1\] == null \? null : Math\.round\(durees\[k \+ 1\] \/ 60\)\)/(durees[k] == null ? null : Math.round(durees[k] \/ 60))/' src/trajets.js
     ATTENDU="les plages proches sont celles à une heure de route, en une requête à OSRM" ;;
  92) # L'extrême de la marée reste calé sur l'heure.
     perl -0pi -e 's/    const dx = courbe \? \(a - c\) \/ \(2 \* courbe\) : 0;/    const dx = 0;/' src/plage.js
     ATTENDU="les marées se situent entre deux heures, pleines et basses mers avec leur hauteur" ;;
  93) # La porte de la plage paraît toute l'année.
     perl -0pi -e 's/  if \(m >= 6 && m <= 9\) return true;/  return true;/' src/plage.js
     ATTENDU="la saison de la plage va de juin à septembre, et au-delà tant que l.eau dépasse 20°" ;;
  94) # Le classement se lit de travers.
     perl -0pi -e 's/const QUALITES = \{ 0: "non classée", 1: "excellente", 2: "bonne"/const QUALITES = { 0: "non classée", 1: "bonne", 2: "excellente"/' src/plage.js
     ATTENDU="la feuille de la plage dit les marées, le marnage, la qualité de l.eau classée et mène à la fiche du ministère" ;;
  95) # La porte de la plage disparaît de l'accueil.
     perl -0pi -e 's/      \+ \(saisonPlage \? `<button type="button" class="carte rangee porte porte-large" data-feuille="plage">`/      + (false \&\& saisonPlage ? `<button type="button" class="carte rangee porte porte-large" data-feuille="plage">`/' src/app.js
     ATTENDU="en saison, une porte large mène à la plage, avec l.eau et les vagues" ;;
  96) # Des vagues de plus d'un mètre et demi ne gênent plus la baignade.
     perl -0pi -e 's/export const SEUILS_BAIN = \{ air: 20, eau: 16, vagues: 1\.5,/export const SEUILS_BAIN = { air: 20, eau: 16, vagues: 15,/' src/plage.js
     ATTENDU="un créneau de baignade est la plus longue suite d.heures favorables, ou dit ce qui l.empêche" ;;
  97) # Le vent perd sa préposition.
     perl -0pi -e 's/  const dit = \/\^\(est\|ouest\)\$\/\.test\(c\) \? `de l.\$\{c\}` : `du \$\{c\}`;/  const dit = c;/' src/plage.js
     ATTENDU="le vent de la plage se dit par sa direction" ;;
  98) # La crise ne se range plus.
     perl -0pi -e 's/export const NIVEAUX = \["vigilance", "alerte", "alerte_renforcee", "crise"\];/export const NIVEAUX = ["vigilance", "alerte", "alerte_renforcee"];/' src/vigieau.js
     ATTENDU="les restrictions d.eau se rangent de la vigilance à la crise" ;;
  99) # La couche des restrictions d'eau n'est plus tracée.
     # Sa garde est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/const COUCHES = \[coucheEau, coucheVigiFond,/const COUCHES = [coucheVigiFond,/' src/vues/carte-couches.js
     ATTENDU="la nappe des restrictions d.eau teinte les départements en restriction, et eux seuls" ;;
  100) # Une nappe au plus haut se dit très basse.
     perl -0pi -e 's/\[0\.9, "haute"\], \[1\.01, "très haute"\]\]/[0.9, "haute"], [1.01, "très basse"]]/' src/eau.js
     ATTENDU="l.état d.une nappe se lit par la part des années plus basses, dix années au moins" ;;
  101) # Un piézomètre qui ne mesure plus peut être retenu.
     perl -0pi -e 's/ && \(s\.date_fin_mesure \|\| ""\) >= iso\(recent\)//' src/eau.js
     ATTENDU="le piézomètre retenu mesure depuis quinze ans et a une mesure récente, le plus proche" ;;
  102) # La tuile de l'eau disparaît.
     perl -0pi -e 's/      \.\.\.\(Eau\.tuileEau\(ez\) \?/      ...(false \&\& Eau.tuileEau(ez) ?/' src/app.js
     ATTENDU="la tuile de l.eau dit la restriction et la nappe, et une alerte se dit parmi les conseils" ;;
  103) # Une restriction en alerte ne se dit plus parmi les conseils.
     perl -0pi -e 's/if \(rEau && rEau\.rang >= 2\)/if (rEau \&\& rEau.rang >= 5)/' src/app.js
     ATTENDU="la tuile de l.eau dit la restriction et la nappe, et une alerte se dit parmi les conseils" ;;
  104) # La station la plus proche est retenue même sans débit.
     perl -0pi -e 's/    if \(!Q\.length && !repli\) \{/    if (false) {/; s/    if \(!Q\.length\) continue;\n//' src/eau.js
     ATTENDU="la rivière retenue mesure le débit, et la feuille dit sa hauteur, sa tendance et sa situation" ;;
  105) # Un débit au plus bas se dit normal.
     perl -0pi -e 's/\[\[0\.1, "très bas"\], \[0\.2, "bas"\]/[[0.1, "normal"], [0.2, "bas"]/' src/eau.js
     ATTENDU="la situation d.un débit se lit par la part des années plus basses, et la tendance de la hauteur à deux centimètres près" ;;
  106) # L'étiage compte toutes les campagnes, pas seulement la dernière.
     perl -0pi -e 's/  const campagne = l\.filter\(o => o\.date_observation === date\);/  const campagne = l;/' src/eau.js
     ATTENDU="l.étiage se résume par la dernière campagne, chaque point à sa dernière observation" ;;
  107) # La température de l'eau ne se dit plus.
     perl -0pi -e 's/    \+ \(t \? `<p class="pl-lieu">Eau de la rivière/    + (false \&\& t ? `<p class="pl-lieu">Eau de la rivière/' src/vues/loisirs.js
     ATTENDU="la feuille de l.eau dit l.étiage de la dernière campagne et la température récente de la rivière" ;;
  108) # Le plafond nuageux se pose en tuiles étroites qui ne se raccordent pas.
     # Sa vérification est dans la section du suivi de la position : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/    const larg = Math\.round\(haut \* \(pf\.width \/ pf\.height\)\);/    const larg = Math.round(haut * (pf.width \/ pf.height) \/ 4);/; s/bx\.drawImage\(pf, larg \* i, 0, larg \+ 1, haut\);/bx.drawImage(pf, 0, 0, pf.width \/ 2, pf.height, larg * i, 0, larg + 1, haut);/' src/temps.js
     ATTENDU="la couche se répète sans couture verticale" ;;
  109) # Il faudrait cinquante millimètres attendus pour renoncer à arroser.
     perl -0pi -e 's/  if \(sol\.pluie3 >= 5\) return/  if (sol.pluie3 >= 50) return/' src/eau.js
     ATTENDU="l.humidité du sol se classe, et le conseil d.arrosage suit la pluie attendue, la sécheresse et la restriction" ;;
  110) # Le conseil d'arrosage ne se dit plus dans la feuille.
     perl -0pi -e 's/    \+ `<p class="pl-lieu">\$\{esc\(Eau\.conseilArrosage\(s, r\)\)\}<\/p>`;/    + "";/' src/vues/loisirs.js
     ATTENDU="la feuille de l.eau dit l.humidité du sol, la semaine écoulée, la pluie attendue et le conseil d.arrosage" ;;
  111) # Les étiquettes des prévisions ne s'effacent plus quand elles se chevauchent.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/      el\.hidden = dehors \|\| serre;/      el.hidden = dehors;/' src/vues/carte-etiquettes.js
     ATTENDU="les prévisions des villes se posent sur la carte sans se chevaucher, au moment en cours" ;;
  112) # L'après-midi prend 15 h au lieu du maximum.
     perl -0pi -e 's/  const valeur = moment === "apres" \? Math\.max\(\.\.\.temps\) : h\.temperature_2m\[kr\];/  const valeur = h.temperature_2m[kr];/' src/villes.js
     ATTENDU="le temps d.une ville se lit pour chaque moment : 9 h, le maximum de l.après-midi, 21 h, le lendemain" ;;
  113) # Les plages de la carte ne s'espacent plus.
     perl -0pi -e 's/if \(out\.every\(q => distanceKm\(p\.lat, p\.lon, q\.lat, q\.lon\) >= ecart\)\) out\.push\(p\);/out.push(p);/' src/plage.js
     ATTENDU="les plages de la carte s.espacent de soixante kilomètres, les grands domaines de vingt-cinq, les plus grands d.abord" ;;
  114) # Les domaines sans neige portent une étiquette à 0 cm.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/neigeLue\.filter\(s => s\.sol > 0\)\.map/neigeLue.map/' src/vues/carte-etiquettes.js
     ATTENDU="la mer et la neige se posent sur la carte avant les prévisions, sans chevauchement, sources citées" ;;
  115) # Les prévisions passent avant la mer et la neige.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/zonePrev\.innerHTML = neiges \+ mers \+ rivs \+ previs;/zonePrev.innerHTML = previs + neiges + mers + rivs;/' src/vues/carte-etiquettes.js
     ATTENDU="la mer et la neige se posent sur la carte avant les prévisions, sans chevauchement, sources citées" ;;
  116) # Les cours d'eau se lisent sur la France entière.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/const ZOOM_RIVIERES = 7\.5;/const ZOOM_RIVIERES = 0;/' src/vues/carte-etiquettes.js
     ATTENDU="les cours d.eau ne se lisent qu.en zoomant, et chaque station dit sa hauteur et sa tendance" ;;
  117) # L'écart d'une station se lit à l'envers.
     perl -0pi -e 's/    ecart: e\.recent\.resultat_obs - e\.ancien\.resultat_obs \}\)\);/    ecart: e.ancien.resultat_obs - e.recent.resultat_obs }));/' src/eau.js
     ATTENDU="les cours d.eau d.un cadre se regroupent par station, la hauteur la plus récente et l.écart sur six heures" ;;
  118) # L'ouverture en attente ne regarde plus si la feuille a été refermée.
     perl -0pi -e 's/      if \(vueCourante === null\) return;\n      \$\("voile"\)\.classList\.add/      \$("voile").classList.add/' src/app.js
     ATTENDU="une feuille refermée avant sa première image reste fermée, et rouverte pendant sa fermeture reste ouverte" ;;
  119) # L'ouverture se juge de nouveau sur l'attribut hidden.
     perl -0pi -e 's/  if \(!dejaOuverte\) \{/  if (\$("feuille").hidden) {/' src/app.js
     ATTENDU="une feuille refermée avant sa première image reste fermée, et rouverte pendant sa fermeture reste ouverte" ;;
  120) # La carte des réglages reprend l'ancien nom de la page.
     perl -0pi -e 's/<h3>Écriture de la page « Heure par heure »<\/h3>/<h3>Écriture de l\x27écran Le temps<\/h3>/' src/vues/feuilles.js
     ATTENDU="les réglages nomment l.écriture de la page « Heure par heure »" ;;
  121) # Toute tuile qui ouvre une feuille annonce de nouveau l'air qu'on respire.
     perl -0pi -e 's/\$\{esc\(e\)\}, \$\{TUILE_VERS\[feuille\]\}">/\$\{esc(e)\}, voir l\x27air qu\x27on respire">/' src/app.js
     ATTENDU="une tuile qui ouvre une feuille dit au lecteur d.écran celle qu.elle ouvre" ;;
  122) # L'application interroge un hôte qu'aucune route d'essai ne sert.
     perl -0pi -e 's/\z/\nfetch("https:\/\/exemple.invalid\/fuite").catch(() => {});\n/' src/app.js
     ATTENDU="aucune requête ne sort vers le vrai réseau" ;;
  123) # Les réponses d'Open-Meteo ne sont plus recalées sur l'heure de Paris.
     perl -0pi -e 's/if \(r\.ok\) return recaler\(await r\.json\(\)\);/if (r.ok) return await r.json();/' src/previsions.js
     ATTENDU="une prévision lue en heure d.été se lit à l.heure de Paris après le passage à l.heure d.hiver" ;;
  124) # Les quatre moments exigent de nouveau six heures par tranche.
     perl -0pi -e 's/if \(lots\.some\(\(l, q\) => l\.length !== attendues\[q\]\)\) return null;/if (lots.some(l => l.length !== 6)) return null;/' src/previsions.js
     ATTENDU="le jour du passage à l.heure d.été porte vingt-trois heures et ouvre ses quatre moments" ;;
  125) # L'heure en double du passage à l'heure d'hiver n'est plus retirée.
     perl -0pi -e 's/if \(!vus\.has\(t\)\) \{ vus\.add\(t\); garder\.push\(i\); \}/garder.push(i);/' src/horloge.js
     ATTENDU="une prévision lue en heure d.été se lit à l.heure de Paris après le passage à l.heure d.hiver" ;;
  126) # Hors connexion, la prévision gardée n'est plus servie.
     perl -0pi -e 's/if \(gardee\) \{ charge = gardee\.d; heureCharge = gardee\.h; return charge; \}/if (false) { }/' src/previsions.js
     ATTENDU="hors connexion, la dernière prévision gardée pour le lieu reste servie" ;;
  127) # Le retour dans l'application ne relit plus rien après un échec.
     perl -0pi -e 's/if \(!enEchec && \(heureCharge === null \|\| heureCharge === heureCle\(\)\)\) return;/if (heureCharge === null || heureCharge === heureCle()) return;/' src/previsions.js
     ATTENDU="après un premier chargement manqué, le retour dans l.application relit la prévision" ;;
  128) # Une réponse tardive remplace de nouveau la prévision.
     perl -0pi -e 's/    if \(moi !== demande\) return null;\n    \/\* La reprise/    \/* La reprise/' src/previsions.js
     ATTENDU="une réponse lente de la commune précédente n.écrase pas la prévision de la suivante" ;;
  129) # La prévision de la commune précédente n'est plus oubliée.
     perl -0pi -e 's/if \(lieuCharge !== lieu\) \{ charge = null; lieuCharge = lieu; \}/if (lieuCharge !== lieu) { lieuCharge = lieu; }/' src/previsions.js
     ATTENDU="une commune demandée oublie aussitôt la prévision de la précédente" ;;
  130) # L'air accepte de nouveau une réponse tardive.
     perl -0pi -e 's/  if \(cleChargee !== cle\) return null;\n  charge = d;/  charge = d;/' src/air.js
     ATTENDU="l.air, l.ensemble et les scénarios d.une commune précédente ne reparaissent pas sous la suivante" ;;
  131) # L'ensemble accepte de nouveau une réponse tardive.
     perl -0pi -e 's/  if \(cleChargee !== cle\) return null;\n  charge = d;/  charge = d;/' src/ensemble.js
     ATTENDU="l.air, l.ensemble et les scénarios d.une commune précédente ne reparaissent pas sous la suivante" ;;
  132) # Les scénarios acceptent de nouveau une réponse tardive.
     perl -0pi -e 's/  if \(cleChargee !== cle\) return null;\n  if \(!icon && !ecmwf\)/  if (!icon && !ecmwf)/' src/scenarios.js
     ATTENDU="l.air, l.ensemble et les scénarios d.une commune précédente ne reparaissent pas sous la suivante" ;;
  133) # Une panne de VigiEau se lit de nouveau comme une liste vide.
     perl -0pi -e 's/\.then\(r => \(r\.ok \? r\.json\(\) : null\)\)/.then(r => (r.ok ? r.json() : []))/' src/eau.js
     ATTENDU="une panne de VigiEau ne se lit pas comme une absence de restriction" ;;
  134) # Les mêmes dates réécrivent de nouveau l'année de chaque date.
     perl -0pi -e 's/const an = a \+ ecart;/const an = annee;/' src/comparaison.js
     ATTENDU="une période qui chevauche le 1er janvier garde ses deux années dans une autre année" ;;
  135) # Une installation incomplète active de nouveau la version.
     perl -0pi -e 's/(cache: "reload" \}\)\)\)\)\n      \.then\(\(\) => self\.skipWaiting\(\)\)),/$1\n      .catch(() => self.skipWaiting()),/' sw.js
     ATTENDU="une installation incomplète ne remplace pas la version en place" ;;
  136) # Le ciel des étoiles quitte la copie hors ligne.
     perl -0pi -e 's/  "\.\/donnees\/ciel\.json",\n//' sw.js
     ATTENDU="la copie hors ligne garde le ciel des étoiles et les icônes" ;;
  137) # Toute requête reçoit de nouveau la page en secours.
     perl -0pi -e 's/if \(navigation\) \{\n      const page/if (true) {\n      const page/' sw.js
     ATTENDU="hors connexion, l.application se recharge et seule une navigation reçoit la page en secours" ;;
  138) # Une adresse à paramètres entre de nouveau dans la copie.
     perl -0pi -e 's/if \(r\.ok && !r\.redirected && !u\.search\) \{/if (r.ok \&\& !r.redirected) {/' sw.js
     ATTENDU="une adresse à paramètres n.entre pas dans la copie hors ligne" ;;
  139) # La position publique garde de nouveau le dix-millième de degré.
     perl -0pi -e 's/export const envoi = v => Math\.round\(v \* 100\) \/ 100;/export const envoi = v => Math.round(v * 10000) \/ 10000;/' src/reglages.js
     ATTENDU="les services ne reçoivent que la position arrondie" ;;
  140) # Le service d'adresses reçoit de nouveau le relevé précis.
     perl -0pi -e 's/const lat = Math\.round\(latBrute \* 1000\) \/ 1000, lon = Math\.round\(lonBrute \* 1000\) \/ 1000;/const lat = latBrute, lon = lonBrute;/' src/reglages.js
     ATTENDU="les services ne reçoivent que la position arrondie" ;;
  141) # Les réglages prétendent de nouveau qu'aucune donnée n'est envoyée.
     perl -0pi -e 's/Aucun compte, aucune base de données\. Pour lire/Aucun compte, aucune base de données, aucune donnée envoyée. Pour lire/' src/vues/feuilles.js
     ATTENDU="les réglages disent quels services reçoivent le lieu affiché" ;;
  142) # Les caches par lieu ne sont plus plafonnés.
     perl -0pi -e 's/\.sort\(\(a, b\) => b\[1\]\.t - a\[1\]\.t\)\.slice\(0, ENTREES_MAX\);/.sort((a, b) => b[1].t - a[1].t);/' src/horloge.js
     ATTENDU="les caches par lieu oublient les entrées périmées et n.en gardent que vingt" ;;
  143) # Les caches par lieu gardent de nouveau les entrées périmées.
     perl -0pi -e 's/maintenant - e\.t < garde\)/true)/' src/horloge.js
     ATTENDU="les caches par lieu oublient les entrées périmées et n.en gardent que vingt" ;;
  144) # Le bouton d'effacement n'efface plus rien.
     perl -0pi -e 's/if \(k\.startsWith\("mameteo\."\)\) localStorage\.removeItem\(k\);/if (false) { }/' src/vues/feuilles.js
     ATTENDU="le bouton d.effacement retire les données de l.application, et elles seules" ;;
  145) # Un lien venu d'un service entre de nouveau quel que soit son protocole.
     perl -0pi -e 's/return x\.protocol === "https:" \? x\.href : null;/return x.href;/' src/eau.js
     ATTENDU="un lien venu d.un service n.entre dans la page qu.en https" ;;
  146) # La température de l'accueil se lit de nouveau sans sa valeur.
     perl -0pi -e 's/aria-label="\$\{Math\.round\(t\)\} degrés, voir heure par heure"/aria-label="Température, voir les vingt-quatre heures"/' src/app.js
     ATTENDU="la température et le ciel de l.accueil se lisent avec leur valeur" ;;
  147) # La vigilance ne nomme plus ses phénomènes.
     perl -0pi -e 's/\.\.\.\(enCours \? v\.alertes : v\.annonces\)\n      \.map\(a => `\$\{a\.nom\}/...[]\n      .map(a => `\${a.nom}/' src/app.js
     ATTENDU="la vigilance nomme ses phénomènes aux lecteurs d.écran" ;;
  148) # Les heures de la bande reprennent le rôle d'élément de liste.
     perl -0pi -e 's/\+ `data-detail="t" data-heure=/+ `role="listitem" data-detail="t" data-heure=/' src/bande.js
     ATTENDU="les heures de la bande restent des boutons et disent leur ciel" ;;
  149) # Les heures de la bande ne disent plus leur ciel.
     perl -0pi -e 's/, \$\{tempsDe\(s\.code\[k\]\)\[1\]\.toLowerCase\(\)\}, \$\{t\} degrés/, \${t} degrés/' src/bande.js
     ATTENDU="les heures de la bande restent des boutons et disent leur ciel" ;;
  150) # La colonne du ciel perd son texte lu.
     perl -0pi -e 's/\n    \+ `<span class="titre-lu">\$\{esc\(tempsDe\(s\.code\)\[1\]\)\}<\/span>`\],/],/' src/ecritures.js
     ATTENDU="la colonne du ciel se lit dans le tableau des heures" ;;
  151) # Les journées d'À venir ne nomment plus leurs bornes.
     perl -0pi -e 's/<span class="titre-lu">minimum<\/span>//' src/vues/avenir.js
     ATTENDU="chaque journée d.À venir dit son ciel et nomme ses bornes" ;;
  152) # Le texte tertiaire reprend son gris clair.
     perl -0pi -e 's/--etiquette-3:#646F7A;/--etiquette-3:#8B97A2;/' styles.css
     ATTENDU="le texte tertiaire et le bleu de la pluie atteignent 4,5 de contraste dans les deux thèmes" ;;
  153) # Le bleu de la pluie écrit en texte reprend le bleu des icônes.
     perl -0pi -e 's/--pluie-texte:#2C6BA6;/--pluie-texte:#3B82C4;/' styles.css
     ATTENDU="le texte tertiaire et le bleu de la pluie atteignent 4,5 de contraste dans les deux thèmes" ;;
  154) # Les puces de la comparaison perdent leur zone de toucher.
     perl -0pi -e 's/\n\.cmp-puce::after,\.ca-moments button::after\{/\n.ca-moments button::after{/' styles.css
     ATTENDU="les petites commandes offrent 44 points au doigt" ;;
  155) # Le manifeste décrit de nouveau la table de la semaine.
     perl -0pi -e 's/"description": "Prévision heure par heure et à seize jours/"description": "Prévision horaire, table de la semaine/' manifest.webmanifest
     ATTENDU="la page et le manifeste se décrivent avec les noms d.écrans actuels" ;;
  156) # Une source secondaire redessine de nouveau tout l'écran sans attendre.
     perl -0pi -e 's/if \(mien !== generation \|\| !d\) return;\n  rafraichir\(\);/if (mien !== generation || !d) return;\n  rendre();\n  if (vueCourante) rendreFeuille();/' src/app.js
     ATTENDU="les sources secondaires passent par le rendu regroupé" ;;
  157) # L'écouteur précédent de la carte n'est plus retiré.
     perl -0pi -e 's/  if \(avant\) window\.removeEventListener\("resize", avant\);\n//' src/vues/communs.js
     ATTENDU="la carte redessinée ne multiplie pas ses écouteurs" ;;
  158) # La carte reprend la densité entière de l'écran.
     perl -0pi -e 's/const dpr = Math\.min\(2, window\.devicePixelRatio \|\| 1\);/const dpr = window.devicePixelRatio || 1;/' src/carte.js
     ATTENDU="toute toile plafonne sa densité à 2" ;;
  159) # La grille de la carte n'est plus relue sur l'appareil.
     perl -0pi -e 's/  if \(!garde\) garde = lireGarde\(CACHE\);\n//' src/nappe.js
     ATTENDU="la grille de la carte se garde sur l.appareil après un relancement" ;;
  160) # Le ciel animé continue hors de l'écran.
     perl -0pi -e 's/if \(horsEcran\) arreter\(\); else relancer\(\);/relancer();/' src/temps.js
     ATTENDU="le ciel animé s.arrête hors de l.écran et reprend à son retour" ;;
  161) # Un retour au premier plan relance une boucle même si une tourne déjà.
     perl -0pi -e 's/ \|\| horsEcran \|\| boucle !== null\) return;/ || horsEcran) return;/' src/temps.js
     ATTENDU="un retour au premier plan ne lance pas de seconde boucle d.animation" ;;
  162) # La série de secours s'écrit de nouveau entière sur l'appareil.
     perl -0pi -e 's/  if \(!b\) return c;\n  return \{ \.\.\.c, horaireSecours/  return c;\n  return { ...c, horaireSecours/' src/previsions.js
     ATTENDU="la série de secours ne garde sur l.appareil que les colonnes relues" ;;
  163) # Un bulletin de vigilance n'est plus relu sur l'appareil.
     perl -0pi -e 's/const garde = gardes\.get\(cle\) \|\| lireGardee\(CACHE, cle, 2 \* 86400 \* 1000\);/const garde = gardes.get(cle);/' src/vigilance.js
     ATTENDU="un bulletin de vigilance lu n.est pas relu après un relancement" ;;
  164) # La neige lue n'est plus relue sur l'appareil.
     perl -0pi -e 's/  if \(gardee\) return gardee\.res;\n//' src/neige.js
     ATTENDU="la neige lue se garde pour l.heure" ;;
  165) # La commune d'une plage n'est plus relue sur l'appareil.
     perl -0pi -e 's/  if \(gardee\) return gardee\.nom;\n//' src/plage.js
     ATTENDU="la commune d.une plage se garde sur l.appareil" ;;
  166) # Les plages lues ne sont plus relues sur l'appareil.
     perl -0pi -e 's/  if \(gardee\) \{ etat = \{ cle, proches, resumes: gardee\.resumes, heure \}; return etat; \}\n//' src/plage.js
     ATTENDU="les plages lues se gardent pour l.heure" ;;
  167) # L'état de l'eau n'est plus relu sur l'appareil.
     perl -0pi -e 's/  if \(gardee\?\.e\?\.restriction\) \{ etat = gardee\.e; return etat; \}\n//' src/eau.js
     ATTENDU="l.état de l.eau se garde une heure une fois ses lectures arrivées" ;;
  168) # La liste des plages se charge de nouveau au lancement.
     perl -0pi -e 's/(import \{ recaler, lireGardee, ecrireGardee, chercher, distanceKm \} from "\.\/horloge\.js";)/$1\nimport { PLAGES as LISTE_STATIQUE } from ".\/plages.js";/' src/plage.js
     ATTENDU="l.accueil s.affiche sans les listes des plages et des stations" ;;
  169) # La liste des stations se charge de nouveau au lancement.
     perl -0pi -e 's/(import \{ recaler, lireGardee, ecrireGardee, chercher, distanceKm \} from "\.\/horloge\.js";)/$1\nimport { STATIONS as LISTE_STATIQUE } from ".\/stations.js";/' src/neige.js
     ATTENDU="l.accueil s.affiche sans les listes des plages et des stations" ;;
  170) # Une requête n'a de nouveau aucun délai.
     perl -0pi -e 's/  setTimeout\(\(\) => arret\.abort\(\), delai\);\n//' src/horloge.js
     ATTENDU="une prévision qui ne répond pas rend la main en moins de vingt-cinq secondes" ;;
  171) # Un refus du quota se réessaie de nouveau sans attendre.
     perl -0pi -e 's/      if \(k < essais\) await attendre\([^\n]*\n//' src/previsions.js
     ATTENDU="un refus du quota attend avant le second essai, et une erreur 404 ne se réessaie pas" ;;
  172) # Une erreur 404 se réessaie de nouveau.
     perl -0pi -e 's/      if \(r\.status !== 429 && r\.status < 500\) return null;\n//' src/previsions.js
     ATTENDU="un refus du quota attend avant le second essai, et une erreur 404 ne se réessaie pas" ;;
  173) # Le département se déduit de nouveau du seul code postal.
     perl -0pi -e 's/  return \/\^\(\\d\{2,3\}\|2A\|2B\)\$\/\.test\(c\) \? c : null;/  return null;/' src/reglages.js
     ATTENDU="le département d.une commune vient du service d.adresses, le code postal n.étant qu.un secours" ;;
  174) # La barre de tête nomme de nouveau le département du code postal.
     perl -0pi -e 's/Vig\.nomDe\(Reglages\.departementDu\(g\)\)/Vig.nomDe(Reglages.departementDu({ codePostal: g.codePostal }))/' src/app.js
     ATTENDU="la barre de tête nomme le département de la commune, non celui de son code postal" ;;
  175) # L'heure se cherche de nouveau à l'heure de l'appareil.
     perl -0pi -e 's/export const cleHeure = \(d = new Date\(\)\) => `\$\{cleJour\(d\)\}T\$\{HEURE_PARIS\.format\(d\)\}:00`;/export const cleHeure = (d = new Date()) => `\${cleJour(d)}T\${String(d.getHours()).padStart(2, "0")}:00`;/' src/horloge.js
     ATTENDU="un téléphone réglé sur un autre fuseau lit l.heure et la journée de Paris" ;;
  176) # Le jour se cherche de nouveau sur le calendrier de l'appareil.
     perl -0pi -e 's/export const cleJour = d => JOUR_PARIS\.format\(d\);/export const cleJour = d => cleJourLocal(d);/' src/horloge.js
     ATTENDU="un téléphone réglé sur un autre fuseau lit l.heure et la journée de Paris" ;;
  177) # Une heure des données se lit de nouveau comme une heure de l'appareil.
     perl -0pi -e 's/  let x = mur - 3600 \* 1000;\n  for \(let k = 0; k < 3; k\+\+\) \{/  let x = mur - 3600 * 1000;\n  return Date.parse(`\${t}:00`);\n  for (let k = 0; k < 3; k++) {/' src/horloge.js
     ATTENDU="une heure des données se lit comme un instant de Paris, en été comme en hiver" ;;
  178) # L'application importe de nouveau la carte dès le lancement.
     perl -0pi -e 's/(import \{ vueTemps \} from "\.\/vues\/heures\.js";)/$1\nimport { vueCarte as CARTE_STATIQUE } from ".\/vues\/carte.js";/' src/app.js
     ATTENDU="l.accueil s.affiche sans les fichiers de la carte et du ciel" ;;
  179) # Un onglet qui n'a pas pu se charger ne le dit plus.
     perl -0pi -e 's/const manque = differesManques\.has\(nom\);/const manque = false;/' src/app.js
     ATTENDU="un onglet qui n.a pas pu se charger le dit, et s.ouvre après le rechargement proposé" ;;
  180) # Le message d'un onglet manqué ne propose plus de recharger.
     perl -0pi -e 's/\n        \+ `<button type="button" class="bouton-plein" data-action="recharger">Recharger l.application<\/button><\/div>`/\n        + `<\/div>`/' src/app.js
     ATTENDU="un onglet qui n.a pas pu se charger le dit, et s.ouvre après le rechargement proposé" ;;
  181) # Le vent n'est plus reposé une fois la vue cadrée.
     perl -0pi -e 's/        if \(E\.mesures\) E\.poserVent\(\);\n//' src/vues/carte.js
     ATTENDU="le mouvement réduit fige les particules sans les effacer" ;;
  182) # La neige reprend sa propre requête de route.
     perl -0pi -e 's/(const CACHE = "mameteo\.neige\.proches\.v1";\n)/$1const OSRM = "https:\/\/router.project-osrm.org\/table\/v1\/driving\/";\n/' src/neige.js
     ATTENDU="seul le module des trajets interroge OSRM" ;;
  183) # Le vent de mer et le vent de terre s'échangent.
     perl -0pi -e 's/return ecart <= 60 \? "mer" : ecart >= 120 \? "terre" : "rivage";/return ecart <= 60 ? "terre" : ecart >= 120 ? "mer" : "rivage";/' src/plage.js
     ATTENDU="le vent de la plage se rapporte au rivage : de mer, de terre ou le long du rivage" ;;
  184) # La feuille ne lit plus la direction de la mer de la liste.
     perl -0pi -e 's/fiche: p\[7\] \?\? null, versMer: p\[8\] \?\? null \}\);/fiche: p[7] ?? null });/' src/plage.js
     ATTENDU="la direction de la mer des plages connues est la bonne, Hendaye n.en a pas, et la plage lue la garde" ;;
  185) # Biarritz se lit tournée vers la terre.
     perl -0pi -e 's/("Grande Plage Nord \(Palais\)", "FR", 43\.4877, -1\.558, null, "64", 1, "001127:064", )305\]/${1}125]/' src/plages.js
     ATTENDU="la direction de la mer des plages connues est la bonne, Hendaye n.en a pas, et la plage lue la garde" ;;
  186) # Une journée sans pluie connue compte de nouveau sèche dans le bilan.
     perl -0pi -e 's/\.filter\(\(\[a, b\]\) => b && Number\.isFinite\(a\.mm\) && Number\.isFinite\(b\.mm\)\);/.filter(([a, b]) => b).map(([a, b]) => [{ ...a, mm: a.mm || 0 }, { ...b, mm: b.mm || 0 }]);/' src/comparaison.js
     ATTENDU="une journée sans pluie connue sort des cumuls de la comparaison, et la phrase le dit" ;;
  187) # Entre lieux, une journée sans pluie connue compte de nouveau sèche.
     perl -0pi -e 's/\.filter\(k => series\.every\(s => Number\.isFinite\(s\.jours\[k\]\?\.mm\)\)\);/;/; s/communs\.reduce\(\(a, k\) => a \+ s\.jours\[k\]\.mm, 0\)/communs.reduce((a, k) => a + (s.jours[k].mm || 0), 0)/' src/comparaison.js
     ATTENDU="une journée sans pluie connue sort des cumuls de la comparaison, et la phrase le dit" ;;
  188) # Une borne absente redevient zéro dans À venir.
     perl -0pi -e 's/const fini = v => \(Number\.isFinite\(v\) \? v : null\);/const fini = v => Number(v);/' src/vues/avenir.js
     ATTENDU="une valeur absente de la source ne s.écrit pas zéro" ;;
  189) # Le maximum d'une colonne vide redevient zéro.
     perl -0pi -e 's/    const v = k\.map\(j => val\(c, j\)\)\.filter\(Number\.isFinite\);\n    return v\.length \? Math\.max\(\.\.\.v\) : null;/    return Math.max(0, ...k.map(j => val(c, j) || 0));/' src/previsions.js
     ATTENDU="une valeur absente de la source ne s.écrit pas zéro" ;;
  190) # La neige absente d'une station redevient zéro.
     perl -0pi -e 's/const connu = \(v, f\) => \(Number\.isFinite\(v\) \? f\(v\) : null\);/const connu = (v, f) => f(v ?? 0);/' src/neige.js
     ATTENDU="une valeur absente de la source ne s.écrit pas zéro" ;;
  191) # La lecture en cours de l'indice officiel n'est plus retenue.
     perl -0pi -e 's/  if \(enCours && cleEnCours === cle\) return enCours;\n//' src/atmo.js
     ATTENDU="rouvrir la feuille ne relance l.indice officiel ni pendant sa lecture ni après un échec" ;;
  192) # L'échec de l'indice officiel n'est plus retenu.
     perl -0pi -e 's/  if \(echec && echec\.cle === cle && Date\.now\(\) - echec\.t < REESSAI\) return Promise\.resolve\(null\);\n//' src/atmo.js
     ATTENDU="rouvrir la feuille ne relance l.indice officiel ni pendant sa lecture ni après un échec" ;;
  193) # Le ruban dessine de nouveau la pluie dès 0,05 mm.
     perl -0pi -e 's/        if \(s\.mm\[k\] < SEUIL_LAME\) continue;/        if (s.mm[k] < 0.05) continue;/' src/ruban.js
     ATTENDU="les seuils de la pluie s.écrivent une seule fois" ;;
  194) # La table écrit de nouveau son risque en dur.
     perl -0pi -e 's/\["Risque", s => \(s\.pb >= SEUIL_RISQUE \?/["Risque", s => (s.pb >= 5 ?/' src/ecritures.js
     ATTENDU="les seuils de la pluie s.écrivent une seule fois" ;;
  195) # Une estimation à vol d'oiseau se garde trente jours.
     perl -0pi -e 's/ && Date\.now\(\) - e\.t < GARDE_PROCHES && !e\.estime\) return e\.l;/ \&\& Date.now() - e.t < GARDE_PROCHES) return e.l;/' src/trajets.js
     ATTENDU="une estimation à vol d.oiseau ne se garde pas, une durée de route se garde" ;;
  196) # La barre d'onglets ignore de nouveau les marges latérales.
     perl -0pi -e 's/  padding:0 var\(--droite\) var\(--bas\) var\(--gauche\);/  padding:0 0 var(--bas) 0;/' styles.css
     ATTENDU="en paysage, rien ne passe sous les marges latérales de l.encoche" ;;
  197) # Le bouton de fermeture du ciel plein écran ignore la marge de droite.
     perl -0pi -e 's/\.ci-fermer\{position:absolute;top:calc\(env\(safe-area-inset-top,0px\) \+ 12px\);right:calc\(16px \+ var\(--droite\)\)\}/.ci-fermer{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);right:16px}/' styles.css
     ATTENDU="en paysage, rien ne passe sous les marges latérales de l.encoche" ;;
  198) # Une erreur s'efface de nouveau au bout de quatre secondes.
     perl -0pi -e 's/  if \(erreur\) \{\n    gesteEtat = \(\) => majEtat\(""\);/  if (false) {\n    gesteEtat = () => majEtat("");/' src/app.js
     ATTENDU="un message d.état s.annonce à chaque fois, dans la feuille, et une erreur reste jusqu.au geste suivant" ;;
  199) # L'annonce n'est plus vidée avant d'être réécrite.
     perl -0pi -e 's/  r\.textContent = "";\n  requestAnimationFrame\(\(\) => \{ r\.textContent = t; \}\);/  r.textContent = t;/' src/app.js
     ATTENDU="un message d.état s.annonce à chaque fois, dans la feuille, et une erreur reste jusqu.au geste suivant" ;;
  200) # La feuille refaite perd de nouveau le focus.
     perl -0pi -e 's/  garderFocus\(corps, \(\) => \{ corps\.innerHTML = f\.corps; \}\);/  corps.innerHTML = f.corps;/' src/app.js
     ATTENDU="au clavier, la feuille prend le focus, le garde aux rendus et le rend à son bouton" ;;
  201) # La feuille fermée ne rend plus le focus à son bouton.
     perl -0pi -e 's/  \(retourFocus \|\| \$\("ecran"\)\)\.focus\(\{ preventScroll: true \}\);\n//' src/app.js
     ATTENDU="au clavier, la feuille prend le focus, le garde aux rendus et le rend à son bouton" ;;
  202) # La page sous la feuille n'est plus inerte.
     perl -0pi -e 's/    for \(const id of \["ecran", "nav", "onglets"\]\) \$\(id\)\.inert = true;\n//' src/app.js
     ATTENDU="au clavier, la feuille prend le focus, le garde aux rendus et le rend à son bouton" ;;
  203) # Le résumé de la carte ne suit plus les couches.
     perl -0pi -e 's/      \+ `<span>Contours IGN et Natural Earth<\/span>`;\n    E\.resumer\(\);/      + `<span>Contours IGN et Natural Earth<\/span>`;/' src/vues/carte-legende.js
     ATTENDU="la carte se lit par un résumé qui suit les couches, ses étiquettes en liste, et se déplace au clavier" ;;
  204) # Les flèches ne déplacent plus la carte.
     perl -0pi -e 's/        const d = \{ ArrowLeft: \[-1, 0\], ArrowRight: \[1, 0\], ArrowUp: \[0, -1\], ArrowDown: \[0, 1\] \}\[ev\.key\];/        const d = null;/' src/vues/carte.js
     ATTENDU="la carte se lit par un résumé qui suit les couches, ses étiquettes en liste, et se déplace au clavier" ;;
  205) # Le bouton Nord ne tourne plus le regard.
     perl -0pi -e 's/            else tourner\(\{ N: 0, E: 90, S: 180, O: 270 \}\[d\] - vue\.az, 0\);/            else tourner(0, 0);/' src/vues/etoiles.js
     ATTENDU="le ciel plein écran se lit et se tourne sans le doigt, les boutons paraissant au clavier" ;;
  206) # Les boutons d'orientation se montrent en permanence.
     perl -0pi -e 's/\.ci-dirs\{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset\(50%\)\}/.ci-dirs{position:absolute}/' styles.css
     ATTENDU="le ciel plein écran se lit et se tourne sans le doigt, les boutons paraissant au clavier" ;;
  207) # Les espaces insécables ne s'appliquent plus.
     perl -0pi -e 's/\nsurveiller\(\);\n/\n/' src/app.js
     ATTENDU="les espaces insécables tiennent les nombres à leur unité et les signes doubles à leur mot, hors des dessins" ;;
  208) # Les dessins reçoivent des espaces insécables.
     perl -0pi -e 's/const EXCLUS = "svg, script, style, textarea, input, code";/const EXCLUS = "script, style, textarea, input, code";/' src/typo.js
     ATTENDU="les espaces insécables tiennent les nombres à leur unité et les signes doubles à leur mot, hors des dessins" ;;
  209) # La politique oublie une source de la carte.
     perl -0pi -e 's/ https:\/\/view\.eumetsat\.int https:\/\/maps\.effis/ https:\/\/maps.effis/' index.html
     ATTENDU="aucun écran ne déclenche de refus de la politique de sécurité" ;;
  210) # La politique oublie un service appelé par le code.
     perl -0pi -e 's/ https:\/\/router\.project-osrm\.org//' index.html
     ATTENDU="la politique de sécurité autorise toute source que le code appelle, et seulement le site pour les scripts" ;;
  211) # La politique permet les scripts en ligne.
     perl -0pi -e "s/script-src 'self';/script-src 'self' 'unsafe-inline';/" index.html
     ATTENDU="la politique de sécurité autorise toute source que le code appelle, et seulement le site pour les scripts" ;;
  212) # Un service muet passe de nouveau pour un jour calme.
     perl -0pi -e 's/    muette = !repondu;/    muette = false;/' src/vigilance.js
     ATTENDU="un service de Météo-France muet se dit à l.accueil, dans les réglages et sur la carte, et la pluie dit son repli" ;;
  213) # La carte ne dit plus la vigilance indisponible.
     perl -0pi -e 's/      if \(E\.vigiMuette !== Vig\.paysMuet\) \{ E\.vigiMuette = Vig\.paysMuet; E\.mention\(\); \}\n//' src/vues/carte-couches.js
     ATTENDU="un service de Météo-France muet se dit à l.accueil, dans les réglages et sur la carte, et la pluie dit son repli" ;;
  214) # La pluie dans l'heure ne dit plus son repli.
     perl -0pi -e 's/    \+ \(l\.source === "repli" \?/    + (false ?/' src/app.js
     ATTENDU="un service de Météo-France muet se dit à l.accueil, dans les réglages et sur la carte, et la pluie dit son repli" ;;
  215) # Les sources s'affichent de nouveau en permanence.
     perl -0pi -e 's/<p class="ca-credit" id="caCredit" hidden>/<p class="ca-credit" id="caCredit">/' src/vues/carte-gabarit.js
     ATTENDU="la carte n.a plus de boutons de zoom, et ses sources s.ouvrent derrière un bouton" ;;
  216) # Le panneau revient en rangées à faire défiler de côté.
     perl -0pi -e 's/  display:grid;grid-template-columns:repeat\(auto-fill,minmax\(84px,1fr\)\);gap:2px;/  display:flex;gap:2px;overflow-x:auto;/; s/\.ca-ch\{\n  min-width:0;/.ca-ch{\n  flex:0 0 84px;/' styles.css
     ATTENDU="toutes les tuiles du panneau se voient d.un coup, sans nom coupé, et reçoivent leur appui" ;;
  217) # Le panneau redevient presque opaque.
     perl -0pi -e 's/  background:color-mix\(in srgb, var\(--surface\) 50%, transparent\);/  background:color-mix(in srgb, var(--surface) 72%, transparent);/' styles.css
     ATTENDU="le panneau laisse libre la colonne des commandes et son fond est à moitié transparent" ;;
  218) # La légende reprend trois lignes.
     perl -0pi -e 's/#caLegende\{\n  display:grid;grid-template-columns:auto 116px;/#caLegende{\n  display:block;grid-template-columns:auto 116px;/' styles.css
     ATTENDU="la légende de la nappe est basse, son titre sur la ligne de la rampe" ;;
  219) # Le vent reprend une seule couleur.
     perl -0pi -e 's/ctx\.strokeStyle = PALIERS\[k\]\[1\];/ctx.strokeStyle = "#5b6a7c";/' src/vent.js
     ATTENDU="les traînées prennent la couleur de leur vitesse, plus denses qu.avant" ;;
  220) # Le relief n'est plus dessiné.
     perl -0pi -e 's/if \(montre\.relief\) Fond\.peindreRelief\(/if (false) Fond.peindreRelief(/' src/carte.js
     ATTENDU="le relief se voit dans les montagnes et pas en plaine" ;;
  221) # La coque oublie les cours d'eau.
     perl -0pi -e 's/  "\.\/donnees\/rivieres\.json",\n//' sw.js
     ATTENDU="les fichiers du fond sont gardés dans la coque hors ligne" ;;
  222) # Les noms des villes se chevauchent.
     perl -0pi -e 's/ \|\| b\.y1 > h - 2 \|\| chevauche\(b, occupe\)\) continue;/ || b.y1 > h - 2) continue;/' src/fond.js
     ATTENDU="sur le pays entier, seules les grandes villes sont nommées, sans chevauchement" ;;
  223) # Toutes les villes se nomment, quel que soit le zoom.
     perl -0pi -e 's/      if \(v\.pop < min\) break;/      if (v.pop < 2000) break;/' src/fond.js
     ATTENDU="sur le pays entier, seules les grandes villes sont nommées, sans chevauchement" ;;
  224) # Les noms n'évitent plus les repères ni les commandes.
     perl -0pi -e 's/  const occupe = pris\.map\(/  const occupe = [].map(/' src/fond.js
     ATTENDU="sur le pays entier, seules les grandes villes sont nommées, sans chevauchement" ;;
  225) # Les petites villes portent une prévision sur le pays entier.
     perl -0pi -e 's/  if \(z < 5\.6\) return 50000;/  if (z < 5.6) return 2000;/' src/villes.js
     ATTENDU="sur le pays entier, les grandes villes portent leur prévision et leur nom, sans chevauchement" ;;
  226) # Les prévisions des villes ne se gardent plus.
     perl -0pi -e 's/return !g \|\| maintenant - g\.t >= GARDE; \}\);/return true; });/' src/villes.js
     ATTENDU="une ville n.est demandée qu.une fois, et une requête porte cinquante villes au plus" ;;
  227) # L'étiquette perd le nom de sa ville.
     perl -0pi -e 's/<small>\$\{esc\(v\[0\]\)\}<\/small>//' src/vues/carte-etiquettes.js
     ATTENDU="sur le pays entier, les grandes villes portent leur prévision et leur nom, sans chevauchement" ;;
  228) # Un doigt qui bouge n'annule plus l'appui long.
     perl -0pi -e 's/    if \(appui && \(points\.size > 1 \|\| Math\.hypot\(ev\.offsetX - appui\.x, ev\.offsetY - appui\.y\) > TOLERANCE_APPUI\)\) annulerAppui\(\);/    if (appui \&\& points.size > 1) annulerAppui();/' src/carte.js
     ATTENDU="un glissement ou un double appui n.ouvre pas de bulle, le double appui zoome" ;;
  229) # La consultation fait entrer le lieu dans la liste.
     perl -0pi -e 's/  etat = \{ \.\.\.etat, \.\.\.nu\(l\), poste: null, auto: false, retour \};/  poserLieu(l); etat = { ...etat, retour };/' src/reglages.js
     ATTENDU="« Voir la prévision » ouvre le lieu en consultation sans le suivre, et « Revenir » rétablit la commune" ;;
  230) # « Revenir » ne rétablit pas le lieu d'avant.
     perl -0pi -e 's/  etat = \{ \.\.\.etat, \.\.\.etat\.retour, retour: null \};/  etat = { ...etat, retour: null };/' src/reglages.js
     ATTENDU="« Voir la prévision » ouvre le lieu en consultation sans le suivre, et « Revenir » rétablit la commune" ;;
  231) # Le point touché part à pleine précision.
     perl -0pi -e 's/latitude: String\(envoi\(lat\)\), longitude: String\(envoi\(lon\)\),/latitude: String(lat), longitude: String(lon),/' src/point.js
     ATTENDU="le point touché n.est envoyé qu.au centième de degré" ;;
  232) # La recherche ne centre plus la carte.
     perl -0pi -e 's/    Object\.assign\(vue, Carte\.borner\(\{ lat: c\.lat, lon: c\.lon, z: ZOOM_RECHERCHE \}\)\);\n//' src/vues/carte-point.js
     ATTENDU="la recherche centre la carte sur la commune trouvée et ouvre sa bulle" ;;
  233) # La ville proche ignore la distance.
     perl -0pi -e 's/    if \(d > rayonKm\) continue;\n//' src/fond.js
     ATTENDU="un point hors de toute commune se nomme par la ville proche, et rien au large" ;;
  234) # Le nom du point ne vient plus que du service d'adresses.
     perl -0pi -e 's/    communeDu\(lat, lon, fetcheur === chercher \? chercherEn\(5000\) : fetcheur\)/    communeDe(lat, lon)/' src/point.js
     ATTENDU="le nom du point vient de la commune qui le contient, au millième de degré" ;;
  235) # La barre de tête ignore le nom donné au lieu.
     perl -0pi -e 's/\(Reglages\.nomAffiche\(g\) \|\| "Ma météo"\)/(g.commune || "Ma météo")/' src/app.js
     ATTENDU="un lieu se renomme, sa commune restant écrite dessous, et un nom vide rend celui de la commune" ;;
  236) # Un nom vide ne rend plus le nom de la commune.
     perl -0pi -e 's/  const propre = n && n !== l\.commune \? n : null;/  const propre = n ?? l.nom;/' src/reglages.js
     ATTENDU="un lieu se renomme, sa commune restant écrite dessous, et un nom vide rend celui de la commune" ;;
  237) # La nuit en cours compte jusqu'à 10 h.
     perl -0pi -e 's/  if \(h\[0\] < 6\) \{/  if (h[0] < 10) {/' src/prevue.js
     ATTENDU="les champs fixes se tirent des bonnes fenêtres" ;;
  238) # Les isobares perdent leur pas.
     perl -0pi -e 's/v <= mxv; v \+= regle\.pas\)/v <= mxv; v += regle.pas \/ 2)/' src/carte.js
     ATTENDU="la pression se peint avec ses isobares tous les quatre hectopascals" ;;
  239) # La grille prévue se relit à chaque nappe.
     perl -0pi -e 's/  if \(garde && t < garde\.exp\) return garde\.d;\n  let d = null;\n  try \{\n    const r = await \(fetcheur/  let d = null;\n  try {\n    const r = await (fetcheur/' src/prevue.js
     ATTENDU="le gel trace le zéro degré, et la pluie, la neige et le brouillard tombent où la grille les met" ;;
  240) # La légende perd son unité.
     perl -0pi -e 's/\$\{longue \? ` \(\$\{n\.unite\.trim\(\)\}\)` : ""\}/""/' src/vues/carte-legende.js
     ATTENDU="la pression se peint avec ses isobares tous les quatre hectopascals" ;;
  241) # La limite pluie-neige prend l'isotherme zéro.
     perl -0pi -e 's/Math\.min\(\.\.\.xs\) - 300\)/Math.min(...xs))/' src/prevue.js
     ATTENDU="les champs fixes se tirent des bonnes fenêtres" ;;
  242) # Les réglages oublient les nappes prévues.
     perl -0pi -e 's/export const NAPPES = \["temp", "uv", "air", "eau", "ventmoy",/export const NAPPES = ["temp", "uv", "air", "eau", "xventmoy",/' src/reglages.js
     ATTENDU="toute nappe du panneau est gardée par les réglages" ;;
  243) # L'indice d'un pollen ignore le seuil de saison.
     perl -0pi -e 's/  if \(c < p\.pic\) return 1 \+ \(c - p\.saison\) \/ \(p\.pic - p\.saison\);/  if (c < p.pic) return 1 + c \/ p.pic;/' src/nappe.js
     ATTENDU="l.indice d.un pollen suit ses deux seuils" ;;
  244) # La mer se découpe comme les autres nappes.
     perl -0pi -e 's/  if \(mer\) ctx\.rect\(-10, -10, l \+ 20, h \+ 20\);/  if (false) ctx.rect(-10, -10, l + 20, h + 20);/' src/carte.js
     ATTENDU="les vagues se peignent sur la mer et non sur la terre de France" ;;
  245) # La mer perd ses valeurs près des côtes.
     perl -0pi -e 's/  if \(partiel\) \{/  if (false) {/' src/nappe.js
     ATTENDU="la mer garde une valeur près des côtes" ;;
  246) # La légende des pollens perd ses seuils nommés.
     perl -0pi -e 's/      grads\.innerHTML = n\.etiquettes\n/      grads.innerHTML = false\n/' src/vues/carte-legende.js
     ATTENDU="les pollens se peignent où ils sont en saison, et la légende nomme les seuils" ;;
  247) # Les légendes passent devant le panneau.
     perl -0pi -e 's/     le panneau descend jusqu.à elles sur un petit écran, et elles prenaient\n     les appuis de ses dernières tuiles\. \*\/\n  z-index:4;/     le panneau descend jusqu à elles. *\/\n  z-index:auto;/' styles.css
     ATTENDU="toutes les tuiles du panneau se voient d.un coup, sans nom coupé, et reçoivent leur appui" ;;
  248) # Plus d'heures prévues après le radar.
     perl -0pi -e 's/export const HEURES_PREVUES = 12;/export const HEURES_PREVUES = 0;/' src/vues/carte-chronologie.js
     ATTENDU="après le radar, la piste porte douze heures prévues" ;;
  249) # La température ne suit plus l'heure.
     perl -0pi -e 's/        : n\.parHeure && E\.heurePrevue > 0 && E\.prevueVue \? E\.prevueVue : E\.mesures\);/        : E.mesures);/' src/vues/carte-couches.js
     ATTENDU="la température suit l.heure de la piste" ;;
  250) # La légende ne dit plus l'heure prévue.
     perl -0pi -e 's/  E\.porteDe = n => \(n\.parHeure && E\.heurePrevue > 0 && E\.heureCadre/  E.porteDe = n => (false \&\& E.heureCadre/' src/vues/carte-legende.js
     ATTENDU="une nappe horaire fait paraître la piste sans la pluie, et la légende dit l.heure prévue" ;;
  251) # La grille prévue se lit dès l'ouverture.
     perl -0pi -e 's/  E\.majChronologie = \(\) => \{\n/  E.majChronologie = () => {\n    E.lirePrevue?.();\n/' src/vues/carte-chronologie.js
     ATTENDU="après le radar, la piste porte douze heures prévues" ;;
  252) # Sans la pluie, la piste ne paraît plus.
     perl -0pi -e 's/    const horaire = E\.pluieAllume \|\| nappeHoraire\(\);/    const horaire = E.pluieAllume;/' src/vues/carte-chronologie.js
     ATTENDU="une nappe horaire fait paraître la piste sans la pluie" ;;
  253) # Une nappe choisie sur une heure prévue n'a pas sa grille du moment.
     perl -0pi -e 's/      if \(n\.source \? grilleDe\(n\) : E\.mesures\) E\.revoir\(\);/      if (grilleDe(n)) E.revoir();/' src/vues/carte-couches.js
     ATTENDU="la température suit l.heure de la piste" ;;
  254) # Le saut d'un champ perd de nouveau l'octet de sa longueur.
     perl -0pi -e 's/      else if \(t === 2\) \{ const n = varint\(\); i \+= n; \}/      else if (t === 2) i += varint();/' src/zones-eau.js
     ATTENDU="au zoom d.un département, les zones d.alerte remplacent les départements" ;;
  255) # Les zones ne remplacent jamais les départements.
     perl -0pi -e 's/    const zones = v\.z >= ZonesEau\.ZOOM_ZONES;/    const zones = false;/' src/vues/carte-couches.js
     ATTENDU="au zoom d.un département, les zones d.alerte remplacent les départements" ;;
  256) # Le rang d'une tuile inverse ses coordonnées.
     perl -0pi -e 's/    const rx = \(x & s\) > 0 \? 1 : 0, ry = \(y & s\) > 0 \? 1 : 0;/    const rx = (y \& s) > 0 ? 1 : 0, ry = (x \& s) > 0 ? 1 : 0;/' src/zones-eau.js
     ATTENDU="au zoom d.un département, les zones d.alerte remplacent les départements" ;;
  257) # Les tuiles de zones se relisent à chaque tracé.
     perl -0pi -e 's/        if \(zonesLues\.has\(cle\)\) \{ lues\+\+; zones\.push\(\.\.\.\(zonesLues\.get\(cle\) \|\| \[\]\)\); continue; \}\n        if \(zonesEnCours\.has\(cle\)\) continue;/        if (zonesEnCours.has(cle)) continue;/; s/  if \(tuiles\.has\(cle\)\) return tuiles\.get\(cle\);\n//' src/vues/carte-couches.js src/zones-eau.js
     ATTENDU="une tuile de zones déjà lue ne se relit pas" ;;
  258) # Le plein écran ne retire plus les barres.
     perl -0pi -e 's/:root\.carte-plein \.nav,:root\.carte-plein \.onglets\{display:none\}\n//' styles.css
     ATTENDU="le plein écran retire les barres et donne toute la hauteur à la carte" ;;
  259) # La carte oublie son cadrage au relancement.
     perl -0pi -e 's/ctx\.cadreCarte = Reglages\.vueCarte\(\) \|\| \{/ctx.cadreCarte = {/' src/vues/carte.js
     ATTENDU="la carte rouvre sur son dernier cadrage" ;;
  260) # Revenir d'un autre onglet ramène la France.
     perl -0pi -e 's/  if \(nom === "carte" && onglet === "carte"\) \{/  if (nom === "carte") {/' src/app.js
     ATTENDU="la carte rouvre sur son dernier cadrage" ;;
  261) # La légende de l'eau reprend ses quatre classes.
     perl -0pi -e 's/const classes = n\.classes\.join\(""\)\.length > 18/const classes = n.classes.join("").length > 999/' src/vues/carte-legende.js
     ATTENDU="sa légende nomme les classes extrêmes, et la mention cite VigiEau" ;;
  262) # Le toucher bref ouvre de nouveau la bulle.
     perl -0pi -e 's/    if \(points\.size\) poserDepart\(\); else depart = null;\n    annulerAppui\(\);/    if (points.size) poserDepart(); else depart = null;\n    if (appui \&\& surAppui) surAppui(appui.x, appui.y);\n    annulerAppui();/' src/carte.js
     ATTENDU="un toucher bref sur la carte n.ouvre pas de bulle" ;;
  263) # Les cours d'eau paraissent toujours.
     perl -0pi -e 's/          rivieres: \["eau", "pluie24"\]\.includes\(E\.choisie\) \|\| E\.rivAllume === true,/          rivieres: true,/' src/vues/carte.js
     ATTENDU="le fond s.adapte" ;;
  264) # Le relief paraît toujours.
     perl -0pi -e 's/          relief: \["neige24", "limite"\]\.includes\(E\.choisie\) \|\| E\.neigeAllume === true,/          relief: true,/' src/vues/carte.js
     ATTENDU="le fond s.adapte" ;;
  265) # Les familles ne tiennent plus sur une ligne.
     perl -0pi -e 's/\.ca-fam\{display:grid;grid-template-columns:70px repeat\(3,minmax\(0,1fr\)\);/.ca-fam{display:block;/' styles.css
     ATTENDU="toutes les tuiles du panneau se voient d.un coup" ;;
  266) # Les légendes reprennent une boîte chacune.
     perl -0pi -e 's/\.ca-legende\{max-width:none\}/.ca-legende{max-width:none;padding:6px 8px;margin:4px 0;box-shadow:0 1px 4px rgba(0,0,0,.2);display:block}/' styles.css
     ATTENDU="les légendes tiennent dans une seule boîte basse" ;;
  267) # La légende ne se replie plus.
     perl -0pi -e 's/\.ca-legendes\.replie \.ca-leg-corps\{display:none\}/.ca-legendes.replie .ca-leg-corps{display:flex}/' styles.css
     ATTENDU="les légendes tiennent dans une seule boîte basse" ;;
  268) # La source revient au pied de l'accueil.
     perl -0pi -e 's/    corps \+= ``\n/    corps += `<p class="pied">Source : Open-Meteo, modèle AROME de Météo-France.<\/p>`\n/' src/app.js
     ATTENDU="aucun écran ne cite plus de source" ;;
  269) # Les explications s'ouvrent d'office.
     perl -0pi -e 's/<details class="aide">/<details class="aide" open>/' src/aide.js
     ATTENDU="les explications attendent derrière le bouton" ;;
  270) # La carte des sources oublie l'indice officiel de l'air.
     perl -0pi -e 's/ ; indice officiel d.Atmo France"\]/"]/' src/vues/feuilles.js
     ATTENDU="la carte des sources des réglages nomme toutes les sources" ;;
  271) # L'humidité revient dans le tableau des heures.
     perl -0pi -e 's/(  \{ nom: "UV", seuil)/  { nom: "Humidité", lire: m => `\${Math.round(m.hum)} %` },\n$1/' src/ecritures.js
     ATTENDU="le tableau des heures tient en quatre lignes au plus" ;;
  272) # La porte des activités reprend sa description.
     perl -0pi -e 's/if \(avec\.length\) out\.activites =/if (false) out.activites =/' src/app.js
     ATTENDU="les quatre portes portent une information clé" ;;
  273) # La tuile de l'eau reprend la goutte.
     perl -0pi -e 's/null, "robinet", "pluie", "eau"/null, "goutte", "pluie", "eau"/' src/app.js
     ATTENDU="la tuile de l'eau porte le robinet" ;;
  274) # « Plus de détails » s'ouvre d'office.
     perl -0pi -e 's/<details class="carte plus" id="eauPlus">/<details class="carte plus" id="eauPlus" open>/' src/vues/loisirs.js
     ATTENDU="la fenêtre de l'eau montre la restriction, la nappe et la rivière" ;;
  275) # Les durées du Soleil retournent sous la course du jour.
     perl -0pi -e 's/dedans: `<div class="carte ci-durees">\$\{mesures\}`/dedans: `<div class="section"><h2>Trajectoire<\/h2><\/div><div class="carte ci-durees">\${mesures}`/' src/vues/astres.js
     ATTENDU="les durées du Soleil se lisent au-dessus de la trajectoire" ;;
  276) # Les mesures de la Lune perdent leur carte de tête.
     perl -0pi -e 's/dedans: `<div class="carte ci-durees">\$\{mesures\}<\/div>`/dedans: ``/' src/vues/astres.js
     ATTENDU="les mesures de la Lune se lisent au-dessus de la trajectoire" ;;
  277) # La nuit des Étoiles perd la précision de ses cases.
     perl -0pi -e 's/<b>\$\{esc\(val\)\}<\/b><em>\$\{esc\(sous\)\}<\/em>/<b>\${esc(val)}<\/b>/' src/vues/etoiles.js
     ATTENDU="les trois indicateurs de la nuit des Étoiles" ;;
  278) # La liste ne range plus ses heures par moment.
     perl -0pi -e 's/\.map\(lot => `<div class="section hl-moment"><h2>\$\{esc\(lot\.titre\)\}<\/h2>`/.map(lot => `<div class="section hl-moment"><h2>Heures<\/h2>`/' src/ecritures.js
     ATTENDU="la liste range ses heures par moment" ;;
  279) # La pluie s'écrit à chaque ligne, même sèche.
     perl -0pi -e 's/const pluie = h\.mm >= SEUIL_LAME \?/const pluie = true ?/' src/ecritures.js
     ATTENDU="chaque ligne porte le ciel et la température, la pluie seulement quand il pleut" ;;
  280) # Le détail perd le ressenti.
     perl -0pi -e 's/  \["Ressenti", h => `\$\{Math\.round\(h\.res\)\}°`\],\n//' src/ecritures.js
     ATTENDU="toucher une heure ouvre le ressenti" ;;
  281) # Le ruban redevient sélectionnable.
     perl -0pi -e 's/\.mg,\.mg \*,\.mg-bandeau,\.mg-bandeau \*,\.mg-nav\{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none\}//' styles.css
     ATTENDU="le ruban ne se sélectionne pas" ;;
  282) # L'axe du haut écrit ses heures sans vérifier qu'elles tiennent.
     perl -0pi -e 's/const heuresVues = graduations\.filter\(k => \{/const heuresVues = graduations.filter(k => { return true;/' src/ruban.js
     ATTENDU="l'axe du haut n'écrit que des libellés entiers" ;;
  283) # Minuit retraverse les titres.
     perl -0pi -e 's/return `\$\{nav\}\$\{bandeau\}<div class="mg">\$\{voies\.join\(""\)\}<\/div>`;/return `\${nav}\${bandeau}<div class="mg"><svg class="mg-minuits" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 \${L} 1000" preserveAspectRatio="none">\${minuits.map(k => `<line class="mg-mp" x1="\${X(k)}" y1="0" x2="\${X(k)}" y2="1000"\/>`).join("")}<\/svg>\${voies.join("")}<\/div>`;/' src/ruban.js
     ATTENDU="le trait de minuit ne traverse ni les titres" ;;
  284) # Un toucher bref ne lit plus.
     perl -0pi -e 's/if \(actif && mode === null\) lire\(kAppui\);//' src/ruban.js
     ATTENDU="un toucher bref lit l'heure touchée" ;;
  285) # La bulle reste vide.
     perl -0pi -e 's/if \(!s \|\| k < 0 \|\| k >= s\.n\) return "";/return "";/' src/ruban.js
     ATTENDU="au repos, la bulle lit l'heure en cours" ;;
  286) # Les boutons des jours débordent la carte.
     perl -0pi -e 's/\.mg-jours\{display:grid;grid-template-columns:repeat\(var\(--n\), minmax\(0, 1fr\)\);gap:4px\}/.mg-jours{display:flex;gap:4px}.mg-j{flex:0 0 72px}/' styles.css
     ATTENDU="le choix du jour porte" ;;
  287) # Un jour choisi ne se cale plus sur son minuit.
     perl -0pi -e 's/while \(m > 0 && serie\.heure\[m\] !== 0\) m--;/m += 3;/' src/ruban.js
     ATTENDU="le bouton du lendemain cale la fenêtre sur son minuit" ;;
  288) # La lecture revient à maintenant au relâchement.
     perl -0pi -e 's/actif = false; mode = null;\n    \};/actif = false; mode = null; setTimeout(() => lire(s.ici), 500);\n    };/' src/ruban.js
     ATTENDU="la lecture reste posée après le relâchement" ;;
  289) # La phrase de la voie dépliée s'affiche en clair.
     perl -0pi -e 's/const bas = !resume \? "" : g \?/const bas = !resume ? "" : g ? `<p class="mg-l">\${esc(resume)}<\/p>` : false ?/' src/ruban.js
     ATTENDU="la phrase de la voie dépliée attend derrière" ;;
  290) # La voie de la pluie se dessine dès qu'il pleut sur l'horizon.
     perl -0pi -e 's/const h = Math\.max\(\.\.\.w\.mm\) >= SEUIL_LAME/const h = Math.max(...s.mm) >= SEUIL_LAME/' src/ruban.js
     ATTENDU="la voie de la pluie se replie" ;;
  291) # La bulle nomme le jour autrement que l'axe.
     perl -0pi -e 's/: j === "Aujourd.hui" \? heureTxt\(s\.heure\[k\]\) : `\$\{j\}, \$\{heureTxt\(s\.heure\[k\]\)\}`;/: `\${nomJour(s, s.jour[k])}\${heureTxt(s.heure[k])}`;/' src/ruban.js
     ATTENDU="au delà de demain, le jour se nomme en entier" ;;
  292) # Le vent reprend la tournure des bulletins.
     perl -0pi -e 's/`\$\{Math\.round\(h\.v\)\} km\/h, \$\{duCardinal\(h\.dir\)\}`/`\${Math.round(h.v)} km\/h de \${cardinal(h.dir)}`/' src/ecritures.js
     ATTENDU="le vent du détail dit sa provenance" ;;
  293) # Les lignes de la liste reprennent leur hauteur de touche.
     perl -0pi -e 's/gap:var\(--espace-md\);min-height:36px;padding:2px 0;/gap:var(--espace-md);min-height:var(--touche);padding:var(--espace-xs) 0;/' styles.css
     ATTENDU="les lignes sont resserrées" ;;
  294) # Le « i » de la liste retourne au pied.
     perl -0pi -e 's/return `<div class="hl-aide">` \+ aide\(/return `<div class="hl-pied">` + aide(/' src/ecritures.js
     ATTENDU="les lignes sont resserrées" ;;
  295) # Le « i » reste au pied de sa carte.
     perl -0pi -e 's/    titre\.after\(d\);\n    carte\.classList\.add\("aide-tete"\);/    void titre;/' src/aide.js
     ATTENDU="le « i » d'une carte titrée" ;;
  296) # Les sources reprennent deux colonnes.
     perl -0pi -e 's/<div class="rangee rg-src"><span class="rangee-txt"><b>\$\{esc\(n\)\}<\/b>`\n        \+ `<span>\$\{esc\(v\)\}<\/span><\/span><\/div>`/<div class="rangee rg-src"><span class="rangee-txt">\${esc(n)}<\/span>`\n        + `<span class="rangee-val">\${esc(v)}<\/span><\/div>`/' src/vues/feuilles.js
     ATTENDU="les réglages ont un engrenage" ;;
  297) # La part sombre de la Lune s'efface de jour.
     perl -0pi -e 's/const garde = Math\.max\(0\.42,/const garde = Math.max(0,/' src/relief.js
     ATTENDU="la face sombre de la Lune" ;;
  298) # La vignette écrase de nouveau la part cendrée au noir.
     perl -0pi -e 's/PLANCHER = 0\.24/PLANCHER = 0/' src/relief.js
     ATTENDU="la face sombre de la Lune" ;;
  299) # Le glissement après un double appui ne zoome plus.
     perl -0pi -e 's/if \(zoomDoigt && points\.size === 1\) \{/if (false) {/' src/carte.js
     ATTENDU="un double appui suivi d'un glissement" ;;
  300) # La tuile de la pluie reprend la journée civile.
     perl -0pi -e 's/const pb = arrondi\(plus\("pb"\)\)/const pb = jh ? arrondi(jh.pb) : null/' src/app.js
     ATTENDU="la tuile de la pluie dit le plus fort risque d'ici minuit" ;;
  301) # La tuile de l'indice UV reprend son seuil propre.
     perl -0pi -e 's/uv === null \? ICI : `\$\{P\.motUV\(uv\)\} \$\{ICI\}`/uv >= SEUILS.uv ? "élevé" : "au plus"/' src/app.js
     ATTENDU="la tuile de l'indice UV et le ruban" ;;
  302) # Le ruban écrit la pression du début de sa fenêtre.
     perl -0pi -e 's/poser\("Pression", `\$\{Math\.round\(s\.pres\[kp\]\)\} hPa/poser("Pression", `\${Math.round(w.pres[0])} hPa/' src/ruban.js
     ATTENDU="la tuile de la pression et le ruban" ;;
  303) # Le tableau des heures dit les rafales dès 30 km/h.
     perl -0pi -e 's/m\.raf >= SEUIL_RAFALE \?/m.raf >= 30 ?/' src/ecritures.js
     ATTENDU="un seul seuil de rafale" ;;
  304) # La porte de l'air relit l'indice de minuit.
     perl -0pi -e 's/const air = Air\.alignerSur\(P\.serieHoraire\(0, 24 - new Date\(\)\.getHours\(\), 1\)\);/const air = Air.chargeCourante();/' src/app.js
     ATTENDU="la porte de l'air dit l'indice de l'heure en cours" ;;
  305) # Le graphique d'À venir relit les rafales quotidiennes.
     perl -0pi -e 's/raf: h && Number\.isFinite\(h\.raf\) \? h\.raf : dd\.wind_gusts_10m_max/raf: dd.wind_gusts_10m_max/' src/vues/avenir.js
     ATTENDU="les rafales du graphique d'À venir viennent des heures" ;;
  306) # La bande écrit le cumul à la décimale.
     perl -0pi -e 's/parties\[0\] \+= `, \$\{nombreFr\(mm\)\} mm`;/parties[0] += `, \${mm.toFixed(1).replace(".", ",")} mm`;/' src/bande.js
     ATTENDU="la bande écrit le cumul de pluie comme le reste" ;;
  307) # La bulle de la carte relit le point au lieu affiché.
     perl -0pi -e 's/const s0 = pres \? P\.serieHoraire\(0, 1, 1\) : null;/const s0 = null;/' src/vues/carte-point.js
     ATTENDU="la bulle de la carte, au lieu affiché" ;;
  308) # L'heure à la minute reprend les deux points.
     perl -0pi -e 's/export const heureMinute = d => \(d\.getMinutes\(\) \? `\$\{deux\(d\.getHours\(\)\)\} h \$\{deux\(d\.getMinutes\(\)\)\}`/export const heureMinute = d => (d.getMinutes() ? `\${deux(d.getHours())}:\${deux(d.getMinutes())}`/' src/horloge.js
     ATTENDU="aucune heure ne s'écrit plus avec deux points" ;;
  309) # Le tableau des heures reprend le trait.
     perl -0pi -e 's/\$\{deux\(x\.h0\)\} h à \$\{deux\(x\.h1\)\} h/\${deux(x.h0)}-\${deux(x.h1)} h/' src/ecritures.js
     ATTENDU="le tableau des heures écrit ses plages" ;;
  310) # La bulle du ruban reprend l'abréviation de la direction.
     perl -0pi -e 's/\["Vent", `\$\{Math\.round\(s\.v\[k\]\)\} km\/h`, duCardinal\(s\.dir\[k\]\)\]/["Vent", `\${Math.round(s.v[k])} km\/h`, "SO"]/' src/ruban.js
     ATTENDU="la bulle du ruban dit la direction du vent" ;;
  311) # La page ne se place plus sur la voie désignée.
     perl -0pi -e 's/v\.scrollIntoView\(\{ block: "center", behavior: "instant" \}\);//' src/app.js
     ATTENDU="la page s'est placée sur la voie" ;;
  312) # Chaque échéance ne couvre plus que cinq minutes, quel que soit son pas.
     perl -0pi -e 's/const de = place\(pas\[k\]\.t\), a = place\(k \+ 1 < n \? pas\[k \+ 1\]\.t : finHeure\);/const de = place(pas[k].t), a = place(pas[k].t + 5 * 60000);/' src/app.js
     ATTENDU="le ruban pose chaque morceau de pluie à son heure, de maintenant à trois heures" ;;
  313) # Toute pluie prend la nuance de la pluie faible.
     perl -0pi -e 's/else if \(Pluie\.estPluie\(x\.i\)\) ajouter\("eau", x\.i, k\);/else if (Pluie.estPluie(x.i)) ajouter("eau", 2, k);/' src/app.js
     ATTENDU="seules les échéances mouillées portent l.eau, dans la nuance de leur force" ;;
  314) # Les repères passent à la demi-heure.
     perl -0pi -e 's/const cran = t1 - t0 > 90 \* 60000 \? 3600000 : 900000;/const cran = t1 - t0 > 90 * 60000 ? 1800000 : 900000;/' src/app.js
     ATTENDU="l.axe du ruban porte les heures rondes sur trois heures" ;;
  315) # Les voisins partent sans arrondi.
     perl -0pi -e 's/\.map\(\(\[a, b\]\) => \[centieme\(lat \+ a\), centieme\(lon \+ b\)\]\);/.map(([a, b]) => [lat + a, lon + b]);/' src/pluieproche.js
     ATTENDU="le voisinage lit quatre points à trois kilomètres" ;;
  316) # L'encart ne dit plus la pluie des voisins.
     perl -0pi -e 's/evenement\(l, maintenant\) \|\| proximite\(l, maintenant\);/evenement(l, maintenant);/' src/pluieproche.js
     ATTENDU="une averse autour d.un point sec se dit à quelques kilomètres" ;;
  317) # Les voisins hachurent aussi par-dessus la pluie du point.
     perl -0pi -e 's/    else if \(Pluie\.estPluie\(autour\[k\]\)\) ajouter\("autour", autour\[k\], k\);/    if (Pluie.estPluie(autour[k])) ajouter("autour", autour[k], k);/' src/app.js
     ATTENDU="autour d.une pluie annoncée, les voisins ne hachurent que le sec" ;;
  318) # Le lien de l'encart n'allume plus la pluie.
     perl -0pi -e 's/    Reglages\.poserPluiecarte\(true\);\n//' src/app.js
     ATTENDU="le lien de l.encart ouvre la carte, la pluie allumée" ;;
  319) # Le radar n'accorde plus le rappel.
     perl -0pi -e 's/\.map\(\(\[a, b\]\) => \[Math\.max\(a, h\), b\]\)/.map(([a, b]) => [a, b])/' src/parapluie.js
     ATTENDU="le rappel de parapluie prend le début que le radar voit" ;;
  320) # Le sec d'une heure entière s'arrête à la dernière échéance.
     perl -0pi -e 's/  return pas\[n - 1\]\.t \+ \(pas\[n - 1\]\.t - pas\[n - 2\]\.t\);/  return pas[n - 1].t;/' src/pluieproche.js
     ATTENDU="le radar dit jusqu.à quand le point est sec" ;;
  321) # La pastille ignore le radar.
     perl -0pi -e 's/      Pluie\.secJusqua\(pluieProche\)\)/      null)/' src/app.js
     ATTENDU="la pastille du parapluie suit le radar dans l.heure" ;;
  322) # L'encart perd son lien vers la carte.
     perl -0pi -e 's/<button type="button" class="pp-carte" data-pluie-carte>/<button type="button" class="pp-carte">/' src/app.js
     ATTENDU="l.encart mène à la carte" ;;
  323) # Le repli accorde aussi le rappel.
     perl -0pi -e 's/  if \(!l \|\| !l\.dispo \|\| l\.source !== "meteofrance"\) return null;/  if (!l || !l.dispo) return null;/' src/pluieproche.js
     ATTENDU="le repli n.accorde pas le rappel de parapluie" ;;
  324) # Le modèle ne prolonge plus l'heure.
     perl -0pi -e 's/  evenement\(l, maintenant\) \|\| proximite\(l, maintenant\) \|\| plusTard\(l, maintenant\);/  evenement(l, maintenant) || proximite(l, maintenant);/' src/pluieproche.js
     ATTENDU="la pluie que le modèle voit plus tard se dit avec son heure et sa source" ;;
  325) # La part du modèle se peint comme celle du radar.
     perl -0pi -e 's/const genre = radar \? "modele" : "eau";/const genre = "eau";/' src/app.js
     ATTENDU="la part du modèle se distingue de celle du radar" ;;
  326) # Une échéance muette n'arrête plus la lecture du modèle.
     perl -0pi -e 's/  if \(ici\.length < 2 \|\| ici\.some\(x => x\.i !== 1\)\) return null;\n  const fin = finDe/  if (ici.length < 2) return null;\n  const fin = finDe/' src/pluieproche.js
     ATTENDU="une échéance muette dans l.heure n.annonce pas la pluie du modèle" ;;
  327) # Le délai long s'écrit en minutes.
     perl -0pi -e 's/export const delaiCourt = m => \(m < 60 \?/export const delaiCourt = m => (m < 600 ?/' src/pluieproche.js
     ATTENDU="un délai au-delà de l.heure s.écrit en heures et minutes" ;;
  328) # Le ruban s'arrête au bout de l'heure du radar.
     perl -0pi -e 's/const t1 = suite\.length \? t0 \+ Pluie\.HORIZON : finHeure;/const t1 = finHeure;/' src/app.js
     ATTENDU="le ruban du repli va jusqu.à trois heures d.ici" ;;
  329) # Le modèle reprend la main dans l'heure couverte par le radar.
     perl -0pi -e 's/  if \(d && d\.dispo\) \{\n    d\.voisins/  if (d \&\& d.dispo \&\& !modele) {\n    d.voisins/' src/pluieproche.js
     ATTENDU="avec couverture radar, le modèle ne sert qu.au-delà de l.heure" ;;
  330) # L'accord des deux méthodes s'élargit à une demi-heure.
     perl -0pi -e 's/export const ACCORD = 10 \* 60000;/export const ACCORD = 30 * 60000;/' src/pluieproche.js
     ATTENDU="deux méthodes qui s.écartent donnent une plage" ;;
  331) # Le déplacement croise aussi le repli.
     perl -0pi -e 's/  const ev = l\.source === "meteofrance"\n/  const ev = true\n/' src/app.js
     ATTENDU="la seconde méthode ne croise pas le repli" ;;
  332) # L'approche ne s'arrête plus au bord de la tuile.
     perl -0pi -e 's/    if \(x < 0 \|\| y < 0 \|\| x >= n \|\| y >= n\) return \{ t: null, jusqua: tImage \+ tau \* 60000 \};\n//' src/deplacement.js
     ATTENDU="l.approche pousse la dernière image du déplacement et s.arrête au bord" ;;
  333) # La confirmation ne se dit plus.
     perl -0pi -e 's/ev\.confirme \? " Heure confirmée par le déplacement des averses\."/ev.confirme ? ""/' src/pluieproche.js
     ATTENDU="deux méthodes d.accord confirment l.heure" ;;
  334) # Une pluie qu'aucune averse n'apporte n'est plus signalée.
     perl -0pi -e 's/approche\.jusqua >= ev\.t \+ ACCORD \? \{ \.\.\.ev, nonVue: true \} : ev/ev/' src/pluieproche.js
     ATTENDU="la seconde méthode confirme, élargit ou signale selon l.écart" ;;
  335) # L'approche lit l'aval au lieu de l'amont.
     perl -0pi -e 's/const x = Math\.round\(px - vx \* tau\), y = Math\.round\(py - vy \* tau\);/const x = Math.round(px + vx * tau), y = Math.round(py + vy * tau);/' src/deplacement.js
     ATTENDU="l.approche pousse la dernière image du déplacement et s.arrête au bord" ;;
  336) # Un écart de plus d'une demi-heure donne encore une plage.
     perl -0pi -e 's/  if \(ecart > ECART_MAX\) return \{ \.\.\.ev, nonVue: true \};\n//' src/pluieproche.js
     ATTENDU="la seconde méthode confirme, élargit ou signale selon l.écart" ;;
  337) # Le drapeau à zéro fait de nouveau taire toute pluie.
     perl -0pi -e 's/    dispo: p\.rain_product_available === 1 \|\| pas\.some\(x => estPluie\(x\.i\)\),/    dispo: p.rain_product_available === 1,/' src/pluieproche.js
     ATTENDU="une pluie annoncée se lit même sous un drapeau à zéro" ;;
  338) # Le disque ne se reconnaît plus au toucher.
     perl -0pi -e 's/<= rayon \* 1\.3\) \{/<= rayon * 0) {/' src/vues/plein-ciel.js
     ATTENDU="un toucher sur le Soleil de l.écran Le ciel l.ouvre en plein ciel" ;;
  339) # L'astre ouvert reste au milieu de l'écran.
     perl -0pi -e 's/export const PART_VISIBLE = 0\.42;/export const PART_VISIBLE = 0.9;/' src/vues/plein-ciel.js
     ATTENDU="l.astre ouvert est celui de l.application, grandi sur le bord gauche" ;;
  340) # Les heures du Soleil ne se rangent plus dans l'ordre où elles se vivent.
     perl -0pi -e 's/\]\.filter\(l => l\[2\]\)\.sort\(\(a, b\) => a\[2\] - b\[2\]\),/].filter(l => l[2]),/' src/vues/plein-ciel.js
     ATTENDU="le plein ciel dit la hauteur, la journée et les heures du Soleil dans leur ordre" ;;
  341) # L'heure dorée prend dix degrés.
     perl -0pi -e 's/export const DOREE = 6;/export const DOREE = 10;/' src/vues/plein-ciel.js
     ATTENDU="l.heure dorée et l.heure bleue tombent à leur hauteur" ;;
  342) # La croix ne referme plus.
     perl -0pi -e 's/  cadre\.querySelector\("\.pc-fermer"\)\.addEventListener\("click", ev => \{ ev\.stopPropagation\(\); fermer\(\); \}\);\n//' src/vues/plein-ciel.js
     ATTENDU="la croix referme et rend le Soleil à sa place" ;;
  343) # Le glissement vers le bas ne referme plus.
     perl -0pi -e 's/if \(\(dy > 80 && dy > Math\.abs\(dx\)\) \|\| /if (/' src/vues/plein-ciel.js
     ATTENDU="un glissement vers le bas referme" ;;
  344) # Échap ne referme plus.
     perl -0pi -e 's/window\.addEventListener\("keydown", ev => \{ if \(ev\.key === "Escape" && ouvert\) fermer\(\); \}\);//' src/vues/plein-ciel.js
     ATTENDU="la touche Échap referme" ;;
  345) # Tout le ciel ouvre le Soleil.
     perl -0pi -e 's/<= rayon \* 1\.3\) \{/<= rayon * 100) {/' src/vues/plein-ciel.js
     ATTENDU="un toucher dans le ciel loin de l.astre n.ouvre rien" ;;
  346) # La vignette n'ouvre plus rien.
     perl -0pi -e 's/  if \(vignette\) return \{ cv: vignette, sorte: vignette\.id === "ptLune" \? "lune" : "soleil" \};\n//' src/vues/plein-ciel.js
     ATTENDU="la vignette de la sous-ligne ouvre aussi le Soleil" ;;
  347) # Le bouton caché n'ouvre plus rien.
     perl -0pi -e 's/  const bouton = cible\.closest\("\[data-plein-ciel\]"\);/  const bouton = null;/' src/vues/plein-ciel.js
     ATTENDU="le bouton caché ouvre le Soleil au clavier" ;;
  348) # Le ciel de l'accueil n'ouvre plus le Soleil.
     perl -0pi -e 's/if \(!cv \|\| !cv\.closest\("#ecran"\)\) continue;/if (!cv || !cv.closest("#ecran") || cv.closest(".plein-accueil")) continue;/' src/vues/plein-ciel.js
     ATTENDU="le Soleil du ciel de l.accueil s.ouvre aussi" ;;
  349) # La Lune ouverte dit sa part éclairée en dixièmes.
     perl -0pi -e 's/grand: `\$\{Math\.round\(ph\.eclairee \* 100\)\}`,/grand: `\${Math.round(ph.eclairee * 10)}`,/' src/vues/plein-ciel.js
     ATTENDU="la Lune s.ouvre en plein ciel avec sa part éclairée, son passage et ses phases" ;;
  350) # Le Soleil ouvert se dessine à pleine densité.
     perl -0pi -e 's/ data-dpr-max="1\.5"//' src/vues/plein-ciel.js
     ATTENDU="le Soleil ouvert se dessine à densité bornée" ;;
  351) # Une Lune décroissante se pose à gauche, sa part éclairée hors de l'écran.
     perl -0pi -e 's/\(sorte === "lune" && \/décroissante\|Dernier\/\.test\(nomPhase\) \? "droite" : "gauche"\)/"gauche"/' src/vues/plein-ciel.js
     ATTENDU="une Lune décroissante se pose sur le bord droit" ;;
  352) # Le pas de décalage d'un nom retombe à treize points.
     perl -0pi -e 's/\? \[0, h, -h, 2 \* h\] : \[0, h, -h\]/? [0, 13, -13, 26] : [0, 13, -13]/' src/voute.js
     ATTENDU="les noms se posent sans se chevaucher" ;;
  353) # La Voie lactée perd la Grande Faille.
     perl -0pi -e 's/const faille = \(l > 10 && l < 90\) \?/const faille = false ?/' src/voute.js
     ATTENDU="la Voie lactée est plus dense vers le Sagittaire et creusée par la Grande Faille" ;;
  354) # La visée ne dit plus « sous les pieds ».
     perl -0pi -e 's/ : haut < -80 \? "Sous les pieds"//' src/vues/etoiles.js
     ATTENDU="la visée se dit sous les pieds" ;;
  355) # Le chemin confond la droite et la gauche.
     perl -0pi -e 's/\(daz > 0 \? "à droite" : "à gauche"\)/(daz > 0 ? "à gauche" : "à droite")/' src/vues/etoiles.js
     ATTENDU="le chemin vers une constellation se dit par sa direction et sa distance" ;;
  356) # La recherche range les constellations sous l'horizon parmi les visibles.
     perl -0pi -e 's/visibles: l\.filter\(x => x\.hauteur > 0\)/visibles: l.filter(x => x.hauteur > -90)/' src/vues/etoiles.js
     ATTENDU="la recherche range les visibles par hauteur" ;;
  357) # La recherche tient compte des accents.
     perl -0pi -e 's/const sansAccent = t => t\.normalize\("NFD"\)\.replace\(\/\[\\u0300-\\u036f\]\/g, ""\)\.toLowerCase\(\);/const sansAccent = t => t.toLowerCase();/' src/vues/etoiles.js
     ATTENDU="la recherche ignore les accents" ;;
  358) # La nébulosité se lit à la mauvaise heure.
     perl -0pi -e 's/const cle = cleHeure\(instant\);/const cle = cleHeure(new Date(instant.getTime() + 864e5 * 400));/' src/vues/etoiles.js
     ATTENDU="la nébulosité prévue se lit à l.heure" ;;
  359) # Le regard s'arrête de nouveau à cinq degrés.
     perl -0pi -e 's/export const HAUT_MIN = -89,/export const HAUT_MIN = 5,/' src/vues/etoiles.js
     ATTENDU="le regard descend jusque sous les pieds" ;;
  360) # Le zoom ne dit plus le champ.
     perl -0pi -e 's/const champ = performance\.now\(\) - champVu < 1500 \?/const champ = false ?/' src/vues/etoiles.js
     ATTENDU="le zoom resserre le champ et le dit" ;;
  361) # La recherche ne sépare plus les deux groupes.
     perl -0pi -e 's/\+ \(cachees\.length \? `<li class="ci-groupe">Sous l.horizon, \$\{cachees\.length\}<\/li>` \+ cachees\.map\(ligne\)\.join\(""\) : ""\)/+ cachees.map(ligne).join("")/' src/vues/etoiles.js
     ATTENDU="la recherche sépare les constellations visibles et celles sous l.horizon" ;;
  362) # La flèche ne dit plus la direction.
     perl -0pi -e 's/cibleNom\.textContent = `\$\{d\[0\]\}, \$\{c\.hauteur/cibleNom.textContent = `\${d[0]} est là\${c.hauteur/' src/vues/etoiles.js
     ATTENDU="une constellation cherchée hors du champ se signale avec sa direction" ;;
  363) # « Y aller » ne bouge plus le regard.
     perl -0pi -e 's/vue\.az = a0 \+ ch\.daz \* e; vue\.haut = h0 \+ dh \* e;/vue.az = a0; vue.haut = h0;/' src/vues/etoiles.js
     ATTENDU="« Y aller » amène le regard sur la constellation cherchée" ;;
  364) # « Oublier » ne retire plus la recherche.
     perl -0pi -e 's/vue\.cible = null; cibleBarre\.hidden = true; redessiner\(\);/redessiner();/' src/vues/etoiles.js
     ATTENDU="« Oublier » retire la recherche" ;;
  365) # La lumière rouge ne s'applique plus.
     perl -0pi -e 's/fe\.classList\.toggle\("ci-rouge", on\);//' src/vues/etoiles.js
     ATTENDU="la lumière rouge passe tout l.écran au rouge" ;;
  366) # Le rail du curseur ne porte plus la nébulosité.
     perl -0pi -e 's/const c = nuagesA\(instantDe\(Math\.round\(\(k \+ 0\.5\) \/ 40 \* pas\)\)\);/const c = null;/' src/vues/etoiles.js
     ATTENDU="le rail du curseur porte la nébulosité de la nuit" ;;
  367) # La lecture ne fait plus défiler la nuit.
     perl -0pi -e 's/curseur\.value = String\(\(Number\(curseur\.value\) \+ 1\) % \(pas \+ 1\)\);/curseur.value = curseur.value;/' src/vues/etoiles.js
     ATTENDU="la lecture fait défiler la nuit" ;;
  368) # L'eau ne se peint plus sous l'horizon.
     perl -0pi -e 's/    ctx\.fillStyle = prof; ctx\.fill\(eau\);\n//' src/voute.js
     ATTENDU="sous l.horizon, une étendue d.eau laisse deviner les étoiles" ;;
  369) # La voûte reprend la densité entière de l'écran.
     perl -0pi -e 's/const dpr = Math\.min\(2, window\.devicePixelRatio \|\| 1\);/const dpr = window.devicePixelRatio || 1;/' src/voute.js
     ATTENDU="toute toile plafonne sa densité à 2" ;;
  370) # L'eau ne tient plus compte du nadir.
     perl -0pi -e 's/    if \(!pn \|\| !dansPolygone\(pn, pts\)\) chemin\.rect\(-10, -10, W \+ 20, H \+ 20\);\n//' src/voute.js
     ATTENDU="l.eau est le côté de l.horizon qui contient le nadir" ;;
  371) # L'inverse de la projection se trompe de sens.
     perl -0pi -e 's/  const x = ux \* r, y = -uy \* r;/  const x = ux * r, y = uy * r;/' src/voute.js
     ATTENDU="l.inverse de la projection rend le point du ciel sous les doigts" ;;
  372) # Le plein écran laisse de nouveau zoomer la page.
     perl -0pi -e 's/background:#070a2c;touch-action:none\}/background:#070a2c}/' styles.css
     ATTENDU="le plein écran ne laisse au navigateur ni pincement ni double toucher" ;;
  373) # Le voile des nuages ne se garde plus.
     perl -0pi -e 's/export function poserVoileCiel\(v\) \{ poser\(\{ voileCiel: v === true \}\); \}/export function poserVoileCiel(v) {}/' src/reglages.js
     ATTENDU="le voile des nuages se coupe d.un bouton et le choix se garde" ;;
  374) # Le pincement redevient proportionnel.
     perl -0pi -e 's/export const PINCE = 0\.7;/export const PINCE = 1;/' src/vues/etoiles.js
     ATTENDU="le pincement est adouci" ;;
  375) # Le bandeau peint de nouveau sous l'eau.
     perl -0pi -e 's/  const sousEau = options\.sousHorizon !== false;/  const sousEau = true;/' src/voute.js
     ATTENDU="le bandeau ne peint rien sous l.eau" ;;
  376) # Le reflet de l'eau redevient une bande horizontale.
     perl -0pi -e 's/      surface\.ligne\.forEach\(\(\[x, y\], i\) => \(i \? ctx\.lineTo\(x, y\) : ctx\.moveTo\(x, y\)\)\);/      ctx.moveTo(-10, surface.haut + 30); ctx.lineTo(1e4, surface.haut + 30);/' src/voute.js
     ATTENDU="vers le zénith, le reflet de l.eau suit l.horizon sans faire de bande" ;;
  377) # Les cumuls d'heures prennent les premières heures au lieu des dernières.
     perl -0pi -e 's/x\[k\]\.slice\(-h\)/x[k].slice(0, h)/' src/passe.js
     ATTENDU="les heures donnent cumuls, plus forte rafale et extrêmes" ;;
  378) # La pluie passée quitte la famille de l'eau.
     perl -0pi -e 's/\{ cle: "pluiepassee", famille: "eau"/{ cle: "pluiepassee", famille: "ciel"/' src/vues/carte-gabarit.js
     ATTENDU="le panneau porte la pluie, la neige, les rafales et les extrêmes passés" ;;
  379) # La nappe passée lit la grille prévue.
     perl -0pi -e 's/n\.source === "passee" \? \(E\.grillePassee && E\.grillePassee\.pas === n\.pas \? E\.grillePassee : null\)/n.source === "passee" ? E.prevueVue/' src/vues/carte-couches.js
     ATTENDU="la pluie passée s.ouvre sur 48 heures" ;;
  380) # Changer de période relit la grille.
     perl -0pi -e 's/  if \(g && t < g\.exp\) return g\.p;\n//' src/passe.js
     ATTENDU="le curseur passé à 72 heures relit la même grille sans requête" ;;
  381) # La rangée « Par-dessus » repasse à trois colonnes.
     perl -0pi -e 's/  display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:2px;/  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;/' styles.css
     ATTENDU="toutes les tuiles du panneau se voient d.un coup" ;;
  382) # Les jours comptent le jour présent, à moitié prévu.
     perl -0pi -e 's/x\[k\]\.slice\(0, -1\)\.slice\(-jours\)/x[k].slice(-jours)/' src/passe.js
     ATTENDU="à une semaine, les jours se lisent d.une requête" ;;
  383) # Une réponse longue arrivée en dernier prend la place de la période choisie.
     perl -0pi -e 's/if \(!cv\.isConnected \|\| Reglages\.periodePasse\(\) !== pas\) return;/if (!cv.isConnected) return;/' src/vues/carte-couches.js
     ATTENDU="un curseur glissé vite garde la dernière période choisie" ;;
  384) # Un appui sur le curseur replie la légende.
     perl -0pi -e 's/el\.closest\("\.ca-periode"\)\.addEventListener\("click", e => e\.stopPropagation\(\)\);//' src/vues/carte-couches.js
     ATTENDU="le curseur passé à 72 heures relit la même grille sans requête et ne replie pas la légende" ;;
  385) # Le choix du plus bas ne change pas le champ peint.
     perl -0pi -e 's/n\.champ = extreme;/n.champ = "chaud";/' src/vues/carte-gabarit.js
     ATTENDU="les extrêmes passent du plus haut au plus bas" ;;
  386) # L'ancien choix de la pluie des 72 heures se perd.
     perl -0pi -e 's/if \(ANCIENNES\[etat\.nappe\]\) etat/if (false) etat/' src/reglages.js
     ATTENDU="la pluie des 72 heures choisie en version 179" ;;
  387) # La grille lâche oublie le bord est.
     perl -0pi -e 's/Math\.round\(k \* \(n - 1\) \/ \(m - 1\)\)/Math.min(2 * k, n - 2)/' src/passe.js
     ATTENDU="les jours se lisent sur 110 points" ;;
  388) # La plage des feux commence un jour trop tôt.
     perl -0pi -e 's/jourDe\(fin - \(n - 1\) \* 86400000\)/jourDe(fin - n * 86400000)/' src/feux.js
     ATTENDU="la couche demande au départ sept jours, jusqu.au jour même" ;;
  389) # Les surfaces brûlées ne se demandent plus.
     perl -0pi -e 's/for \(const couche of \[BRULE, COUCHE\]\)/for (const couche of [COUCHE])/' src/feux.js
     ATTENDU="les tuiles se demandent en projection de Mercator, foyers et surfaces brûlées" ;;
  390) # Le curseur des feux ne règle pas la période peinte.
     perl -0pi -e 's/Feux\.pasDe\(Reglages\.periodeFeux\(\)\)\.jours\);/2);/' src/vues/carte-couches.js
     ATTENDU="le curseur des feux demande trois mois en une plage" ;;
  391) # L'échelle reste celle d'une journée quelle que soit la période.
     perl -0pi -e 's/n\.arrets = ECHELLES_PASSE\[n\.champ\]\[pas\.cle\];/n.arrets = ECHELLES_PASSE[n.champ]["24h"];/' src/vues/carte-gabarit.js
     ATTENDU="à 30 jours, la même lecture des jours sert, l.échelle s.élargit" ;;
  392) # La neige passée peint la pluie.
     perl -0pi -e 's/n\.champ = pluie \? "pluie" : "neige";/n.champ = "pluie";/' src/vues/carte-gabarit.js
     ATTENDU="la neige passée suit la même période" ;;
  393) # La rafale passée devient une somme.
     perl -0pi -e 's/g\.rafales\[i\] = plus\(de\("wind_gusts_10m"\)\);/g.rafales[i] = somme(de("wind_gusts_10m"));/' src/passe.js
     ATTENDU="les heures donnent cumuls, plus forte rafale" ;;
  394) # Les foyers gardent la couleur d'âge du service.
     perl -0pi -e 's/ctx\.drawImage\(e\.peinte \|\| e\.img,/ctx.drawImage(e.img,/' src/feux.js
     ATTENDU="sur trois mois, les foyers restent du rouge de la légende" ;;
  395) # Les foyers d'une période longue restent pleins.
     perl -0pi -e 's/ctx\.globalAlpha = couche === COUCHE \? opaciteFoyers\(n\) : 1;/ctx.globalAlpha = 1;/' src/feux.js
     ATTENDU="sur trois mois, les foyers restent du rouge de la légende" ;;
  396) # Les surfaces brûlées gardent le rouge du service.
     perl -0pi -e 's/e\.peinte = teindre\(e\.img, couche === COUCHE \? TEINTE : TEINTE_BRULE\);/e.peinte = couche === COUCHE ? teindre(e.img, TEINTE) : null;/' src/feux.js
     ATTENDU="sur trois mois, les foyers restent du rouge de la légende" ;;
  397) # La couche des feux s'ouvre encore sur deux jours.
     perl -0pi -e 's/etat\.periodefeux : "7j"\);/etat.periodefeux : "2j");/' src/reglages.js
     ATTENDU="la couche demande au départ sept jours, jusqu.au jour même" ;;
  398) # La suite ne demande que le choix automatique.
     perl -0pi -e 's/&models=\$\{MODELES\.join\(","\)\}//' src/pluieproche.js
     ATTENDU="la suite lit six modèles en une requête" ;;
  399) # Un seul modèle suffit à dire la pluie.
     perl -0pi -e 's/export const MAJORITE = 0\.5;/export const MAJORITE = 0.01;/' src/pluieproche.js
     ATTENDU="une pluie qu.une minorité des modèles voit se marque possible" ;;
  400) # La force prend le plus fort des modèles au lieu de la médiane.
     perl -0pi -e 's/const taux = mediane\(mouilles\) \* parHeure;/const taux = Math.max(...mouilles) * parHeure;/' src/pluieproche.js
     ATTENDU="la pluie se lit à la majorité des modèles" ;;
  401) # L'encart tait l'accord des modèles.
     perl -0pi -e 's/const dapres = ev\.total > 1 \?/const dapres = false ?/' src/pluieproche.js
     ATTENDU="une pluie que la moitié des modèles voit se dit avec l.accord" ;;
  402) # Une pluie de faible accord se peint pleine.
     perl -0pi -e 's/poser\(radar \? "modele" : "eau", x\.i, de, a, part !== null && part < 0\.75\);/poser(radar ? "modele" : "eau", x.i, de, a, false);/' src/app.js
     ATTENDU="une pluie que la moitié des modèles voit se dit avec l.accord et se peint plus pâle" ;;
  403) # La pluie possible ne se marque pas.
     perl -0pi -e 's/if \(!pluie\) \{ poser\("possible", 0, de, a\); return; \}/if (!pluie) return;/' src/app.js
     ATTENDU="une pluie qu.une minorité des modèles voit se marque possible" ;;
  404) # Un modèle sans valeur compte comme sec.
     perl -0pi -e 's/const vals = colonnes\.map\(c => c\[k\]\)\.filter\(Number\.isFinite\);/const vals = colonnes.map(c => c[k] ?? 0);/' src/pluieproche.js
     ATTENDU="la pluie se lit à la majorité des modèles" ;;
  405) # Un pixel transparent se lit comme une pluie.
     perl -0pi -e 's/  if \(a < 16\) return null;\n  let bon = null, ecart = Infinity;/  let bon = null, ecart = Infinity;/' src/deplacement.js
     ATTENDU="la couleur du radar se lit en dBZ" ;;
  406) # La pluie modérée disparaît des classes du radar.
     perl -0pi -e 's/z < 29 \? 2 : z < 37 \? 3 : 4\)/z < 37 ? 2 : 4)/' src/deplacement.js
     ATTENDU="la couleur du radar se lit en dBZ" ;;
  407) # Le profil lit l'aval au lieu de l'amont.
     perl -0pi -e 's/const cx = px - vx \* tau, cy = py - vy \* tau;/const cx = px + vx * tau, cy = py + vy * tau;/' src/deplacement.js
     ATTENDU="le profil pousse la dernière image" ;;
  408) # Le profil invente du sec au delà du bord de la tuile.
     perl -0pi -e 's/    if \(dehors\) break;\n    mouilles\.sort/    if (dehors) { out.push(0); continue; }\n    mouilles.sort/' src/deplacement.js
     ATTENDU="le profil pousse la dernière image" ;;
  409) # Le déplacement compte pleinement jusqu'au bout.
     perl -0pi -e 's/Math\.max\(0, Math\.min\(1, \(FONDU\.nul - minutes\) \/ \(FONDU\.nul - FONDU\.plein\)\)\)/(minutes < FONDU.nul ? 1 : 0)/' src/pluieproche.js
     ATTENDU="le déplacement compte pleinement jusqu.à une heure" ;;
  410) # La mesure ne rend pas le profil.
     perl -0pi -e 's/profil: profilDe\(db, px, py, bon\.dx, bon\.dy, minutes\)/profil: []/' src/deplacement.js
     ATTENDU="la mesure rend le profil" ;;
  411) # L'accueil ne fond pas le déplacement dans la suite.
     perl -0pi -e 's/const l = Pluie\.avecDeplacement\(pluieProche, deplacement, maintenant\);/const l = pluieProche;/' src/app.js
     ATTENDU="le ruban fond le déplacement dans la suite" ;;
  412) # Une pluie apportée par le déplacement se dit venue des modèles.
     perl -0pi -e 's/  if \(ev\.radar\) \{/  if (false) {/' src/pluieproche.js
     ATTENDU="une pluie apportée par le déplacement le dit" ;;
  413) # La mesure ne part que sur une pluie annoncée.
     perl -0pi -e 's/!\(Pluie\.annonce\(pluieProche\) \|\| indice\)/!Pluie.annonce(pluieProche)/' src/app.js
     ATTENDU="un seul modèle qui voit de la pluie fait partir la mesure" ;;
  414) # La piste n'a pas d'images poussées.
     perl -0pi -e 's/for \(let k = 1; k <= POUSSEES; k\+\+\)/for (let k = 1; k <= 0; k++)/' src/vues/carte-chronologie.js
     ATTENDU="sans image extrapolée la chronologie s.ouvre sur maintenant" ;;
  415) # L'image poussée se pose sans décalage.
     perl -0pi -e 's/const x = t\.px - marge \+ sx, y = t\.py - marge \+ sy;/const x = t.px - marge, y = t.py - marge;/' src/radar.js
     ATTENDU="l.image poussée se pose décalée" ;;
  416) # L'image poussée ne prend rien d'au delà du bord.
     perl -0pi -e 's/const marge = Math\.min\(Math\.max\(Math\.abs\(sx\), Math\.abs\(sy\)\), 1\.5 \* Math\.max\(l, h\)\);/const marge = 0;/' src/radar.js
     ATTENDU="l.image poussée se pose décalée" ;;
  417) # Les images poussées ne se fondent pas dans la pluie prévue.
     perl -0pi -e 's/if \(\(c\.prevue \|\| c\.pousse\) && !E\.prevue\) E\.lirePrevue\?\.\(\);/if (c.prevue \&\& !E.prevue) E.lirePrevue?.();/' src/vues/carte-chronologie.js
     ATTENDU="les images poussées suivent la dernière observée" ;;
  418) # Le déplacement de la carte se mesure d'abord sur une tuile voisine.
     perl -0pi -e 's/\[\[0, 0\], \[-1, 0\], \[1, 0\], \[0, -1\], \[0, 1\]\]/[[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]]/' src/deplacement.js
     ATTENDU="l.ouverture ne charge qu.une image" ;;
  419) # La piste de la carte ignore PIAF malgré la clé.
     perl -0pi -e 's/if \(radar\.length && Piaf\.actif\(\) && /if (false \&\& radar.length \&\& Piaf.actif() \&\& /' src/vues/carte-chronologie.js
     ATTENDU="avec la clé, la piste porte les échéances de PIAF" ;;
  420) # Une échéance de PIAF ne se peint pas.
     perl -0pi -e 's/if \(cadre\?\.piaf\) return Piaf\.peindre\(c, v, l, h, cadre\.t, \(\) => E\.revoir\(\)\);/if (cadre?.piaf) return 0;/' src/vues/carte-chronologie.js
     ATTENDU="une échéance de PIAF se peint sur la carte" ;;
  421) # L'accueil garde la suite des modèles malgré PIAF.
     perl -0pi -e 's/  if \(d && piaf\) d\.suite = suitePiaf\(piaf, finDe\(d\.pas\)\);\n//' src/pluieproche.js
     ATTENDU="avec la clé, l.encart annonce la pluie que PIAF prévoit" ;;
  422) # L'encart ne dit pas que la pluie vient de PIAF.
     perl -0pi -e 's/  if \(ev\.piaf\) return "d.après la prévision immédiate de Météo-France";\n//' src/pluieproche.js
     ATTENDU="avec la clé, l.encart annonce la pluie que PIAF prévoit" ;;
  423) # Le TIFF ne se lit que sur sa première bande.
     perl -0pi -e 's/for \(let s = 0; s < tags\[273\]\.length && k < valeurs\.length; s\+\+\)/for (let s = 0; s < 1 \&\& k < valeurs.length; s++)/' src/piaf.js
     ATTENDU="le TIFF du service se lit" ;;
  424) # Le compteur laisse tout partir.
     perl -0pi -e 's/export const PAR_MINUTE = 45;/export const PAR_MINUTE = 1000;/' src/piaf.js
     ATTENDU="le compteur laisse partir quarante-cinq requêtes" ;;
  425) # La clé saisie ne se garde pas.
     perl -0pi -e 's/export function poserClePiaf\(v\) \{ poser\(\{ clepiaf: /export function poserClePiaf(v) { poser({ clepiaf: null \&\& /' src/reglages.js
     ATTENDU="la clé se saisit dans les réglages" ;;
  426) # Le point se demande sans la clé.
     perl -0pi -e 's/\$\{avecCle\(WCS, cle\)\}&service=WCS/\${WCS}?service=WCS/' src/piaf.js
     ATTENDU="avec la clé, l.encart annonce la pluie que PIAF prévoit" ;;
  427) # La politique de la page ne permet pas le service de PIAF.
     perl -0pi -e 's/ https:\/\/view\.eumetsat\.int https:\/\/api\.meteofrance\.fr; worker-src/ https:\/\/view.eumetsat.int; worker-src/' index.html
     ATTENDU="avec la clé, l.encart annonce la pluie que PIAF prévoit" ;;
  428) # La clé de l'image de carte passe en dernière place.
     perl -0pi -e 's/\$\{avecCle\(WMS, cle\)\}&service=WMS/\${WMS}?service=WMS/; s/&time=\$\{iso\(t\)\}`;/\&time=\${iso(t)}\&apikey=\${encodeURIComponent(cle || "")}`;/' src/piaf.js
     ATTENDU="une échéance de PIAF se peint sur la carte" ;;
  429) # La station se choisit sans regarder l'altitude.
     perl -0pi -e 's/    if \(Number\.isFinite\(altitude\) && Number\.isFinite\(alt\) && Math\.abs\(alt - altitude\) > ECART_ALTITUDE\) continue;\n//' src/observations.js
     ATTENDU="la station retenue est la plus proche" ;;
  430) # La station se choisit à n'importe quelle distance.
     perl -0pi -e 's/    if \(d > DISTANCE_MAX\) continue;\n//' src/observations.js
     ATTENDU="la station retenue est la plus proche" ;;
  431) # La température reste en kelvins.
     perl -0pi -e 's/Math\.round\(\(x\.t - 273\.15\) \* 10\) \/ 10/Math.round(x.t * 10) \/ 10/' src/observations.js
     ATTENDU="le paquet se lit en degrés" ;;
  432) # L'heure de la mesure reste en UTC.
     perl -0pi -e 's/const h = cleHeure\(new Date\(x\.validity_time\)\)\.slice\(0, 13\);/const h = x.validity_time.slice(0, 13);/' src/observations.js
     ATTENDU="le paquet se lit en degrés et à l.heure de Paris" ;;
  433) # Le journal ne reçoit pas les mesures.
     perl -0pi -e 's/if \(o\) Justesse\.releverStation\(o, Justesse\.lieuDe\(g\.lat, g\.lon\)\);/if (false) Justesse.releverStation(o, Justesse.lieuDe(g.lat, g.lon));/' src/app.js
     ATTENDU="avec la clé, les lignes du journal reçoivent la mesure" ;;
  434) # La justesse ignore les mesures des stations.
     perl -0pi -e 's/const vrai = l => \(Number\.isFinite\(l\.o\) \? l\.o : l\.r\);/const vrai = l => l.r;/' src/justesse.js
     ATTENDU="les réglages disent la fin de la clé, la station et la justesse mesurée" ;;
  435) # La pluie se dit toujours juste.
     perl -0pi -e 's/pl\.filter\(l => \(l\.mm >= SEUIL_PLUIE\) === \(l\.ro >= SEUIL_PLUIE\)\)/pl.filter(l => true)/' src/justesse.js
     ATTENDU="les réglages disent la fin de la clé, la station et la justesse mesurée" ;;
  436) # Le rappel de la clé ne vient que trois jours avant.
     perl -0pi -e 's/export const RAPPEL_CLE = 30 \* 86400000;/export const RAPPEL_CLE = 3 * 86400000;/' src/reglages.js
     ATTENDU="la clé qui expire dans le mois se signale" ;;
  437) # Les échéances de la météo des forêts se décalent d'un jour.
     perl -0pi -e 's/if \(jour === jourDe\(carte\.ref, 1\)\) return d\.j1;/if (jour === jourDe(carte.ref, 0)) return d.j1;/' src/foret.js
     ATTENDU="la carte se lit par département" ;;
  438) # Un département à un chiffre ne se retrouve pas.
     perl -0pi -e 's/return \/\^\\d\$\/\.test\(s\) \? `0\$\{s\}` : s;/return s;/' src/foret.js
     ATTENDU="la carte se lit par département" ;;
  439) # Le danger élevé ne se dit pas, seul le très élevé.
     perl -0pi -e 's/if \(!\(n >= 3\)\) return null;/if (!(n >= 4)) return null;/' src/app.js
     ATTENDU="le danger d.incendie élevé se dit aujourd.hui" ;;
  440) # Le danger de demain ne se dit pas.
     perl -0pi -e 's/      \.\.\.\(foret && depForet \? \[danger\(cleJour\(new Date\(Date\.now\(\) \+ 86400000\)\), "demain"\)\]\.filter\(Boolean\) : \[\]\),\n//' src/app.js
     ATTENDU="le danger d.incendie élevé se dit aujourd.hui et le très élevé demain" ;;
  441) # La tuile du danger d'incendie paraît sans clé.
     perl -0pi -e 's/\(!n\.cleRequise \|\| Reglages\.clePiaf\(\)\)/true/' src/vues/carte-gabarit.js
     ATTENDU="sans clé, la météo des forêts ne se demande pas et sa tuile ne paraît pas" ;;
  442) # Le danger d'incendie prend la palette des restrictions d'eau.
     perl -0pi -e 's/foretNiveaux, \{ palette: "vf" \}/foretNiveaux, { palette: "ve" }/' src/vues/carte-couches.js
     ATTENDU="chaque département se teinte de son niveau du jour" ;;
  443) # Une carte hors saison se dit du jour.
     perl -0pi -e 's/dit: `le \$\{d\}, hors saison`/dit: "aujourd.hui"/' src/foret.js
     ATTENDU="hors saison, l.accueil se tait et la carte dit la date" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

# Une erreur qui ne modifie rien ne prouve rien : la copie est comparée au
# dépôt, application, feuille de style, agent de service et manifeste compris.
if diff -rq "$OLD/src" src >/dev/null && diff -q "$OLD/styles.css" styles.css >/dev/null \
  && diff -q "$OLD/sw.js" sw.js >/dev/null && diff -q "$OLD/index.html" index.html >/dev/null \
  && diff -q "$OLD/manifest.webmanifest" manifest.webmanifest >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

# Depuis le 2 octobre 2026, chaque section part d'un état neuf : l'épreuve ne
# passe que la section qui porte le contrôle attendu. Faute de la trouver, le
# nom du contrôle étant composé, elle passe la suite jusqu'à JUSQUA.
SECTION=$(grep -l -- "$ATTENDU" essais/sections/*.mjs 2>/dev/null | head -1)
SECTION=$(basename "${SECTION:-}" .mjs)
if [ -n "$SECTION" ]; then JUSQUA=""; fi
SORTIE=$(CHROMIUM="${CHROMIUM:-}" \
  PORT_ESSAIS=$PORT_ESSAIS SECTIONS="$SECTION" JUSQUA="$JUSQUA" \
  borne 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-bande-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
elif ! echo "$SORTIE" | grep -q "ok     $ATTENDU"; then
  # La garde attendue n'a pas tourné du tout : la suite s'est interrompue avant
  # elle. Ce n'est pas une faute non vue, et le dire ainsi a déjà trompé : une
  # copie de travail effacée pendant l'épreuve avait fait conclure à tort.
  echo "ÉPREUVE $N INTERROMPUE avant la garde : $ATTENDU"
  echo "$SORTIE" | grep -v "^\s*at " | tail -3
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
