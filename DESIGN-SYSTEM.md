# Design system

Transposition web du design system iOS pour « Ma météo ». Le document de départ
est écrit pour SwiftUI ; ce qui suit dit comment chaque règle se réalise dans un
site statique, et ce qui ne se transpose pas.

## Direction

Trois principes commandent le reste.

1. Le contenu prime. Une seule action dominante par écran, peu de bordures, peu
   d'ombres, l'espace crée la hiérarchie.
2. La matière verre appartient à la navigation. Elle flotte au-dessus du
   contenu, elle ne le constitue pas.
3. Les valeurs brutes ne s'écrivent que dans le bloc de tokens de `styles.css`.
   Aucun écran ne porte `padding:17px` ni `border-radius:13px`.

## Architecture en trois couches

| Couche | Contenu | Réalisation |
|---|---|---|
| Contenu | 90 % de l'application : bandeau, conseils, séries, tables | `main#ecran`, fond `--fond`, défile sous la navigation |
| Navigation | Barre de tête et barre d'onglets | `.nav` et `.onglets`, position fixe, matière verre |
| Superposition | Réglages, vigilance, actions temporaires | `.feuille` et `.voile`, présentation en feuille |

Le contenu défile derrière les deux barres. Aucune surface de contenu ne porte
de `backdrop-filter` : un contrôle automatique le vérifie.

## Grille et espacement

Grille de 4 pt. Marge d'écran de 20 pt, 24 pt au delà de 560 px de large.

| Token | Valeur | Usage |
|---|---|---|
| `--espace-xs` | 4 | micro-espace |
| `--espace-sm` | 8 | icône et texte |
| `--espace-md` | 12 | éléments liés |
| `--espace-base` | 16 | espacement standard |
| `--espace-lg` | 20 | marge d'écran |
| `--espace-xl` | 24 | blocs |
| `--espace-2xl` | 32 | sections |
| `--espace-3xl` | 40 | séparation forte |
| `--espace-4xl` | 48 | grandes respirations |

## Typographie

Police du système uniquement, aucune police distante servie.

L'échelle est exprimée en `rem`. Sur Safari, `:root{font:-apple-system-body}`
place le corps de texte à la valeur choisie dans les réglages de taille du
système : toute l'échelle suit, puisque tout est relatif. Ailleurs, la racine
vaut 16 px et l'échelle se réduit d'environ 6 %.

| Style iOS | Token | Valeur à 17 px | Emploi |
|---|---|---|---|
| `.largeTitle` | `--texte-grand-titre` | 34 | titre d'écran |
| `.title2` | `--texte-titre2` | 22 | titre de section important |
| `.title3` | `--texte-titre3` | 20 | titre de feuille, état vide |
| `.headline` | `--texte-entete` | 17 | titre compact de la barre de tête |
| `.body` | `--texte-corps` | 17 | texte courant, rangées |
| `.callout` | `--texte-appel` | 16 | valeurs des mesures |
| `.subheadline` | `--texte-sous` | 15 | information secondaire |
| `.footnote` | `--texte-note` | 13 | titres de groupe, métadonnées |
| `.caption` | `--texte-legende` | 12 | notes |
| `.caption2` | `--texte-legende2` | 11 | libellés d'onglet, unités |

La règle des trois niveaux typographiques s'applique par bloc, non par écran.
Le bandeau du jour en emploie trois : le chiffre, le libellé du ciel, les bornes.
Une rangée en emploie deux. Un écran entier en additionne davantage, ce qui est
la conséquence normale d'un empilement de blocs conformes.

La graisse `--graisse-semibold` attire l'attention, non une taille
disproportionnée. Aucune capitale intégrale.

Deux familles échappent à l'échelle et le contrôle automatique les exclut : le
grand chiffre du bandeau, qui est un dessin, et les graduations tracées dans les
SVG du ruban.

## Couleurs

Toutes les couleurs sont sémantiques. Aucun écran n'écrit une valeur
hexadécimale.

| Token | Rôle iOS | Clair | Sombre |
|---|---|---|---|
| `--fond` | `systemGroupedBackground` | `#F2F3F7` | `#0B0F14` |
| `--surface` | `secondarySystemGroupedBackground` | `#FFFFFF` | `#171D24` |
| `--surface-2` | remplissage tertiaire | `#E9EBF0` | `#232B34` |
| `--etiquette` | `label` | `#16202B` | `#E6EBF0` |
| `--etiquette-2` | `secondaryLabel` | `#55636F` | `#A2AEB9` |
| `--etiquette-3` | `tertiaryLabel` | `#8B97A2` | `#75828E` |
| `--filet` | `separator` | `#D3D8DF` | `#333D48` |

Couleur de marque unique, `--accent`, `#2A6FB0` en clair et `#6BA8DC` en sombre.
Elle sert à l'action principale, à la sélection, à l'onglet courant et aux liens.
Elle ne colore pas l'interface.

