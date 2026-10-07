/* La carte, sa table des nappes et son gabarit : le document que l'écran pose
   avant que les modules de la carte s'y branchent. Sorti de src/vues/carte.js le
   2 octobre 2026, docs/plan-chantiers-facultatifs.md. */

import { esc } from "../horloge.js";
import { ico, teinteT, couleurT, teinteUV, satUV, clarteUV, couleurUV, teinteAQI, couleurAQI } from "../icones.js";
import * as Reglages from "../reglages.js";
import * as Villes from "../villes.js";
import { pasDe } from "../passe.js";

/* Une rampe de nappe à partir d'arrêts `[valeur, teinte]` : la teinte en
   degrés de roue pour la toile, la couleur écrite pour la légende. Hors de
   `[seuil, plafond]`, rien ne se peint : une pluie de zéro, une visibilité de
   dix kilomètres n'ont pas de couleur. Jalon 19, lot 5. */
const rampeTeinte = (arrets, v) => {
  if (v <= arrets[0][0]) return arrets[0][1];
  for (let k = 0; k < arrets.length - 1; k++) {
    const [a0, h0] = arrets[k], [a1, h1] = arrets[k + 1];
    if (v <= a1) return h0 + ((v - a0) / (a1 - a0)) * (h1 - h0);
  }
  return arrets[arrets.length - 1][1];
};
const rampe = (arrets, { sat = 0.55, clarte = 0.48, seuil = -Infinity, plafond = Infinity } = {}) => ({
  teinte: v => (v === null || !Number.isFinite(v) || v < seuil || v > plafond ? null : rampeTeinte(arrets, v)),
  couleur: v => `hsl(${rampeTeinte(arrets, v).toFixed(0)} ${Math.round((typeof sat === "function" ? sat(v) : sat) * 100)}% `
    + `${Math.round((typeof clarte === "function" ? clarte(v) : clarte) * 100)}%)`,
  sat, clarte,
});
const R_VENT = rampe([[0, 200], [15, 170], [30, 110], [50, 50], [75, 15], [100, 320]]);
const R_PLUIE = rampe([[0.3, 195], [3, 215], [10, 240], [25, 275], [50, 310]], { seuil: 0.3, sat: 0.6, clarte: 0.5 });
const R_NEIGE = rampe([[0.2, 195], [2, 210], [10, 235], [25, 265], [50, 290]], { seuil: 0.2, sat: 0.45, clarte: 0.62 });
const R_LIMITE = rampe([[0, 280], [600, 240], [1200, 200], [1800, 150], [2500, 90], [3500, 40]], { sat: 0.5 });
const R_PRESSION = rampe([[985, 275], [1000, 225], [1013, 160], [1025, 70], [1040, 25]], { sat: 0.42, clarte: 0.52 });
const R_GEL = rampe([[-10, 250], [-4, 225], [0, 200], [4, 160], [10, 90], [18, 30]], { sat: 0.55, clarte: 0.5 });
/* Le ciel de la nuit : bleu nuit franc sous un ciel dégagé, gris clair sous un
   ciel couvert. La saturation et la clarté suivent la couverture. */
const R_CIEL = rampe([[0, 228], [100, 215]], { sat: v => 0.6 - 0.55 * Math.min(1, v / 100), clarte: v => 0.32 + 0.5 * Math.min(1, v / 100) });
const R_BROUILLARD = rampe([[100, 265], [5000, 230]], { plafond: 5000, sat: 0.18,
  clarte: v => 0.5 + 0.3 * Math.min(1, Math.max(0, (v - 100) / 4900)) });
/* Les pollens, sur l'échelle des deux seuils de chaque taxon, et la mer. */
const R_POLLENS = rampe([[1, 100], [2, 40], [3, 0]], { seuil: 1, sat: 0.62, clarte: 0.5 });
const R_VAGUES = rampe([[0, 190], [0.5, 205], [1, 225], [2, 260], [4, 300]], { sat: 0.55, clarte: 0.5 });
const enFamille = (famille, ...a) => ({ ...prevue(...a), famille });
const prevue = (cle, id, nom, tuile, ico, porte, champ, r, arrets, unite, plus = {}) =>
  ({ cle, id, nom, tuile, ico, porte, champ, source: "prevue", teinte: r.teinte, couleur: r.couleur,
    sat: r.sat, clarte: r.clarte, arrets, unite, ...plus });

