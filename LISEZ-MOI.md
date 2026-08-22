# Ma météo

En ligne : https://techthisapp.github.io/ma-meteo/

Application météorologique pour téléphone. Site statique installable, sans
service dorsal, sans base de données, sans compte. Métropole française.

## Contenu

| Écran | Ce qu'il porte |
|---|---|
| Accueil | Le panneau de vigilance s'il y en a une, puis le bandeau du ciel plein cadre portant le temps qu'il fait, le jour, la température, le ciel et les bornes du jour, quatre mesures, une carte « À retenir » réunissant les vingt-quatre heures et ce qui vient au-delà, et les prochaines heures par tranches de six heures |
| Le temps | Vingt-quatre heures glissantes en deux écritures : ruban à sept voies, table à treize colonnes |
| La semaine | Sept jours : symbole de ciel et lame sous lui, borne basse à gauche, plage de température sur une échelle commune, borne haute à droite, point du moment sur la journée en cours |
| Le soleil | Bandeau du ciel plein cadre avec le Soleil à sa vraie place, trajectoire du jour, course du disque, durée du jour, clarté et nuit noire, ruban et table des trois crépuscules |
| La lune | Bandeau du ciel plein cadre avec la Lune en relief à sa vraie place et la vignette de sa phase devant son nom, trajectoire du jour croisée avec celle du Soleil, course du jour, temps au-dessus de l'horizon, âge, lunaison, quatre prochaines phases avec leur délai |
| Vigilance | Bulletin en vigueur, phénomènes signalés avec leur niveau et leur fenêtre, renvoi vers Météo-France, en feuille |
| Mes lieux | Lieux suivis, chacun sous son propre ciel, réordonnables, en feuille. L'ajout se pousse derrière le bouton de la tête |
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
semaine, liste des communes, voie « Ciel » du ruban, table des heures et
moments de l'accueil.

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

## Vigilance

Le panneau ne paraît que s'il y a quelque chose à signaler, et il paraît alors
en tête de l'accueil : une vigilance orange ne se lit pas après la température.
Sans vigilance, rien du tout, pas même une rangée d'accès. Un bandeau permanent
qui dit « rien à signaler » finit par ne plus se lire, et le jour où il dit
autre chose, personne ne le voit.

Le panneau donne le niveau maximal en toutes lettres, la conduite à tenir, le
département nommé, la validité du bulletin, puis chaque phénomène signalé avec
son niveau et sa fenêtre. Le plus grave passe devant, et à gravité égale le plus
proche. L'appui ouvre le détail, qui reprend les phénomènes et renvoie sur la
page du département de Météo-France. Les conséquences possibles et les conseils
de comportement restent chez Météo-France, qui fait foi : les recopier ici les
figerait.

La couleur du niveau ne porte jamais seule l'information : le titre et chaque
ligne l'écrivent en toutes lettres.

### La source

Trois voies mènent à cette donnée, et une seule convient à une application sans
compte ni service dorsal. Le portail `public-api.meteofrance.fr` demande une
clé, donc un compte, donc un secret à loger quelque part. Le jeu ouvert
« Vigilance météorologique archivée » de data.gouv.fr porte le même contenu sans
clé, mais c'est une archive et non un flux : au 19 août 2026 son dernier dépôt
datait du 5 août, et une vigilance de quatorze jours ne dit rien du temps qu'il
fait. Reste le service qui alimente l'application et le site de Météo-France. Il
répond sans clé personnelle, en origine croisée ouverte, et c'est celui
qu'emploient les bibliothèques libres. Le jeton porté par `src/vigilance.js`
n'est pas un secret : il est le même pour tout le monde, publié avec ces
bibliothèques, et il n'ouvre que des données publiques.

Si le service se tait, rien ne s'affiche. Une vigilance qu'on ne sait pas lire
ne se remplace pas par un message d'erreur sur l'écran d'accueil.

Le bulletin est gardé un quart d'heure. La vigilance est révisée deux fois par
jour en temps ordinaire, davantage quand la situation bouge : relire plus
souvent n'apprendrait rien et pèserait sur la source.

La page du détail se trouve par le nom du département, non par son numéro. La
table des cent et une entrées est explicite et chacune a été vérifiée contre le
site : deux départements n'y prennent pas la forme attendue. Sans entrée, le
renvoi se fait sur la carte de France, qui vaut toujours.

