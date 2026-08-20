# Ma météo

En ligne : https://techthisapp.github.io/ma-meteo/

Application météorologique pour téléphone. Site statique installable, sans
service dorsal, sans base de données, sans compte. Métropole française.

## Contenu

| Écran | Ce qu'il porte |
|---|---|
| Accueil | Température, ciel, bornes du jour, quatre mesures, trois lignes de conseil, alertes au delà de la fenêtre, accès aux feuilles |
| Le temps | Vingt-quatre heures glissantes en trois écritures : ruban à sept voies, liste à treize colonnes, moments par tranches de six heures |
| La semaine | Sept jours, résumés des heures pour les deux premiers |
| La lumière | Arc du jour, lever, coucher, durée, écart à la veille, seuil de dix heures |
| Vigilance | Renvoi vers Météo-France, avec le motif du renvoi |
| Réglages | Commune, géolocalisation, écriture retenue, sources |

## Sources

| Source | Adresse | Compte |
|---|---|---|
| Prévision | `api.open-meteo.com`, AROME de Météo-France forcé sur deux jours | Aucun |
| Commune | `api-adresse.data.gouv.fr` | Aucun |

Les deux répondent en origine croisée, ce qui a été vérifié depuis un navigateur
le 19 août 2026.

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
index.html          coque
styles.css          identité, mode sombre compris
manifest.webmanifest, sw.js, icones/
src/
  horloge.js        clé du jour, écriture des nombres, département
  previsions.js     charge Open-Meteo, fusion AROME, série horaire
  reglages.js       stockage local, recherche de commune, géolocalisation
  icones.js         codes de temps sensible, dessins
  conseils.js       les six règles et leurs seuils
  ruban.js          météogramme à sept voies
  ecritures.js      liste et moments
  vues.js           temps, semaine, vigilance, lumière, réglages
  app.js            amorçage, accueil, coque de la feuille
  reseau.js         reprise à attente croissante, gzip, listage S3
  vigilance.js      seau data.gouv, schéma réel, non branché
  postes.js         fichier départemental et geojson des postes, non branché
  reserve.js        les deux vues débranchées
essais/
  controle.mjs      quarante-deux contrôles en navigateur
  meteo.json        données figées au 18 août 2026, 9 h
```

Aucune dépendance à l'exécution. Playwright sert aux essais seulement.

## Essais

```
npm install playwright
npx playwright install chromium
node essais/controle.mjs
```

Le lanceur sert le dossier, fige l'horloge au 18 août 2026 à 9 h, détourne les
trois appels Open-Meteo vers `meteo.json` et coupe les sources data.gouv pour
éprouver le repli. Quarante-deux contrôles, dont l'absence de répétition entre
les alertes et les conseils, les sept voies du ruban, l'agrandissement d'une
voie, les treize colonnes de la liste, les vingt-quatre lignes de la fenêtre et
la nature du renvoi de vigilance.

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
