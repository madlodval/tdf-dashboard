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

import * as echarts from 'echarts';

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

document.addEventListener('symbol-changed', e => {
  symbol = e.detail
  fetchAndDraw()
  fetchAndRenderOIBarChart(symbol, interval)
})

document.addEventListener('alpine:init', () => {
  Alpine.data('intervalDropdown', () => ({
    open: false,
    intervals: ['1d', '4h', '1h'],
    selected: '1d'
  }))
})
document.addEventListener('interval-changed', e => {
  interval = e.detail
  fetchAndDraw()
  fetchAndRenderOIBarChart(symbol, interval)
})

// Botón reset: resetea ambos gráficos a su estado original
const resetBtn = document.getElementById('reset-charts-btn')
resetBtn.addEventListener('click', () => {
  resetCharts(priceChart, oiChart, volumeChart, liquidationChart)
})

// Fullscreen handler
document.getElementById('fullscreen-btn').addEventListener('click', fullscreenCharts)

// Screenshot handler
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

/**
 * Obtiene y sincroniza todos los datos necesarios para los charts.
 *
 * @param {string} symbol
 * @param {string} interval
 * @returns {Promise<{
*   oi: Array,
*   price: Array,
*   volume: Array,
*   liquidation: Array
* }>}
*/
async function loadChartData(symbol, interval) {
  const apiBase = 'http://localhost:3001';
  // 1) Llamadas paralelas
  const [oiRes, ohlcvRes, liqRes] = await Promise.all([
    fetch(`${apiBase}/api/open-interest/${symbol}?interval=${interval}`),
    fetch(`${apiBase}/api/ohlcv/${symbol}?interval=${interval}`),
    fetch(`${apiBase}/api/liquidations/${symbol}?interval=${interval}`)
  ])
  if (!oiRes.ok || !ohlcvRes.ok || !liqRes.ok) {
    throw new Error('Error fetching data')
  }

  // 2) Parseo JSON
  const [oiRaw, ohlcvRaw, liqRaw] = await Promise.all([
    oiRes.json(),
    ohlcvRes.json(),
    liqRes.json()
  ])

  // 3) Decodificaciones
  const liquidations = decodeLiquidationsCompressed(liqRaw)

  // 4) Construcción de priceData & volumeData
  const priceData = []
  const volumeData = []
  if (ohlcvRaw.length > 1) {
    let t = ohlcvRaw[0]
    ohlcvRaw.slice(1).forEach(bar => {
      t += bar[0]
      priceData.push({ time: t, open: bar[1], high: bar[2], low: bar[3], close: bar[4] })
      volumeData.push({ time: t, value: bar[5] })
    })
  }

  // 5) Construcción de oiDataSynced
  let oiDataSynced = []
  if (oiRaw.length > 1) {
    const base = oiRaw[0]
    let t = base
    oiDataSynced = oiRaw.slice(1).map(bar => {
      t += bar[0]
      return { time: t, open: bar[1], high: bar[2], low: bar[3], close: bar[4] }
    })
    // Imprimir los primeros y últimos 5 timestamps para depuración
    if (oiDataSynced.length > 0) {
      console.log('Primeros 5 timestamps OI:')
      oiDataSynced.slice(0, 5).forEach(d => console.log(d.time, new Date(d.time * 1000).toISOString()))
      console.log('Últimos 5 timestamps OI:')
      oiDataSynced.slice(-5).forEach(d => console.log(d.time, new Date(d.time * 1000).toISOString()))
    }
  }

  // 6) Intersección de timestamps
  const priceTs = new Set(priceData.map(b => b.time))
  const oiTs = new Set(oiDataSynced.map(b => b.time))
  const common = [...priceTs].filter(ts => oiTs.has(ts))

  const priceSynced = priceData.filter(b => common.includes(b.time)).sort((a, b) => a.time - b.time)
  const volumeSynced = volumeData.filter(b => common.includes(b.time)).sort((a, b) => a.time - b.time)

  // 7) Liquidations sync
  let liqSynced = []
  if (common.length > 0) {
    liqSynced = common.map(ts => {
      const found = liquidations.find(d => d.time === ts)
      return found || { time: ts, longs: 0, shorts: 0 }
    })
  } else {
    liqSynced = priceSynced.map(b => ({ time: b.time, longs: 0, shorts: 0 }))
  }

  return {
    oi: oiDataSynced,
    price: priceSynced,
    volume: volumeSynced,
    liquidation: liqSynced
  }
}