## Ce qui est à savoir

Une règle ne parle que si elle a quelque chose à dire. « Aucune lame annoncée
d'ici demain 16 h » occupait la première ligne tous les jours de beau temps :
une phrase qu'on lit cent fois pour n'y rien apprendre finit par cacher celles
qui comptent. Le silence est l'état par défaut, et la section disparaît quand il
n'y a rien.

Chaque ligne porte sa portée, en heures, et le titre de la section l'annonce :
« Dans les 14 prochaines heures ». Le lecteur sait jusqu'où porte ce qu'il lit
sans avoir à relire chaque phrase. Au-delà de deux jours, la portée s'écrit en
jours.

Quatorze règles, quatre lignes au plus, ordonnées par gravité.

| Règle | Ce qu'elle dit | Seuil |
|---|---|---|
| Orages | Plage annoncée | codes 95, 96, 99 |
| Neige | Plage annoncée et lame | codes 71 à 77, 85, 86 |
| Pluie | Plage, lame attendue, ou désaccord entre modèles | 0,1 mm |
| Risque de pluie | Le maximum et son heure, sans lame annoncée | 40 % |
| Brouillard | Plage attendue | codes 45, 48 |
| Gel | Plage et minimum | 1 degré |
| Vent | Rafale maximale et sa plage | 40 km/h de rafale, 25 km/h de moyenne |
| Chaleur | Maximum et son heure | 30 degrés |
| Renversement de température | Écart entre les deux moitiés de la fenêtre | 6 degrés |
| Ressenti | L'écart le plus fort, avec son heure | 5 degrés |
| Air saturé | Plage sous une température douce | 90 % sur 4 heures |
| Pression | Variation sur la fenêtre, dégradation ou amélioration | 6 hPa |
| Bascule du ciel | Le premier passage qui tienne trois heures | 60 % de couverture |
| Lever ou coucher du Soleil | L'heure, s'il tombe dans les trois heures | 3 heures |

Deux règles journalières s'y ajoutent, pour ce qui tombe au-delà de la fenêtre
horaire : un gel ou une forte chaleur d'après-demain, et une lame de quinze
millimètres ou plus. Elles portent leur portée en jours, et le titre s'y adapte.

## La journée qui vient

L'accueil ferme sa page sur les moments : le soir, la nuit et le lendemain,
tranche par tranche de six heures, là où le haut de l'écran ne dit que
l'instant. La vigilance et la source viennent après, en clôture.

Le nom se dit comme on le dirait à l'oral : « ce soir » plutôt que « la
soirée », « demain matin » plutôt que « demain, le matin ». La nuit fait
exception. Elle porte la date du lendemain dès minuit passé, mais celle qui
vient s'appelle « cette nuit » : personne ne dit « demain, la nuit » pour dans
quatre heures. La première nuit de la fenêtre prend donc le nom proche, quelle
que soit sa date.

Les heures de la tranche portent l'information, c'est par elles qu'on la situe
dans sa journée : elles se lisent comme une valeur, sur un fond, non comme une
mention en marge.

L'écran du temps garde deux écritures, le ruban et la table. Son sélecteur se
tient sur la ligne du titre, à droite et compact : posé sous le titre, il
coûtait une bande de soixante points avant le premier chiffre. Le ruban et la
table commencent maintenant en haut de la page.

Ce qui mérite d'être retenu se lit sur l'accueil, sous « À retenir », et nulle
part ailleurs. En tête de l'écran du temps, les mêmes phrases se redisaient un
écran plus loin, à l'endroit où l'on vient justement chercher le détail.

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

## Valeurs composées

Une valeur de rangée faite de plusieurs parties se coupe entre elles, jamais à
l'intérieur d'une heure. « 16:05, sud-est » d'un seul tenant débordait de sa
carte sur un grand corps de texte, l'heure ne pouvant pas se couper : l'heure
reste insécable, le point cardinal se reporte à la ligne suivante.

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

## Le ciel de l'accueil

Le même panneau que les écrans du soleil et de la lune, avec le temps qu'il
fait peint par-dessus. Le titre est posé dedans : le jour, la température, le
libellé du ciel et les bornes de la journée.

