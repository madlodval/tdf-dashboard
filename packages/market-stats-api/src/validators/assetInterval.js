import { ValidationError, NotFoundError } from '../errors.js'

export async function validateAssetAndInterval (req, { assetRepository, intervalRepository }) {
  const symbol = req.params.symbol?.toUpperCase()
  const intervalStr = req.query.interval || '1d'

  if (!symbol || !/^[A-Z0-9]+$/.test(symbol)) {
    throw new ValidationError('Symbol is required in the URL and must be alphanumeric (A-Z, 0-9).')
  }

  const assetId = await assetRepository.findIdBySymbol(symbol)
  if (!assetId) {
    throw new NotFoundError(`Asset with symbol '${symbol}'`)
  }

  const { id: intervalId, seconds } = await intervalRepository.findByName(intervalStr)
  if (!seconds) {
    throw new ValidationError(`Interval '${intervalStr}' not found.`)
  }

  return { assetId, intervalId, seconds }
}
