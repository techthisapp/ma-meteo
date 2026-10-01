# Ma météo, feuille de route

Établie le 24 août 2026. Mise à jour le 28 août 2026 sur l'état de publication du même jour, dix commits ayant suivi la rédaction initiale : l'horizon glissant du ruban, le plafond de plein jour, le passé récent gardé dans la fenêtre, la vigilance du lendemain, le jalon 2 achevé, le premier lot du jalon 1, son extension au vent, la pluie comptée, le jalon 1 achevé, et le rappel de parapluie.

## Cadre

Les contraintes qui ont porté l'application jusqu'ici valent pour toute la feuille de route.

| Contrainte | Conséquence |
|---|---|
| Aucun compte, aucun service dorsal | Toute source retenue répond sans clé personnelle ou avec un jeton public d'application |
| Application servie en pages statiques | Tout calcul se fait sur l'appareil |
| Aucun secret dans le dépôt public | Une source qui exige une clé nominative est écartée, quelle que soit sa qualité |
| Design system iOS déjà transposé | Toute destination ou feuille nouvelle s'y conforme, contrôle automatique compris |
| Chaque comportement nouveau porte ses contrôles | `essais/controle.mjs` s'étend à chaque jalon, chaque contrôle est éprouvé en rétablissant la faute qu'il garde |
| Deux toiles animées déjà présentes sur l'accueil | Toute animation nouvelle est arbitrée contre ce coût, et non ajoutée par-dessus |

Trois fonctions restent hors du cadre tant qu'il n'y a pas de service dorsal : les notifications poussées, y compris pour une application installée sur iOS ; tout signalement participatif ; toute synchronisation entre appareils.

## Ordre des jalons

L'ordre suit trois critères : ce qui se sert de la requête déjà émise passe avant ce qui en ajoute une ; ce qui a besoin de temps pour accumuler des données commence tôt même s'il s'affiche tard ; ce qui introduit une dépendance nouvelle passe après ce qui n'en introduit aucune.

| Jalon | Objet | Sources nouvelles | Ampleur |
|---|---|---|---|
| 1 | L'incertitude affichée | Une, hôte d'ensembles | Fait le 26 août 2026 |
| 2 | Le temps continu, hier compris | Aucune, même requête | Faite le 26 août |
| 3 | La réponse utile | Aucune | Lots 1 à 3 faits le 28 août 2026, un lot restant |
| 4 | La carte, les orages compris | Carte de foudre ; fond embarqué, radar en place, pluie dans l'heure en place | Grande, lots 4a et 4b faits du 5 au 7 septembre 2026 |
| 5 | La météo en 3D | Aucune | Grande |
| 6 | La justesse publiée | Aucune, dépend du jalon 1 | Petite |
| 7 | L'air, le pollen, le sol | Une, même hôte | Air et pollens faits le 3 septembre 2026, sol écarté à la mesure |
| 8 | Le climat de la commune | Une, même hôte | Moyenne |
| 9 | Le ciel du soir et la carte du ciel | Catalogue embarqué, deux sources sans clé | Grande |

Les jalons 1 à 3 forment un ensemble cohérent qui peut se publier d'un bloc. Les jalons 4, 5 et 9 sont les trois gros chantiers et ne se mènent pas en parallèle. Les jalons 6 à 8 sont indépendants les uns des autres et se prennent dans l'ordre qui convient. Le jalon 9 dépend d'une décision de navigation prise au jalon 4.

---

## Jalon 1. L'incertitude affichée

**Objet.** Une prévision porte une marge d'erreur, et les modèles ne s'accordent pas toujours. L'application le dit.

**Lot 1, livré le 26 août 2026, commit `9db64ae`.**

1. Enveloppe des scénarios peinte sous la courbe du ruban, deux bandes, l'étendue des quarante membres et la moitié centrale. La phrase de la voie dit ce que l'ombre porte et nomme l'écart le plus large de la fenêtre. Le grand chiffre de l'accueil reste celui du modèle fin, arbitré ainsi : la médiane d'ensemble s'en écarte de un à deux degrés et aurait contredit le ruban et la semaine.
5. Journal de justesse amorcé. Heures visées, six et quinze heures de chaque journée ; paliers d'échéance de six à cent soixante-huit heures ; une note par palier et par heure visée ; relevé posé quand l'heure visée est passée. Rien ne s'affiche.

**Extension du lot 1, livrée le 26 août 2026, commit `e50fc6b`.** L'enveloppe s'étend à la voie du vent, posée sur la rafale. Trois grandeurs encadrées au lieu d'une, la requête passant de dix à vingt-sept kilooctets sur le fil. L'indice ultraviolet n'a aucun scénario du côté de la source, la couverture nuageuse en a une qui remplirait sa voie, et la pluie ne s'encadre pas.

**Lot 2, livré le 26 août 2026, commits `50b2117` et `b13c43d`.**

2. **Fait le 26 août 2026, commit `50b2117`, avec une correction de la consigne.** La prémisse ne tenait pas contre le code : le chiffre affiché n'était pas une valeur déterministe mais `precipitation_probability`, déjà probabiliste. Mesurés sur deux communes et une semaine, le champ de la source et le comptage s'accordent à dix points près sur 92 % des heures, et rien ne dit lequel tombe le plus juste là où ils divergent. La probabilité affichée reste celle de la source ; le comptage sert à dire la quantité, que la source n'exprime pas. Les deux sont notées au journal de justesse, pour que le jalon 6 tranche par la mesure.
3. **Fait.** Chaque journée dépliée de la semaine porte l'accord des scénarios en toutes lettres, avec la fourchette de son maximum. Seuils à trois et six degrés d'étendue moyenne, mesurés sur la source. La fourchette s'écrit aussi sur l'accueil, dans le bloc de la journée qu'elle concerne.
4. **Fait, sans requête nouvelle.** Les trois voix étaient déjà chargées : le modèle global, AROME par-dessus lui sur trois jours, et la médiane des scénarios d'ICON. Seuil à quatre degrés, deux étant l'ordinaire entre deux modèles.

**Le jalon 1 est achevé.** Reste le jalon 6, qui dépend de lui et attend deux mois de journal.

**Sources.** `ensemble-api.open-meteo.com` pour les scénarios, `api.open-meteo.com` avec le paramètre de modèles pour la comparaison. Aucun compte.

**Points d'attention.** La charge d'un ensemble est nettement plus lourde qu'une prévision simple : la requête d'ensemble est réservée à la commune affichée, à une cadence propre, et n'entre pas dans l'aperçu des lieux suivis. La clé du cache porte la nature de la requête, comme elle porte déjà la portée.

Le point 5 ne s'affiche pas mais conditionne le jalon 6 avec deux mois de délai. C'est le seul endroit de la feuille de route où retarder d'une semaine coûte une semaine de plus à l'arrivée : il se livre avec le premier lot, même si tout le reste du jalon glisse.

L'enveloppe des scénarios se peint dans le groupe mobile du ruban, sous les courbes et au-dessus du lavis de nuit, comme l'aire de risque de la voie de pluie. Elle suit donc le glissement sans travail supplémentaire.

**Contrôles.** La fourchette encadre toujours la médiane. Une dispersion nulle n'écrit pas de ligne de désaccord. Le niveau de confiance suit le sens de la dispersion. Le journal de justesse écrit une entrée par échéance et par chargement, sans doublon.

---

## Jalon 2. Le temps continu, hier compris

**Objet.** Le ruban commence la veille et se poursuit dans la prévision, sans rupture de lecture.

**Déjà en place depuis le 24 août.** Le ruban lit les sept jours de la charge, depuis minuit du jour en cours, et sa fenêtre glisse dessus. Le passé de la journée est tracé, en retrait sous un voile à la couleur de la carte. L'heure en cours porte un repère plein sur les sept voies, gainé et nommé par une pastille sur l'axe. La fenêtre calée sur maintenant garde un sixième de fenêtre de passé derrière elle, quatre heures en portrait. L'axe des heures porte ce passé comme le reste.

La lecture continue du passé au futur est donc acquise. Elle s'arrête à minuit du jour en cours, faute d'avoir demandé les journées d'avant.

**Achevé le 26 août 2026, commit `22a7ab4`.**

1. `past_days=2` sur la requête horaire et sur celle d'AROME, sans appel supplémentaire, dix-sept kilooctets au lieu de treize. La portée passée entre dans la clé du cache. Le ruban remonte à avant-hier minuit et son libellé nomme hier et avant-hier, la référence du nom étant devenue le jour de l'heure en cours.
2. La comparaison avec la même heure la veille s'écrit au delà de cinq degrés d'écart, dans le bloc du jour seul. L'indice de la veille se cherche par son horodatage, un recul de vingt-quatre rangs se trompant les deux nuits de changement d'heure.
3. La table de la semaine porte neuf rangées, deux écoulées et sept annoncées, pliables comme les autres et en retrait tant qu'elles sont fermées. Leurs bornes entrent dans l'échelle commune.

Quatre cent trente-quatre contrôles, dont neuf fautes rétablies pour éprouver les gardes nouvelles.

**Sources.** Aucune nouvelle, même requête.

**Points d'attention.** La clé du cache porte le nombre de jours passés demandés, au même titre que les deux horizons déjà présents. Le grand chiffre de l'accueil reste la valeur du moment et ne se déplace pas avec la lecture au doigt du ruban. La butée arrière du glissement, aujourd'hui à minuit du jour en cours, recule d'autant de journées que la requête en porte ; le libellé de fenêtre sait déjà nommer un jour au delà d'après-demain, il n'aura qu'à savoir nommer la veille.

**Contrôles.** Le repère de l'instant courant tombe à la bonne abscisse sur les sept voies, contrôle déjà en place. Aucune règle de faits marquants ne se déclenche sur une heure écoulée. La rangée de la veille s'ouvre sur ses quatre moments comme les autres. Le saut arrière s'arrête au premier jour chargé et non plus à minuit du jour en cours.

---

## Jalon 3. La réponse utile

**Livré en entier le 29 août 2026, commits `83c0c76` à `2fd5aa5`.**

**Objet.** L'application répond à la question posée plutôt que de laisser lire un tableau.

**Contenu.**

1. **Fait le 28 août 2026, commit `e473aae`.** Écran de questions : six activités, chacune avec ses seuils nommés, et un moteur commun qui rend le premier créneau qui convient sur quarante-huit heures. Une feuille ouverte par une rangée posée sous les mesures du jour. Une activité sans créneau le dit et donne sa raison. L'aération n'est écrite qu'une fois, la réponse du matin lisant la même règle.
2. **Fait le 28 août 2026, commit `21983db`.** Réponse du matin : une phrase posée dans le ciel de l'accueil, en matière verre au-dessus de la ligne de date. Elle ne parle pas du parapluie, que le jeton porte déjà sur les cinq écrans, et donne une instruction là où les conseils donnent un fait : l'habillement, tiré des extrêmes de ressenti restants, ou l'aération, tirée de l'écart avec un intérieur ordinaire. La confiance ne s'écrit que lorsque les scénarios sont partagés. Le silence reste l'état par défaut.
3. **Fait le 28 août 2026, commit `e473aae`, avec une correction de l'arbitrage 7.** Le séchage se calcule de l'évapotranspiration horaire et non du déficit de pression de vapeur : mesuré, à déficit égal l'évapotranspiration varie d'un facteur cinquante-sept selon le vent et le soleil. L'arrosage se calcule du bilan d'eau des sept journées écoulées, la pluie tombée moins ce que l'évapotranspiration a repris. Deux colonnes ajoutées, trois cent quarante-huit octets compressés, sans requête nouvelle.
4. **Fait le 29 août 2026, commit `2fd5aa5`.** Où est le beau temps : les lieux suivis se classent par un score dont l'ensoleillement porte l'essentiel, corrigé par la pluie et par l'écart à vingt-deux degrés, sur la journée choisie et en un seul appel multi-coordonnées. Un bouton élargit à une grille de soixante-neuf points espacés de vingt-deux kilomètres dans un rayon de cent kilomètres, lue en un appel de 3,9 kilooctets compressés. Les cinq points montrés sont tenus à quarante-quatre kilomètres les uns des autres, et la rangée du lieu courant reste affichée comme référence.
5. **Fait le 28 août 2026, commit `21983db`.** Ressenti calibré : deux boutons dans une feuille ouverte depuis l'encart déplacent un biais personnel d'un degré, borné à trois. Il déplace la tenue conseillée et non les degrés écrits, lesquels viennent de la source et doivent s'accorder entre écrans au degré. Il reste sur l'appareil et n'entre dans aucune requête.

### Le rappel de parapluie, livré le 28 août 2026

Publié en `83c0c76`. Le détail de ce qui a été construit, avec les trois écarts à la proposition, est dans `claude/consigne-reponse-utile.md`.

Sans service dorsal, aucune notification ne peut être poussée. Quatre mécanismes contournent cette limite, du plus simple au plus engageant. Trois sont livrés, le quatrième ne l'est pas et ne le sera pas sous cette forme.

1. **Le jeton du jour.** Quand de la pluie est attendue dans la période d'alerte en cours, un jeton paraît dans la barre de tête, présent à l'identique sur les cinq écrans, à côté du nom de la commune. Il nomme les heures de la pluie, par exemple de quatorze à seize heures. Un appui ouvre sa feuille, laquelle porte le bouton qui le marque comme pris ; il disparaît aussi de lui-même une fois la pluie passée.
2. **Le bon objet.** Le jeton distingue trois cas selon l'intensité et le vent : parapluie quand la pluie est modérée et le vent faible, capuche quand le vent dépasse le seuil au delà duquel un parapluie se retourne, rien quand la pluie reste sous le seuil de gêne. Un parapluie annoncé par vent de quarante kilomètres par heure est un mauvais conseil.
3. **Le rappel posé dans l'agenda.** Un appui produit un fichier d'agenda au format `text/calendar`, généré sur l'appareil, avec un évènement à l'heure d'alerte de la période et une alarme quinze minutes avant. L'agenda du téléphone s'en charge ensuite, ce qui donne une vraie alerte sans aucun service dorsal. Une variante pose un évènement par période pluvieuse de l'horizon.
4. **L'automatisation.** Non réalisable telle qu'elle était écrite. Un fichier de raccourci iOS est une archive signée par Apple, et un fichier fabriqué sur l'appareil ne s'importe pas ; un lien de partage produit par l'application Raccourcis est personnel et ne se publie pas. La feuille des réglages porte donc la recette, six étapes, pour construire l'automatisation une fois à la main.

Les heures d'alerte sont un réglage, deux instants au pas de la demi-heure, par défaut 7 h 30 et 17 h. Ce sont les moments où l'on veut être prévenu, non les moments où l'on cherche la pluie : chaque alerte répond de la pluie attendue jusqu'à la suivante, la dernière jusqu'à minuit, et celle du matin annonce donc une averse de quatorze heures. De minuit à la première alerte, rien ne s'annonce : on n'y sort pas, et prévenir n'y donne aucune occasion de prendre un parapluie.

La première version, publiée le matin du 28 août, cherchait la pluie à l'intérieur des heures de sortie et ne voyait donc rien d'une averse de quatorze heures pour quelqu'un qui sort à sept heures. Défaut relevé à la livraison, corrigé le jour même en `53fa4cd`.

Le silence reste l'état par défaut : une journée sèche ne produit ni jeton, ni proposition d'agenda.

**Sources.** Aucune nouvelle. Le score de confort et le classement des lieux s'appuient sur l'aperçu déjà demandé.

**Points d'attention.** Les seuils de chaque activité sont des constantes nommées et documentées, non des nombres posés dans le code de la vue, pour que les contrôles les éprouvent. Le biais personnel reste sur l'appareil et n'entre dans aucune requête.

**Contrôles.** Le classement des lieux respecte le score calculé.

Les contrôles de l'écran de questions sont écrits et passent, quatorze en tout : sans créneau favorable chaque activité le dit et donne sa raison, les créneaux d'effort restent dans les heures où l'on sort, une averse repousse le lavage au delà d'elle, et deux contextes ne différant que par l'évapotranspiration donnent deux verdicts d'arrosage contraires sur le même cumul de pluie. Chacun a été éprouvé en rétablissant la faute qu'il garde, dix fautes consignées dans `essais/epreuve-lot3.sh`.

Les contrôles de la réponse du matin et du ressenti calibré sont écrits et passent, dix-neuf en tout : l'encart porte une instruction et non un fait, ne parle pas du parapluie, reste lisible sur un plafond de plein jour, se tait quand il n'y a rien à décider, et le biais déplace la tenue sans déplacer les degrés écrits, borné des deux côtés. Chacun a été éprouvé en rétablissant la faute qu'il garde, douze fautes consignées dans `essais/epreuve-lot2.sh`.

Les contrôles du rappel de parapluie sont écrits et passent, quarante en tout : une journée sèche ne fait paraître aucun jeton, une pluie de l'après-midi est annoncée dès l'alerte du matin, une pluie de nuit ne s'annonce pas, le jeton disparaît une fois la pluie passée et après un appui, le fichier d'agenda est valide et se pose à l'heure d'alerte, un vent au delà du seuil fait écrire capuche et non parapluie. Chacun a été éprouvé en rétablissant la faute qu'il garde, dix-neuf fautes consignées dans `essais/epreuve-lot1.sh`.

---

## Jalon 4. La carte

**Objet.** Voir où il pleut, savoir dans combien de minutes la pluie arrive ici, et lire les grandeurs sur le territoire plutôt que sur un point.

C'est le premier écran cartographique de l'application, et le plus gros chantier de la feuille de route. Il se découpe en trois livraisons.

### 4a. Le fond et le radar

**Fond et repères livrés le 5 septembre 2026, commit `7d164ee`.** Restent la couche radar et la chronologie, en 4a-2.

**Fond dessiné, non chargé en tuiles.** Le parti pris initial était un fond matriciel de la Géoplateforme IGN. La mesure du 5 septembre l'a renversé : une tuile de plan pèse de 42 à 70 kilooctets, une vue de téléphone en demande une douzaine, soit de six cents kilooctets à un mégaoctet par écran et autant à chaque déplacement, quand toute la prévision horaire de l'application en pèse cinq. Les contours embarqués coûtent trente-trois kilooctets une fois pour toutes, se dessinent hors ligne, suivent les deux thèmes et n'imposent aucune mention en surimpression permanente.

| Élément | Choix retenu |
|---|---|
| Géométrie | Quatre couches embarquées dans `src/geographie.js` : contour du pays, limites de départements, côtes d'Europe, frontières d'Europe |
| Sources | Départements d'après ADMIN EXPRESS de l'IGN, côtes et frontières d'après Natural Earth, fabriquées en un fichier par `outils/contours.mjs` et versionnées telles quelles |
| Encodage | Entiers au pas de deux millièmes de degré, différences successives, base 64 |
| Fenêtre | De 7 degrés ouest à 13 degrés est, de 40 à 53 degrés nord |
| Zoom | De 5 à 10, vue bornée à la fenêtre |
| Cadrage d'ouverture | La France entière, calculé d'après la largeur du cadre |
| Projection | Mercator Web, la même que les tuiles radar du lot 4a-2 |
| Rendu | Une toile, couleurs prises dans la feuille de style, donc les deux thèmes sans code de thème |

La séparation du contour national et des limites intérieures se déduit de la géométrie et non d'un fichier séparé : un segment que deux départements partagent est intérieur, un segment vu une seule fois est une côte ou une frontière. Ce qui doublait la France a été retiré de l'Europe, les deux sources ne s'accordant pas au mètre près.

**Repères.** Position et lieux suivis sont des boutons du document, non des dessins sur la toile : un repère se touche, se nomme, s'atteint au clavier et porte sa température, qui arrive de l'appel d'aperçus déjà servi à la feuille des lieux. Un appui bascule la commune, comme une rangée de la liste des lieux. Un repère sorti du cadre est caché plutôt que collé au bord.

