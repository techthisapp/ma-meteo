# Ma météo

En ligne : https://techthisapp.github.io/ma-meteo/

Application météorologique pour téléphone. Site statique installable, sans
service dorsal, sans base de données, sans compte. Métropole française.

## Contenu

| Écran | Ce qu'il porte |
|---|---|
| Accueil | Le jour en grand titre, température, ciel, bornes du jour, quatre mesures, puis une seule carte « À retenir » réunissant les vingt-quatre heures et ce qui vient au-delà, enfin l'accès à la vigilance |
| Le temps | Vingt-quatre heures glissantes en trois écritures : ruban à sept voies, liste à treize colonnes, moments par tranches de six heures |
| La semaine | Sept jours : symbole de ciel et lame sous lui, borne basse à gauche, plage de température sur une échelle commune, borne haute à droite, point du moment sur la journée en cours |
| Le soleil | Bandeau du ciel plein cadre avec le Soleil à sa vraie place, trajectoire du jour, course du jour dans l'ordre, hauteur maximale, durée, écart à la veille, crépuscules |
| La lune | Bandeau du ciel plein cadre avec la Lune en relief à sa vraie place, trajectoire du jour croisée avec celle du Soleil, course du jour, part éclairée, âge, lunaison, quatre prochaines phases |
| Vigilance | Renvoi vers Météo-France, avec le motif du renvoi, en feuille |
| Réglages | Écriture retenue pour l'écran du temps, sources, coordonnées, en feuille |

Les cinq premiers écrans sont des destinations de la barre d'onglets. Communes,
Vigilance et Réglages sont des présentations en feuille.

## Changement de commune

La commune vit dans la barre de tête, à la même place sur les cinq écrans. Un
appui ouvre la liste des communes suivies, un second bascule. Aucun écran ne
répète la commune : le grand titre nomme l'écran, ou porte le jour sur
l'accueil.

En mode position, la barre de tête porte une cible devant le nom : le nom dit
où l'appareil se trouve, la cible dit qu'il suivra.

## Symboles de temps

Les symboles du ciel se dessinent en deux groupes : la masse prend le gris du
ciel, l'accent prend sa couleur propre, jaune pour le soleil, bleu pour la
pluie, orange pour l'orage. Ils sont réservés aux endroits qui décrivent le
ciel : le bandeau, la table de la semaine, la liste des communes. Ailleurs les
symboles restent monochromes, un symbole coloré au milieu d'un texte détournant
le regard.

Le même symbole sert partout où le ciel est décrit : bandeau, table de la
semaine, liste des communes, voie « Ciel » du ruban, écritures Liste et
Moments.

## Couleur d'information

Une valeur ne prend une couleur qu'au delà d'un seuil. L'indice ultraviolet
passe à l'ambre à trois, à l'orange à sept, au rouge à huit. Le vent se colore
au delà de vingt-cinq kilomètres par heure de moyenne ou quarante en rafales.
L'humidité se colore à quatre-vingt-dix pour cent, le ressenti au gel et à la
chaleur, la probabilité de pluie à soixante pour cent. Les bornes du jour se
colorent au gel et à la chaleur.

Dans le ruban, la pluie et l'indice ultraviolet portent la couleur de leur
sujet, l'humidité une teinte froide. La température, le vent et la pression
restent à l'encre du texte : une couleur y dirait quelque chose de faux.

Le symbole d'un conseil prend la couleur de son sujet, la même que celle du
ciel correspondant.

La couleur ne porte jamais seule l'information : le chiffre ou le libellé la
double toujours.

## De l'accueil au détail

Les chiffres de l'accueil mènent à leurs vingt-quatre heures. Le grand chiffre
et les quatre mesures ouvrent l'écran du temps en ruban, sur la voie
correspondante déjà dépliée, et la page se place dessus. Le libellé du ciel mène
à la voie Ciel.

