#!/bin/bash

RAW_INTERVAL=${1:-daily}
CURRENT_YEAR=$(date +%Y)

# Normaliza el intervalo
case "$RAW_INTERVAL" in
  1h)
    INTERVAL="1hour"
    ;;
  4h)
    INTERVAL="4hour"
    ;;
  1d)
    INTERVAL="daily"
    ;;
  *)
    INTERVAL="$RAW_INTERVAL"
    ;;
esac

pnpm tdf-coinalyze-downloader -r vl -i "$INTERVAL" -s btc -f 2015-01-01 -t $((CURRENT_YEAR-1))-12-31
pnpm tdf-coinalyze-importer -r vl -i "$INTERVAL" -s btc

pnpm tdf-coinalyze-downloader -r vl -i "$INTERVAL" -s btc -f $CURRENT_YEAR-01-01 -t $CURRENT_YEAR-12-31
pnpm tdf-coinalyze-importer -r vl -i "$INTERVAL" -s btc