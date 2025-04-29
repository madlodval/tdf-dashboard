import {
  AssetRepository,
  ExchangeRepository,
  OpenInterestRepository,
  IntervalRepository,
  VolumeRepository,
  LiquidationRepository
} from '@tdf/repositories'

// Extrae el código del exchange de symbol (lo que está después del punto)
function extractExchangeCode(symbol) {
  const parts = symbol.split('.')
  return parts.length > 1 ? parts[1] : null
}

// Acumula el interés abierto (OHLC) por exchange y timestamp
export async function processOpenInterest({ db, symbol, data, interval }) {
  const assetRepo = new AssetRepository(db)
  const exchangeRepo = new ExchangeRepository(db)
  const oiRepo = new OpenInterestRepository(db)
  const intervalRepo = new IntervalRepository(db)
  const assetId = await assetRepo.findIdBySymbol(symbol)
  if (!assetId) throw new Error(`Asset not found: ${symbol}`)
  const intervalId = await intervalRepo.findIdByName(interval)
  if (!intervalId) throw new Error(`Interval not found: ${interval}`)

  // Cache para exchangeId por código
  const exchangeIdCache = new Map()
  // Estructura: { exchangeId: { timestamp: { open, high, low, close } } }
  const acc = new Map()

  for (const market of data) {
    const exchangeCode = extractExchangeCode(market.symbol)
    if (!exchangeCode) {
      console.warn(`No exchange code found in symbol: ${market.symbol}`)
      continue
    }
    let exchangeId = exchangeIdCache.get(exchangeCode)
    if (exchangeId === undefined) {
      exchangeId = await exchangeRepo.findIdByCode(exchangeCode)
      exchangeIdCache.set(exchangeCode, exchangeId)
    }
    if (!exchangeId) {
      console.warn(`Exchange not found for code: ${exchangeCode} (symbol: ${market.symbol})`)
      continue
    }
    for (const entry of market.history) {
      const ts = entry.t
      if (!acc.has(exchangeId)) acc.set(exchangeId, new Map())
      const exMap = acc.get(exchangeId)
      const ohlc = exMap.get(ts) || { open: 0, high: 0, low: 0, close: 0, count: 0 }
      ohlc.open += entry.o
      ohlc.close += entry.c
      ohlc.high += entry.h
      ohlc.low += entry.l
      ohlc.count += 1
      exMap.set(ts, ohlc)
    }
  }

  let totalSaved = 0
  // Guardar un registro por exchange, timestamp (acumulado)
  for (const [exchangeId, tsMap] of acc.entries()) {
    for (const [ts, ohlc] of tsMap.entries()) {
      // const count = ohlc.count || 1
      const count = 1
      await oiRepo.save({
        exchangeId,
        assetId,
        intervalId,
        timestamp: ts,
        open: ohlc.open / count,
        high: ohlc.high / count,
        low: ohlc.low / count,
        close: ohlc.close / count
      })
      totalSaved++
    }
  }
  console.log(`Open Interest OHLC importado para ${symbol}. Registros guardados: ${totalSaved}`)
}

// Procesa e importa datos de Liquidaciones
export async function processLiquidations({ db, symbol, data, interval }) {
  const assetRepo = new AssetRepository(db)
  const exchangeRepo = new ExchangeRepository(db)
  const liquidationRepo = new LiquidationRepository(db)
  const intervalRepo = new IntervalRepository(db)
  const assetId = await assetRepo.findIdBySymbol(symbol)
  if (!assetId) throw new Error(`Asset not found: ${symbol}`)
  const intervalId = await intervalRepo.findIdByName(interval)
  if (!intervalId) throw new Error(`Interval not found: ${interval}`)

  const exchangeIdCache = new Map()

  // data: [{ symbol: "...", history: [ { t, l, s }, ... ] }]
  for (const block of data) {
    const exchangeCode = extractExchangeCode(block.symbol)
    if (!exchangeCode) {
      console.warn(`No exchange code found in symbol: ${block.symbol}`)
      continue
    }
    let exchangeId = exchangeIdCache.get(exchangeCode)
    if (exchangeId === undefined) {
      exchangeId = await exchangeRepo.findIdByCode(exchangeCode)
      exchangeIdCache.set(exchangeCode, exchangeId)
    }
    if (!exchangeId) {
      console.warn(`Exchange not found for code: ${exchangeCode} (symbol: ${block.symbol})`)
      continue
    }
    for (const entry of block.history) {
      await liquidationRepo.save({
        exchangeId,
        assetId,
        intervalId,
        timestamp: entry.t,
        longs: entry.l,
        shorts: entry.s
      })
    }
  }
  console.log(`Liquidations imported for ${symbol}`)
}

// Procesa e importa datos de Volumen/OHLCV
export async function processVolume({ db, symbol, data, interval }) {
  const assetRepo = new AssetRepository(db)
  const exchangeRepo = new ExchangeRepository(db)
  const volumeRepo = new VolumeRepository(db)
  const intervalRepo = new IntervalRepository(db)
  const assetId = await assetRepo.findIdBySymbol(symbol)
  if (!assetId) throw new Error(`Asset not found: ${symbol}`)
  const intervalId = await intervalRepo.findIdByName(interval)
  if (!intervalId) throw new Error(`Interval not found: ${interval}`)

  // Cache para exchangeId por código
  const exchangeIdCache = new Map()
  // Estructura: { exchangeId: { timestamp: { open, high, low, close } } }
  const acc = new Map()

  for (const market of data) {
    const exchangeCode = extractExchangeCode(market.symbol)
    if (!exchangeCode) {
      console.warn(`No exchange code found in symbol: ${market.symbol}`)
      continue
    }
    let exchangeId = exchangeIdCache.get(exchangeCode)
    if (exchangeId === undefined) {
      exchangeId = await exchangeRepo.findIdByCode(exchangeCode)
      exchangeIdCache.set(exchangeCode, exchangeId)
    }
    if (!exchangeId) {
      console.warn(`Exchange not found for code: ${exchangeCode} (symbol: ${market.symbol})`)
      continue
    }
    for (const entry of market.history) {
      const ts = entry.t
      if (!acc.has(exchangeId)) acc.set(exchangeId, new Map())
      const exMap = acc.get(exchangeId)
      // Guardar suma y contador para promediar OHLC
      const ohlc = exMap.get(ts) || { sumOpen: 0, sumHigh: 0, sumLow: 0, sumClose: 0, volume: 0, count: 0 }
      ohlc.sumOpen += entry.o
      ohlc.sumHigh += entry.h
      ohlc.sumLow += entry.l
      ohlc.sumClose += entry.c
      ohlc.volume += entry.v
      ohlc.count += 1
      exMap.set(ts, ohlc)
    }
  }

  let totalSaved = 0
  // Guardar un registro por exchange, timestamp (acumulado y promediado)
  for (const [exchangeId, tsMap] of acc.entries()) {
    for (const [ts, ohlc] of tsMap.entries()) {
      const count = ohlc.count || 1
      await volumeRepo.save({
        exchangeId,
        assetId,
        intervalId,
        timestamp: ts,
        open: ohlc.sumOpen / count,
        high: ohlc.sumHigh / count,
        low: ohlc.sumLow / count,
        close: ohlc.sumClose / count,
        volume: ohlc.volume // totalizado
      })
      totalSaved++
    }
  }
  console.log(`Volume OHLC importado para ${symbol}. Registros guardados: ${totalSaved}`)
}
