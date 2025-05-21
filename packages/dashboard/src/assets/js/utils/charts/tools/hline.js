import { LineStyle } from 'lightweight-charts'

class HorizontalLineRenderer {
  constructor () {
    this._data = null // Contendrá los datos necesarios para el renderizado
  }

  update (data) {
    this._data = data
  }

  draw (target, priceConverterIgnored) { // priceConverter no se usa en renderers de ISeriesPrimitive desde v4+
    if (!this._data || this._data.y === null || target === null || !this._data.visible) {
      if (this._data) this._data.deleteButtonRect = null
      return
    }

    target.useBitmapCoordinateSpace(scope => {
      if (scope.cssSize.width === 0 || scope.cssSize.height === 0) {
        return
      }
      const ctx = scope.context
      const yCss = this._data.y // Coordenada Y en píxeles CSS

      // Dibuja la línea horizontal
      ctx.beginPath()
      ctx.strokeStyle = this._data.color
      ctx.lineWidth = this._data.lineWidth // lineWidth se especifica en píxeles CSS

      if (this._data.lineStyle === LineStyle.Dashed) {
        ctx.setLineDash([6, 3]) // Estilo de línea discontinua
      } else if (this._data.lineStyle === LineStyle.Dotted) {
        ctx.setLineDash([2, 2]) // Estilo de línea punteada
      } else { // LightweightCharts.LineStyle.Solid u otros
        ctx.setLineDash([]) // Estilo de línea sólida
      }

      ctx.moveTo(0, yCss)
      ctx.lineTo(scope.cssSize.width, yCss)
      ctx.stroke()
      ctx.setLineDash([]) // Restablecer para otros dibujos

      // Dibuja el botón de eliminar si está habilitado
      if (this._data.showDeleteButton) {
        const buttonSize = this._data.deleteButtonSize // en píxeles CSS
        const buttonX = scope.cssSize.width - buttonSize - this._data.deleteButtonMargin // CSS
        let buttonY = yCss - buttonSize / 2 // Centrado verticalmente en la línea (CSS)

        buttonY = Math.max(0, Math.min(buttonY, scope.cssSize.height - buttonSize))

        this._data.deleteButtonRect = {
          x: buttonX,
          y: buttonY,
          width: buttonSize,
          height: buttonSize
        }

        ctx.fillStyle = this._data.deleteButtonBackgroundColor
        ctx.fillRect(buttonX, buttonY, buttonSize, buttonSize)
        ctx.strokeStyle = this._data.deleteButtonIconColor
        ctx.lineWidth = 1

        ctx.beginPath()
        const padding = buttonSize * 0.25
        ctx.moveTo(buttonX + padding, buttonY + padding)
        ctx.lineTo(buttonX + buttonSize - padding, buttonY + buttonSize - padding)
        ctx.moveTo(buttonX + buttonSize - padding, buttonY + padding)
        ctx.lineTo(buttonX + padding, buttonY + buttonSize - padding)
        ctx.stroke()
      } else {
        this._data.deleteButtonRect = null
      }
    })
  }
}

class HorizontalLinePaneView {
  constructor (sourcePlugin) {
    this._source = sourcePlugin
    this._renderer = new HorizontalLineRenderer()
  }

  update () {
    const series = this._source._series
    const price = this._source._price
    const yCoordinate = series.priceToCoordinate(price)

    const rendererData = {
      y: yCoordinate,
      color: this._source._color,
      lineWidth: this._source._lineWidth,
      lineStyle: this._source._lineStyle,
      visible: this._source._visible,
      showDeleteButton: this._source._showDeleteButton,
      deleteButtonSize: this._source._deleteButtonSize,
      deleteButtonMargin: this._source._deleteButtonMargin,
      deleteButtonBackgroundColor: this._source._deleteButtonBackgroundColor,
      deleteButtonIconColor: this._source._deleteButtonIconColor,
      deleteButtonRect: null
    }
    this._renderer.update(rendererData)
  }

  renderer () {
    return this._source._visible ? this._renderer : null
  }
}

