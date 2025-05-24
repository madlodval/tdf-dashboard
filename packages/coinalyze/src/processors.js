import {
  AssetRepository,
  ExchangeRepository,
  OpenInterestRepository,
  IntervalRepository,
  VolumeRepository,
  LiquidationRepository
} from '@tdf/repositories'
import { CryptoMath } from '@tdf/math-utils'

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

  const { id: intervalId, enabled } = await intervalRepo.findByName(interval)
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
    await saveData(batch)
    if (lastTimestampProcessed > lastSyncTimestamp) {
      await syncRepo.updateLastTimestamp(
        assetId,
        intervalId,
        lastTimestampProcessed
      )
    }
    if (sync) {
      await syncRepo.syncFromBase({ assetId, intervalId })
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
          open: CryptoMath.create(0),
          high: CryptoMath.create(0),
          low: CryptoMath.create(0),
          close: CryptoMath.create(0),
          count: 0
        }

        data.open = CryptoMath.add(data.open, entry.o)
        data.close = CryptoMath.add(data.close, entry.c)
        data.high = CryptoMath.add(data.high, entry.h)
        data.low = CryptoMath.add(data.low, entry.l)
        data.count += 1
        exMap.set(timestamp, data)

        if (timestamp > lastTimestampProcessed) {
          lastTimestampProcessed = timestamp
        }
      }
      return lastTimestampProcessed
    },
    async (data) => {
      // Convertir BigNumbers a strings para BD
      const processedData = data.map(item => ({
        ...item,
        open: CryptoMath.toDBString(item.open),
        high: CryptoMath.toDBString(item.high),
        low: CryptoMath.toDBString(item.low),
        close: CryptoMath.toDBString(item.close)
      }))
      return oiRepo.save(processedData)
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
        const data = exMap.get(timestamp) || {
          longs: CryptoMath.create(0),
          shorts: CryptoMath.create(0)
        }

        data.longs = CryptoMath.add(data.longs, entry.l)
        data.shorts = CryptoMath.add(data.shorts, entry.s)
        exMap.set(timestamp, data)

        if (timestamp > lastTimestampProcessed) {
          lastTimestampProcessed = timestamp
        }
      }

      return lastTimestampProcessed
    },
    async (data) => {
      // Convertir BigNumbers a strings para BD
      const processedData = data.map(item => ({
        ...item,
        longs: CryptoMath.toDBString(item.longs),
        shorts: CryptoMath.toDBString(item.shorts)
      }))
      return liquidationRepo.save(processedData)
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
          open: CryptoMath.create(0),
          high: CryptoMath.create(-Infinity),
          low: CryptoMath.create(Infinity),
          close: CryptoMath.create(0),
          volume: CryptoMath.create(0),
          count: 0
        }

        data.open = CryptoMath.add(data.open, entry.o)
        data.high = CryptoMath.max(data.high, CryptoMath.create(entry.h))
        data.low = CryptoMath.min(data.low, CryptoMath.create(entry.l))
        data.close = CryptoMath.add(data.close, entry.c)
        data.volume = CryptoMath.add(data.volume, entry.v)
        data.count += 1
        exMap.set(ts, data)

        if (ts > lastTimestampProcessed) {
          lastTimestampProcessed = ts
        }
      }
      return lastTimestampProcessed
    },
    async (data) => {
      const processedData = data.map(({
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
        open: CryptoMath.toDBString(CryptoMath.divide(open, count)),
        high: CryptoMath.toDBString(high),
        low: CryptoMath.toDBString(low),
        close: CryptoMath.toDBString(CryptoMath.divide(close, count)),
        volume: CryptoMath.toDBString(volume)
      }))
      return volumeRepo.save(processedData)
    }
  )
}
