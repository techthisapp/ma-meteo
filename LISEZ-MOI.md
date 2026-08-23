# Ma météo

En ligne : https://techthisapp.github.io/ma-meteo/

Application météorologique pour téléphone. Site statique installable, sans
service dorsal, sans base de données, sans compte. Métropole française.

## Contenu

| Écran | Ce qu'il porte |
|---|---|
| Accueil | Le panneau de vigilance s'il y en a une, puis le bandeau du ciel plein cadre portant le temps qu'il fait, le jour, la température, le ciel et les bornes du jour, quatre mesures, une carte « À retenir » réunissant les vingt-quatre heures et ce qui vient au-delà, et les prochaines heures par tranches de six heures |
| Le temps | Vingt-quatre heures glissantes en deux écritures : ruban à sept voies, table à treize colonnes |
| La semaine | Sept jours : symbole de ciel et lame sous lui, borne basse à gauche, plage de température sur une échelle commune, borne haute à droite, point du moment sur la journée en cours. Un appui ouvre la journée sur ses quatre moments |
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

Une règle ne compare que des grandeurs comparables. Le renversement de
température prenait les deux moitiés de la fenêtre glissante de vingt-quatre
heures, ce qui revenait à comparer un après-midi à une nuit : la ligne
paraissait tous les jours de beau temps, et nommait « le plus chaud de demain »
un relevé du petit matin, très en dessous du maximum réel du lendemain. Les deux
maximums viennent maintenant des journées entières, à la même source que la
table de la semaine : les deux écrans s'accordent au degré.

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
| Renversement de température | Écart d'un maximum de journée à l'autre | 6 degrés |
| Ressenti | L'écart le plus fort, avec son heure | 5 degrés |
| Air saturé | Plage sous une température douce | 90 % sur 4 heures |
| Pression | Variation sur la fenêtre, dégradation ou amélioration | 6 hPa |
| Bascule du ciel | Le premier passage qui tienne trois heures | 60 % de couverture |
| Lever ou coucher du Soleil | L'heure, s'il tombe dans les trois heures | 3 heures |

Deux règles journalières s'y ajoutent, pour ce qui tombe au-delà de la fenêtre
horaire : un gel ou une forte chaleur d'après-demain, et une lame de quinze
millimètres ou plus le même jour. Elles portent leur portée en jours, et le titre
s'y adapte.

La section s'arrête là. Les règles horaires couvrent le jour et le lendemain,
ces deux règles le surlendemain, et rien au-delà : « 32° mercredi » annoncé un
dimanche est de l'almanach, non un fait marquant, et la semaine est là pour
cela. La portée d'une règle journalière court jusqu'au bout de la journée visée,
non jusqu'à son midi, et le titre arrondit au jour supérieur : il ne doit pas
promettre moins que la ligne la plus lointaine.

Deux règles ne nomment pas le même chiffre à la suite. La chaleur et le
renversement de température se décidaient chacune de son côté et écrivaient
« Jusqu'à 33 degrés vers demain 14 h » puis « Réchauffement de 8 degrés, 33°
demain ». Quand elles désignent le même maximum, seul le renversement paraît :
il dit ce chiffre et, en plus, d'où l'on vient.

## La journée qui vient

L'accueil ferme sa page sur les moments : le soir, la nuit et le lendemain,
tranche par tranche de six heures, là où le haut de l'écran ne dit que
l'instant. La vigilance et la source viennent après, en clôture.

Les moments se lisent en tableau, les colonnes portant les tranches et les
lignes les mesures. Cinq blocs empilés portant chacun ses propres libellés
faisaient six cents points de haut et quatre fois le mot « Température », et le
nombre de cases changeant d'un bloc à l'autre, les retours à la ligne tombaient
chaque fois ailleurs. Le libellé écrit une fois en tête de ligne ramène la carte
à trois cent quarante points, et une mesure se lit alors en travers de la
journée.