**Cadrage d'ouverture, changé le 7 septembre 2026.** La carte montre la France entière. Elle sert d'abord à voir où il pleut, et la réponse est régionale avant d'être locale. Un appui sur l'onglet La carte y ramène, que l'onglet change ou qu'on appuie de nouveau dessus ; le bouton de cible ramène ensuite sur la commune. Le zoom est calculé d'après la largeur du cadre plutôt qu'écrit en dur, les rapports de côtés d'un téléphone en portrait, du même en paysage et d'une tablette étant différents. Le cadrage est gardé dans le contexte de l'application et survit aux rendus.

**Gestes.** Glissement à un doigt, pincement à deux, deux boutons de zoom, un bouton de retour au lieu courant, barre d'échelle graduée en distances rondes. L'écran ne défile pas et occupe tout ce qui reste entre les deux barres, par la classe `ecran-carte`.

### 4a-2. Le radar

**Livré le 5 septembre 2026, commit `51a906f`.**

Les images viennent de RainViewer, sans clé ni compte, et se posent sur le fond dessiné sans transformation, les deux suivant la projection de Mercator.

| Élément | Choix retenu |
|---|---|
| Taille de tuile | 256 points |
| Zoom servi | Jusqu'à sept ; au delà, les tuiles de sept agrandies |
| Chargement à l'ouverture | Une seule image, la dernière observée |
| Schéma de couleur | Celui du service, le seul qu'il rende |
| Options | Lissage et neige montrée |
| Cache | Deux cent soixante tuiles en mémoire, les moins récemment vues partant les premières ; rien dans le cache de l'agent de service, une image expirant en dix minutes |
| Ordre de tracé | Fond, pluie, traits |
| Mention | « Pluie RainViewer » avec lien, exigée par le service |

**Les deux mesures qui ont décidé de la forme**, refaites le 6 septembre sur une vue de téléphone de trois cent quatre-vingt-dix points sur six cent soixante, un jour de pluie sur la France.

1. La taille de tuile. 256 points : en 512, la même vue coûte de deux à trois fois plus, et la couche est une nappe de couleur aux bords déjà lissés, non du texte.
2. Le nombre d'images chargées à l'ouverture. Une seule, la dernière observée. Les douze autres n'arrivent que si la chronologie est mise en marche.

**Ce que coûte une image**, au zoom de tuile borné à sept : quarante-deux kilooctets au zoom huit de la vue, celui de l'ouverture, et jusqu'à cent trente-deux au zoom six, où la vue couvre le quart du pays. La chronologie entière va de cent cinquante kilooctets à un mégaoctet sept selon le zoom et la pluie du moment.

**La borne du service, relevée le 6 septembre après un défaut vu sur téléphone.** Le radar n'est servi que jusqu'au zoom sept : au delà, le service rend une image grise unique portant « Zoom Level Not Supported », la même pour toutes les coordonnées, 1370 octets en 256 points. La carte s'ouvrant au zoom huit, la couche n'a rien montré de la journée qu'elle a passée en ligne.

La mesure de la veille ne l'avait pas vu parce qu'elle relevait le poids et non le contenu : douze tuiles de refus font seize kilooctets, ce qui ressemble à une vue de pluie faible. Deux tuiles éloignées le disent d'un coup, elles sont identiques à l'octet près au delà de sept.

Le zoom de tuile s'arrête donc à sept et la carte garde le sien, qui va jusqu'à dix, ses contours étant embarqués. Au delà de sept, la couche pose les tuiles de sept agrandies, quatre de cinq cent douze points à l'écran au zoom huit, deux de deux mille quarante-huit au zoom dix. Une vue de près coûte alors moins qu'une vue de loin, l'inverse d'une carte ordinaire.

**La chronologie.** Elle est une commande de transport, non une lecture au doigt comme celle du ruban : on y choisit un instant, on n'y lit pas une valeur. Une piste plutôt que treize boutons, treize cibles sur trois cents points faisant vingt-deux points chacune, la moitié de ce qu'un doigt vise. Elle porte un bouton de lecture, une graduation par image, l'heure de l'image montrée, et se conduit aussi aux flèches du clavier. Elle ne se met pas en marche seule, et la lecture attend que l'image suivante soit entière avant de la montrer.

**L'interrupteur de la couche.** Un bouton dans la colonne des commandes, allumé au départ, gardé d'une visite à l'autre. Éteinte, la couche ne charge rien, ni index ni tuile.

**La gaine des traits.** Les couleurs de trait de la carte étaient réglées sur son fond, lequel est connu ; une couche posée dessus ne l'est pas, et une limite de département gris clair disparaît sous une averse pâle. Les traits portent désormais un trait plus large de la couleur du fond glissé dessous, qui ne se paie que quand une couche est là.

**Point ouvert, l'extrapolation.** Le champ `nowcast` de l'index est vide à tous les relevés : les 5, 6, 7 et 8 septembre, puis le 9 septembre à 22 h 51 UTC, cinquième relevé, le champ satellite étant vide lui aussi. La documentation du service l'annonce pourtant dans l'offre publique. La couche ne l'invente pas : la chronologie s'arrête à la dernière observation quand il n'y a rien après, et porte les images prévues quand il y en a, marquées d'un creux sur la tête de piste et d'une couleur sur l'heure écrite. Le lot 4b ne l'attend plus, la pluie dans l'heure venant de Météo-France et le sens d'arrivée se mesurant entre deux images observées. Cinq relevés vides valent une réponse : ce champ ne sera pas repris tant que le service ne le servira pas de lui-même.

### 4b. La pluie qui arrive ici

**Lot 4b-1 livré le 6 septembre 2026, commit `fc7c624`.**

**Changement de source, décidé à la mesure.** Le compte à rebours devait lire les pixels des tuiles extrapolées de RainViewer. Le champ `nowcast` de l'index était vide aux trois relevés des 5 et 6 septembre, à deux heures puis à un jour d'intervalle, alors que le service l'annonce dans son offre publique ; le champ satellite l'était aussi. Une fonction ne se bâtit pas sur ce qu'une source ne sert pas.

| Élément | Choix retenu |
|---|---|
| Source | Produit « pluie dans l'heure » de Météo-France, `webservice.meteofrance.com/v3/nowcast/rain` |
| Jeton | Celui du service, déjà en place pour la vigilance, désormais écrit à un seul endroit |
| Poids | 1163 octets par lecture, mesuré le 6 septembre |
| Étendue | Neuf échéances sur l'heure, pas de cinq minutes sur la première demi-heure puis de dix |
| Cadence | Le produit se refait toutes les cinq minutes, la lecture se garde trois |
| Valeur | Intensité ordinale de zéro à quatre, jamais une lame d'eau |
| Place | Un panneau d'accueil après la vigilance et avant le bloc du jour |

**Ce qui ne se dit pas.** Le drapeau `rain_product_available` fait foi : mesuré le 6 septembre, Ajaccio, Briançon et Gaillard rendent neuf échéances toutes au sec avec le drapeau à zéro, le radar ne couvrant pas ces reliefs. Le rang zéro veut dire « pas de valeur » et non « temps sec » : la lecture s'arrête au trou plutôt que de le franchir, une averse suivie d'échéances muettes n'ayant pas de fin connue. Une heure entièrement sèche ne se dit pas non plus.

**L'intensité ne s'écrit jamais en millimètres.** Les quantités restent sur la série horaire, qui vient d'un autre modèle et contredirait celle-ci : mesuré à 54 nord et 3 ouest, quatre quarts d'heure totalisant trois dixièmes de millimètre sous une heure annoncée à zéro.

**Place à l'écran, tranchée à la mesure.** Avec une vigilance orange à deux phénomènes, le grand chiffre, le panneau de vigilance et le graphe tiennent dans la première vue ; les quatre mesures du jour passent quatre-vingt-seize points sous la barre d'onglets. Ce sont elles qui cèdent : elles résument une journée, quand les deux panneaux portent des faits qui se démentent dans l'heure.

### 4b-2. Le repli, livré le 7 septembre 2026, commit `a430f31`

Là où le drapeau de disponibilité est à zéro, l'application lit la colonne du quart d'heure d'Open-Meteo. Ajaccio, Briançon et Gaillard rendent neuf échéances toutes au sec avec le drapeau à zéro, parce que le radar ne couvre pas ces reliefs.

| Élément | Choix retenu |
|---|---|
| Source | `api.open-meteo.com`, colonne `minutely_15` de précipitation |
| Poids | 247 octets pour huit pas, 282 pour vingt-quatre, mesuré le 7 septembre |
| Étendue | Cinq pas de quinze minutes, soit l'heure |
| Départ | Seulement là où le drapeau est à zéro, et quand le service reste muet |
| Intensité | La lame d'eau devient le même rang ordinal que celui de Météo-France |
| Arrondi du délai | Quinze minutes, contre cinq pour le radar |

La classification usuelle place la pluie faible en dessous de 2,5 millimètres par heure, la modérée jusqu'à 7,6, la forte au delà. Le seuil d'entrée est celui que l'application emploie déjà sur la série horaire, un dixième de millimètre.

Le repli vient d'un modèle et non d'un radar. Le délai s'arrondit donc au quart d'heure, parce que « dans 25 minutes » lui donnerait une précision qu'il n'a pas.

### 4b-3. Le sens d'arrivée

**Livré le 9 septembre 2026 en `cfd35b6`.** Le déplacement de la masse pluvieuse se mesure entre deux images radar observées, par corrélation croisée sur la tuile de zoom cinq qui contient la commune. Il dit d'où vient la pluie et à quelle allure, jamais quand elle arrive : cette réponse est celle du produit de Météo-France, dans le même panneau. Le repérage des cellules orageuses du lot 4d reprendra ce calcul.

L'alerte se lit à l'ouverture de l'application. Sans service dorsal, elle ne peut pas être poussée, ce qui reste hors du cadre.

### 4c. Les couches

| Couche | Origine | Rendu |
|---|---|---|
| Précipitation radar | RainViewer, observé et extrapolé | Tuiles matricielles |
| Nuages par satellite | EUMETView, imagerie MTG, infrarouge 10,5 | Livrée le 19 septembre 2026, commit `c0d5fa8`. RainViewer reste écarté, son champ `satellite.infrared` étant vide à six relevés |
| Vigilance en vigueur | Bulletin national de Météo-France, un appel pour tous les départements | Départements teintés, livré le 7 septembre 2026 |
| Vent | Grille de 380 points Open-Meteo, déjà chargée avec la température | Particules animées sur toile, livrées le 7 septembre 2026 |
| Température | Grille de 380 points, un seul appel | Nappe interpolée sur toile, rampe partagée avec le ruban, livrée le 7 septembre 2026 |
| Indice ultraviolet | Même grille, colonne de journée | Nappe interpolée, rampe partagée. Rampe du violet au fuchsia livrée le 12 septembre 2026, commit `f8d7c5a`, contraste repris le 13, commit `8cb7e9c` |
| Qualité de l'air | Analyses de Copernicus, mêmes 380 points, un appel | Nappe interpolée, livrée le 10 septembre 2026. La nappe reste sur Copernicus ; l'indice officiel s'ajoute sur la commune, voir ci-dessous |
| Pollens | Mêmes points, même appel | À voir : six taxons, et le profil d'allergies désigne le bon ; une nappe par taxon multiplierait les entrées du sélecteur |
| Cellules orageuses | Déduites des images radar déjà chargées | Écartée à la mesure le 10 septembre 2026, voir 4d |
| Foudre | EUMETView, imageur de foudre du Meteosat de troisième génération, cumul de surface d'éclairs par 5 minutes | Livrée le 12 septembre 2026, commit `de71acc`, voir 4d |

**La couche de vigilance, livrée le 7 septembre 2026 en `63ef37f`.** Elle ne coûte aucun compte nouveau : le service qui porte déjà la vigilance de l'accueil rend, sur une autre route, le niveau de tous les sous-domaines en un seul appel, 1181 octets compressés pour 201 sous-domaines. Les contours sont passés en topologie d'arcs pour que la teinte d'un département vienne des mêmes points que ses traits.

**La qualité de l'air, écart mesuré les 10 et 14 septembre 2026.** Le premier relevé faisait croire à un désaccord de source ; la mesure l'a démenti et a désigné une autre cause.

Sur soixante communes tirées au sort le 14 septembre, l'indice officiel d'Atmo France et celui de Copernicus tombent dans la même classe neuf fois sur dix, écart moyen d'un dixième de classe. Les cartes diffèrent pourtant beaucoup, parce que les deux indices ne se composent pas de la même façon : l'indice ATMO retient le pire de ses sous-indices, l'indice européen fait autrement. Ce jour-là, Saint-Étienne était classée mauvaise par l'officiel avec un indice européen de 27, plus bas que celui de Paris classé moyen. C'est une définition d'indice qui diffère, non un modèle qui se tromperait.

Le service d'Atmo France, relevé le même jour : couche `ind:ind_atmo` sur `data.atmo-france.org`, sans clé, licence ODbL, origine rendue quand la requête la déclare, indice par commune publié chaque jour vers quatorze heures. La couche porte un point par zone en projection Mercator, non son contour : la recherche se fait par proximité, ce qui évite d'embarquer un référentiel de codes INSEE. Coût mesuré sur trois communes : vingt à vingt-huit secondes par requête, avec des 503 et des 504 par moments, contre une fraction de seconde pour Copernicus. D'où la forme retenue, livrée le 16 septembre 2026 au commit `82f96aa` : la nappe de la carte reste sur Copernicus, et l'indice officiel avec ses cinq sous-indices s'ajoute sur l'écran de la commune, chargé après l'affichage. La zone rendue n'étant pas toujours la commune demandée, à Avignon c'est l'agglomération, le nom affiché est celui que la source donne, avec la distance dès qu'elle dépasse deux kilomètres.

La nappe de la carte a basculé le 20 septembre 2026, commit `93fb616`. Ce qui écartait cette source était son poids et sa lenteur ; le même service la sert en tuiles sous `ind:ind_atmo_tile`, 21 kilooctets et 1,4 seconde pour la tuile de la France au zoom cinq, contre 90 secondes et un échec pour la couche principale qui n'est pas tuilée. Copernicus interpolé reste dessous et couvre l'Europe, l'indice officiel s'arrêtant aux frontières. La date est indispensable : sans elle le service rend son pas par défaut, à deux jours dans le futur et moins couvrant, 2868 points peints contre 5027 pour le jour même.

**Le premier relevé, pour mémoire.** Deux captures prises à 13 h 10 sur le même téléphone : la nappe de Ma météo est verte d'un bout à l'autre de la France, celle de l'application Météo d'Apple, sur l'indice ATMO, est jaune sur toute la vallée du Rhône et rouge à Avignon, Lyon et Saint-Étienne. L'heure n'explique rien : le maximum du jour selon Copernicus vaut 35 à Avignon, « moyen », à 16 h, quand Apple y écrit « mauvaise ». C'est un désaccord de source. L'indice ATMO est produit par les associations agréées de chaque région, sur des modèles fins qui assimilent leurs stations ; Copernicus est un modèle européen à dix kilomètres. À faire avant de décider : une mesure sur plusieurs jours de la nappe contre l'indice ATMO officiel par commune, puis le choix de la source. Piste à vérifier : les associations publient leur indice par commune sur des services géographiques ouverts, et Atmo France agrège l'ensemble ; l'accès sans clé et l'origine ouverte sont à relever.

**Points d'attention.**

- Bibliothèque cartographique : aucune, tranché le 5 septembre. Le fond, la projection, les gestes et l'échelle tiennent en trois cents lignes dans `src/carte.js`, et les tuiles radar du lot 4a-2 se posent sur la même projection.
- Consommation de données : la lecture d'une chronologie radar demande une douzaine de tuiles par pas. Le niveau de zoom est borné, les images sont gardées en cache pour la durée de la session, et la lecture automatique s'arrête d'elle-même.
- Hors ligne : le fond se dessine sans réseau depuis le 5 septembre. Les tuiles radar ne sont pas préchargées : la couche annonce qu'elle a besoin du réseau, la carte reste lisible sans elle.
- Largeur : depuis le 24 août, un écran de graphique n'est plus bridé à la largeur de lecture de six cent quarante points, l'écran du ruban portant `ecran-large`. Une carte relève du même traitement, et le mécanisme est déjà en place.

### 4c-2. Les feux de forêt

Demandé le 18 septembre 2026, livré le 20 au commit `709d492`. Source reconnue le 18 : le service de cartes du système européen d'information sur les feux de forêt, sur `maps.effis.emergency.copernicus.eu`, couche `viirs.hs`, les foyers actifs vus par les instruments VIIRS des satellites en orbite polaire.

| Point | Mesure du 18 septembre 2026 |
|---|---|
| Clé, compte | Aucun |
| Origine | `access-control-allow-origin: *` |
| Projection | Mercator acceptée, la tuile se pose comme celles du radar et de la foudre |
| Poids | Une tuile de la France au zoom cinq : 1,2 kilooctet le jour même, 1,8 la veille ; 5 kilooctets pour l'Europe au zoom quatre |
| Garde du service | `cache-control: public, max-age=3600` |
| Dimension de temps | Obligatoire : la valeur par défaut est le 1er janvier 2020, et une tuile demandée sans date rend une image vide. C'est ce qui fait croire, au premier essai, que la couche ne sert rien |
| Couverture du jour | Des foyers en France et en Ibérie le 18 septembre, 198 et 83 points peints au zoom cinq ; la veille en porte deux fois plus, les satellites ne passant que deux fois par jour |
| Interrogation ponctuelle | `GetFeatureInfo` rend une exception : le détail d'un foyer, heure et puissance, n'est pas accessible par cette voie. À chercher ailleurs si le besoin s'en fait sentir |

Les trois points ont été tranchés le 20 septembre, à la mesure.

1. **La fenêtre est de deux jours.** Mesuré sur la tuile de la France : 455 points pour le jour même, 1334 avec la veille, 1656 avec l'avant-veille, puis moins de dix pour cent par jour ajouté. Deux jours font quatre passages de satellite, c'est le pas où la couverture triple, et au delà la couche montrerait des foyers déjà éteints.
2. **La place.** Cinquième superposition, éteinte au départ, la saison des incendies ne durant qu'une partie de l'année. Elle se pose par-dessus tout le reste, quelques points par département se perdant sous une averse.
3. **Le nom ne promet pas d'incendie.** La tuile dit « Feux », la légende dit « Foyers vus par satellite, 48 h », et une garde vérifie que cette promesse ne grossit pas.

Le même service sert aussi l'indice forêt météo et ses composantes, qui décrivent le danger plutôt que le feu. C'est une autre couche, à ne pas confondre, et hors de cette demande.

La couche `mtg_fd:frp` du service d'EUMETSAT, déjà en place pour la foudre, mesure la puissance radiative des feux vue du satellite géostationnaire. Elle a été écartée à la mesure le 18 septembre : aucun pixel sur la France au dernier pas publié, la résolution du géostationnaire ne voyant que les feux de grande ampleur.

### 4d. Les orages

Trois voies mènent aux impacts de foudre, comme trois voies menaient à la vigilance.

| Voie | Verdict |
|---|---|
| Serveurs de diffusion en direct de Blitzortung, appelés depuis l'application | Exclu. Vérifié le 10 septembre 2026 : la page publique ouvre une WebSocket vers `ws1` à `ws8.blitzortung.org` avec une clé fixe et décode un flux fait pour n'être lu que par elle. La politique d'usage le réserve au privé et impose à une application tierce de servir ses clients depuis ses propres serveurs |
| Carte publique de Blitzortung en cadre inclus | Abandonné le 10 septembre 2026 au profit de la source satellite. L'image de fond que la page régénère chaque minute est en région fixe, hors Mercator, sans origine ouverte : elle ne se pose pas sur la carte. Le cadre inclus aurait apporté une page entière, ses cookies et ses publicités, dans une feuille |
| Imageur de foudre du Meteosat de troisième génération, sur le WMS public d'EUMETView | **Retenu le 10 septembre 2026.** Voir ci-dessous |
| Indicateurs de prévision et cellules radar | Les deux écartés à la mesure, le 10 septembre 2026. Voir ci-dessous |
| Relais propre | N'est plus nécessaire à l'affichage de la foudre. Reste la seule voie des notifications poussées |

