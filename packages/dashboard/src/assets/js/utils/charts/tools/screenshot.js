import { BaseChartTool } from './base.js'

export class ScreenshotTool extends BaseChartTool {
  constructor (chartInstance, symbol, stateManager, config = {}) {
    super(chartInstance, symbol, stateManager, config)
  }

  getDefaultConfig () {
    return {
      filename: 'chart-screenshot.png'
    }
  }

  async execute (options = {}) {
    const filename = options.filename || this.config.filename
    const canvas = await this.chart.takeScreenshot(true, options)
    const dataUrl = canvas.toDataURL('image/png')
    this.downloadImage(dataUrl, filename)
  }

  // Función auxiliar para descargar la imagen
  downloadImage (dataUrl, filename) {
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }

  _subscribeEvents () {}
  _unsubscribeEvents () {}
  async loadSavedData () {}
  async _saveData () {}
}