Le ciel se dit par son symbole seul, sur la première ligne. Les lignes Pluie,
Risque, Rafales et UV ne paraissent que si un moment au moins a quelque chose à
y dire ; les lignes Temp., Vent et Humidité tiennent toujours, elles font le
profil. Une fois la ligne présente, chaque case porte sa valeur, même faible :
le tiret est réservé à ce qui n'existe pas, non à ce qui est petit, et il
s'écrit dans l'encre effacée.

Les deux bornes de température se séparent par une espace, non par un trait :
« 13-15° » se lit encore, « -3--1° » ne se lit plus. La borne basse prend
l'encre secondaire, ce qui dit laquelle est laquelle sans un mot de plus.

Le nom se dit comme on le dirait à l'oral : « ce soir » plutôt que « la
soirée », « demain matin » plutôt que « demain, le matin ». La nuit fait
exception. Elle porte la date du lendemain dès minuit passé, mais celle qui
vient s'appelle « cette nuit » : personne ne dit « demain, la nuit » pour dans
quatre heures. La première nuit de la fenêtre prend donc le nom proche, quelle
que soit sa date.

Les heures de la tranche se lisent sous son nom, dans la même colonne : c'est
par elles qu'on la situe dans sa journée.

Le nom garde sa forme entière tant qu'on est dans la journée en cours, « ce
soir », « cette nuit », et prend sa forme courte ensuite, « matin »,
« après-m. », « soirée ». Les colonnes se suivent dans l'ordre du temps depuis
maintenant : après « cette nuit », « matin » ne peut désigner que le lendemain.
L'après-midi s'abrège pour lui seul : à cinquante points de large il passait à
la ligne et décalait toute la ligne d'entête.

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

## La semaine, journée par journée

Les heures portent maintenant sur les sept jours, comme la charge quotidienne :
chaque rangée se résume de ses heures, et un appui l'ouvre sur ses quatre
moments. Le surcoût est de deux kilooctets compressés par requête, une fois par
heure, gardés en cache.

AROME ne va pas au delà d'environ soixante-neuf heures. Sa requête reste à trois
jours, le lui demander sur sept ne rendrait que des colonnes vides, et la fusion
laisse le modèle global au delà. C'est le même modèle qui produit la ligne
quotidienne : la rangée fermée et le volet ouvert ne se contredisent pas.

Le volet tient en quatre colonnes, nuit, matin, après-midi, soirée, mêmes bornes
de six heures que les moments de l'accueil. Chaque colonne porte le symbole du
ciel et une seule température, celle qui compte : le minimum la nuit, le maximum
le jour. Les bornes de la journée sont déjà sur la rangée fermée, les redire
quatre fois n'apprendrait rien.

Deux lignes basses ne paraissent que si elles ont quelque chose à dire, la lame
ou le risque d'abord, la rafale ensuite au delà de quarante kilomètres par
heure. Les seuils sont ceux de la rangée fermée : elle annonce huit pour cent de
risque, le volet ne peut pas se taire dessus.

Un seul volet reste ouvert à la fois. Sept ouverts feraient de la semaine une
page à défiler, ce que la rangée fermée évitait justement. Sur la journée en
cours, un moment déjà passé s'efface.

Une journée dont les heures ne sont pas complètes ne s'ouvre pas et ne porte
alors pas de chevron : une cible qui ne mène à rien vaut moins qu'aucune cible.
Un après-midi résumé de trois heures sur six dirait autre chose que ce qu'il
montre.

La portée demandée à la source entre dans la clé du cache. Sans cela, une charge
écrite par la version d'avant, qui ne demandait que deux jours d'heures, restait
servie jusqu'à la fin de l'heure en cours : le nouveau code tournait sur
l'ancienne donnée et la semaine ne s'ouvrait que sur ses deux premières
journées. La clé porte donc les deux horizons, celui des heures et celui
d'AROME, et le jour où ils changent la charge gardée cesse d'être servie
d'elle-même, sans compteur à penser à incrémenter.

La table de la semaine est devenue une liste de boutons. Une cible de liste veut
son `aria-expanded`, son clavier et son focus, ce qu'une cellule de table ne
donne pas ; les colonnes s'alignent par leurs largeurs fixes, comme avant.

