# Plan des chantiers facultatifs de l'audit

Plan du 2 octobre 2026, version 134. Il couvre les trois chantiers laissés
ouverts par l'audit du 1er octobre : l'outil de captures, constat 6.12 ; la
suite des contrôles, constats 6.5 et 6.6 ; la carte découpée par couche, étape 5
de `docs/plan-decoupage-vues.md`.

## Mesures de départ

Passe chronométrée du 2 octobre 2026 sur le Mac, `CHRONO=1` :

| Mesure | Valeur |
|---|---|
| Durée de la suite | 605 secondes, 1035 contrôles, 47 sections |
| Ouvertures de page | 121, pour 93 secondes |
| Pauses fixes | 270, pour 185 secondes, dont 49 d'une seconde ou plus |
| Sections les plus longues | Suivi de la position, 85 secondes dont 32 de pauses ; Ressenti calibré, 81 secondes ; États vide et chargement, 56 secondes dont 16 de pauses ; Nappes de la carte, 50 secondes |
| `essais/controle.mjs` | 12 722 lignes, dont 350 de faux services |
| `essais/vue-ecran.mjs` | 452 lignes, avec sa propre copie partielle des faux services et sans filet du réseau |
| `src/vues/carte.js` | 978 lignes, dont une fonction `vueCarte` d'environ 900 lignes : une seule fermeture où les couches partagent le cadrage, la grille des mesures et les réglages |

Les sections de la suite ne sont pas indépendantes : presque toutes travaillent
sur la même page, dans l'état laissé par la section précédente.

## Les étapes

| Étape | Contenu | Effet |
|---|---|---|
| 1 | Les faux services sortent de `controle.mjs` dans un module commun, `essais/faux-services.mjs`, avec la date figée, la commune d'essai et le filet du réseau. `controle.mjs` et `vue-ecran.mjs` s'en servent tous deux | L'outil de captures ne touche plus le vrai réseau et montre les mêmes données que les contrôles |
| 2 | Les pauses fixes d'une seconde ou plus deviennent des attentes sur une condition : un élément affiché, une requête reçue, un dessin terminé. Les pauses courtes qui laissent passer une animation restent | Une à deux minutes de moins, et une suite moins sensible à la charge du poste |
| 3 | La suite se découpe en un fichier par groupe de sections sous `essais/sections/`, `controle.mjs` gardant le serveur, le navigateur et l'ordre de passage. La page reste partagée et l'ordre inchangé ; `JUSQUA` fonctionne comme avant | Un fichier de quelques centaines de lignes à ouvrir pour une section |
| 4 | `vueCarte` se découpe : un objet d'état commun, puis un module par groupe, chronologie du radar, légende, panneau des couches, couches à données | Une couche se lit et se modifie seule. Seule étape qui touche l'application, version 135 |

Chaque étape se termine par une passe complète verte sur le Mac, puis sur
GitHub. Les étapes 1 à 3 ne changent aucun contrôle : le nombre reste 1035, et
un échantillon d'erreurs volontaires, une par section touchée, est repassé
pour vérifier que les contrôles détectent toujours ce qu'ils visent. L'étape 4
ne change pas ce que voit l'utilisateur ; ses erreurs volontaires de la carte
sont repassées toutes.

## Option écartée par défaut

Rendre chaque section indépendante, avec sa propre page et son état de départ,
permettrait de passer une section seule et de passer la suite en deux moitiés
parallèles, soit environ six minutes au lieu de dix. Le travail est long : il
faut écrire l'état de départ de chacune des 47 sections et vérifier qu'aucune
ne dépend plus d'une autre. Il peut suivre l'étape 3 si le besoin s'en fait
sentir.

## Durée

Étape 1, une demi-journée. Étape 2, une demi-journée, la plus délicate, une
attente mal choisie rendant un contrôle instable. Étape 3, une demi-journée,
mécanique. Étape 4, une journée avec ses épreuves.

## Suivi

Décisions de Jérôme du 2 octobre 2026 : les quatre étapes dans l'ordre, les
sections indépendantes en plus, une seule publication à la fin, en
version 135.

1. Étape 1 faite. `essais/faux-services.mjs` porte les charges d'essai, les
   routes et le filet ; l'état que les contrôles font varier vit dans un objet
   rendu par `nouvelEtat`. L'outil de captures s'en sert et ne garde que les
   charges posées pour l'image. Passe complète verte, 1035 contrôles.
2. Étape 3 et sections indépendantes faites ensemble, avant l'étape 2 :
   chaque section passée seule rendait les pauses faciles à éprouver. La suite
   compte 45 fichiers sous `essais/sections/`, `essais/banc.mjs` prépare
   chaque section à neuf, et `essais/controle.mjs` les passe trois à la fois.
   Neuf sections supposaient l'écran laissé par la précédente et l'ouvrent
   désormais en tête ; six aides partagées sont passées dans le banc. Durée de
   la suite : 605 secondes avant, 337 à deux sections côte à côte, 183 à
   trois, 138 à quatre.
3. Étape 2 faite. Les 45 pauses d'une seconde ou plus deviennent des attentes
   du repos de la page, plafonnées à une fois et demie l'ancienne pause ; deux
   restent fixes, l'installation de la copie hors ligne et l'ossature d'une
   première lecture lente. Une troisième revient à la pause fixe : la toile du
   vent figé change sans toucher au document, et l'erreur volontaire 181
   n'était plus vue. L'attente commence par deux images d'écran, faute de quoi
   le ruban était relu avant d'être redessiné en paysage. Sur une passe, 137
   attentes, 41 secondes en tout, aucune au plafond.
4. Étape 4 faite, version 135. Voir le suivi de `docs/plan-decoupage-vues.md`.
5. Les 181 erreurs volontaires repassées une à une, chacune sur la seule
   section qui porte son contrôle : toutes vues, après les reprises suivantes.
   - 33 visaient encore `src/vues.js`, vide de code depuis le découpage de la
     version 133, et ne s'appliquaient plus : 27 sont reciblées sur le fichier
     qui porte désormais leur code, 8 récrites sur le code actuel.
   - La vérification « erreur non appliquée » compare désormais toute la copie,
     `src/` entier et le manifeste compris ; l'erreur 155, qui touche le
     manifeste, passait pour non appliquée.
   - Les erreurs 6 et 8 attendaient un contrôle sous un ancien nom.
   - Trois contrôles ne voyaient déjà plus leur erreur dans la version 134.
     L'erreur 14 portait sur l'ouverture du ruban par un chiffre de l'accueil,
     quand le contrôle l'ouvrait par « Plus de détails » ; il essaie désormais
     les deux. L'erreur 33 retirait une règle d'arrondi devenue redondante
     depuis le jalon 12 ; elle retire aussi la règle générale. La couture de
     l'erreur 108, nette à l'image, ne ressortait que sur trois lignes de
     mesure sur cinq ; le vote se prend désormais sur treize lignes.
   - L'erreur 181 dépendait d'une course : la grille du vent arrivait avant ou
     après le cadrage de la carte selon la charge du poste. Le contrôle rouvre
     désormais la carte, la grille déjà lue arrivant à coup sûr avant le
     cadrage ; vue trois fois sur trois.
   - Deux autres attentes du repos, avant une lecture de toile, reviennent à la
     pause fixe : le ciel couvert et les tuiles de l'indice de l'air.
