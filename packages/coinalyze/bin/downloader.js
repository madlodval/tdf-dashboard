import fs from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

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
  [RESOURCE_VL]: 'getOhlcvHistory',
  [RESOURCE_LQ]: 'getLiquidationHistory'
}

const CHOICES_RESOURCES = Object.keys(RESOURCES)

const argv = yargs(hideBin(process.argv))
  .option('resource', {
    alias: 'r',
    type: 'array',
    description: 'API resources to download (oi, vl, lq). If not specified, downloads all in order: oi, vl, lq.',
    choices: CHOICES_RESOURCES,
    default: CHOICES_RESOURCES
  })
  .option('interval', {
    alias: 'i',
    type: 'string',
    description: 'Time interval type. If not specified, downloads all active intervals.',
    choices: Object.keys(INTERVAL_CONVERT)
    // demandOption: true // Ya no es obligatorio
  })
  .option('asset', {
    alias: 'a',
    type: 'string',
    description: 'Asset symbol (BTC, ETH)',
    demandOption: true
  })
  .option('from', {
    alias: 'f',
    type: 'string',
    description: 'Start date (YYYY-MM-DD) or UNIX timestamp (seconds)'

  })
  .option('to', {
    alias: 't',
    type: 'string',
    description: 'End date (YYYY-MM-DD) or UNIX timestamp (seconds)'

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
  const maxIntraDayPoints = 2500
  const intervalDurationInSeconds = INTERVAL_SECONDS[interval] || 0
  const intraDayRangeInSeconds = (
    intervalDurationInSeconds === INTERVAL_SECONDS['1d']
      ? 90
      : maxIntraDayPoints
  ) * intervalDurationInSeconds

  const targetFrom = now - intraDayRangeInSeconds
  const targetTo = now + intervalDurationInSeconds

  const from = ensureInterval(targetFrom, intervalDurationInSeconds)
  const to = ensureInterval(targetTo, intervalDurationInSeconds, true)

  return { from, to }
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

async function getLastSyncTimestampForResource (db, resource, assetId, intervalId) {
  switch (resource) {
    case RESOURCE_OI:
      return new OpenInterestRepository(db).SyncRepository.getLastTimestamp(assetId, intervalId)
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

function buildDownloadRanges (from, to, intervalName, intervalSeconds, now) {
  const downloadRanges = []
  if (from === undefined && to === undefined && intervalSeconds === INTERVAL_SECONDS['1d']) {
    const currentYear = new Date().getFullYear()
    const previousYear = currentYear - 1
    const endOfPreviousYearTimestamp = getSeconds(new Date(`${previousYear}-12-31T23:59:59Z`))

    downloadRanges.push({ from: earliestKnownTimestamp, to: endOfPreviousYearTimestamp })

    const fromCurrentYear = getSeconds(new Date(`${currentYear}-01-01T00:00:00Z`))
    downloadRanges.push({
      from: ensureInterval(fromCurrentYear, intervalSeconds),
      to: ensureInterval(now + intervalSeconds, intervalSeconds, true)
    })
  } else {
    const defaultRange = getDefaultRange(now, intervalName)
    const finalFrom = parseDateOrTimestamp(from, defaultRange.from, false)
    const finalTo = parseDateOrTimestamp(to, to === undefined ? defaultRange.to : to, true)
    downloadRanges.push({ from: finalFrom, to: finalTo })
  }
  return downloadRanges
}

async function downloadResource (db, client, resource, assetId, intervalId, intervalName, intervalSeconds, downloadRanges, assetSymbol, symbols) {
  const lastSyncTimestamp = await getLastSyncTimestampForResource(db, resource, assetId, intervalId)

  for (const range of downloadRanges) {
    if (lastSyncTimestamp >= range.to) {
      continue
    }

    let currentFrom = range.from
    if (!IntervalRepository.isDaily(intervalSeconds) && lastSyncTimestamp >= range.from) {
      currentFrom = lastSyncTimestamp + intervalSeconds
    }

    if (currentFrom >= range.to) {
      continue
    }

    const resourceDir = path.join(baseStorageDir, resource)
    const assetDir = path.join(resourceDir, assetSymbol.toLowerCase())
    const intervalDir = path.join(assetDir, intervalName)

    const filename = `${currentFrom}-${range.to}.json`
    const filePath = path.join(intervalDir, filename)

    if (fs.existsSync(filePath)) {
      continue
    }

    const clientMethod = RESOURCES[resource]
    const currentParams = {
      asset: assetSymbol.toUpperCase(),
      interval: INTERVAL_CONVERT[intervalName],
      from: currentFrom,
      to: range.to
    }

    console.log(`Downloading ${resource} for ${assetSymbol} ${intervalName} from ${currentFrom} to ${range.to}`)

    const res = await client[clientMethod]({ symbols, ...currentParams })

    if (!fs.existsSync(intervalDir)) {
      fs.mkdirSync(intervalDir, { recursive: true })
    }

    fs.writeFileSync(filePath, JSON.stringify(res), 'utf8')
  }
}

async function getIntervalsToDownload (selectedInterval, intervalRepo) {
  let intervalsToDownload = []

  if (selectedInterval) {
    const intervalData = await intervalRepo.findByName(selectedInterval)
    if (!intervalData) {
      console.error(`Error: Interval not found in database: ${selectedInterval}`)
      process.exit(1)
    }
    if (!intervalData.enabled) {
      console.error(`Error: Interval not found enabled: ${selectedInterval}`)
      process.exit(1)
    }
    intervalsToDownload.push(intervalData)
  } else {
    intervalsToDownload = await intervalRepo.findAllSynchronizable()
    if (intervalsToDownload.length === 0) {
      console.error('Error: No active intervals found in the database.')
      process.exit(1)
    }
  }

  return intervalsToDownload
}

async function handler () {
  const db = connection()
  try {
    await db.connect()
    const { resource: selectedResources, interval: selectedInterval, asset, from, to } = argv
    const cache = new JsonCache(baseStorageDir, INTERVAL_SECONDS['1d'])
    const client = new Coinalyze(process.env.COINALYZE_API_KEY)
    const futureMarkets = await cache.remember('future-markets', async () => client.getFutureMarkets())

    // const symbols = client.getSymbolForAsset(futureMarkets, asset.toUpperCase())

    const symbols = [
      `${asset.toUpperCase()}USD_PERP.A`, `${asset.toUpperCase()}USDT_PERP.A`
    ]

    if (client.hasExpired) { // ensures that the cache is deleted if the API key has expired
      // cache.delete('future-markets')
    }

    const assetRepo = new AssetRepository(db)
    const intervalRepo = new IntervalRepository(db)

    const assetId = await assetRepo.findIdBySymbol(asset.toUpperCase())

    if (!assetId) {
      console.error(`Error: Asset not found in database: ${asset}`)
      process.exit(1)
    }

    const intervalsToDownload = await getIntervalsToDownload(selectedInterval, intervalRepo)

    const now = getSeconds(Date.now())

    for (const intervalData of intervalsToDownload) {
      const { id: intervalId, name: intervalName, seconds: intervalSeconds } = intervalData
      const downloadRanges = buildDownloadRanges(from, to, intervalName, intervalSeconds, now)

      for (const resource of selectedResources) {
        await downloadResource(
          db,
          client,
          resource,
          assetId,
          intervalId,
          intervalName,
          intervalSeconds,
          downloadRanges,
          asset,
          symbols
        )
      }
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
