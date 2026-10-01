# Ma météo, reprise dans une nouvelle conversation

> **Bascule dans Claude Code, 1er octobre 2026.** Ce document a été tenu dans claude.ai jusqu'à la version 118. Sur le poste de Jérôme, Git emploie ses propres identifiants : publier se fait par `git push origin main`, sans jeton ni réglage de mandataire. Les commandes à jeton plus bas datent de claude.ai et ne servent plus. Les règles de travail à jour sont dans `CLAUDE.md` à la racine du dépôt.

> **Publications depuis Claude Code, 1er octobre 2026 : versions 119 à 130.** Dossier de travail : `~/Documents/Claude/Projects/ma-meteo`. Node.js 24 et GitHub CLI installés ; GitHub CLI est connecté au compte `techthisapp`. La suite complète tourne sur le Mac par `bash essais/passe.sh 8137`, tous les contrôles verts ; le nombre à jour est dans `CLAUDE.md`. Un audit complet de la version 120 est dans `docs/audit-2026-10-01.md`, avec le suivi des lots : A à D faits, E en partie, F et G à venir. Les sections plus bas décrivent l'environnement de claude.ai et ne s'appliquent plus telles quelles.


Document écrit le 10 septembre 2026. À lire en entier avant de commencer.

## Le projet

« Ma météo » est une application web installable, sans serveur, sans base de données, sans compte.

| Élément | Valeur |
|---|---|
| Adresse publiée | `https://techthisapp.github.io/ma-meteo/` |
| Dépôt | `techthisapp/ma-meteo`, public |
| Branche servie | `main`, dossier racine |
| Dossier de travail dans le conteneur | `/home/claude/ma-meteo` |
| Dossier sur le Mac de Jérôme | `~/Documents/Claude/Projects/ma-meteo` |
| État publié | commit `1c4a2a3`, version `ma-meteo-v56` |
| Tests | 752 contrôles, tous verts |

## Interdits absolus

1. Ne jamais lire, modifier ou pousser le dépôt `techthisapp/mon-jardin`. C'est une autre application.
2. Ne jamais écrire le jeton GitHub dans un fichier, dans la configuration git ou dans une variable d'environnement. Il ne figure que dans la ligne de commande qui s'en sert.
3. Toute commande qui pourrait afficher le jeton doit être filtrée : `2>&1 | sed 's/github_pat_[A-Za-z0-9_]*/***/g'`.
4. Ne jamais lancer `pkill -f "8099"`.

## Le jeton GitHub

Jérôme le donne par message au début de la conversation. Il n'est recopié dans aucun document.

## Style d'écriture

Charger la compétence `ecriture-directe` avant toute rédaction en français.

Résumé : phrases courtes, une idée par phrase, mots courants, aucune métaphore. Pas de vocabulaire interne du projet dans les réponses de conversation. Pas de tiret cadratin, pas de flèches, pas de symboles. Unités métriques. Numéroter les points posés à Jérôme.

Jérôme a signalé le 10 septembre que le style était trop compliqué. Exemples de ce qu'il ne veut plus : « la garde a dit que », « un fil séparé cacherait le plus court des deux », « tourne sans seconde voix », « les deux services rendent la même altitude ».

## Méthode de travail

C'est la partie la plus importante. Elle a produit 752 tests fiables.

1. **Mesurer avant de décider.** Aucune fonction n'est écrite sur une intuition. On interroge la source, on compte les octets, on chronomètre. Deux fonctions ont été abandonnées après mesure : les colonnes de sol, et le risque d'orage calculé depuis l'énergie convective.
2. **Un test par règle.** Chaque règle nouvelle reçoit un test dans `essais/controle.mjs`.
3. **Éprouver chaque test.** On réintroduit l'erreur que le test doit détecter et on vérifie qu'il échoue. Les erreurs sont conservées dans des scripts `essais/epreuve-*.sh`.
4. **Un test qui ne détecte pas son erreur est corrigé ou supprimé.** C'est arrivé une dizaine de fois.
5. **Une règle vit à un seul endroit.** Deux nombres identiques écrits à deux endroits finissent par diverger. Un bug réel est venu de là le 10 septembre.
6. **Captures d'écran dans les deux thèmes** avant de livrer, et les regarder vraiment.

