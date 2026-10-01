# Durée maximale d'une passe des contrôles, chargée par passe.sh et
# epreuve-bande.sh. Usage : borne <secondes> <commande> [arguments...]
#
# La commande timeout existe sous Linux et manque sous macOS, où la suite
# s'arrêtait aussitôt sur « command not found ». Sous macOS, perl tient le
# même rôle : l'alarme arrête la commande au bout du délai, avec le code 142.
borne() {
  local secondes="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secondes" "$@"
  else
    perl -e 'alarm shift; exec @ARGV or die "borne : $!\n"' "$secondes" "$@"
  fi
}