/* Les nappes de la carte, exclusives entre elles. Ce sont des étalements de
   couleur sur toute la surface : deux superposés ne se liraient ni l'un ni
   l'autre. La vigilance n'entre pas dans cette liste, elle ne teinte que les
   départements en alerte et se pose sous la nappe.

   La pluie n'y figure plus depuis le 19 septembre 2026. Elle ne couvre qu'un
   cinquième de la vue un jour de pluie et laisse voir ce qui est dessous : elle
   est passée au-dessus, avec le vent, la vigilance, la foudre et les nuages, ce
   qui permet de la lire en même temps qu'une température ou une qualité de
   l'air. Sa place ici tenait à l'ordre dans lequel les couches sont venues. */
/* Les familles des nappes, dans l'ordre du panneau. */
export const FAMILLES = [["eau", "Eau"], ["temp", "Températures"], ["vent", "Vent et pression"],
  ["neige", "Neige et montagne"], ["ciel", "Ciel"], ["air", "Air"], ["mer", "Mer"]];

export const NAPPES_CARTE = [
  /* Les restrictions d'eau, VigiEau, jalon 18 : une nappe par départements, sans
     grille de valeurs ; la légende nomme ses quatre classes. */
  { cle: "eau", famille: "eau", id: "caEau", nom: "Restrictions d'eau", tuile: "Eau", ico: "robinet", porte: "en vigueur",
    departements: true, classes: ["Vigilance", "Alerte", "Renforcée", "Crise"] },
  { cle: "temp", famille: "temp", id: "caTemp", nom: "Température", ico: "thermo", porte: "maintenant",
    champ: "temp", parHeure: true, teinte: teinteT, sat: 0.54, clarte: 0.47,
    arrets: [-5, 5, 15, 25, 35], unite: "°", couleur: couleurT },
  { cle: "uv", famille: "ciel", id: "caUV", nom: "Indice UV", ico: "soleil", porte: "maximum du jour",
    champ: "uv", teinte: teinteUV, sat: satUV, clarte: clarteUV,
    arrets: [0, 2, 4, 6, 8], unite: "", couleur: couleurUV },
  /* La qualité de l'air vient d'un second service sur la même grille, d'où la
     source nommée : les trois autres nappes se partagent une seule lecture,
     celle-ci a la sienne, sa garde et sa mention. */
  /* `tuile` est le nom court du panneau ; la légende garde le nom entier. */
  /* La nappe de l'air est peinte en deux temps depuis le 20 septembre 2026.
     Copernicus interpolé couvre l'Europe, et les tuiles de l'indice officiel
     se posent par-dessus la France.

     La raison est le contraste. Les deux sources tombent dans la même classe
     neuf fois sur dix, mais l'indice ATMO retient le pire de ses cinq
     sous-indices et sépare bien mieux les zones : le 14 septembre, sur cinq
     villes, il prenait les valeurs 2, 3, 3, 3 et 4 quand l'indice européen
     restait entre 25 et 34, soit une seule classe. L'indice officiel ne couvre
     en revanche que la France, et une carte ouverte au zoom cinq montrerait un
     pays coloré dans un continent vide s'il était seul. */
  { cle: "air", famille: "air", id: "caAir", nom: "Qualité de l'air", tuile: "Air", ico: "brume", porte: "maintenant",
    champ: "aqi", source: "air", teinte: teinteAQI, sat: 0.58, clarte: 0.46,
    arrets: [0, 20, 40, 60, 80], unite: "", couleur: couleurAQI, officiel: true,
    credit: "Qualité de l'air Copernicus" },
  /* La grille prévue, jalon 19, lot 5 : `src/prevue.js`. */
  enFamille("vent", "ventmoy", "caVentMoy", "Vent moyen", "Vent moyen", "vent", "maintenant", "vent", R_VENT,
    [0, 15, 30, 50, 75], " km/h", { parHeure: true }),
  enFamille("vent", "rafales", "caRafales", "Rafales", null, "vent", "maintenant", "rafales", R_VENT, [0, 25, 50, 75, 100], " km/h",
    { parHeure: true }),
  enFamille("eau", "pluie24", "caPluie24", "Pluie sur 24 h", "Pluie 24 h", "goutte", "cumul prévu", "pluie24", R_PLUIE,
    [0.3, 3, 10, 25, 50], " mm"),
  /* La pluie tombée, version 179, et les autres nappes du passé, version
     180 : `src/passe.js`. Leur période se choisit au curseur de la légende,
     et `reglerPasse` récrit nom, échelle et teinte à chaque pas. */
  { cle: "pluiepassee", famille: "eau", id: "caPluiePassee", nom: "Pluie tombée", tuile: "Pluie passée", ico: "goutte",
    source: "passee", periode: true, unite: " mm" },
  enFamille("neige", "neige24", "caNeige24", "Neige sur 24 h", "Neige 24 h", "neige", "cumul prévu", "neige24", R_NEIGE,
    [0.2, 2, 10, 25, 50], " cm"),
  { cle: "neigepassee", famille: "neige", id: "caNeigePassee", nom: "Neige tombée", tuile: "Neige passée", ico: "neige",
    source: "passee", periode: true, unite: " cm" },
  enFamille("neige", "limite", "caLimite", "Limite pluie-neige", "Limite neige", "neige", "au plus bas sur 24 h", "limite", R_LIMITE,
    [0, 600, 1200, 2500, 3500], " m"),
  { cle: "rafalespassees", famille: "vent", id: "caRafalesPassees", nom: "Plus fortes rafales", tuile: "Rafales passées",
    ico: "vent", source: "passee", periode: true, unite: " km/h" },
  enFamille("vent", "pression", "caPression", "Pression", null, "jauge", "maintenant", "pression", R_PRESSION,
    [985, 1000, 1013, 1025, 1040], " hPa", { isolignes: { pas: 4, base: 1012 }, parHeure: true }),
  enFamille("temp", "gel", "caGel", "Gel de la nuit", "Gel nuit", "thermo", "minimum de 18 h à 10 h", "gel", R_GEL,
    [-10, -4, 0, 4, 10], "°", { isolignes: { niveaux: [0] } }),
  { cle: "temppassee", famille: "temp", id: "caTempPassee", nom: "Plus haute température", tuile: "Extrêmes",
    ico: "thermo", source: "passee", periode: true, unite: "°" },
  enFamille("ciel", "cielnuit", "caCielNuit", "Ciel de la nuit", "Ciel nuit", "lune", "couverture de 22 h à 2 h", "cielNuit", R_CIEL,
    [0, 25, 50, 75, 100], " %"),
  enFamille("ciel", "brouillard", "caBrouillard", "Brouillard du matin", "Brouillard", "brume", "visibilité de 5 h à 10 h", "brouillard",
    R_BROUILLARD, [100, 500, 1000, 2000, 5000], " m"),
  /* Les pollens et la mer, jalon 19, lot 5b. Le pollen le plus fort des six
     en chaque point, sur l'échelle de ses seuils ; la mer se peint hors des
     terres de France. */
  { cle: "pollens", famille: "air", id: "caPollens", nom: "Pollens", tuile: null, ico: "pollen", porte: "le plus fort des six, maintenant",
    champ: "pollens", source: "pollens", teinte: R_POLLENS.teinte, couleur: R_POLLENS.couleur, sat: R_POLLENS.sat,
    clarte: R_POLLENS.clarte, arrets: [1, 2, 3], etiquettes: ["Saison", "Pic", "Très fort"], unite: "",
    ecrire: v => (v < 1 ? "hors saison" : v < 2 ? "en saison" : v < 3 ? "au pic" : "très fort"),
    credit: "Pollens Copernicus" },
  { cle: "vagues", famille: "mer", id: "caVagues", nom: "Vagues", tuile: null, ico: "vague", porte: "hauteur maintenant",
    champ: "vagues", source: "mer", mer: true, teinte: R_VAGUES.teinte, couleur: R_VAGUES.couleur, sat: R_VAGUES.sat,
    clarte: R_VAGUES.clarte, arrets: [0, 0.5, 1, 2, 4], unite: " m",
    ecrire: v => `${String(Math.round(v * 10) / 10).replace(".", ",")} m` },
  { cle: "eaumer", famille: "mer", id: "caEauMer", nom: "Eau de mer", tuile: "Eau de mer", ico: "thermo", porte: "température maintenant",
    champ: "eauMer", source: "mer", mer: true, teinte: teinteT, sat: 0.54, clarte: 0.47,
    arrets: [12, 15, 18, 21, 24], unite: "°", couleur: couleurT },
];