La toile du temps se pose devant celle de l'astre, non derrière : un nuage passe
devant le Soleil. Le symbole de temps disparaît de la ligne d'état, un petit
nuage dessiné devant un ciel peint dirait deux fois la même chose. Les bornes y
perdent leur couleur d'information pour la raison qui la leur donnait ailleurs,
la lisibilité : un chiffre orange sur un ciel de couchant ne se lit plus.

### Ce que la prévision donne au dessin

| Grandeur de la prévision | Ce qu'elle décide |
|---|---|
| Couverture nuageuse | La forme du ciel : cumulus, couche, ou les deux |
| Code de temps sensible | La nature de la précipitation, le brouillard, l'orage |
| Lame d'eau horaire | L'intensité de la précipitation et le plomb du ciel |
| Vitesse du vent | La dérive des nuages et l'inclinaison des traits |

La couverture ne se traduit pas par un simple nombre de nuages. Deux familles
sont dessinées, parce que ce sont deux objets. Les cumulus sont des masses
isolées qui passent devant le ciel, sur trois plans de parallaxe. La nappe est
une couche continue vue par en dessous, dont seule la base se voit, ondulée et
alourdie de lobes. La nappe prend le relais des cumulus au-delà des deux tiers
de couverture : un ciel couvert n'est pas un ciel qui aurait beaucoup de
cumulus.

Sous une couche fermée, l'astre n'est plus dessiné du tout. Le laisser pâle
suspendrait un disque au travers du plafond. Il ne reste que la lueur diffuse
peinte dans la couche à l'endroit où il se tient. Sous une couche mince, il
pâlit et se dilue à mesure qu'elle s'épaissit.

La charge de secours ne porte que le code, sans couverture nuageuse. Chaque code
en implique une, faute de quoi une pluie tomberait d'un ciel vide.

### Comment un nuage est dessiné

Un nuage est une masse, pas un tas de bulbes. Des dégradés translucides
superposés font compter les bulbes : chacun montre son bord, et l'accumulation
sature toute la vignette. Les formes pleines s'unissent au contraire sans se
compter. La silhouette est donc bâtie en formes pleines, adoucie au flou,
raffermie par une seconde passe resserrée, puis colorée d'un seul tenant, claire
au sommet et sombre à la base.

L'union efface les bords intérieurs, et la masse deviendrait un ballon. Le
modelé les rend : un ventre sombre et une crête claire par bourgeon, en dégradés
qui s'éteignent avant leur bord et découpés sur la silhouette, de sorte
qu'aucun contour de bulbe ne ressorte. Chaque bourgeon repose sur la ligne de
base sans la traverser, ce qui donne au cumulus son dessous plat, et la ligne
ondule légèrement, une droite d'un bord à l'autre se verrait.

De nuit, le nuage cesse de prendre sa couleur du ciel : il reste plus clair que
lui, éclairé par en dessous. Sans ce renversement, une nuit couverte ne serait
qu'un rectangle noir. Au ras de l'horizon, la lumière rousse prend le dessous
des nuages avant le reste du ciel.

Les motifs sont dessinés une fois par teinte et gardés, six jeux au plus. Chaque
image ne fait que composer des images prêtes, à trente par seconde, et la boucle
s'arrête dès que la toile quitte le document ou que l'onglet passe en
arrière-plan.

## Le soleil

Même panneau que l'accueil. Le ciel occupe toute la largeur et monte sous la
barre de tête, qui devient blanche par-dessus et reprend son verre au
défilement.

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

### Course du jour et durées

La course du jour ne porte que les instants du disque : lever avec son point
cardinal, midi solaire avec sa hauteur, coucher avec son point cardinal.

La valeur d'une rangée ne porte que l'heure. Le point cardinal et la hauteur
tiennent sous le nom de l'évènement, en ligne de description : les heures
s'alignent alors en colonne, ce qu'une valeur composée interdisait, et
« Passage au méridien » cesse de passer à la ligne sur l'écran de la lune.

Les trois mesures qui suivent se partagent les vingt-quatre heures : la durée du
jour et son écart à la veille, la clarté lueurs comprises, la part sans aucune
lueur solaire. Aucune de ces valeurs n'est redite ailleurs sur l'écran, et un
contrôle vérifie qu'aucune heure n'y paraît deux fois.

