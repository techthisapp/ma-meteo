#!/bin/bash
# Épreuve des gardes de « L'air qu'on respire ».
# Usage : essais/epreuve-air.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-air
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/air.js src/activites.js src/conseils.js src/vues.js "$SAUVE/src/"

restaurer() {
  cp "$SAUVE/src/air.js" "$SAUVE/src/activites.js" \
     "$SAUVE/src/conseils.js" "$SAUVE/src/vues.js" src/
}
trap restaurer EXIT

case "$N" in
  1) # Aérer sans regarder l'air du dehors.
     perl -0pi -e 's/  return premierCreneau\(serie, k, i => sec\(serie, i\) && respirable\(i\)/  return premierCreneau(serie, k, i => sec(serie, i)/' src/activites.js
     ATTENDU="un air dégradé le matin repousse l'aération après lui" ;;
  2) # Tenir tout pollen pour en saison, quelle que soit sa concentration.
     perl -0pi -e 's/  if \(!Number\.isFinite\(v\) \|\| v < p\.saison\) return null;/  if (!Number.isFinite(v)) return null;/' src/air.js
     ATTENDU="seul un pollen en saison paraît" ;;
  3) # Faire parler la règle des pollens dès la saison, non au seul pic.
     perl -0pi -e 's/        if \(etatPollen\(p, v\[k\]\) !== "pic"\) continue;/        if (!etatPollen(p, v[k])) continue;/' src/conseils.js
     ATTENDU="une saison sans pic ne se dit pas" ;;
  4) # Ne pas appliquer le profil d'allergies aux faits marquants.
     perl -0pi -e 's/      if \(!g\.pollens\.includes\(p\.cle\)\) continue;\n//' src/conseils.js
     ATTENDU="le même pollen retiré du profil ne se dit plus" ;;
  5) # Dire l'air en deçà du niveau dégradé.
     perl -0pi -e 's/    const pa = plagesDe\(s\.n, k => Number\.isFinite\(air\.aqi\[k\]\) && air\.aqi\[k\] >= DEGRADE\);/    const pa = plagesDe(s.n, k => Number.isFinite(air.aqi[k]));/' src/conseils.js
     ATTENDU="un air ordinaire ne se dit pas" ;;
  6) # Ne pas demander les six pollens à la source.
     perl -0pi -e 's/  const colonnes = \["european_aqi", \.\.\.POLLUANTS\.map\(p => p\[2\]\), \.\.\.POLLENS\.map\(p => p\.colonne\)\];/  const colonnes = ["european_aqi", ...POLLUANTS.map(p => p[2]),\n    ...POLLENS.slice(0, 3).map(p => p.colonne)];/' src/air.js
     ATTENDU="le profil n'entre dans aucune requête" ;;
  7) # Rendre la première heure au lieu du pire moment.
     perl -0pi -e 's/    if \(k < 0 \|\| air\.aqi\[i\] > air\.aqi\[k\]\) k = i;/    if (k < 0) k = i;/' src/air.js
     ATTENDU="le pire moment se dit avec son heure" ;;
  8) # Écrire la rangée du pire moment même quand elle redit le moment présent.
     perl -0pi -e 's/  const pireDit = pr && Number\.isFinite\(ici\) && pr\.indice > ici;/  const pireDit = !!pr;/' src/vues.js
     ATTENDU="le pire moment ne se répète pas quand c'est le moment présent" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/air.js" src/air.js >/dev/null \
  && diff -q "$SAUVE/src/activites.js" src/activites.js >/dev/null \
  && diff -q "$SAUVE/src/conseils.js" src/conseils.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 600 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-air-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