/* Les échelles des nappes du passé, par pas du curseur : un cumul de deux
   mois ne se lit pas sur l'échelle d'une journée. Les teintes restent
   celles de la pluie et de la neige prévues. */
const ECHELLES_PASSE = {
  pluie: { "24h": [0.5, 3, 10, 25, 50], "48h": [0.5, 5, 15, 40, 80], "72h": [0.5, 5, 20, 50, 100], "7j": [1, 10, 30, 70, 150],
    "14j": [2, 15, 50, 100, 200], "30j": [5, 30, 80, 150, 300], "60j": [10, 50, 150, 300, 500] },
  neige: { "24h": [0.2, 2, 10, 25, 50], "48h": [0.5, 5, 15, 40, 80], "72h": [0.5, 5, 20, 50, 100], "7j": [1, 10, 30, 70, 150],
    "14j": [1, 15, 50, 100, 200], "30j": [2, 20, 80, 150, 300], "60j": [2, 30, 100, 200, 400] },
};
const TEINTES_PLUIE = [195, 215, 240, 275, 310], TEINTES_NEIGE = [195, 210, 235, 265, 290];
const R_RAFALES = rampe([[20, 170], [40, 110], [60, 50], [90, 15], [120, 320]]);
const etagee = (a, teintes, o) => rampe(a.map((v, i) => [v, teintes[i]]), { seuil: a[0], ...o });

