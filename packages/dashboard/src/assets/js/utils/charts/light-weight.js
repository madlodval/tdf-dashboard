/* global ResizeObserver */
import {
    createChart,
    TickMarkType,
    createImageWatermark,
  } from 'lightweight-charts'

import { AnchoredText } from '@tdf/lwc-plugin-anchored-text';
 
const MONTHS = getMonthNames(document.documentElement.lang || 'es', 'short')
  
export class LightChart {
  constructor (containerId, config) {
    this.containerId = containerId
    this.config = this._normalizeConfig(config)
    this.container = document.getElementById(containerId)
    this.chart = null
    this.seriesInstances = []
    this.ohclElements = {}
    this.labels = {}
    this.latestTime = 0
    this.interval = '1d'
    this.crosshairHandler = null
    this.resizeObservers = []
  }

  _normalizeConfig (config) {
    const { options = {}, series = [], watermark } = config
    this.watermark = watermark
    return {
      options,
      series: Array.isArray(series) ? series : [series]
    }
  }

  render (interval, ...data) {
    if (!this.container) {
      return {}
    }
    this.interval = interval
    this._createChart()
    this._addSeries(data)
    this._setupPanes()
    this._setupWatermark()
    this._subscribeEvents()
    this._showLastValues()
    this._setupTimeScale()

    return this.seriesInstances
  }

  _createChart () {
    if (this.chart !== null) {
      this.destroy()
    }
    this.chart = createChart(this.container, {
      ...this.config.options,
      width: this.container.clientWidth,
      height: this.container.clientHeight
    })
  }

  _addSeries (seriesData = undefined) {
    this.seriesInstances = this.config.series.map(({ type, options, data, pane = {} }, index) => {
      if (data === undefined && Array.isArray(seriesData)) {
        data = seriesData[index]
      }
      const series = this.chart.addSeries(type, {
        lastValueVisible: true,
        priceLineVisible: false,
        ...options
      }, pane.index)

      series.setData(data)
      this.latestTime = Math.max(this.latestTime, data.at(-1).time)
      return series
    })
  }

  _showLastValues () {
    const seriesData = new Map()

    this.seriesInstances.forEach(series => {
      const data = series.data()
      if (data.length > 0) {
        seriesData.set(series, data.at(-1))
      }
    })

    if (seriesData.size > 0) {
      const param = {
        point: { x: 0, y: 0 },
        time: this.latestTime,
        seriesData
      }
      this._updateCrosshairValues(param)
    }
  }

  _setupPanes () {
    const mainTop = this.container.getBoundingClientRect().top
    const panes = this.chart.panes()

    this.labels = Array.from(this.container.querySelectorAll('div[data-pane-index]')).reduce((acc, el) => {
      const paneIndex = el.getAttribute('data-pane-index')

      this.ohclElements[paneIndex] = Array.from(el.querySelectorAll('span[data-value]')).reduce((acc, el) => {
        const key = el.getAttribute('data-value')
        el.dataset.title = el.textContent.trim()
        acc[key] = el
        return acc
      }, {})

      acc[paneIndex] = el
      return acc
    }, {})

    const labelEntries = []

    this.config.series.toReversed().forEach(({ pane }) => {
      const { index: paneIndex, height } = pane || {}

      if (height && paneIndex !== undefined) {
        const targetPane = panes[paneIndex]
        targetPane.setHeight(height)
        labelEntries.push({
          pane: targetPane,
          label: this.labels[paneIndex]
        })
      }
    })

    if (labelEntries.length > 0) {
      this._setupLabels(mainTop, labelEntries)
    }
  }

  _handleResize () {
    this._repositionLabels()
  }

  _setupWatermark () {
    if (this.watermark) {
      const { paneIndex, url, ...opts } = this.watermark
      const pane = this.chart.panes()[paneIndex || 0]
      createImageWatermark(pane, url, opts)
    }
  }