## La grammaire du tracé

Elle est la même sur les sept voies du ruban, et trois dispositifs y portent le
sens.

**Le ciel ouvre la pile.** C'est le dessin qui se lit en un coup d'œil, il n'a
rien à faire en quatrième position derrière une voie qui affiche « aucune ». Sa
bande de symboles est permanente, repliée comme dépliée, et l'axe des heures la
suit : un symbole de pluie en tête de page qui ne dit pas son heure obligeait à
descendre chercher l'axe au pied de la pile.

**L'échelle vit dans une gouttière à droite**, hors du dessin. Posée dedans,
elle traversait les courbes : « 20 km/h » coupait la ligne du vent, « 15° 10°
5° » se collaient à celle de la température. Deux chiffres à moins de sept
points l'un de l'autre s'y chevauchaient et se lisaient « 2,8 m2,5 » : le second
est écarté.

**Les seuils nommés s'écrivent à gauche, sur leur ligne, dans le tracé.**
« Élevé » dit ce que vaut sept d'indice ultraviolet mieux qu'une légende en bas
de carte, et il le dit à l'endroit où on regarde. Là où une échelle nommée
existe, elle tient lieu de graduation : cinq chiffres de plus dans la gouttière
ne diraient rien que « modéré » ne dise déjà.

| Voie | Seuils nommés |
|---|---|
| Vent | Calme, Léger à 12, Modéré à 30, Fort à 50, Violent à 75 km/h |
| Indice UV | Faible, Modéré à 3, Élevé à 6, Très élevé à 8, Extrême à 11 |
| Humidité | Air sec, Confortable à 40, Humide à 70, Saturé à 90 % |
| Pluie | Légère, Modérée à 2,5, Forte à 7,5 mm par heure |
| Ciel | Dégagé, Éclaircies à 25, Couvert à 60 % |

Le même mot sert deux fois : écrit dans le tracé sur sa ligne, et accolé au
chiffre de tête pour dire ce que ce chiffre vaut. « 7,3 au plus, élevé » plutôt
que « max 7,3 ».

**Une bande au-dessus du tracé porte une seconde grandeur en symboles** : la
direction du vent en flèches, le ciel en dessins, la tendance de la pression en
flèches. Elle ne paraît que si la voie est assez haute pour la porter, soixante
points, ce qui vaut toujours pour le vent et seulement une fois dépliées pour les
voies courtes. Les valeurs chiffrées occupent une seconde bande, sous elle :
écrites au même niveau, les flèches du vent et les chiffres du vent se
recouvraient. Sur la courbe, elles la coupaient.

**La couleur n'est une donnée que sur deux voies**, la température et l'indice
ultraviolet, dont l'échelle se lit d'un coup d'œil. Ailleurs elle ferait du
bruit : la forme, les symboles et les seuils nommés suffisent. La rampe de
température se pose deux fois : en hauteur elle remplit la colonne du
thermomètre, froide en bas et chaude en haut, et l'aire y puise sa teinte à la
hauteur de chaque point ; en largeur elle colore la courbe elle-même, heure par
heure.

**La rafale est l'enveloppe, le vent est le corps.** La rafale court au-dessus,
en trait nu ; le vent moyen porte son aire jusqu'à zéro. Le pointillé disait la
même chose une troisième fois : la position et le remplissage suffisent.

**Un point marque chaque extrême**, sans chiffre : le chiffre est en tête, il ne
se redit pas.

**La nuit et les montants gardent l'encre du texte**, non la couleur de la voie :
lavés à la couleur, ils viraient au bleu sur la pluie et au jaune sur l'indice
ultraviolet, et une nuit couleur de soleil ne se lit plus. Le lavis couvre les
sept voies : présent sur quatre d'entre elles et absent des trois autres, il se
lisait comme un rectangle posé au hasard. Sur la voie du ciel il se réduit à un
bandeau de cinq points, où il ne s'ajoute pas à la densité.

