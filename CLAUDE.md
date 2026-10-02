# Ma météo

Application météorologique pour téléphone, publiée sur GitHub Pages à l'adresse
https://techthisapp.github.io/ma-meteo/ depuis la branche `main` du dépôt
`techthisapp/ma-meteo`. Site statique installable, sans serveur, sans base de
données, sans compte. Le commanditaire est Jérôme Prunis. Le projet a été mené
dans claude.ai jusqu'à la version 118, le 1er octobre 2026, puis transféré dans
Claude Code.

Ce fichier se lit au début de chaque session. Le détail des décisions vit dans
`docs/feuille-de-route.md`, l'état de reprise dans `docs/reprise.md`.

## Architecture

| Élément | Rôle |
|---|---|
| `index.html`, `styles.css`, `manifest.webmanifest` | La page unique, sa feuille de style, le manifeste d'installation |
| `src/*.js` | Les modules ES, sans compilation ni bibliothèque. `app.js` orchestre, `carte.js` dessine la carte |
| `src/vues/*.js` | Un fichier par écran ou groupe de feuilles, depuis la version 133. `app.js` les importe directement, la carte et le ciel à la première ouverture de leur onglet depuis la version 134 ; `src/vues.js` ne relaie plus les noms qu'aux contrôles et n'est pas dans la coque. La carte se compose depuis la version 135 de `carte.js` et de cinq modules `carte-*.js` qui partagent un objet d'état, décrit en tête de `carte.js`. Tout fichier nouveau de l'application entre dans la coque de `sw.js` |
| `sw.js` | L'agent de service et la coque hors ligne : la liste de tous les fichiers à garder |
| `src/version.js` | Le numéro de version affiché |
| `donnees/` | Les données embarquées, contours et référentiels |
| `src/stations.js`, `src/plages.js` | Les listes embarquées des stations de ski et des plages, produites par `outils/` |
| `outils/` | Les scripts de construction des listes embarquées |
| `donnees/relief.webp`, `relief.json`, `rivieres.json`, `villes.json` | Le fond enrichi de la carte depuis la version 142, produit par `node outils/construire-fond.mjs` et dessiné par `src/fond.js` |
| `essais/` | La suite de contrôles : `controle.mjs` la lance, `banc.mjs` prépare chaque section, `faux-services.mjs` répond à la place des vraies sources, `sections/` porte une section par fichier ; `vue-ecran.mjs` fait les captures avec les mêmes faux services |
| `docs/` | La feuille de route, l'état de reprise, les consignes du projet |

Les sources de données, toutes interrogées depuis le navigateur :

| Source | Emploi | Particularités |
|---|---|---|
| Open-Meteo | Prévision, ensembles, archive, mer, sol, neige, air | Quota gratuit compté par adresse : des essais répétés depuis un même poste finissent en refus 429. Le téléphone de l'utilisateur n'est pas concerné. Une réponse garde un seul décalage horaire, celui du moment de la requête : toute lecture passe par `recaler` de `src/horloge.js`, qui la récrit à l'heure de Paris. Depuis la version 131, `cleJour` et `cleHeure` écrivent un instant à l'heure de Paris, et `instantParis` lit une heure des données comme un instant de Paris : un téléphone réglé sur un autre fuseau trouve les bonnes heures |
| Météo-France | Vigilance | |
| VigiEau | Restrictions d'eau, par département et pour un point | Accepte les requêtes de l'application |
| Hub'eau | Nappes, rivières, étiage ONDE, température de l'eau | Lent, huit à treize secondes par appel ; les lectures se font après l'affichage, avec trente secondes d'attente au plus |
| OSRM, serveur public | Durées de route vers les stations et les plages | Démonstration à charge limitée : une requête par commune, gardée trente jours |
| OpenSkiMap | Liste des stations de ski | Licence ODbL : citer OpenSkiMap et les contributeurs d'OpenStreetMap |
| Agence européenne de l'environnement | Liste des eaux de baignade et leur classement | |
| geo.api.gouv.fr, api-adresse.data.gouv.fr | Communes | Le service d'adresses est instable |

Sources écartées et pourquoi : Vigicrues refuse les requêtes des autres
applications ; Géorisques était injoignable depuis le poste de développement de
claude.ai, à revérifier ; la météo des forêts et les bulletins d'avalanche de
Météo-France demandent une clé, à revérifier ; Overpass et ohsome étaient
indisponibles pour construire les listes.

## Publication

1. Monter la version à deux endroits : `const VERSION` dans `sw.js` et dans
   `src/version.js`, au format `ma-meteo-vNNN`.
2. Tout module importé doit figurer dans la coque de `sw.js` ; un contrôle le
   vérifie, imports dynamiques compris, et un oubli casse l'application hors
   connexion. Les listes des plages et des stations se chargent à la demande
   depuis la version 128 et restent dans la coque.
3. Ne pousser qu'une suite complète entièrement verte sur le Mac.
4. Le message de commit, en français, décrit la demande, le choix, les défauts
   trouvés en route et le bilan des contrôles.
