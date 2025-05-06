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

export async function processOpenInterest ({ db, asset, data, interval }) {
  return db.transaction(async () => {
    const assetRepo = new AssetRepository(db)
    const exchangeRepo = new ExchangeRepository(db)
    const intervalRepo = new IntervalRepository(db)
    const oiRepo = new OpenInterestRepository(db)
    const assetId = await assetRepo.findIdBySymbol(asset)
    if (!assetId) throw new Error(`Asset not found: ${asset}`)
    const { id: intervalId, seconds } = await intervalRepo.findByName(interval)
    if (!intervalId) throw new Error(`Interval not found: ${interval}`)

    const getExchangeId = createExchangeIdCache(exchangeRepo)
    const acc = new Map()
    const lastTimestampProcessed = await oiRepo.getLastTimestamp(
      assetId,
      seconds
    )

    for (const market of data) {
      const exchangeId = await getExchangeId(market.symbol)
      if (!exchangeId) {
        continue
      }
      if (!acc.has(exchangeId)) {
        acc.set(exchangeId, new Map())
      }
      for (const entry of market.history) {
        const ts = entry.t
        if (ts <= lastTimestampProcessed) {
          continue
        }
        const exMap = acc.get(exchangeId)
        const ohlc = exMap.get(ts) || {
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          count: 0
        }
        ohlc.open += entry.o
        ohlc.close += entry.c
        ohlc.high += entry.h
        ohlc.low += entry.l
        ohlc.count += 1
        exMap.set(ts, ohlc)
      }
    }

    let totalSaved = 0
    for (const [exchangeId, tsMap] of acc.entries()) {
      for (const [ts, ohlc] of tsMap.entries()) {
        await oiRepo.save({
          exchangeId,
          assetId,
          timestamp: ts,
          open: ohlc.open,
          high: ohlc.high,
          low: ohlc.low,
          close: ohlc.close
        })
        totalSaved++
      }
    }
    return totalSaved
  })
}

export async function processLiquidations ({ db, asset, data, interval }) {
  return db.transaction(async () => {
    const assetRepo = new AssetRepository(db)
    const exchangeRepo = new ExchangeRepository(db)
    const liquidationRepo = new LiquidationRepository(db)
    const liquidationRepoBase = liquidationRepo.BaseRepository
    const syncRepo = liquidationRepo.SyncRepository
    const intervalRepo = new IntervalRepository(db)
    const assetId = await assetRepo.findIdBySymbol(asset)
    if (!assetId) throw new Error(`Asset not found: ${asset}`)
    const { id: intervalId, seconds } = await intervalRepo.findByName(interval)
    if (!intervalId) throw new Error(`Interval not found: ${interval}`)
    const isBaseInterval = IntervalRepository.isBase(seconds)

    const getExchangeId = createExchangeIdCache(exchangeRepo)

    let lastTimestampProcessed = await syncRepo.getLastTimestamp(
      assetId, intervalId
    )
    const lastSyncTimestamp = lastTimestampProcessed
    const acc = new Map()

    for (const block of data) {
      const exchangeId = await getExchangeId(block.symbol)
      if (!exchangeId) continue
      if (!acc.has(exchangeId)) {
        acc.set(exchangeId, new Map())
      }
      for (const entry of block.history) {
        const timestamp = entry.t
        if (timestamp <= lastSyncTimestamp) {
          continue
        }
        const exMap = acc.get(exchangeId)
        const liquidationEntry = exMap.get(timestamp) || { longs: 0, shorts: 0 }
        liquidationEntry.longs += entry.l
        liquidationEntry.shorts += entry.s
        exMap.set(timestamp, liquidationEntry)

        if (timestamp > lastTimestampProcessed) {
          lastTimestampProcessed = timestamp
        }
      }
    }

    let totalSaved = 0
    for (const [exchangeId, tsMap] of acc.entries()) {
      for (const [timestamp, { longs, shorts }] of tsMap.entries()) {
        const dataToSaveAgg = {
          exchangeId,
          assetId,
          intervalId,
          timestamp,
          longs,
          shorts
        }
        await liquidationRepo.save(dataToSaveAgg)
        if (isBaseInterval) {
          await liquidationRepoBase.save(dataToSaveAgg)
        }
        totalSaved++
      }
    }

    if (lastTimestampProcessed > lastSyncTimestamp) {
      await syncRepo.updateLastTimestamp(
        assetId,
        intervalId,
        lastTimestampProcessed
      )
    }
    return totalSaved
  })
}

export async function processVolume ({ db, asset, data, interval }) {
  return db.transaction(async () => {
    const assetRepo = new AssetRepository(db)
    const exchangeRepo = new ExchangeRepository(db)
    const volumeRepo = new VolumeRepository(db)
    const volumeRepoBase = volumeRepo.BaseRepository
    const syncVolumeRepo = volumeRepo.SyncRepository
    const intervalRepo = new IntervalRepository(db)
    const assetId = await assetRepo.findIdBySymbol(asset)
    if (!assetId) throw new Error(`Asset not found: ${asset}`)
    const { id: intervalId, seconds } = await intervalRepo.findByName(interval)
    if (!intervalId) throw new Error(`Interval not found: ${interval}`)
    const isBaseInterval = IntervalRepository.isBase(seconds)

    const getExchangeId = createExchangeIdCache(exchangeRepo)
    const acc = new Map()
    let lastTimestampProcessed = await syncVolumeRepo.getLastTimestamp(
      assetId,
      intervalId
    )

    const lastSyncTimestamp = lastTimestampProcessed

    for (const market of data) {
      const exchangeId = await getExchangeId(market.symbol)
      if (!exchangeId) {
        continue
      }
      if (!acc.has(exchangeId)) {
        acc.set(exchangeId, new Map())
      }
      for (const entry of market.history) {
        const ts = entry.t
        if (ts <= lastSyncTimestamp) {
          continue
        }
        const exMap = acc.get(exchangeId)
        const ohlc = exMap.get(ts) || {
          open: 0,
          high: -Infinity,
          low: Infinity,
          close: 0,
          volume: 0,
          count: 0
        }
        ohlc.open += entry.o
        ohlc.high = Math.max(entry.h, ohlc.high)
        ohlc.low = Math.min(entry.l, ohlc.low)
        ohlc.close += entry.c
        ohlc.volume += entry.v
        ohlc.count += 1
        exMap.set(ts, ohlc)
        if (ts > lastTimestampProcessed) {
          lastTimestampProcessed = ts
        }
      }
    }

    let totalSaved = 0
    for (const [exchangeId, tsMap] of acc.entries()) {
      for (const [ts, { open, count, low, high, close, volume }] of tsMap.entries()) {
        const data = {
          exchangeId,
          assetId,
          intervalId,
          timestamp: ts,
          open: open / count,
          high,
          low,
          close: close / count,
          volume
        }
        await volumeRepo.save(data)
        if (isBaseInterval) {
          await volumeRepoBase.save(data)
        }
        totalSaved++
      }
    }

    if (lastTimestampProcessed > lastSyncTimestamp) {
      await syncVolumeRepo.updateLastTimestamp(
        assetId,
        intervalId,
        lastTimestampProcessed
      )
    }
    return totalSaved
  })
}
