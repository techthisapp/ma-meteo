# Ma météo, reprise

Document tenu à jour à chaque publication. Les règles de travail sont dans
`CLAUDE.md`, à la racine du dépôt, qui se lit en premier. Le détail des
décisions est dans `docs/feuille-de-route.md`. L'ancien document de reprise,
écrit pour claude.ai jusqu'à la version 118, est dans
`docs/archives/reprise-claude-ai.md`.

## Le projet

| Élément | Valeur |
|---|---|
| Application | « Ma météo », site statique installable, sans serveur, sans compte |
| Adresse | `https://techthisapp.github.io/ma-meteo/` |
| Dépôt | `techthisapp/ma-meteo`, public, branche `main` |
| Dossier de travail | `~/Documents/Claude/Projects/ma-meteo`, sur le Mac de Jérôme |
| Outils | Node.js 24, GitHub CLI connecté au compte `techthisapp`, Playwright 1.63.0 par `npm ci` |
| Contrôles | `bash essais/passe.sh 8137`, trois minutes ; aussi sur GitHub à chaque envoi sur `main`, qui publie l'application si la suite est verte |

Ne jamais lire, modifier ni pousser `techthisapp/mon-jardin`, une autre
application.

## État au 8 octobre 2026

Version 189. Le projet est passé de claude.ai à Claude Code le 1er octobre
2026, à la version 118. Un audit complet de la version 120 a été mené le même
jour, `docs/audit-2026-10-01.md`, avec le suivi de chaque lot en fin de
document.

| Lot de l'audit | État |
|---|---|
| A, contrôles étanches au réseau et outils figés | fait |
| B, hors connexion et changement de commune | fait, version 122 |
| C, confidentialité | fait, version 123 |
| D, accessibilité | fait, version 124 |
| E, performances | fait, versions 125 à 128 et 134 |
| F, délais réseau, département, fuseau | fait, versions 129 à 131 ; l'outre-mer n'est pas visé, décision de Jérôme |
| G, maintenance | fait, versions 132 à 135 : intégration continue, code mort, anciens scripts d'épreuve, documents, découpage de `src/vues.js` puis de la carte, chargement différé, suite des contrôles en sections indépendantes, outil de captures sur les faux services |

Jalons de la feuille de route : 1 à 4 et 7 à 18 livrés. Le jalon 19, la carte
enrichie, ouvert le 2 octobre 2026, est livré en versions 140 à 153 et repris en versions 154 et 155, détail dans
la feuille de route. Reste aussi le jalon 6, la
justesse des prévisions publiée, vers la fin octobre, quand soixante jours de
relevés seront réunis. Le jalon 5, la 3D, est écarté pour le moment. Le jalon 22, la pluie dans l'heure
reprise, ouvert le 4 octobre 2026 : livré en versions 168 à 170 : ruban sur
trois heures, voisinage, pastille accordée au radar, seconde méthode par le
déplacement des averses. Le jalon 23, le plein ciel du Soleil et
de la Lune, est livré en versions 172 à 175. Le jalon 24, les étoiles en plein écran reprises, a ses lots 1 à 5 livrés en versions 176 à 178 ; reste le lot 6, viser le ciel avec le téléphone. Le jalon 25, les cartes du passé, est livré en versions 179 à 182 : nappes du passé et feux, période choisie au curseur dans la légende. Le jalon 26, la suite de la pluie, est livré en versions 183 à 186 : six modèles et leur accord, le déplacement des averses prolongé, les images poussées sur la carte, puis la prévision immédiate PIAF de Météo-France avec une clé saisie dans les réglages. Le jalon 6 a son lot 1 livré en version 187 : la justesse mesurée aux stations de Météo-France. La météo des forêts est livrée en version 188, les bulletins d'avalanche en version 189 : à vérifier sur un vrai bulletin dès début novembre. Reste le radar de Météo-France, si son rendu peut égaler RainViewer ; il demande l'abonnement « Données Radar » et une nouvelle clé. La clé de Jérôme, pour les essais sur le Mac, est dans `~/.config/ma-meteo/cle-meteofrance`, hors du dépôt.

## Points ouverts

1. Les points connus de `CLAUDE.md` : l'orientation des plages, connue pour
   1322 plages françaises sur 1839 ; les heures à l'heure de Paris, l'outre-mer
   n'étant pas visé. La requête de la neige, le vent des plages et le
   `LISEZ-MOI.md` sont repris en version 136.
2. Les constats de l'audit restés au stade « relevé » : plan et décisions de
   Jérôme dans `docs/plan-constats-releves.md`. Lots H1, H2 et H3 faits en
   versions 137 à 139 ; reste le rendu par section, seconde partie du
   constat 4.6.

## Ce que Jérôme doit faire

1. Révoquer les anciens jetons GitHub employés dans claude.ai, collés en clair
   les 18 et 21 août, sur `https://github.com/settings/tokens`. L'accès de
   GitHub CLI, dans la page « Applications », reste en place.

Les restes de l'époque claude.ai, verrous et archives de Git, copies de
transfert du dépôt et deux fichiers portant des fragments de jeton, ont été
supprimés par Jérôme le 2 octobre 2026. Le dossier « Reporting FFF » du
`_to_delete` du Bureau n'appartient pas à ce projet et reste en place.