  _setupLabels (mainTop, labels) {
    if (labels.length === 0) {
      return
    }

    const entry = labels.pop()

    const sync = (entry) => {
      try {
        const { pane, label } = entry
        const htmlElement = pane.getHTMLElement()

        if (!htmlElement || !htmlElement.cells || htmlElement.cells.length < 2) {
          setTimeout(() => sync(entry), 50)
          return
        }
        /*
        const _label = new AnchoredText({
          text: 'HOLA',
          horzAlign: 'left',
          vertAlign: 'top',
          lineHeight: 16,
          font: '16px "Inter Variable", sans-serif',
          color: 'red',
        })
        pane.attachPrimitive(_label)
        */
        const observer = new ResizeObserver(this._handleResize.bind(this))
        this.resizeObservers.push(observer)
        observer.observe(htmlElement)
        const [, elLeft] = htmlElement.cells
        label.removeAttribute('hidden')
        const paneTop = elLeft.getBoundingClientRect().top
        label.style.top = `${paneTop - mainTop}px`
        this._setupLabels(mainTop, labels)
      } catch (e) {
        setTimeout(() => sync(entry), 50)
      }
    }

    sync(entry)
  }

  _subscribeEvents () {
    this.crosshairHandler = this._handleCrosshairMove.bind(this)
    this.chart.subscribeCrosshairMove(this.crosshairHandler)
  }

  _handleCrosshairMove (param) {
    if (!param.point) {
      return this._showLastValues()
    }

    if (param.time) {
      this._updateCrosshairValues(param)
    }
  }

  _updateCrosshairValues (param) {
    const valuesByPane = this._collectSeriesData(param)

    Object.entries(valuesByPane).forEach(([paneIndex, values]) => {
      Object.values(this.ohclElements[paneIndex]).forEach((el, index) => {
        el.textContent = `${el.dataset.title} ${values[index]}`.trim()
        el.style.opacity = '1'
      })
    })
  }

  _collectSeriesData (param) {
    const valuesByPane = {}

    param.seriesData.forEach((data, series) => {
      const pane = series.getPane()
      const paneIndex = pane.paneIndex()

      if (!valuesByPane[paneIndex]) {
        valuesByPane[paneIndex] = []
      }

      if (Object.hasOwn(data, 'value')) {
        valuesByPane[paneIndex].push(formatAmount(data.value))
      } else if (Object.hasOwn(data, 'close')) {
        valuesByPane[paneIndex].push(
          formatAmount(data.open),
          formatAmount(data.high),
          formatAmount(data.low),
          formatAmount(data.close)
        )
      }
    })

    return valuesByPane
  }

  _setupTimeScale () {
    if (this.interval) {
      const from = getIntervalRange(this.interval)
      const logicalRange = this.chart.timeScale().getVisibleLogicalRange()
      if (logicalRange !== null) {
        const newLogicalRange = {
          from: logicalRange.from - from,
          to: logicalRange.to
        }
        this.chart.timeScale().setVisibleLogicalRange(newLogicalRange)
      }
    } else {
      this.chart.timeScale().fitContent()
    }
  }

  reset () {
    this._setupTimeScale()
    for (const pane of this.chart.panes()) {
      pane.priceScale('right').applyOptions({ autoScale: true })
    }
  }

  async takeScreenshot(includeOHLC = true, options = {}) {
    if (!includeOHLC) {
      return this.chart.takeScreenshot();
    }
    
    return this.takeScreenshotWithOHLC(options);
  }


  async takeScreenshotWithOHLC(options = {}) {
      const chartCanvas = this.chart.takeScreenshot();
      
      const finalCanvas = document.createElement('canvas');
      const ctx = finalCanvas.getContext('2d');
      
      // Obtener la estructura de labels con sus posiciones reales
      const labelStructure = this._getLabelsWithPositions(options);
      
      finalCanvas.width = chartCanvas.width;
      finalCanvas.height = chartCanvas.height;     
      // Fondo
      ctx.fillStyle = options.backgroundColor || 'transparent';
      ctx.drawImage(chartCanvas, 0, 0);
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      
      // Dibujar los labels usando las posiciones calculadas
      this._drawLabelsAtCorrectPositions(ctx, labelStructure, options);
      
      // Dibujar el chart desplazado hacia abajo
      
      return finalCanvas;
  }
  