## Boucle de livraison

1. Modifier le code.
2. Suite complète : environ 9 minutes.
3. Éprouver chaque erreur nouvelle : environ 9 minutes chacune.
4. Captures : `ECRAN=accueil|carte|lune|soleil node essais/vue-ecran.mjs`.
5. Monter la version dans `sw.js`, et ajouter tout module nouveau à la liste `COQUE`.
6. Commit, poussée, vérification de la publication fichier par fichier.
7. Mettre à jour les deux documents du projet.

## Commandes utiles

Un appel Bash est limité à 300 secondes, mesuré le 10 septembre : 295 passent, 305 sont tués. La suite dure environ 580 secondes. Un processus lancé avec `nohup ... &` meurt à la fin de l'appel qui l'a lancé ; seul `setsid` le fait survivre :

```
setsid nohup bash -c 'cd /home/claude/ma-meteo && \
  CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node essais/controle.mjs > /tmp/s.txt 2>&1; echo "code $?" > /tmp/fini.txt' \
  < /dev/null > /tmp/lance.log 2>&1 &
```

Puis, dans des appels séparés : `sleep 285; wc -l /tmp/s.txt; cat /tmp/fini.txt`. Deux attentes suffisent. Le résultat attendu est `793 contrôles sur 793, tous vérifiés.` et `code 0`.

Deux variables d'environnement aident à mesurer et à raccourcir : `CHRONO=1` rend le temps de chaque section et le coût des ouvertures de page ; `JUSQUA="nom de section"` arrête la passe une fois cette section passée, ce qui ramène une épreuve de la carte de 554 à 446 secondes.

Un processus détaché survit d'un appel à l'autre dans un même tour de conversation, mais meurt au changement de tour, parfois sans mourir tout de suite : vérifier `ps aux | grep -c "[c]ontrole.mjs"` avant de relancer quoi que ce soit.

Les épreuves de fautes travaillent chacune sur une copie du dépôt dans `/tmp` et sur son propre port, choisi par `PORT_ESSAIS`. Le dépôt d'origine n'est jamais touché, donc une épreuve tuée en cours ne laisse plus de faute derrière elle. `essais/passe.sh <port>` fait de même pour une passe ordinaire, ce qui permet d'écrire dans le dépôt pendant qu'elle tourne.

Le conteneur n'a qu'un cœur et quatre gigaoctets. Le parallélisme ne donne donc qu'un gain modeste : deux épreuves ensemble prennent 856 secondes contre 1160 en séquence, soit 26 pour cent. Au delà de deux, le cœur sature et Playwright dépasse ses délais d'attente, ce qui fait planter des épreuves loin de la garde visée. Deux à la fois est le bon rythme.

Un plantage Playwright sur un délai arrive une fois sur une dizaine de passes, même sans charge : l'épreuve se relance seule.

`pkill -f` avec un motif présent dans la ligne de commande de l'appel tue l'appel lui-même. Viser `bash essais/epreuve-...` et non le nom seul. `ss` n'existe pas dans ce conteneur : un test de port bâti dessus rend toujours « libre ».

Un plantage Playwright sur un délai d'attente, loin de la section éprouvée, arrive une fois sur une dizaine de passes ; l'épreuve se relance seule.

Ne jamais lancer deux scripts d'épreuve en même temps : ils se restaurent mutuellement les fichiers.

Poussée, avec le jeton en ligne de commande seulement :

```
git -c http.proxy= -c https.proxy= push "https://<JETON>@github.com/techthisapp/ma-meteo.git" main
git -c http.proxy= -c https.proxy= fetch "https://<JETON>@github.com/techthisapp/ma-meteo.git" \
  main:refs/remotes/origin/main --force
```

