#!/bin/bash

ORIGINAL_DIR=$(pwd)
SCRIPT_DIR=$(dirname "$0")

ASSET=$1
INTERVAL=$2
RESOURCE=$3

if [ -z "$ASSET" ]; then
  echo "Usage: ./tdf-download-import.sh <asset> [interval] [resource]"
  exit 1
fi

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$SCRIPT_DIR" || { echo "Error: Could not change to script directory."; exit 1; }
fi

DOWNLOAD_CMD="pnpm tdf-download-clz -a $ASSET"
IMPORT_CMD="pnpm tdf-import-clz -a $ASSET"

if [ -n "$INTERVAL" ]; then
  DOWNLOAD_CMD="$DOWNLOAD_CMD -i $INTERVAL"
  IMPORT_CMD="$IMPORT_CMD -i $INTERVAL"
fi

if [ -n "$RESOURCE" ]; then
  DOWNLOAD_CMD="$DOWNLOAD_CMD -r ${@:3}"
  IMPORT_CMD="$IMPORT_CMD -r ${@:3}"
fi

eval $DOWNLOAD_CMD || { echo "Error en la descarga."; exit 1; }

eval $IMPORT_CMD || { echo "Error en la importación."; exit 1; }

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$ORIGINAL_DIR" || { echo "Error: Could not return to original directory."; exit 1; }
fi 