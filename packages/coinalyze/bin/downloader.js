import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import 'dotenv/config'

import {
  Coinalyze,
  INTERVAL_ONE_MIN,
  INTERVAL_FIVE_MIN,
  INTERVAL_FIFTEEN_MIN,
  INTERVAL_THIRTY_MIN,
  INTERVAL_ONE_HOUR,
  INTERVAL_TWO_HOUR,
  INTERVAL_FOUR_HOUR,
  INTERVAL_SIX_HOUR,
  INTERVAL_TWELVE_HOUR,
  INTERVAL_DAILY
} from '../src/client.js'
import { JsonCache } from '../src/jsonCache.js'
import { RESOURCE_OI, RESOURCE_LQ, RESOURCE_VL } from '../src/helpers.js'

const RESOURCES = {
  [RESOURCE_OI]: 'getOpenInterestHistory',
  [RESOURCE_LQ]: 'getLiquidationHistory',
  [RESOURCE_VL]: 'getOhlcvHistory'
}

const argv = yargs(hideBin(process.argv))
  .option('resource', {
    alias: 'r',
    type: 'string',
    description: 'Resource API',
    choices: Object.keys(RESOURCES),
    demandOption: true
  })
  .option('interval', {
    alias: 'i',
    type: 'string',
    description: 'Tipo de tiempo',
    choices: [
      INTERVAL_ONE_MIN,
      INTERVAL_FIVE_MIN,
      INTERVAL_FIFTEEN_MIN,
      INTERVAL_THIRTY_MIN,
      INTERVAL_ONE_HOUR,
      INTERVAL_TWO_HOUR,
      INTERVAL_FOUR_HOUR,
      INTERVAL_SIX_HOUR,
      INTERVAL_TWELVE_HOUR,
      INTERVAL_DAILY
    ],
    demandOption: true
  })
  .option('symbol', {
    alias: 's',
    type: 'string',
    description: 'Símbolo del activo',
    demandOption: true
  })
  .option('from', {
    alias: 'f',
    type: 'string',
    description: 'Fecha de inicio (YYYY-MM-DD) o timestamp UNIX de inicio (segundos)',
    default: Math.floor(Date.now() / 1000) - 7 * 24 * 3600 // 7 días atrás
  })
  .option('to', {
    alias: 't',
    type: 'string',
    description: 'Fecha de fin (YYYY-MM-DD) o timestamp UNIX de fin (segundos)',
    default: Math.floor(Date.now()) // ahora
  })
  .help()
  .alias('help', 'h')
  .argv

let { resource, interval, symbol, from, to } = argv

const range = getDefaultRange(interval)
from = parseDateOrTimestamp(from, range.from, false)
to = parseDateOrTimestamp(to, range.to, true)

const params = {
  symbol: symbol.toUpperCase(),
  interval: interval.toLowerCase(),
  from,
  to
}

if (resource !== 'vl') {
  params.convertToUsd = true
}

// Cambia el directorio de salida a 'storage' en el cwd actual
const storageDir = path.resolve(process.cwd(), 'storage')
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true })
}
const filename = path.join(storageDir, `${symbol.toLowerCase()}_${interval}_${resource}.json`)

async function handler() {
  const cache = new JsonCache(storageDir, 86400)
  const client = new Coinalyze(process.env.COINALYZE_API_KEY)
  const futureMarkets = await cache.remember('future-markets', async () => client.getFutureMarkets())
  // const spotMarkets = await cache.remember('spot-markets', async () => client.getSpotMarkets())
  // const symbols = client.getSymbolForAsset(futureMarkets, symbol.toUpperCase())
  const symbols = ['BTCUSD_PERP.A'];
  const res = await client[RESOURCES[resource]]({ symbols, ...params })
  fs.writeFileSync(filename, JSON.stringify(res), 'utf8')
}

function getDefaultRange(interval) {
  const now = Math.floor(Date.now() / 1000)
  switch (interval) {
    case INTERVAL_ONE_MIN:
    case INTERVAL_FIVE_MIN:
    case INTERVAL_FIFTEEN_MIN:
    case INTERVAL_THIRTY_MIN:
      return { from: now - 2 * 24 * 3600, to: now }
    case INTERVAL_ONE_HOUR:
    case INTERVAL_TWO_HOUR:
    case INTERVAL_FOUR_HOUR:
    case INTERVAL_SIX_HOUR:
      return { from: now - 14 * 24 * 3600, to: now }
    case INTERVAL_TWELVE_HOUR:
    case INTERVAL_DAILY:
      return { from: now - 90 * 24 * 3600, to: now }
    default:
      return { from: now - 7 * 24 * 3600, to: now }
  }
}

function parseDateOrTimestamp(val, fallback, isEndOfDay = false) {
  if (!val) return fallback
  if (/^\d+$/.test(val)) return parseInt(val, 10)
  const d = new Date(val)
  console.log(val)
  if (!isNaN(d.getTime())) {
    if (isEndOfDay) {
      d.setUTCHours(23, 59, 59, 999)
    } else {
      d.setUTCHours(0, 0, 0, 0)
    }
    console.log(d)
    return Math.floor(d.getTime() / 1000)
  }
  return fallback
}

handler().catch(e => console.error(e))
