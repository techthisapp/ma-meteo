# Ma météo, jalon 3 : la réponse utile

Dépôt `techthisapp/ma-meteo`, à partir de `b13c43d`. Proposition écrite le 27 août 2026, arbitrages tranchés le même jour. Lot 1 publié le 28 août 2026 en `83c0c76`, corrigé le même jour en `53fa4cd`. Lot 2 publié le 28 août 2026 en `21983db`. Lot 3 publié le 28 août 2026 en `e473aae`. Encart repris en `ee1d72d`. Lot 4 publié le 29 août 2026 en `2fd5aa5`, agent de service `ma-meteo-v38`. Jalon achevé.

## Objet

L'application répond à la question posée plutôt que de laisser lire un tableau. Elle sait aujourd'hui montrer le temps qu'il fait et ce qui sort de l'ordinaire ; elle ne sait pas encore dire s'il faut prendre un parapluie, quand étendre le linge, ni où aller chercher le soleil.

## Ce que la source rend

Trois relevés faits le 26 août 2026 avant rédaction, pour que la proposition tienne sur des mesures et non sur des suppositions.

| Besoin | Réponse de la source | Coût mesuré |
|---|---|---|
| Évapotranspiration, pour l'arrosage | `et0_fao_evapotranspiration`, en quotidien et en horaire, avec les journées écoulées | 170 octets ajoutés à la requête quotidienne existante |
| Déficit de pression de vapeur, pour le séchage | `vapour_pressure_deficit`, en horaire | Une colonne horaire de plus |
| Grille de communes, pour le classement | Cent couples de coordonnées acceptés dans un seul appel | 37 kilooctets pour cent points sur une journée |

Aucune source nouvelle. Le jalon tient entièrement sur les hôtes déjà interrogés.

## Ce sur quoi le jalon s'appuie

| Existant | Ce qu'il apporte |
|---|---|
| Le moteur de règles de `src/conseils.js`, dix-sept règles à seuils nommés | La forme des règles d'activité, et le principe du silence par défaut |
| Les scénarios de `src/ensemble.js` | La confiance de chaque créneau, qui vient du jalon 1 |
| La barre de tête, identique sur les cinq écrans | L'emplacement du jeton du jour |
| La feuille des réglages | Les heures de sortie et le biais personnel |
| L'aperçu des lieux suivis, un appel pour dix communes | Le classement du « où est le beau temps » |

## Découpage proposé

Quatre lots. L'ordre suit ce qui rend le plus tôt pour le moins de code, et ce qui fixe des seuils dont les lots suivants se servent.

### Lot 1. Le rappel de parapluie, publié

Le plus concret, le plus autonome, et celui dont la feuille de route donne déjà le détail. Trois mécanismes sur les quatre annoncés, le quatrième étant traité plus bas.

**Le jeton du jour.** Quand de la pluie gênante est attendue pendant la période d'alerte en cours, un jeton paraît dans la barre de tête, à côté du nom de la commune, à l'identique sur les cinq écrans. Il nomme les heures de la pluie. Un appui ouvre sa feuille, où un bouton le marque comme pris ; il disparaît aussi de lui-même une fois la pluie passée. La prise est gardée en local, portée par la date et l'instant d'alerte, si bien qu'un rechargement ne le fait pas revenir.

**Les heures réglées sont des heures d'alerte.** Correction du 28 août, après essai. La première version cherchait la pluie à l'intérieur des heures de sortie, et ne voyait donc rien d'une averse de quatorze heures pour quelqu'un qui sort à sept heures, ce qui est le cas ordinaire. Les heures réglées disent quand prévenir, non où chercher : ce sont les occasions de prendre un parapluie avant de sortir.

| Élément | Règle |
|---|---|
| Forme du réglage | Deux instants, non deux plages, par défaut 7 h 30 et 17 h |
| Portée d'une alerte | De son instant jusqu'à l'alerte suivante |
| Portée de la dernière | De son instant jusqu'à minuit |
| De minuit à la première alerte | Aucune alerte : on n'y sort pas, et prévenir n'y donne aucune occasion de prendre un parapluie |
| Ce que le jeton nomme | Les heures de la pluie, non celles de l'alerte |
| Averses séparées | Deux salves distinctes, jamais une plage qui les enjambe |

