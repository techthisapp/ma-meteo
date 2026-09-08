#!/bin/bash
# Épreuve des gardes de la carte.
# Usage : essais/epreuve-carte.sh <n>
set -u
cd "$(dirname "$0")/.."
N="$1"
SAUVE=/tmp/epreuve-carte
rm -rf "$SAUVE"; mkdir -p "$SAUVE/src"
cp src/carte.js src/vues.js src/app.js src/geographie.js src/vigilance.js \
   src/nappe.js src/reglages.js "$SAUVE/src/"
cp styles.css "$SAUVE/"

restaurer() {
  cp "$SAUVE/src/carte.js" "$SAUVE/src/vues.js" "$SAUVE/src/app.js" \
     "$SAUVE/src/geographie.js" "$SAUVE/src/vigilance.js" \
     "$SAUVE/src/nappe.js" "$SAUVE/src/reglages.js" src/
  cp "$SAUVE/styles.css" .
}
trap restaurer EXIT

case "$N" in
  1) # Ne dessiner que ce qui est hors du cadre : la carte se vide.
     perl -0pi -e 's/      if \(mx\(x1\) < fo \|\| mx\(x0\) > fe \|\| my\(y0\) < fs \|\| my\(y1\) > fn\) return;/      if (!(mx(x1) < fo || mx(x0) > fe || my(y0) < fs || my(y1) > fn)) return;/' src/carte.js
     ATTENDU="la carte est peinte sur sa toile" ;;
  2) # Rendre la latitude linéaire au retour : la projection cesse de se répondre.
     perl -0pi -e 's/export const latDe = y => 90 - \(360 \* Math\.atan\(Math\.exp\(\(y - 0\.5\) \* 2 \* Math\.PI\)\)\) \/ Math\.PI;/export const latDe = y => 90 - y * 180;/' src/carte.js
     ATTENDU="la projection et son inverse se répondent" ;;
  3) # Ne pas borner la vue.
     perl -0pi -e 's/export function borner\(vue\) \{\n  return \{/export function borner(vue) {\n  return { ...vue };\n  return {/' src/carte.js
     ATTENDU="le zoom reste entre ses bornes" ;;
  4) # Ne pas suivre le doigt.
     perl -0pi -e 's/    Object\.assign\(vue, recentrer\(bornee, depart\.ancre, x, y, l, h\)\);\n    redessiner\(\);/    redessiner();/' src/carte.js
     ATTENDU="le doigt déplace la carte" ;;
  5) # Laisser un repère hors du cadre collé au bord.
     perl -0pi -e 's/          b\.hidden = dehors;/          b.hidden = false;/' src/vues.js
     ATTENDU="un repère hors du cadre est caché" ;;
  6) # Rendre à l'écran de la carte le rembourrage qui le fait défiler.
     perl -0pi -e 's/\.ecran-carte\{\n  padding:calc\(var\(--haut\) \+ var\(--nav-haut\)\) 0 var\(--onglets-mesure\);\n  gap:0;max-width:none;\n\}/.ecran-carte{gap:0;max-width:none}/' styles.css
     ATTENDU="l'écran de la carte ne défile pas" ;;
  7) # Ne pas ramener la carte sur le lieu courant.
     perl -0pi -e 's/        Object\.assign\(vue, Carte\.borner\(\{ lat: g\.lat, lon: g\.lon, z: Carte\.ZDEFAUT \}\)\);\n        revoir\(\);/        revoir();/' src/vues.js
     ATTENDU="le retour ramène la carte sur le lieu courant" ;;
  8) # Ouvrir la carte sur la commune au lieu de la France.
     perl -0pi -e 's/          Object\.assign\(vue, Carte\.vueSur\(Carte\.FRANCE, cv\.clientWidth, cv\.clientHeight\)\);/          Object.assign(vue, Carte.borner({ lat: g.lat, lon: g.lon, z: Carte.ZDEFAUT }));/' src/vues.js
     ATTENDU="la carte s'ouvre sur la France entière" ;;
  9) # Ne pas effacer le cadrage quand on appuie sur l'onglet.
     perl -0pi -e 's/  if \(nom === "carte"\) ctx\.cadreCarte = null;/  if (false) ctx.cadreCarte = null;/' src/app.js
     ATTENDU="un appui sur l'onglet ramène le cadrage sur la France" ;;
  10) # Refaire le cadrage à chaque rendu.
     perl -0pi -e 's/  const vue = ctx\.cadreCarte \|\| \(ctx\.cadreCarte = \{ lat: g\.lat, lon: g\.lon, z: null \}\);/  const vue = (ctx.cadreCarte = { lat: g.lat, lon: g.lon, z: null });/' src/vues.js
     ATTENDU="le cadrage tient à travers un changement de commune" ;;
  11) # Laisser le nom du repère déborder du bord droit.
     perl -0pi -e 's/            b\.classList\.toggle\("ca-r-gauche", p\.x \+ 26 \+ large > l - 8\);/            b.classList.toggle("ca-r-gauche", false);/' src/vues.js
     ATTENDU="un repère près du bord droit porte son nom à gauche" ;;
  12) # Lire tous les arcs à l'endroit : l'anneau ne se referme plus.
     perl -0pi -e 's/      if \(v < 0\) \{/      if (false) {/' src/geographie.js
     ATTENDU="la topologie rend un anneau fermé par département" ;;
  13) # Décaler les points de l'anneau : la teinte quitte le trait.
     perl -0pi -e 's/    return Float64Array\.from\(pts\);/    return Float64Array.from(pts.map((x, i) => (i % 2 ? x : x + 0.001)));/' src/geographie.js
     ATTENDU="le trait et la teinte partagent leurs points" ;;
  14) # Une seule teinte pour tous les niveaux.
     perl -0pi -e 's/    const teinte = c\[`vg\$\{rang\}`\];/    const teinte = c.vg2;/' src/carte.js
     ATTENDU="la couche de vigilance teinte les départements en alerte" ;;
  15) # Accepter tous les sous-domaines, massifs et zones côtières compris.
     perl -0pi -e 's/!\/\^\(\\d\{2\}\|2A\|2B\)\$\/\.test\(id\)/false/' src/vigilance.js
     ATTENDU="les massifs et les zones côtières n'entrent pas dans la table" ;;
  16) # Laisser la mention de Météo-France quand la couche est éteinte.
     perl -0pi -e 's/\(vigiAllume \? `<span>Vigilance Météo-France<\/span>` : ""\)/`<span>Vigilance Météo-France<\/span>`/' src/vues.js
     ATTENDU="la mention de Météo-France paraît avec la couche de vigilance" ;;
  17) # Charger la grille des nappes dès l'ouverture, nappe ou pas.
     perl -0pi -e 's/      if \(allume\) lireIndex\(\);/      if (allume) lireIndex();\n      lireMesures();/' src/vues.js
     ATTENDU="la nappe ne demande rien tant qu'elle n'est pas choisie" ;;
  18) # Laisser le panneau ouvert quand on appuie sur la carte.
     perl -0pi -e 's/      cv\.addEventListener\("pointerdown", \(\) => montrer\(false\), \{ passive: true \}\);//' src/vues.js
     ATTENDU="le panneau des couches s'ouvre et se ferme" ;;
  19) # Ne pas décocher les autres nappes : deux nappes marquées à la fois.
     perl -0pi -e 's/        for \(const \[cle, el\] of rangs\) el\.setAttribute\("aria-checked", cle === c \? "true" : "false"\);/        for (const [cle, el] of rangs) if (cle === c) el.setAttribute("aria-checked", "true");/' src/vues.js
     ATTENDU="une seule nappe à la fois" ;;
  20) # Redemander la grille à chaque choix, garde ignorée.
     perl -0pi -e 's/  if \(garde && t < garde\.exp\) return garde\.d;//' src/nappe.js
     ATTENDU="rallumer la nappe ne redemande pas la grille" ;;
  21) # Une seule couleur pour toute la nappe.
     perl -0pi -e 's/      const t = v === null \? null : teinte\(v\);/      const t = v === null ? null : teinte(20);/' src/carte.js
     ATTENDU="la nappe étale la valeur de ses points" ;;
  22) # Laisser la nappe déborder du pays.
     perl -0pi -e 's/  ctx\.clip\(\);\n  ctx\.globalAlpha = style\.opacite/  ctx.globalAlpha = style.opacite/' src/carte.js
     ATTENDU="la nappe étale la valeur de ses points" ;;
  23) # Écrire la mention de la source même sans la nappe.
     python3 - <<'PYFAUTE'
