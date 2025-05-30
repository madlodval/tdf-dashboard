/* global ResizeObserver */
import {
  createChart,
  TickMarkType,
  createImageWatermark,
  LineStyle,
} from 'lightweight-charts'

import { screenshotCharts } from './charts/tools/screenshot'
import { fullscreenCharts } from './charts/tools/fullscreen'
import { VLine } from '@tdf/lwc-plugin-vline'

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
    this.toolHandlers = {}
    this.resizeObservers = []
    this.lineTool = null
    this.hLinesInstances = []
    this.vLinesInstances = []
    this.configTools = {
      hLines: false,
      vLines: false
    }     
  }

  _handleClick(param) {
    if (param.point === null) {
      return
    }
    if (this.configTools.hLines) {
      const curPane = param.paneIndex;
      const applyToSeries = new Map();
      let isSet = false;
      param.seriesData.forEach((data, series) => {
        const paneIndex = series.getPane().paneIndex();
        let price = data.value || data.close;
        if (paneIndex===curPane && !isSet) {
          const pointPrice = series.coordinateToPrice(param.point.y);
          if (Object.hasOwn(data, 'high') && Object.hasOwn(data, 'low')) {
            const { high, low } = data;
            if (pointPrice>=low && pointPrice<=high) {
              price = pointPrice;
              isSet = true;
            }
          } else if (pointPrice>=0 && price >= 0) {
            isSet = true;
            price = pointPrice;
          } else if (pointPrice<=0 && price <= 0) {
            isSet = true;
            price = pointPrice;
          }
        }
        applyToSeries.set(series, price);
      })
      applyToSeries.forEach((price, series) => {
        this.hLinesInstances.push(series.createPriceLine({
          price,
          color: this.lineStyle.color,
          lineStyle: this.lineStyle.style,
          lineWidth: this.lineStyle.width,
        }))
      })
    }
    if (this.configTools.vLines) {
      const time = param.time;
      for (const [series, ] of param.seriesData) {
        const line = new VLine(time, {
          color: this.lineStyle.color,
          lineStyle: this.lineStyle.style,
          lineWidth: this.lineStyle.width,
        })
        this.vLinesInstances.push(line)
        series.attachPrimitive(line)
      }
    }
  }

  _normalizeConfig (config) {
    const { options = {}, series = [], watermark, lineStyle = {} } = config
    this.watermark = watermark
    this.lineStyle = lineStyle
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
    this.clickHandler = this._handleClick.bind(this)
    this.chart.subscribeCrosshairMove(this.crosshairHandler)
    this.chart.subscribeClick(this.clickHandler);
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

  destroy () {
    if (this.chart) {
      this._cleanupToolHandlers()
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
    this.subscribeClickHandler = null
  }

  _unsubscribeEvents () {
    if (this.chart && this.crosshairHandler) {
      for (const observer of this.resizeObservers) {
        observer.disconnect()
      }
      this.chart.unsubscribeCrosshairMove(this.crosshairHandler)
      this.chart.unsubscribeClick(this.clickHandler)
      this.crosshairHandler = null
      this.clickHandler = null
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

  fullscreen () {
    this.container.classList.add('full-screen')
    fullscreenCharts(() => {
      this.container.classList.remove('full-screen')
      setTimeout(() => {
        this._repositionLabels()
      }, 100)
    })

    setTimeout(() => {
      this._repositionLabels()
    }, 100)
  }

  screenshot (opts) {
    screenshotCharts([`#${this.containerId}`], opts)
  }

  _repositionLabels () {
    if (!this.container || !this.chart) return

    const mainTop = this.container.getBoundingClientRect().top
    const panes = this.chart.panes()

    Object.entries(this.labels).forEach(([paneIndex, label]) => {
      try {
        const targetPane = panes[parseInt(paneIndex, 10)]
        if (!targetPane) return

        const htmlElement = targetPane.getHTMLElement()
        if (!htmlElement || !htmlElement.cells || htmlElement.cells.length < 2) return

        const [, elLeft] = htmlElement.cells
        const paneTop = elLeft.getBoundingClientRect().top
        label.style.top = `${paneTop - mainTop}px`
      } catch (err) {
        console.warn(`Error repositioning label for pane ${paneIndex}:`, err)
      }
    })
  }

  lines () {
    for (const series of this.seriesInstances) {
      this.hLinesInstances.push(UserPriceLines.create(this.chart, series, {
        color: '#000000'
      }))
    }
  }

  tools (toolsConfig = {}) {
    // Configuración por defecto
    const defaults = {
      hLineButtonId: 'h-line-btn',
      vLineButtonId: 'v-line-btn',
      resetButtonId: 'reset-charts-btn',
      fullscreenButtonId: 'fullscreen-btn',
      screenshotButtonId: 'screenshot-btn',
      screenshotFilename: 'chart',
      lineColor: '#000000',
      lineWidth: 1,
      lineStyle: LineStyle.Solid
    }

    const {
      lineColor,
      lineWidth,
      lineStyle
    } = toolsConfig

    // Guardar configuración
    this.toolHandlers = { ...defaults, ...toolsConfig }
    const {
      hLineButtonId,
      vLineButtonId,
      resetButtonId,
      fullscreenButtonId,
      screenshotButtonId,
      screenshotFilename
    } = this.toolHandlers

    // Inicializar instancias de herramientas de líneas
    this.horizontalLineTool = null
    this.verticalLineTool = null

    // Limpiar manejadores existentes
    this._cleanupToolHandlers()

    // Usar setTimeout para asegurar que el DOM esté listo
    setTimeout(() => {
      // Botón de línea horizontal
      const hLineButton = document.getElementById(hLineButtonId)
      if (hLineButton && this.chart && this.seriesInstances.length > 0) {
        const hLineHandler = (e) => {
          const target = e.currentTarget
          const isActive = target.dataset.active === 'true'
          
          if (isActive) {
            this.configTools.hLines = false
            target.dataset.active = 'false'
            return
          }
          this.configTools.hLines = true
          target.dataset.active = 'true'
        }
        
        hLineHandler.buttonId = hLineButtonId
        this.toolHandlers.hLines = hLineHandler
        hLineButton.addEventListener('click', hLineHandler)
      }

      // Botón de línea vertical
      const vLineButton = document.getElementById(vLineButtonId)
      if (vLineButton && this.chart) {
        const vLineHandler = (e) => {
          const target = e.currentTarget
          const isActive = target.dataset.active === 'true'
          
          if (isActive) {
            this.configTools.vLines = false
            target.dataset.active = 'false'
            return
          } 
          this.configTools.vLines = true
          target.dataset.active = 'true'
        }
        
        vLineHandler.buttonId = vLineButtonId
        this.toolHandlers.vLines = vLineHandler
        vLineButton.addEventListener('click', vLineHandler)
      }

      // Botón de reinicio
      const resetBtn = document.getElementById(resetButtonId)
      if (resetBtn) {
        const resetHandler = () => this.reset()
        resetHandler.buttonId = resetButtonId
        this.toolHandlers.reset = resetHandler
        resetBtn.addEventListener('click', resetHandler)
      }

      // Botón de pantalla completa
      const fullscreenBtn = document.getElementById(fullscreenButtonId)
      if (fullscreenBtn) {
        const fullscreenHandler = () => this.fullscreen()
        fullscreenHandler.buttonId = fullscreenButtonId
        this.toolHandlers.fullscreen = fullscreenHandler
        fullscreenBtn.addEventListener('click', fullscreenHandler)
      }

      // Botón de captura de pantalla
      const screenshotBtn = document.getElementById(screenshotButtonId)
      if (screenshotBtn) {
        const screenshotHandler = () => {
          this.screenshot({ filename: screenshotFilename })
        }
        screenshotHandler.buttonId = screenshotButtonId
        this.toolHandlers.screenshot = screenshotHandler
        screenshotBtn.addEventListener('click', screenshotHandler)
      }
    }, 0)
    return this
  }

  _cleanupToolHandlers () {
    const toolTypes = ['reset', 'fullscreen', 'screenshot', 'hLines', 'vLines']
    toolTypes.forEach(toolType => {
      const handler = this.toolHandlers[toolType]
      if (handler && typeof handler === 'function' && handler.buttonId) {
        const button = document.getElementById(handler.buttonId)
        if (button) {
          button.removeEventListener('click', handler)
          if (button.dataset) {
            button.dataset.active = 'false'
          }
        }
      }
    })
    
    // Limpiar herramientas de líneas
    if (this.horizontalLineTool) {
      this.horizontalLineTool.deactivate()
      this.horizontalLineTool = null
    }
    
    if (this.verticalLineTool) {
      this.verticalLineTool.deactivate()
      this.verticalLineTool = null
    }
    
    // Preservar configuración para la próxima limpieza
    const config = {}
    Object.keys(this.toolHandlers).forEach(key => {
      if (key.endsWith('Id') || key.endsWith('Filename')) {
        config[key] = this.toolHandlers[key]
      }
    })
    this.toolHandlers = config
  }
}

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
      // Formato: 01 Ene o 1 Ene
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