**Le bon objet.** Trois cas, tranchés par l'intensité et le vent.

| Cas | Condition | Écrit |
|---|---|---|
| Parapluie | Lame au-dessus du seuil de gêne, rafale sous le seuil de retournement | « Parapluie, 17 h à 19 h » |
| Capuche | Lame au-dessus du seuil de gêne, rafale au-dessus du seuil de retournement | « Capuche, 17 h à 19 h » |
| Rien | Lame sous le seuil de gêne | Aucun jeton |

Deux constantes nommées : la gêne, proposée à un demi-millimètre par heure, une bruine à un dixième ne trempant personne ; le retournement, à quarante kilomètres par heure, seuil déjà employé par la règle des rafales. Un parapluie annoncé par vent de quarante kilomètres par heure est un mauvais conseil.

**Le rappel posé dans l'agenda.** Un appui produit un fichier `text/calendar` fabriqué sur l'appareil, avec un évènement à l'instant d'alerte de la période et une alarme quinze minutes avant : c'est en sortant qu'on prend un parapluie, et un rappel qui sonne quand la pluie tombe arrive trop tard. Quand l'instant d'alerte est déjà passé, le rappel se pose au début de la pluie. L'agenda du téléphone s'en charge ensuite, ce qui donne une vraie alerte sans aucun service dorsal. Une variante pose un évènement par période pluvieuse de l'horizon.

**Réglage.** Les deux instants d'alerte, avec une valeur par défaut raisonnable. Chaque rangée dit la période dont son alerte répond.

Fichiers touchés : `src/parapluie.js`, nouveau, pour les seuils, le jeton et le fichier d'agenda ; `src/reglages.js` pour les heures de sortie et la prise du jeton ; `src/app.js` et `index.html` pour la barre de tête ; `src/vues.js` pour la feuille du jeton et celle des réglages ; `styles.css` pour le jeton et les menus d'heure.

#### Ce qui a été livré, et les trois écarts à la proposition

**Le jeton ouvre une feuille au lieu de disparaître.** La proposition disait « un appui le marque comme pris et il disparaît ». Le troisième mécanisme, le rappel d'agenda, a besoin d'une surface : un appui ouvre donc une feuille qui porte la phrase entière, la lame la plus forte, la rafale, le bouton d'agenda, sa variante hebdomadaire, et un bouton « C'est pris ». C'est ce dernier qui retire le jeton.

**Les heures vont au pas de la demi-heure.** L'arbitrage 2 fixait 7 h 30, ce qu'un réglage en heures pleines n'aurait pas rendu. Le module et les réglages travaillent donc en demi-heures, et une heure de prévision compte dès qu'elle rencontre la période : une alerte à sept heures et demie retient bien l'heure de sept heures, dont la seconde moitié est devant soi.

**Aucune règle nouvelle dans `src/conseils.js`.** Le jeton et sa feuille portent le message ; une phrase de plus sur l'accueil l'aurait dit deux fois, et cette phrase est précisément la réponse du matin du lot 2. `conseils.js` sert en revanche de source au seuil de retournement, que `parapluie.js` reprend de `SEUILS.rafale` au lieu de le recopier : deux nombres égaux écrits à deux endroits finissent par diverger.

Le même défaut de garde double s'est présenté deux fois, et la réponse a été la même : une seule condition écarte une heure, celle qui la dit passée. Une période entièrement derrière soi n'a plus une seule heure à venir et tombe donc d'elle-même ; l'écarter une seconde fois sur sa borne de fin était une garde que rien ne pouvait plus éprouver, et elle a été retirée.

### Lot 2. La réponse du matin et le ressenti calibré, publié

**La réponse du matin.** Une phrase posée dans le ciel du bandeau, en matière verre, au-dessus de la ligne de date. Elle donne une instruction là où les conseils donnent un fait, et c'est le seul endroit de l'application qui en donne une.

Elle porte deux lignes au plus, chacune avec son symbole : l'objet à prendre, puis la tenue. Deux règles nourrissent la ligne de tenue.