| Chiffre | Voie ouverte |
|---|---|
| Grand chiffre, ressenti | Température |
| Pluie | Pluie |
| Vent | Vent |
| Humidité | Humidité |
| Indice UV | Indice UV |
| Libellé du ciel | Ciel |

## Lecture au doigt

La lecture d'une courbe et le défilement de la page partagent la même surface.
Le geste n'est pas tranché à l'appui, il l'est au premier déplacement franc, et
une fois tranché il ne se remet pas en cause : la lecture accepte un déplacement
oblique jusqu'à quarante degrés de l'horizontale, ce qu'un doigt fait
naturellement en suivant une courbe. Au delà, la page défile et la lecture se
retire. Le défilement vertical reste mené par le navigateur, par
`touch-action: pan-y`.

## Taille des chiffres

Les valeurs des quatre mesures sont à l'échelle du titre 2, les bornes de la
semaine et les valeurs des rangées à celle du corps de texte. Un chiffre est ce
qu'on vient lire, il n'a pas à être plus petit que son étiquette.

## Écriture des grandeurs

Le degré s'écrit sans unité, « 25° », partout : dans le bandeau, dans les
alertes et dans les rangées. L'indice UV s'écrit sans décimale, « 7 » et non
« 7,3 » : une décimale sur un indice entier donne une fausse impression de
mesure fine.

Le ressenti ne paraît que s'il s'écarte d'au moins un degré de la température.
Sinon la probabilité de pluie sur vingt-quatre heures prend sa place : « Ressenti
20° » à côté d'un grand 20° occupait un quart de la carte sans rien apprendre.

Une plage horaire ne porte le mot « demain » qu'une fois : « demain de 03 h à
06 h », non « de demain 03 h à demain 06 h ».

## Le soleil

Le ciel occupe toute la largeur et monte sous la barre de tête, qui devient
blanche par-dessus et reprend son verre au défilement. C'est le seul endroit
de l'application où le contenu déborde du rembourrage de la couche de contenu.

La couleur du ciel vient de la hauteur du Soleil, du bleu de midi à l'ambre du
couchant puis au bleu de nuit. Elle ne suit pas le thème de l'appareil : un ciel
de midi resterait noir en thème sombre, ce qui n'aurait pas de sens. Le sol se
déduit du bas du ciel par assombrissement, les étoiles ne paraissent qu'une fois
le Soleil sous l'horizon.

Le disque est à sa place calculée : l'abscisse suit l'avancement du jour,
l'ordonnée la hauteur.

### La boule de feu

Le Soleil est peint sur une toile, dans `src/feu.js`. Le disque reçoit d'abord
ses tons sombres, puis la matière chaude est ajoutée par-dessus en lumière : un
bruit gris posé en incrustation délave la couleur, un bruit teinté ajouté en
lumière la garde et donne le rougeoiement.

| Couche | Mouvement |
|---|---|
| Matière | Bruit fractal creusé en filaments, posé deux fois à des échelles et des sens de rotation opposés, avec une dérive lente |
| Cœur | Battement de trois secondes |
| Limbe | Assombrissement du bord qui fait la sphère, débordement chaud qui la fait brûler dans le ciel |
| Protubérances | Quatre jets, chacun sur sa période, de quatre à neuf secondes |
| Couronne | Vingt-quatre rayons fins, deux copies tournant en sens contraires |

La couleur suit la hauteur : ambre clair au zénith, orange profond près de
l'horizon, comme le Soleil réel que l'atmosphère rougit.

Le coût tient sur un téléphone. Les motifs coûteux sont dessinés une seule fois
hors écran et gardés par pas de teinte, treize jeux au plus ; chaque image ne
fait plus que composer des images déjà prêtes, à trente par seconde. La boucle
s'arrête dès que la toile quitte le document ou que l'écran passe en
arrière-plan, et ne démarre pas du tout sous mouvement réduit, où une seule
image est rendue.

### Trajectoire

