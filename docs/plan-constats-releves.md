# Plan des constats restés au stade du relevé

Plan du 2 octobre 2026, version 136. Il couvre les treize constats de
`docs/audit-2026-10-01.md` encore marqués « relevé ». Chacun a été revérifié
dans le code actuel ce jour-là : tous sont confirmés, et la vérification en a
trouvé de voisins, notés ci-dessous.

## Lot H1, justesse et maintenance

| Constat | Correction | Effort |
|---|---|---|
| 1.6 Une journée absente de l'archive compte comme sèche | Ne sommer la pluie que sur les journées où les deux périodes ont une valeur, calculer le seuil sur ce nombre, et dire quand l'archive est incomplète. Le même défaut existe dans la comparaison entre lieux, qui peut dire « sec partout » à tort | court |
| 1.11 Une valeur absente devient 0 | Dans « À venir », au-delà des jours d'heures, une température absente fait descendre l'échelle à zéro et s'écrit « 0° » ; même chose pour le graphique. Voisins : l'indice UV et le risque de pluie de l'accueil quand leur colonne manque, la hauteur de neige et l'isotherme d'une station. Ne garder que les valeurs finies, et taire ou marquer l'absence | court |
| 1.12 La feuille de l'air redemande Atmo à chaque rendu | Retenir la lecture en cours et l'échec pendant dix minutes. Voisins : la lecture d'Atmo n'est pas bornée dans le temps, contre la règle réseau de la version 129, et sa date est celle du téléphone | court |
| 6.8 Une même règle écrite à plusieurs endroits | Le dixième de millimètre est écrit en dur quatorze fois, le risque de 5 % sept fois : tout passe par les constantes. Les deux `SEUIL_RISQUE`, 5 % et 20 %, sont deux règles voulues ; celle de la bande prend un nom propre et un commentaire | court |
| 6.9 Neige et plages recopient la même logique de proximité | La présélection, les durées et la garde de trente jours passent dans `src/trajets.js`. Voisin : aucun contrôle ne vérifie qu'une estimation à vol d'oiseau n'est jamais gardée | court |

## Lot H2, accessibilité

| Constat | Correction | Effort |
|---|---|---|
| 4.6 Le focus se perd à chaque rendu | Rendre le focus au bouton d'ouverture quand une feuille se ferme, le reposer après chaque rendu sur l'élément de même identité, rendre l'arrière-plan inerte sous une feuille. Le rendu par section, qui réglerait le fond du problème, est long et risqué : il reste hors du lot | court |
| 4.8 Les marges latérales sont ignorées en paysage | Deux jetons tirés de `env(safe-area-inset-left)` et `right`, ajoutés aux marges de la barre d'onglets, du ruban, de la carte et du ciel plein écran. Rien ne change en portrait | court |
| 4.9 La carte et la voûte ne se lisent qu'à l'œil et au doigt | Un libellé de la carte qui dit la nappe et les couches affichées ; les prévisions des villes lisibles par VoiceOver ; des boutons pour déplacer la carte et tourner le regard dans la voûte ; la liste des objets du champ | moyen |
| 4.10 Les messages d'état se perdent | Une région d'annonce permanente, réécrite à chaque message, placée dans la feuille quand une feuille est ouverte | court |
| 4.12 Aucune espace insécable | Une passe sur les textes après chaque rendu, dans un module `src/typo.js`, hors des dessins SVG ; les contrôles comparent les textes après normalisation des espaces | moyen |

## Lot H3, sécurité et publication

| Constat | Correction | Effort |
|---|---|---|
| 2.5 Aucune politique de sécurité du contenu | Une balise meta qui n'autorise les scripts que du site et les appels qu'aux sources recensées ; un contrôle vérifie que toute adresse de `src/` y figure, un autre qu'aucun écran ne déclenche de refus | court |
| 2.6 Le jeton public de Météo-France peut être révoqué sans que rien ne le dise | Distinguer « service muet » de « rien à signaler » ; le dire selon la décision 1 ci-dessous, et marquer le repli de la pluie dans l'heure | court |
| 2.7 GitHub Pages publie tout le dépôt | Publication par GitHub Actions d'un artefact qui ne contient que l'application, après une suite verte ; changer la source de GitHub Pages dans les réglages du dépôt | court, et une décision |

Ordre proposé : H1, H2, H3, une version par lot. Chaque correction porte son
contrôle et son erreur volontaire.

## Décisions demandées

1. Vigilance illisible, constat 2.6 : la dire à l'accueil par une ligne
   discrète en pied de page, près de la source, en plus des réglages et de la
   légende de la carte.
2. Publication, constat 2.7 : passer à GitHub Actions. Une nouvelle version
   arriverait en quatre à six minutes au lieu d'une à deux, toujours après une
   suite verte. Le dépôt reste public : les notes se lisent toujours sur
   github.com.
3. Messages d'état, constat 4.10 : un message ordinaire reste quatre
   secondes, une erreur reste jusqu'au geste suivant.
4. Voûte étoilée, constat 4.9 : les boutons pour tourner le regard ne
   paraissent qu'au clavier et à VoiceOver, pour garder l'écran tel qu'il est.
5. Espaces, constat 4.12 : espace fine insécable avant « ; : ! ? % » et dans
   les guillemets, comme le veut l'usage français ; espace insécable ordinaire
   entre un nombre et son unité.
6. Pluie du ruban, constat 6.8 : les barres de pluie se dessinent dès
   0,05 mm mais la pluie ne s'écrit qu'à partir de 0,1 mm. Aligner le dessin
   sur 0,1 mm, une seule règle partout.

## Suivi

Décisions de Jérôme du 2 octobre 2026 : oui aux six propositions.

1. Lot H1 fait, version 137 : voir le suivi de `docs/audit-2026-10-01.md`.