La nuit noire se mesure du soir à l'aube du lendemain. C'est la nuit du jour
même qui en tient lieu, l'écart d'un jour à l'autre restant de deux ou trois
minutes.

### Les crépuscules

Un ruban porte les vingt-quatre heures, teintées par la hauteur du Soleil. Cinq
états s'y suivent, du plein jour à la nuit noire, séparés par les trois seuils
de crépuscule. Les bornes se placent par interpolation entre deux points de la
courbe. Un contrôle vérifie que le découpage couvre la journée entière et sans
trou, y compris les jours sans nuit noire, sans lever et sans coucher.

La table qui suit sert de légende au ruban : chaque seuil porte la pastille de
sa bande, son heure du matin et son heure du soir dans deux colonnes distinctes.
Les trois seuils sont montrés, ceux-là mêmes que la note nomme, et un contrôle
compare les deux listes.

| Seuil | Hauteur du Soleil | Ce qu'il borne |
|---|---|---|
| Crépuscule civil | six degrés sous l'horizon | on distingue encore sans lampe |
| Crépuscule nautique | douze degrés | l'horizon reste visible en mer |
| Crépuscule astronomique | dix-huit degrés | au-delà, la nuit noire |

## La lune

Même grammaire que l'écran du soleil : bandeau plein cadre, barre de tête
déshabillée, prochain évènement en grand, trajectoire, course du jour, trois
mesures.

La course du jour porte le lever, le passage au méridien et le coucher, avec
le point cardinal ou la hauteur en ligne de description. Les trois mesures sont
le temps passé au-dessus de l'horizon, l'âge et la lunaison. La part éclairée
n'y figure pas : le ciel la dit déjà, en toutes lettres et en image.

Les quatre prochaines phases portent leur date et leur délai. « 20 août » ne dit
pas si c'est dans deux jours ou dans trois semaines.

Quatre choses lui sont propres.

**La forme du disque est montrée à côté de son nom.** Dans le bandeau, la Lune
est à sa place réelle : sous l'horizon, basse derrière le sol ou pâlie par le
plein jour, elle ne se voit pas. Une vignette de vingt-deux points, posée devant
le nom de la phase, la montre toujours.

Elle ne s'anime pas et ne passe pas par la boucle : c'est une image, non une
scène. Le disque vient de la même réserve que celui du bandeau, à la même
phase : la vignette ne coûte aucun calcul de plus.

Deux réglages lui sont propres. Un cerne léger la borne, sans quoi une Lune
nouvelle, qui n'est qu'une lueur cendrée, ne se distinguerait pas du fond. Et un
contraste est porté sur ses quelques centaines de pixels : la lumière cendrée
est juste à l'échelle du bandeau, où le disque fait deux cents points, mais à la
taille d'un mot elle noie le croissant dans un rond gris. La courbe écrase la
part cendrée vers le noir et garde le modelé de la part éclairée.

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

## Mes lieux

Chaque rangée porte le ciel de son lieu, la même image qu'en fond d'accueil
là-bas : la liste se lit d'un coup d'œil, un bleu contre un gris. La hauteur du
Soleil sur place donne la teinte, le code de temps sensible la couvre et la
plombe, et tout se calcule sur l'appareil, sans une requête de plus. Le plomb y
est de moitié : sur une bande de soixante points il n'y a ni base claire ni
horizon pour le compenser, et un ciel de pluie y virait au noir.

Le symbole de ciel y passe au monochrome. Posé sur un ciel peint, un dessin
bicolore ne se détacherait plus.

L'ordre se change au doigt par appui long : la rangée se soulève, se déplace, et
la liste montre en direct l'ordre qu'elle prendra. Un déplacement avant la fin
du délai annule la prise, ce qui laisse au glissement de retrait son geste et
évite un mode d'édition. Au clavier et à la synthèse vocale, deux boutons par
rangée montent et descendent le lieu ; ils ne se voient qu'au focus mais gardent
leur taille de cible.

Ajouter ne vit plus au bas de la liste. C'est une action : elle se range dans la
tête de feuille, à droite du titre, et pousse une feuille à elle où le champ
tient la page et reçoit le clavier.

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

