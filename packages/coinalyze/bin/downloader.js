import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {
  IntervalRepository,
  OpenInterestRepository,
  VolumeRepository,
  LiquidationRepository,
  AssetRepository
} from '@tdf/repositories'

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
  [RESOURCE_OI]: getOpenInterestHistory,
  [RESOURCE_LQ]: getLiquidationHistory,
  [RESOURCE_VL]: getOhlcvHistory
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
  .option('asset', {
    alias: 'a',
    type: 'string',
    description: 'Símbolo del activo (BTC, ETH)',
    demandOption: true
  })
  .option('from', {
    alias: 'f',
    type: 'string',
    description: 'Fecha de inicio (YYYY-MM-DD) o timestamp UNIX de inicio (segundos)'
    // Default will be set by getDefaultRange based on interval
  })
  .option('to', {
    alias: 't',
    type: 'string',
    description: 'Fecha de fin (YYYY-MM-DD) o timestamp UNIX de fin (segundos)'
    // Default will be set by getDefaultRange based on interval
  })
  .help()
  .alias('help', 'h')
  .argv

let { resource, interval, asset, from, to } = argv

// Calculate default range based on interval
const defaultRange = getDefaultRange(interval)

// Use provided 'from'/'to' arguments, falling back to defaultRange values if not provided
from = parseDateOrTimestamp(from, defaultRange.from, false)
// For 'to', we only use the default if the argument was NOT provided.
to = parseDateOrTimestamp(to, argv.to === undefined ? defaultRange.to : to, true)

const params = {
  asset: asset.toUpperCase(),
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
const filename = path.join(storageDir, `${asset.toLowerCase()}_${interval}_${resource}.json`)

async function handler () {
  const db = connection()
  await db.connect()
  const cache = new JsonCache(storageDir, 86400)
  const client = new Coinalyze(process.env.COINALYZE_API_KEY)
  const futureMarkets = await cache.remember('future-markets', async () => client.getFutureMarkets())
  // const spotMarkets = await cache.remember('spot-markets', async () => client.getSpotMarkets())
  // const symbols = client.getSymbolForAsset(futureMarkets, symbol.toUpperCase())
  // NOTE: Using a hardcoded symbol for demonstration. You might want to dynamically get this.
  const symbols = [`${asset.toUpperCase()}USD_PERP.A`]

  const assetId = await new AssetRepository(db).findIdByName(params.asset)
  const { id: intervalId, seconds } = await new IntervalRepository(db).findByName(params.interval)
  if (!assetId) throw new Error(`Asset not found: ${params.asset}`)
  if (!intervalId) throw new Error(`Interval not found: ${params.interval}`)

  const res = await RESOURCES[resource](
    client,
    db,
    { intervalId, seconds, assetId },
    { symbols, ...params }
  )

  fs.writeFileSync(filename, JSON.stringify(res), 'utf8')
}

function getDefaultRange (interval) {
  const now = Math.floor(Date.now() / 1000)
  const maxIntradayPoints = 2000 // Maximum points for intraday intervals as per API doc
  const ninetyDaysInSeconds = 90 * 24 * 3600

  // Calculate end of current year timestamp
  const currentYear = new Date().getFullYear()
  const endOfYear = new Date(currentYear + 1, 0, 1) // January 1st of next year
  const endOfYearTimestamp = Math.floor(endOfYear.getTime() / 1000) - 1 // Last second of current year

  let intervalDurationInSeconds

  switch (interval) {
    case INTERVAL_ONE_MIN:
      intervalDurationInSeconds = 60
      break
    case INTERVAL_FIVE_MIN:
      intervalDurationInSeconds = 5 * 60
      break
    case INTERVAL_FIFTEEN_MIN:
      intervalDurationInSeconds = 15 * 60
      break
    case INTERVAL_THIRTY_MIN:
      intervalDurationInSeconds = 30 * 60
      break
    case INTERVAL_ONE_HOUR:
      intervalDurationInSeconds = 60 * 60
      break
    case INTERVAL_TWO_HOUR:
      intervalDurationInSeconds = 2 * 60 * 60
      break
    case INTERVAL_FOUR_HOUR:
      intervalDurationInSeconds = 4 * 60 * 60
      break
    case INTERVAL_SIX_HOUR:
      intervalDurationInSeconds = 6 * 60 * 60
      break
    case INTERVAL_TWELVE_HOUR:
      intervalDurationInSeconds = 12 * 60 * 60
      break
    case INTERVAL_DAILY:
      // For daily interval, calculate 'from' as 90 days back, 'to' is end of year by default
      return { from: now - ninetyDaysInSeconds, to: endOfYearTimestamp }
    default:
      // Fallback to 7 days if interval is somehow not matched (shouldn't happen with yargs choices)
      return { from: now - 7 * 24 * 3600, to: endOfYearTimestamp } // Also default to end of year for fallback
  }

  // For intraday intervals, calculate 'from' based on max points and interval duration, 'to' is end of year by default
  const intradayRangeInSeconds = maxIntradayPoints * intervalDurationInSeconds
  return { from: now - intradayRangeInSeconds, to: endOfYearTimestamp }
}

function parseDateOrTimestamp (val, fallback, isEndOfDay = false) {
  // Use fallback if val is undefined or null, UNLESS it's the 'to' argument and it was explicitly provided (even if it's an empty string or invalid format, we'll handle that later)
  if (val === undefined || val === null) return fallback
  if (/^\d+$/.test(val)) return parseInt(val, 10)
  const d = new Date(val)
  if (!isNaN(d.getTime())) {
    if (isEndOfDay) {
      // Set to the last second of the day
      d.setUTCHours(23, 59, 59, 999)
    } else {
      // Set to the beginning of the day
      d.setUTCHours(0, 0, 0, 0)
    }
    return Math.floor(d.getTime() / 1000)
  }
  // If val was provided but is not a valid date/timestamp, return the fallback
  return fallback
}

async function getOpenInterestHistory (client, db, { assetId, seconds }, params) {
  const oiRepo = new OpenInterestRepository(db)
  const lastSyncTimestamp = await oiRepo.getLastTimestamp(assetId, seconds)
  if (!IntervalRepository.isDaily(seconds) && lastSyncTimestamp > 0) {
    params.from = lastSyncTimestamp
  }

  return client.getOpenInterestHistory(params)
}

async function getLiquidationHistory (client, db, { intervalId, assetId, seconds }, params) {
  const lqRepo = new LiquidationRepository(db)
  const lastSyncTimestamp = await lqRepo.SyncRepository.getLastTimestamp(assetId, intervalId)
  if (!IntervalRepository.isDaily(seconds) && lastSyncTimestamp > 0) {
    params.from = lastSyncTimestamp
  }

  return client.getLiquidationHistory(params)
}

async function getOhlcvHistory (client, db, { intervalId, assetId, seconds }, params) {
  const vlRepo = new VolumeRepository(db)
  const lastSyncTimestamp = await vlRepo.SyncRepository.getLastTimestamp(assetId, intervalId)
  if (!IntervalRepository.isDaily(seconds) && lastSyncTimestamp > 0) {
    params.from = lastSyncTimestamp
  }

  return client.getOhlcvHistory(params)
}

handler().catch(e => console.error(e))
