import { LineStyle } from 'lightweight-charts'
import { VLine } from '@tdf/lwc-plugin-vline'
import { screenshotCharts } from './tools/screenshot'
import { fullscreenCharts } from './tools/fullscreen'

const LINE_TYPE_VERTICAL = 'v'
const LINE_TYPE_HORIZONTAL = 'h'

export class ChartTools {
  static create(chartInstance, symbol, stateManager, config = {}) {
    return new ChartTools(chartInstance, symbol, stateManager, config)
  }

  constructor(chartInstance, symbol, stateManager, config = {}) {
    this.chart = chartInstance
    this.chartCore = chartInstance.getChart()
    this.container = chartInstance.getContainer()
    this.seriesInstances = chartInstance.getSeriesInstances()
    this.symbol = symbol
    this.stateManager = stateManager
    
    // Configuración de herramientas
    this.config = {
      hLines: false,
      vLines: false
    }
    
    // Instancias de líneas - ahora agrupadas por ID único
    this.hLinesGroups = [] // Array de grupos de líneas horizontales
    this.vLinesGroups = [] // Array de grupos de líneas verticales
    
    // Control de estado
    this.nearbyLineGroup = null
    this.isCtrlPressed = false
    
    // Handlers
    this.clickHandler = null
    this.crosshairHandler = null
    this.keyDownHandler = null
    this.keyUpHandler = null
    this.toolHandlers = {}
    
    // Estilo de líneas
    this.lineStyle = {
      color: config.lineColor || '#000000',
      width: config.lineWidth || 1,
      style: config.lineStyle || LineStyle.Solid
    }
    this.init();
  }

  init() {
    this._subscribeEvents()
    this._loadSavedLines() // Cargar líneas guardadas al inicializar
    return this
  }

  async _loadSavedLines() {
    try {
      const savedLines = await this.stateManager.loadLines(this.symbol)
      
      if (!savedLines || savedLines.length === 0) {
        return
      }

      // Agrupar las líneas por ID y tipo
      const hLinesMap = new Map()
      const vLinesMap = new Map()

      savedLines.forEach(line => {
        const lineId = line.id.replace(/^[hv]-/, '') // Remover prefijo h- o v-
        
        if (line.type === LINE_TYPE_HORIZONTAL) {
          if (!hLinesMap.has(lineId)) {
            hLinesMap.set(lineId, {
              id: lineId,
              type: LINE_TYPE_HORIZONTAL,
              price: line.price,
              lines: []
            })
          }
        } else if (line.type === LINE_TYPE_VERTICAL) {
          if (!vLinesMap.has(lineId)) {
            vLinesMap.set(lineId, {
              id: lineId,
              type: LINE_TYPE_VERTICAL,
              time: line.time,
              lines: []
            })
          }
        }
      })

      // Recrear líneas horizontales
      hLinesMap.forEach(lineGroup => {
        this.seriesInstances.forEach(series => {
          const priceLine = series.createPriceLine({
            price: lineGroup.price,
            color: this.lineStyle.color,
            lineStyle: this.lineStyle.style,
            lineWidth: this.lineStyle.width,
          })
          
          priceLine._groupId = lineGroup.id
          priceLine._lineType = LINE_TYPE_HORIZONTAL
          priceLine._series = series
          lineGroup.lines.push(priceLine)
        })
        
        if (lineGroup.lines.length > 0) {
          this.hLinesGroups.push(lineGroup)
        }
      })

      // Recrear líneas verticales
      vLinesMap.forEach(lineGroup => {
        this.seriesInstances.forEach(series => {
          const line = new VLine(lineGroup.time, {
            color: this.lineStyle.color,
            lineStyle: this.lineStyle.style,
            lineWidth: this.lineStyle.width,
          })
          
          line._groupId = lineGroup.id
          line._lineType = LINE_TYPE_VERTICAL
          line._series = series
          line._time = lineGroup.time
          lineGroup.lines.push(line)
          series.attachPrimitive(line)
        })
        
        if (lineGroup.lines.length > 0) {
          this.vLinesGroups.push(lineGroup)
        }
      })

    } catch (error) {
      console.error('Error loading saved lines:', error)
    }
  }

