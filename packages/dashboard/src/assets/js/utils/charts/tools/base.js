export class BaseChartTool {
  constructor (chartInstance, symbol, stateManager, config = {}) {
    this.chart = chartInstance
    this.chartCore = chartInstance.getChart()
    this.container = chartInstance.getContainer()
    this.seriesInstances = chartInstance.getSeriesInstances()
    this.symbol = symbol
    this.stateManager = stateManager
    this.config = { ...this.getDefaultConfig(), ...config }
    this.isEnabled = false
    this.handlers = {}
  }

  getDefaultConfig () {
    return {}
  }

  enable () {
    if (this.isEnabled) return this
    this.isEnabled = true
    this._subscribeEvents()
    return this
  }

  disable () {
    if (!this.isEnabled) return this
    this.isEnabled = false
    this._unsubscribeEvents()
    return this
  }

  toggle () {
    return this.isEnabled ? this.disable() : this.enable()
  }

  _subscribeEvents () {
    // Override in subclasses
  }

  _unsubscribeEvents () {
    // Override in subclasses
  }

  async loadSavedData () {
    // Override in subclasses
  }

  async _saveData () {
    // Override in subclasses
  }

  destroy () {
    this.disable()
    this._cleanup()
  }

  reset () {
    this.disable()
    this._cleanup()
  }

  _cleanup () {
    // Override in subclasses
  }
}