  _getLabelsWithPositions(options = {}) {
    const structure = [];
    const containerRect = this.container.getBoundingClientRect();
    console.log(this.container);
    const offsetLeft = options.offsetLeft || 5;
    const offsetTop = options.offsetTop || 5;
    // Recorrer los labels en el mismo orden que _setupPanes
    Object.entries(this.labels).forEach(([paneIndex, labelElement]) => {
      if (!labelElement || labelElement.hasAttribute('hidden')) return;
      
      const labelRect = labelElement.getBoundingClientRect();
      
      // Obtener los elementos OHLC de este pane
      const ohlcElements = this.ohclElements[paneIndex] || {};
      const values = [];
      Object.values(ohlcElements).forEach(element => {
        if (element && element.textContent && element.style.opacity !== '0') {
          const ohlcRect = element.getBoundingClientRect();
          const font = this._getElementFont(element, options.font);
          const text = element.textContent.trim();
          const lineHeight = this._getLineHeight(element);
          values.push({
            text,
            font,
            color: this._getElementColor(element, options.color),
            left: ohlcRect.left - containerRect.left + offsetLeft,
            top: (ohlcRect.top - containerRect.top) + 
              (lineHeight - this._getTextHeight(text, font)) / 2,
          });
        }
      });
      
      if (values.length > 0) {
        const text = labelElement.firstChild.textContent.trim();
        const font = this._getElementFont(labelElement, options.font);
        const lineHeight = this._getLineHeight(labelElement);
        structure.push({
          paneIndex: parseInt(paneIndex),
          text,
          font,
          color: this._getElementColor(labelElement, options.color),
          top: (labelRect.top - containerRect.top) + offsetTop + (
            lineHeight - this._getTextHeight(text, font)
          ) / 2,
          left: labelRect.left - containerRect.left + offsetLeft,
          values: values
        });
      }
    });
    
    // Ordenar por posición vertical (igual que en tu código original)
    return structure.sort((a, b) => a.top - b.top);
  }
  
  _drawLabelsAtCorrectPositions(ctx, labelStructure) {   
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    labelStructure.forEach(({ top, left, color, font, text, values }) => {
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.fillText(text, left, top);

      values.forEach(({ color, font, text, left, top}) => {
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.fillText(text, left, top);
      });
    });
  }

  _getTextHeight(text, font) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    
    const metrics = ctx.measureText(text);
    
    // Usar las nuevas propiedades si están disponibles
    if (metrics.fontBoundingBoxAscent !== undefined && metrics.fontBoundingBoxDescent !== undefined) {
      const height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      return height;
    }
    
