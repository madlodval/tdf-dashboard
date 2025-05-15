import { MARKET_STATS_API_URL } from "astro:env/client";

function* decodeSeries (arr) {
  let currentTime = arr[0]; 

  for (let i = 1; i < arr.length; ++i) {
    const item = arr[i];
    const offset = item[0];
    const values = item.slice(1);
    currentTime += offset;  
    yield { time: currentTime, bar: values };
  }
}

function transformOhlcvData(ohlcvRaw) {
  const priceData = [];
  const volumeData = [];
  const priceTs = []
  for (const { time, bar } of decodeSeries(ohlcvRaw)) {
    const [o, h, l, c, v] = bar; 
    priceData.push({ time, open: o, high: h, low: l, close: c });
    volumeData.push({ time, value: v });
    priceTs.push(time)
  }
  return [priceData, volumeData, priceTs]
}

function transformLqData(arr) {
  const result = [];
  for (const { time, bar } of decodeSeries(arr)) {
    const [longs, shorts] = bar; 
    result.push({ time, longs, shorts });
  }
  return result;
}

function transformOiData(oiRaw) {
  const result = [];
  for (const { time, bar } of decodeSeries(oiRaw)) {
    const [open, high, low, close] = bar;
    result.push({ time, open, high, low, close });
  }
  return result;
}

function sortSyncData(data) {
  return data.sort((a, b) => a.time - b.time)
}


export class MarketStatsApi {
  constructor() {
    this.baseUrl = MARKET_STATS_API_URL
  }

  async history(symbol, interval) {
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

  async get(path, params) {
    const url = `${this.baseUrl}/api/${path}`
    const response = await fetch(url, { params })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  async getOpenInterest(symbol, interval) {
    return this.get(`open-interest/${symbol}`, { interval })
  }

  async getOhlcv(symbol, interval) {
    return this.get(`ohlcv/${symbol}`, { interval })
  } 

  async getLiquidations(symbol, interval) {
    return this.get(`liquidations/${symbol}`, { interval })
  }
}

export const marketStats = new MarketStatsApi()