Ce que l'application calcule elle-même, sans dépendre du réseau de foudre :

1. **Risque d'orage par heure depuis l'énergie convective : écarté à la mesure, le 10 septembre 2026.** Voir ci-dessous.
2. **Repérage des cellules orageuses dans les images radar : écarté à la mesure, le 10 septembre 2026.** Voir ci-dessous.
3. Renvoi vers la vigilance orage de Météo-France, déjà en place, qui reste la référence en matière d'alerte.

**La foudre par satellite, livrée le 12 septembre 2026 au commit `de71acc`.** EUMETSAT sert sur EUMETView, à `view.eumetsat.int/geoserver/ows`, la couche `mtg_fd:li_afa` : la surface cumulée des éclairs vus par l'imageur de foudre du Meteosat de troisième génération, comptée par pixel de deux kilomètres et par cinq minutes. Relevé à 18 h le 10 septembre :

| Point | Mesure |
|---|---|
| Clé, compte | Aucun ; le service déclare `Fees: none` et `AccessConstraints: none` |
| Origine | `access-control-allow-origin: *`, la toile ne se souille pas |
| Projection | Mercator acceptée en `crs=EPSG:3857`, la tuile se pose sur la carte comme celles du radar |
| Pas | Cinq minutes, historique continu depuis le 30 mai 2025 : une chronologie est possible |
| Retard | Onze à quinze minutes derrière l'heure courante |
| Poids | 3 à 4 kilooctets par tuile de 256 points |
| Cumul | La plage `time=début/fin` ne cumule pas : elle rend le premier pas de la plage, vérifié le 11 septembre. Le cumul se fait dans l'application, en posant les pas l'un sur l'autre |
| Légende | Éclairs par pixel et par cinq minutes, de 1 à 20 et plus, du jaune pâle au rouge sombre |
| Pas non publié | Le service rend un XML d'exception en HTTP 200, non une image : à traiter comme une tuile absente |
| Mention | EUMETSAT, à porter avec la couche comme RainViewer l'est avec la pluie |

À 18 h 05, la carte de Blitzortung et la foudre satellite montraient les mêmes orages aux mêmes endroits : côte ligure, nord de l'Adriatique, Tyrrhénienne et Italie centrale, Pouilles, Maghreb. Le satellite voit l'émission optique au sommet du nuage, éclairs intra-nuage compris, donc une tache plus large que les impacts au sol ; pour dire où l'orage est, les deux se valent.

Ce même service porte l'imagerie MTG, infrarouge, visible et couleurs vraies, que l'index de RainViewer ne publie plus : c'est la voie de la couche de nuages du lot 4c.

**Les cellules radar, écartées à la mesure.** La palette du radar se lit en quatre niveaux, du bleu au rouge, la neige se reconnaissant à ses beiges semi-transparents. Trois choses ont été mesurées le 10 septembre sur l'Europe de l'ouest, la foudre observée par satellite servant de vérité.

| Niveau radar | Pixels touchés par la foudre à un pixel près |
|---|---|
| Sec | 0,4 % |
| Pluie faible | 9,9 % |
| Pluie modérée | 4,4 % |
| Pluie forte | 13,1 % |
| Pluie très forte | 20,4 % |

Un pixel radar très intense n'a de foudre à côté qu'une fois sur cinq, et 54 % des pixels de foudre tombent là où le radar ne montre aucune pluie. Le repérage de cellules est un mauvais détecteur d'orages ; la couche de foudre le remplace.

Le suivi d'une cellule par corrélation locale marche pourtant, au zoom sept, sur cent vingt pixels de fenêtre et dix minutes d'écart : sept kilomètres par heure de bruit entre deux mesures de la même cellule, pour quarante et un de vitesse, et dix-huit d'écart au déplacement d'ensemble. Le calcul coûte 1,4 milliseconde par cellule. Ce résultat est consigné pour mémoire : il ne détecte pas les orages, et la couche de pluie montre déjà les noyaux intenses par leur couleur.

**L'énergie convective, écartée à la mesure.** La source rend `cape` sur tous les modèles, et `convective_inhibition` et `lightning_potential` sur ICON à deux kilomètres. Trois mesures ont été faites avant d'écrire une ligne de code.

*La couverture.* Le domaine ICON à deux kilomètres ne couvre pas la France entière : sur quatorze villes interrogées le 10 septembre, Brest, Nantes, Marseille, Perpignan et Ajaccio sont hors domaine. AROME et ARPEGE ne rendent que `cape`, sans inhibition ni potentiel de foudre.

*Le pouvoir de séparation de l'énergie convective.* Sur 16 632 heures de prévision, quatre-vingt-dix-neuf points d'Europe et sept jours, 84 heures portent un code d'orage.

| Seuil d'énergie convective | Part des orages retenus | Part des heures retenues qui sont orageuses | Part de toutes les heures retenues |
|---|---|---|---|
| 50 J/kg | 0,80 | 0,014 | 0,284 |
| 200 J/kg | 0,69 | 0,019 | 0,186 |
| 600 J/kg | 0,52 | 0,023 | 0,116 |
| 1000 J/kg | 0,21 | 0,014 | 0,080 |

Au meilleur seuil, une ligne de risque parlerait sur une heure sur neuf et se tromperait dans quatre-vingt-dix-huit cas sur cent. Une règle de cette qualité cesserait d'être lue en une semaine, ce que la feuille de route dit ailleurs du silence par défaut.

*L'énergie convective ne gradue pas non plus la force d'un orage.* Sur 155 heures orageuses de 195 points d'Europe, le tiers le plus énergique porte une pluie médiane de 1,1 mm et un neuvième décile de 3,9, contre 1,4 et 8,1 pour le tiers le moins énergique. La rafale médiane monte de 18 à 27 kilomètres par heure, ce qui est le seul lien mesurable et reste faible.

*Le potentiel de foudre d'ICON ne dit rien de plus que le code.* Sur 4320 heures dans son domaine, il n'est non nul que sur deux heures pour mille ; quand il l'est, le code annonce un orage neuf fois sur dix, mais il manque soixante-douze pour cent des orages codés. C'est le verdict du modèle sous une autre forme, non une information de plus.

Le code de temps sensible porte déjà le verdict d'orage du modèle, et l'application l'écrit en première ligne de ce qui est à savoir, avec la gravité la plus haute. Rien de ce que la source rend en plus ne l'améliore. Le point est clos : c'est le second de la feuille de route écarté par la mesure, après la température et l'humidité du sol au jalon 7.

L'archive ne permet pas de refaire cette mesure sur une saison d'orages : ERA5 ne publie pas d'énergie convective par cette route, et ses codes de temps ne portent aucun code d'orage, faute de variable de foudre. La mesure a donc été faite sur la prévision, ce qui compare le modèle à lui-même. Depuis le 10 septembre, la foudre observée par satellite est accessible avec son historique depuis mai 2025 : cette mesure peut se refaire contre des observations, ce qui n'est pas prévu tant que rien ne l'attend.

**Note sur le relais.** Le relais n'est plus nécessaire à la foudre. Il reste la seule voie des notifications poussées de pluie, de foudre et de vigilance, et du signalement participatif. La décision de franchir ce pas est indépendante du reste.

**Place dans la navigation, tranchée le 3 septembre 2026, faite le 5 septembre en `9b15d54`.** La barre d'onglets portait cinq destinations, ce qui est le maximum du design system. Le soleil et La lune tiennent désormais une destination unique nommée Le ciel, ce qui libère la place de La carte. La barre en porte quatre en attendant : le design system en autorise cinq, il n'en exige pas cinq.

La destination Le ciel porte trois écrans, choisis par un sélecteur en tête, sur le motif qui sert déjà à l'écran Le temps entre le ruban et la liste.

| Écran | Contenu | État |
|---|---|---|
| Le soleil | Course du jour, crépuscules, ruban de clarté | Livré, ouvre la destination |
| La lune | Phase, course, prochaines phases | Livré |
| Les étoiles | La carte du ciel du jalon 9a, et ce qui se voit ce soir | À faire |

Le choix se garde comme l'écriture de l'écran Le temps : revenir sur Le ciel rend l'écran qu'on regardait. Deux segments et non trois tant que les étoiles n'existent pas : un segment qui ne mènerait nulle part serait une promesse que l'application ne tient pas.

La fusion a coûté peu, comme prévu : les deux écrans étaient déjà des jumeaux, même panneau de ciel, même grand chiffre, même sous-ligne à vignette, mêmes rangées d'évènement. Chacun rend maintenant son ciel et son contenu séparément, et la destination les assemble autour du sélecteur.

Le sélecteur se pose en tête du contenu, sous le ciel, et non sur la ligne du titre comme celui de l'écran Le temps : ces deux écrans portent leur titre peint dans le ciel et non dans la coque.

Elle s'est faite une fois pour deux besoins, la carte et les étoiles, plutôt qu'une restructuration de navigation à chaque jalon. Elle constituait le premier lot du jalon 4 ; il reste 4b-3, le reste de 4c et 4d.

**Le panneau des couches, posé le 7 septembre 2026 avec la nappe de température.** Les interrupteurs empilés dans la colonne des commandes ne tenaient pas au delà de deux couches. Un bouton ouvre la liste : la nappe s'y choisit, exclusive, et la vigilance s'y coche à part. Les trois nappes de couleur ne se superposent pas, deux étalements sur toute la surface ne se lisant ni l'un ni l'autre.

**Contrôles du lot 4b-2, écrits et passants, cinq en tout.** Sans couverture radar le repli prend le relais, avec couverture il ne part pas, il annonce au pas du quart d'heure, son graphe porte ses cinq pas, et sa lame d'eau devient un rang d'intensité. Chacun a été éprouvé en rétablissant la faute qu'il garde. La garde de l'arrondi emploie une horloge décalée de sept minutes hors de la grille du quart d'heure : sur une horloge posée sur la grille, les deux arrondis donnent le même chiffre.

**Contrôles du lot 4b-1, écrits et passants, quinze en tout.** Une heure entièrement sèche ne dit rien, une pluie qui commence se dit avec son délai et la force de tout son épisode, une pluie en cours se dit par sa fin, une pluie sans accalmie ne s'invente pas de fin, une échéance sans valeur n'invente ni début ni fin, une lecture non couverte ne conclut rien quelles que soient ses valeurs, le délai s'arrondit au pas de la source, le panneau vient après la vigilance et avant le bloc du jour, la vigilance et le panneau tiennent avec le grand chiffre dans la première vue, le graphe pose chaque échéance à son heure et non à son rang, seules les échéances mouillées portent la couleur de l'eau, le graphe se lit sans le voir, un lieu déjà lu ne redemande pas le produit, le jeton du service est écrit à un seul endroit, et un produit muet ne prive pas l'écran de son temps qu'il fait. Chacun a été éprouvé en rétablissant la faute qu'il garde, quinze fautes consignées dans `essais/epreuve-pluieproche.sh`.

Trois de ces gardes ont été repointées faute de tomber sous leur faute. Celle du drapeau de disponibilité et celle du cache se lisent sur la fonction et non sur l'écran : un produit indisponible rend du temps sec, l'encart se tait sur une heure sèche, et le produit ne se demande qu'au chargement de la prévision, non à chaque écran. Celle de l'arrondi se lit aussi sur la fonction, les échéances de la charge tombant sur le pas de cinq minutes de l'horloge figée.

**Contrôles du lot 4a-2, écrits et passants, dix-huit en tout.** La pluie se pose sous les traits et non dessus, un trait posé sur la couche garde son écart de clarté, la chronologie porte les images du service, la carte s'ouvre sur la dernière image observée, une image extrapolée se distingue d'une observation, la chronologie ne se met pas en marche seule, la lecture avance d'image en image et s'arrête au second appui, le doigt sur la piste change l'image montrée, la mention du service paraît avec la couche et disparaît avec elle, l'ouverture ne charge qu'une image, les tuiles se demandent en 256 points, sans image extrapolée la chronologie s'arrête à maintenant, une tuile déjà chargée ne se redemande pas, la couche éteinte ne demande rien au service et cache la chronologie, le choix de la couche se garde, et sans réseau la pluie le dit pendant que la carte reste dessinée. Deux s'ajoutent après le défaut du 6 septembre : aucune tuile n'est demandée au delà du zoom que le service sert, et la couche couvre encore la carte au zoom le plus fort, les tuiles doublant de côté à chaque cran au delà de la borne. Chacun a été éprouvé en rétablissant la faute qu'il garde, dix-sept fautes consignées dans `essais/epreuve-pluie.sh`.

**Contrôles du lot 4a, écrits et passants, dix-neuf en tout.** Quatre viennent du 7 septembre : la carte s'ouvre sur la France entière, un appui sur l'onglet y ramène le cadrage, le cadrage tient à travers un changement de commune, et un repère près du bord droit porte son nom à gauche. La carte est peinte sur sa toile et non laissée unie, son écran ne défile pas, elle s'ouvre centrée sur le lieu courant, chaque lieu suivi porte son repère, un cran de zoom double l'écartement des lieux à l'écran, un repère sorti du cadre est caché, l'échelle écrite reste une longueur ronde, le zoom reste entre ses bornes, la projection et son inverse se répondent, le doigt déplace la carte, le bouton de retour la ramène sur le lieu courant, un appui sur un repère bascule la commune, et les contours se décodent en tenant dans leur fenêtre. Onze d'entre eux ont été éprouvés en rétablissant la faute qu'ils gardent, consignées dans `essais/epreuve-carte.sh`.

**Contrôles à venir.** La chronologie couvre l'intervalle annoncé sans trou. Le compte à rebours de pluie s'accorde avec la lame d'eau prévue par la source à la même échéance. Une position sans écho radar n'annonce rien plutôt qu'un zéro. La couche de vigilance teinte les mêmes départements que le bulletin. Chaque couche s'éteint hors écran et sous mouvement réduit. La couche de foudre demande le pas de temps le plus récent publié et non l'heure courante. Un pas que le service ne sert pas encore laisse la carte sans foudre plutôt qu'avec une image d'erreur. Un ciel sans éclair n'affiche rien. La mention EUMETSAT paraît avec la couche et disparaît avec elle.

---

## Jalon 5. La météo en 3D

**Objet.** Une représentation qui montre les grandeurs essentielles heure par heure dans un seul objet, là où le ruban demande sept voies.

### 5a. Arbitrage

Huit partis pris ont été prototypés en deux pages autonomes, sur le modèle des trois maquettes qui ont déjà servi d'arbitrage avant intégration.

| Parti pris | Ce que porte la géométrie |
|---|---|
| Vase tourné | Hauteur pour les heures, rayon pour la température, émail pour l'humidité et l'UV, stries pour le vent, coulures pour la pluie |
| Spirale d'horloge | Heures en angle sur un cadran de vingt-quatre heures, hauteur pour la température, largeur pour l'humidité, ailettes pour le vent, flaques pour la pluie |
| Collier d'heures | Une perle par heure, diamètre pour la température, opacité pour l'humidité, lueur pour l'UV, filaments pour le vent |
| Paysage traversé | Altitude pour la température, couvert pour l'humidité, végétation couchée pour le vent, rideaux et mares pour la pluie, hauteur du soleil pour l'UV |
| Tunnel | Diamètre pour la température, parois pour l'humidité, puits de lumière pour l'UV, flux de particules pour le vent |
| Mer | Vagues pour le vent, couleur de l'eau pour la température, brume pour l'humidité, impacts pour la pluie, reflets pour l'UV |
| Dunes | Rides du sable pour le vent, couleur pour la température, sable mouillé pour la pluie, voile pour l'humidité |
| Voûte céleste | Heures en azimut, arc du soleil pour l'UV, secteur teinté pour la température, lignes de courant pour le vent, rideaux pour la pluie |

L'arbitrage porte sur trois questions : ce qui se lit en un coup d'œil sur un écran de téléphone tenu à bout de bras ; ce qui reste juste quand la journée est plate, sans pluie et sans vent ; ce qui tient dans le budget d'animation déjà consommé par le ciel de l'accueil.

Un seul parti pris est retenu pour l'intégration. Un second peut être gardé comme variante saisonnière ou comme mode de démonstration, sans écran propre.

### 5b. Intégration

1. La représentation retenue s'installe sur l'écran Le temps, comme troisième écriture à côté du ruban et de la table, et non sur l'accueil. Les moments ont quitté cet écran, ils ferment l'accueil. L'accueil porte déjà deux toiles animées, et le point ouvert numéro sept de l'état de publication demande d'en arbitrer le coût avant d'en ajouter.
2. Les grandeurs viennent des mêmes séries que le ruban, sans requête nouvelle et sans échelle propre : les rampes de température et d'ultraviolet sont celles de `icones.js`, déjà partagées avec la table de la semaine.
3. L'heure lue dans la représentation et l'heure lue dans le ruban sont la même. Le ruban ouvre la sienne par un appui maintenu d'un quart de seconde, le déplacement franc étant réservé au glissement de la fenêtre : la représentation reprend ce partage plutôt que d'inventer un autre geste.
4. Le contrat de `feu.js`, `relief.js` et `temps.js` s'applique : motifs gardés, cadence bornée, arrêt hors écran, arrêt sous `prefers-reduced-motion`.
5. Un repli statique est rendu quand la scène ne peut pas s'animer, image fixe à l'heure courante plutôt qu'écran vide.

**Points d'attention.** La bibliothèque de rendu pèse plusieurs centaines de kilooctets. Elle est chargée à la demande, à l'ouverture de l'écran, et non dans la coquille servie hors ligne. Si le poids ne convient pas, un rendu direct sur toile avec projection calculée dans `astres.js` est possible pour les partis pris qui n'ont pas besoin d'ombres portées.

**Contrôles.** Les valeurs lues dans la scène s'accordent au degré avec le ruban et avec la table de la semaine, au même titre que les sept contrôles de cohérence entre écrans déjà en place. La scène s'arrête hors écran. Le repli statique paraît quand le rendu est indisponible. Une journée sans pluie et sans vent produit une scène lisible et non un objet vide.

---

## Jalon 6. La justesse publiée

**Objet.** L'application publie son propre taux d'erreur.

**Contenu.**

1. Les prévisions écrites en réserve depuis le jalon 1 sont confrontées aux valeurs observées, obtenues par `past_days` sur la même requête, laquelle sert aussi au jalon 2.
2. Un écran de réglages porte l'écart moyen par horizon, à un jour, à trois jours, à sept jours, pour la commune consultée, sur la température et sur la pluie.
3. Le niveau de confiance affiché dans la semaine se cale sur cette mesure locale plutôt que sur la seule dispersion de l'ensemble.
4. La réserve est bornée en volume et en ancienneté, et se vide avec les données de l'application.

**Dépendance.** Ce jalon ne peut pas se livrer moins de deux mois après le point 5 du jalon 1, faute de matière. Il est très peu coûteux une fois la matière accumulée.

**Contrôles.** L'appariement entre une prévision gardée et l'observation correspondante porte sur la même heure et la même commune. Une réserve vide affiche l'absence de mesure et non un zéro. La réserve respecte sa borne de volume.

---

## Jalon 7. L'air, le pollen, le sol

**Livré le 3 septembre 2026, commit `a895077`, à l'exception du point 3 et du point 4.**

**Objet.** Ce qui se respire et ce qui touche le jardin, à partir d'un hôte déjà connu.

**Contenu.**