// ------------ fetchAndDraw simplificado ------------

async function fetchAndDraw() {
  Loader.show()
  try {
    const { oi, price, volume, liquidation } = await loadChartData(symbol, interval)
    renderCharts(oi, price, volume, liquidation)
    Loader.hide(500)
  } catch (err) {
    console.error(err);
    // limpia charts existentes...
    [priceChart, oiChart, volumeChart, liquidationChart].forEach(ch => ch?.remove?.())
    Loader.hide(0, err)
  }
}

function decodeLiquidationsCompressed(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return []
  const base = arr[0]
  let t = base
  const result = []
  for (let i = 1; i < arr.length; ++i) {
    const [offset, longs, shorts] = arr[i]
    t += offset
    result.push({ time: t, longs, shorts })
  }
  return result
}

async function fetchAndRenderOIBarChart(symbol = 'BTC', interval = '1d') {
  const container = document.getElementById('oi-bar-chart');
  if (!container) return;
  container.innerHTML = '';

  try {
    const apiBase = 'http://localhost:3001';
    const res = await fetch(`${apiBase}/api/open-interest/latest-by-exchange/${symbol}?interval=${interval}`);
    if (!res.ok) throw new Error('Error al obtener datos de open interest por exchange');
    let { labels, values } = await res.json();
    // Ordenar de mayor a menor valor
    const items = labels.map((label, i) => ({ label, value: values[i] }));
    items.sort((a, b) => b.value - a.value);
    labels = items.map(i => i.label);
    values = items.map(i => i.value);

    if (container._echartsInstance) {
      container._echartsInstance.dispose();
      container._echartsInstance = null;
    }

    const myChart = echarts.init(container);
    container._echartsInstance = myChart;

    // Opciones de ECharts
    const option = {
      grid: {
        left: 120,
        right: 40,
        top: 20,
        bottom: 20,
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
          formatter: formatBarValue,
        },
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
          overflow: 'truncate',
        },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 10,
        itemStyle: {
          color: '#bdbdbd',
        },
        label: {
          show: true,
          position: 'right',
          color: '#222',
          fontWeight: 'bold',
          fontSize: 14,
          formatter: ({ value }) => formatBarValue(value),
        }
      }],
      animation: false,
      tooltip: { show: false },
      toolbox: { show: false },
    };
    myChart.setOption(option);

    // Responsivo
    window.addEventListener('resize', () => {
      myChart.resize();
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<span class="text-red-500">Error al cargar la gráfica de barras.</span>';
  }
}

function formatBarValue(value) {
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B'
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M'
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(2) + 'K'
  return value
}

function renderCharts(oiData, priceData, volumeData, liquidations) {
  destroyCharts();

  // Price
  ({ chart: priceChart, series: [priceSeries] } = renderChart('price-chart', {
    options: {
      rightPriceScale: {
        ...VALUE_OPTIONS.rightPriceScale,
        // autoScale: true,
        mode: PriceScaleMode.Logarithmic,
        scaleMargins: {
          top: 0.3,   // 30% de espacio arriba
          bottom: 0.25, // 25% de espacio abajo
        },
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
      data: oiData
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
      data: volumeData
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
        data: liquidations
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
        data: liquidations
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
  function show() {
    overlay.classList.remove('opacity-0', 'pointer-events-none')
    overlay.classList.add('opacity-100', 'pointer-events-auto')
    spinner.classList.remove('hidden')
    errElement.classList.add('hidden')
  }

  /**
   * Oculta el overlay (y el spinner) tras un retraso opcional.
   * @param {number} [delayMs=0] Milisegundos antes de ocultar.
   */
  function hide(delayMs = 0, errMs = null) {
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
  function error(message) {
    errElement.textContent = message
    errElement.classList.remove('hidden')
  }

  return { show, hide, error }
})()

function destroyCharts() {
  CrosshairSync.reset();
  [priceChart, oiChart, volumeChart, liquidationChart].forEach((ch) => {
    ch?.remove();
  });
  priceChart = oiChart = volumeChart = liquidationChart = null;
}
