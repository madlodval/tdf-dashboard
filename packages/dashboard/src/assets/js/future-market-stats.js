'use strict'

/** globals Alpine, LightweightCharts */

import {
  resetCharts,
  CrosshairSync,
  PriceScaleSync,
  TimeScaleSync,
  renderChart,
  VALUE_OPTIONS,
  CandlestickSeries,
  HistogramSeries,
  COLOR_PRICE_LINE,
  TIME_OPTIONS,
  fullscreenCharts,
  screenshotCharts,
  PriceScaleMode
} from './utils/charts.js'

import * as echarts from 'echarts'
import { marketStats } from './api/future-market-stats.js'

let priceChart,
  oiChart,
  volumeChart,
  priceSeries,
  oiSeries,
  volumeSeries,
  liquidationChart,
  longsSeries,
  shortsSeries
let symbol = 'BTC'
let interval = '1d'
const currency = 'BASE'

document.addEventListener('symbol-changed', e => {
  symbol = e.detail
  fetchAndDraw()
  fetchAndRenderOIBarChart(symbol, interval)
})


document.addEventListener('interval-changed', e => {
  interval = e.detail
  fetchAndDraw()
  fetchAndRenderOIBarChart(symbol, interval)
})

const resetBtn = document.getElementById('reset-charts-btn')
resetBtn.addEventListener('click', () => {
  resetCharts(priceChart, oiChart, volumeChart, liquidationChart)
})

document.getElementById('fullscreen-btn').addEventListener('click', fullscreenCharts)

document.getElementById('screenshot-btn').addEventListener('click', async () => {
  screenshotCharts(
    ['#price-chart', '#oi-chart', '#volume-chart', '#liquidation-chart'],
    {
      logoUrl: '/images/td-logo-black-pools.svg',
      filename: 'my-market-charts.png'
    }
  )
})

window.addEventListener('load', () => {
  fetchAndDraw()
  fetchAndRenderOIBarChart(symbol, interval)
})


async function fetchAndDraw () {
  Loader.show()
  try {
    const { oi, price, volume, liquidation } = await marketStats.history(symbol.toLowerCase(), interval)
    renderCharts(oi, price, volume, liquidation)
    Loader.hide(500)
  } catch (err) {
    console.error(err);
    [priceChart, oiChart, volumeChart, liquidationChart].forEach(ch => ch?.remove?.())
    Loader.hide(0, err)
  }
}


async function fetchAndRenderOIBarChart (symbol = 'BTC', interval = '1d') {
  return
  const container = document.getElementById('oi-bar-chart')
  if (!container) return
  container.innerHTML = ''

  try {
    const res = await fetch(`${MARKET_STATS_API_URL}/api/open-interest/latest-by-exchange/${symbol}?interval=${interval}`)
    if (!res.ok) throw new Error('Error al obtener datos de open interest por exchange')
    let { labels, values } = await res.json()
    // Ordenar de mayor a menor valor
    const items = labels.map((label, i) => ({ label, value: values[i] }))
    items.sort((a, b) => b.value - a.value)
    labels = items.map(i => i.label)
    values = items.map(i => i.value)

    if (container._echartsInstance) {
      container._echartsInstance.dispose()
      container._echartsInstance = null
    }

    const myChart = echarts.init(container)
    container._echartsInstance = myChart

    // Opciones de ECharts
    const option = {
      grid: {
        left: 120,
        right: 40,
        top: 20,
        bottom: 20
      },
      xAxis: {
        type: 'value',
        visible: false,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e0e0e0' } },
        axisLabel: {
          color: '#222',
          fontWeight: 'bold',
          fontSize: 13,
          formatter: formatBarValue
        }
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#222',
          fontWeight: 'bold',
          fontSize: 15,
          overflow: 'truncate'
        }
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 10,
        itemStyle: {
          color: '#bdbdbd'
        },
        label: {
          show: true,
          position: 'right',
          color: '#222',
          fontWeight: 'bold',
          fontSize: 14,
          formatter: ({ value }) => formatBarValue(value)
        }
      }],
      animation: false,
      tooltip: { show: false },
      toolbox: { show: false }
    }
    myChart.setOption(option)

    // Responsivo
    window.addEventListener('resize', () => {
      myChart.resize()
    })
  } catch (err) {
    console.error(err)
    container.innerHTML = '<span class="text-red-500">Error al cargar la gráfica de barras.</span>'
  }
}

function formatBarValue (value) {
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B'
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M'
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(2) + 'K'
  return value
}

/**
 * Convierte un valor de USD a la moneda base del activo usando el precio histórico.
 * @param {number} value Valor en USD
 * @param {number} price Precio del activo en USD en ese timestamp
 * @param {string} currency 'USD' o 'BASE'
 * @returns {number}
 */
