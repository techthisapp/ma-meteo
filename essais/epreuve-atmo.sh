#!/bin/bash
# Épreuve des gardes de l'indice ATMO officiel.
# Usage : essais/epreuve-atmo.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
# Chaque épreuve travaille sur sa copie du dépôt et son port : le dépôt
# d'origine n'est jamais touché, et une épreuve interrompue ne laisse rien.
COPIE=/tmp/copie-atmo-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8260 + N))
# L'arrêt anticipé borne la passe à la section visée par ces fautes.
JUSQUA="Les nappes de la carte"

case "$N" in
  1) # La feuille attend l'indice officiel avant de s'afficher.
     perl -0pi -e "s/  const off = Atmo\.chargeCourante\(\);/  const off = await Atmo.charger({ lat: ctx.lat, lon: ctx.lon });/" src/vues.js
     perl -0pi -e "s/export function vueAir\(ctx, rendre, majEtat\) \{/export async function vueAir(ctx, rendre, majEtat) {/" src/vues.js
     ATTENDU="la feuille s'ouvre sans attendre l'indice officiel" ;;
  2) # La carte officielle n'est jamais posée.
     perl -0pi -e "s/      \+ carteOfficielle\(off\)\n//" src/vues.js
     ATTENDU="l'indice officiel paraît quand le service a répondu" ;;
  3) # La première zone rendue est retenue, non la plus proche.
     perl -0pi -e "s/    if \(!bon \|\| d < bon\.km\) bon = \{ km: d, p \};/    if (!bon) bon = { km: d, p };/" src/atmo.js
     ATTENDU="la zone retenue est la plus proche, non la première rendue" ;;
  4) # Le nom écrit est celui de la commune choisie, non celui de la source.
     perl -0pi -e "s/  const lieu = off\.zone \? esc\(off\.zone\) : \"la zone la plus proche\";/  const lieu = esc(Reglages.lire().commune || \"\");/" src/vues.js
     ATTENDU="le nom écrit est celui de la source, non celui de la commune choisie" ;;
  5) # Seuls trois sous-indices sur cinq sont écrits.
     perl -0pi -e "s/    \+ Atmo\.SOUS\.map\(\(\[cle, nom, court\]\) => \{/    + Atmo.SOUS.slice(0, 3).map(([cle, nom, court]) => {/" src/vues.js
     ATTENDU="les cinq sous-indices paraissent avec leur niveau" ;;
  6) # Le point part en degrés, non en mètres de Mercator.
     perl -0pi -e "s/  const \[x, y\] = enMercator\(lat, lon\);/  const [x, y] = [lon, lat];/" src/atmo.js
     ATTENDU="la requête demande le point de la commune, en projection de Mercator" ;;
  7) # Une requête de trop : la garde en mémoire du module est ôtée et la feuille
     # appelle le service deux fois. Ôter la seule condition `!off` de la feuille
     # ferait boucler le rendu sans fin et tomber la suite avant la garde ; la
     # faute doit se voir par la garde, non par un plantage.
     perl -0pi -e "s/    Atmo\.charger\(\{ lat: ctx\.lat, lon: ctx\.lon \}\)\.then\(d => \{ if \(d\) rendre\(\); \}\);/    Atmo.charger({ lat: ctx.lat, lon: ctx.lon });\n    Atmo.charger({ lat: ctx.lat, lon: ctx.lon }).then(d => { if (d) rendre(); });/" src/vues.js
     perl -0pi -e "s/  if \(charge\) return charge;//" src/atmo.js
     ATTENDU="une seule requête part, quelle que soit la refonte de la feuille" ;;
  8) # Un service muet fait poser une carte vide au lieu de rien.
     perl -0pi -e "s/  if \(!off\) return \"\";/  if (!off) off = { code: null, libelle: null, zone: null, km: 0, sous: {} };/" src/vues.js
     ATTENDU="un service muet ne prive la feuille de rien" ;;
  9) # La nappe s'en tient à l'interpolation : les tuiles officielles, qui
     # séparent bien mieux les zones, ne sont plus posées.
     perl -0pi -e "s/        if \(!n\.officiel\) return posees;/        return posees;/" src/vues.js
     ATTENDU="les tuiles de l'indice officiel se demandent avec la nappe" ;;
  10) # La date disparaît de la requête : le service rend un pas à deux jours
      # dans le futur, moins couvrant, au lieu du jour même.
     perl -0pi -e 's/&time=\$\{jour\}`;/`;/' src/atmo.js
     ATTENDU="chaque tuile de l'indice porte sa date" ;;
  11) # Les tuiles sont demandées mais jamais posées.
     perl -0pi -e "s/    ctx\.drawImage\(e\.img, t\.px, t\.py, t\.cote \+ 0\.5, t\.cote \+ 0\.5\);\n    posees\+\+;\n  \}\n  return posees;\n\}\n\nlet charge/    posees++;\n  }\n  return posees;\n}\n\nlet charge/" src/atmo.js
     ATTENDU="et elles se posent par-dessus l'interpolation" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/src/atmo.js" src/atmo.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-atmo-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
