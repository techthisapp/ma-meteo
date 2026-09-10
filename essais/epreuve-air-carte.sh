#!/bin/bash
# Épreuve des gardes de la nappe de qualité de l'air.
# Usage : essais/epreuve-air-carte.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-air-carte
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/nappe.js src/vues.js src/icones.js src/reglages.js "$SAUVE/src/"

restaurer() { cp "$SAUVE/src/nappe.js" "$SAUVE/src/vues.js" "$SAUVE/src/icones.js" \
  "$SAUVE/src/reglages.js" src/; }
trap restaurer EXIT

case "$N" in
  1) # Lire la grille de l'air dès l'ouverture, sans attendre que la nappe soit choisie.
     perl -0pi -e 's/(      requestAnimationFrame\(\(\) => \{\n)/$1        lireAir();\n/' src/vues.js
     ATTENDU="la grille de l'air n'est pas demandée tant que sa nappe ne l'est pas" ;;
  2) # Peindre la nappe d'air avec la grille de la prévision.
     perl -0pi -e 's/  const grilleDe = n => \(n && n\.source === "air" \? mesuresAir : mesures\);/  const grilleDe = () => mesures;/' src/vues.js
     ATTENDU="la nappe de la qualité de l'air teinte selon sa propre rampe" ;;
  3) # Peindre l'air avec la rampe de l'indice ultraviolet.
     perl -0pi -e 's/    champ: "aqi", source: "air", teinte: teinteAQI, sat: 0\.58, clarte: 0\.46,/    champ: "aqi", source: "air", teinte: teinteUV, sat: 0.58, clarte: 0.46,/' src/vues.js
     ATTENDU="la nappe de la qualité de l'air teinte selon sa propre rampe" ;;
  4) # Redemander la grille de l'air à chaque allumage : la garde retirée.
     perl -0pi -e 's/  if \(gardeAir && t < gardeAir\.exp\) return gardeAir\.d;//' src/nappe.js
     ATTENDU="la nappe d'air lit sa grille et non celle de la prévision" ;;
  5) # Demander des heures plutôt que l'instant, comme le fait la feuille.
     perl -0pi -e 's/  q\.set\("current", COLONNES_AIR\.join\(","\)\);/  q.set("hourly", COLONNES_AIR.join(","));/' src/nappe.js
     ATTENDU="l'adresse de la grille d'air demande l'indice européen sur tous les points" ;;
  6) # Fondre la source propre de l'air avec celle du vent.
     perl -0pi -e 's/    credit: "Qualité de l'"'"'air Copernicus" \},/  },/' src/vues.js
     ATTENDU="la nappe d'air nomme sa source, le vent gardant la sienne" ;;
  7) # Donner à l'air les graduations de l'indice ultraviolet.
     perl -0pi -e 's/    arrets: \[0, 20, 40, 60, 80\], unite: "", couleur: couleurAQI,/    arrets: [0, 3, 6, 8, 11], unite: "", couleur: couleurAQI,/' src/vues.js
     ATTENDU="la légende de l'air porte les bornes des niveaux européens" ;;
  8) # Refuser le choix de la nappe d'air au réglage.
     perl -0pi -e 's/export const NAPPES = \["pluie", "temp", "uv", "air"\];/export const NAPPES = ["pluie", "temp", "uv"];/' src/reglages.js
     ATTENDU="le choix de la nappe d'air se garde d'une visite à l'autre" ;;
  9) # Le défaut d'origine : le premier tracé ne lit pas la source de la nappe d'air.
     perl -0pi -e 's/      if \(auDepart && auDepart\.source === "air"\) lireAir\(\);//' src/vues.js
     ATTENDU="une carte qui s'ouvre sur la nappe d'air la peint d'elle-même" ;;
  10) # Le premier tracé lit les deux grilles, celle de l'air deux fois.
     perl -0pi -e 's/      if \(auDepart && auDepart\.source === "air"\) lireAir\(\);/      if (auDepart \&\& auDepart.source === "air") { lireAir(); lireAir(); }/' src/vues.js
     perl -0pi -e 's/  if \(gardeAir && t < gardeAir\.exp\) return gardeAir\.d;//' src/nappe.js
     ATTENDU="elle ne lit sa grille qu'une fois en s'ouvrant" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/nappe.js" src/nappe.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/icones.js" src/icones.js >/dev/null \
  && diff -q "$SAUVE/src/reglages.js" src/reglages.js >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-air-carte-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
