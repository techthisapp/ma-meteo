# Publication

La méthode de publication à jour est dans `CLAUDE.md`, section « Publication » :
monter la version à deux endroits, passer la suite complète, écrire le message
de commit, pousser sur `main`, vérifier la version servie, mettre à jour la
feuille de route et le document de reprise. Depuis le 2 octobre 2026, la suite
repasse aussi sur les machines de GitHub à chaque envoi sur `main`.

Ce fichier ne garde que ce qui touche au dépôt et à son hébergement.

## Dépôt et hébergement

| Élément | Valeur |
|---|---|
| Dépôt | `techthisapp/ma-meteo`, public |
| Adresse | `https://techthisapp.github.io/ma-meteo/` |
| GitHub Pages | Branche `main`, dossier racine ; `.nojekyll` évite la réécriture par Jekyll |
| Identifiants | Ceux du poste, rangés dans le trousseau du Mac par GitHub CLI ; aucun jeton dans le dépôt |

## Cohabitation avec « Mon jardin »

« Ma météo » a son propre dépôt, distinct de `techthisapp/mon-jardin`, qui sert
une autre application par GitHub Pages. Ne jamais lire, modifier ni pousser ce
dépôt-là. Les deux applications cohabitent sans se voir :

| | Mon jardin | Ma météo |
|---|---|---|
| Dépôt | `techthisapp/mon-jardin` | `techthisapp/ma-meteo` |
| Adresse | `techthisapp.github.io/mon-jardin/` | `techthisapp.github.io/ma-meteo/` |
| Portée de l'agent de service | `/mon-jardin/` | `/ma-meteo/` |
| Préfixe du stockage local | `monjardin.` | `mameteo.` |

## Après une publication

1. Vérifier la version servie, commande de `CLAUDE.md`.
2. Sur téléphone, accepter le bandeau de mise à jour, ou recharger.
3. Pour éprouver le mode hors ligne : charger la page, passer en mode avion,
   recharger. La coque et la dernière prévision gardée restent servies.

La création du dépôt et l'activation de GitHub Pages, faites le 18 août 2026,
sont décrites dans l'historique de ce fichier.
