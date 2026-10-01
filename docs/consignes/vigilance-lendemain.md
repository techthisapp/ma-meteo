# Ma météo, vigilance : lire l'échéance du lendemain

Dépôt `techthisapp/ma-meteo`, à partir de `8e47e94`.

## Défaut

Le panneau de vigilance ne lit que l'échéance du jour. Une aggravation annoncée pour le lendemain n'apparaît nulle part.

Cas observé le 26 août 2026 à 16 h 33, commune de Lecci, département 2A : l'application affiche « Vigilance jaune, canicule, jusqu'à demain 00 h » quand Météo-France annonce une vigilance orange canicule pour le 27. Les deux sont exacts, l'application dit le jour en cours et le site dit le lendemain.

Le cas le plus gênant n'est pas celui-là : c'est celui d'un département vert aujourd'hui et orange demain. Le panneau ne paraît alors pas du tout, alors que c'est le moment où l'information sert.

## Ce que rend la source

`webservice.meteofrance.com/v3/warning/full` accepte un paramètre `echeance`. Sans lui, la réponse porte le jour en cours. Avec `echeance=J1`, elle porte le lendemain, dans la même forme.

Relevé sur le domaine 2A le 26 août 2026 à 16 h 04, heure de la dernière révision du bulletin :

| Requête | `end_validity_time` | `color_max` | Phénomène 6, canicule |
|---|---|---|---|
| `?domain=2A` | 27/08 00:00 | 2 | une plage, 26/08 16:00 à 27/08 00:00, couleur 2 |
| `?domain=2A&echeance=J1` | 28/08 00:00 | 3 | deux plages, 27/08 00:00 à 12:00 couleur 2, puis 27/08 12:00 à 28/08 00:00 couleur 3 |

Trois faits à retenir de ce relevé.

1. Les plages des deux échéances se touchent exactement à minuit. Concaténées avant fusion, elles se recollent d'elles-mêmes.
2. L'échéance du lendemain porte ses propres plages horaires, pas seulement une couleur de journée.
3. Un phénomène peut rendre un `timelaps_items` vide, cas du phénomène 4 sur ce relevé. La lecture ne doit pas tomber.

L'échéance du lendemain n'est pas publiée en permanence. Son absence, ou une réponse entièrement verte, est un cas normal qui ne produit rien.

## Lot 1. Lecture des deux échéances

### `src/vigilance.js`

`lire(dep)` émet deux requêtes, l'une sans `echeance`, l'autre avec `echeance=J1`. La seconde ne conditionne pas la première : si elle échoue, la lecture rend le jour en cours seul.

Pour chaque phénomène, les `timelaps_items` du jour et ceux du lendemain sont concaténés dans cet ordre, puis passés à `plages()` en une seule fois. La fusion des plages contiguës de même couleur, déjà en place, franchit alors minuit sans code supplémentaire.

Deux bornes servent au découpage :

- `finJour`, l'`end_validity_time` de l'échéance du jour ;
- `finLendemain`, l'`end_validity_time` de l'échéance du lendemain, ou `null` en son absence.

Pour chaque phénomène, deux niveaux sont calculés :

- `nJour`, le maximum des plages qui coupent l'intervalle allant de maintenant à `finJour` ;
- `nLendemain`, le maximum des plages qui coupent l'intervalle allant de `finJour` à `finLendemain`.

Contrat rendu :

```js
{
  dep, nom, lien,
  maj,             // update_time, le plus récent des deux échéances
  niveau,          // maximum des niveaux en vigueur, absent si rien n'est en vigueur
  alertes: [       // phénomènes en vigueur, nJour >= 2, le plus grave d'abord
    { id, nom, symbole, niveau, debut, fin }   // fin issue de la plage fondue, elle peut dépasser minuit
  ],
  niveauLendemain, // maximum des nLendemain, absent si rien n'est annoncé
  annonces: [      // phénomènes dont nLendemain >= 2 et nLendemain > nJour
    { id, nom, symbole, niveau }
  ],
}
```

`lire` rend `null` quand `alertes` et `annonces` sont vides toutes les deux.

Le champ `validite` disparaît du contrat. La borne écrite dans la tête du panneau devient la fin la plus lointaine des alertes en vigueur. Une carte qui dit une vigilance ne peut porter que la borne de cette vigilance, et écrire « jusqu'à demain 00 h » au-dessus d'une ligne qui dit « jusqu'à demain 12 h » se contredit.

`oublier()` vide les gardes des deux échéances.

### `src/app.js`, `panneauVigilance`

La couleur du panneau, bordure et titre, suit ce qui est en vigueur. Quand rien n'est en vigueur, elle suit l'annonce.

| Situation | Ligne forte | Ligne effacée |
|---|---|---|
| Vigilance en vigueur | inchangée, `Vigilance <niveau>` ou la conduite au rouge | inchangée, plus la borne de fin des alertes |
| Rien en vigueur, aggravation annoncée | `Vigilance <niveau> demain` | conduite du niveau annoncé, puis le département |