1. **Fait.** Indice européen, particules, dioxyde d'azote et ozone, dans une feuille ouverte par une troisième porte de l'accueil. Une règle de plus dans ce qui est à savoir au delà du niveau dégradé. L'air entre dans la règle d'aération comme une condition, non comme un choix du meilleur moment : les six activités rendent le premier créneau qui convient, et celle-ci ne va pas se mettre à chercher l'idéal quand les cinq autres ne le font pas.
2. **Fait.** Les six pollens, avec les deux seuils que la source emploie elle-même pour délimiter la saison et le pic. Un profil gardé sur l'appareil filtre ce qui remonte dans les faits marquants ; la feuille, elle, montre tout ce qui est en saison. Seul le pic se dit : une saison dure des semaines, et une ligne quotidienne pendant six semaines ne se lit plus.
3. **Non retenu, sur mesure.** Les colonnes de sol coûtent 694 octets compressés par lecture, 615 sur la requête en sélection automatique et 79 sur celle d'AROME, qui ne les publie pas et rend ses colonnes vides. Deux usages étaient prévus, aucun ne tient à la mesure.

   L'humidité du sol devait décider de l'arrosage à la place du bilan d'eau. Un seuil absolu d'humidité volumique dépend de la texture du sol, laquelle change d'un point de grille à l'autre, quand le bilan d'eau est une différence de deux flux et n'en dépend pas. Le bilan garde donc la décision.

   Une gelée au sol devait compléter la règle de gel de l'air. Relevé sur trois cent soixante-cinq journées à Fain-lès-Moutiers, du 1er septembre 2025 au 31 août 2026 : la couche de sol de zéro à sept centimètres est descendue à zéro degré ou moins dix-neuf fois, l'air est descendu à un degré ou moins quarante-sept fois, et le sol n'a jamais gelé une journée où l'air ne gelait pas. Une règle de gel au sol serait donc une seconde garde pour le même fait. La couche de surface du modèle de prévision, plus froide les nuits claires, n'est pas publiée par l'archive et n'a pas pu être mesurée : c'est elle qui pourrait rouvrir la question.
4. **Reporté.** Pont vers Mon jardin : alerte de gel ciblée par plante, conseil d'arrosage par évapotranspiration, degrés-jours de croissance par culture. Les deux applications sont servies depuis le même domaine et partagent donc leur réserve locale, ce qui rend la lecture des plantes possible ; c'est un couplage entre deux produits, et il mérite sa propre décision.

**Sources.** `air-quality-api.open-meteo.com`, sans compte : un seul appel de 1505 octets compressés porte l'indice, les quatre polluants et les six pollens sur quatre jours.

**Points d'attention.** Le profil d'allergies est une donnée de santé : il reste sur l'appareil, n'entre dans aucune requête, et les six pollens sont demandés à la source quoi qu'il arrive. Le pont vers Mon jardin se conçoit de façon que chaque application reste entière sans l'autre.

**Contrôles.** Dix-huit contrôles, huit fautes rétablies et vues, consignées dans `essais/epreuve-air.sh`.

---

## Jalon 8. Le climat de la commune

**Livré le 10 septembre 2026, commit `1c4a2a3`.**

**Objet.** Replacer la journée dans quatre-vingts ans de relevés au même endroit.

**Contenu.**

1. **Fait.** Percentile du maximum du jour parmi les mêmes dates depuis 1950, écrit en une phrase et en pourcentage.
2. **Fait.** Bandes de réchauffement de la commune, une bande par année, calculées sur l'appareil à partir de l'archive.
3. **Fait.** Comparaison de la saison en cours à la normale 1991 à 2020, sur la température et sur le cumul de pluie.
4. **Fait.** Records locaux pour la date, chaleur et froid, avec leur année.

**Sources.** `archive-api.open-meteo.com`, réanalyse ERA5, sans compte. Deux lectures : l'archive longue de 1950 à la fin de l'année écoulée, 166 418 octets compressés pour 27 759 journées, et la série récente depuis le 1er décembre d'avant, 2003 octets.

**Ce que la mesure a décidé.**

- La lecture part à l'ouverture de la feuille et non au chargement de l'application : cent soixante-six kilooctets sont le prix d'une question qu'on ne pose pas tous les jours.
- La réduction gardée sur l'appareil pèse 12 563 octets par commune, six communes au plus, la moins récemment lue partant la première.
- Le calcul se fait sur le fil principal, contre ce que ce jalon prévoyait : la réduction coûte 68 millisecondes une seule fois, derrière une lecture réseau bien plus longue. Un fil séparé cacherait le plus court des deux.
- La fenêtre de la distribution fait onze jours et non un seul. Le jour exact ne donne que soixante-seize relevés, et un maximum de dix-huit degrés s'y place au vingt-cinquième centile contre le trente-deuxième sur onze jours. La dérive de saison sur cette largeur vaut un dixième de degré par jour.
- Le percentile compare le maximum du modèle à une distribution de réanalyse. Sur soixante journées, le modèle dépasse la réanalyse de 0,26 degré en moyenne, ce qui déplace le percentile de trois points là où quatre-vingts points couvrent onze degrés. L'écart est écrit, non corrigé. Les deux services rendent la même altitude, relevé sur neuf lieux dont Chamonix et Briançon.
- La pluie ne se compare qu'en cumul de saison : au jour près, l'écart entre les deux sources a un écart-type de 5,2 millimètres pour une moyenne de 1,6.
- Une saison ne se dit qu'à partir de trente journées ; en deçà, c'est celle qui vient de finir qui se compare.

**Contrôles.** Quinze contrôles, quinze fautes rétablies et vues, consignées dans `essais/epreuve-climat.sh`. Deux gardes ont dû être repointées, dont celle du percentile, qui demandait au module de juger son propre calcul.

**Reste ouvert.** Éprouver la lecture de cent soixante-six kilooctets sur un réseau de téléphone, et regarder les bandes sur un vrai écran.

---

## Jalon 9. Le ciel du soir et les étoiles

**Objet.** Étendre les deux écrans d'astronomie déjà en place à tout ce qui se voit au-dessus de la commune, et donner à la carte du ciel son écran propre, Les étoiles, troisième de la destination Le ciel.

### 9a. Les étoiles, la carte du ciel

1. Catalogue d'étoiles jusqu'à la magnitude 6, environ cinq mille entrées, embarqué dans le dépôt sous forme compacte. Aucune requête, disponible hors ligne comme le reste de la coquille.
2. Les quatre-vingt-huit constellations, avec leurs figures tracées et leurs noms. Les limites officielles sont une couche facultative.
3. Projection stéréographique centrée sur la direction visée, rendue sur toile selon le contrat commun à `feu.js`, `relief.js` et `temps.js` : cadence bornée, arrêt hors écran, arrêt sous mouvement réduit.
4. Deux façons de viser. Au doigt, par glissement, en toutes circonstances. En pointant l'appareil vers le ciel, l'orientation étant demandée par un bouton explicite, l'autorisation étant obligatoire sur iOS et ne pouvant pas se solliciter au chargement.
5. La Lune est dessinée à sa phase réelle par la réserve de disques de `relief.js`, à la même échelle que la vignette de son écran. Les planètes visibles à l'œil nu viennent des séries de Meeus déjà présentes. Le Soleil sous l'horizon est marqué, ce qui situe le crépuscule en cours.
6. Voie lactée en contour, une centaine d'objets du catalogue Messier, chacun nommé par appui.
7. Curseur de temps qui fait tourner la voûte, du coucher du Soleil au lever, ce qui répond à la question de savoir quand une constellation sera au plus haut.
8. La couverture nuageuse de la nuit se lit sous la carte, en une ligne : à quelle heure le ciel sera dégagé.

### 9b. Ce qui se voit ce soir

1. Passages de la Station spatiale internationale, calculés sur l'appareil à partir des éléments orbitaux publics, avec magnitude, heure, direction d'apparition et de disparition, et trajectoire posée sur la carte du ciel.
2. Pluies d'étoiles filantes, avec le taux horaire attendu, la position du radiant sur la carte, et la gêne lunaire calculée pour la nuit concernée.
3. Indice de qualité du coucher de Soleil, déduit de la couverture nuageuse par étage, que la source de prévision porte déjà.
4. Mention d'aurore boréale les soirs d'activité géomagnétique forte, à partir de l'indice public de la NOAA.
5. Conjonctions et rapprochements notables des jours à venir, calculés à partir des mêmes éphémérides.

**Sources.** Catalogue d'étoiles et tracés de constellations embarqués dans le dépôt, sous licence libre. Éléments orbitaux publics pour la Station. Indice géomagnétique de la NOAA. Le reste est calculé par `astres.js`.

**Dépendance.** La carte du ciel est l'écran Les étoiles, troisième écran de la destination Le ciel créée au premier lot du jalon 4 par la fusion de Le soleil et de La lune. L'arbitrage a été tranché le 3 septembre 2026 : la place est réservée, ce jalon n'a pas de navigation à reprendre.

**Points d'attention.** Le catalogue embarqué pèse quelques dizaines de kilooctets sous forme compacte, ce qui reste compatible avec la coquille servie hors ligne, à condition de ne pas le stocker en JSON verbeux. Les éléments orbitaux se périment en quelques jours : ils se rechargent à cette cadence et le calcul annonce sa marge quand ils sont anciens. L'autorisation d'orientation refusée ou indisponible ne bloque rien, le pilotage au doigt reste entier.

**Contrôles.** La position d'une étoile de référence à une date donnée s'accorde à une éphéméride à la minute d'arc près, sur le modèle des six grandeurs déjà tabulées. Les passages de la Station s'accordent à une référence externe à la minute près. Les figures de constellations sont conformes au jeu de données, sans segment orphelin. La carte se rend sans réseau. Une nuit sans passage visible et sans pluie d'étoiles ne produit pas de section vide. La gêne lunaire suit la phase calculée par l'application.


### 9-bis. Améliorations de l'écran des étoiles, organisées le 21 septembre 2026

Demandées par Jérôme sur une capture de l'écran publié au commit `0a00a8e`, vue vers le nord-est à 85 degrés, à 8 h 18, et réunies avec les trois retouches relevées à la livraison. Cinq lots, dans l'ordre de leurs dépendances.

**Décisions du 21 septembre 2026.** Par défaut, l'écran montre les étoiles les plus visibles. Sous l'horizon, les étoiles se voient à travers l'eau, pâlies et floutées. Hors plein écran, l'écran suit la mise en page du Soleil et de la Lune : le ciel en bandeau dans la partie haute, dessous des informations à définir ensemble. Le plein écran s'ouvre d'un toucher sur le bandeau. Les lots A et B s'en trouvent réunis et réécrits ci-dessous ; les paragraphes qui suivent la décision gardent la version d'origine pour mémoire.

**Lots A et B réunis, version retenue.** Hors plein écran, le ciel occupe un bandeau en haut de l'écran, comme ceux du Soleil et de la Lune, avec la même ligne de titre posée dessus. Le bandeau est fixe : un toucher l'ouvre en plein écran, et c'est en plein écran seulement que le doigt tourne la vue. Ce partage évite qu'un même geste sur le bandeau veuille dire deux choses. Dessous, des sections d'informations, à définir ensemble. Les mentions et les licences passent dans une fenêtre, ouverte par un bouton d'information en plein écran. Les retouches de rendu restent : halo autour des noms, noms tenus dans le cadre, « au zénith » au-delà de 80 degrés.

**Décisions prises le 21 septembre 2026, à la demande de Jérôme.**

1. En plein écran, une étiquette discrète en haut du ciel dit où l'on regarde, « Nord-est, 40° », et « Au zénith » au-delà de 80 degrés. Elle change pendant le glissement. Sans elle, l'orientation se perd dès qu'on lève la vue, les points cardinaux sortant du cadre.
2. Sous le bandeau, trois sections. « Cette nuit » répond à la question qu'on se pose en ouvrant cet écran, voir les étoiles ce soir : les heures de nuit noire, les heures où les nuages s'ouvrent, et la Lune qui éclaire ou non le ciel. « À voir ce soir » donne les constellations et les étoiles les plus hautes à 22 h, avec leur direction. « Étoiles filantes » donne la prochaine pluie et sa date, d'après un calendrier fixe des grands essaims. Les planètes s'y ajouteront avec le lot du temps.
3. La ligne de titre du bandeau suit la grammaire du Soleil et de la Lune : le prochain événement du ciel, « Nuit noire à 21 h 12 » le jour, « Fin de la nuit noire à 5 h 04 » la nuit.
4. Le choix de l'affichage se fait en plein écran, par un sélecteur compact en bas du ciel, et vaut aussi pour le bandeau.
5. La fiche d'une constellation s'ouvre d'un toucher bref en plein écran. Un appui long est moins découvert sur iPhone et entre en conflit avec les gestes du système ; le toucher bref ne gêne rien, le glissement tournant la vue et le toucher sans mouvement désignant. La constellation désignée est celle dont un trait passe au plus près du doigt, puis à défaut celle dont le nom est le plus proche. Les limites officielles ne sont pas nécessaires à cet usage : on touche une figure, non une zone. La fiche porte des faits calculés : les noms français et latin, la hauteur et la direction à l'instant, les heures où elle est visible cette nuit, l'étoile la plus brillante, et le mois où elle culmine à minuit. La figure désignée se détache sur le ciel. Pas de récit mythologique : il demanderait 88 textes à écrire ou à reprendre d'une source protégée.
6. Les noms latins entrent dans le fichier du ciel, qui se régénère une fois pour le choix de l'affichage et pour la fiche.

**Ordre des lots, révisé.** Un : bandeau, plein écran au toucher, étiquette de visée, fenêtre des mentions et retouches de rendu. Deux : choix de l'affichage et régénération du fichier. Trois : les informations sous le bandeau. Quatre : la fiche d'une constellation. Cinq : le ciel sous l'eau. Six : le temps, la Lune et les planètes. La mise en page vient d'abord, tout le reste s'y accrochant ; le fichier ne se régénère qu'une fois ; l'eau change le contrat du module de calcul et vient après ce qui s'en sert.

**Lot A. Le texte en fenêtre, la carte dégagée.** Sous la carte s'empilent trois paragraphes : la direction visée, l'avertissement de jour, les mentions et leurs licences, cette dernière tombant sous la barre de navigation. Ils passent dans une fenêtre ouverte par un bouton d'information posé sur la carte. Restent sur la carte un repère discret de la visée, qui doit se lire pendant le glissement du doigt, et un signe quand il fait jour. Trois retouches de rendu entrent dans ce lot : un halo sombre autour des noms, qui chevauchent aujourd'hui les traits des figures ; des noms tenus à l'intérieur du cadre, « Chevelure de Bérénice » étant coupée au bord sur la capture ; et « au zénith » au lieu d'une direction quand la vue dépasse 80 degrés, une direction ne voulant plus rien dire à la verticale. Ce lot vient en premier parce que le bouton qu'il pose sur la carte doit servir aussi en plein écran.

**Lot B. Le plein écran.** Un bouton sur la carte l'étend à tout l'écran, barre de navigation comprise, un second bouton la referme. Sur iPhone, l'interface de plein écran du navigateur ne s'applique qu'aux vidéos : ce sera donc un calque qui couvre l'application et respecte les bords de l'écran. La toile prend alors les proportions de l'écran et se redessine à chaque rotation.

**Lot C. Ce qui s'affiche.** Un choix en trois positions, gardé d'une visite à l'autre, mesuré le 21 septembre sur le fichier du ciel :

| Choix | Étoiles |
|---|---|
| Toutes | 5070, jusqu'à la magnitude 6, un ciel noir de campagne |
| Les plus visibles | 523, jusqu'à la magnitude 4, ce qu'on voit depuis une ville |
| Les constellations | 749, les étoiles qui portent les figures, avec leurs traits et leurs noms |

Les 750 sommets des figures tombent tous sur une étoile du catalogue à moins d'un dixième de degré, sauf un. Le troisième choix demande de marquer ces 749 étoiles dans le fichier du ciel, qui se régénère. Ce lot règle aussi la densité relevée à la livraison.

**Lot D. Le ciel sous l'horizon, derrière une étendue d'eau.** Le sol opaque cache aujourd'hui tout ce qui est sous l'horizon. Il devient une étendue d'eau à travers laquelle les étoiles et les figures d'en dessous se devinent, pâlies et floutées. Le contrat du module change : il rend aussi les étoiles sous l'horizon, marquées comme telles, et la garde « les étoiles sous l'horizon sont écartées » devient « les étoiles sous l'horizon se peignent sous l'eau ». Point à vérifier avant d'écrire : le flou de la toile par la propriété `filter` n'est pris en charge par Safari que depuis une version récente ; à défaut, les étoiles seront pâlies et élargies, ce qui imite le flou.

**Lot E. Le temps, la Lune et les planètes.** Un curseur pour voir le ciel d'une autre heure de la nuit, la Lune à sa place réelle, et les planètes visibles à l'œil nu. `astres.js` calcule déjà le Soleil et la Lune ; les planètes demandent leurs éléments d'orbite, une précision de l'ordre de la minute d'arc suffisant à une carte. C'est le plus gros des cinq lots.

## Réserve

Ces pistes sont retenues comme possibles mais ne sont pas ordonnées, faute d'un accès confirmé durable ou d'un cadre technique compatible.

| Piste | Blocage |
|---|---|
| Journal des corrélations entre pression et symptômes | Sujet de santé, à ne traiter qu'avec une réserve strictement locale et un propos prudent |
| Ambiance sonore générée depuis les données | Intérêt à confirmer, coût de conception élevé |
| Lecture vocale du bulletin | Se livre à faible coût par la synthèse du navigateur, à rattacher à un travail d'accessibilité d'ensemble |
| Météo du trajet entre deux points | Demande un temps de parcours, donc une source d'itinéraire, à choisir |

## Jalon 10. L'accueil de la journée

Ouvert le 23 septembre 2026, à partir de deux maquettes de l'accueil comparées à l'écran publié. Le but : voir d'un coup d'œil l'évolution de la journée, que l'accueil ne montre pas aujourd'hui, ses tuiles ne donnant que des maximums.

### 10a. Ce qui est retenu des maquettes, et ce qui est écarté

Retenu : la bande horaire glissante, avec pour chaque heure l'icône, le risque de pluie, la température, un trait qui relie les températures, le vent et les rafales ; la barre qui marque la plage de pluie sous la bande ; la phrase qui résume les rafales ou la pluie ; les chiffres du jour sur une seule ligne compacte ; les libellés en colonne à gauche des quatre périodes ; le lien vers le détail.

Écarté : les photos de ciel en fond, qui pèseraient plus que toute l'application et remplaceraient le ciel dessiné ; les illustrations en volume, qui rompent avec les pictogrammes au trait ; la barre de navigation des maquettes, antérieure à « Le ciel » et « La carte ». Les deux maquettes faisaient disparaître « L'air qu'on respire », qui reste.

Relevé dans les maquettes : l'après-midi y affiche un risque de pluie de 100 % quand ses heures montrent 80, 90 et 90 %. Le risque d'une période sera le plus fort de ses heures, pour que la bande et le tableau disent la même chose.

### 10b. Décisions du 23 septembre 2026

1. La bande horaire glisse au-delà des heures visibles.
2. Le ciel dessiné est réduit sur l'accueil seulement.
3. Le tableau des quatre périodes reste entier.
4. Les chiffres du jour tiennent sur une ligne.
5. « Le temps » cesse d'être un onglet et devient une page de détail, ouverte comme une page d'iPhone, avec un retour en haut à gauche.
6. La barre de navigation passe à quatre onglets : Accueil, La semaine, Le ciel, La carte.
7. La validation se fait sur l'application réelle, par captures de jour, de nuit, d'une journée pluvieuse et en grand corps de texte.

### 10c. Lots, dans l'ordre de leurs dépendances