import io
p = "src/vues.js"
s = io.open(p, encoding="utf-8").read()
a = """            const noms = [n && n.nom, ventAllume ? "vent" : null].filter(Boolean);"""
b = """            const noms = [n ? n.nom : "Température", ventAllume ? "vent" : null].filter(Boolean);"""
assert s.count(a) == 1
io.open(p, "w", encoding="utf-8").write(s.replace(a, b))
PYFAUTE
     ATTENDU="la mention de la source paraît avec la nappe" ;;
  24) # Laisser la légende en place sans nappe.
     perl -0pi -e 's/        legende\.hidden = !n;/        legende.hidden = false;/' src/vues.js
     ATTENDU="la légende porte la rampe et ses graduations" ;;
  25) # Remplir le département même sous une nappe pleine.
     perl -0pi -e 's/    if \(style\.trait\) ctx\.stroke\(\); else ctx\.fill\(\);/    ctx.fill();/' src/carte.js
     ATTENDU="la vigilance passe en liseré sous une nappe pleine" ;;
  26) # Ne pas garder le choix de nappe.
     perl -0pi -e 's/export function poserNappe\(v\) \{ poser\(\{ nappe: NAPPES\.includes\(v\) \? v : null \}\); \}/export function poserNappe() { }/' src/reglages.js
     ATTENDU="le choix de nappe se garde" ;;
  27) # Prolonger la nappe hors de son emprise.
     perl -0pi -e 's/  if \(x < 0 \|\| y < 0 \|\| x > COLS - 1 \|\| y > RANGS - 1\) return null;//' src/nappe.js
     ATTENDU="la nappe interpole entre ses points et s'arrête à son emprise" ;;
  28) # Jeter l'ancien réglage de pluie au lieu de le reprendre.
     perl -0pi -e 's/  return etat\.radar === false \? null : "pluie";/  return "pluie";/' src/reglages.js
     ATTENDU="un ancien réglage de pluie se reprend en choix de nappe" ;;
  29) # Prendre l'indice de l'instant au lieu du maximum du jour.
     perl -0pi -e 's/    const uv = j && Array\.isArray\(j\.uv_index_max\) \? j\.uv_index_max\[k\] : null;/    const uv = c.uv_index;/' src/nappe.js
     perl -0pi -e 's/export const COLONNES = \["temperature_2m", "wind_speed_10m", "wind_direction_10m"\];/export const COLONNES = ["temperature_2m", "wind_speed_10m", "wind_direction_10m", "uv_index"];/' src/nappe.js
     ATTENDU="la grille demande la colonne de journée et deux journées" ;;
  30) # Prendre toujours la première journée rendue, celle du temps universel.
     perl -0pi -e 's/  const k = dates\.indexOf\(aujourdhui\);\n  return k >= 0 \? k : 0;/  return 0;/' src/nappe.js
     ATTENDU="la nappe d'indice ultraviolet retient la journée en cours" ;;
  31) # Peindre l'indice avec la rampe de la température.
     perl -0pi -e 's/    champ: "uv", teinte: teinteUV, sat: 0\.62, clarte: 0\.46,/    champ: "uv", teinte: teinteT, sat: 0.62, clarte: 0.46,/' src/vues.js
     ATTENDU="la nappe d'indice ultraviolet teinte selon sa propre rampe" ;;
  32) # Ne pas dire sur quoi la nappe porte.
     perl -0pi -e 's/          titreLeg\.textContent = `\$\{n\.nom\}, \$\{n\.porte\}`;/          titreLeg.textContent = n.nom;/' src/vues.js
     ATTENDU="la légende dit sur quoi la nappe porte" ;;
  *) echo "faute inconnue"; exit 2 ;;