| Règle | Ce qu'elle dit | Quand elle se tait |
|---|---|---|
| Habillement | Les deux tenues des extrêmes de ressenti restants, dans l'ordre du temps | La journée tient dans une seule tenue ordinaire |
| Aération | La première fenêtre d'heures assez fraîches et sans pluie | L'intérieur ne va pas devenir plus chaud que le dehors |

L'habillement passe devant l'aération : on s'habille avant d'ouvrir une fenêtre. Les deux moments se disent dans l'ordre du temps et non du plus froid au plus chaud, une journée qui se rafraîchit se lisant dans l'autre sens. La confiance ne s'écrit que lorsque les scénarios sont partagés, au delà de six degrés d'étendue.

L'aération ne parle que les jours où l'intérieur va devenir plus chaud que le dehors. Sans cette réserve, la règle se déclencherait tout l'hiver, où il fait toujours plus frais dehors que dedans, et cesserait d'être lue.

**Le ressenti calibré.** L'encart est une cible : il ouvre une feuille qui porte deux boutons, trop chaud et trop froid, l'état de la correction et sa remise à zéro. Chaque appui déplace le biais d'un degré, borné à trois de part et d'autre. Le retour se donne au moment où le conseil est lu.

Le biais déplace la tenue conseillée et non les degrés écrits. Ceux-ci viennent de la source, et trois contrôles gardent l'accord entre écrans au degré : une valeur décalée contredirait le ruban et la table des moments. Il reste sur l'appareil et n'entre dans aucune requête.

**Un défaut ancien corrigé au passage.** `--ci-clarte` était posée sur le panneau du ciel, quand le titre et la réponse sont à côté de lui et non dedans. L'ombre du titre se calculait donc depuis le début sur une clarté nulle, c'est-à-dire jamais réglée. Aucun contrôle ne pouvait le voir, les voiles de lisibilité portant déjà le contraste à cette hauteur. La variable est remontée sur le cadre.

**La matière de l'encart.** Le verre sort de la couche navigation pour ce seul endroit, par arbitrage. Sa matière porte son contraste : l'encart tombe entre les deux voiles de lisibilité, là où ils se rejoignent au plus faible, et mesuré sur un plafond de plein jour le ciel nu y laisse un blanc à deux virgule cinq de contraste, que la matière remonte à quatre virgule deux. Elle est fixe et non réglée sur la clarté : trente pour cent suffisent sur le plafond le plus clair que l'application peigne, et un réglage sans conséquence observable serait une garde que rien ne pourrait éprouver.

Fichiers touchés : `src/reponse.js`, nouveau, pour les seuils et les deux règles ; `src/app.js` pour l'encart ; `src/reglages.js` pour le biais ; `src/vues.js` pour la feuille du ressenti ; `styles.css` pour la matière.

Quatre arbitrages tranchés le 28 août avant écriture : la phrase passe au fait suivant quand le jeton est là, elle ne paraît que si elle a un fait à dire, la confiance ne s'écrit que lorsqu'elle est faible, et le retour se donne dans une feuille ouverte depuis l'encart.

### Lot 3. L'écran de questions, publié

Le plus gros morceau. Six activités, chacune définissant ses seuils, et un moteur qui rend un créneau daté avec son niveau de confiance.

| Activité | Ce qui décide |
|---|---|
| Courir | Température ressentie, pluie, indice ultraviolet |
| Rouler à vélo | Vent moyen et rafales d'abord, pluie ensuite |
| Étendre le linge | Séchage, voir ci-dessous |
| Aérer | Écart entre l'air du dehors et l'air d'un intérieur ordinaire |
| Arroser | Bilan hydrique, voir ci-dessous |
| Laver la voiture | Absence de pluie sur les heures qui suivent |

**Le séchage du linge** se calcule de l'évapotranspiration horaire, non du déficit de pression de vapeur. Correction de l'arbitrage 7, faite à la mesure avant écriture : à déficit égal au-dessus de 0,8 kPa, l'évapotranspiration horaire va de 0,01 à 0,57 millimètre par heure selon le vent et le soleil, un facteur cinquante-sept. Le déficit seul ne dit donc presque rien de la vitesse de séchage, quand l'évapotranspiration la donne directement, radiation et vent compris. La colonne retenue est celle dont l'arrosage a de toute façon besoin : le lot retire une colonne au lieu d'en ajouter une.