export class HorizontalLinePlugin {
  constructor (series, options) {
    this._series = series
    this._chart = options.chart

    if (!this._chart) {
      throw new Error('La instancia del gráfico (chart) debe ser proporcionada en las opciones.')
    }

    // --- MODIFICACIÓN PARA PRECIO AUTOMÁTICO ---
    if (typeof options.price === 'number' && !isNaN(options.price)) {
      this._price = options.price
    } else {
      // Intenta obtener el último precio de la serie
      const seriesData = this._series.data() // Obtiene una copia de los datos de la serie
      if (seriesData && seriesData.length > 0) {
        const lastDataPoint = seriesData[seriesData.length - 1]
        const seriesType = this._series.seriesType()

        if (seriesType === 'Candlestick' || seriesType === 'Bar') {
          this._price = lastDataPoint.close
        } else if (seriesType === 'Line' || seriesType === 'Area' || seriesType === 'Baseline' || seriesType === 'Histogram') {
          this._price = lastDataPoint.value
        } else {
          console.warn(`HorizontalLinePlugin: No se pudo determinar el último precio para el tipo de serie "${seriesType}". Usando 0 como predeterminado.`)
          this._price = 0
        }

        // Verificación adicional por si 'close' o 'value' no estuvieran definidos en el último punto
        if (typeof this._price !== 'number' || isNaN(this._price)) {
          console.warn('HorizontalLinePlugin: El último punto de datos no tenía un \'close\' o \'value\' válido. Usando 0 como predeterminado.')
          this._price = 0
        }
      } else {
        console.warn('HorizontalLinePlugin: La serie no tiene datos para determinar el último precio. Usando 0 como predeterminado.')
        this._price = 0
      }
    }
    // --- FIN DE MODIFICACIÓN ---

    this._color = options.color || 'blue'
    this._lineWidth = options.lineWidth || 1
    this._lineStyle = options.lineStyle || LineStyle.Solid
    this._draggable = options.draggable !== undefined ? options.draggable : true
    this._showDeleteButton = options.showDeleteButton !== undefined ? options.showDeleteButton : true
    this._id = options.id || `hLine-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    this._onDestroy = options.onDestroy

    this._visible = true
    this._paneViews = [new HorizontalLinePaneView(this)]
    this._isDragging = false
    this._chartElement = this._chart.chartElement()

    this._deleteButtonSize = options.deleteButtonSize || 18
    this._deleteButtonMargin = options.deleteButtonMargin || 5
    this._deleteButtonBackgroundColor = options.deleteButtonBackgroundColor || 'rgba(240, 240, 240, 0.75)'
    this._deleteButtonIconColor = options.deleteButtonIconColor || 'rgba(50, 50, 50, 1)'

    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onClick = this._onClick.bind(this)

    this._chartElement.addEventListener('mousedown', this._onMouseDown)
    this._chart.subscribeClick(this._onClick)
  }

  // --- Implementación de la interfaz ISeriesPrimitive ---
  updateAllViews () {
    if (!this._visible) return
    this._paneViews.forEach(view => view.update())
  }

  paneViews () {
    return this._visible ? this._paneViews : []
  }
  // --- Fin ISeriesPrimitive ---

  // --- API Pública del Plugin ---
  id () {
    return this._id
  }

  price () {
    return this._price
  }

  updateOptions (options) {
    if (options.price !== undefined && typeof options.price === 'number' && !isNaN(options.price)) this._price = options.price
    if (options.color !== undefined) this._color = options.color
    if (options.lineWidth !== undefined) this._lineWidth = options.lineWidth
    if (options.lineStyle !== undefined) this._lineStyle = options.lineStyle
    if (options.draggable !== undefined) this._draggable = options.draggable
    if (options.showDeleteButton !== undefined) this._showDeleteButton = options.showDeleteButton

    this._requestChartUpdate()
  }

  remove () {
    this._visible = false

    this._chartElement.removeEventListener('mousedown', this._onMouseDown)
    this._chart.unsubscribeClick(this._onClick)

    if (this._isDragging) {
      document.removeEventListener('mousemove', this._onMouseMove)
      document.removeEventListener('mouseup', this._onMouseUp)
      this._isDragging = false
    }

    this._requestChartUpdate()

    if (this._onDestroy) {
      this._onDestroy(this)
    }
    console.log(`Línea horizontal ${this._id} eliminada.`)
  }

  // --- Métodos Internos ---
  _requestChartUpdate () {
    this._series.applyOptions({})
  }

  _onMouseDown (event) {
    if (!this._visible || event.button !== 0) return

    const chartRect = this._chartElement.getBoundingClientRect()
    const mouseY = event.clientY - chartRect.top

    const rendererData = this._paneViews[0]._renderer._data
    if (this._showDeleteButton && rendererData && rendererData.deleteButtonRect) {
      const btn = rendererData.deleteButtonRect
      const clickX = event.clientX - chartRect.left
      const clickY = event.clientY - chartRect.top

      if (clickX >= btn.x && clickX <= btn.x + btn.width &&
                clickY >= btn.y && clickY <= btn.y + btn.height) {
        return
      }
    }

    if (!this._draggable) return

    const priceAtMouse = this._series.coordinateToPrice(mouseY)
    if (priceAtMouse === null) return

    const lineYCoordinate = this._series.priceToCoordinate(this._price)
    if (lineYCoordinate === null) return

    const hitThreshold = (this._lineWidth / 2) + 5
    if (Math.abs(mouseY - lineYCoordinate) <= hitThreshold) {
      this._isDragging = true
      document.addEventListener('mousemove', this._onMouseMove)
      document.addEventListener('mouseup', this._onMouseUp)
      event.preventDefault()
    }
  }

  _onMouseMove (event) {
    if (!this._isDragging || !this._visible) return

    const chartRect = this._chartElement.getBoundingClientRect()
    const mouseY = event.clientY - chartRect.top
    const newPrice = this._series.coordinateToPrice(mouseY)

    if (newPrice !== null) {
      this._price = newPrice
      this._requestChartUpdate()
    }
  }

  _onMouseUp (event) {
    if (!this._isDragging) return
    this._isDragging = false
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('mouseup', this._onMouseUp)
    this._requestChartUpdate()
  }

  _onClick (param) {
    if (!this._visible || !this._showDeleteButton || !param.point) return

    const rendererData = this._paneViews[0]._renderer._data
    if (!rendererData || !rendererData.deleteButtonRect) return

    const btnRect = rendererData.deleteButtonRect

    if (param.point.x >= btnRect.x && param.point.x <= btnRect.x + btnRect.width &&
            param.point.y >= btnRect.y && param.point.y <= btnRect.y + btnRect.height) {
      this.remove()
    }
  }
}