  _subscribeEvents() {
    this.clickHandler = this._handleClick.bind(this)
    this.crosshairHandler = this._handleCrosshairMove.bind(this)
    this.keyDownHandler = this._handleKeyDown.bind(this)
    this.keyUpHandler = this._handleKeyUp.bind(this)
    
    this.chartCore.subscribeClick(this.clickHandler)
    this.chartCore.subscribeCrosshairMove(this.crosshairHandler)
    document.addEventListener('keydown', this.keyDownHandler)
    document.addEventListener('keyup', this.keyUpHandler)
  }

  async _handleClick(param) {
    if (param.point === null) {
      return
    }

    // Si Ctrl está presionado y hay un grupo de líneas cercano, borrarlo
    if (this.isCtrlPressed && this.nearbyLineGroup) {
      await this._deleteLineGroup(this.nearbyLineGroup)
      this.nearbyLineGroup = null
      return
    }
    await this._createLines(param);
  }

  async _createHorizontalLine(param) {
    if (this.config.hLines) {
      const curPane = param.paneIndex
      const lineGroup = {
        id: Date.now() + Math.random(), // ID único para el grupo
        type: LINE_TYPE_HORIZONTAL,
        price: null,
        lines: []
      }
      
      let isSet = false
      const applyToSeries = new Map()
      param.seriesData.forEach((data, series) => {
        const paneIndex = series.getPane().paneIndex()
        let price = data.value || data.close
        if (paneIndex === curPane && !isSet) {
          const pointPrice = series.coordinateToPrice(param.point.y)
          if (Object.hasOwn(data, 'high') && Object.hasOwn(data, 'low')) {
            const { high, low } = data
            if (pointPrice >= low && pointPrice <= high) {
              price = pointPrice
              isSet = true
            }
          } else if (pointPrice >= 0 && price >= 0) {
            isSet = true
            price = pointPrice
          } else if (pointPrice <= 0 && price <= 0) {
            isSet = true
            price = pointPrice
          }
        }
        applyToSeries.set(series, price)       
      })
      let priceGroup;
      applyToSeries.forEach((price, series, index) => {
        const priceLine = series.createPriceLine({
            price,
            color: this.lineStyle.color,
            lineStyle: this.lineStyle.style,
            lineWidth: this.lineStyle.width,
        })
        
        priceLine._groupId = lineGroup.id
        priceLine._lineType = LINE_TYPE_HORIZONTAL
        priceLine._series = series
        lineGroup.lines.push(priceLine)
        if (index === 0) {
          priceGroup = price
        }
      }) 

      if (lineGroup.lines.length > 0) {
        lineGroup.price = applyToSeries.get(this.seriesInstances[0])
        this.hLinesGroups.push(lineGroup)
      }
    }    
  }

  async _createVerticalLine(param) {
    // Crear líneas verticales en todas las series
    if (this.config.vLines) {
      const time = param.time
      const lineGroup = {
        id: Date.now() + Math.random(), // ID único para el grupo
        type: LINE_TYPE_VERTICAL,
        time: time,
        lines: []
      }
      
      this.seriesInstances.forEach(series => {
        const line = new VLine(time, {
          color: this.lineStyle.color,
          lineStyle: this.lineStyle.style,
          lineWidth: this.lineStyle.width,
        })
        
        line._groupId = lineGroup.id
        line._lineType = LINE_TYPE_VERTICAL
        line._series = series
        line._time = time
        lineGroup.lines.push(line)
        series.attachPrimitive(line)
      })
      
      if (lineGroup.lines.length > 0) {
        this.vLinesGroups.push(lineGroup)
      }
    }    
  }

  async _createLines(param) {
    await this._createHorizontalLine(param)
    await this._createVerticalLine(param)
    await this._saveLines()
  }