| Lot | Contenu | Dépend de |
|---|---|---|
| 1 | **Livré le 23 septembre 2026, commit `1d1ab3d`.** La bande horaire, sous le ciel : Maintenant puis les heures, icône, risque de pluie dès 20 %, température, trait des températures, vent et rafales sur deux lignes, lever et coucher du Soleil en colonnes étroites à leur minute, barre sous les heures de pluie, phrase de résumé, lien « Plus de détails ». L'avis de vigilance et la pluie dans l'heure restent au-dessus | Rien |
| 2 | **Livré avec le lot 1.** Le ciel réduit sur l'accueil, et les chiffres du jour sur une ligne. Chaque chiffre reste une porte vers sa voie. La pluie se dit en quantité dès un dixième de millimètre, en risque sinon. En grand corps de texte, la ligne repasse sur deux colonnes | Lot 1, pour la hauteur libérée |
| 3 | **Livré le 23 septembre 2026.** La table portait déjà ses libellés en colonne à gauche et le risque d'une période égal au plus fort de ses heures ; l'incohérence relevée venait de la maquette. Le lot a trouvé et corrigé une vraie contradiction : la bande annonçait une pluie de 2 h à 8 h quand « Demain et après-demain » disait de 03 h à 06 h, la bande comptant les heures à fort risque sans quantité. Elle emploie désormais la même fonction de plages que la suite | Rien |
| 4 | **Révisé le 23 septembre 2026, sans changement de code.** Le plan renvoyait les portes en bas de page. Le code porte une décision écrite qui les garde sous les chiffres du jour, pour qu'on les atteigne sans dérouler la page, et la troisième maquette les place au même endroit. L'ordre publié est donc le bon : ciel, avis urgents, bande, chiffres du jour, portes, conseils du jour, 24 prochaines heures, demain et après-demain, source | Lots 1 à 3 |
| 5 | **Livré le 23 septembre 2026, commit `d96458e`.** « Le temps » en page de détail, comme une page d'iPhone, ouverte depuis les chiffres du jour, le lien de la bande et une heure touchée, qui cale le ruban sur elle. Le retour ramène l'accueil à l'endroit quitté, l'application restaurant elle-même le défilement ; un onglet referme la page | Lot 1 |
| 6 | **Livré le 25 septembre 2026, commit `884ed21`, version 87.** Quatre onglets : retrait de l'onglet « Le temps », reprise des contrôles de navigation. Aucun ancien réglage à reprendre, l'onglet courant n'étant pas mémorisé | Lot 5, et quelques jours d'usage du nouvel accueil |

Le lot 6 vient en dernier à dessein : l'application n'ayant aucune mesure d'usage, l'usage de Jérôme pendant quelques jours dira si la bande horaire répond assez bien pour que l'onglet ne manque pas.

## Jalon 11. L'accueil, second dessin

Ouvert le 24 septembre 2026 à partir d'une troisième maquette de l'accueil, que Jérôme trouve plus jolie que le dessin publié. Aucune photo pour l'instant : le ciel reste dessiné.

### 11a. Décisions du 24 septembre 2026

1. Les chiffres du jour reviennent près des conseils, après la bande horaire, en tuiles de deux colonnes. Ils couvrent la totalité des paramètres suivis, et non plus quatre.
2. Le dessin général de la maquette est repris, sans photo et dans les règles du système de design, amendé là où il le faut.

### 11b. Les paramètres suivis, un par tuile

Le ruban suit sept paramètres, la feuille de l'air un huitième. D'où huit tuiles, sur quatre rangées de deux, chacune menant à son détail :

| Tuile | Valeur | Précision | Détail |
|---|---|---|---|
| Ressenti | le plus chaud de la journée | écart à la température | voie Température |
| Pluie | quantité, ou risque, « Aucun risque » à zéro | plage de la pluie | voie Pluie |
| Vent | vitesse moyenne et direction | rafales | voie Vent |
| Ciel | couverture la plus forte | mot du ciel | voie Ciel |
| Humidité | la plus forte | point de rosée | voie Humidité |
| Indice UV | le plus fort | niveau et heure | voie Indice UV |
| Pression | au lever du jour | tendance | voie Pression |
| Air | indice officiel ou européen | niveau | feuille de l'air |

### 11c. Ce qui est repris de la maquette, et ce qui est écarté

Repris : les conseils en deux lignes, titre et précision, avec un chevron vers le détail concerné ; une seule ligne de vent dans la bande, flèche de direction et vitesse, les rafales ne paraissant que fortes ; la colonne « Maint. » mise en évidence ; le département sous le nom de la commune ; « Aucun risque » à la place de « 0 % de risque » ; les symboles dans des pastilles teintées ; les cartes plus arrondies. Écarté : la photo, le verre dépoli sur le contenu, le bouton de carte en tête qui double l'onglet, la carte « Ressenti et vent » qui dirait le vent deux fois.

### 11d. Amendements du système de design

Les pastilles teintées prennent les couleurs des symboles de temps déjà définies, et le libellé de la tuile porte toujours l'information : la règle qui interdit à une couleur de porter seule une information tient. Le jeton `--rayon-carte`, 24 points, publié mais jamais employé, sert aux cartes de l'accueil. Les ombres restent absentes : la maquette en porte de très légères, que la séparation par l'espace rend inutiles sur fond clair.

### 11e. Lots

| Lot | Contenu |
|---|---|
| 1 | **Livré le 24 septembre 2026, commit `9e0b1ba`, version 83.** Les huit tuiles des paramètres, après la bande et les conseils, avec leur pastille et leur lien vers le détail |
| 2 | **Livré le 24 septembre 2026, commit `1a57a26`, version 84.** Les conseils en deux lignes, avec chevron vers le détail |
| 3 | **Livré le 24 septembre 2026, commit `9880269`, version 85.** La bande : une ligne de vent avec la direction, la colonne « Maint. » mise en évidence, le titre « Maintenant et prochaines heures » |
| 4 | **Livré le 25 septembre 2026, commit `99b2dfb`, version 86.** L'en-tête avec le département, les cartes arrondies à 24 points, les réglages fins du dessin |
| 5 | **Livré le 25 septembre 2026, commit `884ed21`, version 87.** Les quatre onglets, lot 6 du jalon 10 |

## Jalon 12. La semaine, le second dessin partout, la justesse préparée

Ouvert le 25 septembre 2026, à la demande de Jérôme, la 3D étant écartée pour le moment.

### 12a. Décisions du 25 septembre 2026

1. Le second dessin de l'accueil s'étend aux autres écrans.
2. Le mode sombre du nouvel accueil est vérifié et retouché s'il le faut.
3. La justesse publiée, jalon 6, se prépare dès maintenant et s'allumera quand la matière suffira.
4. La semaine est améliorée par six propositions, toutes retenues. Le niveau de confiance se lit sur chaque ligne, sans déplier. Le graphique se place au-dessus de la liste, qui garde ses barres : le graphique montre la tendance et la pluie, la barre situe chaque journée à côté de son nom.

### 12b. Lots

| Lot | Contenu |
|---|---|
| 1 | **Vérifié le 25 septembre 2026, sans retouche.** Mode sombre des tuiles et de leurs pastilles |
| 2 | **Livré le 25 septembre 2026, commit `e5ac516`, version 88.** La semaine : le niveau de confiance sur chaque ligne, dit « fiable », « à confirmer » ou « incertain », et la barre estompée aux jours moins sûrs |
| 3 | **Livré le 25 septembre 2026, commit `ec4b7c7`, version 89.** La semaine : le graphique de tête, maximums et minimums sur dix jours, barres de pluie |
| 4 | **Livré le 25 septembre 2026, commit `31bf347`, version 90.** La semaine : les grandes lignes en conseils de deux lignes, « Chaleur jusqu'à 30° samedi », « Orage probable dimanche » |
| 5 | **Livré le 27 septembre 2026, commit `4615b49`, version 91.** La semaine : « Voir les heures » dans le volet, vers le ruban calé sur la journée ; les rafales fortes sur la ligne quand la pluie n'y est pas ; cartes arrondies et week-end repéré |
| 6 | **Livré le 27 septembre 2026, version 92.** Le second dessin sur Le ciel et les feuilles : toute carte arrondie à 24 points, le premier symbole de chaque rangée dans une pastille teintée |
| 7 | **Livré le 27 septembre 2026, commit `76f3392`, version 93.** La justesse publiée préparée dans les réglages, avec le nombre de jours déjà mesurés |

## Jalon 13. Seize jours de prévision, deux modèles de scénarios

Ouvert le 28 septembre 2026 à la demande de Jérôme : aller jusqu'à seize jours, et employer les deux modèles de scénarios disponibles pour comparer, avec une confiance mixte là où ils se recouvrent.

### 13a. Ce que le service donne

La prévision va jusqu'à seize jours, toutes valeurs remplies. Les scénarios quotidiens se demandent sans les heures, ce qui les rend légers : ICON, 40 membres sur 7 jours ; ECMWF, 51 membres sur 15 jours. Le seizième jour n'a pas de scénario.

### 13b. Mesure du 28 septembre 2026

Dispersion du maximum du jour, du dixième au quatre-vingt-dixième centile des membres, moyenne sur Montbard, Paris, Lecci et Brest :

| Échéance | ICON | ECMWF | Les deux réunis | Écart des médianes |
|---|---|---|---|---|
| Aujourd'hui à 4 jours | 1,8 à 2,6° | 1,8 à 2,7° | 2,3 à 3,5° | 0,7 à 1,6° |
| 5 et 6 jours | 3,6 à 4,1° | 3,2 à 4,4° | 3,3 à 4,4° | 0,5° |
| 7 à 14 jours | aucun | 5,4 à 7,9° | aucun | aucun |

Les deux modèles se dispersent de façon comparable ; les réunir élargit la fourchette là où leurs médianes divergent.

### 13c. Lots

| Lot | Contenu |
|---|---|
| 1 | **Livré le 28 septembre 2026, commit `59f95f8`, version 98.** Seize jours dans La semaine : la liste s'allonge, le graphique défile horizontalement à colonnes fixes et s'ouvre sur aujourd'hui, la seconde semaine porte le numéro du jour. Les heures du ruban gardent leur horizon |
| 2 | **Livré le 28 septembre 2026, commit `0ef2537`, version 99.** Les scénarios quotidiens des deux modèles, chargés en une seule requête, légers, gardés trois heures |
| 3 | **Livré avec le lot 2.** La confiance mixte : sur les jours où les deux modèles se recouvrent, la dispersion des membres réunis ; au-delà, ECMWF seul ; le seizième jour, aucune. Seuils recalibrés à 4 et 7 degrés. Le volet d'une journée montre la fourchette de chaque modèle et dit s'ils s'accordent |
| 4 | **Livré le 28 septembre 2026, commit `47287b3`, version 101.** Les grandes lignes de la semaine restent sur les sept premiers jours, où elles ont du sens ; une ligne dit la tendance de la semaine suivante |

Le module horaire des scénarios ICON, qui nourrit les enveloppes du ruban, ne change pas.

## Jalon 14. La comparaison

**Clos le 29 septembre 2026, version 106 ; complété le 30 septembre, version 107.**

**Complément du 29 et du 30 septembre 2026, demandé par Jérôme.** Chaque carte choisit sa période, sans jamais mêler le passé et l'avenir. Le passé, 7, 15 et 30 derniers jours et deux derniers mois, finit hier et se lit dans l'archive ; l'avenir, 3, 7 et 15 prochains jours, commence demain et se lit dans la prévision ; aujourd'hui n'appartient à aucune période ; la semaine en cours a disparu. Les 7 derniers jours s'ouvrent par défaut. Le seuil de la pluie croît avec la racine de la durée.

Demandé par Jérôme le 28 septembre 2026.

**Objet.** Comparer une période, soit à la même période d'autres années au même endroit, soit à la même période en d'autres lieux.

**Ce qui existe déjà.** Le jalon 8 place le maximum du jour parmi les mêmes dates depuis 1950, compare la saison en cours à la normale 1991 à 2020 et donne les records de la date. Le jalon 3 classe les lieux suivis selon le beau temps. Aucun des deux ne met deux périodes ou deux lieux côte à côte.

**Contenu proposé.**
1. Comparaison dans le temps : une période au choix, jour, semaine, mois ou saison, confrontée à la même période d'une année choisie, l'an dernier par défaut. Courbes superposées des maximums et des minimums, cumul de pluie, et écarts écrits en une phrase.
2. Comparaison dans l'espace : deux à quatre lieux, pris parmi les lieux suivis ou cherchés, sur la même période. Pour le passé, l'archive ; pour les seize jours à venir, la prévision. Un tableau des chiffres clés et les courbes superposées.
3. Une phrase de synthèse par comparaison, dans la forme des conseils de l'accueil : « Septembre plus chaud que l'an dernier de 2,1° », « Lecci plus sec que Montbard cette semaine ».

**Sources vérifiées le 28 septembre 2026.** L'archive journalière d'Open-Meteo, réanalyse ERA5, répond depuis 1940, sans compte ; le 28 septembre 1995 à Montbard, 12,9° au plus chaud et 0,2 mm. La prévision quotidienne va à seize jours. La réduction de l'archive longue du jalon 8, gardée sur l'appareil, sert la comparaison dans le temps sans nouvelle lecture.

**Décisions du 28 septembre 2026.** La comparaison se range dans la feuille du climat de la commune, qui parle déjà du passé. La comparaison dans le temps s'ouvre sur la semaine en cours.

**Lots proposés.**

| Lot | Contenu |
|---|---|
| 1 | **Livré le 29 septembre 2026, commit `f9b4c0e`, version 105**, après une pause et un raccordement à la version 104. La comparaison dans le temps : la semaine ou le mois en cours, au même lieu, confrontés à la même période d'une année choisie, l'an dernier par défaut ; courbes superposées et phrase de synthèse |
| 2 | **Livré le 29 septembre 2026, commit `def48c7`, version 106.** La comparaison entre lieux : la commune affichée et jusqu'à trois lieux suivis choisis par des pastilles, sur la semaine en cours ; tableau des moyennes et du cumul de pluie, maximums superposés, phrase du lieu le plus chaud et du plus arrosé |
| 3 | **Clos sans ajout le 29 septembre 2026, décision de Jérôme.** Les deux cartes portent déjà leur phrase de synthèse dans la forme des conseils et s'ouvrent depuis la feuille du climat ; aucune ligne n'est ajoutée à l'accueil |

**Reprise du 29 septembre 2026.** Le défaut relevé à la pause venait d'une attente trop courte pendant la lecture de l'archive longue ; un jeton écarte désormais les réponses périmées quand on change d'année deux fois de suite. Le lot 1 est publié en version 105.

**État du lot 1 à la mise en pause, le 28 septembre 2026.** Le module `src/comparaison.js` et la carte « Cette semaine face à » de la feuille du climat sont écrits et fonctionnent sur les données réelles de Montbard : « Plus chaude que la même semaine de 2025, de 7° en moyenne au plus chaud ; pluie comparable, 17 mm contre 12 ». Restent : le choix d'une autre année dans le sélecteur, qui n'affichait pas de phrase après trois secondes pour 2003, à diagnostiquer ; les gardes et fautes du lot ; la passe complète ; la version à monter et la publication sur `main`.

**Points d'attention.** Comparer une prévision à une réanalyse mêle deux sources : le jalon 8 a mesuré un écart moyen de 0,26° sur le maximum et interdit la pluie au jour près ; la comparaison suivra les mêmes règles. Plusieurs lieux sur une longue période multiplient les lectures d'archive : une lecture par lieu, bornée à la période demandée.

## Jalon 15. La météo des plages

Demandé par Jérôme le 28 septembre 2026.

**Objet.** Pour une commune proche de la mer, dire le temps qu'il fait à la plage : l'eau, les vagues, le vent, les marées, et les bons moments pour la baignade.

**Contenu proposé.**
1. Une porte « La plage » qui ne paraît que si une plage se trouve à moins d'une distance à fixer de la commune, avec le nom de la plage la plus proche.
2. La température de l'eau, la hauteur et la période des vagues, le vent et sa direction par rapport au rivage, l'indice UV.
3. Les marées : heures et hauteurs de pleine et de basse mer, tirées de la hauteur de la mer heure par heure.
4. Les bons créneaux de baignade de la journée, selon l'eau, les vagues, le vent et le soleil, dans la forme de « Quand faire quoi ».

**Sources vérifiées le 28 septembre 2026.** L'API marine d'Open-Meteo, sans compte : à Biarritz, vagues de 1,1 mètre, période de 10 secondes, eau à 22,2° et hauteur de la mer, marée comprise. Les plages elles-mêmes, noms et positions, viendraient d'une extraction d'OpenStreetMap embarquée dans l'application.

**Hors cadre à ce stade.** La qualité des eaux de baignade et la surveillance des plages : les données publiques existent, sans service simple à interroger depuis une application statique.

**Décision du 30 septembre 2026, la saison.** La porte « La plage » paraît de juin à septembre, et hors saison tant que l'eau de la plage la plus proche dépasse 20°. Elle prend l'emplacement de la porte large de la neige, au-dessus de la grille des portes de l'accueil.

**Lots.**

| Lot | Contenu |
|---|---|
| 1 | **Livré le 30 septembre 2026, commit `0da31a4`.** La liste embarquée des plages, `src/plages.js`, 2 152 plages, construite par `outils/construire-plages.py` depuis les eaux de baignade déclarées à la Commission européenne ; noms remis en forme lisible, département tiré du lien vers le ministère de la Santé ; commune quand le service d'adresses de l'État répond |
| 2 | **Livré le 30 septembre 2026.** Les plages proches, `src/plage.js`, à une heure de route au plus, par OSRM via le module commun `src/trajets.js` |
| 3 | **Livré le 30 septembre 2026, commit `d61070c`, version 109.** La porte large et la feuille : l'eau, les vagues, le vent, l'indice UV, les marées et le marnage ; le classement officiel de la qualité de l'eau, saison 2024, et le lien vers la fiche du ministère, demandés par Jérôme. Le vent par rapport au rivage n'est pas fait, l'orientation des plages manquant à la source ; le drapeau du jour n'est publié nulle part |
| 4 | **Livré le 30 septembre 2026, commit à la version 110.** Les créneaux de baignade : air à 20° au moins, eau à 16°, vagues d'un mètre et demi au plus, vent de 25 km/h au plus, pas de pluie, la plus longue suite d'au moins deux heures ; la direction du vent au niveau de la plage, demandée par Jérôme |

**Décision du 28 septembre 2026.** Une plage est proche si elle se trouve à une heure de voiture au plus de la commune.

**Méthode proposée pour la durée de trajet.** Les plages à moins de 100 kilomètres à vol d'oiseau sont présélectionnées dans la liste embarquée ; une seule requête au service public de calcul d'itinéraire OSRM donne ensuite la durée en voiture vers chacune, et seules restent celles à une heure au plus. Le résultat se garde par commune : il ne change pas d'un jour à l'autre. Vérifié le 28 septembre 2026 : le service répond aux pages web de toute origine, et donne 47 minutes pour 43 kilomètres de route depuis Montbard. Si le service ne répond pas, une estimation à vol d'oiseau prend le relais, 55 kilomètres valant environ une heure de route. Le serveur public d'OSRM est une démonstration, à la charge limitée : l'application l'interroge une fois par commune, jamais en boucle.

## Jalon 16. La météo des neiges

**Clos le 30 septembre 2026, version 108.** La porte restera invisible jusqu'au 1er novembre, sauf chute précoce sur une station proche.

Demandé par Jérôme le 28 septembre 2026.

**Objet.** Pour une commune proche d'une station de ski, dire l'enneigement et le temps en montagne, au pied et au sommet des pistes.

