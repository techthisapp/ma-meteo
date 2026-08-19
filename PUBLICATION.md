# Publication

Le dépôt local est initialisé, la branche est `main`, un premier commit porte les
vingt-huit fichiers de l'application. Il reste à créer le dépôt distant et à
pousser.

## Précaution

« Ma météo » demande un dépôt **distinct** de `techthisapp/mon-jardin`, qui sert
déjà une application par GitHub Pages. Les deux cohabitent sans se voir :

| | Mon jardin | Ma météo |
|---|---|---|
| Dépôt | `techthisapp/mon-jardin` | `techthisapp/ma-meteo` |
| Adresse | `techthisapp.github.io/mon-jardin/` | `techthisapp.github.io/ma-meteo/` |
| Portée de l'agent de service | `/mon-jardin/` | `/ma-meteo/` |
| Préfixe du stockage local | `monjardin.` | `mameteo.` |

Le service sous sous-chemin a été vérifié en navigateur : le manifeste se résout
en `/ma-meteo/manifest.webmanifest`, la portée de l'agent de service en
`/ma-meteo/`, aucune requête n'échoue et aucune réponse 404 n'est émise.

## Créer le dépôt distant

Trois façons, au choix. Aucune ne touche à `mon-jardin`.

### Par l'interface web

1. Ouvrir `https://github.com/new`.
2. Propriétaire `techthisapp`, nom `ma-meteo`, visibilité au choix.
3. Ne cocher ni README, ni .gitignore, ni licence : le dépôt local les porte
   déjà, et un dépôt distant non vide obligerait à une fusion.
4. Créer.

### Par la ligne de commande GitHub

```
gh repo create techthisapp/ma-meteo --public --source=. --remote=origin
```

La commande crée le dépôt et pose le distant en une fois. `--private` à la place
de `--public` si le dépôt doit rester fermé.

### Par le connecteur GitHub de Claude

Le connecteur n'était pas joignable au moment où ce fichier a été écrit : il
demandait encore une autorisation, et une session non interactive ne peut pas
dérouler le flux OAuth. Une fois l'autorisation faite depuis les réglages de
connecteurs de claude.ai, la création du dépôt redevient possible depuis une
conversation.

## Pousser

Depuis `~/Documents/Claude/Projects/ma-meteo` :

```
git remote add origin https://github.com/techthisapp/ma-meteo.git
git push -u origin main
```

Si le dépôt a été créé par `gh repo create --source=.`, le distant est déjà posé
et seule la seconde ligne est nécessaire.

## Activer GitHub Pages

1. Dans le dépôt, `Settings`, puis `Pages`.
2. Source : `Deploy from a branch`.
3. Branche `main`, dossier `/ (root)`.
4. Enregistrer.

L'adresse `https://techthisapp.github.io/ma-meteo/` répond au bout d'une à deux
minutes.

Le fichier `.nojekyll` est déjà présent : il évite que Jekyll ne réécrive le
dossier au passage.

## Après la première publication

1. **Révoquer le jeton d'accès personnel** collé en clair dans la conversation du
   18 août. Réglages GitHub, `Developer settings`, `Personal access tokens`.
2. **Vérifier l'installation sur téléphone.** Ouvrir l'adresse dans Safari ou
   Chrome, puis « Sur l'écran d'accueil ». L'icône, le nom et le mode plein écran
   viennent du manifeste.
3. **Contrôler le mode hors ligne.** Charger la page, passer en mode avion,
   recharger : la coque est servie par l'agent de service, la prévision annonce
   son indisponibilité.

## Ce qui n'est pas dans le dépôt

Le dossier `Projects/meteo-autonome`, qui porte la cartographie du module
d'origine et les huit documents de référence de « Mon jardin ». Ce sont des
documents de travail, non du code.
