# Plan du découpage de `src/vues.js`

Plan écrit le 2 octobre 2026, à la demande de Jérôme, avant le chantier. Audit
du 1er octobre 2026, constats 5.1, 6.7 et 6.9.

## Point de départ

`src/vues.js` compte 4 642 lignes, 109 déclarations de haut niveau, dont 39
exportées, et 42 imports. Il réunit tous les écrans et toutes les feuilles. Sa
seule fonction `vueCarte` fait 937 lignes.

Deux lecteurs en dépendent :

1. `src/app.js` importe vingt-six noms depuis `./vues.js`.
2. La suite des contrôles l'importe douze fois dans la page,
   `import("/src/vues.js")`, pour `grapheSemaine`, `phraseConfiance`,
   `bandeauAccueil`, `viseeDe`, `nuitNoire` et d'autres.

## Principe

Un déplacement sans changement de comportement. Chaque déclaration part telle
quelle dans un fichier par écran, sous `src/vues/`. `src/vues.js` devient un
relais qui réexporte tous les noms : `app.js` et les contrôles ne changent pas.
Chaque fichier nouveau entre dans la coque de `sw.js` ; le contrôle de la coque
le vérifie.

## Les fichiers

Étendues mesurées sur la version 132.

| Fichier | Contenu | Lignes |
|---|---|---|
| `vues/communs.js` | `hm`, `versCardinal`, `valeur`, `anglePhase`, `rangeeAstre`, `rangees`, et l'écouteur de redimensionnement partagé `poserRedimension` | 50 |
| `vues/heures.js` | `vueTemps`, la page « Heure par heure » | 52 |
| `vues/avenir.js` | `vueSemaine`, son graphique, la confiance, les grandes lignes, le volet | 410 |
| `vues/vigilance.js` | `vueVigilance` | 81 |
| `vues/astres.js` | les couleurs du ciel, `bandeauAccueil`, le Soleil, la Lune, la trajectoire, le ruban de la lumière, et `nuitCivile`, `nuitNoire` | 750 |
| `vues/etoiles.js` | la voûte étoilée, ses informations, `vueEtoiles` et `vueCiel` | 580 |
| `vues/carte.js` | `NAPPES_CARTE` et `vueCarte` | 950 |
| `vues/lieux.js` | `vueCommunes`, `vueAjout`, glissement, ordre et recherche | 447 |
| `vues/feuilles.js` | parapluie, activités, air, beau temps, ressenti, réglages, avec `justesseHTML` | 700 |
| `vues/climat.js` | `vueClimat`, la comparaison et ses graphiques | 356 |
| `vues/loisirs.js` | `vueNeige`, `vuePlage`, `vueEau` | 200 |

Dépendances entre les fichiers, toutes dans un seul sens :

1. Tous emploient `communs.js`, surtout `valeur`.
2. `etoiles.js` emploie `astres.js`, pour `vueSoleil`, `vueLune` et
   `astresVus`.
3. `lieux.js` emploie `astres.js`, pour `cielDe`.
4. `climat.js` emploie `poserRedimension`, rangé dans `communs.js`.

Deux déplacements défont les deux seules boucles : `nuitNoire` et `nuitCivile`
rejoignent `astres.js`, qui s'en sert, et `justesseHTML` rejoint
`feuilles.js`, seul à l'employer.

## Les étapes

Chaque étape se termine par une passe complète verte sur le Mac, puis sur
GitHub, et par une version publiée. Aucune n'ajoute de contrôle : le
comportement ne change pas, et les 1 033 contrôles existants en répondent.

| Étape | Contenu | Version |
|---|---|---|
| 1 | Le relais `vues.js`, `communs.js`, puis les écrans sans dépendance croisée : heures, avenir, vigilance, lieux, feuilles, climat, loisirs | 133 |
| 2 | `astres.js` et `etoiles.js` | 134 |
| 3 | `carte.js` | 135 |
| 4 | Chargement différé de la carte et des étoiles : `app.js` les importe à la première ouverture de leur onglet, avec un état « chargement » le temps de l'import. Le relais ne les réexporte plus. Comportement nouveau : contrôles et erreurs volontaires pour un premier affichage sans ces modules, et pour leur ouverture hors connexion | 136 |
| 5 | Facultatif : `vueCarte` découpée par couche, pluie, foudre, nuages, air, feux, vent, neige et plages, légende et chronologie | à décider |

L'étape 4 est la seule qui change ce que voit l'utilisateur, à peine : la carte
ou le ciel peut mettre un instant de plus à s'ouvrir la première fois. Elle
retire du premier chargement la carte, ses modules propres et la voûte
étoilée : environ 90 kilooctets compressés, mesurés sur la version 132. Le
contour de la France, `geographie.js`, en fait 26 à lui seul. `atmo.js` et
`deplacement.js` restent au chargement, la feuille de l'air et l'accueil s'en
servant aussi.

## Risques et parades

1. **Un nom oublié dans le relais** : `app.js` échouerait au chargement, et
   toute la suite avec. Le contrôle existant de la coque et la première section
   de la suite le voient aussitôt.
2. **Une variable de module partagée entre deux écrans**, comme
   `periodeTemps` ou `redimensions` : déplacée avec le seul écran qui l'emploie,
   ou dans `communs.js` si deux l'emploient. Le relevé des dépendances ci-dessus
   n'en montre pas d'autre.
3. **Une collision de nom** avec un module existant : les fichiers vivent sous
   `src/vues/`, ce qui évite `src/temps.js`, `src/climat.js` et
   `src/vigilance.js`.
4. **Les contrôles qui lisent le texte de `vues.js`** : la recherche ne trouve
   que des imports dans la page, couverts par le relais ; le contrôle de la
   densité des toiles lit `src/vues.js` et devra lire les nouveaux fichiers.

## Durée

Les étapes 1 à 3 tiennent en une demi-journée de travail et de passes ;
l'étape 4, une demi-journée de plus avec ses contrôles et leurs épreuves.