**L'arrosage** se calcule du bilan entre l'évapotranspiration servie par la source et le cumul de pluie des journées écoulées. Fenêtre de sept jours : moins, une seule averse renverse le bilan ; plus, la mémoire du sol n'est plus celle d'une plante en pot. Le déficit qui vaut un arrosage est de huit millimètres, soit deux journées d'été d'évaporation sans pluie. Relevé sur Fain-lès-Moutiers le 28 août pour les sept jours écoulés : 23,6 mm d'évapotranspiration contre 33,7 mm de pluie, soit un excédent de 10 mm, donc pas d'arrosage à conseiller.

Sous la pluie, l'arrosage dit que la pluie s'en charge : ne trouver aucune soirée sèche sur deux journées veut dire qu'il pleut, et le jardin est alors arrosé.

Les seuils de chaque activité sont des constantes nommées et documentées, non des nombres posés dans le code de la vue, pour que les contrôles les éprouvent.

La surface est une feuille à accroche basse, ouverte depuis l'accueil, voir l'arbitrage 4.

#### Ce qui a été livré

| Élément | Décision |
|---|---|
| Entrée | Une rangée « Quand faire quoi » sous les mesures du jour, dans le bloc Aujourd'hui |
| Surface | Une feuille à accroche intermédiaire, six rangées et une note |
| Horizon | Quarante-huit heures, la dispersion des scénarios valant déjà cinq degrés à deux jours |
| Contenu | Le premier créneau qui convient, non le meilleur de la semaine, avec ce qui le décide |
| Confiance | Écrite seulement quand les scénarios sont partagés, comme dans la réponse du matin |

L'aération n'est écrite qu'une fois. La règle vit dans `src/activites.js` et la réponse du matin la lit : deux règles pour la même question finiraient par se contredire sur le même écran, défaut que le dépôt a déjà payé avec le maximum de journée qui valait vingt-quatre d'un côté et trente-trois de l'autre. L'activité s'appelle « Aérer pour rafraîchir », ce que la règle calcule réellement : en hiver elle se tait, et « aucun créneau » y veut dire qu'ouvrir n'apporterait rien de plus frais.

Deux bornes ont été ajoutées après lecture des premières réponses. Courir et rouler à vélo se limitent aux heures où l'on sort de son propre chef, six à vingt-deux : sans elles, une nuit calme et sèche donnait « 17 h à 03 h », ce qui est vrai du vent et que personne ne fait. Le lavage de la voiture n'en a pas besoin, la lumière du jour le bornant déjà, et une seconde borne pour le même fait ne se contrôlerait plus.

La signature des colonnes demandées entre dans la clé du cache. Une charge écrite avant une colonne ne la porte pas, et la servir ferait tourner le code nouveau sur une donnée incomplète, ce que le dépôt a déjà payé une fois avec la semaine qui ne s'ouvrait que sur deux journées. La signature se calcule des listes elles-mêmes, sans compteur à penser à incrémenter.

Fichiers touchés : `src/activites.js`, nouveau, pour les six activités et leurs seuils ; `src/previsions.js` pour les deux colonnes et le bilan d'eau ; `src/vues.js` pour la feuille ; `src/app.js` pour la rangée d'entrée ; `src/reponse.js` pour l'aération partagée.

### Lot 4. Où est le beau temps, publié

Une feuille jumelle de l'écran de questions : l'une dit quand, l'autre dit où. Deux rangées se suivent sur l'accueil et se lisent comme une paire.

**Ce que la mesure a tranché avant écriture.** Grille réelle de soixante-neuf points à vingt-deux kilomètres de pas autour de Fain-lès-Moutiers, lue en un appel de 3,9 kilooctets compressés, trente-neuf bruts. Sur cette grille, l'ensoleillement du lendemain allait de 4,4 à 10,6 heures d'un point à l'autre, la température maximale de 20,6 à 27 degrés et la pluie de 0 à 10 millimètres. À cette distance, c'est le soleil qui sépare deux lieux, la température très peu : le score le porte, la pluie et l'écart à une température agréable ne font que corriger.