  async _saveLines() {
    await this.stateManager.saveLines({
      symbol: this.symbol,
      hLines: this.hLinesGroups,
      vLines: this.vLinesGroups
    })
  }

  _handleCrosshairMove(param) {
    if (!param.point) {
      this.nearbyLineGroup = null
      this._updateCursor()
      return
    }
    if (param.time && param.sourceEvent && param.sourceEvent.ctrlKey) {
      this._detectNearbyLines(param)
    }
  }

  _detectNearbyLines(param) {
    const tolerance = 5
    let nearestLineGroup = null
    let minDistance = Infinity

    // Verificar grupos de líneas horizontales
    this.hLinesGroups.forEach(lineGroup => {
      if (lineGroup.lines.length > 0 && lineGroup.price !== null) {
        // Usar la primera línea del grupo para calcular la posición
        const firstLine = lineGroup.lines[0]
        if (firstLine._series) {
          const lineY = firstLine._series.priceToCoordinate(lineGroup.price)
          if (lineY !== null) {
            const distance = Math.abs(param.point.y - lineY)
            if (distance <= tolerance && distance < minDistance) {
              minDistance = distance
              nearestLineGroup = lineGroup
            }
          }
        }
      }
    })

    // Verificar grupos de líneas verticales
    this.vLinesGroups.forEach(lineGroup => {
      if (lineGroup.lines.length > 0 && lineGroup.time !== null) {
        const lineX = this.chartCore.timeScale().timeToCoordinate(lineGroup.time)
        if (lineX !== null) {
          const distance = Math.abs(param.point.x - lineX)
          if (distance <= tolerance && distance < minDistance) {
            minDistance = distance
            nearestLineGroup = lineGroup
          }
        }
      }
    })

    this.nearbyLineGroup = nearestLineGroup
    this._updateCursor()
  }

  _updateCursor() {
    if (this.nearbyLineGroup && this.isCtrlPressed) {
      this.container.style.cursor = 'pointer'
    } else {
      this.container.style.cursor = ''
    }
  }

  async _deleteLineGroup(lineGroup) {
    if (lineGroup.type === LINE_TYPE_HORIZONTAL) {
      lineGroup.lines.forEach(priceLine => {
        if (priceLine._series) {
          priceLine._series.removePriceLine(priceLine)
        }
      })
      
      const index = this.hLinesGroups.indexOf(lineGroup)
      if (index > -1) {
        this.hLinesGroups.splice(index, 1)
      }
    } else if (lineGroup.type === LINE_TYPE_VERTICAL) {
      lineGroup.lines.forEach(vLine => {
        if (vLine._series) {
          vLine._series.detachPrimitive(vLine)
        }
      })
      
      const index = this.vLinesGroups.indexOf(lineGroup)
      if (index > -1) {
        this.vLinesGroups.splice(index, 1)
      }
    }
    await this._saveLines()
  }

  _handleKeyDown(event) {
    if (event.ctrlKey || event.metaKey) {
      this.isCtrlPressed = true
      this._updateCursor()
    }
  }

  _handleKeyUp(event) {
    if (!event.ctrlKey && !event.metaKey) {
      this.isCtrlPressed = false
      this._updateCursor()
    }
  }

  // Configuración de botones
  render(buttonsConfig = {}) {
    const defaults = {
      hLineButtonId: 'h-line-btn',
      vLineButtonId: 'v-line-btn',
      resetButtonId: 'reset-charts-btn',
      fullscreenButtonId: 'fullscreen-btn',
      screenshotButtonId: 'screenshot-btn',
      screenshotFilename: 'chart'
    }

    this.toolHandlers = { ...defaults, ...buttonsConfig }
    this._cleanupToolHandlers()

    setTimeout(() => {
      this._setupButton('hLines', this.toolHandlers.hLineButtonId, () => {
        this.config.hLines = !this.config.hLines
        return this.config.hLines
      })

      this._setupButton('vLines', this.toolHandlers.vLineButtonId, () => {
        this.config.vLines = !this.config.vLines
        return this.config.vLines
      })

      this._setupButton('reset', this.toolHandlers.resetButtonId, () => {
        this.chart.reset()
        this.clearAllLines()
        return false
      })

      this._setupButton('fullscreen', this.toolHandlers.fullscreenButtonId, () => {
        this.fullscreen()
        return false
      })

      this._setupButton('screenshot', this.toolHandlers.screenshotButtonId, () => {
        this.screenshot({ filename: this.toolHandlers.screenshotFilename })
        return false
      })
    }, 0)

    return this
  }