La courbe est celle de la hauteur calculée, de minuit à minuit, par pas de cinq
minutes. Le trait plein est au-dessus de l'horizon, le pointillé au-dessous, et
le moment courant porte un point et son fil. Les instants remarquables restent
affinés par dichotomie, la courbe ne servant qu'au tracé.

## La lune

Même grammaire que l'écran du soleil : bandeau plein cadre, barre de tête
déshabillée, prochain évènement en grand, trajectoire, course du jour, trois
mesures.

Trois choses lui sont propres.

**Le ciel est celui du Soleil, pas celui de la Lune.** Sa couleur vient de la
hauteur du Soleil : une Lune levée en plein jour se voit sur un ciel bleu, pâle
et peu contrastée, comme dans le ciel réel. Les étoiles ne paraissent qu'une
fois le Soleil assez bas.

**La Lune se place par son azimut**, non par l'heure. Elle se lève et se couche
à ses propres heures, qui reculent d'environ cinquante minutes par jour :
l'heure ne dit rien de sa position. Quand la journée ne garde plus aucun
évènement, le premier du lendemain est recalculé plutôt que repris.

**La trajectoire porte deux courbes**, la Lune en trait plein et le Soleil en
repère effacé : c'est le Soleil qui dit si la Lune se voit.

### Le relief

La Lune est peinte sur une toile, dans `src/relief.js`. Une carte du disque
visible est dessinée une seule fois, la Lune montrant toujours la même face :
mers à leur place, cratères écrasés dans le sens du rayon près du bord pour
donner la sphère, traînées de Tycho au sud.

L'éclairage suit la loi de Lommel et Seeliger, `mu0 / (mu0 + mu)`, celle qui
rend la pleine Lune plate jusqu'au bord. Avec Lambert, elle aurait l'air d'une
boule de billard. La part sombre n'est pas noire : la lumière cendrée l'éclaire
d'autant plus que le croissant est fin, la Terre étant alors presque pleine vue
de la Lune.

L'inclinaison du limbe éclairé est calculée : le limbe pointe vers le Soleil,
dont la position est connue au même instant. Le croissant penche donc comme
dans le ciel, et s'incline au fil de la nuit.

Les disques éclairés se gardent par pas de deux degrés de phase et cinq
d'inclinaison, vingt-quatre au plus. La Lune ne bouillonne pas : ce qui vit
dans le bandeau, c'est le halo, qui respire, la pâleur du jour, qui la mange,
et le rougissement près de l'horizon.

Les quatre prochaines phases restent des dessins géométriques : à quarante
points, un relief ne se verrait pas et coûterait quatre textures.

## Communes suivies

Dix communes au plus. Le titre de l'écran ouvre la liste, un appui sur une
rangée bascule : deux gestes séparent deux communes.

Chaque rangée porte le symbole du ciel, la température du moment et les bornes
du jour. Les aperçus tiennent en une seule requête, Open-Meteo acceptant
plusieurs couples de coordonnées et rendant un tableau dans le même ordre. Ils
sont gardés un quart d'heure, et le dernier connu reste servi hors ligne, avec
mention de son âge.

Le retrait se découvre en glissant la rangée vers la gauche, par le menu
contextuel, ou par le clavier : le bouton se tient sous la rangée et reste dans
l'ordre de tabulation, le focus découvrant la rangée. Retirer la commune
courante fait passer à la suivante de la liste.

## Ma position

La première rangée de la liste ne nomme pas un lieu mais l'appareil. La choisir
relève la position, la nomme par l'interface adresse, et la prévision suit. Elle
est épinglée en tête, ne compte pas dans les dix communes et ne se retire pas.

Le relevé se refait au chargement et au retour au premier plan, mais seulement
si l'autorisation de position est déjà accordée : sans geste de l'utilisateur,
une première demande au chargement serait rejetée par le navigateur. Sans
autorisation, le dernier relevé connu reste servi et la rangée attend un appui.

La prévision n'est relue que si l'appareil a bougé de plus de cinq cents mètres.
En deçà, elle serait identique et la requête serait perdue. Deux lectures
peuvent alors se chevaucher : seule la plus récente écrit l'écran.

