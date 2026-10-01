Éprouve une erreur volontaire de Ma météo : vérifie qu'un contrôle détecte bien l'erreur qu'il doit détecter.

Numéro de l'erreur : $ARGUMENTS

1. Lis le cas correspondant dans `essais/epreuve-bande.sh` : l'erreur introduite et le contrôle attendu.
2. Si le contrôle est au-delà de la bande horaire, repère sa section dans `essais/controle.mjs` et passe-la dans `JUSQUA_EPREUVE`.
3. Lance `bash essais/epreuve-bande.sh <n> > /tmp/epreuve-<n>.txt 2>&1`, sans passe complète en parallèle.
4. Verdicts : « vue » est le résultat attendu ; « non vue » signale un contrôle trop faible ; « interrompue » signale une suite arrêtée avant le contrôle, à relancer.
5. Une erreur volontaire éprouvée pendant que son contrôle échouait déjà sur le bon code doit être repassée.