Les couleurs fonctionnelles, `--succes`, `--attention`, `--erreur`, et les trois
niveaux de vigilance `--v2` à `--v4`, ne portent jamais seules une information :
le libellé la porte, la couleur la double.

Le contraste élevé renforce les étiquettes secondaires et les filets.

## Matière verre

La navigation emploie `--verre-fond` et `--verre-flou`. Le repli est automatique
dans trois cas :

1. `prefers-reduced-transparency: reduce` ;
2. `prefers-contrast: more` ;
3. absence de prise en charge de `backdrop-filter`.

Dans ces trois cas les barres deviennent des surfaces opaques avec un filet
plein. Aucun réglage manuel n'est proposé.

## Angles

| Token | Valeur | Emploi |
|---|---|---|
| `--rayon-sm` | 8 | petits remplissages |
| `--rayon-md` | 12 | alertes, contrôle segmenté, champs |
| `--rayon-lg` | 16 | groupes encartés |
| `--rayon-xl` | 20 | feuille |
| `--rayon-carte` | 24 | publié mais non instancié : aucun composant ici n'est un objet autonome |
| `--rayon-plein` | capsule | boutons pleins, poignée, message d'état |

## Zones tactiles

Aucune cible interactive ne descend sous 44 × 44 pt. Une icône peut mesurer
18 pt et porter une zone de 44 pt. Le contrôle automatique mesure toutes les
cibles visibles de l'écran et échoue si l'une d'elles est plus petite.

## Composants

### Boutons

| Rôle | Classe | Forme |
|---|---|---|
| Principal | `.bouton-plein` | capsule pleine, fond `--accent`, hauteur 50 pt |
| Secondaire | `.bouton-borde` | capsule sur `--surface`, texte `--accent`, hauteur 50 pt |
| Tertiaire | `.bouton-texte` | symbole et texte, sans surface, 44 pt de haut |

Une seule action dominante par écran. En cours de traitement, `aria-busy="true"`
neutralise le second appui. L'attribut `disabled`, ou `aria-disabled="true"`,
ramène l'opacité à 0,38 et coupe les événements de pointage.

Le rôle destructif n'est pas défini : l'application ne porte aucune action qui
détruise des données.

### Contrôle segmenté

`.seg`, piste `--piste`, segment courant `--piste-actif`. Le segment courant est
toujours le plus clair en thème clair et le plus haut en thème sombre.

### Rangée de liste

`.rangee`, très plate : icône facultative, titre, description facultative,
valeur ou chevron. Hauteur variable, jamais moins de 44 pt.

### Action de glissement

La rangée de commune, `.co`, porte son action de retrait sous elle, non à côté.
Trois chemins la découvrent : le glissement vers la gauche au doigt ou à la
souris, le menu contextuel par appui long ou clic droit, et le clavier, le
bouton restant dans l'ordre de tabulation et le focus découvrant la rangée.

Une action permanente par rangée aurait coûté une colonne de boutons sur toute
la liste, ce que le document écarte.

### Barre de tête

Elle porte la commune à gauche, sous forme de bouton à chevron, et les réglages
à droite. La commune s'y tient sur les cinq écrans : une seule cible, toujours
au même endroit. Le titre compact d'écran est retiré, la barre d'onglets disant
déjà où l'on se trouve.

### Symboles de temps

Deux groupes, `ic-a` pour la masse et `ic-b` pour l'accent, colorés par
`icoTemps`. Six teintes seulement, peu saturées. `ico` rend les mêmes dessins en
monochrome pour tous les autres emplois.

### Geste de lecture

Une surface qui se lit au doigt et qui défile doit trancher le geste, non le
confisquer. Le tri se fait au premier déplacement franc, sur l'angle : jusqu'à
quarante degrés de l'horizontale, c'est une lecture ; au delà, c'est un
défilement. La décision ne se remet pas en cause en cours de geste.

`touch-action: pan-y` laisse le défilement vertical au navigateur. La prise du
pointeur émet un `pointerleave` immédiat qu'il ne faut pas confondre avec une
fin de geste.

### Couleur d'information

Cinq classes, `v-froid`, `v-eau`, `v-attention`, `v-chaud`, `v-brulant`, posées
sur une valeur seulement quand elle passe un seuil. Colorer une valeur ordinaire
ferait du bruit et userait le signal.

Les symboles de sujet, `icv-*`, reprennent les mêmes teintes que les symboles de
ciel : la pluie est du même bleu partout.

### Composition de l'écran d'accueil

Un seul en-tête de section, « À retenir », réunit les conseils des vingt-quatre
heures et les alertes qui viennent au-delà. Trois en-têtes pour trois cartes
d'une ligne coûtaient un tiers de la hauteur sans rien porter de plus.

La vigilance n'a pas d'en-tête : c'est un accès, non une information.

Le titre d'écran remonte contre la barre de tête. Vingt points de vide sous une
barre qui ne porte qu'un symbole ne servaient rien.

### Groupe encarté