Le dernier relevé est gardé, avec sa commune et son horodatage, pour que la
liste s'ouvre sur une température plutôt que sur un vide et que l'application
reste lisible hors ligne. Quand l'interface adresse ne rend pas de nom, le nom
précédent n'est repris que si la position n'a pas bougé de plus de deux
kilomètres : au delà, il désignerait une autre commune.

Choisir une commune quitte le mode position, les deux ne pouvant pas tenir
ensemble. Retirer la dernière commune suivie y ramène quand un relevé est connu.

## Sources

| Source | Adresse | Compte |
|---|---|---|
| Prévision | `api.open-meteo.com`, AROME de Météo-France forcé sur deux jours | Aucun |
| Commune, par le nom ou par les coordonnées | `api-adresse.data.gouv.fr` | Aucun |
| Soleil et Lune | calcul sur l'appareil, `src/astres.js` | Aucune requête |
| Aperçu des communes suivies | `api.open-meteo.com`, un seul appel pour toute la liste | Aucun |

Les deux sources distantes répondent en origine croisée, ce qui a été vérifié
depuis un navigateur le 19 août 2026.

### Deux sources écartées

Les jeux archivés de Météo-France sur data.gouv.fr, vigilance
`69cb8c3efb376113fa42881a` et données climatologiques
`6569b51ae64326786e4e8e1a`, sont accessibles sans compte et servent bien les
en-têtes d'origine croisée. Ils ne sont pourtant pas employés.

Sondage du 19 août 2026, depuis un navigateur, sur le seau
`object.files.data.gouv.fr/meteofrance` :

| Jeu | Dernier contenu | Retard |
|---|---|---|
| Vigilance | dépôt du 5 août 2026, 04 h 00 | 14 jours |
| Données climatologiques | mesures jusqu'au 22 juin 2026, fichiers non modifiés depuis le 24 juin | 58 jours |

Vérifié sur deux départements, la Côte-d'Or et la Gironde. Le document de reprise
de « Mon jardin » décrivait six dépôts de vigilance par jour et un fichier de
pluie déposé chaque matin : ce n'est plus le cas.

Une vigilance de quatorze jours ne dit rien du temps qu'il fait, et une prévision
du jour ne se compare pas à une mesure de juin. La vigilance renvoie donc vers
Météo-France, et la comparaison entre mesure et modèle est retirée.

Les modules `vigilance.js` et `postes.js` restent écrits, avec le schéma réel des
deux sources documenté à l'intérieur, et les deux vues correspondantes sont dans
`src/reserve.js`. Le jour où la synchronisation reprend, il suffit de rétablir
les appels dans `app.js` et les entrées dans la table `VUES`.

## Organisation

```
index.html          coque, trois couches
styles.css          tokens du design system, composants, mode sombre compris
DESIGN-SYSTEM.md    transposition web du design system iOS
manifest.webmanifest, sw.js, icones/
src/
  horloge.js        clé du jour, écriture des nombres, département
  previsions.js     charge Open-Meteo, fusion AROME, série horaire
  reglages.js       stockage local, communes suivies, Ma position, recherche
  icones.js         codes de temps sensible, dessins
  conseils.js       les six règles et leurs seuils
  ruban.js          météogramme à sept voies
  ecritures.js      liste et moments
  astres.js         positions du Soleil et de la Lune, phases, levers et couchers
  feu.js            la boule de feu du bandeau, peinte sur une toile
  relief.js         le relief lunaire, carte du disque visible et éclairage
  vues.js           temps, semaine, vigilance, soleil, lune, communes, réglages
  app.js            amorçage, barre d'onglets, écrans, coque de la feuille
  reseau.js         reprise à attente croissante, gzip, listage S3
  vigilance.js      seau data.gouv, schéma réel, non branché
  postes.js         fichier départemental et geojson des postes, non branché
  reserve.js        les deux vues débranchées
essais/
  controle.mjs      cent soixante-sept contrôles en navigateur
  meteo.json        données figées au 18 août 2026, 9 h
```

