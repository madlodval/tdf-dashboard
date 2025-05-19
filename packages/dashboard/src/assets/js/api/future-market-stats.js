import { MARKET_STATS_API_URL } from 'astro:env/client'

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

    if (currency === 'BASE') {
      oiConverted = oiData.map(oi => {
        const price = priceByTime[oi.time] || 0
        return {
          time: oi.time,
          open: price > 0 ? oi.open / price : oi.open,
          high: price > 0 ? oi.high / price : oi.high,
          low: price > 0 ? oi.low / price : oi.low,
          close: price > 0 ? oi.close / price : oi.close
        }
      })

      volumeConverted = volumeData.map(vol => {
        const price = priceByTime[vol.time] || 0
        return {
          time: vol.time,
          open: price > 0 ? vol.open / price : vol.open,
          high: price > 0 ? vol.high / price : vol.high,
          low: price > 0 ? vol.low / price : vol.low,
          close: price > 0 ? vol.close / price : vol.close,
          value: price > 0 ? vol.value / price : vol.value
        }
      })

      liquidationConverted = liquidations.map(lq => {
        const price = priceByTime[lq.time] || 0
        return {
          time: lq.time,
          longs: price > 0 ? lq.longs / price : lq.longs,
          shorts: price > 0 ? lq.shorts / price : lq.shorts
        }
      })
    }

    return {
      price: priceData,
      open_interest: oiConverted,
      volume: volumeConverted,
      liquidations: liquidationConverted
    }
  }

  async history (symbol, interval) {
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

    return {
      price: priceData,
      volume: volumeData,
      oi: sortSyncData(oiDataSynced),
      liquidation: sortSyncData(liqSynced)
    }
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
