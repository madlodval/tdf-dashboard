#!/bin/bash

RAW_INTERVAL=${1:-daily}
CURRENT_YEAR=$(date +%Y)

# Normaliza el intervalo
case "$RAW_INTERVAL" in
  5m)
    INTERVAL="5min"
    ;;
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

pnpm tdf-coinalyze-downloader -r oi -i "$INTERVAL" -s btc -f 2015-01-01 -t $((CURRENT_YEAR-1))-12-31
pnpm tdf-coinalyze-importer -r oi -i "$INTERVAL" -s btc

pnpm tdf-coinalyze-downloader -r oi -i "$INTERVAL" -s btc -f $CURRENT_YEAR-01-01 -t $CURRENT_YEAR-12-31
pnpm tdf-coinalyze-importer -r oi -i "$INTERVAL" -s btc