/* Le pas et, pour les températures, l'extrême : nom, porte, champ, échelle et
   teinte de la nappe. La nappe est récrite sur place, comme les autres
   modules la lisent dans la table. */
export function reglerPasse(n, pas, extreme = "chaud") {
  if (!n || !n.periode) return n;
  n.porte = pas.nom;
  n.pas = pas.cle;
  let r;
  if (n.cle === "pluiepassee" || n.cle === "neigepassee") {
    const pluie = n.cle === "pluiepassee";
    n.champ = pluie ? "pluie" : "neige";
    n.arrets = ECHELLES_PASSE[n.champ][pas.cle];
    r = pluie ? etagee(n.arrets, TEINTES_PLUIE, { sat: 0.6, clarte: 0.5 }) : etagee(n.arrets, TEINTES_NEIGE, { sat: 0.45, clarte: 0.62 });
  } else if (n.cle === "rafalespassees") {
    n.champ = "rafales";
    n.arrets = [20, 40, 60, 90, 120];
    r = R_RAFALES;
  } else {
    n.champ = extreme;
    n.nom = extreme === "froid" ? "Plus basse température" : "Plus haute température";
    n.arrets = [-5, 5, 15, 25, 35];
    r = { teinte: teinteT, couleur: couleurT, sat: 0.54, clarte: 0.47 };
  }
  Object.assign(n, { teinte: r.teinte, couleur: r.couleur, sat: r.sat, clarte: r.clarte });
  return n;
}

for (const n of NAPPES_CARTE) reglerPasse(n, pasDe(Reglages.periodePasse()), Reglages.extremePasse());

/* Le document de la carte : les deux toiles, les repères, les outils, le
   panneau des couches, les légendes et la chronologie. */
