// --- Auxiliar para validación y obtención de assetId y seconds ---
async function getAssetAndInterval ({ req, res, assetRepository, intervalRepository }) {
  const symbol = req.params.symbol?.toUpperCase()
  const intervalStr = req.query.interval || '1d'
  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) {
    res.status(400).json({ message: 'Symbol is required in the URL and must be alphanumeric (A-Z, 0-9).' })
    return {}
  }
  const assetId = await assetRepository.findIdBySymbol(symbol)
  if (!assetId) {
    res.status(404).json({ message: `Asset with symbol '${symbol}' not found.` })
    return {}
  }
  const { id: intervalId, seconds } = await intervalRepository.findByName(intervalStr)
  if (!seconds) {
    res.status(400).json({ message: `Interval '${intervalStr}' not found.` })
    return {}
  }
  return { assetId, intervalId, seconds }
}

// --- Handler para open interest ---
export const openInterestHandler = ({ assetRepository, openInterestRepository, intervalRepository }) => async (req, res) => {
  const { assetId, seconds } = await getAssetAndInterval({ req, res, assetRepository, intervalRepository })
  if (!assetId || !seconds) return
  console.log('oi', assetId, seconds)
  const oi = await openInterestRepository.findAllAccumByAssetId(assetId, seconds)

  res.status(200).json(
    compressTimeSeries(oi, 'open', 'high', 'low', 'close')
  )
}

// --- Handler para ohlcv comprimido (reemplaza volumeHandler) ---
export const ohlcvHandler = ({ assetRepository, volumeRepository, intervalRepository }) => async (req, res) => {
  const { assetId, intervalId } = await getAssetAndInterval({ req, res, assetRepository, intervalRepository })
  if (!assetId || !intervalId) return
  const volume = await volumeRepository.findAllAccumByAssetId(assetId, intervalId)

  res.status(200).json(
    compressTimeSeries(volume, 'open', 'high', 'low', 'close', 'volume')
  )
}

// --- Handler para último close por exchange y devolver todos los exchanges (id, name) ---
export const latestOIByExchangeHandler = ({ assetRepository, openInterestRepository, intervalRepository, exchangeRepository }) => async (req, res) => {
  const { assetId, seconds } = await getAssetAndInterval({ req, res, assetRepository, intervalRepository })
  if (!assetId || !seconds) return
  const data = await openInterestRepository.findLatestCloseByExchange(assetId, seconds)
  const exchangeIds = new Set(data.map(d => d.exchange_id))
  const exchangeNames = await exchangeRepository.findNamesByIds([...exchangeIds])
  const labels = data.map(d => exchangeNames.get(d.exchange_id) || d.exchange_id)
  const values = data.map(d => d.close)
  res.status(200).json({ labels, values })
}

// --- Handler para liquidaciones comprimidas ---
export const liquidationsHandler = ({ assetRepository, liquidationRepository, intervalRepository }) => async (req, res) => {
  const { assetId, intervalId } = await getAssetAndInterval({ req, res, assetRepository, intervalRepository })
  if (!assetId || !intervalId) return
  const liquidations = await liquidationRepository.findAllAccumByAssetId(assetId, intervalId)

  res.status(200).json(
    compressTimeSeries(liquidations, 'longs', 'shorts')
  )
}

// --- Handler para liquidaciones por exchange (última fecha, separando longs y shorts) ---
export const latestLiquidationsByExchangeHandler = ({ assetRepository, liquidationRepository, intervalRepository, exchangeRepository }) => async (req, res) => {
  const { assetId, seconds } = await getAssetAndInterval({ req, res, assetRepository, intervalRepository })
  if (!assetId || !seconds) return
  const liquidations = await liquidationRepository.findAllByAssetId(assetId, seconds)
  if (!liquidations.length) {
    return res.status(200).json({ labels: [], longs: [], shorts: [] })
  }
  // Encontrar la última fecha
  const lastTimestamp = Math.max(...liquidations.map(l => l.timestamp))
  // Agrupar por exchange
  const exchangeIds = new Set(liquidations.map(l => l.exchange_id))
  const exchangeNames = await exchangeRepository.findNamesByIds([...exchangeIds])
  const longsByExchange = {}
  const shortsByExchange = {}
  for (const row of liquidations) {
    if (row.timestamp !== lastTimestamp) continue
    const exchangeName = exchangeNames.get(row.exchange_id) || row.exchange_id
    if (!longsByExchange[exchangeName]) longsByExchange[exchangeName] = 0
    if (!shortsByExchange[exchangeName]) shortsByExchange[exchangeName] = 0
    longsByExchange[exchangeName] += (row.longs || 0)
    shortsByExchange[exchangeName] += (row.shorts || 0)
  }
  const labels = Object.keys(longsByExchange)
  const longs = labels.map(l => longsByExchange[l])
  const shorts = labels.map(l => shortsByExchange[l])
  res.status(200).json({ labels, longs, shorts })
}

function compressTimeSeries (data, ...includeFields) {
  if (!data.length) return []

  const base = data[0].time || data[0].timestamp
  let prev = base

  const compressedData = data.map((item, idx) => {
    const time = item.time || item.timestamp
    const offset = idx === 0 ? 0 : time - prev
    prev = time

    return [offset, ...includeFields.map(field =>
      typeof item[field] === 'number' ? item[field] : Number(item[field])
    )]
  })

  return [base, ...compressedData]
}
