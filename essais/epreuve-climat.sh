#!/bin/bash
# Épreuve des gardes du climat de la commune.
# Usage : essais/epreuve-climat.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-climat
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/climat.js src/vues.js src/app.js src/icones.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/climat.js" "$SAUVE/src/vues.js" "$SAUVE/src/app.js" \
  "$SAUVE/src/icones.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Lire l'archive au rendu de l'accueil et non à l'ouverture de la feuille.
     perl -0pi -e 's/(export function bandeauAccueil\(g, maintenant, p, vent\) \{\n)/$1  Climat.charger(g.lat, g.lon, "2026-08-18");\n/' src/vues.js
     ATTENDU="l'archive n'est pas lue tant que la feuille n'est pas ouverte" ;;
  2) # Faire mener la porte du climat à une autre feuille.
     perl -0pi -e 's/  air: vueAir, climat: vueClimat \};/  air: vueAir, climat: vueAir };/' src/app.js
     ATTENDU="la feuille du climat s'ouvre depuis l'accueil" ;;
  3) # Redemander l'archive longue à chaque ouverture : la réserve n'est plus lue.
     perl -0pi -e 's/  let base = garde\(c\);/  let base = null;/' src/climat.js
     ATTENDU="rouvrir la feuille ne redemande pas l'archive longue" ;;
  4) # Faire commencer l'archive longue en 1980.
     perl -0pi -e 's/export const DEBUT = 1950;/export const DEBUT = 1980;/' src/climat.js
     ATTENDU="l'archive longue va de 1950 à la fin de l'année écoulée" ;;
  5) # Faire partir la série récente au 1er janvier : l'hiver perd son décembre.
     perl -0pi -e 's/  q\.set\("start_date", `\$\{annee - 1\}-12-01`\);/  q.set("start_date", `\${annee}-01-01`);/' src/climat.js
     ATTENDU="la série récente part du 1er décembre d'avant et s'arrête aujourd'hui" ;;
  6) # Comparer le maximum de la charge quotidienne et non celui de la série horaire.
     perl -0pi -e 's/      const max = h \? h\.tx\n        : \(c && iJ >= 0 \? c\.daily\.temperature_2m_max\[iJ\] : null\);/      const max = c \&\& iJ >= 0 ? c.daily.temperature_2m_max[iJ] : null;/' src/vues.js
     ATTENDU="le maximum comparé est celui que la semaine affiche" ;;
  7) # Rendre le percentile linéaire entre les deux bornes extrêmes seulement.
     perl -0pi -e 's/  for \(let k = 0; k < q\.length - 1; k\+\+\) \{/  return 100 * (v - q[0]) \/ (q[q.length - 1] - q[0]);\n  for (let k = 0; k < q.length - 1; k++) {/' src/climat.js
     ATTENDU="le percentile du jour est celui de la distribution de l'archive" ;;
  8) # Prendre la fenêtre sur le jour exact au lieu de onze jours.
     perl -0pi -e 's/export const FENETRE = 5;/export const FENETRE = 0;/' src/climat.js
     ATTENDU="la médiane écrite est celle des mêmes dates" ;;
  9) # Chercher les records sur la fenêtre et non sur la date exacte.
     perl -0pi -e 's/    const c = t\[i\]\.slice\(5\);\n    let r = rec\.get\(c\);/    const c = t[i].slice(5, 7) + "-01";\n    let r = rec.get(c);/' src/climat.js
     ATTENDU="les records de la date portent leur valeur et leur année" ;;
  10) # Toujours prendre la saison en cours, si courte soit-elle.
     perl -0pi -e 's/  if \(jours >= JOURS_SAISON\) return \{ saison: SAISONS\[k\], enCours: true \};/  return { saison: SAISONS[k], enCours: true };/' src/climat.js
     ATTENDU="la saison comparée est celle qui porte trente journées" ;;
  11) # Prendre une autre période de référence que celle de l'Organisation.
     perl -0pi -e 's/export const NORMALE = \[1991, 2020\];/export const NORMALE = [1961, 1990];/' src/climat.js
     ATTENDU="la saison se compare à la normale de 1991 à 2020" ;;
  12) # Peindre les bandes avec la rampe de température au lieu de celle des écarts.
     perl -0pi -e 's/              x\.fillStyle = couleurEcart\(e\[k\], etendue\);/              x.fillStyle = couleurT(e[k]);/' src/vues.js
     ATTENDU="les bandes vont du bleu au rouge et disent leur montée" ;;
  13) # Comparer les trente dernières années aux trente dernières : aucune montée.
     perl -0pi -e 's/  const a = moy\(annees\.slice\(0, reference\)\), b = moy\(annees\.slice\(-reference\)\);/  const a = moy(annees.slice(-reference)), b = moy(annees.slice(-reference));/' src/climat.js
     ATTENDU="les bandes vont du bleu au rouge et disent leur montée" ;;
  14) # Ne plus borner la réserve : toutes les communes lues y restent.
     perl -0pi -e 's/  for \(const k of cles\.slice\(COMMUNES_GARDEES\)\) delete r\[k\];//' src/climat.js
     ATTENDU="la réserve ne garde pas plus de six communes" ;;
  15) # Montrer les sections même sans archive.
     perl -0pi -e 's/        if \(!d\) \{ dire\("L.archive a besoin du réseau."\); return; \}/        if (!d) { dire("L\x27archive a besoin du réseau."); recs.hidden = false; sais.hidden = false; band.hidden = false; return; }/' src/vues.js
     ATTENDU="sans archive, la feuille le dit et ne montre pas de section vide" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/climat.js" src/climat.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null \
  && diff -q "$SAUVE/src/icones.js" src/icones.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-climat-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
