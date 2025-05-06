import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import 'dotenv/config'

import {
  IntervalRepository,
  OpenInterestRepository,
  VolumeRepository,
  LiquidationRepository,
  AssetRepository,
  connection,
  INTERVAL_SECONDS
} from '@tdf/repositories'

import {
  Coinalyze,
  INTERVAL_CONVERT
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
    choices: Object.keys(INTERVAL_CONVERT),
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

  })
  .option('to', {
    alias: 't',
    type: 'string',
    description: 'Fecha de fin (YYYY-MM-DD) o timestamp UNIX de fin (segundos)'

  })
  .help()
  .alias('help', 'h')
  .argv

const baseStorageDir = path.resolve(process.cwd(), 'storage')
const earliestKnownTimestamp = 1420070400 // 2015-01-01

function ensureInterval (time, seconds, isTo = false) {
  const round = isTo ? 'ceil' : 'floor'

  return Math[round](time / seconds) * seconds
}

function getDefaultRange (now, interval) {
  const maxIntraDayPoints = 2000 // Max 2000
  const intervalDurationInSeconds = INTERVAL_SECONDS[interval] || 0
  const intraDayRangeInSeconds = (
    intervalDurationInSeconds === INTERVAL_SECONDS['1d']
      ? 90 // 3 MONTH
      : maxIntraDayPoints
  ) * intervalDurationInSeconds

  const targetFrom = now - intraDayRangeInSeconds
  const targetTo = now + intervalDurationInSeconds

  const from = ensureInterval(targetFrom, intervalDurationInSeconds)

  const to = ensureInterval(targetTo, intervalDurationInSeconds, true)

  return {
    from,
    to
  }
}

function parseDateOrTimestamp (val, fallback, isEndOfDay = false) {
  if (val === undefined || val === null) return fallback

  if (/^\d+$/.test(val)) return parseInt(val, 10)

  const d = new Date(val)
  if (!isNaN(d.getTime())) {
    if (isEndOfDay) {
      d.setUTCHours(23, 59, 59, 999)
    } else {
      d.setUTCHours(0, 0, 0, 0)
    }

    return ensureInterval(d.getTime(), isEndOfDay)
  }

  return fallback
}

async function getLastSyncTimestampForResource (db, resource, assetId, intervalId, seconds) {
  switch (resource) {
    case RESOURCE_OI:

      return new OpenInterestRepository(db).getLastTimestamp(assetId, seconds)
    case RESOURCE_LQ:

      return new LiquidationRepository(db).SyncRepository.getLastTimestamp(assetId, intervalId)
    case RESOURCE_VL:

      return new VolumeRepository(db).SyncRepository.getLastTimestamp(assetId, intervalId)
    default:
      console.warn(`Unknown resource type '${resource}' for getting last sync timestamp. Returning 0.`)
      return 0
  }
}

function getSeconds (time) {
  if (time instanceof Date) {
    time = time.getTime()
  }
  return Math.floor(time / 1000)
}

async function handler () {
  let db
  try {
    db = connection()
    await db.connect()
    const { resource, interval, asset, from, to } = argv
    const cache = new JsonCache(baseStorageDir, INTERVAL_SECONDS['1d'])
    const client = new Coinalyze(process.env.COINALYZE_API_KEY)

    const symbols = ['BTCUSD_PERP.A']

    const assetRepo = new AssetRepository(db)
    const intervalRepo = new IntervalRepository(db)
    const assetId = await assetRepo.findIdBySymbol(asset.toUpperCase())
    const { id: intervalId, seconds } = await intervalRepo.findByName(interval)
    console.log('SECONDS: ', seconds)
    if (!assetId) {
      console.error(`Error: Asset not found in database: ${asset}`)
      process.exit(1)
    }
    if (!intervalId) {
      console.error(`Error: Interval not found in database: ${interval}`)
      process.exit(1)
    }

    const downloadRanges = []
    const now = getSeconds(Date.now())

    if (from === undefined && to === undefined && seconds === INTERVAL_SECONDS['1d']) {
      const currentYear = new Date().getFullYear()

      const previousYear = currentYear - 1
      const endOfPreviousYearTimestamp = getSeconds(
        new Date(`${previousYear}-12-31T23:59:59Z`)
      )

      downloadRanges.push({
        from: earliestKnownTimestamp,
        to: endOfPreviousYearTimestamp
      })

      const fromCurrentYear = getSeconds(
        new Date(`${currentYear}-01-01T00:00:00Z`)
      )
      downloadRanges.push({
        from: ensureInterval(fromCurrentYear, seconds),
        to: ensureInterval(now + seconds, seconds, true)
      })
    } else {
      const defaultRange = getDefaultRange(now, interval)
      console.log(defaultRange)
      const finalFrom = parseDateOrTimestamp(from, defaultRange.from, false)
      const finalTo = parseDateOrTimestamp(to, to === undefined ? defaultRange.to : to, true)
      downloadRanges.push({ from: finalFrom, to: finalTo })
    }

    const lastSyncTimestamp = await getLastSyncTimestampForResource(db, resource, assetId, intervalId, seconds)

    for (const range of downloadRanges) {
      if (lastSyncTimestamp >= range.to) {
        console.log(`Skipping download for ${resource} data for ${asset} at ${interval} from ${new Date(range.from * 1000).toISOString()} to ${new Date(range.to * 1000).toISOString()}: Already synchronized.`)
        continue
      }

      if (!IntervalRepository.isDaily(seconds) && lastSyncTimestamp >= range.from) {
        range.from = lastSyncTimestamp + seconds
        console.log(`Adjusting download 'from' date to ${range.from} for ${resource} data for ${asset} at ${interval}.`)
      }

      const resourceDir = path.join(baseStorageDir, resource)
      const assetDir = path.join(resourceDir, asset.toLowerCase())
      const intervalDir = path.join(assetDir, interval)

      const filename = `${range.from}-${range.to}.json`
      const filePath = path.join(intervalDir, filename)

      if (fs.existsSync(filePath)) {
        continue
      }

      const clientMethod = RESOURCES[resource]
      const currentParams = {
        asset: asset.toUpperCase(),
        interval: INTERVAL_CONVERT[interval], // interval in coinalyze
        from: range.from,
        to: range.to
      }

      if (resource !== RESOURCE_VL) {
        currentParams.convertToUsd = true
      }

      console.log(`Downloading ${resource} data for ${asset} at ${interval} from ${new Date(range.from * 1000).toISOString()} to ${new Date(range.to * 1000).toISOString()}`)

      const res = await client[clientMethod]({ symbols, ...currentParams })

      if (!fs.existsSync(intervalDir)) {
        fs.mkdirSync(intervalDir, { recursive: true })
      }

      fs.writeFileSync(filePath, JSON.stringify(res), 'utf8')
      console.log(`Data saved to ${filePath}`)
    }
  } catch (error) {
    console.error('-----------------------------------------')
    console.error('Critical error during execution:')
    console.error(error.message)
    console.error(error.stack)
    console.error('-----------------------------------------')
    process.exitCode = 1
  } finally {
    if (db) {
      await db.disconnect()
    }
  }
}

handler().catch(e => console.error(e))
