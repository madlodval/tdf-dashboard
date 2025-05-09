import {
  AssetRepository,
  ExchangeRepository,
  OpenInterestRepository,
  IntervalRepository,
  VolumeRepository,
  LiquidationRepository
} from '@tdf/repositories'

function extractExchangeCode (symbol) {
  const parts = symbol.split('.')
  return parts.length > 1 ? parts[1] : null
}

function createExchangeIdCache (exchangeRepo) {
  const cache = new Map()

  return async function getExchangeId (symbol) {
    const exchangeCode = extractExchangeCode(symbol)
    if (!exchangeCode) {
      console.warn(`No exchange code found in symbol: ${symbol}`)
      return null
    }

    let exchangeId = cache.get(exchangeCode)
    if (exchangeId === undefined) {
      exchangeId = await exchangeRepo.findIdByCode(exchangeCode)
      cache.set(exchangeCode, exchangeId)
    }

    if (!exchangeId) {
      console.warn(`Exchange not found for code: ${exchangeCode} (symbol: ${symbol})`)
      return null
    }

    return exchangeId
  }
}

async function process ({ db, data, asset, interval, sync }, mainRepo, processEntry, saveData) {
  const assetRepo = new AssetRepository(db)
  const exchangeRepo = new ExchangeRepository(db)
  const intervalRepo = new IntervalRepository(db)
  const syncRepo = mainRepo.SyncRepository

  const assetId = await assetRepo.findIdBySymbol(asset)
  if (!assetId) throw new Error(`Asset not found: ${asset}`)

  const { id: intervalId, is_base: isBase, enabled } = await intervalRepo.findByName(interval)
  if (!intervalId) throw new Error(`Interval not found: ${interval}`)
  if (!enabled) throw new Error(`Interval not enabled: ${interval}`)

  const getExchangeId = createExchangeIdCache(exchangeRepo)

  let lastTimestampProcessed = await syncRepo.getLastTimestamp(assetId, intervalId)
  const lastSyncTimestamp = lastTimestampProcessed
  const acc = new Map()

  for (const block of data) {
    const exchangeId = await getExchangeId(block.symbol)
    if (!exchangeId) continue

    if (!acc.has(exchangeId)) {
      acc.set(exchangeId, new Map())
    }

    const lastTsProcessed = await processEntry({
      history: block.history,
      assetId,
      intervalId,
      lastSyncTimestamp,
      lastTimestampProcessed,
      acc,
      exchangeId
    })

    if (lastTsProcessed > lastTimestampProcessed) {
      lastTimestampProcessed = lastTsProcessed
    }
  }

  const batch = []
  for (const [exchangeId, tsMap] of acc.entries()) {
    for (const [timestamp, entryData] of tsMap.entries()) {
      batch.push({
        timestamp,
        exchangeId,
        assetId,
        intervalId,
        ...entryData
      })
    }
  }
  if (batch.length) {
    await saveData(batch, isBase)
    if (lastTimestampProcessed > lastSyncTimestamp) {
      await syncRepo.updateLastTimestamp(
        assetId,
        intervalId,
        lastTimestampProcessed
      )
    }
    if (sync) {
      await syncRepo.syncFromBase()
    }
  }
  return batch.length
}

export async function processOpenInterest (params) {
  const oiRepo = new OpenInterestRepository(params.db)

  return process(
    params,
    oiRepo,
    ({ history, acc, exchangeId, lastSyncTimestamp, lastTimestampProcessed }) => {
      for (const entry of history) {
        const timestamp = entry.t
        if (timestamp <= lastSyncTimestamp) {
          continue
        }

        const exMap = acc.get(exchangeId)
        const data = exMap.get(timestamp) || {
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          count: 0
        }

        data.open += entry.o
        data.close += entry.c
        data.high += entry.h
        data.low += entry.l
        data.count += 1
        exMap.set(timestamp, data)

        if (timestamp > lastTimestampProcessed) {
          lastTimestampProcessed = timestamp
        }
      }
      return lastTimestampProcessed
    },
    async (data, isBaseInterval) => {
      if (isBaseInterval) {
        await oiRepo.BaseRepository.save(data)
      }
      return oiRepo.save(data)
    }
  )
}

export async function processLiquidations (params) {
  const liquidationRepo = new LiquidationRepository(params.db)

  return process(
    params,
    liquidationRepo,
    ({ history, acc, exchangeId, lastSyncTimestamp, lastTimestampProcessed }) => {
      for (const entry of history) {
        const timestamp = entry.t
        if (timestamp <= lastSyncTimestamp) {
          continue
        }

        const exMap = acc.get(exchangeId)
        const data = exMap.get(timestamp) || { longs: 0, shorts: 0 }
        data.longs += entry.l
        data.shorts += entry.s
        exMap.set(timestamp, data)

        if (timestamp > lastTimestampProcessed) {
          lastTimestampProcessed = timestamp
        }
      }

      return lastTimestampProcessed
    },
    async (data, isBaseInterval) => {
      if (isBaseInterval) {
        await liquidationRepo.BaseRepository.save(data)
      }
      return liquidationRepo.save(data)
    }
  )
}

export async function processVolume (params) {
  const volumeRepo = new VolumeRepository(params.db)

  return process(
    params,
    volumeRepo,
    ({ history, acc, exchangeId, lastSyncTimestamp, lastTimestampProcessed }) => {
      for (const entry of history) {
        const ts = entry.t
        if (ts <= lastSyncTimestamp) {
          continue
        }

        const exMap = acc.get(exchangeId)
        const data = exMap.get(ts) || {
          open: 0,
          high: -Infinity,
          low: Infinity,
          close: 0,
          volume: 0,
          count: 0
        }
        data.open += entry.o
        data.high = Math.max(entry.h, data.high)
        data.low = Math.min(entry.l, data.low)
        data.close += entry.c
        data.volume += entry.v
        data.count += 1
        exMap.set(ts, data)

        if (ts > lastTimestampProcessed) {
          lastTimestampProcessed = ts
        }
      }
      return lastTimestampProcessed
    },
    async (data, isBaseInterval) => {
      data = data.map(({
        exchangeId,
        assetId,
        intervalId,
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        count
      }) => ({
        exchangeId,
        assetId,
        intervalId,
        timestamp,
        open: open / count,
        high,
        low,
        close: close / count,
        volume
      }))
      if (isBaseInterval) {
        await volumeRepo.BaseRepository.save(data)
      }
      return volumeRepo.save(data)
    }
  )
}
