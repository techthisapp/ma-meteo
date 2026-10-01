# Ma météo, jalon 7 : l'air, le pollen, le sol

Dépôt `techthisapp/ma-meteo`, à partir de `4bab7b4`. Mesures faites et arbitrages rendus le 3 septembre 2026. Air et pollens publiés le même jour en `a895077`, agent de service `ma-meteo-v40`. Le sol est écarté à la mesure, le pont vers Mon jardin est reporté.

## Ce que la source rend

Quatre relevés faits avant écriture, à Fain-lès-Moutiers.

| Mesure | Résultat |
|---|---|
| Air et pollens | Un seul appel à `air-quality-api.open-meteo.com`, sans compte, quatre-vingt-seize heures, onze colonnes, 1505 octets compressés |
| Portées | Sept jours pour l'air, quatre pour les pollens : la plus courte des deux est retenue, une seconde requête pour trois journées dont la feuille ne parle pas ne valant pas son appel |
| Colonnes de sol | 694 octets compressés par lecture, dont 79 sur la requête AROME, qui ne les publie pas et rend ses colonnes entièrement vides |
| Pollens du jour | Aulne, bouleau et olivier à zéro sur les quatre journées ; graminées de 0,1 à 2,9 ; ambroisie de 0 à 71,1 grains par mètre cube |

Deux choses que ces chiffres tranchent. La règle du silence par défaut n'est pas théorique : trois pollens sur six sont plats à zéro, et une file de zéros aurait occupé la moitié de l'écran. Et l'ambroisie dépasse le seuil de pic de la source le jour même de la livraison, ce qui veut dire que la fonction dit quelque chose dès sa mise en ligne.

## Les seuils, et d'où ils viennent

Aucun n'est inventé.

Les six niveaux sont ceux de l'indice européen de qualité de l'air, par pas de vingt : bon, moyen, dégradé, mauvais, très mauvais, extrêmement mauvais. L'indice rendu par la source est celui du polluant le plus mal placé, non une moyenne.

Les deux seuils de chaque pollen sont ceux que le service de pollens de Copernicus emploie lui-même pour délimiter la saison et le pic.

| Pollen | Saison | Pic |
|---|---|---|
| Aulne, bouleau, olivier, armoise | 10 grains/m³ | 100 grains/m³ |
| Graminées, ambroisie | 3 grains/m³ | 50 grains/m³ |

Trois états par taxon, et non une échelle continue : la source ne publie que deux bornes, et inventer des paliers intermédiaires donnerait une précision que la donnée n'a pas.

## Les cinq arbitrages

### 1. L'air se lit dans une feuille, ouverte par une troisième porte

Une porte sur l'accueil, à la suite de « Quand faire quoi » et d'« Où est le beau temps ». Les trois se suivent, partagent leur gabarit et se lisent comme une famille : quand, où, quoi.

L'autre voie était une huitième voie dans le ruban. Elle est écartée : le ruban en porte déjà sept, et la qualité de l'air bouge lentement quand le ruban est fait pour ce qui bouge d'heure en heure.

### 2. L'air entre dans l'aération comme une condition

La règle d'aération gagne une condition et garde son principe : le premier créneau qui convient, comme les cinq autres activités. L'autre voie, choisir l'heure la plus propre de la journée, aurait fait diverger cette règle des cinq autres pour un gain que rien ne mesure.

Une heure dont l'air est inconnu reste acceptable : l'absence de donnée n'est pas une raison de refuser, et une source muette rend simplement à la règle sa forme d'avant.

### 3. Le profil d'allergies, tous suivis au départ

Six interrupteurs dans les réglages. Ce sont les pollens muets qui sont gardés, non les suivis : la liste vide vaut donc tous. Un profil vide au départ ferait une fonction invisible tant que personne n'ouvre les réglages, et une liste de suivis deviendrait fausse le jour où un pollen s'ajoute à la source.

Le profil décide de ce qui remonte dans ce qui est à savoir, non de ce que la feuille montre : elle montre tout ce qui est en saison, et la note le dit.

C'est une donnée de santé. Elle reste sur l'appareil et n'entre dans aucune requête : les six pollens sont demandés à la source quoi qu'il arrive, et le tri se fait à la lecture. Un contrôle compare les colonnes demandées avant et après un retrait.

### 4. Le sol, écarté à la mesure

L'arbitrage rendu avant mesure donnait l'humidité du sol comme mesure décidant de l'arrosage, le bilan d'eau restant la raison écrite. La mesure l'a renversé, comme elle avait renversé l'arbitrage du séchage au jalon 3.

Un seuil absolu d'humidité volumique dépend de la texture du sol, laquelle change d'un point de grille à l'autre ; le bilan d'eau, lui, est une différence de deux flux et n'en dépend pas. Le bilan garde donc la décision.

Le second usage était une gelée au sol, pour compléter la règle de gel de l'air. Relevé sur trois cent soixante-cinq journées, du 1er septembre 2025 au 31 août 2026 : la couche de zéro à sept centimètres est descendue à zéro degré ou moins dix-neuf fois, l'air est descendu à un degré ou moins quarante-sept fois, et le sol n'a jamais gelé une journée où l'air ne gelait pas. La règle serait une seconde garde pour un fait que la première porte déjà, ce que le dépôt refuse.

Ce qui rouvrirait la question : la couche de surface du modèle de prévision, plus froide que la couche de zéro à sept centimètres les nuits claires, n'est pas publiée par l'archive et n'a pas pu être mesurée. Une source d'archive qui la porte permettrait de compter les nuits où elle gèle seule.

### 5. Le pont vers Mon jardin, reporté

Les deux applications sont servies depuis le même domaine et partagent donc leur réserve locale, ce qui rend la lecture des plantes possible sans aucun service. C'est un couplage entre deux produits, et il mérite sa propre décision.

## Contrôles

Dix-huit contrôles, huit fautes rétablies et vues, consignées dans `essais/epreuve-air.sh`.

| Contrôle éprouvé | Faute rétablie |
|---|---|
| Un air dégradé le matin repousse l'aération après lui | rendre l'aération aveugle à l'air |
| Seul un pollen en saison paraît | retirer le seuil de saison |
| Une saison sans pic ne se dit pas | faire parler la règle dès la saison |
| Le même pollen retiré du profil ne se dit plus | ne pas appliquer le profil aux faits marquants |
| Un air ordinaire ne se dit pas | dire l'air en deçà du niveau dégradé |
| Le profil n'entre dans aucune requête | ne demander que trois pollens sur six |
| Le pire moment se dit avec son heure | rendre la première heure au lieu du maximum |
| Le pire moment ne se répète pas quand c'est le moment présent | écrire la rangée dans tous les cas |

La charge d'essai porte quatre profils d'air : l'ordinaire, un après-midi dégradé, un matin dégradé et un pic d'ambroisie. Deux contextes qui ne diffèrent que par le profil servi prouvent chacune des règles, ce qui écarte le hasard d'une charge favorable.

## Procédure

`node essais/controle.mjs` doit passer en entier avant chaque commit. Le commit est signé `Claude <noreply@anthropic.com>`. `VERSION` de `sw.js` passe à la version suivante à chaque lot, et la coque hors ligne porte tout module nouveau, ce qu'un contrôle vérifie déjà.