5. Pousser sur `main`. Depuis la version 139, la publication passe par GitHub
   Actions, `.github/workflows/controles.yml` : la suite complète tourne sur
   les machines de GitHub, et la tâche `publier` ne déploie que si elle est
   verte. Seule l'application est publiée, `index.html`, `styles.css`, le
   manifeste, `sw.js`, `src/`, `donnees/` et `icones/` ; les notes, les
   contrôles et les outils ne sont plus servis. Compter quatre à six minutes.
   La tâche vérifie elle-même la version servie et l'absence de `CLAUDE.md` ;
   à la main : `gh run list --workflow controles.yml`, puis
   `curl -s "https://techthisapp.github.io/ma-meteo/sw.js?x=$(date +%s)" | grep -o 'ma-meteo-v[0-9]*'`.
   Un fichier nouveau hors de ces dossiers doit être ajouté à la copie de la
   tâche `publier`.
6. Mettre à jour `docs/feuille-de-route.md` et `docs/reprise.md`.

Aucun jeton ni secret dans le dépôt : Git emploie les identifiants du poste.

Réseau, depuis la version 129 : tout appel passe par `chercher` de
`src/horloge.js`, borné à dix secondes par défaut, lecture du corps comprise ;
les modules passent `chercher` ou `chercherEn(délai)` comme `fetcheur` par
défaut, cinq secondes pour le service d'adresses, quarante pour Hub'eau. La
prévision attend le délai demandé avant de réessayer un refus 429.

Confidentialité, depuis la version 123 : en mode position, les services ne
reçoivent que la position arrondie au centième de degré (`envoi` de
`src/reglages.js`), le service d'adresses un point au millième ; le relevé
précis reste sur l'appareil, dans `releve`, et ne sert qu'à mesurer un
déplacement. Tout service nouveau qui reçoit le lieu s'ajoute à la carte
« Sources » des réglages.

## Contrôles

Installation sur un nouveau poste : `npm ci`, qui suit `package-lock.json` et
installe Playwright 1.63.0, puis `npx playwright install chromium`.

| Commande | Effet |
|---|---|
| `bash essais/passe.sh 8137` | La suite complète, sur une copie du dépôt dans `/tmp/passe-<port>` ; trois minutes, 1062 contrôles à la version 142 |
| `SECTIONS="carte,vent" bash essais/passe.sh 8137` | Les seules sections dont le titre ou le nom de fichier contient l'un des motifs |
| `JUSQUA="La bande horaire" bash essais/passe.sh 8137` | La suite jusqu'à la fin d'une section |
| `PARALLELE=1 CHRONO=1 bash essais/passe.sh 8137` | Une section à la fois, avec le temps de chacune ; trois passent côte à côte par défaut |
| `bash essais/epreuve-bande.sh <n>` | Une erreur volontaire : le script introduit l'erreur numéro n dans une copie, ne passe que la section qui porte le contrôle attendu, et vérifie qu'il échoue. Verdicts possibles : vue, non vue, non appliquée, ou épreuve interrompue |

Les erreurs volontaires sont numérotées dans `essais/epreuve-bande.sh` ; la
dernière porte le numéro 224. Tout contrôle nouveau a son erreur volontaire, et
une erreur volontaire éprouvée pendant que son contrôle échoue déjà sur le bon
code doit être repassée.

Les vingt-quatre scripts d'épreuve antérieurs, `essais/epreuve-air.sh` à
`essais/epreuve-vent.sh`, sont retirés le 2 octobre 2026 : seize modifiaient
`src/` sur place, et aucun ne tournait plus sur le Mac. Leurs erreurs
volontaires ont été éprouvées en leur temps, et les contrôles qu'elles visaient
restent dans la suite. Les scripts restent dans l'historique, au commit
44ac131, pour qui voudrait reprendre un cas dans `epreuve-bande.sh`.

Règles apprises à l'usage :

1. Deux suites en parallèle au plus : trois dépassent la mémoire et ferment le
   navigateur sous elles. Une suite fait déjà passer trois sections côte à
   côte, et deux épreuves en parallèle tiennent sans peine.
2. Ne pas éprouver une erreur volontaire pendant une passe complète dont on juge
   le résultat : la charge décale l'instant où le ciel animé est photographié.
3. Les contrôles servent leurs propres données : les faux services sont dans
   `brancherFauxServices` de `essais/faux-services.mjs`, avec leur état propre
   à chaque section, et `envelopperNavigateur` fait que tout contexte réponde
   d'office à VigiEau et à Hub'eau, et une coupure à OSRM et à Météo-France. Un filet refuse toute autre
   requête vers le réseau réel, et le contrôle « aucune requête ne sort vers
   le vrai réseau » échoue si une seule passe le filet.
4. La date des contrôles est figée au 18 août 2026, la commune d'essai est Fain.
5. Le contrôle de jointure du ciel couvert enregistre `/tmp/couture.png` et
   `/tmp/couture.txt` : regarder l'image avant de corriger quoi que ce soit.
6. Pour arrêter un processus, jamais de motif qui figure dans la commande
   elle-même ; viser son numéro.