| Terme | Poids | Ce qu'il mesure |
|---|---|---|
| Ensoleillement | 60 | La part de la durée du jour où le soleil donne, non un nombre d'heures : cinq heures sont une belle journée en décembre et une journée grise en juin |
| Pluie | 25 | Nulle au delà de cinq millimètres sur la journée, où il n'y a plus de degré dans la punition |
| Douceur | 15 | L'écart à vingt-deux degrés au maximum, nul au delà de dix degrés de part et d'autre |

**Deux échelles, deux coûts.** Les lieux suivis sont classés à l'ouverture de la feuille, en un appel d'une dizaine de points. La grille ne part qu'à l'appui sur son bouton : elle répond à une question qu'on ne pose pas chaque matin. La lecture est gardée en mémoire une demi-heure, non dans le stockage local, lequel sert à ouvrir l'application hors ligne.

| Élément | Valeur |
|---|---|
| Rayon | 100 km, environ une heure et demie de route |
| Pas | 22 km, soit 69 points, et aucun endroit du disque à plus de 16 km d'un point |
| Journées | Aujourd'hui et demain, par deux boutons |
| Points montrés | Cinq, tenus à 44 km les uns des autres |
| Rangée d'ici | Toujours présente, même hors du haut du classement |
| Verdict | « Mieux à 34 km au nord-est » ou « Le beau temps est ici », au delà de huit points de score |

**Les cinq points montrés sont cinq endroits distincts.** Sans distance minimale, ce sont les cinq mailles voisines du même coin de la grille : mesuré, les cinq premiers tenaient entre 88 et 99 kilomètres dans la même direction, à deux dixièmes d'heure de soleil près. C'est un seul endroit écrit cinq fois, et la liste cesse d'offrir un choix.

Le centre de la grille est le lieu courant : c'est lui qui donne le score d'ici, mesuré par la même source, sur la même journée et avec les mêmes colonnes que les autres points. Son nom vient des réglages, non du géocodage inverse, lequel ne sert qu'à nommer les points montrés, cinq appels et non soixante-neuf.

**Trois règles dupliquées réunies au passage.** Les huit points cardinaux vivaient dans `vues.js` et dans `previsions.js` à l'identique ; l'écriture des nombres à la virgule dans `horloge.js` et dans `activites.js` ; la porte des feuilles de l'accueil portait le nom d'une seule des deux questions. Deux listes pour une même rose finissent par ne plus dire la même chose.

Fichiers touchés : `src/beautemps.js`, nouveau, pour le score, la grille et le classement ; `src/previsions.js` pour l'appel multi-points ; `src/vues.js` pour la feuille ; `src/app.js` pour la seconde rangée de l'accueil ; `styles.css` pour la porte partagée et le repère d'ici.

## Ce qui n'est pas réalisable tel quel

Le quatrième mécanisme du rappel de parapluie, l'automatisation, demandait que l'application publie un raccourci prêt à importer. Ce n'est pas possible depuis un site statique : un fichier de raccourci iOS est une archive signée par Apple, et un fichier fabriqué sur l'appareil ne s'importe pas.

Ce qui reste possible, et qui est retenu : la feuille des réglages porte la marche à suivre, étape par étape, pour construire le raccourci une fois à la main. Sans lien de partage, celui que produit l'application Raccourcis étant personnel.

## Arbitrages tranchés

Sept questions posées le 27 août 2026. Trois arbitrées par Jérôme, quatre tranchées au vu des mesures et de ce que le dépôt tient déjà.

### 3. La réponse du matin se pose sur l'illustration du temps

Un encart en matière verre, posé sur le ciel du bandeau, à demi transparent. C'est la matière que la barre de tête emploie déjà, et l'endroit se lit avant tout le reste sans disputer sa place au panneau de vigilance, qui vient sous le bandeau.

L'encart traverse la largeur, au-dessus de la ligne de date. Cette bande est la seule du ciel qui ne rencontre jamais rien : les astres sont posés à leur azimut réel et peuvent tomber n'importe où au-dessus, le grand chiffre et les bornes du jour occupent tout ce qui est en dessous.

