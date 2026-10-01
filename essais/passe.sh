#!/bin/bash
# Une passe des contrôles sur une copie du dépôt, hors du dépôt de travail.
# Usage : essais/passe.sh [port]
#
# La suite sert l'application depuis le disque : modifier un fichier pendant
# qu'elle tourne lui fait lire l'état à moitié écrit. Sur une copie, la passe
# est figée au moment de son lancement et le dépôt reste libre d'être modifié.
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
OLD="$PWD"
PORT_ESSAIS="${1:-8137}"
COPIE=/tmp/passe-$PORT_ESSAIS
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
# JUSQUA et CHRONO se transmettent au besoin : la première borne la passe à une
# section, la seconde dit le temps de chacune.
CHROMIUM="${CHROMIUM:-}" \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="${JUSQUA:-}" CHRONO="${CHRONO:-}" \
  borne 900 node essais/controle.mjs
