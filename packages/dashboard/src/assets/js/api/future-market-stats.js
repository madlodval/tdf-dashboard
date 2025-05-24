import { MARKET_STATS_API_URL } from 'astro:env/client'
import { CryptoMath } from '@tdf/math-utils'

export const PRICE_CURRENCY = 'USD'

function * decodeSeries (arr) {
  let currentTime = arr[0]

  for (let i = 1; i < arr.length; ++i) {
    const item = arr[i]
    const offset = item[0]
    const values = item.slice(1)
    currentTime += offset
    yield { time: currentTime, bar: values }
  }
}

function transformOhlcvData (ohlcvRaw) {
  const priceData = []
  const volumeData = []
  const priceTs = []
  for (const { time, bar } of decodeSeries(ohlcvRaw)) {
    const [o, h, l, c, v] = bar
    priceData.push({ time, open: o, high: h, low: l, close: c })
    volumeData.push({ time, value: v })
    priceTs.push(time)
  }
  return [priceData, volumeData, priceTs]
}

function transformLqData (arr) {
  const result = []
  for (const { time, bar } of decodeSeries(arr)) {
    const [longs, shorts] = bar
    result.push({ time, longs, shorts })
  }
  return result
}

function transformOiData (oiRaw) {
  const result = []
  for (const { time, bar } of decodeSeries(oiRaw)) {
    const [open, high, low, close] = bar
    result.push({ time, open, high, low, close })
  }
  return result
}

function sortSyncData (data) {
  return data.sort((a, b) => a.time - b.time)
}

export class MarketStatsApi {
  constructor () {
    this.baseUrl = MARKET_STATS_API_URL
  }

  convert (currency, priceData, oiData, volumeData, liquidations) {
    const priceByTime = Object.fromEntries(priceData.map(p => [p.time, p.close]))

    let oiConverted = oiData
    let volumeConverted = volumeData
    let liquidationConverted = liquidations

    if (currency === PRICE_CURRENCY) {
      oiConverted = oiData.map(oi => {
        const price = priceByTime[oi.time] || 0
        return {
          time: oi.time,
          open: price > 0 ? +CryptoMath.multiply(oi.open, price).toFixed(2) : oi.open,
          high: price > 0 ? +CryptoMath.multiply(oi.high, price).toFixed(2) : oi.high,
          low: price > 0 ? +CryptoMath.multiply(oi.low, price).toFixed(2) : oi.low,
          close: price > 0 ? +CryptoMath.multiply(oi.close, price).toFixed(2) : oi.close
        }
      })

      volumeConverted = volumeData.map(vol => {
        const price = priceByTime[vol.time] || 0
        return {
          time: vol.time,
          open: price > 0 ? +CryptoMath.multiply(vol.open, price).toFixed(2) : vol.open,
          high: price > 0 ? +CryptoMath.multiply(vol.high, price).toFixed(2) : vol.high,
          low: price > 0 ? +CryptoMath.multiply(vol.low, price).toFixed(2) : vol.low,
          close: price > 0 ? +CryptoMath.multiply(vol.close, price).toFixed(2) : vol.close,
          value: price > 0 ? +CryptoMath.multiply(vol.value, price).toFixed(2) : vol.value
        }
      })

      liquidationConverted = liquidations.map(lq => {
        const price = priceByTime[lq.time] || 0
        return {
          time: lq.time,
          longs: price > 0 ? +CryptoMath.multiply(lq.longs, price).toFixed(2) : lq.longs,
          shorts: price > 0 ? +CryptoMath.multiply(lq.shorts, price).toFixed(2) : lq.shorts
        }
      })
    }

    return {
      price: priceData,
      oi: oiConverted,
      volume: volumeConverted,
      liquidation: liquidationConverted
    }
  }

  async history (symbol, interval, convert = true) {
    const [oiRaw, ohlcvRaw, liqRaw] = await Promise.all([
      this.getOpenInterest(symbol, interval),
      this.getOhlcv(symbol, interval),
      this.getLiquidations(symbol, interval)
    ])
    const [priceData, volumeData, priceTs] = transformOhlcvData(ohlcvRaw)
    const lqData = transformLqData(liqRaw)
    const oiData = transformOiData(oiRaw)
    const oiDataSynced = priceTs.map(ts => {
      const found = oiData.find(d => d.time === ts)
      return found || { time: ts, open: 0, high: 0, low: 0, close: 0 }
    })
    const liqSynced = priceTs.map(ts => {
      const found = lqData.find(d => d.time === ts)
      return found || { time: ts, longs: 0, shorts: 0 }
    })

    const result = {
      price: priceData,
      volume: volumeData,
      oi: sortSyncData(oiDataSynced),
      liquidation: sortSyncData(liqSynced)
    }

    return convert
      ? this.convert(
        PRICE_CURRENCY,
        result.price,
        result.oi,
        result.volume,
        result.liquidation
      )
      : result
  }

  async get (path, params) {
    const url = `${this.baseUrl}/api/${path}?${new URLSearchParams(params).toString()}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  async getOpenInterest (symbol, interval) {
    return this.get(`open-interest/${symbol}`, { interval })
  }

  async getOhlcv (symbol, interval) {
    return this.get(`ohlcv/${symbol}`, { interval })
  }

  async getLiquidations (symbol, interval) {
    return this.get(`liquidations/${symbol}`, { interval })
  }
}

export const marketStats = new MarketStatsApi()