`.groupe`, alias `.carte`, unique surface du contenu, sans ombre. Il ne devient
pas la structure par défaut : le bandeau du jour vit directement sur le fond,
sans surface.

### Feuille

`.feuille`, poignée de glissement, fermeture au doigt au delà du quart de la
hauteur ou sur un geste rapide, fermeture par le voile, par Échap et par le
geste de retour du navigateur.

Deux accroches, faute d'équivalent web à `presentationDetents` :

| Accroche | Hauteur | Emploi |
|---|---|---|
| Intermédiaire, `.moyenne` | 56 svh | Vigilance |
| Pleine | 94 svh | Communes, Réglages |

Les Communes gardent la pleine hauteur bien que leur liste soit courte : le
champ d'ajout ouvre le clavier, qui prendrait la moitié d'une feuille
intermédiaire.

Fermée, la feuille sort de l'ordre de tabulation. La règle `[hidden]{display:none
!important}` est nécessaire : plusieurs composants portent un `display` explicite
qui l'emporterait sinon sur la règle de l'agent utilisateur.

### Champ de saisie

Étiquette toujours visible, le texte de substitution ne sert jamais d'étiquette.
L'erreur s'affiche sous le champ concerné, dans `.champ-erreur`, et pose
`aria-invalid` sur le champ. Aucune alerte globale.

## États

Chaque écran dépendant de données prévoit cinq états.

| État | Réalisation |
|---|---|
| Chargement | `.ossature` sur l'accueil, dont la forme est connue d'avance ; `.tourne` ailleurs. Jamais quand du contenu est déjà lisible |
| Chargé | contenu |
| Vide | `.etat-vide` : symbole, titre, une phrase, une action |
| Erreur | `.etat-vide` avec bouton « Réessayer » |
| Hors ligne | `.hors-ligne` en tête d'écran, la dernière prévision reste affichée |

Aucun voile plein écran ne recouvre du contenu déjà lisible.

## Mouvement

| Durée | Token | Emploi |
|---|---|---|
| 180 ms | `--duree-micro` | changement d'état de la barre de tête |
| 280 ms | `--duree-std` | voile |
| 380 ms | `--duree-complexe` | ouverture de feuille |

La courbe `--ressort` reproduit l'amortissement iOS.
`prefers-reduced-motion: reduce` neutralise transitions et animations.

## Navigation

Cinq destinations, le maximum admis par le document : Accueil, Le temps,
La semaine, Le soleil, La lune. Réglages et Vigilance ne sont pas des
destinations, ce sont des présentations en feuille.

Un contrôle automatique vérifie qu'aucun libellé d'onglet n'est tronqué à la
largeur d'un iPhone.

Le titre d'écran porte l'action de changement de commune, à la façon d'un titre
à menu. Il se replie dans la barre de tête au défilement.

## Ce qui ne se transpose pas

1. **Retour haptique.** Safari sur iOS n'expose pas `navigator.vibrate` aux
   pages. `sentir()` reste appelé sur une sélection décidée par l'utilisateur et
   ne produit rien sur iPhone. Aucun équivalent de `SensoryFeedback` n'existe
   côté web.
2. **Dynamic Type complet.** `font:-apple-system-body` fait suivre la racine sur
   Safari, mais les onze styles iOS ne sont pas exposés séparément. L'échelle est
   donc reconstruite en proportions relatives.
3. **SF Symbols.** La police n'est pas redistribuable. Les symboles sont des
   tracés SVG maison, dessinés sur la même grille de 24 et le même épaississement
   de trait.
4. **Composants natifs.** `NavigationStack`, `TabView`, `List` et `Form` n'ont
   pas d'équivalent. Les comportements attendus sont reproduits à la main :
   geste de retour par l'historique, glissement de la feuille, repli du grand
   titre.

## Contrôles automatiques

`node essais/controle.mjs` exécute cent vingt-cinq contrôles en navigateur, dont
dix-sept portent sur le design system :

1. toute cible interactive tient 44 pt ;
2. le fond du corps vient du token ;
3. aucune valeur brute de rayon hors du bloc de tokens ;
4. le verre est réservé à la couche navigation ;
5. toutes les tailles de texte viennent de l'échelle ;
6. les transitions sont neutralisées sous mouvement réduit ;
7. la barre d'onglets porte cinq destinations, ancrées en bas, sans libellé tronqué ;
8. un seul onglet est courant ;
9. la barre de tête ne montre pas son titre au repos ;
10. la feuille courte prend l'accroche intermédiaire, la longue toute la hauteur ;
11. l'erreur paraît sous le champ, non dans la liste ;
12. le champ fautif est marqué invalide, et l'erreur disparaît à la correction ;
13. l'état désactivé neutralise le contrôle ;
14. une seule rangée de liste dans toute l'application ;
15. l'état vide porte un symbole, un titre, une phrase, une action principale et
    une action secondaire ;
16. la première lecture montre une ossature, non un voile plein écran ;
17. l'action de retrait se tient sous la rangée, non à côté, et le focus la
    découvre.
