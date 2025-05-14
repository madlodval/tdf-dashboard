#!/bin/bash

ORIGINAL_DIR=$(pwd)
SCRIPT_DIR=$(dirname "$0")

ASSET=$1
INTERVAL_BASE="5m"

if [ -z "$ASSET" ]; then
  echo "Usage: ./tdf-sync-base.sh <asset>"
  exit 1
fi

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$SCRIPT_DIR" || { echo "Error: Could not change to script directory."; exit 1; }
fi

COMMAND="pnpm tdf-download-clz -a $ASSET -i $INTERVAL_BASE && pnpm tdf-import-clz -a $ASSET  -i $INTERVAL_BASE --sync"

eval $COMMAND

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$ORIGINAL_DIR" || { echo "Error: Could not return to original directory."; exit 1; }
fi