Le contraste se règle sur la clarté du ciel peint, par la variable `--ci-clarte` déjà en place : un plafond de plein jour monte à quatre-vingts pour cent de clarté, où un texte clair disparaîtrait. Un contrôle mesure le contraste sur l'image composée, comme celui du titre.

### 4. L'écran de questions est une feuille depuis l'accueil

Une feuille à accroche basse, ouverte depuis l'accueil. La barre d'onglets garde ses cinq destinations.

### 6. Le rayon se compte en kilomètres

Cent kilomètres autour de la commune affichée, ce qui vaut environ une heure et demie de route. Le temps de trajet reste hors de portée sans source d'itinéraires, et l'écran dit un rayon, non une durée.

### L'arbitrage sur le parapluie dans l'encart, repris le 28 août

L'arbitrage d'origine, tranché avant écriture du lot 2, laissait la pluie au seul jeton : l'encart passait au fait suivant quand le jeton était là, pour ne rien dire deux fois sur le même écran.

Repris après lecture sur téléphone. Un conseil de vêtement qui ne dit pas de prendre une capuche est incomplet : c'est la même question, celle de ce qu'on emporte, et la couper en deux la rendait moins utile que la redite ne coûtait. L'encart porte donc l'objet en première ligne, avec son symbole, puis la tenue.

Le jeton reste à sa place sur les cinq écrans et sert de porte au rappel d'agenda. Chaque ligne de l'encart est une cible propre, l'une vers le rappel et l'autre vers le réglage du ressenti, chacune tenant les quarante-quatre points du design system.

L'objet n'est pas recalculé : le jeton le porte déjà, avec sa prise et sa fenêtre d'alerte, et l'encart le reprend du contexte. Un jeton pris quitte donc les deux endroits ensemble.

### 1. L'ordre des lots reste celui proposé

Ce n'est pas un ordre de taille mais une chaîne de dépendances. Le lot 1 fixe les seuils de gêne et de retournement dont la réponse du matin du lot 2 se sert ; le ressenti calibré du lot 2 nourrit les activités du lot 3 ; le score de confort du lot 4 reprend les seuils des activités du lot 3.

### 2. Deux heures d'alerte, matin et soir

Valeurs par défaut : 7 h 30 et 17 h. Une seule alerte manquerait le retour du soir, ou couvrirait la journée entière et ne dirait plus rien. Le jeton nomme la pluie dont l'alerte en cours répond.

Relu le 28 août après essai : ce sont des instants d'alerte et non des plages de sortie. La formulation d'origine, « 7 h 30 à 9 h », se reprend comme l'instant 7 h 30, qui est bien le moment où l'on sort. Une alerte se déclenche à un moment, non pendant une durée, et la borne de fin ne servait à rien.

### 5. Le raccourci se donne en recette, sans lien

La feuille des réglages porte la marche à suivre, étape par étape. Pas de lien de partage : celui que produit l'application Raccourcis est personnel, il ne se publie pas pour tout le monde, et un lien qui meurt vaut moins que pas de lien.

### 7. Le séchage se calcule de l'évapotranspiration horaire

Arbitrage repris le 28 août, avant écriture du lot 3. Il retenait d'abord le déficit de pression de vapeur, au motif que la source le sert directement plutôt qu'une formule reconstruite. Le principe tient, le choix de la grandeur non : mesuré sur dix jours, à déficit égal au-dessus de 0,8 kPa, l'évapotranspiration horaire va de 0,01 à 0,57 millimètre par heure selon le vent et le soleil, un facteur cinquante-sept. Le déficit seul ne dit donc presque rien de la vitesse de séchage.

L'évapotranspiration horaire la donne directement, radiation, vent, température et déficit compris, et c'est la colonne dont l'arrosage a de toute façon besoin. Le lot retire donc une colonne au lieu d'en ajouter une.

## Risques et essais sur téléphone

| Risque | Ce qu'il faut vérifier |
|---|---|
| Le fichier d'agenda sur iOS | Qu'un fichier `text/calendar` fabriqué sur l'appareil ouvre bien l'agenda et propose l'ajout |
| Le jeton dans la barre de tête | Que la barre garde sa hauteur et que le nom de commune ne se tronque pas |
| Le poids de l'écran de questions | Que six activités calculées à chaque rendu ne retardent pas l'affichage |

## Contrôles

