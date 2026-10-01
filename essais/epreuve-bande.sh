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
  32) # Le département n'est plus écrit.
     perl -0pi -e 's/  \$\("navLieuDep"\)\.textContent = nomDep \|\| "";\n//' src/app.js
     ATTENDU="l.en-tête porte le département sous la commune, sans grandir" ;;
  33) # Les cartes de l'accueil perdent leur arrondi.
     perl -0pi -e 's/\[data-bloc\] \.carte,\.portes \.porte\{border-radius:var\(--rayon-carte\)\}//' styles.css
     ATTENDU="les cartes de l.accueil prennent l.arrondi de 24 points" ;;
  34) # L'onglet « Le temps » revient dans la barre.
     perl -0pi -e 's/(  \["accueil", "maison", "Accueil"\],\n)/$1  ["temps", "horloge", "Le temps"],\n/' src/app.js
     ATTENDU="les destinations sont les bonnes" ;;
  35) # Le niveau de confiance ne paraît plus sur la ligne.
     perl -0pi -e 's/      \+ \(accord \? `<em class="sem-conf">/      + (false \&\& accord ? `<em class="sem-conf">/' src/vues.js
     ATTENDU="chaque journée à venir porte son niveau de confiance, en un mot" ;;
  36) # La barre ne s'estompe plus.
     perl -0pi -e 's/<s class="sem-plage\$\{accord \? ` sem-\$\{accord\}` : ""\}" `/<s class="sem-plage" `/' src/vues.js
     ATTENDU="la barre s.estompe aux journées moins sûres, et elles seules" ;;
  37) # La semaine perd son graphique.
     perl -0pi -e 's/    corps: grapheSemaine\(jours\)\n      \+ /    corps: ""\n      + /' src/vues.js
     ATTENDU="La semaine s.ouvre sur son graphique, un point par journée" ;;
  38) # Les jours passés ne sont plus atténués dans le graphique.
     perl -0pi -e 's/  const fonds = jours\.map\(\(j, k\) => \(j\.passe \|\| j\.auj\)/  const fonds = jours.map((j, k) => (j.auj)/' src/vues.js
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
     perl -0pi -e 's/\$\{weekEnd \? " sem-we" : ""\}//' src/vues.js
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
     perl -0pi -e 's/  return tete \+ lignes\n/  return tete + `<p class="note">12 jours relevés, sur les 60 qui assiéront les chiffres.<\/p>` + lignes\n/' src/vues.js
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
     perl -0pi -e 's/      \+ `<text class="sg-mm\$\{j\.passe \? " sg-p" : ""\}" x="\$\{x\(k\)\.toFixed\(1\)\}" y="\$\{\(pied - h - 3\)\.toFixed\(1\)\}">\$\{q\}<\/text>`;/      ;/' src/vues.js
     ATTENDU="la pluie du graphique porte sa quantité, en millimètres" ;;
  55) # La ligne du vent disparaît.
     perl -0pi -e 's/\+ fonds \+ pluie \+ vent \+ ligne/+ fonds + pluie + ligne/' src/vues.js
     ATTENDU="le graphique trace les rafales du jour, avec la flèche de leur direction" ;;
  56) # Le graphique tasse seize jours dans la largeur de l'écran.
     perl -0pi -e 's/  const defile = n > 10;/  const defile = n > 99;/' src/vues.js
     ATTENDU="sur seize jours, le graphique défile à colonnes fixes et nomme la seconde semaine" ;;
  57) # La confiance ne réunit plus les deux modèles.
     perl -0pi -e 's/const reunis = resume\(\[\.\.\.\(icon \? vi : \[\]\), \.\.\.\(ecmwf \? ve : \[\]\)\]\);/const reunis = resume(ecmwf ? ve : vi);/' src/scenarios.js
     ATTENDU="la confiance réunit les deux modèles où ils se recouvrent, ECMWF seul au-delà, rien après" ;;
  58) # Les seuils de l'ensemble horaire reviennent.
     perl -0pi -e 's/  \[4, "moyenne"\],\n  \[7, "faible"\],/  [3, "moyenne"],\n  [6, "faible"],/' src/scenarios.js
     ATTENDU="les seuils de la confiance quotidienne tombent à quatre et à sept degrés" ;;
  59) # La semaine ignore les scénarios quotidiens.
     perl -0pi -e 's/    const sc = k >= i \? Scenarios\.jour\(d\.time\[k\]\) : null;/    const sc = null;/' src/vues.js
     ATTENDU="La semaine tire sa confiance des deux modèles, et le volet les compare" ;;
  60) # Les scénarios quotidiens ne demandent plus que sept jours.
     # Sa garde est dans la section « Les scénarios » : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/^const JOURS = 15;/const JOURS = 7;/m' src/scenarios.js
     ATTENDU="les deux modèles se demandent ensemble, sur quinze jours" ;;
  61) # La phrase ne dit plus que les modèles s'écartent.
     perl -0pi -e 's/const accord = s\.ecart >= 2 \?/const accord = s.ecart >= 99 ?/' src/vues.js
     ATTENDU="la confiance dit quand les deux modèles s.écartent, et nomme ECMWF seul au-delà" ;;
  62) # La tendance ne voit plus les écarts de température.
     perl -0pi -e 's/const sens = ecart >= 2 \? "plus chaude" : ecart <= -2 \?/const sens = ecart >= 20 ? "plus chaude" : ecart <= -20 ?/' src/conseils.js
     ATTENDU="la semaine suivante se dit en une ligne de tendance, et seulement avec cinq jours" ;;
  63) # La tendance se colle à la charge sans écarter les dates déjà prévues.
     perl -0pi -e 's/  const plus = tend\.filter\(t => t\.date > dernier\);/  const plus = tend;/' src/vues.js
     ATTENDU="la tendance prolonge la charge quotidienne, sans doublon, le symbole tiré de la pluie" ;;
  64) # Le bouton « Voir plus » disparaît.
     perl -0pi -e 's/  const plusDispo = lim >= i;/  const plusDispo = false;/' src/vues.js
     ATTENDU="La semaine se déplie d.un « Voir plus » commun au graphique et à la liste, jusqu.à la tendance" ;;
  65) # Une journée de tendance affiche une moyenne de pluie.
     perl -0pi -e 's/    const eau = k >= nPrev \? \(pb >= 5/    const eau = false ? (pb >= 5/' src/vues.js
     ATTENDU="une journée de tendance dit la part de ses scénarios pluvieux, sans mot de confiance" ;;
  66) # Le plafond se cale de nouveau au point entier.
     perl -0pi -e 's/    const dx = \(\(t \* derive \* 0\.22\) % larg\) - larg;/    const dx = Math.round(((t * derive * 0.22) % larg) - larg);/' src/temps.js
     ATTENDU="le plafond du ciel couvert avance à chaque image, sans à-coup" ;;
  67) # L'onglet reprend son ancien nom.
     perl -0pi -e 's/  \["semaine", "semaine", "À venir"\],/  ["semaine", "semaine", "La semaine"],/' src/app.js
     ATTENDU="l.onglet des jours à venir s.appelle « À venir »" ;;
  68) # La rangée prise ne suit plus le doigt.
     # Sa garde est dans une section plus loin : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/    const suivre = \(\) => \{ el\.style\.transform = [^\n]*\n/    const suivre = () => {};\n/' src/vues.js
     ATTENDU="la rangée prise suit le doigt" ;;
  69) # La page reprend son ancien nom.
     perl -0pi -e 's/titre: "Heure par heure"/titre: "Le temps"/g' src/vues.js
     ATTENDU="la page des heures s.appelle « Heure par heure »" ;;
  70) # Le bandeau ne colle plus.
     perl -0pi -e 's/  position:sticky;top:calc\(env\(safe-area-inset-top, 0px\) \+ var\(--nav-haut\)\);z-index:3;/  position:relative;z-index:3;/' styles.css
     ATTENDU="un bandeau collant porte le jour et les heures, et glisse avec le ruban" ;;
  71) # Le trait continu de minuit disparaît.
     perl -0pi -e 's/<div class="mg">\$\{traits\}\$\{voies\.join\(""\)\}/<div class="mg">\${voies.join("")}/' src/ruban.js
     ATTENDU="un trait continu marque minuit sur toute la pile, sans pointillé dans chaque voie" ;;
  72) # La semaine commence le dimanche.
     perl -0pi -e 's/  const decal = \(d\.getDay\(\) \+ 6\) % 7;/  const decal = d.getDay();/' src/comparaison.js
     ATTENDU="la semaine va du lundi au dimanche, un 29 février devient le 28" ;;
  73) # La pluie se juge à la moindre différence.
     perl -0pi -e 's/  const pluie = Math\.abs\(p1 - p2\) >= 10/  const pluie = Math.abs(p1 - p2) >= 0.5/' src/comparaison.js
     ATTENDU="le bilan de la comparaison dit l.écart de température, et la pluie au-delà de dix millimètres" ;;
  74) # La carte de la comparaison n'est plus branchée.
     # Sa garde est dans la section du climat : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/      brancherComparaison\(bloc\.querySelector\("#clComparer"\), bloc, g, c, date\);\n//' src/vues.js
     ATTENDU="la feuille du climat compare les 7 derniers jours aux mêmes jours de l.an dernier, dans l.archive" ;;
  75) # Une semaine sans pluie notable nomme quand même un lieu arrosé.
     perl -0pi -e 's/  const pluie = arrose\.mm < 1 \? "sec partout"/  const pluie = arrose.mm < 0 ? "sec partout"/' src/comparaison.js
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
     perl -0pi -e 's/    cmp\.querySelector\("\.cmp-p-temps"\)\.addEventListener\("change", e => \{ periodeTemps = e\.target\.value; montrer\(\); \}\);\n//' src/vues.js
     ATTENDU="une période passée se lit dans l.archive jusqu.à hier, une période à venir dans la prévision dès demain" ;;
  80) # Les lieux du passé se lisent dans la prévision.
     # Sa garde est dans la section du climat : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/Comparaison\.lireLieux\(lieux, dates, Comparaison\.estPassee\(periodeLieux\)\)/Comparaison.lireLieux(lieux, dates, false)/' src/vues.js
     ATTENDU="la feuille du climat compare les 7 derniers jours entre lieux suivis, en une requête à l.archive" ;;
  81) # Une station a son pied au-dessus de son sommet.
     perl -0pi -e 's/\["Megève", "FR", 45\.8544, 6\.6575, 820, 2371,/["Megève", "FR", 45.8544, 6.6575, 2371, 820,/' src/stations.js
     ATTENDU="la liste des stations couvre la France et ses voisins, le pied sous le sommet, rangées sous leur domaine" ;;
  84) # Les stations ne sont plus rangées sous les Trois Vallées.
     perl -0pi -e 's/, "Les Trois Vallées"\]/, null]/g' src/stations.js
     ATTENDU="la liste des stations couvre la France et ses voisins, le pied sous le sommet, rangées sous leur domaine" ;;
  82) # Une station à dix heures de route passe pour proche.
     perl -0pi -e 's/^export const MINUTES_MAX = 60;/export const MINUTES_MAX = 600;/m' src/neige.js
     ATTENDU="les stations proches sont celles à une heure de route, en une requête à OSRM" ;;
  83) # Sans OSRM, plus aucune station.
     perl -0pi -e 's/  \} catch \{\n    return cands\.filter\(s => s\.vol <= KM_PAR_HEURE_ESTIMEE\)/  } catch {\n    return [];\n    return cands.filter(s => s.vol <= KM_PAR_HEURE_ESTIMEE)/' src/neige.js
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
     perl -0pi -e 's/^export const MINUTES_MAX = 60;/export const MINUTES_MAX = 600;/m' src/plage.js
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
     perl -0pi -e 's/  return \/\^\(est\|ouest\)\$\/\.test\(c\) \? `de l.\$\{c\}` : `du \$\{c\}`;/  return c;/' src/plage.js
     ATTENDU="le vent de la plage se dit par sa direction" ;;
  98) # La crise ne se range plus.
     perl -0pi -e 's/export const NIVEAUX = \["vigilance", "alerte", "alerte_renforcee", "crise"\];/export const NIVEAUX = ["vigilance", "alerte", "alerte_renforcee"];/' src/vigieau.js
     ATTENDU="les restrictions d.eau se rangent de la vigilance à la crise" ;;
  99) # La couche des restrictions d'eau n'est plus tracée.
     # Sa garde est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/const COUCHES = \[coucheEau, coucheVigiFond,/const COUCHES = [coucheVigiFond,/' src/vues.js
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
     perl -0pi -e 's/    \+ \(t \? `<p class="pl-lieu">Eau de la rivière/    + (false \&\& t ? `<p class="pl-lieu">Eau de la rivière/' src/vues.js
     ATTENDU="la feuille de l.eau dit l.étiage de la dernière campagne et la température récente de la rivière" ;;
  108) # Le plafond nuageux se pose en tuiles étroites qui ne se raccordent pas.
     # Sa vérification est dans la section du suivi de la position : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/    const larg = Math\.round\(haut \* \(pf\.width \/ pf\.height\)\);/    const larg = Math.round(haut * (pf.width \/ pf.height) \/ 4);/; s/bx\.drawImage\(pf, larg \* i, 0, larg \+ 1, haut\);/bx.drawImage(pf, 0, 0, pf.width \/ 2, pf.height, larg * i, 0, larg + 1, haut);/' src/temps.js
     ATTENDU="la couche se répète sans couture verticale" ;;
  109) # Il faudrait cinquante millimètres attendus pour renoncer à arroser.
     perl -0pi -e 's/  if \(sol\.pluie3 >= 5\) return/  if (sol.pluie3 >= 50) return/' src/eau.js
     ATTENDU="l.humidité du sol se classe, et le conseil d.arrosage suit la pluie attendue, la sécheresse et la restriction" ;;
  110) # Le conseil d'arrosage ne se dit plus dans la feuille.
     perl -0pi -e 's/    \+ `<p class="pl-lieu">\$\{esc\(Eau\.conseilArrosage\(s, r\)\)\}<\/p>`;/    + "";/' src/vues.js
     ATTENDU="la feuille de l.eau dit l.humidité du sol, la semaine écoulée, la pluie attendue et le conseil d.arrosage" ;;
  111) # Les étiquettes des prévisions ne s'effacent plus quand elles se chevauchent.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/          el\.hidden = dehors \|\| serre;/          el.hidden = dehors;/' src/vues.js
     ATTENDU="les prévisions des villes se posent sur la carte sans se chevaucher, au moment en cours" ;;
  112) # L'après-midi prend 15 h au lieu du maximum.
     perl -0pi -e 's/  const valeur = moment === "apres" \? Math\.max\(\.\.\.temps\) : h\.temperature_2m\[kr\];/  const valeur = h.temperature_2m[kr];/' src/villes.js
     ATTENDU="le temps d.une ville se lit pour chaque moment : 9 h, le maximum de l.après-midi, 21 h, le lendemain" ;;
  113) # Les plages de la carte ne s'espacent plus.
     perl -0pi -e 's/if \(out\.every\(q => distanceKm\(p\.lat, p\.lon, q\.lat, q\.lon\) >= ecart\)\) out\.push\(p\);/out.push(p);/' src/plage.js
     ATTENDU="les plages de la carte s.espacent de soixante kilomètres, les grands domaines de vingt-cinq, les plus grands d.abord" ;;
  114) # Les domaines sans neige portent une étiquette à 0 cm.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/neigeLue\.filter\(s => s\.sol > 0\)\.map/neigeLue.map/' src/vues.js
     ATTENDU="la mer et la neige se posent sur la carte avant les prévisions, sans chevauchement, sources citées" ;;
  115) # Les prévisions passent avant la mer et la neige.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/zonePrev\.innerHTML = neiges \+ mers \+ previs;/zonePrev.innerHTML = previs + neiges + mers;/' src/vues.js
     ATTENDU="la mer et la neige se posent sur la carte avant les prévisions, sans chevauchement, sources citées" ;;
  116) # Les cours d'eau se lisent sur la France entière.
     # Sa vérification est dans la section des nappes de la carte : lancer avec JUSQUA_EPREUVE.
     perl -0pi -e 's/const ZOOM_RIVIERES = 7\.5;/const ZOOM_RIVIERES = 0;/' src/vues.js
     ATTENDU="les cours d.eau ne se lisent qu.en zoomant, et chaque station dit sa hauteur et sa tendance" ;;
  117) # L'écart d'une station se lit à l'envers.
     perl -0pi -e 's/    ecart: e\.recent\.resultat_obs - e\.ancien\.resultat_obs \}\)\);/    ecart: e.ancien.resultat_obs - e.recent.resultat_obs }));/' src/eau.js
     ATTENDU="les cours d.eau d.un cadre se regroupent par station, la hauteur la plus récente et l.écart sur six heures" ;;
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
  && diff -q "$OLD/src/fleche.js" src/fleche.js >/dev/null \
  && diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/src/justesse.js" src/justesse.js >/dev/null \
  && diff -q "$OLD/src/temps.js" src/temps.js >/dev/null \
  && diff -q "$OLD/src/previsions.js" src/previsions.js >/dev/null \
  && diff -q "$OLD/src/scenarios.js" src/scenarios.js >/dev/null \
  && diff -q "$OLD/src/ruban.js" src/ruban.js >/dev/null \
  && diff -q "$OLD/src/comparaison.js" src/comparaison.js >/dev/null \
  && diff -q "$OLD/src/neige.js" src/neige.js >/dev/null \
  && diff -q "$OLD/src/stations.js" src/stations.js >/dev/null \
  && diff -q "$OLD/src/plages.js" src/plages.js >/dev/null \
  && diff -q "$OLD/src/plage.js" src/plage.js >/dev/null \
  && diff -q "$OLD/src/trajets.js" src/trajets.js >/dev/null \
  && diff -q "$OLD/src/vigieau.js" src/vigieau.js >/dev/null \
  && diff -q "$OLD/src/eau.js" src/eau.js >/dev/null \
  && diff -q "$OLD/src/temps.js" src/temps.js >/dev/null \
  && diff -q "$OLD/src/villes.js" src/villes.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM="${CHROMIUM:-}" \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
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
