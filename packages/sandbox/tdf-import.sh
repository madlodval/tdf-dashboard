#!/bin/bash

ORIGINAL_DIR=$(pwd)
SCRIPT_DIR=$(dirname "$0")

ASSET=$1
INTERVAL=$2
RESOURCE=$3

if [ -z "$ASSET" ]; then
  echo "Usage: ./tdf-import.sh <asset> [interval] [resource]"
  exit 1
fi

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$SCRIPT_DIR" || { echo "Error: Could not change to script directory."; exit 1; }
fi

COMMAND="pnpm tdf-import-clz -a $ASSET"

if [ -n "$INTERVAL" ]; then
  COMMAND="$COMMAND -i $INTERVAL"
fi

if [ -n "$RESOURCE" ]; then
  COMMAND="$COMMAND -r ${@:3}"
fi

eval $COMMAND

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$ORIGINAL_DIR" || { echo "Error: Could not return to original directory."; exit 1; }
fi