Chaque contrôle est éprouvé en rétablissant la faute qu'il garde, selon la règle du dépôt.

Les quatorze fautes du lot 1 sont consignées dans `essais/epreuve-lot1.sh`, une par numéro, chacune nommant le contrôle qu'elle doit faire tomber.

| Contrôle du lot 1, éprouvé | Faute rétablie |
|---|---|
| Une journée sèche ne fait paraître aucun jeton | retirer le seuil de gêne |
| Un vent au delà du seuil fait écrire capuche et non parapluie | rendre le jeton aveugle à la rafale |
| Le jeton ne revient pas au rechargement | ne pas garder la prise |
| Une pluie déjà tombée ne fait rien paraître | ne pas écarter les heures passées |
| Une pluie de l'après-midi est annoncée dès le matin | chercher la pluie dans la seule heure d'alerte, et non jusqu'à la suivante |
| Une pluie tombée avant la première alerte ne fait rien paraître | faire couvrir la nuit par la dernière alerte |
| Le rappel se pose à l'heure d'alerte tant qu'elle est devant soi | le poser à l'heure de la pluie |
| Le jeton nomme les heures de la pluie | y écrire l'heure d'alerte |
| Deux averses d'une période se disent séparément | fondre les salves en une seule plage |
| Un réglage de plages de sortie se reprend en instants d'alerte | jeter l'ancien réglage |
| Son alarme tombe quinze minutes avant l'évènement | poser l'alarme sur l'heure de l'évènement |
| Une ligne longue se replie et se déplie sur son texte | ne pas replier, puis replier sur des caractères et non sur des octets |
| Une fenêtre dont la fin précède le début est refusée | retirer la comparaison des deux bornes |
| La barre de tête garde sa hauteur et le jeton tient dedans | laisser le jeton grandir la barre |
| Le seuil de retournement est celui de la règle des rafales | recopier le nombre au lieu de le reprendre |
| Un jeton pris se retire aussi depuis un écran qui n'est pas l'accueil | ne poser le jeton que sur l'accueil |
| Une fenêtre ramenée sur la pluie fait reparaître le jeton | ne pas refaire l'écran quand un réglage change la barre de tête |
| La recette du raccourci se donne étape par étape | vider la recette |

Deux contrôles ont été refaits parce que la faute qu'ils gardaient ne les faisait pas tomber. « Le jeton garde sa place sur les cinq écrans » mesurait une position que le rendu ne recalculait pas : il est doublé d'un contrôle qui prend le jeton depuis un autre écran et vérifie qu'il s'y retire. Et le repli des lignes d'agenda ne se déclenchait sur aucun nom de commune de France, le plus long tenant sous le compte : il est éprouvé sur un nom assez long pour l'atteindre, et le fichier replié doit se déplier sur son texte de départ.

Les douze fautes du lot 2 sont consignées dans `essais/epreuve-lot2.sh`.

| Contrôle du lot 2, éprouvé | Faute rétablie |
|---|---|
| L'encart reste lisible sur un plafond de plein jour | retirer sa matière |
| Il est posé au-dessus de la ligne de date et du grand chiffre | le poser sous la ligne de date |
| Le biais reste borné des deux côtés | retirer la borne |
| Un degré de trop chaud allège la tenue d'un cran | ne plus passer le biais à la réponse |
| Il ne déplace aucun des degrés écrits | déplacer les degrés en même temps que la tenue |
| Une journée sans rien à décider ne fait paraître aucun encart | parler même sans changement de tenue |
| L'aération se tait quand l'intérieur ne va pas se réchauffer | retirer la réserve |
| Des scénarios accordés ne se disent pas | écrire la confiance à chaque fois |
| Des scénarios partagés se disent | ne jamais l'écrire |
| Sans objet à prendre, l'encart n'a qu'une ligne | lui faire porter un objet inexistant |
| L'encart porte l'objet, puis la tenue, dans cet ordre | retirer l'objet de l'encart |
| Chaque ligne mène là où elle appartient | une seule destination pour les deux |
| Un jeton pris quitte aussi l'encart | laisser l'objet après la prise |
| Le verre reste dans la couche navigation et son exception | l'étendre aux cartes |
| Une journée qui se rafraîchit se dit dans l'ordre du temps | ordonner du plus froid au plus chaud |

