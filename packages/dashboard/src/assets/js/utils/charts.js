/** globals LightweightCharts */

import {
  LineStyle,
  createChart,
  TickMarkType,
  CandlestickSeries, HistogramSeries, PriceScaleMode, CrosshairMode
} from 'lightweight-charts'

// Color constants
const COLOR_WHITE = '#fff'
const COLOR_DARK_TEXT = '#222'
const COLOR_PRIMARY = '#2563eb'
const COLOR_GRID_BORDER = '#e5e7eb'
export const COLOR_PRICE_LINE = '#26a69a'

// Puedes cambiar 'es' por navigator.language o el idioma que desees
const MONTHS = getMonthNames(navigator.language || 'es', 'short')

export const TIME_OPTIONS = {
  timeVisible: true,
  secondsVisible: false,
  rightOffset: 3, // margen derecho
  barSpacing: 10,  // separación entre velas
  fixLeftEdge: false,
  fixRightEdge: false,
  /*
  tickMarkFormatter: (time, tickMarkType) => {
    const d = new Date(time * 1000)
    switch (tickMarkType) {
      case TickMarkType.Year:
        return d.getUTCFullYear().toString()
      case TickMarkType.Month:
        return MONTHS[d.getUTCMonth()]
      case TickMarkType.Day:
        // Formato: 01 Ene o 1 Ene
        return `${d.getUTCDate().toString().padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`
      default:
        return ''
    }
  },
  */
  borderColor: COLOR_GRID_BORDER,
  visible: true
}

// Chart configuration constants
export const VALUE_OPTIONS = {
  autoSize: true,
  localization: {
    priceFormatter: formatAmount,
  },
  layout: {
    background: { color: COLOR_WHITE },
    textColor: COLOR_DARK_TEXT
  },
  grid: {
    vertLines: { visible: false },
    horzLines: { visible: false }
  },
  crosshair: {
    vertLine: {
      color: COLOR_PRIMARY,
      width: 1,
      style: LineStyle.Dashed,
      labelVisible: true
    },
    horzLine: {
      color: COLOR_PRIMARY,
      width: 1,
      style: LineStyle.Dashed,
      labelVisible: true
    }
  },
  rightPriceScale: {
    borderColor: COLOR_GRID_BORDER,
    mode: 0,
    ticksVisible: false,
    autoScale: true,
  },
  timeScale: { ...TIME_OPTIONS, visible: false }
}

export class TimeScaleSync {
  static register(...charts) {
    charts.forEach(src => {
      src.timeScale().subscribeVisibleLogicalRangeChange(range => {
        charts.forEach(ch => {
          if (ch !== src) {
            ch.timeScale().setVisibleLogicalRange(range)
          }
        })
      })
    })
  }
}

export class CrosshairSync {
  // Array interno donde guardamos los items registrados
  static items = []

  /**
     * Registra un chart y sus series para sincronizar el crosshair.
     *
     * @param {IChartApi} chart       Instancia de LightweightCharts.createChart(...)
     * @param {...ISeriesApi} series  Una o más series asociadas a ese chart
     */
  static register(chart, ...series) {
    // Creamos el handler y lo guardamos en el registro
    const handler = param => this._onCrosshairMove(chart, param);
    this.items.push({ chart, series, handler });
    chart.subscribeCrosshairMove(handler);
  }

  /**
     * Handler interno que se dispara en cada movimiento de crosshair.
     * @private
     * @param {IChartApi} sourceChart
     * @param {MouseEventParams} param
     */
  static _onCrosshairMove(sourceChart, param) {
    // 1) Obtenemos el registro del chart origen
    const source = this.items.find(item => item.chart === sourceChart)
    let dataPoint = null

    // 2) Si hay time, buscamos el primer punto válido en sus series
    if (param.time) {
      for (const s of source.series) {
        const dp = param.seriesData.get(s)
        if (dp) {
          dataPoint = dp
          break
        }
      }
    }

    // 3) Recorremos todos los charts registrados y aplicamos o limpiamos el crosshair
    this.items.forEach(({ chart, series }) => {
      if (dataPoint) {
        // Si tenemos dataPoint, lo ponemos sobre cada serie de cada chart
        series.forEach(s => {
          chart.setCrosshairPosition(dataPoint.value, dataPoint.time, s)
        })
      } else {
        // Si no hay dataPoint (salimos del área), limpiamos
        chart.clearCrosshairPosition()
      }
    })
  }

  /**
     * Elimina todas las suscripciones y limpia los registros
     */
  static reset() {
    this.items.forEach(({ chart, handler }) => {
      chart.unsubscribeCrosshairMove(handler);
    });
    this.items = [];
  }
}

/**
   * Crea/Re-renderiza un chart y sus series de forma genérica.
   * @param {Object} params
   * @param {string} params.containerId      ID del div donde va el chart
   * @param {IChartApi | undefined} params.prevChart  Instancia antigua (se removerá)
   * @param {number} params.height           Altura en píxeles del chart
   * @param {object} [params.chartOptions]   Opciones específicas que quieras mezclar con VALUE_OPTIONS
   * @param {Array<{
  *    type: SeriesConstructor,
  *    options: object,
  *    data: Array
  * }>} params.seriesList  Definición de cada serie a añadir
  * @returns {{ chart: IChartApi, series: ISeriesApi[] }}
  */