function convertValue (value, price, currency) {
  if (currency === 'BASE' && price > 0) {
    return value / price
  }
  return value // USD por defecto
}

function renderCharts (oiData, priceData, volumeData, liquidations) {
  destroyCharts()

  // Sincronizar los datos de precio por timestamp para acceso rápido
  const priceByTime = Object.fromEntries(priceData.map(p => [p.time, p.close]))

  // Inicializa los datos convertidos como los originales
  let oiConverted = oiData
  let volumeConverted = volumeData
  let liquidationConverted = liquidations

  // Solo convierte si la moneda es BASE
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

  // Price
  ({ chart: priceChart, series: [priceSeries] } = renderChart('price-chart', {
    options: {
      rightPriceScale: {
        ...VALUE_OPTIONS.rightPriceScale,
        mode: PriceScaleMode.Logarithmic,
        scaleMargins: {
          top: 0.3,
          bottom: 0.25
        }
      },
      timeScale: { ...TIME_OPTIONS, visible: true }
    },
    series: [{
      type: CandlestickSeries,
      options: { priceLineVisible: false },
      data: priceData
    }]
  }));

  // OI
  ({ chart: oiChart, series: [oiSeries] } = renderChart('oi-chart', {
    options: { timeScale: { visible: false } },
    series: [{
      type: CandlestickSeries,
      options: { priceLineVisible: false },
      data: oiConverted
    }]
  }));

  // Volume
  ({ chart: volumeChart, series: [volumeSeries] } = renderChart('volume-chart', {
    height: 200,
    series: [{
      type: HistogramSeries,
      options: {
        color: COLOR_PRICE_LINE,
        priceFormat: { type: 'volume' },
        base: 0,
        priceScaleId: 'right',
        priceLineVisible: false
      },
      data: volumeConverted
    }]
  }));

  // Liquidations (dos series)
  ({
    chart: liquidationChart,
    series: [longsSeries, shortsSeries]
  } = renderChart('liquidation-chart', {
    options: { timeScale: TIME_OPTIONS },
    series: [
      {
        type: HistogramSeries,
        options: {
          color: COLOR_PRICE_LINE,
          priceFormat: { type: 'volume' },
          base: 0,
          priceScaleId: 'right',
          priceLineVisible: false
        },
        data: liquidationConverted
          .slice().sort((a, b) => a.time - b.time)
          .map(d => ({ time: d.time, value: d.longs }))
      },
      {
        type: HistogramSeries,
        options: {
          color: '#ff4136',
          priceFormat: { type: 'volume' },
          base: 0,
          priceScaleId: 'right',
          priceLineVisible: false
        },
        data: liquidationConverted
          .slice().sort((a, b) => a.time - b.time)
          .map(d => ({ time: d.time, value: -Math.abs(d.shorts) }))
      }
    ]
  }))

  TimeScaleSync.register(priceChart, oiChart, volumeChart, liquidationChart)
  CrosshairSync.register(priceChart, priceSeries)
  CrosshairSync.register(oiChart, oiSeries)
  CrosshairSync.register(volumeChart, volumeSeries)
  CrosshairSync.register(liquidationChart, longsSeries, shortsSeries)
  PriceScaleSync.register(priceChart, oiChart, volumeChart, liquidationChart)
}

/**
 * Módulo singleton para controlar el overlay de carga y errores.
 */
const Loader = (() => {
  // Cacheamos los elementos del DOM
  const overlay = document.getElementById('loading-overlay')
  const spinner = document.getElementById('loading-spinner')
  const errElement = document.getElementById('loading-error')

  /**
   * Muestra el overlay con el spinner y oculta cualquier error previo.
   */
  function show () {
    overlay.classList.remove('opacity-0', 'pointer-events-none')
    overlay.classList.add('opacity-100', 'pointer-events-auto')
    spinner.classList.remove('hidden')
    errElement.classList.add('hidden')
  }

  /**
   * Oculta el overlay (y el spinner) tras un retraso opcional.
   * @param {number} [delayMs=0] Milisegundos antes de ocultar.
   */
  function hide (delayMs = 0, errMs = null) {
    setTimeout(() => {
      overlay.classList.remove('opacity-100', 'pointer-events-auto')
      overlay.classList.add('opacity-0', 'pointer-events-none')
      spinner.classList.add('hidden')
    }, delayMs)

    if (errMs !== null) {
      error(errMs)
    }
  }

  /**
   * Muestra un mensaje de error en el overlay.
   * @param {string} message Texto de error a mostrar.
   */
  function error (message) {
    errElement.textContent = message
    errElement.classList.remove('hidden')
  }

  return { show, hide, error }
})()

function destroyCharts () {
  CrosshairSync.reset();
  [priceChart, oiChart, volumeChart, liquidationChart].forEach((ch) => {
    ch?.remove()
  })
  priceChart = oiChart = volumeChart = liquidationChart = null
}
