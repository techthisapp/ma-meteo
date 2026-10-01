Passe la suite complète des contrôles de Ma météo, seule, sans autre suite en parallèle.

1. Lance `bash essais/passe.sh 8137 > /tmp/passe.txt 2>&1` en tâche de fond ; elle dure une douzaine de minutes.
2. Suis `/tmp/passe.txt` et relève chaque ligne `ÉCHEC`.
3. Pour chaque échec, établis s'il vient du code, d'une attente fausse du contrôle ou d'une décision qui a changé, en regardant les données avant de corriger. Le contrôle de jointure du ciel couvert enregistre son image dans `/tmp/couture.png`.
4. Rends compte à Jérôme en français, selon les règles d'écriture de `CLAUDE.md`, en disant « contrôle » et « erreur volontaire ».

Argument facultatif, le nom d'une section pour s'arrêter après elle : $ARGUMENTS (variable `JUSQUA`).