    // Fallback: extraer el tamaño de la fuente del string font
    const fontSize = parseInt(font.match(/\d+/)?.[0] || '16');
    return fontSize;
  }

  _getElementColor(element) {
    try {
      const computedStyle = window.getComputedStyle(element);
      return computedStyle.color || '#333333';
    } catch (error) {
      return '#333333';
    }
  }

  _getLineHeight(element) {
    const computedStyle = window.getComputedStyle(element);
    let lineHeight = computedStyle.lineHeight;
    
    if (lineHeight.includes('px')) {
      return parseFloat(lineHeight);
    }
    
    const fontSize = parseFloat(computedStyle.fontSize);
    
    if (lineHeight === 'normal' || !isNaN(parseFloat(lineHeight))) {
      const multiplier = lineHeight === 'normal' ? 1.5 : parseFloat(lineHeight);
      return fontSize * multiplier;
    }
    
    // Fallback: valor por defecto de Tailwind
    return fontSize * 1.5;
  }

  _getElementFont(element) {
    try {
      const computedStyle = window.getComputedStyle(element);
      console.log('FONT: ' + computedStyle.font);
      return computedStyle.font || '11px Inter Variable, sans-serif';
    } catch (error) {
      console.log('ERROR: ' + error);
      return '11px Inter Variable, sans-serif';
    }
  }
   
  destroy () {
    if (this.chart) {
      this._unsubscribeEvents()
      this.chart.remove()
      this.chart = null
    }

    Object.values(this.ohclElements).forEach(els => {
      Object.values(els).forEach(el => {
        if (el && el.style) {
          el.style.opacity = '0'
          el.textContent = el.dataset.title || ''
        }
      })
    })

    Object.values(this.labels).forEach(label => {
      if (label) {
        label.setAttribute('hidden', true)
      }
    })

    this.seriesInstances = []
    this.ohclElements = {}
    this.labels = {}
    this.latestTime = 0
    this.crosshairHandler = null
  }

  _unsubscribeEvents () {
    if (this.chart && this.crosshairHandler) {
      for (const observer of this.resizeObservers) {
        observer.disconnect()
      }
      this.chart.unsubscribeCrosshairMove(this.crosshairHandler)
      this.crosshairHandler = null
    }
  }

  resize () {
    if (this.chart && this.container) {
      this.chart.resize(
        this.container.clientWidth,
        this.container.clientHeight
      )
    }
  }

  _repositionLabels () {
    if (!this.container || !this.chart) return

    const mainTop = this.container.getBoundingClientRect().top
    const panes = this.chart.panes()

    Object.entries(this.labels).forEach(([paneIndex, label]) => {
      const targetPane = panes[parseInt(paneIndex, 10)]
      if (!targetPane) return

      const htmlElement = targetPane.getHTMLElement()
      if (!htmlElement || !htmlElement.cells || htmlElement.cells.length < 2) return

      const [, elLeft] = htmlElement.cells
      const paneTop = elLeft.getBoundingClientRect().top
      label.style.top = `${paneTop - mainTop}px`
    })
  }

  // Métodos públicos para herramientas externas
  getChart() {
    return this.chart
  }

  getSeriesInstances() {
    return this.seriesInstances
  }

  getContainer() {
    return this.container
  }
}

// Funciones de utilidad permanecen igual...
export function formatAmount (val) {
  const n = Number(val)
  if (isNaN(n)) {
    return val
  }

  const absN = Math.abs(n)
  let result = ''

  if (n < 0) {
    result += '-'
  }

  if (absN >= 1e9) {
    result += '$' + (absN / 1e9).toFixed(2) + 'B'
  } else if (absN >= 1e6) {
    result += '$' + (absN / 1e6).toFixed(2) + 'M'
  } else if (absN >= 1e3) {
    result += '$' + (absN / 1e3).toFixed(2) + 'K'
  } else {
    result = n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    })

    if (result.startsWith('-')) {
      result = '-' + '$' + result.substring(1)
    } else {
      result = '$' + result
    }
  }

  return result
}

export function tickMarkFormatter (time, tickMarkType) {
  const d = new Date(time * 1000)
  switch (tickMarkType) {
    case TickMarkType.Year:
      return d.getUTCFullYear().toString()
    case TickMarkType.Month:
      return MONTHS[d.getUTCMonth()]
    case TickMarkType.DayOfMonth:
      return `${d.getUTCDate().toString()}`
    default:
      return ''
  }
}

function getIntervalRange (interval) {
  switch (interval) {
    case '1h':
      return 15
    case '4h':
      return 90
    case '1d':
      return 180
  }
  return 0
}

function getMonthNames (locale = 'es', format = 'short') {
  const formatter = new Intl.DateTimeFormat(locale, { month: format })
  return Array.from({ length: 12 }, (_, i) =>
    capitalize(formatter.format(new Date(2000, i, 1))).replace('.', '')
  )
}

function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}