La barre de tête nomme la commune servie, non le mode : c'est la cible devant le
nom qui dit que la prévision suit l'appareil. Le relevé peut avoir abouti alors
que l'interface adresse était muette, et la prévision est alors juste sans que
rien ne dise sur quelle commune. Le nom se rattrape seul, sans redemander la
position à l'appareil et sans remettre à zéro l'horodatage du relevé : un nom
n'est pas un nouveau relevé. La recherche par commune ne rendant rien quand le
point tombe hors d'un territoire communal, au large ou en limite de côte, une
adresse ordinaire est alors demandée et sa commune sert. Sans ce repli, une
position en bord de mer restait anonyme, et la vigilance sans département.

## Sources

| Source | Adresse | Compte |
|---|---|---|
| Prévision | `api.open-meteo.com`, AROME de Météo-France forcé sur deux jours | Aucun |
| Commune, par le nom ou par les coordonnées | `api-adresse.data.gouv.fr` | Aucun |
| Soleil et Lune | calcul sur l'appareil, `src/astres.js` | Aucune requête |
| Aperçu des communes suivies | `api.open-meteo.com`, un seul appel pour toute la liste | Aucun |
| Vigilance en vigueur | `webservice.meteofrance.com`, le service qui alimente le site et l'application de Météo-France | Aucun |

Les deux sources distantes répondent en origine croisée, ce qui a été vérifié
depuis un navigateur le 19 août 2026.

### Deux sources écartées

Les jeux archivés de Météo-France sur data.gouv.fr, vigilance
`69cb8c3efb376113fa42881a` et données climatologiques
`6569b51ae64326786e4e8e1a`, sont accessibles sans compte et servent bien les
en-têtes d'origine croisée. Ils ne sont pourtant pas employés. La vigilance se
lit désormais sur le service en vigueur, décrit plus haut.

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
  conseils.js       les quatorze règles, leurs seuils et leur portée
  ruban.js          météogramme à sept voies
  ecritures.js      table des heures, moments par tranches de six heures
  vigilance.js      bulletin en vigueur, phénomènes, niveaux, page du département
  astres.js         positions du Soleil et de la Lune, phases, levers et couchers
  feu.js            la boule de feu du bandeau, peinte sur une toile
  temps.js          le temps qu'il fait, nuages, pluie, neige, brouillard, éclair
  relief.js         le relief lunaire, carte du disque visible et éclairage
  vues.js           temps, semaine, vigilance, soleil, lune, communes, réglages
  app.js            amorçage, barre d'onglets, écrans, coque de la feuille
  reseau.js         reprise à attente croissante, gzip, listage S3
  vigilance.js      seau data.gouv, schéma réel, non branché
  postes.js         fichier départemental et geojson des postes, non branché
  reserve.js        les deux vues débranchées
essais/
  controle.mjs      deux cent soixante-treize contrôles en navigateur
  vue-ecran.mjs     captures d'un écran, thème clair et sombre
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

`node essais/vue-ecran.mjs` rend un écran dans les deux thèmes, en haut et en
bas de page, sous `essais/captures`. Les variables `ECRAN` et `QUAND` portent
la destination et l'instant à figer.

