#!/bin/bash
# Une passe des contrôles sur une copie du dépôt, hors du dépôt de travail.
# Usage : essais/passe.sh [port]
#
# La suite sert l'application depuis le disque : modifier un fichier pendant
# qu'elle tourne lui fait lire l'état à moitié écrit. Sur une copie, la passe
# est figée au moment de son lancement et le dépôt reste libre d'être modifié.
set -u
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
CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="${JUSQUA:-}" CHRONO="${CHRONO:-}" \
  timeout 900 node essais/controle.mjs
