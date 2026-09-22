#!/bin/bash
# Épreuve des gardes du ciel étoilé, première partie : les calculs.
# Usage : essais/epreuve-ciel-etoiles.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
OLD="$PWD"
COPIE=/tmp/copie-etoiles-$N
rm -rf "$COPIE"; mkdir -p "$COPIE"
cp -r donnees essais icones src index.html manifest.webmanifest package.json \
  styles.css sw.js "$COPIE/"
ln -s "$OLD/node_modules" "$COPIE/node_modules"
cd "$COPIE"
PORT_ESSAIS=$((8340 + N))
JUSQUA="Le ciel étoilé"

case "$N" in
  1) # Les coordonnées passées en radians à un module qui travaille en degrés :
     # c'est le défaut commis le 20 septembre 2026, qui laissait passer les cinq
     # mille étoiles, y compris celles sous les pieds de l'observateur.
     perl -0pi -e 's/  return horizon\(\{ ascension: ra \* 15, declinaison: dec \}, jj, lat, lon\);/  return horizon({ ascension: ra * Math.PI \/ 12, declinaison: dec * Math.PI \/ 180 }, jj, lat, lon);/' src/ciel.js
     ATTENDU="les étoiles sous l'horizon sont écartées" ;;
  2) # Le filtre d'horizon saute.
     perl -0pi -e 's/    if \(hauteur < 0\) continue;\n    const p = projeter\(azimut, hauteur, azCentre, hautCentre, champ\);\n    if \(!p \|\| Math\.abs\(p\.x\) > 1\.2/    const p = projeter(azimut, hauteur, azCentre, hautCentre, champ);\n    if (!p || Math.abs(p.x) > 1.2/' src/ciel.js
     ATTENDU="les étoiles sous l'horizon sont écartées" ;;
  3) # Le Soleil revient parmi les étoiles.
     python3 - <<'PY'
import json, io
d = json.load(open("donnees/ciel.json"))
d["etoiles"].insert(0, [0, 0, -26.7, 0.65, "Sol", "", ""])
io.open("donnees/ciel.json", "w", encoding="utf-8").write(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
PY
     ATTENDU="le Soleil ne figure pas parmi les étoiles" ;;
  4) # L'échelle des rayons à l'endroit : une étoile faible deviendrait un disque.
     perl -0pi -e 's/  const r = 0\.5 \+ \(6 - Math\.min\(mag, 6\)\) \* 0\.42;/  const r = 0.5 + Math.min(mag, 6) * 0.42;/' src/ciel.js
     ATTENDU="le rayon d'une étoile suit sa magnitude, à l'envers" ;;
  5) # Un point derrière l'observateur se projette quand même.
     perl -0pi -e 's/  if \(cosC <= 0\) return null;//' src/ciel.js
     ATTENDU="un point derrière l'observateur ne se projette pas" ;;
  6) # Le fichier du ciel se charge dès l'écran du Soleil : tout le monde le paie.
     perl -0pi -e 's/  const quel = Reglages\.ciel\(\);\n  const f = quel === "lune"/  const quel = Reglages.ciel();\n  Ciel.charger().catch(() => {});\n  const f = quel === "lune"/' src/vues.js
     ATTENDU="le fichier du ciel ne se charge qu.à l.ouverture de l.écran" ;;
  7) # La toile reste vide une fois les données chargées.
     perl -0pi -e 's/  if \(!Ciel\.chargees\(\)\) return;\n  const unite = Math\.min\(l, h\) \/ 2;/  return;\n  const unite = Math.min(l, h) \/ 2;/' src/vues.js
     ATTENDU="la toile porte des étoiles" ;;
  8) # Le doigt ne tourne plus la vue du plein écran.
     perl -0pi -e 's/        pe\.addEventListener\("pointermove", ev => \{\n          if \(!depart\) return;/        pe.addEventListener("pointermove", ev => {\n          return;/' src/vues.js
     ATTENDU="le doigt tourne la vue" ;;
  9) # La mention oublie le catalogue des étoiles.
     perl -0pi -e 's/Étoiles du catalogue HYG, figures de d3-celestial\./Figures de d3-celestial./' src/vues.js
     ATTENDU="la mention nomme les deux sources" ;;
  10) # Le bandeau ne s'ouvre plus en plein écran.
     perl -0pi -e 's/      bandeau\.addEventListener\("click", ouvrir\);\n//' src/vues.js
     ATTENDU="un toucher sur le bandeau ouvre le ciel en plein écran" ;;
  11) # Le zénith ne se dit plus : une direction à la verticale ne veut rien dire.
     perl -0pi -e 's/haut > 80 \? "Au zénith"/haut > 95 ? "Au zénith"/' src/vues.js
     ATTENDU="la visée se dit par une direction, et au zénith à la verticale" ;;
  12) # La fenêtre des sources oublie une licence.
     perl -0pi -e 's/, sous licence BSD à trois clauses\./\./' src/vues.js
     ATTENDU="la fenêtre des sources nomme les deux sources et leurs licences" ;;
  13) # Le titre du bandeau saute la nuit noire du soir et annonce la fin de la
      # suivante.
     perl -0pi -e 's/  if \(c\.soir && maintenant < c\.soir\) return \["Nuit noire", c\.soir\];\n//' src/vues.js
     ATTENDU="le bandeau annonce le prochain événement du ciel" ;;
  14) # Toutes les étoiles par défaut : la carte redevient trop dense.
     perl -0pi -e 's/etat\.affichageCiel : "visibles";/etat.affichageCiel : "toutes";/' src/reglages.js
     ATTENDU="le choix de l.affichage montre les plus visibles par défaut" ;;
  15) # Les plus visibles vont jusqu'à la magnitude 6.
     perl -0pi -e 's/  if \(affichage === "visibles"\) return mag <= 4;/  if (affichage === "visibles") return mag <= 6;/' src/ciel.js
     ATTENDU="les plus visibles s.arrêtent à la magnitude 4" ;;
  16) # Le mode des constellations oublie la marque des figures.
     perl -0pi -e 's/  if \(affichage === "constellations"\) return figure === 1;/  if (affichage === "constellations") return mag <= 6;/' src/ciel.js
     ATTENDU="le mode des constellations ne retient que les étoiles des figures" ;;
  17) # Le choix ne se garde plus.
     perl -0pi -e 's/            Reglages\.poserAffichageCiel\(b\.dataset\.affichage\);\n//' src/vues.js
     ATTENDU="le choix de l.affichage se garde d.une visite à l.autre" ;;
  18) # Les noms latins disparaissent du fichier.
     python3 - <<'PY'