Aucune dépendance à l'exécution. Playwright sert aux essais seulement.

## Essais

```
npm install playwright
npx playwright install chromium
node essais/controle.mjs
```

Le chemin du navigateur peut être imposé par la variable `CHROMIUM` lorsque la
révision installée par Playwright ne correspond pas à celle du poste.

Le lanceur sert le dossier, fige l'horloge au 18 août 2026 à 9 h, détourne les
trois appels Open-Meteo vers `meteo.json` et coupe les sources data.gouv pour
éprouver le repli. Cent soixante-sept contrôles, dont l'absence de répétition entre
les alertes et les conseils, les sept voies du ruban, l'agrandissement d'une
voie, les treize colonnes de la liste, les vingt-quatre lignes de la fenêtre, la
nature du renvoi de vigilance, et seize contrôles de conformité au design
system : cibles de 44 pt, fond issu du token, absence de rayon en valeur brute,
verre réservé à la navigation, tailles de texte issues de l'échelle, transitions
neutralisées sous mouvement réduit, accroches de feuille, erreur sous le champ,
état désactivé, rangée unique, état vide complet, ossature au premier
chargement. Les écrans du Soleil et de la Lune sont contrôlés de la même façon,
y compris l'absence de toute requête réseau pour la Lune. La bascule de commune
est éprouvée de bout en bout : ouverture par le titre, ajout par la recherche,
bascule par appui, retrait par le clavier.

Ma position est éprouvée sur trois contextes. Le premier prend le relevé au
doigt et vérifie que la rangée est épinglée, qu'elle ne se retire pas, qu'elle
porte la température du moment et la commune relevée, et que choisir une commune
quitte le mode. Le deuxième s'ouvre en mode position sur un relevé ancien, pris
ailleurs, l'autorisation étant accordée : le relevé silencieux doit partir seul
et relire la prévision aux nouvelles coordonnées. Le troisième fait la même
chose sans autorisation : rien ne doit partir et le dernier relevé doit rester
servi.

Le bandeau du soleil est éprouvé sur son débord, sur le déshabillage de la barre
de tête et son retour au verre, sur la présence de la toile, sur le fait qu'elle
porte des pixels, et sur le fait que la matière bouge d'une image à l'autre. Le
bandeau de la lune l'est sur les mêmes points, plus la cohérence de la phase et
de l'inclinaison du limbe, et la présence des deux courbes de trajectoire.

## Éphémérides

`src/astres.js` calcule les positions du Soleil et de la Lune sur l'appareil.
Aucune source distante n'est interrogée : Open-Meteo ne porte pas de donnée
lunaire, et une application qui doit fonctionner hors ligne n'a pas à dépendre
d'un service pour dire où est la Lune.

Les séries sont celles de Meeus, tronquées aux termes principaux. Écarts mesurés
contre les références de l'ouvrage et contre Open-Meteo :

| Grandeur | Référence | Écart mesuré |
|---|---|---|
| Longitude de la Lune | Meeus, exemple 47.a | 0,005° |
| Latitude de la Lune | Meeus, exemple 47.a | 0,002° |
| Distance de la Lune | Meeus, exemple 47.a | 80 km |
| Longitude du Soleil | Meeus, exemple 25.a | 0,0003° |
| Lever et coucher du Soleil | Open-Meteo, seize jours | moins d'une minute |
| Instants de phase | Meeus, exemples 49.a et 49.b | une à trois minutes |

Le temps terrestre est distingué du temps universel : les positions se calculent
dans le premier, l'angle horaire se prend dans le second. Le polynôme d'Espenak
et Meeus donne l'écart entre les deux, valable de 2005 à 2050.

Les heures de lever et de coucher du Soleil restent celles d'Open-Meteo, qui
fait foi dans cette application. Les azimuts, le midi solaire et les crépuscules
sont calculés, la source ne les portant pas.

