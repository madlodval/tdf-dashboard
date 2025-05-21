import { LineSeries, LineStyle } from 'lightweight-charts'

export class LineTool {
  constructor ({ button, container, chart, opts = {} }) {
    this.chart = chart
    this.container = container
    this.lineControls = {
      lines: new Map(),
      nextId: 1,
      active: false,
      initialPoint: null,
      currentLine: null
    }
    this.opts = opts
    this.button = button
    this.onClick = this.click.bind(this)
    this.onMousedown = this.mousedown.bind(this)
    this.onMousemove = this.mousemove.bind(this)
    this.button.addEventListener('click', this.onClick)
    this.container.addEventListener('mousedown', this.onMousedown)
    // this.container.addEventListener('mousemove', this.onMousemove)
  }

  click () {
    this.lineControls.active = !this.lineControls.active
    // Use Tailwind classes for active state
    if (this.lineControls.active) {
      this.button.classList.add('bg-blue-100')
      this.button.setAttribute('data-active', 'true')
      this.container.classList.add('cursor-crosshair')
    } else {
      this.button.classList.remove('bg-blue-100')
      this.button.setAttribute('data-active', 'false')
      this.container.classList.remove('cursor-crosshair')
      this.lineControls.initialPoint = null
    }
  }

  mousedown (e) {
    if (!this.lineControls.active || !this.chart) return

    const rect = this.container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Get coordinates in chart space
    const logical = this.chart.timeScale().coordinateToLogical(x)
    const price = this.chart.panes()[0].getSeries()[0].coordinateToPrice(y)
    console.log(price);
    if (logical === null || price === null) return

    if (!this.lineControls.initialPoint) {
      // Start drawing a new line
      this.lineControls.initialPoint = { time: logical, price }
    } else {
      // Complete the line
      const lineId = `line_${this.lineControls.nextId++}`
      const lineOptions = {
        color: this.opts.color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Line ${this.lineControls.nextId - 1}`
      }

      const line = this.chart.addSeries(LineSeries, lineOptions, 0)

      line.setData([
        { time: this.lineControls.initialPoint.time, value: this.lineControls.initialPoint.price },
        { time: logical, value: price }
      ])

      // Store the line reference
      this.lineControls.lines.set(lineId, {
        series: line,
        points: [
          { time: this.lineControls.initialPoint.time, value: this.lineControls.initialPoint.price },
          { time: logical, value: price }
        ]
      })

      // Add delete button for this line
      this._addLineDeleteButton(lineId)

      // Reset for next line
      this.lineControls.initialPoint = null
    }
  }

  mousemove (e) {
    if (!this.lineControls.active || !this.chart || !this.lineControls.initialPoint) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Get coordinates in chart space
    const logical = this.chart.timeScale().coordinateToLogical(x)
    const price = this.chart.panes()[0].getSeries()[0].coordinateToPrice(y)

    if (logical === null || price === null) return

    // Remove previous preview line if exists
    if (this.lineControls.currentLine) {
      this.chart.panes()[0].removeSeries(this.lineControls.currentLine)
      this.lineControls.currentLine = null
    }

    // Create preview line
    const previewLine = this.chart.panes()[0].addLineSeries({
      color: COLOR_PRIMARY,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed
    })

    previewLine.setData([
      { time: this.lineControls.initialPoint.time, value: this.lineControls.initialPoint.price },
      { time: logical, value: price }
    ])

    this.lineControls.currentLine = previewLine
  }

  _addLineDeleteButton (lineId) {
    const lineInfo = this.lineControls.lines.get(lineId)
    if (!lineInfo) return

    // Create a floating delete button
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-line-btn absolute p-1 bg-white border border-gray-300 rounded shadow-sm'
    deleteBtn.innerHTML = '×'
    deleteBtn.title = 'Delete this line'
    deleteBtn.style.zIndex = '50'

    this.container.appendChild(deleteBtn)

    // Position the button at the end of the line
    const endPoint = lineInfo.points[1]
    const x = this.chart.timeScale().logicalToCoordinate(endPoint.time)
    const y = this.chart.panes()[0].priceScale('right').priceToCoordinate(endPoint.value)

    if (x !== null && y !== null) {
      deleteBtn.style.left = `${x + 5}px`
      deleteBtn.style.top = `${y - 10}px`
    }

    // Delete line on click
    deleteBtn.addEventListener('click', () => {
      const lineToRemove = this.lineControls.lines.get(lineId)
      if (lineToRemove) {
        this.chart.panes()[0].removeSeries(lineToRemove.series)
        this.lineControls.lines.delete(lineId)
        deleteBtn.remove()
      }
    })
  }

  clean () {
    if (this.lineControls) {
    // Remove event listeners and buttons
      const lineToggleBtn = this.container.closest('section').querySelector('.line-tool-btn')
      if (lineToggleBtn) lineToggleBtn.remove()

      // Remove all lines
      this.lineControls.lines.forEach((lineInfo, lineId) => {
        if (this.chart && lineInfo.series) {
          this.chart.panes()[0].removeSeries(lineInfo.series)
        }
      })

      // Remove all delete buttons
      const deleteButtons = this.container.querySelectorAll('.delete-line-btn')
      deleteButtons.forEach(btn => btn.remove())

      // Clean up any preview line
      if (this.lineControls.currentLine && this.chart) {
        this.chart.panes()[0].removeSeries(this.lineControls.currentLine)
      }

      this.lineControls = null
    }
    this.button.removeEventListener('click', this.onClick)
    this.container.removeEventListener('mousedown', this.onMousedown)
    this.container.removeEventListener('mousemove', this.onMousemove)
  }
}