export const gabaritCarte = g => `<div class="ca-cadre">`
  /* La toile prend le focus : les flèches la déplacent, plus et moins la
     zooment. Le résumé et la liste des étiquettes disent en texte ce qu'elle
     montre, audit du 1er octobre 2026, constat 4.9. */
  + `<canvas class="ca" id="caToile" role="img" tabindex="0" aria-describedby="caResume" `
  + `aria-label="Carte de ${esc(g.commune || "la position")} et de ses alentours"></canvas>`
  + `<p class="titre-lu" id="caResume" aria-live="polite"></p>`
  + `<ul class="titre-lu" id="caListe" aria-label="Étiquettes de la carte"></ul>`
  + `<canvas class="ca-vent" id="caToileVent" aria-hidden="true"></canvas>`
  + `<div class="ca-reperes" id="caReperes"></div>`
  /* Les prévisions des villes, jalon 18 : une couche d'étiquettes posée sous
     les repères des lieux, et le choix du moment. */
  + `<div class="ca-prevs" id="caPrevs" aria-hidden="true"></div>`
  + `<div class="ca-moments" id="caMoments" role="group" aria-label="Moment des prévisions" hidden>`
  + Villes.MOMENTS.map(([m, n]) => `<button type="button" data-moment="${m}" aria-pressed="false">${n}</button>`).join("")
  + `</div>`
  /* Deux commandes seulement depuis la version 140 : le zoom se fait au
     pincement, et les touches plus et moins le font au clavier sur la toile.
     Les deux boutons de zoom prenaient la place du panneau, demande de Jérôme
     du 2 octobre 2026. */
  + `<div class="ca-outils">`
  + `<button type="button" class="ca-o" id="caCouches" aria-expanded="false" `
  + `aria-controls="caPanneau" aria-label="Couches de la carte">`
  + ico("couches", "") + `</button>`
  + `<button type="button" class="ca-o" id="caIci" aria-label="Revenir sur le lieu courant">`
  + ico("cible", "") + `</button>`
  /* La recherche d'une commune, jalon 19, lot 4. */
  + `<button type="button" class="ca-o" id="caChercher" aria-expanded="false" `
  + `aria-controls="caRecherche" aria-label="Chercher une commune sur la carte">`
  + ico("loupe", "") + `</button>`
  /* Le plein écran, jalon 19, lot 7. */
  + `<button type="button" class="ca-o" id="caPlein" aria-pressed="false" aria-label="Carte en plein écran">`
  + ico("agrandir", "") + `</button>`
  + `</div>`
  + `<div class="ca-recherche" id="caRecherche" hidden>`
  + `<input type="search" id="caRechercheChamp" placeholder="Chercher une commune" `
  + `aria-label="Chercher une commune" autocomplete="off" enterkeyhint="search">`
  + `<ul class="ca-r-liste" id="caRechercheListe"></ul></div>`
  /* La bulle d'un point touché, jalon 19, lot 4, et la marque du point. */
  + `<span class="ca-bulle-pt" id="caBullePt" hidden aria-hidden="true"></span>`
  + `<div class="ca-bulle" id="caBulle" role="dialog" aria-labelledby="caBulleNom" tabindex="-1" hidden>`
  + `<div class="cb-tete"><b id="caBulleNom"></b>`
  + `<button type="button" class="cb-fermer" id="caBulleFermer" aria-label="Fermer">` + ico("fermer", "") + `</button></div>`
  + `<div class="cb-corps" id="caBulleCorps" aria-live="polite"></div>`
  + `<button type="button" class="cb-voir" id="caBulleVoir">Voir la prévision</button></div>`
  /* Le panneau en deux rangées qui défilent de côté, la nappe puis ce qui se
     pose par-dessus, depuis la version 140. En grille, chaque couche nouvelle
     ajoutait une rangée ; en défilement, le panneau garde sa hauteur quel que
     soit le nombre des couches. Chaque tuile garde son nom sous son icône.

     Depuis la version 154, demande de Jérôme du 3 octobre 2026, les nappes
     vont par familles : une ligne par famille, son nom à gauche, ses tuiles à
     droite. Seize nappes en sept lignes tiennent encore dans le cadre sans
     défilement ; des titres posés au-dessus de chaque famille l'auraient fait
     déborder. « Aucune » passe dans la ligne du titre. */
  + `<div class="ca-panneau" id="caPanneau" hidden>`
  + `<div class="ca-p-tete"><p class="ca-p-titre" id="caPnTitre">Nappe</p>`
  + `<button type="button" class="ca-aucune" id="caSansNappe" role="radio" `
  + `aria-checked="${Reglages.nappe() === null ? "true" : "false"}">Aucune</button></div>`
  + `<div class="ca-familles" role="radiogroup" aria-labelledby="caPnTitre">`
  + FAMILLES.map(([fam, nom]) => `<div class="ca-fam" role="group" aria-label="${esc(nom)}">`
    + `<span class="ca-fam-nom" aria-hidden="true">${esc(nom)}</span>`
    + NAPPES_CARTE.filter(n => n.famille === fam).map(n => `<button type="button" class="ca-ch" id="${n.id}" `
      + `role="radio" aria-checked="${Reglages.nappe() === n.cle ? "true" : "false"}">`
      + ico(n.ico, "") + `<span>${n.tuile || n.nom}</span></button>`).join("")
    + `</div>`).join("")
  + `</div>`
  + `<p class="ca-p-titre" id="caPnTitre2">Par-dessus</p>`
  + `<div class="ca-grille" role="group" aria-labelledby="caPnTitre2">`
  + `<button type="button" class="ca-ch" id="caPluie" role="switch" `
  + `aria-checked="${Reglages.pluiecarte() ? "true" : "false"}">`
  + ico("goutte", "") + `<span>Pluie</span></button>`
  + `<button type="button" class="ca-ch" id="caVent" role="switch" `
  + `aria-checked="${Reglages.ventcarte() ? "true" : "false"}">`
  + ico("vent", "") + `<span>Vent</span></button>`
  + `<button type="button" class="ca-ch" id="caVigi" role="switch" `
  + `aria-checked="${Reglages.vigicarte() ? "true" : "false"}">`
  + ico("alerte", "") + `<span>Vigilance</span></button>`
  + `<button type="button" class="ca-ch" id="caFoudre" role="switch" `
  + `aria-checked="${Reglages.foudrecarte() ? "true" : "false"}">`
  + ico("orage", "") + `<span>Foudre</span></button>`
  + `<button type="button" class="ca-ch" id="caNuages" role="switch" `
  + `aria-checked="${Reglages.nuagescarte() ? "true" : "false"}">`
  + ico("nuage", "") + `<span>Nuages</span></button>`
  + `<button type="button" class="ca-ch" id="caFeux" role="switch" `
  + `aria-checked="${Reglages.feuxcarte() ? "true" : "false"}">`
  + ico("feu", "") + `<span>Feux</span></button>`
  + `<button type="button" class="ca-ch" id="caPrevi" role="switch" `
  + `aria-checked="${Reglages.previcarte() ? "true" : "false"}">`
  + ico("soleil", "") + `<span>Prévisions</span></button>`
  + `<button type="button" class="ca-ch" id="caPlages" role="switch" `
  + `aria-checked="${Reglages.plagecarte() ? "true" : "false"}">`
  + ico("vague", "") + `<span>Plages</span></button>`
  + `<button type="button" class="ca-ch" id="caNeige" role="switch" `
  + `aria-checked="${Reglages.neigecarte() ? "true" : "false"}">`
  + ico("neige", "") + `<span>Neige</span></button>`
  + `<button type="button" class="ca-ch" id="caRivieres" role="switch" `
  + `aria-checked="${Reglages.rivierecarte() ? "true" : "false"}">`
  + ico("riviere", "") + `<span>Cours d'eau</span></button>`
  + `</div>`
  + `</div>`
  + `<p class="ca-mot" id="caMot" role="status" hidden></p>`
  + `<div class="ca-pied">`
  /* Les légendes réunies, version 155, demande de Jérôme du 3 octobre 2026 :
     une boîte au lieu d'une par couche, la nappe sur sa ligne, le vent, la
     foudre et les feux ensemble dessous. Un appui la replie en une pastille,
     un autre la déplie ; le choix se garde. */
  + `<div class="ca-legendes${Reglages.legendeRepliee() ? " replie" : ""}" id="caLegendes" role="button" tabindex="0" `
  + `aria-expanded="${Reglages.legendeRepliee() ? "false" : "true"}" aria-label="Légende de la carte, appuyer pour la replier ou la déplier">`
  + `<span class="ca-leg-pastille" aria-hidden="true">Légende</span>`
  + `<div class="ca-leg-corps">`
  + `<div class="ca-legende" id="caLegende" hidden>`
  + `<b class="ca-l-titre" id="caLegTitre"></b>`
  + `<i class="ca-rampe" id="caRampe"></i>`
  + `<div class="ca-graduations" id="caGrads"></div>`
  /* Le curseur de la période, version 180, sous l'échelle des nappes du
     passé ; le plus haut ou le plus bas pour les températures. */
  + `<div class="ca-periode" id="caPeriode" hidden>`
  + `<input type="range" id="caPerCurseur" min="0" max="6" step="1" aria-label="Période">`
  + `<output id="caPerVal"></output>`
  + `<span class="ca-extreme" id="caExtreme" hidden role="radiogroup" aria-label="Extrême">`
  + `<button type="button" role="radio" data-extreme="chaud">Max</button>`
  + `<button type="button" role="radio" data-extreme="froid">Min</button></span>`
  + `</div>`
  + `</div>`
  + `<div class="ca-lv-ligne">`
  + `<div class="ca-legende ca-lv" id="caLegVent" hidden></div>`
  + `<div class="ca-legende ca-lv ca-lx" id="caLegFeux" hidden `
  + `aria-label="Foyers vus par satellite sur les deux derniers jours">`
  + `<span class="ca-lv-r"><i class="ca-pastille-feu"></i><span id="caFeuxNom">Foyers satellite, 48 h</span></span>`
  + `<span class="ca-lv-r"><i class="ca-pastille-brule"></i>Surfaces brûlées</span>`
  + `</div>`
  + `<div class="ca-legende ca-lv ca-lf" id="caLegFoudre" hidden `
  + `aria-label="Foudre des trente dernières minutes, du jaune pour un éclair au rouge sombre pour vingt et plus">`
  + `<span class="ca-lv-r"><i class="ca-rampe-foudre"></i>Foudre, 30 min</span>`
  + `</div>`
  + `</div>`
  /* La période des feux, version 180. */
  + `<div class="ca-periode" id="caPerFeux" hidden>`
  + `<span class="ca-per-nom">Feux</span>`
  + `<input type="range" id="caPerFeuxCurseur" min="0" max="5" step="1" aria-label="Période des feux">`
  + `<output id="caPerFeuxVal"></output>`
  + `</div></div></div>`
  /* Les sources ne s'affichent plus en permanence, version 140, demande de
     Jérôme : elles se lisent derrière un bouton, et en entier dans la carte
     « Sources » des réglages. Le bouton reste sur la carte parce que les
     licences demandent que la source soit accessible depuis ce qu'elle
     montre. */
  + `<div class="ca-bas">`
  + `<div class="ca-echelle" id="caEchelle"><i></i><span></span></div>`
  + `<button type="button" class="ca-src" id="caSources" aria-expanded="false" `
  + `aria-controls="caCredit" aria-label="Sources de la carte">` + ico("info", "") + `</button>`
  + `</div>`
  + `<p class="ca-credit" id="caCredit" hidden>Contours IGN et Natural Earth</p>`
  + `<div class="ca-temps" id="caTemps" hidden>`
  + `<button type="button" class="ca-jouer" id="caJouer" `
  + `aria-label="Lire la chronologie">` + ico("lecture", "") + `</button>`
  + `<div class="ca-piste" id="caPiste" role="slider" tabindex="0" `
  + `aria-label="Instant de la chronologie de pluie" `
  + `aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="">`
  + `<i class="ca-graduation"></i><i class="ca-tete"></i></div>`
  + `<b class="ca-heure" id="caHeure"></b>`
  + `</div></div></div>`;