import json, io
d = json.load(open("donnees/ciel.json"))
d["noms"] = {k: v[:3] for k, v in d["noms"].items()}
io.open("donnees/ciel.json", "w", encoding="utf-8").write(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
PY
     ATTENDU="les noms latins entrent dans le fichier, sous leur forme officielle" ;;
  19) # La marque des figures disparaît du fichier.
     python3 - <<'PY'
import json, io
d = json.load(open("donnees/ciel.json"))
d["etoiles"] = [e[:7] + [0] for e in d["etoiles"]]
io.open("donnees/ciel.json", "w", encoding="utf-8").write(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
PY
     ATTENDU="le fichier marque les étoiles des figures" ;;
  20) # L'essaim ne passe pas d'une année sur l'autre.
     perl -0pi -e 's/  for \(const k of \[0, 1\]\) \{/  for (const k of [0]) {/' src/vues.js
     ATTENDU="le prochain essaim d.étoiles filantes, y compris d.une année sur l.autre" ;;
  21) # La nuit noire prise au crépuscule civil.
     perl -0pi -e 's/  const cr = t => Astres\.crepuscules\(new Date\(t\), g\.lat, g\.lon\)\.astronomique;/  const cr = t => Astres.crepuscules(new Date(t), g.lat, g.lon).civil;/' src/vues.js
     ATTENDU="la nuit noire commence et finit aux crépuscules astronomiques" ;;
  22) # Le seuil des nuages à l'envers.
     perl -0pi -e 's/degage: h\.cloud_cover\[i\] <= P\.SEUIL_DEGAGE/degage: h.cloud_cover[i] >= P.SEUIL_DEGAGE/' src/vues.js
     ATTENDU="les nuages disent la plus longue éclaircie de la nuit noire" ;;
  23) # L'éclaircie finit au début de sa dernière heure.
     perl -0pi -e 's/  const fin = new Date\(meilleur\.fin\.getTime\(\) \+ 3600000\);/  const fin = new Date(meilleur.fin.getTime());/' src/vues.js
     ATTENDU="les nuages disent la plus longue éclaircie de la nuit noire" ;;
  24) # Les constellations les plus basses d'abord.
     perl -0pi -e 's/    \.sort\(\(a, b\) => b\.hauteur - a\.hauteur\)/    .sort((a, b) => a.hauteur - b.hauteur)/' src/vues.js
     ATTENDU="à voir ce soir, les constellations les plus hautes d.une nuit d.août" ;;
  25) # La liste reste vide après le chargement.
     perl -0pi -e 's/        const liste = bloc\.querySelector\("#ciAVoir"\);/        const liste = null;/' src/vues.js
     ATTENDU="à voir ce soir se remplit une fois le ciel chargé" ;;
  26) # Le toucher ne regarde plus les traits, seulement les noms.
     perl -0pi -e 's/  if \(proche && proche\.d <= seuilTrait\) return proche\.sigle;\n//' src/ciel.js
     ATTENDU="le toucher désigne le trait le plus proche, puis le nom" ;;
  27) # Le mois du passage à minuit décalé de six mois.
     perl -0pi -e 's/  const jours = \(\(\(ra - 12\) % 24\) \+ 24\) % 24/  const jours = (((ra) % 24) + 24) % 24/' src/ciel.js
     ATTENDU="la fiche dit la hauteur, le mois du passage à minuit et l.étoile la plus brillante" ;;
  28) # L'étoile la plus faible prise pour la plus brillante.
     perl -0pi -e 's/  const siennes = donnees\.etoiles\.filter\(e => e\[6\] === sigle\)\.sort\(\(a, b\) => a\[2\] - b\[2\]\);/  const siennes = donnees.etoiles.filter(e => e[6] === sigle).sort((a, b) => b[2] - a[2]);/' src/ciel.js
     ATTENDU="la fiche dit la hauteur, le mois du passage à minuit et l.étoile la plus brillante" ;;
  29) # Une étoile qui ne se lève jamais passe pour visible.
     perl -0pi -e 's/    jamais: 90 - Math\.abs\(lat - b\[1\]\) < 0 \}/    jamais: false }/' src/ciel.js
     ATTENDU="la fiche dit qu.une étoile ne se lève jamais ici" ;;
  30) # Le toucher bref ne désigne plus rien.
     perl -0pi -e 's/Math\.hypot\(ev\.clientX - d\.x, ev\.clientY - d\.y\) > 6\) return;/Math.hypot(ev.clientX - d.x, ev.clientY - d.y) >= 0) return;/' src/vues.js
     ATTENDU="un toucher bref désigne une constellation et ouvre sa fiche" ;;
  31) # Un glissement désigne aussi.
     perl -0pi -e 's/Math\.hypot\(ev\.clientX - d\.x, ev\.clientY - d\.y\) > 6\) return;/Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 600) return;/' src/vues.js
     ATTENDU="un glissement tourne la vue sans rien désigner" ;;
  32) # Les étoiles d'en dessous ne sont plus demandées : l'eau reste vide.
     perl -0pi -e 's/    affichage, bords, true\);/    affichage, bords, false);/' src/vues.js
     ATTENDU="sous l.horizon, une étendue d.eau laisse deviner les étoiles" ;;
  33) # L'eau n'est plus posée : le dessous redevient le fond de la nuit.
     perl -0pi -e 's/    c\.fillStyle = teinte;\n    c\.fill\(eau\);\n/    c.fillStyle = teinte;\n/' src/vues.js
     ATTENDU="sous l.horizon, une étendue d.eau laisse deviner les étoiles" ;;
  34) # Les étoiles d'en dessous ne sont plus marquées.
     perl -0pi -e 's/figure, sous: hauteur < 0 \}\);/figure, sous: false });/' src/ciel.js
     ATTENDU="sous l.horizon, les étoiles se rendent sur demande, marquées comme telles" ;;
  35) # Les figures ne se prolongent plus sous l'horizon.
     perl -0pi -e 's/        const p = dessous && !sousHorizon \? null/        const p = dessous ? null/' src/ciel.js
     ATTENDU="les figures se prolongent sous l.horizon, et pas sans demande" ;;
  *) echo "faute inconnue : $N"; exit 2 ;;
esac

if diff -q "$OLD/src/ciel.js" src/ciel.js >/dev/null \
  && diff -q "$OLD/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$OLD/src/reglages.js" src/reglages.js >/dev/null \
  && diff -q "$OLD/donnees/ciel.json" donnees/ciel.json >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  PORT_ESSAIS=$PORT_ESSAIS JUSQUA="$JUSQUA" timeout 900 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-etoiles-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
