import { filterSymbolsByDate } from './helpers.js'

export const INTERVAL_ONE_MIN = '1min'
export const INTERVAL_FIVE_MIN = '5min'
export const INTERVAL_FIFTEEN_MIN = '15min'
export const INTERVAL_THIRTY_MIN = '30min'
export const INTERVAL_ONE_HOUR = '1hour'
export const INTERVAL_TWO_HOUR = '2hour'
export const INTERVAL_FOUR_HOUR = '4hour'
export const INTERVAL_SIX_HOUR = '6hour'
export const INTERVAL_TWELVE_HOUR = '12hour'
export const INTERVAL_DAILY = 'daily'

export const INTERVAL_CONVERT = {
  '1m': INTERVAL_ONE_MIN,
  '5m': INTERVAL_FIVE_MIN,
  '15m': INTERVAL_FIFTEEN_MIN,
  '30m': INTERVAL_THIRTY_MIN,
  '1h': INTERVAL_ONE_HOUR,
  '2h': INTERVAL_TWO_HOUR,
  '4h': INTERVAL_FOUR_HOUR,
  '6h': INTERVAL_SIX_HOUR,
  '12h': INTERVAL_TWELVE_HOUR,
  '1D': INTERVAL_DAILY
}

const BASE_ASSETS = ['USD', 'USDT', 'USDC']

const BASE_URL = 'https://api.coinalyze.net/v1'
const DELAY = 2000 // milisegundos
const MAX_RETRY = 3

export class Coinalyze {
  constructor (apiKey) {
    this.apiKey = apiKey
    this.batchSize = 20
    this.hasExpired = false
  }

  async getFutureMarkets () {
    return this.#request('/future-markets')
  }

  async getSpotMarkets () {
    return this.#request('/spot-markets')
  }

  async getExchanges () {
    const exchanges = await this.#request('/exchanges')
    return exchanges.reduce((acc, entry) => {
      acc[entry.code] = entry.name
      return acc
    }, {})
  }

  getSymbolForAsset (markets, ...assets) {
    const symbolExchanges = []
    const now = Date.now()
    for (const { symbol, base_asset: baseAsset, quote_asset: quoteAsset, expire_at: expireAt } of markets) {
      // Solo incluir contratos no expirados
      if (
        assets.includes(baseAsset) &&
        BASE_ASSETS.includes(quoteAsset) &&
        (
          expireAt === null ||
          expireAt > now
        )
      ) {
        symbolExchanges.push(symbol)
        if (!this.hasExpired) {
          this.hasExpired = expireAt < now
        }
      }
    }
    return symbolExchanges
  }

  async getOpenInterestHistory ({ symbols, interval, from, to, convertToUsd = false }) {
    return this.#requestBySymbols(
      '/open-interest-history',
      symbols,
      {
        from,
        to,
        interval,
        convert_to_usd: convertToUsd ? 'true' : 'false'
      }
    )
  }

  async getOhlcvHistory ({ symbols, interval, from, to, convertToUsd = false }) {
    return this.#requestBySymbols(
      '/ohlcv-history',
      symbols,
      { from, to, interval, convert_to_usd: convertToUsd }
    )
  }

  async getLiquidationHistory ({ symbols, interval, from, to, convertToUsd = false }) {
    return this.#requestBySymbols(
      '/liquidation-history',
      symbols,
      { from, to, interval, convert_to_usd: convertToUsd }
    )
  }

  async getLongShortRatioHistory ({ symbols, interval, from, to }) {
    return this.#requestBySymbols(
      '/liquidation-history',
      symbols,
      { from, to, interval }
    )
  }

  sliceSymbols (symbolExchanges) {
    const result = []
    for (let i = 0; i < symbolExchanges.length; i += this.batchSize) {
      result.push(symbolExchanges.slice(i, i + this.batchSize))
    }
    return result
  }

  async #requestBySymbols (endpoint, symbols, params) {
    let result = []
    const filtered = filterSymbolsByDate(symbols, params.from, params.to)
    for (const chunk of this.sliceSymbols(filtered)) {
      const data = await this.#request(endpoint, { ...params, symbols: chunk.join(',') })
      result = result.concat(data)
    }
    return result
  }

  async #request (endpoint, params = {}) {
    let url = BASE_URL + endpoint
    if (Object.keys(params).length > 0) {
      url += '?' + new URLSearchParams(params).toString()
    }
    let retries = 0
    while (retries <= MAX_RETRY) {
      const response = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json'
        }
      })
      const body = await response.text()
      if (response.status === 200) {
        try {
          return JSON.parse(body)
        } catch (e) {
          throw new Error('Error parsing JSON: ' + body)
        }
      }
      if (response.status === 429) {
        retries++
        const retryAfter = parseInt(response.headers.get('Retry-After')) || (DELAY / 1000)
        if (retries <= MAX_RETRY) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
          continue
        }
      }
      throw new Error(`API request failed with status ${response.status}: ${body}`)
    }
    return null
  }
}