**La hauteur dépliée est propre à la voie.** Le facteur commun de deux et demi
vaut pour une courbe, qui gagne du relief, il ne donne rien à une bande de
densité, qui reste plate qu'elle fasse quarante ou cent dix points. Le ciel
déplié tient donc dans les quatre-vingt-six points communs, non dans cent dix.

**Une voie peut changer d'encodage en s'ouvrant**, quand le repli en trahit la
forme. Le ciel se dit en densité replié, faute de place, et en aire sous ses
bandes nommées déplié : une teinte n'a pas d'échelle contre laquelle se lire, sa
bascule se voyait comme un saut de gris entre deux lames, et le pourcentage
flottait sans repère. Le pourcentage brut reste d'ailleurs le plus faible des
renseignements de cette voie, quatre-vingt-cinq et quatre-vingt-quinze donnant le
même ciel : ce sont la bande nommée et l'heure de bascule qui se lisent.

**Chaque voie se résume d'un fait, non d'une notice.** « Protection recommandée
de 11 h à 16 h » se lit, « indice ultraviolet heure par heure, au-dessus de sept
l'exposition demande une protection » se saute. Plusieurs plages disjointes ne
se disent pas comme une seule : on dit la plus longue, et qu'il y en a d'autres.

**L'axe des heures se répète sous une voie dépliée.** La pile fait cinq cents
points et l'axe est tout en bas : une voie du milieu n'aurait plus de repère de
temps. Ses libellés se posent à l'abscisse exacte de leur montant, non répartis
sur la largeur.

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

Les quatre mesures portent sur la journée civile entière, non sur l'heure en
cours. À dix heures du soir, « indice UV 0 » et « vent 11 km/h » ne disaient rien
d'une journée montée à sept d'indice et à quatre-vingts de rafale. Chacune est le
maximum du jour, et chacune écrit sur quoi elle porte, « au plus », « élevé »,
« de risque aujourd'hui » : un chiffre de journée présenté comme un relevé
d'instant se lirait de travers. Le titre au-dessus dit déjà la même chose des
températures, « 18° à 32° aujourd'hui ».

La pluie se dit en millimètres quand il en tombe, en risque sinon, comme dans la
table de la semaine.

Le ressenti ne paraît que s'il s'écarte d'au moins deux degrés du maximum du
jour. Sinon la pluie prend sa place : « Ressenti 32° » à côté d'un maximum de 32°
occupait un quart de la carte sans rien apprendre. Deux degrés et non un seul,
la comparaison portant ici sur deux maximums de journée.

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
une couche continue vue par en dessous, dont seule la base se voit. La nappe
prend le relais des cumulus au-delà des deux tiers de couverture : un ciel
couvert n'est pas un ciel qui aurait beaucoup de cumulus.

Elle les éteint exactement là où elle se ferme. Sous un plafond continu, la
masse qui subsistait se lisait comme un ballon suspendu devant lui. Et un plan
ne porte jamais une seule masse : isolée au milieu du ciel, elle se lit comme un
objet posé là plutôt que comme un nuage qui passe, un plan en porte donc deux au
moins, ou aucune.

Le bord de la nappe est une ligne irrégulière et molle, non une frise d'arches.
Cinq périodes d'amplitude décroissante, qui se referment toutes sur la largeur,
et vingt-deux lobes larges et plats qui ne bombent pas le bord mais
l'épaississent. Leur profondeur varie autant que leur largeur : posés tous à la
même hauteur sous la base, ils alignaient leur crête et rendaient au ciel la
ligne droite qu'on venait de lui retirer. Le bord bas se dilue enfin, une couche
n'ayant pas de découpe nette par en dessous.

Le flou du masque se pose sur le masque entier, débord compris, et la découpe
vient après, sans filtre. Un `drawImage` filtré découpe sa source avant de la
flouter : le débord ne servait à rien, le bord de la couche était flouté contre
du vide, et son raccord sautait de six points à chaque répétition, une couture
verticale en plein ciel. Un contrôle mesure la position du bord colonne par
colonne, au sous-pixel, et refuse toute cassure.

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