**Contenu proposé.**
1. Une porte « La neige » qui ne paraît que si une station se trouve à moins d'une distance à fixer, et en saison.
2. Pour chaque station proche : l'épaisseur de neige au pied et au sommet, la neige fraîche des dernières 24 et 72 heures, les chutes prévues sur sept jours.
3. L'altitude de l'isotherme zéro degré, le vent et les rafales au sommet, la visibilité par le plafond nuageux.
4. Une phrase de synthèse : « 25 cm de neige fraîche attendus d'ici samedi au-dessus de 1 800 mètres ».

**Sources vérifiées le 28 septembre 2026.** La prévision d'Open-Meteo accepte l'altitude du point demandé et rend l'épaisseur de neige, les chutes et l'altitude de l'isotherme zéro ; à Val Thorens, à 2 300 mètres, l'isotherme était à 4 070 mètres et le sol sans neige. Les stations, positions et altitudes du pied et du sommet, viendraient d'une liste embarquée tirée d'OpenStreetMap et de Wikidata.

**Hors cadre à ce stade.** Le bulletin d'estimation du risque d'avalanche de Météo-France, qui demande une clé d'accès, et l'ouverture des pistes, sans donnée publique commune aux stations.

**Décision du 30 septembre 2026, l'accès.** Une porte large, sur toute la largeur, posée au-dessus de la grille des portes de l'accueil, en saison et s'il existe une station à une heure de route, avec un sous-titre vivant ; et un conseil sur l'accueil quand une chute notable s'annonce, qui ouvre la même feuille. Le même emplacement servira l'été à « La plage », au jalon 15.

**Décision du 30 septembre 2026.** Les stations des pays voisins sont incluses : Suisse, Italie, Andorre, Espagne et Allemagne, dès qu'elles sont à une heure de route d'une commune.

**Lots.**

| Lot | Contenu |
|---|---|
| 1 | **Livré le 30 septembre 2026, commit `43cef77`.** La liste embarquée des stations, `src/stations.js`, 432 stations, construite par `outils/construire-stations.py` depuis OpenSkiMap, qui publie chaque nuit les domaines skiables d'OpenStreetMap avec leurs altitudes. Overpass était indisponible ; OpenSkiMap convient mieux, les altitudes y étant déjà calculées |
| 2 | **Livré avec le lot 1.** Les stations proches, `src/neige.js` : une heure de route au plus, par le service OSRM, une estimation à vol d'oiseau en secours, jamais gardée ; le résultat gardé trente jours par commune |
| 3 | **Livré le 30 septembre 2026, commit `5b58a33`, version 108.** La porte large au-dessus de la grille et la feuille « La neige » : pour chaque station proche, rangée sous son domaine, la neige au pied et au sommet, la neige fraîche sur 24 et 72 heures, les chutes prévues sur sept jours, l'isotherme zéro, les rafales au sommet ; sources citées |
| 4 | **Livré avec le lot 3.** La saison : la porte de novembre à avril, et au-delà tant que la neige tient au sommet d'une station proche ; la phrase de synthèse et le conseil de chute notable, dix centimètres en un jour ou vingt en trois au sommet |

**Décision du 28 septembre 2026.** La porte « La neige » paraît de novembre à avril, et en dehors de cette période tant que la neige tient au sommet d'une station proche, pour une chute précoce d'octobre ou une fin de saison tardive en mai. La proximité se mesure comme pour les plages, en durée de trajet : une heure de voiture au plus, confirmé par Jérôme le 28 septembre 2026.

## Jalon 17. La semaine au plus loin

**Livré le 28 septembre 2026, commit `5441d81`, version 102.**

Demandé par Jérôme le 28 septembre 2026 : pousser le graphique et la liste de La semaine au maximum des informations à venir, et replier derrière un « Voir plus » la part où l'incertitude n'est plus calculée.

**Ce que le service donne, vérifié le 28 septembre 2026.** La prévision va à seize jours ; les scénarios d'ICON à sept, ceux d'ECMWF à quinze ; ceux du modèle américain GFS, 31 membres, à trente-quatre jours remplis.

**Décisions.**
1. La frontière du « Voir plus » est le dernier jour dont la confiance est calculée par ICON et ECMWF, le quinzième.
2. Un même bouton, sous le graphique et au bas de la liste, déplie les deux à la fois : le seizième jour de la prévision, puis la tendance de GFS jusqu'au trente-quatrième.
3. Les journées de tendance se résument par la médiane des scénarios pour les températures et par la part des scénarios pluvieux, sans mot de confiance : à cinq semaines, un seul modèle ne donne plus qu'une indication. Une moyenne de pluie, deux millimètres presque chaque jour, prêtait une précision trompeuse ; elle a été écartée à l'essai.
4. La tendance n'est lue qu'au premier « Voir plus », puis gardée six heures : l'ouverture de l'application n'en paie pas le prix.
5. Une journée de tendance ne porte jamais de confiance, même quand sa date tombe dans la couverture d'ECMWF : ses chiffres viennent de GFS. La passe complète a relevé ce cas sur les données d'essai.

## Hors cadre

| Fonction | Ce qu'elle exigerait |
|---|---|
| Notification poussée d'arrivée de pluie, d'orage ou de vigilance | Un service dorsal, y compris pour une application installée sur iOS. Le rappel de parapluie du jalon 3 contourne cette limite par l'agenda, qui donne une vraie alarme, et par une automatisation Raccourcis que l'utilisateur construit à la main : un raccourci publié par l'application n'est pas réalisable, le format étant une archive signée par Apple |
| Signalement participatif du temps observé | Un service dorsal et une modération |
| Synchronisation des lieux entre appareils | Un compte |

Les deux premières lignes se lèvent avec le même service dorsal minimal. Les impacts de foudre ont quitté ce tableau le 10 septembre 2026 : le WMS public d'EUMETSAT les sert sans relais. C'est un arbitrage de fond sur la nature du projet, pas une difficulté technique.

## Arbitrages ouverts

1. Place de la carte dans la navigation : fusion de Le soleil et La lune en une destination Le ciel, qui accueille aussi la carte du ciel au jalon 9, ou ouverture de la carte en feuille pleine depuis la tuile de pluie. À trancher avant d'ouvrir le jalon 4, l'arbitrage conditionnant aussi le jalon 9.
2. Parti pris de représentation en 3D retenu parmi les huit prototypés, et éventuelle variante conservée.
3. Ouverture d'un service dorsal minimal, qui lèverait d'un coup les notifications et le signalement participatif, au prix d'une rupture avec le principe d'une application entièrement statique. La foudre ne dépend plus de cet arbitrage depuis le 10 septembre 2026.
4. Écran d'accueil du compte à rebours de pluie : phrase permanente en tête d'accueil, ou phrase qui ne paraît qu'en deçà d'un seuil de minutes.
5. Bibliothèque de rendu 3D chargée à la demande, ou rendu direct sur toile sans bibliothèque.
6. Traitement de la confiance dans l'interface : niveau écrit en toutes lettres partout, ou enveloppe graphique seule sur le ruban et mention écrite dans la semaine.
7. Seuils du rappel de parapluie : tranchés le 28 août. La gêne vaut un demi-millimètre par heure, la lame horaire décidant seule ; la probabilité n'entre pas dans la règle, la lame attendue disant déjà ce qui tombe. Le retournement est repris de `SEUILS.rafale`, quarante kilomètres par heure. Reste ouvert à l'usage : le nombre d'heures d'alerte, deux aujourd'hui, et la fréquence à laquelle le jeton paraît, un jeton trop fréquent cessant de se lire.
8. Forme du panneau des couches : tranché le 11 septembre 2026, des tuiles trois par rangée, commit `4675348`. Le panneau grandit par rangée de trois ; la question d'une tuile par taxon de pollen reste celle du lot 4c.

## Journal des mises à jour

