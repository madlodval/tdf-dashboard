import { BaseChartTool } from './base.js'

export class ResetTool extends BaseChartTool {
  constructor (chartInstance, symbol, stateManager, config = {}) {
    super(chartInstance, symbol, stateManager, config)
  }

  _cleanup () {
    this.chart.reset()
  }

  execute (toolManager) {
    toolManager.reset()
  }

  _subscribeEvents () {}
  _unsubscribeEvents () {}
  async loadSavedData () {}
  async _saveData () {}
}