esac

if diff -q "$SAUVE/src/carte.js" src/carte.js >/dev/null \
  && diff -q "$SAUVE/src/vues.js" src/vues.js >/dev/null \
  && diff -q "$SAUVE/src/app.js" src/app.js >/dev/null \
  && diff -q "$SAUVE/src/geographie.js" src/geographie.js >/dev/null \
  && diff -q "$SAUVE/src/vigilance.js" src/vigilance.js >/dev/null \
  && diff -q "$SAUVE/src/nappe.js" src/nappe.js >/dev/null \
  && diff -q "$SAUVE/src/reglages.js" src/reglages.js >/dev/null \
  && diff -q "$SAUVE/styles.css" styles.css >/dev/null; then
  echo "FAUTE $N NON APPLIQUÉE"; exit 3
fi

SORTIE=$(CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  timeout 700 node essais/controle.mjs 2>&1)
echo "$SORTIE" > "/tmp/epreuve-carte-$N.log"
if echo "$SORTIE" | grep -q "ÉCHEC  $ATTENDU"; then
  echo "FAUTE $N vue par : $ATTENDU"
else
  echo "FAUTE $N NON VUE. Attendu : $ATTENDU"
  echo "$SORTIE" | grep "ÉCHEC" | head -8
  echo "$SORTIE" | tail -2
fi