Un jour sans lever ou sans coucher de Lune n'est pas une anomalie : il s'en
présente environ deux par lunaison sous nos latitudes. L'écran l'écrit.

## Règles reprises du module d'origine

Fenêtre de vingt-quatre heures glissantes depuis l'heure en cours, non la journée
civile. La clé du jour se compose en heure locale par une fonction unique. Un
trou dans la charge ne vaut pas zéro : les grandeurs continues reprennent la
valeur connue la plus proche, la lame de pluie garde zéro. Le retour au premier
plan relit la charge quand l'heure a changé. Aujourd'hui et demain se résument
des heures, les jours suivants de la charge quotidienne.

Seuil de mention unique : un dixième de millimètre de lame, cinq pour cent de
risque. Seuils de décision nommés comme tels : gel à un degré, rafale à quarante
kilomètres par heure ou vent moyen à vingt-cinq, chaleur à trente degrés, air
saturé au-dessus de quatre-vingt-dix pour cent pendant plus de quatre heures
sous une température douce, indice UV au-dessus de sept, divergence entre modèles
à un millimètre avec un rapport d'un contre quatre.

## Corrections apportées à l'occasion de l'extraction

1. Les deux jeux de seuils du gel, de la chaleur et du vent sont unifiés. Le
   module d'origine portait 2 degrés, 32 degrés et 60 km/h dans le bandeau contre
   1 degré, 30 degrés et 40 km/h dans la feuille.
2. `departementDe` rend 2A et 2B pour la Corse. Le module d'origine rendait 20,
   et la vigilance n'y arrivait jamais.
3. Les alertes de l'accueil ne répètent plus les conseils : elles ne parlent que
   de ce qui tombe hors de la fenêtre de vingt-quatre heures.
4. Le seuil de mention est ramené à un dixième de millimètre partout. Deux
   endroits testaient encore deux dixièmes.
5. La clé du jour n'est plus recomposée à la main dans la reprise de cache.

## Points levés le 19 août 2026

Les quatre points restés ouverts à la fin de l'extraction ont été tranchés par
sondage depuis un navigateur, contre les sources réelles.

1. **En-têtes d'origine croisée.** Ouverts sur `object.files.data.gouv.fr`,
   trois essais sur trois. Les premiers échecs venaient d'une limitation de
   débit, non d'un refus : une rafale de requêtes se solde par des échecs que le
   navigateur rapporte comme un refus. D'où `reseau.js`, qui reprend avec attente
   croissante.
2. **Schéma de `CDP_CARTE_EXTERNE.json`.** Confirmé.
   `product.periods[].timelaps.domain_ids[]`, échéances J et J1, 122 domaines
   dont « FRA » et des codes de zone à quatre chiffres, `phenomenon_id` en
   chaîne. Le filtre à deux caractères pour les départements est le bon.
3. **Réponse multimodèle d'Open-Meteo.** Observée. Deux modèles demandés donnent
   `temperature_2m_meteofrance_arome_france_hd`, un seul donne `temperature_2m`.
   `separerModeles` traite bien les deux formes.
4. **Icônes matricielles.** Produites depuis `icones/icone.svg`, avec une version
   maskable dont le dessin tient dans la zone sûre.

Ce même sondage a révélé l'arrêt de l'alimentation des deux jeux archivés, ce qui
a conduit à écarter la vigilance archivée et la comparaison entre mesure et
modèle. Voir « Deux sources écartées ».

## Reste à faire

1. **Choisir le dépôt de publication.** « Ma météo » demande un dépôt distinct de
   `techthisapp/mon-jardin`, qui sert déjà une application par GitHub Pages. Les
   deux coexistent sans se voir : chemins différents, agents de service
   différents, et les clés de stockage local sont préfixées `mameteo.` et non
   `monjardin.`.
2. **Surveiller la reprise des jeux data.gouv.** Si l'alimentation repart, les
   deux modules et les deux vues sont prêts.
