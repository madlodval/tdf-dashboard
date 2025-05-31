import { BaseChartTool } from '../base.js'
import { LineStyle } from 'lightweight-charts'

export const LINE_TYPE_HORIZONTAL = 'h'
export const LINE_TYPE_VERTICAL = 'v'

export class BaseLinesTool extends BaseChartTool {
  constructor (chartInstance, symbol, stateManager, config = {}) {
    super(chartInstance, symbol, stateManager, config)
    this.linesGroups = []
    this.nearbyLineGroup = null
    this.isCtrlPressed = false
    this.lineType = this.getLineType() // Debe ser implementado por subclases
  }

  getDefaultConfig () {
    return {
      color: '#000000',
      width: 1,
      style: LineStyle.Solid,
      tolerance: 5
    }
  }

  // Método abstracto - debe ser implementado por subclases
  getLineType () {
    throw new Error('getLineType() must be implemented by subclasses')
  }

  // Método abstracto - debe ser implementado por subclases
  async _createSingleLine (param, lineGroup) {
    throw new Error('_createSingleLine() must be implemented by subclasses')
  }

  // Método abstracto - debe ser implementado por subclases
  _removeSingleLine (line) {
    throw new Error('_removeSingleLine() must be implemented by subclasses')
  }

  // Método abstracto - debe ser implementado por subclases
  _calculateLineDistance (lineGroup, param) {
    throw new Error('_calculateLineDistance() must be implemented by subclasses')
  }

  // Método abstracto - debe ser implementado por subclases
  _recreateSavedLine (lineData) {
    throw new Error('_recreateSavedLine() must be implemented by subclasses')
  }

  _subscribeEvents () {
    this.handlers.click = this._handleClick.bind(this)
    this.handlers.crosshairMove = this._handleCrosshairMove.bind(this)
    this.handlers.keyDown = this._handleKeyDown.bind(this)
    this.handlers.keyUp = this._handleKeyUp.bind(this)

    this.chartCore.subscribeClick(this.handlers.click)
    this.chartCore.subscribeCrosshairMove(this.handlers.crosshairMove)
    document.addEventListener('keydown', this.handlers.keyDown)
    document.addEventListener('keyup', this.handlers.keyUp)
  }

  _unsubscribeEvents () {
    if (this.handlers.click) {
      this.chartCore.unsubscribeClick(this.handlers.click)
    }
    if (this.handlers.crosshairMove) {
      this.chartCore.unsubscribeCrosshairMove(this.handlers.crosshairMove)
    }
    document.removeEventListener('keydown', this.handlers.keyDown)
    document.removeEventListener('keyup', this.handlers.keyUp)

    this.handlers = {}
  }

  async loadSavedData () {
    try {
      const savedLines = await this.stateManager.loadLines(this.symbol, this.lineType)
      if (!savedLines || savedLines.length === 0) return

      // Agrupar las líneas por ID
      const linesMap = new Map()
      savedLines.forEach(line => {
        const lineId = line.id.toString().replace(new RegExp(`^${this.lineType}-`), '')
        if (!linesMap.has(lineId)) {
          linesMap.set(lineId, {
            id: lineId,
            ...line,
            lines: []
          })
        }
      })

      // Recrear líneas usando el método específico de cada subclase
      for (const lineGroup of linesMap.values()) {
        this._recreateSavedLine(lineGroup)
        if (lineGroup.lines.length > 0) {
          this.linesGroups.push(lineGroup)
        }
      }
    } catch (error) {
      console.error(`Error loading ${this.lineType} lines:`, error)
    }
  }

  async _handleClick (param) {
    if (!this.isEnabled || param.point === null) return

    if (this.isCtrlPressed && this.nearbyLineGroup) {
      await this._deleteLineGroup(this.nearbyLineGroup)
      this.nearbyLineGroup = null
      return
    }

    await this._createLine(param)
  }

  async _createLine (param) {
    const lineGroup = {
      id: Date.now() + Math.random(),
      type: this.lineType,
      lines: []
    }

    // Llamar al método específico de cada subclase
    this._createSingleLine(param, lineGroup)
    if (lineGroup.lines.length > 0) {
      this.linesGroups.push(lineGroup)
      this._saveData()
    }
  }

  _handleCrosshairMove (param) {
    if (!this.isEnabled || !param.point) {
      this.nearbyLineGroup = null
      this._updateCursor()
      return
    }

    if (param.time && param.sourceEvent && param.sourceEvent.ctrlKey) {
      this._detectNearbyLines(param)
    }
  }

  _detectNearbyLines (param) {
    let nearestLineGroup = null
    let minDistance = Infinity

    this.linesGroups.forEach(lineGroup => {
      if (lineGroup.lines.length > 0) {
        const distance = this._calculateLineDistance(lineGroup, param)
        if (distance !== null && distance <= this.config.tolerance && distance < minDistance) {
          minDistance = distance
          nearestLineGroup = lineGroup
        }
      }
    })

    this.nearbyLineGroup = nearestLineGroup
    this._updateCursor()
  }

  _updateCursor () {
    if (this.nearbyLineGroup && this.isCtrlPressed) {
      this.container.style.cursor = 'pointer'
    } else {
      this.container.style.cursor = ''
    }
  }

  async _deleteLineGroup (lineGroup) {
    lineGroup.lines.forEach(line => {
      this._removeSingleLine(line)
    })

    const index = this.linesGroups.indexOf(lineGroup)
    if (index > -1) {
      this.linesGroups.splice(index, 1)
    }

    return this._saveData()
  }

  _handleKeyDown (event) {
    if (event.ctrlKey || event.metaKey) {
      this.isCtrlPressed = true
      this._updateCursor()
    }
  }

  _handleKeyUp (event) {
    if (!event.ctrlKey && !event.metaKey) {
      this.isCtrlPressed = false
      this._updateCursor()
    }
  }

  async _saveData () {
    const key = this.lineType === LINE_TYPE_HORIZONTAL ? 'price' : 'time'
    return this.stateManager.saveLines({
      symbol: this.symbol,
      type: this.lineType,
      lines: this.linesGroups.map(lineGroup => ({
        [key]: lineGroup[key],
        id: lineGroup.id
      }))
    })
  }

  clearAll () {
    this.linesGroups.forEach(lineGroup => {
      lineGroup.lines.forEach(line => {
        this._removeSingleLine(line)
      })
    })
    this.linesGroups = []
    this.nearbyLineGroup = null
    return this._saveData()
  }

  getCount () {
    return this.linesGroups.length
  }

  _cleanup () {
    this.clearAll()
  }

  // Métodos de utilidad para crear líneas con estilos consistentes
  _createLineStyle () {
    return {
      color: this.config.color,
      lineStyle: this.config.style,
      lineWidth: this.config.width
    }
  }

  _assignLineMetadata (line, lineGroup) {
    line._groupId = lineGroup.id
    line._lineType = this.lineType
    return line
  }

  execute () {
    this.toggle()
  }
}