7. Vérifier qu'un nom de fichier est libre avant de le créer.
8. Un script en cours d'exécution se remplace d'un seul geste, par un fichier
   neuf renommé, jamais en le réécrivant en place.
9. La commande `timeout` manque sous macOS : `passe.sh` et `epreuve-bande.sh`
   bornent la durée de la suite par `essais/borne.sh`, qui emploie `perl`
   quand `timeout` est absent.
10. Chaque section part d'un état neuf, que prépare `preparer` de
   `essais/banc.mjs` : une page sur l'accueil de Fain si elle s'en sert, ses
   faux services, ses contextes fermés à sa fin. Une section qui suppose un
   écran déjà ouvert l'ouvre elle-même en tête. Elle ne lit rien d'une autre
   section ; une aide partagée va dans le banc.
11. Pour attendre qu'une page se pose, `reposer(page, plafond)` du banc plutôt
   qu'une pause fixe : la page est au repos quand son contexte n'a plus de
   requête en cours et que le document n'a pas bougé depuis un quart de
   seconde. Une toile change sans toucher au document : un contrôle qui lit
   une toile après un délai garde sa pause fixe, comme le vent figé de la
   section du vent.
12. Les espaces insécables de l'application, posées par `src/typo.js` depuis
   la version 138, se lisent comme des espaces ordinaires : le banc normalise
   toute chaîne que Playwright rapporte de la page. Un contrôle qui compare un
   texte dans la page elle-même, dans `evaluate`, normalise lui-même ; le
   contrôle de la typographie lit le texte brut par `evaluateBrut`.

## Construction des listes embarquées

| Liste | Commande | Remarque |
|---|---|---|
| Stations de ski | `curl -o /tmp/ski_areas.geojson https://tiles.openskimap.org/geojson/ski_areas.geojson` puis `python3 outils/construire-stations.py /tmp/ski_areas.geojson` | À refaire chaque saison ; les stations se rangent sous leur domaine d'après les emprises |
| Fond de la carte | `node outils/construire-fond.mjs`, ou avec `villes`, `relief` ou `rivieres` pour une seule partie | Quelques minutes. Cours d'eau de la BD CARTO de l'IGN, nommés et d'au moins vingt kilomètres ; la BD TOPO ne donne que des fragments. Relief d'après les tuiles Terrarium, ombrage calculé dans le Chromium de Playwright |
| Plages | `python3 outils/construire-plages.py` | Plusieurs minutes quand le service d'adresses répond ; il l'abandonne après vingt échecs. Il lance ensuite `node outils/orienter-plages.mjs`, qui ajoute à chaque plage française la direction de la mer, calculée sur les contours embarqués, sans réseau |

## Écriture

Toute rédaction en français destinée à Jérôme, réponses, documents, commentaires
de code et messages de commit, suit ces règles :

1. Pas de tiret cadratin ni demi-cadratin, pas de flèches, pas de symboles dans
   le texte courant ; écrire en toutes lettres.
2. Pas de formulation au style d'IA : ni aphorisme, ni antithèse du type « X, pas
   Y », ni triade rhétorique, ni chute en fin de phrase.
3. Un objet n'agit pas comme une personne ; pas de participe en apposition ;
   répéter le mot plutôt qu'un pronom lointain.
4. Titres nominaux et sobres ; livrables autoporteurs, sans méta-commentaire.
5. Numéroter les questions posées à Jérôme, et les poser par petits lots.
6. Unités métriques.
7. Vocabulaire convenu : « contrôle » pour un test automatique, « erreur
   volontaire » pour une erreur introduite exprès afin de vérifier qu'un
   contrôle la détecte. Ne pas employer « garde » ni « faute » avec Jérôme ; le
   code et les journaux gardent leurs noms internes.

Les consignes détaillées du projet sont dans `docs/consignes/`.

## État au 2 octobre 2026

Version 142, publiée depuis Claude Code. Jalons livrés : 1 à 4, 7 à 18, dont 14, la comparaison ; 15, les
plages ; 16, la neige ; 17, la semaine au plus loin ; 18, les couches de la
carte et l'eau. Jalon 19 ouvert, la carte enrichie : lots 1 et 2 livrés en versions 140 à 142,
lots 3 à 7 à faire. Jalons restants : 6, la justesse des prévisions publiée, vers
la fin octobre ; 5, la 3D, écartée pour le moment.

Points connus à reprendre :

1. L'orientation des plages vient de contours simplifiés : 1322 plages
   françaises sur 1839 en ont une, les autres, criques, presqu'îles, fonds de
   baie et abords des frontières, gardent le vent dit par son seul point
   cardinal. Une côte plus fine la donnerait à davantage de plages.
2. Les heures affichées sont celles de Paris. L'outre-mer n'est pas visé,
   décision de Jérôme du 2 octobre 2026 : rien à faire tant que personne ne
   s'en sert hors de la métropole.

Intégration continue, depuis le 2 octobre 2026 : `.github/workflows/controles.yml`
passe la suite complète sur les machines de GitHub à chaque envoi sur `main`,
puis publie l'application si elle est verte, depuis la version 139.
Son résultat se lit par `gh run list --workflow controles.yml`.