Les dix fautes du lot 3 sont consignées dans `essais/epreuve-lot3.sh`.

| Contrôle du lot 3, éprouvé | Faute rétablie |
|---|---|
| Sans créneau favorable, chaque activité le dit et ne propose rien | rendre le premier créneau à défaut |
| Un sol qui a beaucoup évaporé demande un arrosage | ignorer l'évapotranspiration, suivre la pluie seule |
| Une averse de l'après-midi repousse le lavage au delà d'elle | ne pas exiger douze heures sèches ensuite |
| Les créneaux d'effort restent dans les heures où l'on sort | retirer la borne des heures |
| L'aération se tait quand l'intérieur ne va pas se réchauffer | rendre à la réponse du matin sa propre règle |
| L'évapotranspiration est demandée en horaire et en quotidien | ne plus la demander |
| La signature des colonnes entre dans la clé du cache | l'en retirer |
| L'accueil porte la porte des questions sous les mesures du jour | la poser au-dessus |
| Chaque activité dit pourquoi elle n'a pas de créneau | fondre les raisons en une seule |
| Sous la pluie, l'arrosage dit que la pluie s'en charge | lui faire dire qu'il n'y a aucun créneau |

Un contrôle a été retiré, ne pouvant pas tomber. Il comparait les heures d'aération dites par le ciel et par la feuille ; la règle étant partagée, les deux se répondaient toujours, et une faute rétablie dans la réponse du matin y donnait par hasard la même heure. Ce sont les contrôles de l'aération, écrits au lot 2, qui prouvent le partage.

Les dix-sept fautes du lot 4 sont consignées dans `essais/epreuve-lot4.sh`.

| Contrôle du lot 4, éprouvé | Faute rétablie |
|---|---|
| Les lieux suivis sont classés du plus beau au moins beau | trier sur la température seule |
| Le point le plus ensoleillé, mais pluvieux, n'est pas en tête | trier sur l'ensoleillement seul, puis retirer la pluie du score |
| À pluie et température égales, le plus ensoleillé passe devant | retirer l'ensoleillement du score |
| Le même ensoleillement vaut plus sur une journée courte | compter l'ensoleillement en heures, non en part de la durée du jour |
| Un écart trop faible laisse le beau temps ici | envoyer au meilleur point quel que soit l'écart |
| La grille tient dans son rayon et porte un seul centre | ne pas la borner |
| Un point nommé garde sa distance et sa direction | dire la distance sans la direction |
| Rouvrir la feuille ne redemande rien à la source | ne rien garder en mémoire |
| La grille montre cinq points, plus celui d'ici | perdre la rangée d'ici hors du haut du classement |
| La grille ne part pas d'elle-même | la lire à l'ouverture de la feuille |
| Seuls les points montrés sont nommés | nommer les soixante-neuf points |
| Le sélecteur de journée change le classement | ne pas le lire |
| Les deux portes se suivent et partagent leur gabarit | glisser un élément entre elles |
| Deux points montrés ne sont jamais voisins | montrer les cinq premiers du classement, voisins ou non |
| La pluie ne s'écrit que s'il en tombe | écrire « 0 mm » sur une journée sèche |
| La rangée d'ici porte le nom du lieu courant | le redemander à l'interface adresse |

L'arbitrage écrit avant le lot, « le classement des lieux respecte le score calculé, éprouvé par la faute trier sur la température seule », s'est révélé insuffisant à lui seul : la charge d'essai fait varier le soleil et la température ensemble, et une faute qui retirait l'ensoleillement du score ne faisait tomber aucun contrôle. C'est une rangée de la grille, dont tous les points partagent la latitude donc la température et la pluie, qui sépare les deux : elle prouve que l'ordre suit bien le soleil.

## Procédure

`node essais/controle.mjs` doit passer en entier avant chaque commit. Le commit est signé `Claude <noreply@anthropic.com>`, le crochet d'arrêt refuse tout autre auteur. `VERSION` de `sw.js` passe à la version suivante à chaque lot, et la coque hors ligne porte tout module nouveau, ce qu'un contrôle vérifie déjà.