Les disques sont à leur place calculée : l'abscisse suit l'azimut, l'ordonnée
la hauteur. Le Soleil suivait l'heure, ce qui le posait au milieu du panneau à
neuf heures du matin alors qu'il est à l'est-nord-est. Surtout, deux astres dans
un même ciel doivent partager la même règle : l'heure ne dit rien de la place de
la Lune, qui se lève cinquante minutes plus tard chaque jour. L'arc couvert va
de l'est-nord-est à l'ouest-nord-ouest, ce qui contient les levers et les
couchers aux latitudes françaises en toute saison.

Le ciel de l'accueil porte les deux astres quand ils sont levés tous les deux,
ce qui arrive une bonne partie du mois : la Lune se voit en plein jour, pâle,
dès qu'elle s'écarte du Soleil. N'en montrer qu'un donnait un ciel faux la
moitié des après-midi.

Deux réserves de jour, chacune sa raison. Un croissant trop mince est une Lune
trop proche du Soleil pour être vue, un huitième éclairé valant environ quarante
degrés d'écart. Et deux disques ne se recouvrent pas, leurs rayons faisant
ensemble près d'un tiers de la largeur du panneau. De nuit la Lune reste
dessinée même couchée, faute de quoi le panneau serait vide.

La lueur qui traverse une couche de nuages vient du Soleil quand il est levé, de
la Lune sinon : c'est lui qui éclaire les nuages, elle ne les éclaire qu'en son
absence.

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

De jour, la Lune ne garde que ce qui est plus lumineux que le ciel. Sa part
sombre est effacée à la source, dans le calcul de l'éclairage, l'opacité de
chaque point suivant sa propre lumière : la nuit on voit un disque entier dont
une part est cendrée, de jour on ne voit que le croissant, et le reste est du
ciel. Une pâleur uniforme portée sur tout le disque laissait au contraire un
rond gris posé sur le bleu, et un voile ajouté par-dessus lui rendait l'opacité
que l'effacement venait de lui retirer. La clarté du ciel entre donc dans la clé
de la réserve de disques.

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
| Prévision | `api.open-meteo.com`, sept jours d'heures et de jours, AROME de Météo-France forcé sur les trois premiers | Aucun |
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
  controle.mjs      trois cent trente-neuf contrôles en navigateur
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
bas de page, sous `essais/captures`. Les variables `ECRAN` et `QUAND` portent la
destination et l'instant à figer, `OUVRIRVOIE` la voie du ruban à déplier et
`OUVRIR` le rang de la journée à ouvrir dans la semaine.

Le lanceur sert le dossier, fige l'horloge au 18 août 2026 à 9 h, détourne les
trois appels Open-Meteo vers `meteo.json`, sert une vigilance orange de
convention, et coupe les sources data.gouv pour éprouver le repli. Deux cent
trois cent trente-neuf contrôles, dont l'absence de répétition entre
les alertes et les conseils, les sept voies du ruban, l'agrandissement d'une
voie, les treize colonnes de la liste, les vingt-quatre lignes de la fenêtre, la
nature du renvoi de vigilance, et dix-sept contrôles de conformité au design
system : cibles de 44 pt, fond issu du token, absence de rayon en valeur brute,
verre réservé à la navigation, tailles de texte issues de l'échelle, transitions
neutralisées sous mouvement réduit, accroches de feuille, erreur sous le champ,
état désactivé, rangée unique, état vide complet, ossature au premier
chargement. Les écrans du Soleil et de la Lune sont contrôlés de la même façon,
y compris l'absence de toute requête réseau pour la Lune. Le tableau des moments
en ajoute six : chaque mesure nommée une seule fois, une case par mesure et par
moment, aucune ligne creuse de bout en bout, aucun nom de tranche qui passe à la
ligne, aucune borne de température collée par un trait, et la carte sous quatre
cents points. Un septième, sur un temps calme, vérifie que le tableau ne garde
que ses lignes utiles. La semaine ajoute onze
contrôles : sept rangées ouvrables, aucun volet ouvert à l'arrivée, l'ouverture
sur quatre moments, les quatre noms de tranche, un seul volet ouvert à la fois,
la fermeture au second appui, la borne qui compte et rien de superflu dans
chaque volet, la rafale signalée, le moment passé effacé, et sur une charge
écourtée en milieu de journée, la journée incomplète qui ne s'ouvre pas ni ne
porte de chevron. Deux autres gardent le contrat avec la source : les heures
demandées sur sept jours, AROME sur trois. Deux derniers reprennent le défaut tel qu'il s'est produit : une charge gardée sous l'ancienne forme ne doit pas être servie, et la semaine doit s'ouvrir sur ses sept journées après elle. Sept contrôles portent
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
Six contrôles gardent les faits marquants et les mesures du jour : les quatre
mesures portent le maximum de la journée et non le relevé de l'heure, chacune dit
sa portée, rien ne se dit au-delà d'après-demain, après-demain se dit encore, le
titre couvre la journée la plus lointaine, et un même maximum n'est pas annoncé
deux fois.