export function renderChart(containerId, {
  options = {},
  series = []
}) {
  // 2) obtener contenedor y validar
  const container = document.getElementById(containerId)
  if (!container) {
    console.warn(`Container #${containerId} no encontrado`)
    return {}
  }
  // 3) crear el chart
  const chart = createChart(container, {
    ...VALUE_OPTIONS,
    ...options,
    width: container.clientWidth,
    height: container.clientHeight
  })
  // 4) añadir series y 5) setData
  const seriesInstances = series.map(({ type, options, data }) => {
    const series = chart.addSeries(type, options)
    series.setData(data)
    return series
  })

  return { chart, series: seriesInstances }
}

/**
   * Clase estática para sincronizar el ancho del price-scale derecho
   * entre múltiples charts de lightweight-charts.
   */
export class PriceScaleSync {
  // Charts registrados para sync
  static _charts = []

  /**
     * Registra uno o más charts para que siempre tengan
     * el mismo ancho de price-scale derecho.
     *
     * @param  {...IChartApi} charts  Instancias de createChart(...)
     */
  static register(...charts) {
    // Sobrescribe la lista de charts a sincronizar
    PriceScaleSync._charts = charts
    // Suscribirse al cambio de tamaño de cada uno
    charts.forEach(chart => {
      chart.timeScale().subscribeSizeChange(() => PriceScaleSync._updateScales())
    })
    // Aplicar una vez al inicio
    PriceScaleSync._updateScales()
  }

  /**
     * Recalcula el máximo ancho de price-scale entre todos los charts
     * y lo fija como minimumWidth en cada uno.
     * @private
     */
  static _updateScales() {
    const charts = PriceScaleSync._charts
    if (charts.length === 0) return
    // 1) Medir cada width
    const widths = charts.map(ch => ch.priceScale('right').width())
    // 2) Calcular el máximo
    const maxWidth = Math.max(...widths)
    // 3) Fijar minimumWidth igual al máximo
    charts.forEach(ch => {
      ch.applyOptions({
        rightPriceScale: {
          minimumWidth: maxWidth
        }
      })
    })
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Devuelve los nombres de los meses localizados según el idioma y formato
function getMonthNames(locale = 'es', format = 'short') {
  const formatter = new Intl.DateTimeFormat(locale, { month: format })
  return Array.from({ length: 12 }, (_, i) =>
    capitalize(formatter.format(new Date(2000, i, 1))).replace('.', '')
  )
}

function formatAmount(val) {
  const n = Number(val)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Resets the time and price scales for any number of charts.
 *
 * @param  {...IChartApi} charts  Instances of LightweightCharts.createChart(...)
 */
export function resetCharts(...charts) {
  charts.forEach(chart => {
    // Reset the horizontal time scale
    chart.timeScale().resetTimeScale()
    // Re-enable auto-scaling on the right price scale
    chart.priceScale('right').applyOptions({ autoScale: true })
  })
}

export function fullscreenCharts() {
  const root = document.body
  if (!document.fullscreenElement) {
    root.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

/**
 * Captura uno o más charts (Canvas) en un solo PNG y dispara la descarga.
 *
 * @param {string[]} containerSelectors
 *   Array de selectores CSS de los contenedores donde están los <canvas> de los charts.
 * @param {Object} [options]
 * @param {string} [options.logoUrl]
 *   URL del logo SVG (o imagen) que se dibujará como marca de agua.
 * @param {number} [options.logoWidth=110]
 *   Ancho en px del logo.
 * @param {number} [options.logoHeight=32]
 *   Alto en px del logo.
 * @param {number} [options.logoMargin=16]
 *   Margen en px desde la esquina inferior derecha.
 * @param {string} [options.filename='charts-screenshot.png']
 *   Nombre del archivo PNG resultante.
 */
export async function screenshotCharts(
  containerSelectors,
  {
    logoUrl = '/pages/images/td-logo-black-pools.svg',
    logoWidth = 110,
    logoHeight = 32,
    logoMargin = 16,
    filename = 'charts-screenshot.png'
  } = {}
) {
  // 1) Recolectar todos los canvases de los charts
  const canvases = containerSelectors
    .map(sel => document.querySelector(`${sel} canvas`))
    .filter(c => c instanceof HTMLCanvasElement)
  if (canvases.length === 0) {
    alert('No charts to capture')
    return
  }

  // 2) Calcular dimensiones del combo canvas
  const width = Math.max(...canvases.map(c => c.width))
  const height = canvases.reduce((sum, c) => sum + c.height, 0)

  // 3) Crear canvas combinado y contexto
  const combo = document.createElement('canvas')
  combo.width = width
  combo.height = height
  const ctx = combo.getContext('2d')

  // 4) Dibujar cada canvas uno debajo de otro
  let offsetY = 0
  for (const c of canvases) {
    ctx.drawImage(c, 0, offsetY)
    offsetY += c.height
  }

  // 5) Función utilitaria para disparar la descarga
  function download(dataUrl) {
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }

  // 6) Si hay logo, cargarlo y dibujarlo como watermark
  if (logoUrl) {
    const logo = new Image()
    logo.crossOrigin = 'anonymous'
    logo.onload = () => {
      ctx.globalAlpha = 0.8
      ctx.drawImage(
        logo,
        width - logoWidth - logoMargin,
        height - logoHeight - logoMargin,
        logoWidth,
        logoHeight
      )
      ctx.globalAlpha = 1.0
      download(combo.toDataURL('image/png'))
    }
    logo.onerror = () => download(combo.toDataURL('image/png'))
    logo.src = logoUrl
  } else {
    // Sin logo, descarga directa
    download(combo.toDataURL('image/png'))
  }
}

export { CandlestickSeries, HistogramSeries, PriceScaleMode }