| Date | Objet |
|---|---|
| 24 août 2026 | Rédaction initiale, sur l'état de publication du 23 août |
| 25 août 2026 | Jalon 2 ramené à son reste, la lecture continue du passé au futur étant livrée le 24 août ; jalon 5b corrigé, Le temps portant deux écritures et non trois, les moments ayant rejoint l'accueil ; jalon 4 informé du déblocage de la largeur d'écran ; arbitrage 1 marqué comme préalable au jalon 4 ; jalon 1 point 5 signalé comme le seul point où un retard se paie deux fois |
| 26 août 2026 | Jalon 1 achevé : la marge d'une prévision se voit et se dit, la confiance par journée et le désaccord entre modèles ; la prémisse du point 4 corrigée, la probabilité affichée étant déjà probabiliste |
| 28 août 2026 | Jalon 3 lot 1 livré : le rappel de parapluie, trois mécanismes sur quatre ; le quatrième, l'automatisation, tenu pour non réalisable sous cette forme et remplacé par une recette ; seuils du point ouvert 7 tranchés |
| 28 août 2026 | Correction du jour même : les heures réglées deviennent des heures d'alerte, chacune répondant de la pluie jusqu'à la suivante et la dernière jusqu'à minuit ; deux instants remplacent deux plages |
| 28 août 2026 | Jalon 3 lot 2 livré : la réponse du matin, posée dans le ciel et bornée à une instruction, et le ressenti calibré, borné à trois degrés et sans effet sur les valeurs de source |
| 28 août 2026 | Jalon 3 lot 3 livré : l'écran de questions, six activités à seuils nommés sur quarante-huit heures ; arbitrage 7 corrigé à la mesure, le séchage suivant l'évapotranspiration horaire et non le déficit de pression de vapeur |
| 28 août 2026 | L'objet à prendre rejoint le conseil de vêtement dans l'encart de l'accueil : c'est la même question, celle de ce qu'on emporte |
| 29 août 2026 | Jalon 3 lot 4 livré : où est le beau temps, classement des lieux suivis et grille de cent kilomètres à la demande ; jalon 3 achevé |
| 30 août 2026 | Correction visuelle : sur l'écran du Soleil, le disque restait peint sous l'horizon ; la règle de l'accueil, six degrés sous l'horizon, est nommée et partagée par les deux panneaux |
| 3 septembre 2026 | Arbitrage de navigation tranché : Le soleil et La lune fusionnent en une destination Le ciel, qui portera trois écrans, le troisième étant Les étoiles ; jalon 7 ouvert avant le jalon 4 |
| 3 septembre 2026 | Jalon 7 livré pour l'air et les pollens ; le sol écarté à la mesure, un seuil d'humidité dépendant de la texture du sol et une gelée au sol ne se produisant jamais sans gel de l'air sur les trois cent soixante-cinq journées relevées |
| 5 septembre 2026 | Premier lot du jalon 4 livré : Le soleil et La lune fondus dans la destination Le ciel, la barre d'onglets passant à quatre entrées et la cinquième place étant réservée à La carte |
| 5 septembre 2026 | Lot 4a livré : la destination La carte ouvre sur un fond dessiné à partir de contours embarqués, le fond en tuiles ayant été écarté à la mesure, une vue de téléphone coûtant de six cents kilooctets à un mégaoctet par écran contre trente-trois kilooctets une fois pour toutes |
| 5 septembre 2026 | Lot 4a-2 livré : la pluie observée de RainViewer sur deux heures, sa chronologie et son interrupteur ; tuiles en 256 points et une seule image à l'ouverture, l'un et l'autre à la mesure ; l'extrapolation reste en suspens, le service la publiant vide aux deux relevés du jour |
| 6 septembre 2026 | Lot 4b-1 livré : la pluie dans l'heure en tête d'accueil, avec son graphe de neuf échéances. Le troisième relevé de RainViewer rendant encore une extrapolation vide, la source devient le produit « pluie dans l'heure » de Météo-France, sur le service qui porte déjà la vigilance |
| 7 septembre 2026 | Lot 4b-2 livré : la pluie dans l'heure a un repli là où le radar ne couvre pas, la colonne du quart d'heure d'Open-Meteo. Deux charges d'essai corrigées, l'une qui écrivait ses heures dans le fuseau du conteneur, l'autre qui rendait toujours cinq pas quel que soit le nombre demandé |
| 7 septembre 2026 | La carte s'ouvre sur la France entière et l'onglet y ramène. Un repère près du bord droit porte son nom à gauche, le nom se coupant sinon au bord |
| 6 septembre 2026 | Défaut du lot 4a-2 relevé sur téléphone et corrigé : le service ne sert le radar que jusqu'au zoom sept et la carte s'ouvre au zoom huit, la couche montrait donc une image grise de refus. Les tuiles de sept se posent maintenant agrandies au delà de la borne, et les chiffres de coût sont refaits sur des tuiles réelles |
| 7 septembre 2026 | Lot 4c-1 livré : la vigilance des départements sur la carte, en un appel pour tout le pays. Les contours passent en topologie d'arcs, la teinte d'un département venant des mêmes points que ses traits, pour 907 octets de plus |
| 7 septembre 2026 | Lot 4c-2 livré : le panneau des couches et la nappe de température, grille de 380 points en un appel de 13 840 octets compressés. La gaine des traits devient un choix de la couche, et la vigilance passe en liseré sous une nappe pleine |
| 7 septembre 2026 | Lot 4c-3 livré : le vent en particules sur sa propre toile, superposable aux nappes. Aucun octet de plus, les colonnes étant déjà chargées ; 965 particules pour une image médiane inchangée à 16,6 millisecondes |
| 7 septembre 2026 | Lot 4c-4 livré : l'indice ultraviolet en nappe, pris sur le maximum du jour et non sur l'instant, lequel vaut zéro la moitié du temps. La légende dit sur quoi chaque nappe porte |
| 9 septembre 2026 | Lot 4b-3 livré : le sens d'arrivée de la pluie, mesuré entre deux images observées. Le vent de surface ne dit rien du déplacement des masses, le vent à 700 hPa donne la direction mais sous-estime la vitesse d'un tiers |
| 9 septembre 2026 | Défaut relevé sur téléphone et corrigé : une bruine qu'AROME était seul à voir s'écrivait en tête d'accueil, quand la voie de pluie disait « aucune ». Un code de pluie faible que le second modèle ne confirme pas redevient l'état du ciel |
| 9 septembre 2026 | Cinquième relevé de l'extrapolation RainViewer, à 22 h 51 UTC : champ vide, champ satellite vide. Le point est clos, plus rien de la feuille de route ne l'attend |
| 10 septembre 2026 | Jalon 8 livré, commit `1c4a2a3` : le climat de la commune, quatre-vingts ans de réanalyse ERA5 en une feuille. Percentile du jour, records de la date, saison contre normale, bandes de réchauffement. La réduction tient en 12,5 kilooctets par commune et coûte 68 millisecondes, ce qui écarte le fil séparé que le jalon prévoyait |
| 10 septembre 2026 | Lot 4c-5 livré : la qualité de l'air en nappe, commit `b7d6979`. Premier service autre que celui de la prévision sur la grille des nappes, 9718 octets compressés lus seulement quand la couche est allumée. L'indice du moment, la rampe partant du cyan, deux choses décidées à la mesure |
| 10 septembre 2026 | Premier point du jalon 4d écarté à la mesure : l'énergie convective retiendrait une heure sur neuf et se tromperait dans quatre-vingt-dix-huit cas sur cent ; elle ne gradue pas davantage la force d'un orage, et le potentiel de foudre d'ICON ne dit rien que le code de temps ne dise déjà |
| 10 septembre 2026 | Charges discordantes posées, commit `b6ee666`. Le défaut de bruine avait traversé sept cent dix-neuf contrôles faute de charge d'essai portant un désaccord entre modèles : cinq gardes lisent maintenant sur un même rendu le mot du ciel, la voie de pluie et les mesures du jour. La reprise du temps sensible tourne sans seconde voix et écarte un code de pluie que ni la lame ni le risque ne soutient. Trois seuils qui vivaient à deux endroits n'en ont plus qu'un |
| 10 septembre 2026 | Lot 4d rebâti à la mesure. Le repérage de cellules radar est écarté : un pixel très intense n'a de foudre à côté qu'une fois sur cinq, et plus de la moitié de la foudre tombe hors de toute pluie radar. Le cadre Blitzortung est abandonné. La foudre vient de l'imageur du Meteosat de troisième génération sur le WMS public d'EUMETSAT, sans clé, en Mercator, avec l'origine ouverte, à cinq minutes de pas. Le relais dorsal n'est plus nécessaire qu'aux notifications |
| 10 septembre 2026 | Trois reprises portées au carnet : la couche de nuages par l'imagerie MTG du même WMS, l'écart de la nappe de qualité de l'air avec l'indice ATMO, à mesurer avant de choisir la source, et la rampe de l'indice ultraviolet, du violet au fuchsia. Arbitrage 8 ouvert sur la forme du panneau des couches |
| 11 septembre 2026 | Arbitrage 8 tranché et livré au commit `4675348` : le panneau des couches passe en tuiles, trois par rangée, l'icône au-dessus du nom, 239 points sur 742 là où la liste en prenait 350. Le nom reste sur chaque tuile ; la nappe d'air porte « Air » sur la tuile et le nom entier en légende. Cinq gardes, six fautes éprouvées. 757 contrôles verts |
| 12 septembre 2026 | Couche de foudre livrée au commit `de71acc`. Six pas de cinq minutes posés l'un sur l'autre, le plus récent dessus : un pas seul clignote, un pas couvrant 1517 pixels sur l'Europe contre 2986 pour six. Tuiles bornées au zoom six, le pixel de la source faisant deux kilomètres. Correction : la plage `time=début/fin` du service ne cumule pas, elle rend le premier pas. Treize gardes, dix fautes éprouvées. 770 contrôles verts |
| 12 septembre 2026 | Les épreuves de fautes travaillent sur une copie du dépôt et un port propre, choisi par `PORT_ESSAIS` : dix épreuves tiennent en dix minutes là où la séquence en prenait cent, et le dépôt d'origine n'est plus touché. Reste au carnet un filtre par section dans `controle.mjs`, qui ramènerait une épreuve à trente secondes, à mesurer avant de s'y engager, l'état étant partagé entre sections |
| 12 septembre 2026 | Rampe de l'indice ultraviolet du violet au fuchsia, commit `f8d7c5a`. Arrêts resserrés sur la plage réelle, 1,2 à 6,3 sur 54 points et 7 jours ; saturation et clarté fonction de la valeur, la teinte ne parcourant que cinquante degrés entre violet et fuchsia. L'échelle de l'Organisation mondiale de la Santé est abandonnée parce que la nappe de température est déjà verte puis rouge. 773 contrôles verts |
| 13 septembre 2026 | Contraste de cette rampe repris, commit `8cb7e9c` : un jour donné l'essentiel du pays se serre entre 5 et 6, et la rampe n'y mettait presque rien. Écart porté de 6,6 à 17,8 en distance perçue, sous contrainte de rester visible sur le fond à un indice de 1, ce qui écarte une rampe plus étalée. La vivacité brute ne mesure pas ce contraste : une couleur sombre a moins d'écart entre ses canaux qu'une couleur moyenne. 774 contrôles verts |
| 16 septembre 2026 | Indice ATMO officiel et ses cinq sous-indices sur l'écran de la commune, commit `82f96aa`, chargés après l'affichage puisque le service met une vingtaine de secondes. Recherche par proximité en Mercator, sans référentiel embarqué ; zone la plus proche retenue et nommée comme la source la nomme. 783 contrôles verts |
| 12 au 15 septembre 2026 | Outillage des épreuves. Chaque épreuve travaille sur une copie du dépôt et son propre port, choisi par `PORT_ESSAIS` : le dépôt d'origine n'est plus touché et une épreuve interrompue ne laisse plus de faute derrière elle. `essais/passe.sh` fait de même pour une passe ordinaire, ce qui laisse le dépôt libre pendant qu'elle tourne |
| 18 septembre 2026 | Carte des feux de forêt ajoutée à la feuille de route, section 4c-2. Source reconnue : couche `viirs.hs` du système européen d'information sur les feux de forêt, sans clé, en Mercator, avec l'origine ouverte, 1,2 kilooctet la tuile de la France. La dimension de temps est obligatoire, faute de quoi le service rend l'année 2020 et une image vide. La couche `mtg_fd:frp` d'EUMETSAT est écartée, le géostationnaire ne voyant que les feux de grande ampleur |
| 19 septembre 2026 | Couche de nuages livrée au commit `c0d5fa8`. L'infrarouge est retenu parce qu'il voit la nuit : à deux heures du matin le visible rend une image noire, luminance moyenne de 1,5 sur 255, quand l'infrarouge garde 71 de luminance et 33 d'écart type. Le service ne rend aucun pixel transparent, quel que soit le style : la transparence est calculée à l'arrivée de chaque tuile à partir de la luminance, une milliseconde par tuile. La couche se pose sous la pluie et reste éteinte au départ. 791 contrôles verts |
| 19 septembre 2026 | La garde du panneau des couches disait « un tiers du cadre » ; avec quatre rangées le panneau en prend 301 sur 742. Elle dit maintenant ce qu'elle protège, que la carte garde la plus grande part du cadre, seuil aux deux cinquièmes, ce qui laisse la place d'une rangée de plus |
| 19 septembre 2026 | La pluie passe en superposition, commit `8d2b57f`. Son classement en nappe venait de l'histoire : mesurée sur les images du radar un jour de pluie modérée, elle ne couvre que 19 % de la tuile de la France au zoom cinq et 14 % de la vue au zoom six. Elle se lit désormais en même temps qu'une nappe. Deux anciens réglages se reprennent ; une valeur par défaut posée sur le nouveau réglage court-circuitait cette reprise et rallumait un radar éteint, défaut trouvé et éprouvé. 793 contrôles verts |
| 19 septembre 2026 | Deux outils de mesure dans la suite. Un chronomètre par section, `CHRONO=1` : une passe dure 554 secondes, dont 126 pour 104 ouvertures de page à 1,21 seconde chacune. Le temps n'est pas dans une section mais dans cette charge répartie, ce qui écarte le filtre par section envisagé le 13 septembre. Un arrêt anticipé, `JUSQUA`, qui borne la passe à la section visée : 446 secondes au lieu de 554 pour une épreuve de la carte |
| 19 septembre 2026 | La gaine des traits cesse de quadriller la carte, commit `f32ab4f`. Elle se déclenchait sur toute la carte dès qu'une couche posait quelque chose, alors que la pluie n'en couvre que 19 % : elle passe de trois points de large à 1,4 et de neuf dixièmes d'opacité à cinq. La garde censée la tenir mesurait des traits relevés hors pluie ; corrigée, elle passe encore avec une gaine réduite à rien, l'écart de clarté venant du trait et non de sa gaine. Le réglage n'est donc tenu par aucune garde, ce qui est écrit dans le code, et la faute qui prétendait l'éprouver est retirée |
| 20 septembre 2026 | Couche des feux livrée au commit `709d492`, section 4c-2 close. Sept gardes, six fautes éprouvées, dont une qui ôte la date de la requête et reproduit le piège de cette source |
| 20 septembre 2026 | Les mentions de source passent du gris clair au gris moyen, commit `220eb8b` : elles se perdaient sur une averse jaune, le halo de texte ne suffisant pas quand halo et texte sont tous deux clairs. Un halo plus dense a été essayé et écarté. Une garde nouvelle mesure le rapport de clarté du texte au fond et exige au moins quatre, ce que rien ne vérifiait |
| 20 septembre 2026 | Nappe de l'air basculée sur l'indice officiel, commit `93fb616` : Copernicus interpolé pour l'Europe, tuiles ATMO par-dessus la France. Quatre gardes, trois fautes éprouvées |
| 20 septembre 2026 | Jalon 9 reconnu, sans rien écrire. Catalogue HYG version 4.1, licence Creative Commons Attribution et partage dans les mêmes conditions : 5071 étoiles jusqu'à la magnitude 6, 236 kilooctets bruts et 73 comprimés en format compact, contre 45 à la magnitude 5,5 et 120 à 6,5. Trois points à trancher : la magnitude retenue, la source des figures de constellations que le catalogue ne porte pas, et le chargement à la demande plutôt que dans la coquille de départ |
| 20 septembre 2026 | Jalon 9, première partie, commit `fc111d3` : les données et les calculs, sans l'écran. `donnees/ciel.json` porte 5070 étoiles jusqu'à la magnitude 6, 88 figures et leurs noms français, 81 kilooctets comprimés, chargés à la demande. `src/ciel.js` les place par projection stéréographique, qui conserve la forme des constellations, et vérifie contre le ciel réel. Neuf gardes, cinq fautes éprouvées. Reste l'écran : tracé sur toile, visée, curseur de temps, Lune et planètes, mentions |
| 20 septembre 2026 | Jalon 9, écran des étoiles, commit `0a00a8e` : troisième écran du ciel, la voûte à l'instant présent sur fond de nuit, le sol sous l'horizon, les points cardinaux, la visée au doigt. Le fichier ne se charge qu'à l'ouverture de l'écran. L'écran dit quand il fait jour. Six gardes, quatre fautes éprouvées. Restent le curseur de temps, la Lune et les planètes, et trois retouches de rendu : la densité au champ large, les noms qui chevauchent les traits, la mention qui tombe sous la barre de navigation |
| 21 septembre 2026 | Améliorations de l'écran des étoiles organisées en cinq lots, section 9-bis : texte en fenêtre et carte dégagée, plein écran, choix de ce qui s'affiche, ciel sous l'horizon derrière une étendue d'eau, puis temps, Lune et planètes. Mesure pour le choix de l'affichage : 5070 étoiles pour toutes, 523 jusqu'à la magnitude 4, 749 qui portent les figures |
| 21 septembre 2026 | Décisions sur l'écran des étoiles : les plus visibles par défaut ; le ciel sous l'horizon vu à travers l'eau ; hors plein écran, la mise en page du Soleil et de la Lune, bandeau en haut et informations dessous ; plein écran d'un toucher sur le bandeau. Lots A et B réunis |
| 21 septembre 2026 | Décisions de l'écran des étoiles prises par délégation : étiquette de visée en plein écran, trois sections d'informations, titre du bandeau, sélecteur d'affichage en plein écran, fiche d'une constellation au toucher bref, noms latins ajoutés au fichier. Ordre révisé en six lots |
| 22 septembre 2026 | Écran des étoiles, lot un, commit `88a7590` : le ciel en bandeau fixe comme ceux du Soleil et de la Lune, avec le prochain événement du ciel pour titre ; le plein écran au toucher, où seul le doigt tourne la vue, avec l'étiquette de visée, l'avis de jour et la fenêtre des sources ; le halo des noms et les noms tenus dans le cadre. Onze gardes, huit fautes éprouvées. Une collision de classe rendait le bandeau transparent : `ci-etoiles` servait déjà au ciel du Soleil. Reste la retouche de l'heure du titre qui recouvre le repère « SE » du bandeau. Prochain lot : le choix de ce qui s'affiche |
| 22 septembre 2026 | Écran des étoiles, lot deux, commit `0aa5cc2` : choix des étoiles affichées en plein écran, les plus visibles par défaut, 523 étoiles au lieu de 5070 ; fichier du ciel régénéré avec les 749 étoiles des figures marquées et les noms latins officiels ; bandeau sans points cardinaux, l'heure du titre recouvrant « SE ». Six gardes, six fautes éprouvées. Prochain lot : les informations sous le bandeau |
| 22 septembre 2026 | Écran des étoiles, lot trois, commit `96e787d` : sous le bandeau, « Cette nuit » avec la nuit noire, la plus longue éclaircie d'après la nébulosité de la prévision et la Lune, « À voir ce soir » avec les cinq constellations les plus hautes au début de la nuit noire, « Étoiles filantes » avec le prochain des huit grands essaims. Huit gardes vérifiées sur des dates dont on connaît le ciel, six fautes éprouvées. Prochain lot : la fiche d'une constellation au toucher en plein écran |
| 22 septembre 2026 | Écran des étoiles, lot quatre, commit `ce8e0ed` : la fiche d'une constellation au toucher bref en plein écran, la figure désignée se détachant. Faits calculés : noms français et latin, hauteur et direction, heures de visibilité pendant la nuit noire, étoile la plus brillante, dite quand elle ne se lève jamais ici, et mois du passage à minuit. Six gardes, six fautes éprouvées, dont une qui a renforcé la garde du glissement. Prochain lot : le ciel sous l'horizon vu à travers l'eau |
| 22 septembre 2026 | Écran des étoiles, lot cinq, commit `3faaec8` : sous l'horizon, une étendue d'eau à travers laquelle se devinent les étoiles et les figures d'en dessous, pâlies et floutées. Le flou vient d'un dégradé radial par étoile, non du filtre de la toile que Safari ne gère que depuis peu : même rendu partout et vérifiable. Le module rend sur demande ce qui est sous l'horizon, marqué ; sans demande le contrat d'origine tient. Trois gardes, quatre fautes éprouvées. Reste le lot six : le curseur de temps, la Lune et les planètes |
| 22 septembre 2026 | Écran des étoiles, lot six et dernier, commit `0b83c67` : les cinq planètes visibles à l'œil nu entrent dans `astres.js` par leurs éléments d'orbite, la Lune et elles se posent parmi les étoiles, et un curseur parcourt la nuit par pas de cinq minutes. Deux recoupements indépendants : l'écart avec la série du Soleil vaut la précession depuis 2000, et l'opposition de Saturne tombe le 4 octobre 2026. Six gardes, cinq fautes éprouvées, deux gardes reprises après avoir échoué sur le code sain. Jalon 9 clos, 792 contrôles verts |
| 22 septembre 2026 | Trois collisions de noms sur ce jalon, toutes de même nature, un nom déjà pris ailleurs : `ci-etoiles`, `depart`, `ci-temps` avec son identifiant. La dernière aurait déplacé la chronologie de l'écran du temps. Une garde qui refuserait deux règles de style portant le même nom de classe reste à écrire |
| 23 septembre 2026 | Jalon 10 ouvert, l'accueil de la journée : bande horaire, chiffres du jour sur une ligne, ciel réduit, tableau des 24 heures lisible, « Le temps » en page de détail et barre à quatre onglets. Six lots, section 10c |
| 23 septembre 2026 | Jalon 10, lots 1 et 2 publiés ensemble, commit `1d1ab3d` : bande horaire sous les avis urgents, ciel de l'accueil ramené de 306 à 250 points, quatre chiffres du jour sur une ligne au titre 3 avec l'unité plus petite. Sous un avis, la bande doit rester dans le premier écran et les chiffres la suivent ; sans avis, les deux tiennent. Dix gardes, huit fautes éprouvées |
| 23 septembre 2026 | Jalon 10, lot 3 : la bande emploie la règle de pluie de la suite de la page, `plagesDe` sur la lame d'eau d'un dixième de millimètre, et les deux blocs disent les mêmes heures ; deux gardes et deux fautes. Lot 4 révisé sans code : les portes restent sous les chiffres du jour, décision écrite dans le code et conforme à la troisième maquette |
| 23 septembre 2026 | Jalon 10, lot 5, commit `d96458e` : « Le temps » en page de détail depuis l'accueil. Le glissement du ruban, relevé saccadé sur l'appareil : la translation revenait à zéro avant le rendu, les courbes reculaient avant de sauter ; le dessin reste désormais à l'heure entière où le rendu le pose. Six gardes, cinq fautes éprouvées, passe complète verte à 871 contrôles. Reste le lot 6, les quatre onglets, après quelques jours d'usage |
| 23 septembre 2026 | Leçon d'outillage répétée deux fois dans la journée : un ordre d'arrêt par motif de ligne de commande arrête aussi la commande qui le porte quand le motif y figure. Ne jamais employer `pkill -f` avec un motif présent dans la commande courante |
| 23 septembre 2026 | Version 78, commit `f7d8afd` : numéro de version dans les réglages, recherche d'une version plus récente à l'ouverture et au retour au premier plan, bandeau qui propose de recharger. Seule une version supérieure fait paraître l'offre. Le numéro est écrit dans `sw.js` et dans `src/version.js`, une garde vérifie qu'ils concordent : il faut monter les deux ensemble. Le service worker redemande la coque sans le cache du navigateur, que GitHub remplit pour dix minutes. Deux défauts corrigés : un onglet qui refermait la page de détail laissait son pas d'historique, et une feuille refermée gardait son contenu masqué dans la page |
| 24 septembre 2026 | Version 79, commit `6f1fc03` : la suite du ruban paraît pendant le glissement. La découpe était posée sur le groupe qui glisse et glissait avec lui ; elle est portée par un groupe fixe. La garde se vérifie doigt posé, une zone découpée ne recevant pas le pointeur |
| 24 septembre 2026 | Version 80, commit `80f14f9` : le ruban garde en paysage la densité du portrait. La largeur du dessin, fixe à 358 unités, s'étirait sur 764 points ; elle suit désormais l'écran à 0,888 point par unité, le portrait restant inchangé. Passe complète verte, 881 contrôles |
| 24 septembre 2026 | Décision de Jérôme : la redondance entre la phrase de la bande horaire et les lignes de pluie ou de rafales des conseils du jour et de « Demain et après-demain » est gardée pour le moment |
| 24 septembre 2026 | Version 81, commit `5dbf926`, demandée par Jérôme : les chiffres du jour passent avant la bande horaire, et les quatre portes se rangent en grille de deux sur deux sous la bande. Ordre de l'accueil : ciel, avis urgents, chiffres du jour, bande, portes, conseils du jour, 24 prochaines heures, demain. Tout reste dans le bloc « Aujourd'hui », l'accueil se lisant en trois blocs de temps. Sous un avis de vigilance, la bande tient encore dans le premier écran. Passe complète verte, 882 contrôles |
| 24 septembre 2026 | Version 82, commit suivant la version 81, demandée par Jérôme : les quatre portes ferment l'accueil en grille de deux sur deux, après « Demain et après-demain ». Ordre de l'accueil : ciel, avis urgents, chiffres du jour, bande horaire, conseils du jour, 24 prochaines heures, demain, portes, sources. Passe complète verte, 883 contrôles |
| 24 septembre 2026 | Jalon 11 ouvert, l'accueil en second dessin d'après une troisième maquette : huit tuiles couvrant tous les paramètres suivis après la bande et les conseils, conseils en deux lignes, une ligne de vent dans la bande, département sous la commune, cartes arrondies à 24 points, sans photo. Le conteneur de travail a été réinitialisé le même jour ; le dépôt a été recloné au commit `f55727f` |
| 24 septembre 2026 | Jalon 11, lot 1, commit `9e0b1ba`, version 83 : huit tuiles sur deux colonnes, Ressenti, Pluie, Vent, Ciel, Humidité, Indice UV, Pression et Air, chacune vers son détail. Défaut trouvé par la passe : la bande, restée précédée d'un « + » isolé, était lue comme un nombre et disparaissait de l'accueil. La tuile de l'air partage l'attribut de la porte « L'air qu'on respire » ; les contrôles visent désormais la porte explicitement. Passe complète verte, 884 contrôles |
| 24 septembre 2026 | Jalon 11, lot 2, commit `1a57a26`, version 84 : conseils en deux lignes, titre et précision, chacun vers son détail. L'écriture des plages devient la fonction pure `ecrirePlage` : « toute la journée d'après-demain » au lieu de « de après-demain 00 h à 00 h ». La phrase entière de chaque conseil reste dans `data-phrase`, que les contrôles lisent désormais. Passe complète verte, 887 contrôles |
| 24 septembre 2026 | Jalon 11, lot 3, commit `9880269`, version 85 : une ligne de vent fléchée dans la bande, rafales seulement fortes, colonne du moment présent sur fond léger. La flèche devient le module partagé `src/fleche.js` ; les flèches du ruban montraient d'où venait le vent, à l'inverse de leur commentaire, et sont remises dans leur sens. Erreur corrigée avant publication : `src/vent.js`, les particules de la carte, avait été écrasé par la flèche, et ajouté deux fois à la coque ; une garde vérifie désormais l'absence de doublon dans la coque. Passe complète verte, 892 contrôles |
| 24 septembre 2026 | Règle d'outillage : créer un fichier par l'outil de création, qui refuse d'écraser, ou vérifier d'abord que le nom est libre. `cat >` remplace sans prévenir. Troisième collision de noms de la série, après `ci-etoiles` et `ci-temps` |
| 25 septembre 2026 | Jalon 11, lot 4, commit `99b2dfb`, version 86 : le département sous la commune, déduit du code postal et nommé par la table de la vigilance, sans grandir la barre ; cartes de l'accueil arrondies à 24 points. Le second dessin de l'accueil est complet, lots 1 à 4. Reste le lot 5, les quatre onglets, qui est le lot 6 du jalon 10. Passe complète verte, 894 contrôles |
| 25 septembre 2026 | Jalon 10, lot 6, et jalon 11, lot 5, commit `884ed21`, version 87 : quatre onglets, Accueil, La semaine, Le ciel, La carte. « Le temps » s'ouvre en page de détail depuis la bande, les tuiles et les conseils, dans l'onglet où l'on se trouve ; le retour prend la place de la commune dans la barre de tête, comme dans iOS. Les jalons 10 et 11 sont clos. Passe complète verte, 894 contrôles |
| 25 septembre 2026 | Jalon 12 ouvert : La semaine améliorée en six points, dont le niveau de confiance sur chaque ligne et un graphique de tête ; second dessin étendu aux autres écrans ; mode sombre vérifié ; justesse publiée préparée. Sept lots, section 12b |
| 25 septembre 2026 | Jalon 12, lots 1 et 2, commit `e5ac516`, version 88 : mode sombre de l'accueil vérifié sans retouche ; confiance sur chaque ligne de La semaine en un mot, barre estompée aux jours moins sûrs. Passe complète verte, 896 contrôles |
| 25 septembre 2026 | Jalon 12, lot 3, commit `ec4b7c7`, version 89 : graphique de tête de La semaine, courbes des maximums et des minimums, pluie en pied, jours passés atténués, largeur bornée à 520 points. Passe complète verte, 899 contrôles |
| 25 septembre 2026 | Jalon 12, lot 4, commit `31bf347`, version 90 : les grandes lignes de La semaine, trois phrases au plus par gravité, tirées de la fonction pure `grandesLignes`. La charge quotidienne ne porte pas les rafales : le vent se juge sur sa vitesse moyenne la plus forte. Passe complète verte, 903 contrôles |
| 27 septembre 2026 | Jalon 12, lot 5, commit `4615b49`, version 91 : « Voir les heures » ouvre le ruban au minuit de la journée ; week-end sur fond léger ; rafales fortes sur la ligne seulement sans pluie, la rangée ne dépassant pas deux lignes ; cartes arrondies. Trois gardes anciennes ont refusé le premier essai et ont été suivies : hauteur des rangées, décompte des moments du volet, arrondis en jetons. La semaine est complète. Passe complète verte, 905 contrôles |
| 27 septembre 2026 | Jalon 12, lot 6, version 92 : second dessin étendu à toute l'application par deux règles générales, arrondi de 24 points pour toute carte, pastille teintée sous le premier symbole de chaque rangée. Passe complète verte, 907 contrôles |
| 27 septembre 2026 | Jalon 12, lot 7, commit `76f3392`, version 93 : carte « Justesse des prévisions » dans les réglages, écart moyen, part à 2° près, nombre de relevés et biais par échéance, tirés de la fonction pure `bilan` du journal ouvert le 28 août ; soixante jours relevés assiéront les chiffres, vers la fin octobre. Le jalon 12 est clos. Passe complète verte, 910 contrôles |
| 27 septembre 2026 | Version 94, commit `be991f3`, demandes de Jérôme : l'accueil ne parle que de demain, après-demain se lit dans La semaine seulement ; la carte de la justesse perd ses phrases sur le délai. La pression nomme désormais sa journée hors du jour même. Passe complète verte, 911 contrôles |
| 28 septembre 2026 | Version 95, commit `15132d1` : le ciel couvert se peint en bancs de nuages. Quand la couche se ferme, un plafond de cinq rangées de nuages aplatis, larges en haut et plus petits vers l'horizon, remplace la nappe floutée qui se lisait comme une vitre sale. La garde mesure la structure du ciel fermé, 3,6 de jour et 2,3 de nuit contre 1,2 pour l'ancienne nappe. Aucune garde existante n'a réagi |
| 28 septembre 2026 | Version 96, commit `a914ba9`, sur une photo du ciel réel envoyée par Jérôme : le couvert de plein jour est clair. Le plafond prend un poids, le plus fort du plomb de l'eau et de la nuit, qui règle ses teintes ; les voiles de lisibilité, presque noirs sur la moitié du cadre, se resserrent sur le texte en bleu-gris. L'encart de la réponse passe à 42 % de matière ; les tuiles du plafond se posent au point entier. Passe complète verte, 914 contrôles |
| 28 septembre 2026 | Leçon : juger un ciel peint sur le rendu complet, voiles de lisibilité compris, et le comparer à une photo du ciel réel. La toile seule ne distinguait l'avant de l'après que de 196 à 208 en clarté ; les voiles faisaient l'essentiel du noir |
| 28 septembre 2026 | Version 97, commit `e16a27f` : le vent et la quantité de pluie sur le graphique de La semaine. Jalon 13 ouvert : seize jours de prévision et deux modèles de scénarios, ICON et ECMWF, avec une confiance mixte sur leur recouvrement |
| 28 septembre 2026 | Jalon 13, lot 1, commit `59f95f8`, version 98 : seize jours de prévision quotidienne, les heures restant à sept jours ; graphique à défilement au-delà de dix journées. Passe complète verte, 917 contrôles |
| 28 septembre 2026 | Jalon 13, lots 2 et 3, commit `0ef2537`, version 99 : scénarios quotidiens d'ICON et d'ECMWF en une seule requête, module `src/scenarios.js` ; confiance mixte jusqu'au quinzième jour, seuils à 4 et 7 degrés ; volet comparant les deux modèles. Le faux service des contrôles rend désormais une charge quotidienne. Passe complète verte, 922 contrôles |
| 28 septembre 2026 | Version 100, commit `08d46fc` : au-delà des sept jours d'heures, les journées couvertes par ECMWF se déplient sur leur phrase de confiance, la comparaison des modèles se lisant ainsi jusqu'au quinzième jour ; le seizième reste fixe. La faute de la requête à sept jours est vue. Passe complète verte, 923 contrôles |
| 28 septembre 2026 | Jalon 13, lot 4, commit `47287b3`, version 101 : la tendance de la semaine suivante en une ligne, fonction pure `tendanceSuivante`, plus chaude ou plus fraîche au-delà de deux degrés d'écart. Le jalon 13 est clos. Passe complète verte, 924 contrôles |
| 28 septembre 2026 | Trois jalons ajoutés à la demande de Jérôme : 14, la comparaison dans le temps et entre lieux ; 15, la météo des plages ; 16, la météo des neiges. Sources vérifiées le jour même : archive depuis 1940, API marine, neige à l'altitude des stations |
| 28 septembre 2026 | Décisions de Jérôme sur les jalons 15 et 16 : une plage est proche à une heure de voiture au plus, durée donnée par le service OSRM avec une estimation à vol d'oiseau en secours ; la porte de la neige paraît de novembre à avril, et au-delà tant que la neige tient au sommet d'une station proche |
| 28 septembre 2026 | Jalon 16 : une station de ski est proche à une heure de voiture au plus, comme une plage, confirmé par Jérôme |
| 28 septembre 2026 | Ordre retenu par Jérôme : jalon 14, la comparaison, puis 16, la neige, puis 15, les plages. La justesse publiée, jalon 6, s'ouvre vers la fin octobre quand ses soixante jours de relevés sont réunis |
| 28 septembre 2026 | Jalon 14 mis en pause à la demande de Jérôme, lot 1 écrit et non vérifié, rangé sur la branche `jalon-14-comparaison`, commit `efbb72e`. `main` et la version en ligne restent à la 101 |
| 28 septembre 2026 | Jalon 17 livré, commit `5441d81`, version 102 : La semaine replie au quinzième jour et déplie d'un « Voir plus » le seizième jour puis la tendance de GFS jusqu'au trente-quatrième. Passe complète verte, 928 contrôles. La branche du jalon 14 devra être raccordée à cette version à sa reprise |
| 28 septembre 2026 | Version 103, commit `af35d85`, trois demandes de Jérôme : l'onglet « La semaine » devient « À venir » ; le plafond du ciel couvert glisse à une abscisse fractionnaire dans une bande sans couture, sans les à-coups du calage au point entier ; le déplacement des lieux enregistrés suit le doigt, fait glisser les autres rangées, défile près des bords et bloque le défilement de Safari pendant la prise. Passe complète verte, 931 contrôles |
| 28 septembre 2026 | Version 104, commit `76faeb2`, demande de Jérôme : la page « Le temps » devient « Heure par heure » ; un bandeau collant porte le jour et les heures toutes les trois heures en tête du ruban ; un trait continu marque chaque minuit sur toute la pile des voies. Passe complète verte, 934 contrôles |
| 29 septembre 2026 | Jalon 14 repris, lot 1 publié, commit `f9b4c0e`, version 105 : la semaine en cours face aux mêmes dates d'une autre année, dans la feuille du climat ; jeton contre les réponses périmées ; gardes de l'archive distinguant les lectures par leurs dates. Passe complète verte, 938 contrôles |
| 29 septembre 2026 | Jalon 14, lot 2, commit `def48c7`, version 106 : la comparaison entre lieux, tous lus en une requête à la même source. Passe complète verte, 941 contrôles |
| 29 septembre 2026 | Outil : le script d'épreuve distingue désormais une épreuve interrompue avant sa garde d'une faute non vue. Une copie de travail effacée pendant une épreuve avait fait conclure à tort qu'une faute passait inaperçue |
| 29 septembre 2026 | Jalon 14 clos par Jérôme, sans ligne de comparaison sur l'accueil. Prochain dans l'ordre retenu : jalon 16, la météo des neiges, dont la porte s'ouvre en novembre |
| 30 septembre 2026 | Version 107, commit `3c8333f` : la comparaison choisit une période passée, lue dans l'archive jusqu'à hier, ou à venir, lue dans la prévision dès demain, jamais les deux mêlées. Passe complète verte, 944 contrôles |
| 30 septembre 2026 | Leçons d'outillage : le service de prévision a refusé les requêtes de l'application depuis le conteneur, code 429, quota gratuit épuisé par les essais du jour ; trois suites de contrôle en parallèle dépassent la mémoire de la machine, deux tiennent ; les processus de fond ne survivent pas au changement de tour |
| 30 septembre 2026 | Jalon 16 ouvert : stations de France et des pays voisins, liste construite par script depuis OpenStreetMap et un modèle de terrain. Quatre lots |
| 30 septembre 2026 | Jalon 16, lots 1 et 2, commit `43cef77`, sans changement visible : 432 stations de France et des pays voisins, tri à une heure de route par OSRM. Sur les données réelles, 15 stations à moins d'une heure de Grenoble, 11 de Pontarlier, aucune de Montbard. Reste à choisir la présentation des grands domaines reliés, comme les Trois Vallées, à côté des stations qui les composent |
| 30 septembre 2026 | Jalon 16, décision de Jérôme : les stations regroupées sous leur domaine. Le regroupement se déduit des emprises d'OpenSkiMap, faute de lien explicite : 33 stations sous 12 domaines, éprouvé sur les Trois Vallées, Paradiski et les Portes du Soleil |
| 30 septembre 2026 | Jalon 16, décision de Jérôme sur l'accès : porte large au-dessus de la grille des portes de l'accueil, et un conseil sur les chutes notables |
| 30 septembre 2026 | Jalon 16 clos, commit `5b58a33`, version 108 : la porte large et la feuille de la neige, le conseil de chute notable, la saison. La garde de la coque hors ligne a relevé deux modules manquants. Passe complète verte, 953 contrôles. Prochain dans l'ordre retenu : jalon 15, les plages |
| 30 septembre 2026 | Jalon 15 ouvert : la saison des plages, de juin à septembre et au-delà tant que l'eau dépasse 20°. Quatre lots |
| 30 septembre 2026 | Jalon 15, lots 1 et 2, sans changement visible : 2 152 plages de la liste officielle européenne des eaux de baignade, tri à une heure de route. Sources écartées : Overpass indisponible, ohsome refusé, service d'adresses tombé en pleine construction. Les communes des plages restent à compléter |
| 30 septembre 2026 | Jalon 15, lot 3, commit `d61070c`, version 109 : la porte et la feuille de la plage, marées situées entre deux heures, qualité de l'eau classée et fiche du ministère. La garde du Soleil, sensible à l'horloge qui avance entre deux lectures, tolère trois dixièmes de point. Passe complète verte, 961 contrôles |
| 30 septembre 2026 | Version 110 : jalon 15 clos, créneaux de baignade et direction du vent. Les drapeaux du jour ne sont publiés que par des applications municipales ou commerciales, sans données ouvertes. Passe complète verte, 963 contrôles |
| 30 septembre 2026 | Nouvelle demande de Jérôme : sur la carte, VigiEau en nappe, et la plage, la neige et les prévisions en superpositions |
| 30 septembre 2026 | Jalon 18 ouvert, les nouvelles couches de la carte et l'eau. Décisions de Jérôme : VigiEau en nappe, toutes ressources confondues ; superpositions « Prévisions », avec matin, après-midi, soir et lendemain, « Plages » et « Neige » ; une tuile « L'eau » sur l'accueil, restriction de la commune et état de la nappe la plus proche, et une ligne de conseil quand une restriction est en vigueur. L'état des nappes se recalcule pour le piézomètre le plus proche, faute d'indicateur publié ; pas de nappe nationale des nappes phréatiques sur la carte |
| 30 septembre 2026 | Jalon 18 élargi par Jérôme, « tout ce qui est possible de brancher ». Lots : 1, la nappe « Restrictions d'eau » (VigiEau) ; 2, la tuile et la feuille « L'eau » : restriction de la commune, nappe phréatique la plus proche, rivière la plus proche (hauteur, tendance, débit par rapport à la saison), température de la rivière, étiage observé l'été (ONDE), humidité des sols et conseil d'arrosage ; 3, les superpositions « Prévisions » (matin, après-midi, soir, lendemain), « Plages », « Neige » et « Cours d'eau ». Écartés : la vigilance crues, Vigicrues refusant les requêtes des autres applications ; Géorisques, injoignable depuis le poste de développement, à revérifier ; la météo des forêts et les avalanches, réservées au portail à clé de Météo-France, à revérifier |
| 30 septembre 2026 | Jalon 18, lot 1, version 111 : la nappe « Restrictions d'eau » sur la carte, VigiEau toutes ressources confondues, palette propre, vigilance météo en liseré. Passe complète verte, 966 contrôles |
| 30 septembre 2026 | Jalon 18, lot 2, première partie, version 112 : la tuile, le conseil et la feuille « L'eau », restriction de la commune et nappe phréatique la plus proche. Défaut corrigé : les conseils de la neige et de l'eau dépassaient la limite de trois lignes par bloc. Filet commun des contrôles contre le réseau réel. Passe complète verte, 971 contrôles |
| 30 septembre 2026 | Jalon 18, lot 2, deuxième partie, version 113 : la rivière la plus proche dans la feuille de l'eau, hauteur, tendance, débit et situation pour la saison. Passe complète verte, 973 contrôles |
| 30 septembre 2026 | Demande de Jérôme : ne plus employer le mot « garde » ; dire « contrôle » pour un test automatique et « erreur volontaire » pour une erreur introduite exprès afin de vérifier qu'un contrôle la détecte |
| 30 septembre 2026 | Jalon 18, lot 2, troisième partie, version 114 : l'étiage d'été (réseau ONDE) et la température de la rivière dans la feuille de l'eau. Le contrôle de jointure du ciel couvert, trop sensible aux bords de nuages, mesure désormais la cassure d'un point à son voisin sur quatre lignes sur cinq, avec une erreur volontaire qui le prouve. Passe complète verte, 975 contrôles |
| 30 septembre 2026 | Jalon 18, lot 2 clos, version 115, commit `27a033d` : le sol et l'arrosage complètent la feuille de l'eau (restriction, nappe, rivière, étiage, température de l'eau, sol). Passe complète verte, 977 contrôles. Reste le lot 3, les superpositions de la carte |
| 1er octobre 2026 | Jalon 18, lot 3, première superposition, version 116 : les prévisions des villes sur la carte, matin, après-midi, soir et lendemain ; panneau des couches à quatre interrupteurs par rangée. Passe complète verte, 980 contrôles. Restent les plages, la neige et les cours d'eau |
| 1er octobre 2026 | Jalon 18, lot 3, version 117 : la mer des plages et la neige des grands domaines sur la carte ; la neige et la mer passent avant les prévisions ; panneau à cinq interrupteurs par rangée. Passe complète verte, 982 contrôles. Reste la superposition des cours d'eau |
| 1er octobre 2026 | Jalon 18 clos, version 118, commit `6dad841` : les cours d'eau sur la carte, lus à partir d'un zoom de l'ordre du département, hauteur de chaque station et sens de variation sur six heures. Défaut d'arrondi corrigé, 305 mm s'affichant 0,30 m. Passe complète verte, 984 contrôles |
| 1er octobre 2026 | Projet transféré de claude.ai dans Claude Code, sur le Mac de Jérôme. Publication par `git push`, avec l'identifiant de GitHub CLI rangé dans le trousseau du Mac |
| 1er octobre 2026 | Version 119 : une feuille refermée avant la première image de son ouverture restait ouverte sans entrée d'historique, et une feuille rouverte dans les 260 ms de sa fermeture se perdait. L'état d'ouverture se lit désormais sur la vue courante, et non plus sur l'attribut `hidden`. Défaut révélé par la première passe sur le Mac, plus rapide que le poste de claude.ai : la suite s'arrêtait au contrôle de la rivière. Un contrôle nouveau, qui retient l'image d'écran à la main ; erreurs volontaires 118 et 119 vues. `passe.sh` et `epreuve-bande.sh` bornent leur durée par `essais/borne.sh`, la commande `timeout` manquant sous macOS. Passe complète verte, 985 contrôles |
| 1er octobre 2026 | `LISEZ-MOI.md` : les noms d'écrans à jour, « Heure par heure » et « À venir », et le tableau des écrans réécrit d'après le code, quatre onglets, une page de détail et treize feuilles. Documentation seule |
| 1er octobre 2026 | Version 120, deux défauts relevés en relisant le code pour le LISEZ-MOI. La carte des réglages s'intitule « Écriture de la page « Heure par heure » » au lieu de « Écriture de l'écran Le temps ». Une tuile qui ouvre une feuille dit au lecteur d'écran celle qu'elle ouvre : toutes annonçaient « voir l'air qu'on respire », la tuile de l'eau comprise. Deux contrôles nouveaux, erreurs volontaires 120 et 121 vues. Passe complète verte, 987 contrôles |
| 1er octobre 2026 | Audit complet de la version 120, `docs/audit-2026-10-01.md` : cinq axes, sept lots proposés |
| 1er octobre 2026 | Audit, lot A, sans changement de l'application. Contrôles étanches au réseau : OSRM et Météo-France coupés d'office, un filet refuse toute autre requête réelle, un contrôle nouveau le juge, erreur volontaire 122 vue. `package-lock.json` suivi et Playwright figé à 1.63.0. Changement d'heure vérifié sur deux réponses réelles d'Open-Meteo : un seul décalage par réponse, 24 heures par jour. Passe complète verte, 988 contrôles |
| 1er octobre 2026 | Version 121, constat 1.9 de l'audit : les heures d'Open-Meteo recalées sur l'heure de Paris. Le service écrit toute une réponse avec le décalage du moment de la requête ; une prévision lue avant le 25 octobre aurait montré les heures suivantes en retard d'une heure. La fonction `recaler` de `src/horloge.js` est appliquée à chaque lecture ; l'heure en double du passage à l'heure d'hiver est retirée, et les quatre moments du jour de l'heure d'été attendent ses vingt-trois heures. Deux contrôles nouveaux, erreurs volontaires 123 à 125 vues. Passe complète verte, 990 contrôles |
| 1er octobre 2026 | Version 122, lot B de l'audit : la prévision gardée hors connexion ; plus de mélange entre deux communes pour la prévision, l'air, l'ensemble et les scénarios ; une panne de VigiEau n'est plus « Aucune » restriction ; la comparaison avec une autre année marche en janvier ; le retour dans l'application relit après un échec ; l'agent de service ne remplace plus une version par une copie incomplète, attend le réseau trois secondes au plus, ne sert la page en secours qu'aux navigations et garde le ciel des étoiles. Onze contrôles nouveaux, erreurs volontaires 126 à 138 vues. Passe complète verte, 1001 contrôles |
| 1er octobre 2026 | Version 123, lot C de l'audit, la confidentialité : la carte « Sources » nomme tous les services qui reçoivent le lieu et ne prétend plus qu'aucune donnée n'est envoyée ; en mode position, les services reçoivent la position arrondie au kilomètre et le service d'adresses à cent mètres, le relevé précis restant sur l'appareil ; les caches par lieu s'élaguent à vingt entrées ; un bouton efface les données de l'application sur l'appareil ; un lien d'arrêté n'entre qu'en https. Six contrôles nouveaux, erreurs volontaires 139 à 145 vues. Passe complète verte, 1006 contrôles |
| 1er octobre 2026 | Version 124, lot D de l'audit, l'accessibilité : température, ciel et vigilance lus avec leur valeur ; heures de la bande annoncées comme des boutons, avec leur ciel ; ciel et bornes lus dans le tableau et dans « À venir » ; texte tertiaire et bleu de la pluie à 4,5 de contraste au moins dans les deux thèmes ; zones de toucher de 44 points ; anciens noms d'écrans retirés des libellés et des descriptions. Huit contrôles nouveaux, erreurs volontaires 146 à 155 vues. Passe complète verte, 1014 contrôles |
| 1er octobre 2026 | Version 125, lot E de l'audit, première partie : rendus des sources secondaires regroupés en un par image ; un seul écouteur de redimensionnement pour la carte et pour le climat ; grilles de la carte gardées sur l'appareil ; densité des toiles plafonnée à 2. Quatre contrôles nouveaux, erreurs volontaires 156 à 159 vues. Passe complète verte, 1018 contrôles |
| 1er octobre 2026 | Version 126, lot E de l'audit, deuxième partie : animations du ciel, du feu et du relief arrêtées hors de l'écran ; plus de double boucle au retour au premier plan ; série de secours réduite à ses trois colonnes relues sur l'appareil. Trois contrôles nouveaux, erreurs volontaires 160 à 162 vues. Passe complète verte, 1021 contrôles |
| 1er octobre 2026 | Version 127, lot E de l'audit, constat 5.5 : la vigilance, la neige, les plages, la commune des plages et l'eau se gardent sur l'appareil, ce qui évite douze à vingt requêtes à chaque lancement. Cinq contrôles nouveaux, erreurs volontaires 163 à 167 vues. Passe complète verte, 1026 contrôles |
| 2 octobre 2026 | Version 128, lot E de l'audit, constat 5.1 en partie : les listes des plages et des stations se chargent à la première demande et sortent du chemin du premier affichage ; la coque les garde, et son contrôle suit les imports dynamiques. Un contrôle nouveau, erreurs volontaires 168 et 169 vues. Passe complète verte, 1027 contrôles |