  _setupButton(toolType, buttonId, toggleFunction) {
    const button = document.getElementById(buttonId)
    if (!button) return

    const handler = (e) => {
      const target = e.currentTarget
      const isActive = toggleFunction()
      target.dataset.active = isActive ? 'true' : 'false'
    }

    handler.buttonId = buttonId
    this.toolHandlers[toolType] = handler
    button.addEventListener('click', handler)
  }

  // Métodos públicos
  clearAllLines() {
    // Limpiar grupos de líneas horizontales
    this.hLinesGroups.forEach(lineGroup => {
      lineGroup.lines.forEach(priceLine => {
        if (priceLine._series) {
          priceLine._series.removePriceLine(priceLine)
        }
      })
    })
    this.hLinesGroups = []

    // Limpiar grupos de líneas verticales
    this.vLinesGroups.forEach(lineGroup => {
      lineGroup.lines.forEach(vLine => {
        if (vLine._series) {
          vLine._series.detachPrimitive(vLine)
        }
      })
    })
    this.vLinesGroups = []

    this.nearbyLineGroup = null
    
    this._saveLines()
  }

  // Método público para recargar líneas
  async reloadLines() {
    // Limpiar líneas actuales sin guardar
    this.hLinesGroups.forEach(lineGroup => {
      lineGroup.lines.forEach(priceLine => {
        if (priceLine._series) {
          priceLine._series.removePriceLine(priceLine)
        }
      })
    })
    this.hLinesGroups = []

    this.vLinesGroups.forEach(lineGroup => {
      lineGroup.lines.forEach(vLine => {
        if (vLine._series) {
          vLine._series.detachPrimitive(vLine)
        }
      })
    })
    this.vLinesGroups = []

    this.nearbyLineGroup = null
    
    // Cargar líneas guardadas
    await this._loadSavedLines()
  }

  // Métodos para obtener información de líneas
  getHorizontalLinesCount() {
    return this.hLinesGroups.length
  }

  getVerticalLinesCount() {
    return this.vLinesGroups.length
  }

  getAllLinesCount() {
    return this.hLinesGroups.length + this.vLinesGroups.length
  }

  fullscreen() {
    this.container.classList.add('full-screen')
    fullscreenCharts(() => {
      this.container.classList.remove('full-screen')
      setTimeout(() => {
        this.chart._repositionLabels()
      }, 100)
    })

    setTimeout(() => {
      this.chart._repositionLabels()
    }, 100)
  }

  screenshot(opts) {
    screenshotCharts([`#${this.chart.containerId}`], opts)
  }

  destroy() {
    this._unsubscribeEvents()
    this._cleanupToolHandlers()
    this.clearAllLines()
  }

  _unsubscribeEvents() {
    if (this.chartCore) {
      if (this.clickHandler) {
        this.chartCore.unsubscribeClick(this.clickHandler)
      }
      if (this.crosshairHandler) {
        this.chartCore.unsubscribeCrosshairMove(this.crosshairHandler)
      }
    }

    document.removeEventListener('keydown', this.keyDownHandler)
    document.removeEventListener('keyup', this.keyUpHandler)

    this.clickHandler = null
    this.crosshairHandler = null
    this.keyDownHandler = null
    this.keyUpHandler = null
  }

  _cleanupToolHandlers() {
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
  }
}
