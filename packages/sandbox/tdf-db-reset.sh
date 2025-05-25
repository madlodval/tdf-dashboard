#!/usr/bin/env bash
set -euo pipefail

# --- Configuración ---
SANDBOX_DIR=$(dirname "$0")

# Cargar variables del archivo .env
# Esto es una forma común y robusta de hacerlo
if [[ -f "$SANDBOX_DIR/.env" ]]; then
  while IFS= read -r line; do
    if [[ -n "$line" && ! "$line" =~ ^# ]]; then
      export "$line"
    fi
  done < "$SANDBOX_DIR/.env"
else
  echo "Advertencia: El archivo .env no se encontró en $SANDBOX_DIR. Usando valores por defecto o fallará si no están definidas."
  exit 1
fi

SQL_FILE=../repositories/mysql.sql

# Valida que las variables necesarias estén definidas
: "${DB_USER:?La variable DB_USER no está definida en .env}"
: "${DB_PASSWORD:?La variable DB_PASSWORD no está definida en .env}"
: "${DB_NAME:?La variable DB_NAME no está definida en .env}"
: "${SQL_FILE:?La variable SQL_FILE no está definida en .env}"


# --- Comando MySQL usando las variables de entorno ---
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SQL_FILE"

