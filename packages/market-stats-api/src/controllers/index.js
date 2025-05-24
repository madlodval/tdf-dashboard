import { compressTimeSeries } from '../utils/timeSeries.js'
import { validateAssetAndInterval } from '../validators/assetInterval.js'

// --- Handler para open interest ---
export const openInterestHandler = ({ assetRepository, openInterestRepository, intervalRepository }) => async (req, res) => {
  const { assetId, intervalId } = await validateAssetAndInterval(req, { assetRepository, intervalRepository })
  const oi = await openInterestRepository.findAllAccumByAssetId(assetId, intervalId)
  res.status(200).json(
    compressTimeSeries(oi, 'open', 'high', 'low', 'close')
  )
}

// --- Handler para ohlcv comprimido ---
export const ohlcvHandler = ({ assetRepository, volumeRepository, intervalRepository }) => async (req, res) => {
  const { assetId, intervalId } = await validateAssetAndInterval(req, { assetRepository, intervalRepository })
  const volume = await volumeRepository.findAllAccumByAssetId(assetId, intervalId)
  res.status(200).json(
    compressTimeSeries(volume, 'open', 'high', 'low', 'close', 'volume')
  )
}

// --- Handler para último close por exchange ---
export const latestOIByExchangeHandler = ({ assetRepository, openInterestRepository, intervalRepository, exchangeRepository }) => async (req, res) => {
  const { assetId, seconds } = await validateAssetAndInterval(req, { assetRepository, intervalRepository })
  const data = await openInterestRepository.findLatestCloseByExchange(assetId, seconds)
  const exchangeIds = new Set(data.map(d => d.exchange_id))
  const exchangeNames = await exchangeRepository.findNamesByIds([...exchangeIds])
  const labels = data.map(d => exchangeNames.get(d.exchange_id) || d.exchange_id)
  const values = data.map(d => d.close)
  res.status(200).json({ labels, values })
}

// --- Handler para liquidaciones comprimidas ---
export const liquidationsHandler = ({ assetRepository, liquidationRepository, intervalRepository }) => async (req, res) => {
  const { assetId, intervalId } = await validateAssetAndInterval(req, { assetRepository, intervalRepository })
  const liquidations = await liquidationRepository.findAllAccumByAssetId(assetId, intervalId)
  res.status(200).json(
    compressTimeSeries(liquidations, 'longs', 'shorts')
  )
}

// --- Handler para liquidaciones por exchange ---
export const latestLiquidationsByExchangeHandler = ({ assetRepository, liquidationRepository, intervalRepository, exchangeRepository }) => async (req, res) => {
  const { assetId, seconds } = await validateAssetAndInterval(req, { assetRepository, intervalRepository })
  const liquidations = await liquidationRepository.findAllByAssetId(assetId, seconds)

  if (!liquidations.length) {
    return res.status(200).json({ labels: [], longs: [], shorts: [] })
  }

  const lastTimestamp = Math.max(...liquidations.map(l => l.timestamp))
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
