#!/bin/bash

ORIGINAL_DIR=$(pwd)
SCRIPT_DIR=$(dirname "$0")

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$SCRIPT_DIR" || { echo "Error: Could not change to script directory."; exit 1; }
fi

pnpm tdf-sync-repo

if [ "$ORIGINAL_DIR" != "$SCRIPT_DIR" ]; then
  cd "$ORIGINAL_DIR" || { echo "Error: Could not return to original directory."; exit 1; }
fi