La poussée par adresse explicite ne met pas à jour `origin/main`, d'où le `fetch`.

Appels réseau vers les API : ajouter `--noproxy '*'` à curl.

Commits : le crochet d'arrêt exige `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit`. Fin du message de commit :

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: <adresse de la session>
```

## Les documents du projet

Deux documents, dans le projet Claude « Ma météo » :

| Document | Contenu |
|---|---|
| `feuille-de-route-ma-meteo.md` | Les jalons, ce qui est fait, ce qui reste, le journal des décisions |
| `claude/etat-publication-ma-meteo.md` | L'état détaillé de tout ce qui existe, avec les mesures |

Copies locales dans `/home/claude/_doc/`. Les modifier localement, puis les livrer dans `/mnt/user-data/outputs/` avec `present_files` ; Jérôme les remet dans le projet. L'outil `project_write` n'existe pas dans cette configuration.

## Où en est le projet

Jalons 1 à 4, 7 et 8 faits. Restent :

- **Arbitrage 8, le panneau des couches.** Tranché et livré le 11 septembre au commit `4675348` : des tuiles, trois par rangée.
- **Rampe de l'indice ultraviolet.** Du violet au fuchsia, commit `f8d7c5a` le 12 septembre ; contraste repris le 13, commit `8cb7e9c`. 
- **Indice ATMO officiel sur la commune.** Livré le 16 septembre au commit `82f96aa`. `src/atmo.js` nouveau, carte ajoutée à l'écran de l'air, huit fautes éprouvées. Le service worker est en `ma-meteo-v61`.
- **Jalon 4d, les orages.** Clos le 12 septembre au commit `de71acc`. Le calcul de risque, le repérage de cellules radar et le cadre Blitzortung sont écartés à la mesure. La foudre vient du WMS public d'EUMETSAT, couche `mtg_fd:li_afa`, six pas de cinq minutes posés l'un sur l'autre, tuiles bornées au zoom six. Le service worker est en `ma-meteo-v58`.
- **Carte des feux de forêt, section 4c-2.** Livrée le 20 septembre au commit `709d492` : fenêtre de deux jours, cinquième superposition éteinte au départ, libellé qui ne promet pas d'incendie. Le service worker est en `ma-meteo-v74`. L'écran des étoiles a son bandeau et son plein écran au commit `88a7590`, le choix des étoiles affichées au commit `0aa5cc2`, les informations de la nuit au commit `96e787d`, la fiche d'une constellation au commit `ce8e0ed`, le ciel sous l'eau au commit `3faaec8`. Le dernier lot, curseur de temps, Lune et planètes, est livré au commit `0b83c67` : le jalon 9 est clos.
- **Jalon 10, l'accueil de la journée.** Ouvert le 23 septembre, six lots en section 10c de la feuille de route. Lots 1 et 2 publiés au commit `1d1ab3d`, bande horaire et chiffres du jour sur une ligne. Le service worker est en `ma-meteo-v75`. Lot 3 publié au commit suivant, la bande et la suite disent la même pluie ; lot 4 révisé sans code. Lot 5 publié au commit `d96458e`, « Le temps » en page de détail et glissement du ruban sans saccade. Reste le lot 6, les quatre onglets, à ouvrir après quelques jours d'usage du nouvel accueil par Jérôme.
- **Version affichée et mise à jour.** Depuis la version 78, le numéro est écrit à deux endroits, `sw.js` et `src/version.js` : les monter ensemble à chaque publication, une garde le vérifie. Le bandeau de mise à jour paraît quand le `sw.js` publié porte un numéro supérieur.
- **Liste des plages** : `python3 outils/construire-plages.py`, en tâche de fond ; il lit la couche européenne des eaux de baignade, le classement de la dernière saison et le service d'adresses de l'État, abandonné après vingt échecs.
- **Service worker à la version 117** : jalon 18, lots 1 et 2 livrés, lot 3 presque complet : prévisions, plages et neige sur la carte. Reste la superposition des cours d'eau ; le panneau des couches, à cinq par rangée, a encore la place d'un interrupteur sans nouvelle rangée. Prochain : lot 2, la tuile et la feuille « L'eau » (restriction de la commune, nappe, rivière, température de la rivière, étiage, humidité des sols) ; puis lot 3, les superpositions prévisions, plages, neige, cours d'eau. Avant elle, version 108, commit `5b58a33` : jalon 16 clos, la neige. Prochain : jalon 15, les plages ; le 6, la justesse, vers la fin octobre. Refaire la liste des stations chaque saison : télécharger `https://tiles.openskimap.org/geojson/ski_areas.geojson` puis `python3 outils/construire-stations.py <fichier>`.
- **Service worker à la version 107**, commit `3c8333f` : jalon 14 clos et complété, périodes passées ou à venir, jamais mêlées. Avant elle, version 106, commit `def48c7`. Prochain : jalon 16, la météo des neiges, puis 15, les plages ; le 6, la justesse, vers la fin octobre.
- **Épreuves** : ne jamais effacer `/tmp/copie-bande-*` pendant qu'une épreuve tourne ; le script dit désormais « ÉPREUVE INTERROMPUE » quand la garde attendue n'a pas tourné. Une commande ne doit pas dépasser 300 secondes : attendre et publier en deux appels. Avant elle, version 104, commit `76faeb2` (page « Heure par heure », bandeau des jours, traits de minuit). Avant elle, version 103, commit `af35d85` : onglet « À venir », plafond sans à-coup, déplacement des lieux au doigt. Avant elle, version 102, commit `5441d81`, jalon 17, « Voir plus ». Avant elle, version 101, commit `47287b3`, jalon 13 clos. Ordre suivant : jalon 14, la comparaison ; 16, la neige ; 15, les plages ; le 6, la justesse, vers la fin octobre.
- **Épreuves au-delà de la bande** : `JUSQUA_EPREUVE="<section>" bash essais/epreuve-bande.sh <n>` pour une faute dont la garde est plus loin dans la suite. Avant elle, version 96, commit `a914ba9` (couvert de jour éclairci, voiles resserrés), après la version 95, commit `15132d1` : jalon 12 clos. L'accueil ne parle que de demain ; après-demain est dans La semaine. La justesse des prévisions paraît dans les réglages, sans phrase sur le délai. Le ciel couvert se peint en bancs de nuages, motif `plafond` de `src/temps.js`.
- **Pour juger un ciel peint**, une page d'essai qui appelle `bandeauAccueil` puis `Temps.dessiner` sur chaque toile, une par cas : le module d'animation ne suit qu'une toile à la fois. Mesurer la structure en points d'écran, pas en pixels de toile. Jalons 10 et 11 clos. Quatre onglets ; « Le temps » s'ouvre en page de détail. La flèche du vent vit dans `src/fleche.js` ; `src/vent.js` est le module des particules de la carte.
- **Dans les contrôles, ouvrir « Le temps »** passe par l'aide `ouvrirLeTemps(page)`, qui touche le lien « Plus de détails » de la bande ; l'aide `onglet("temps")` et les boucles sur les écrans y renvoient.
- **Avant de créer un fichier**, vérifier que le nom est libre : `cat >` écrase sans prévenir, et a écrasé `vent.js` le 24 septembre.
- **Conteneur réinitialisé le 24 septembre.** Le dépôt se reclone sans jeton ; la poussée passe l'adresse avec le jeton en clair dans la commande, masqué dans la sortie. Réinstaller l'outillage par `npm install`. La redondance entre la phrase de la bande et les conseils est gardée, par décision de Jérôme du 24 septembre. Le jalon 9 a son écran des étoiles au commit `0a00a8e`, sur les données et le calcul du commit `fc111d3`. La suite est organisée en cinq lots, section 9-bis de la feuille de route : texte en fenêtre, plein écran, choix de ce qui s'affiche, ciel sous l'eau, puis temps, Lune et planètes. La nappe de l'air a basculé sur l'indice officiel le 20 septembre au commit `93fb616`, Copernicus restant dessous pour l'Europe.
- **Pluie en superposition.** Livrée le 19 septembre au commit `8d2b57f` : elle se lit en même temps qu'une nappe.
- **Gaine des traits.** Réduite le 19 septembre au commit `f32ab4f`. Son réglage n'est tenu par aucune garde, le constat est écrit dans `src/carte.js`. 
- **Couche de nuages.** Livrée le 19 septembre au commit `c0d5fa8`, infrarouge du Meteosat de troisième génération. 
- **Une reprise au carnet, lot 4c.** La bascule de la nappe de la carte sur l'indice officiel, qui sépare bien mieux les zones, une fois tranchée la question du poids.
- **Jalon 5, la météo en 3D.**
- **Jalon 6, la justesse publiée.** Le journal enregistre depuis le 26 août. Il faut environ deux mois de données, donc fin octobre.
- **Jalon 9, les étoiles.** La place est réservée dans l'écran « Le ciel ».

