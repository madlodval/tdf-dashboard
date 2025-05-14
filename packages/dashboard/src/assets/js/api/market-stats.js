import { MARKET_STATS_API_URL } from "astro:env/client";

export class MarketStatsApi {
  constructor() {
    this.baseUrl = MARKET_STATS_API_URL
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

export const marketStatsApi = new MarketStatsApi()