#!/usr/bin/env bash
set -euo pipefail

# --- Configuración ---
SANDBOX_DIR="/home/vallod/Documents/github/tradingdifferent/packages/sandbox"
ARGS=("BTC" "ETH" "SOL" "XRP" "BNB")
LOCK_FILE="$SANDBOX_DIR/tdf-sync-sequence.lock"
LOG_FILE="$SANDBOX_DIR/tdf-sync-locked.log"
SYNC_SCRIPT="tdf-sync-base.sh"

# --- Ajustes de entorno para pnpm ---
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

# --- Redirigir sólo stderr al log, con timestamp ---
# exec 2> >(
#   while IFS= read -r line; do
#     printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$line"
#   done >> "$LOG_FILE"
# )

exec > >(
  while IFS= read -r line; do
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$line"
  done >> "$LOG_FILE"
) 2>&1

# --- Lock atómico con flock (silencioso en fallo) ---
exec 200>"$LOCK_FILE"
flock -n 200 || exit 1
trap 'flock -u 200; rm -f "$LOCK_FILE"' EXIT

# --- Cambio al directorio de trabajo ---
cd "$SANDBOX_DIR" || exit 1

# --- Validar existencia y permiso de ejecución del script ---
[[ -x "./$SYNC_SCRIPT" ]] || {
  echo "./$SYNC_SCRIPT no existe o no es ejecutable." >&2
  exit 1
}

# --- Ejecución secuencial de scripts ---
for arg in "${ARGS[@]}"; do
  if ! ./"$SYNC_SCRIPT" "$arg"; then
    rc=$?
    echo "El script para '$arg' devolvió código de salida $rc." >&2
    exit 2
  fi
done

# Si todo fue exitoso, salimos con código 0 sin registrar nada
exit 0