L'extrapolation radar de RainViewer et son canal satellite restent vides, sept relevés entre le 5 et le 10 septembre. Le canal satellite ne manque plus, EUMETSAT servant l'imagerie.

## Ce que Jérôme doit faire

1. Révoquer les deux anciens jetons GitHub, collés en clair les 18 et 21 août.
2. Rattraper le dossier sur le Mac : `cd ~/Documents/Claude/Projects/ma-meteo && git pull`.
3. Supprimer `~/Documents/Claude/Projects/ma-meteo/.git/_a_supprimer/` et `Bureau/_to_delete/`.
4. Essayer sur téléphone : la pluie dans l'heure, les couches de la carte, le vent, le sens d'arrivée de la pluie, l'écran du climat. La nappe de qualité de l'air a été vue le 10 septembre et son écart avec Apple est au carnet.

La liste complète des points à vérifier sur un vrai téléphone est en fin de `claude/etat-publication-ma-meteo.md`, numérotée de 1 à 31.

## Message à coller dans la nouvelle conversation

---

On reprend « Ma météo ». Lis le document `reprise-ma-meteo.md` du projet, puis les deux documents `feuille-de-route-ma-meteo.md` et `claude/etat-publication-ma-meteo.md`.

Le dépôt est `techthisapp/ma-meteo`. Ne touche jamais à `techthisapp/mon-jardin`.

