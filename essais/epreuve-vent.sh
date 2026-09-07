#!/bin/bash
# Épreuve des gardes de la couche de vent.
# Usage : essais/epreuve-vent.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-vent
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/vent.js src/vues.js src/reglages.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() {
  cp "$SAUVE/src/vent.js" "$SAUVE/src/vues.js" "$SAUVE/src/reglages.js" src/
  cp "$SAUVE/styles.css" .
}
trap restaurer EXIT

case "$N" in
  1) # Faire souffler le vent d'où il vient au lieu d'où il va.
     perl -0pi -e 's/  return \{ est: -Math\.sin\(r\), nord: -Math\.cos\(r\) \};/  return { est: Math.sin(r), nord: Math.cos(r) };/' src/vent.js
     ATTENDU="le vent souffle vers où il va, non d'où il vient" ;;
  2) # Ne jamais poser la toile du vent.
     perl -0pi -e 's/        if \(ventAllume && mesures\) Vent\.poser\(cvVent, etatVent\);/        if (false) Vent.poser(cvVent, etatVent);/' src/vues.js
     ATTENDU="la couche allumée couvre sa toile de traînées" ;;
  3) # Faire avancer les particules en travers du champ.
     perl -0pi -e 's/    const suite = avancerPoint\(p\.lat, p\.lon, v\.direction, avecMouvement \? pas : 0, mpp\);/    const suite = avancerPoint(p.lat, p.lon, v.direction + 90, avecMouvement ? pas : 0, mpp);/' src/vent.js
     ATTENDU="les traînées suivent la direction du champ" ;;
  4) # Relire la grille quand la seconde couche s'allume.
     perl -0pi -e 's/        if \(c === "temp"\) \{\n          if \(mesures\) revoir\(\); else lireMesures\(\);/        if (c === "temp") {\n          NappeCarte.oublier(); mesures = null; lireMesures();/' src/vues.js
     ATTENDU="les deux couches se partagent une seule lecture de la grille" ;;
  5) # Laisser la toile du vent prendre les gestes.
     perl -0pi -e 's/\.ca-vent\{\n  position:absolute;inset:0;width:100%;height:100%;\n  pointer-events:none;\n\}/.ca-vent{position:absolute;inset:0;width:100%;height:100%}/' styles.css
     ATTENDU="la toile du vent ne prend pas les gestes" ;;
  6) # Garder les traînées quand le cadrage change.
     perl -0pi -e 's/  if \(cle !== vuePrecedente\) \{/  if (false) {/' src/vent.js
     ATTENDU="un changement de cadrage efface les traînées" ;;
  7) # Une seule longueur pour toutes les forces dans la légende.
     perl -0pi -e 's/export const longueurTrace = v => ALLURE \* v \* \(PAS \/ 1000\) \* IMAGES_VUES;/export const longueurTrace = () => 12;/' src/vent.js
     ATTENDU="la légende du vent nomme trois forces par des longueurs croissantes" ;;
  8) # Nommer la source une fois par couche, donc deux fois quand les deux sont là.
     python3 - <<'PYFAUTE'
import io
p = "src/vues.js"
s = io.open(p, encoding="utf-8").read()
a = """          + (choisie === "temp" || ventAllume
            ? `<span>${choisie === "temp" && ventAllume ? "Température et vent"
              : choisie === "temp" ? "Température" : "Vent"} `
              + `<a href="https://open-meteo.com" target="_blank" `
              + `rel="noopener noreferrer">Open-Meteo</a></span>`
            : "")"""
b = """          + (choisie === "temp"
            ? `<span>Température <a href="https://open-meteo.com" target="_blank" `
              + `rel="noopener noreferrer">Open-Meteo</a></span>`
            : "")
          + (ventAllume
            ? `<span>Vent <a href="https://open-meteo.com" target="_blank" `
              + `rel="noopener noreferrer">Open-Meteo</a></span>`
            : "")"""
assert s.count(a) == 1
io.open(p, "w", encoding="utf-8").write(s.replace(a, b))
PYFAUTE
     ATTENDU="la mention nomme la source une seule fois pour deux couches" ;;
  9) # Faire entrer le vent dans le choix exclusif des nappes.
     perl -0pi -e 's/        mention\(\);\n        poserLegende\(\);\n        if \(!allume\) \{ arreter\(\); rangee\.hidden = true; \}/        ventAllume = false;\n        poserVent();\n        mention();\n        poserLegende();\n        if (!allume) { arreter(); rangee.hidden = true; }/' src/vues.js
     ATTENDU="le vent se pose sur une nappe sans l'éteindre" ;;
  10) # Ne pas garder le choix du vent.
     perl -0pi -e 's/export function poserVentcarte\(v\) \{ poser\(\{ ventcarte: v === true \}\); \}/export function poserVentcarte() { }/' src/reglages.js
     ATTENDU="le choix du vent se garde" ;;
  11) # Lâcher la toile sans la vider.
     perl -0pi -e 's/  if \(toile && toile !== cv\) vider\(toile\);//' src/vent.js
     ATTENDU="la couche éteinte n'anime rien et vide sa toile" ;;
  12) # Animer même sous mouvement réduit.
     perl -0pi -e 's/  if \(figee\(\)\) \{ rendre\(true\); rendre\(false\); return; \}//' src/vent.js
     ATTENDU="le mouvement réduit fige les particules sans les effacer" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/vent.js" src/vent.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/reglages.js" src/reglages.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 700 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-vent-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