Trois contrôles gardent le renversement de température : rien ne se dit quand
demain vaut aujourd'hui, la phrase paraît quand l'écart est réel, et le maximum
qu'elle nomme est celui que porte la table de la semaine.

Huit contrôles gardent le ciel à deux astres : le Soleil seul quand la Lune est
couchée, les deux ensemble quand ils sont levés, la Lune seule la nuit, la même
place pour le Soleil sur l'accueil et sur son écran, l'écart gardé entre les
deux disques, la part sombre de la Lune effacée de jour et entière la nuit. La
règle de choix est éprouvée sur six cas, dont une Lune neuve en plein jour et
deux astres qui se frôlent, que la charge d'essai ne contient pas.

Onze contrôles éprouvent le passage de la prévision au dessin, code par code :
un ciel clair sans couche ni précipitation, des éclaircies à cumulus sans
couche, un ciel couvert à couche fermée, une averse gardant ses cumulus sous une
couche partielle, la nature de la précipitation, l'orage marqué, le brouillard
distingué d'une averse, la couverture déduite du code quand la source ne la
porte pas, le fait que l'astre disparaît sous une couche fermée, et qu'il n'y reste aucune
masse isolée. Un contexte entièrement couvert mesure la position du bord de la
couche colonne par colonne et refuse toute cassure au raccord.

Seize contrôles gardent la grammaire du tracé : l'échelle dans la gouttière,
deux chiffres qui ne se superposent pas, les seuils nommés dans le tracé, les
flèches de direction du vent, la rampe sur la température en largeur et en
hauteur, la couleur des barres ultraviolettes, la nuit sur les sept voies et à
l'encre du texte, le résumé qui porte un fait, l'axe répété sous une voie
dépliée, et les deux bandes qui ne se recouvrent pas.

Cinq portent sur la voie du ciel, qui ouvre la pile : elle est la première,
sa bande de symboles paraît repliée avec une bande de hauteur qui lui est
réservée, l'axe des heures la suit, et dépliée elle quitte la densité pour l'aire
sous ses bandes nommées, dans la hauteur commune d'une voie.

Quatre s'ajoutent sur ce que le tracé recouvre. Un nom de bande doit occuper une
place nette dès qu'il en existe une : le contrôle balaye la largeur de la voie,
distingue une aire d'un trait, et ne reproche au mot sa place que si une autre
était libre. Le liseré qui le détache doit rester opaque. Les symboles du ciel
doivent porter leur taille en attributs et tenir dans leur bande : en feuille de
style seule, WebKit déploie un SVG imbriqué sur la hauteur de son parent et le
symbole déborde de la carte.

Un contexte sec et dégagé garde deux défauts que la donnée courante ne montre
pas : une voie sans tracé doit se réduire à sa ligne de titre, sans la réserve
de hauteur d'une touche qu'elle n'est pas, et un ciel dégagé ne doit pas écrire
sa file de zéros.

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