Le lanceur sert le dossier, fige l'horloge au 18 août 2026 à 9 h, détourne les
trois appels Open-Meteo vers `meteo.json`, sert une vigilance orange de
convention, et coupe les sources data.gouv pour éprouver le repli. Deux cent
soixante-trois contrôles, dont l'absence de répétition entre
les alertes et les conseils, les sept voies du ruban, l'agrandissement d'une
voie, les treize colonnes de la liste, les vingt-quatre lignes de la fenêtre, la
nature du renvoi de vigilance, et dix-sept contrôles de conformité au design
system : cibles de 44 pt, fond issu du token, absence de rayon en valeur brute,
verre réservé à la navigation, tailles de texte issues de l'échelle, transitions
neutralisées sous mouvement réduit, accroches de feuille, erreur sous le champ,
état désactivé, rangée unique, état vide complet, ossature au premier
chargement. Les écrans du Soleil et de la Lune sont contrôlés de la même façon,
y compris l'absence de toute requête réseau pour la Lune. Sept contrôles portent
sur la vignette de la Lune et sur la lecture de son écran : la vignette est
devant le nom de la phase, elle porte des pixels opaques, sa part sombre est
franche, elle dit la même phase que le ciel, elle garde sa pleine matière sous
le texte pâli, la part éclairée n'est écrite que dans le ciel, et chaque phase à
venir porte son délai. L'écran du Soleil
ajoute neuf contrôles sur la lecture des durées et des crépuscules : aucune
heure écrite deux fois dans le corps, la durée du jour écrite une seule fois,
les trois crépuscules nommés, la note ne nommant que ceux qui sont montrés,
chaque seuil portant son matin et son soir dans deux colonnes, la teinte de la
pastille égale à celle de sa bande, le ruban couvrant les vingt-quatre heures,
ses cinq états présents, et le découpage sans trou sur quatre ciels
d'épreuve. La bascule de commune
est éprouvée de bout en bout : ouverture par le titre, ajout par la feuille
poussée depuis la tête, bascule par appui, retrait par le clavier, et
réordonnancement des deux façons, au clavier puis par appui long.

Ce qui est à savoir est éprouvé sur un contexte de temps calme : aucune règle ne
parle, la section entière disparaît, et le reste de l'accueil tient. Un contrôle
mesure que la portée annoncée par le titre couvre bien l'heure la plus lointaine
citée dans les lignes. Les trois ont été éprouvés en rétablissant la faute.

La vigilance est éprouvée sur deux contextes. Le premier sert un bulletin orange
sur les orages, jaune sur le vent en deux plages contiguës, et vert ailleurs : le
panneau doit paraître en tête du corps, écrire son niveau en toutes lettres,
nommer le département plutôt que le numéroter, décrire les deux seuls phénomènes
signalés en mettant le plus grave devant, fondre les deux plages contiguës de
même couleur en une, et ouvrir un détail qui renvoie sur la bonne page de
Météo-France. Le second sert un bulletin tout vert : ni panneau, ni rangée
d'accès, et le reste de l'accueil intact.

Ma position est éprouvée sur quatre contextes. Le premier prend le relevé au
doigt et vérifie que la rangée est épinglée, qu'elle ne se retire pas, qu'elle
porte la température du moment et la commune relevée, et que choisir une commune
quitte le mode. Le deuxième s'ouvre en mode position sur un relevé ancien, pris
ailleurs, l'autorisation étant accordée : le relevé silencieux doit partir seul
et relire la prévision aux nouvelles coordonnées. Le troisième fait la même
chose sans autorisation : rien ne doit partir et le dernier relevé doit rester
servi. Le quatrième s'ouvre sur une position sans nom : le nom doit se rattraper
seul, la cible doit rester, l'horodatage du relevé ne doit pas bouger, et le
code postal ainsi obtenu doit donner le bon département à la vigilance.

Le bandeau du soleil est éprouvé sur son débord, sur le déshabillage de la barre
de tête et son retour au verre, sur la présence de la toile, sur le fait qu'elle
porte des pixels, et sur le fait que la matière bouge d'une image à l'autre. Le
bandeau de la lune l'est sur les mêmes points, plus la cohérence de la phase et
de l'inclinaison du limbe, et la présence des deux courbes de trajectoire.

Le ciel de l'accueil ajoute la toile du temps : elle couvre le panneau, elle se
peint après l'astre et au-dessus de lui, elle porte des pixels et elle bouge.
Onze contrôles éprouvent le passage de la prévision au dessin, code par code :
un ciel clair sans couche ni précipitation, des éclaircies à cumulus sans
couche, un ciel couvert à couche fermée, une averse gardant ses cumulus sous une
couche partielle, la nature de la précipitation, l'orage marqué, le brouillard
distingué d'une averse, la couverture déduite du code quand la source ne la
porte pas, et le fait que l'astre disparaît sous une couche fermée.

Deux familles de contrôles gardent la mise en page. La première mesure, sur les
cinq écrans, qu'aucun bloc ne sort de la fenêtre. La seconde rejoue les cinq
écrans avec le corps de texte porté à vingt-deux points, ce que fait le réglage
d'accessibilité du système, et vérifie qu'aucune valeur ne sort de sa rangée ni
ne vient toucher le bord de sa carte.

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
