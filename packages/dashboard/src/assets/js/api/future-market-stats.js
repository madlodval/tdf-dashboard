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
  let maxVl = 0;
  let maxPr = 0;
  for (const { time, bar } of decodeSeries(ohlcvRaw)) {
    const [o, h, l, c, v] = bar
    priceData.push({ time, open: o, high: h, low: l, close: c })
    volumeData.push({ time, value: v })
    priceTs.push(time)
    maxVl = Math.max(maxVl,v)
    maxPr = Math.max(maxPr,o,h,l,c)
  }
  return [priceData, volumeData, priceTs, maxVl, maxPr]
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

function calculateVolumeSMA(volumeData, period = 20) {
  const smaData = [];
  let max = 0;
  for (let i =  0; i < volumeData.length; i++) {
      if (i < period - 1) {
          // Not enough data for average
          continue;
      }
      
      // Calculate average of last 'period' values
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
          sum += volumeData[j].value;
      }
      
      smaData.push({
          time: volumeData[i].time,
          value: sum / period
      });
      max = Math.max(max, sum / period)
  }
  
  return [smaData, max];
}  

function getScale(...values) {
  const MAX_SAFE = Number.MAX_SAFE_INTEGER / 100
  const value = Math.max(...values)
  console.log(value, +value > MAX_SAFE, MAX_SAFE);
  
  if (value < MAX_SAFE) {
    return 1;
  }
  if (value / 1000 < MAX_SAFE) {
    return 1000;
  }
  if (value / 1000000 < MAX_SAFE) {
    return 1000000;
  }
  if (value / 1000000000 < MAX_SAFE) {
    return 1000000000;
  }
}

function convertOhlc (scale, data) {
  return data.map(d => ({
    ...d,
    open: d.open / scale,
    high: d.high / scale,
    low: d.low / scale,
    close: d.close / scale,
  }))
}

function convertValue (scale, data) {
  return data.map(d => ({
    ...d,
    value: d.value / scale,
  }))
}


export class MarketStatsApi {
  constructor () {
    this.baseUrl = MARKET_STATS_API_URL
  }

  convert (priceData, oiData, volumeData, liquidations, smaVolume, max) {
    const priceByTime = Object.fromEntries(priceData.map(p => [p.time, p.close]))

    const oiConverted = oiData.map(oi => {
      const price = priceByTime[oi.time] || 0
      const entry = {
        time: oi.time,
        open: price > 0 ? +CryptoMath.multiply(oi.open, price).toFixed(2) : oi.open,
        high: price > 0 ? +CryptoMath.multiply(oi.high, price).toFixed(2) : oi.high,
        low: price > 0 ? +CryptoMath.multiply(oi.low, price).toFixed(2) : oi.low,
        close: price > 0 ? +CryptoMath.multiply(oi.close, price).toFixed(2) : oi.close
      }

      max.oi = Math.max(
        max.oi,
        +entry.close,
        +entry.high,
        +entry.low,
        +entry.open
      )

      return entry
    })

    const volumeConverted = volumeData.map(vol => {
      const price = priceByTime[vol.time] || 0
      const entry = {
        time: vol.time,
        value: price > 0 ? +CryptoMath.multiply(vol.value, price).toFixed(2) : vol.value,
      }
      max.vl = Math.max(
        max.vl, 
        +entry.value
      )
      return entry
    })

    const smaVolumeConverted = smaVolume.map(sma => {
      const price = priceByTime[sma.time] || 0
      const entry = {
        time: sma.time,
        value: price > 0 ? +CryptoMath.multiply(sma.value, price).toFixed(2) : sma.value,
      }
      max.sma = Math.max(
        max.sma,
        +entry.value
      ) 
      return entry
    })

    const liquidationConverted = liquidations.map(lq => {
      const price = priceByTime[lq.time] || 0
      const entry = {
        time: lq.time,
        longs: price > 0 ? +CryptoMath.multiply(lq.longs, price).toFixed(2) : lq.longs,
        shorts: price > 0 ? +CryptoMath.multiply(lq.shorts, price).toFixed(2) : lq.shorts
      }
      max.lq = Math.max(max.lq, +entry.longs, +entry.shorts)
      return entry
    })

    const scale = getScale(
      max.pr,
      max.oi,
      max.lq,
      max.vl,
      max.sma
    )

    return {
      price: convertOhlc(scale, priceData),
      oi: convertOhlc(scale, oiConverted),
      volume: convertValue(scale, volumeConverted),
      liquidation: convertOhlc(scale, liquidationConverted),
      smaVolume: convertValue(scale, smaVolumeConverted),
      scale
    }
  }

  async history (symbol, interval, convert = true) {
    const [oiRaw, ohlcvRaw, liqRaw] = await Promise.all([
      this.getOpenInterest(symbol, interval),
      this.getOhlcv(symbol, interval),
      this.getLiquidations(symbol, interval)
    ])
    const [priceData, volumeData, priceTs, maxVl, maxPr] = transformOhlcvData(ohlcvRaw)
    const lqData = transformLqData(liqRaw)
    const oiData = transformOiData(oiRaw)
    let maxOi = 0 
    const oiDataSynced = priceTs.map(ts => {
      let found = oiData.find(d => d.time === ts)
      found = found || { time: ts, open: 0, high: 0, low: 0, close: 0 }
      maxOi = Math.max(maxOi, found.close, found.high, found.low, found.open)
      return found
    })
    let maxLq = 0
    const liqSynced = priceTs.map(ts => {
      let found = lqData.find(d => d.time === ts)
      found = found || { time: ts, longs: 0, shorts: 0 }
      maxLq = Math.max(maxLq, found.longs, found.shorts)
      return found
    })
    
    const [smaVolume, maxSmaVolume] = calculateVolumeSMA(volumeData)

    const max = {
      oi: maxOi,
      lq: maxLq,
      vl: maxVl,
      pr: maxPr,
      sma: maxSmaVolume,
    }

    const result = {
      price: priceData,
      volume: volumeData,
      oi: sortSyncData(oiDataSynced),
      liquidation: sortSyncData(liqSynced),
      smaVolume: smaVolume,
    }

    if (!convert) {
      const scale = getScale(
        max.pr,
        max.oi,
        max.lq,
        max.vl,
        max.sma
      )
  
      return {
        price: convertOhlc(scale, result.price),
        oi: convertOhlc(scale, result.oi),
        volume: convertValue(scale, result.volume),
        liquidation: convertOhlc(scale, result.liquidation),
        smaVolume: convertValue(scale, result.smaVolume),
        scale
      }
    }

    return this.convert(
      result.price,
      result.oi,
      result.volume,
      result.liquidation,
      result.smaVolume,
      max
    )
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

  calculateRSI(data, period = 14) {
    const rsiData = [];
    const gains = [];
    const losses = [];
    
    // Calculate price changes
      for (let i = 1; i < data.length; i++) {
          const change = data[i].close - data[i-1].close;
          gains.push(change > 0 ? change : 0);
          losses.push(change < 0 ? Math.abs(change) : 0);
      }
      
      // Calculate RSI
      for (let i = period - 1; i < gains.length; i++) {
          // Average gains and losses
          const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
          const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
          
          const rs = avgGain / (avgLoss || 0.0001); // Avoid division by zero
          const rsi = 100 - (100 / (1 + rs));
          
          rsiData.push({
              time: data[i + 1].time,
              value: rsi
          });
      }
      
      return rsiData;
  }

}

export const marketStats = new MarketStatsApi()