Voici le jeton GitHub : `<coller le jeton ici>`. Ne l'écris dans aucun fichier, ne le mets pas dans la configuration git, filtre toute sortie qui pourrait l'afficher.

Charge la compétence `ecriture-directe` et écris simplement.

Commence par cloner le dépôt dans `/home/claude/ma-meteo` et lancer la suite de tests pour vérifier que tout est vert.

---
- **Limites de l'environnement** : deux suites de contrôle en parallèle au plus, trois dépassent la mémoire ; les processus de fond meurent au changement de tour ; le service de prévision peut refuser l'application depuis le conteneur par quota épuisé (code 429), les contrôles, eux, servent leurs propres données ; pour arrêter un processus, jamais de motif qui figure dans la commande elle-même.
- **Contrôles et réseau** : `nav.newContext` est enveloppé pour que tout contexte réponde d'office à VigiEau et Hub'eau ; une route posée après, par `brancherRoutes`, passe devant.
- **Vocabulaire avec Jérôme** : ne pas dire « garde » ni « faute » ; dire « contrôle » et « erreur volontaire ». Le code et les journaux internes gardent leurs noms.
- **Ne jamais éprouver une erreur volontaire en parallèle d'une passe dont on juge un contrôle sensible au temps** (ciel animé) : la charge décale l'instant photographié. Le contrôle de jointure enregistre `/tmp/couture.png` et `/tmp/couture.txt` à chaque passe.