La liste des phénomènes en vigueur ne change pas. Une ligne d'annonce se pose sous elle quand `annonces` n'est pas vide : « Demain, vigilance orange canicule ». Plusieurs phénomènes de même niveau se joignent dans la même phrase. Quand rien n'est en vigueur, les phénomènes annoncés prennent la place de la liste, chacun portant le mot demain à la place de sa plage horaire.

`annonces` vide ne laisse aucun élément derrière elle, selon la règle déjà appliquée à la voie du ciel du ruban.

### `src/vues.js`, `vueVigilance`

La feuille de détail porte la même distinction. La section « Phénomènes signalés » garde ce qui est en vigueur. Une seconde section, « Annoncé pour demain », ne paraît que si `annonces` n'est pas vide, dans la même forme de rangées. Le renvoi vers Météo-France et la section « Source » ne changent pas, `maj` restant écrite.

Le cas sans vigilance en vigueur mais avec annonce ne doit plus écrire « Aucune vigilance en vigueur ».

### `styles.css`

La ligne d'annonce reprend `.vg-a` avec sa classe de niveau. Une classe `.vg-d` porte le retrait qui la distingue de la liste au-dessus, sans nouvelle couleur.

## Lot 2. Fraîcheur du bulletin

À prendre après le lot 1, indépendant de lui.

1. La garde de quinze minutes est remplacée par une garde calée sur la publication. Le bulletin est gardé jusqu'à la prochaine borne de publication, 06 h et 16 h en heure locale, ou jusqu'à sa fin de validité, la plus proche des deux. Une charge dont l'`update_time` précède la dernière borne franchie n'est pas servie.
2. La vigilance est relue au retour au premier plan, sur `visibilitychange`, si la garde est échue. Le relevé de position suit déjà cette règle.
3. L'heure de révision du bulletin s'écrit dans le panneau de l'accueil, et non plus seulement dans la feuille : « bulletin de 16 h ».

## Contrôles

Chaque contrôle est éprouvé en rétablissant la faute qu'il garde, selon la règle du dépôt.

| Contrôle | Faute à rétablir pour l'éprouver |
|---|---|
| Un département vert aujourd'hui et orange demain fait paraître le panneau, à la couleur du lendemain, et son texte porte le mot demain | ne lire que l'échéance du jour |
| Un même phénomène de même couleur des deux côtés de minuit n'écrit qu'une ligne, dont la borne dépasse minuit | passer les deux échéances à `plages()` séparément |
| Une aggravation du jaune vers l'orange écrit sa ligne d'annonce, avec le niveau et le nom du phénomène | poser le seuil d'annonce à `>=` au lieu de `>` |
| Une échéance du lendemain absente ou entièrement verte ne produit aucune ligne d'annonce ni élément vide | écrire l'annonce sans vérifier qu'elle porte quelque chose |
| La borne écrite dans la tête est la fin du phénomène en vigueur, non la fin de validité du bulletin | rétablir `v.validite` dans la tête |
| Le panneau tient dans son enveloppe de cent cinquante points, deux phénomènes et une ligne d'annonce compris | rétablir les deux rembourrages larges |
| Un `timelaps_items` vide ne fait pas tomber la lecture | retirer le garde sur le tableau vide |

Les contrôles existants de la section Vigilance restent verts sans modification, hormis celui qui porte sur la borne de la tête.

## Contexte d'essai

Dans `brancherRoutes`, la route `webservice.meteofrance.com` branche désormais sur le paramètre `echeance` de l'adresse appelée. La charge existante devient celle de l'échéance du jour. Une charge de lendemain s'y ajoute, construite sur les mêmes heures.

Trois contextes servent aux cas nouveaux, sur le modèle du contexte rouge existant :

1. Département vert aujourd'hui, orange canicule demain. Sert au premier contrôle et au cinquième.
2. Canicule jaune aujourd'hui de 12 h à minuit, jaune demain de minuit à 12 h puis orange. Sert au deuxième contrôle et au troisième. C'est le cas réel du 26 août 2026 sur le 2A.
3. Échéance du jour porteuse d'une vigilance, échéance du lendemain répondant en erreur. Sert au quatrième contrôle.

Le domaine 99, tout vert sur les deux échéances, garde son rôle : aucun panneau.

## Fichiers touchés

`src/vigilance.js`, `src/app.js`, `src/vues.js`, `styles.css`, `essais/controle.mjs`, `sw.js` pour la version du cache, `claude/etat-publication-ma-meteo.md` pour la section « La vigilance en vigueur » et le compte des contrôles.

## Procédure

`node essais/controle.mjs` doit passer en entier avant commit. Le commit est signé `Claude <noreply@anthropic.com>`, le crochet d'arrêt refuse tout autre auteur. `VERSION` de `sw.js` passe à `ma-meteo-v26`.
