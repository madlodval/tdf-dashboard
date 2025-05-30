import { BaseChartTool } from './base.js'

export function fullscreenCharts (callback) {
  const root = document.body

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      if (typeof callback === 'function') {
        callback()
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange)

  if (!document.fullscreenElement) {
    root.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
  }
}

export class FullscreenTool extends BaseChartTool {
  constructor(chartInstance, symbol, stateManager, config = {}) {
    super(chartInstance, symbol, stateManager, config)
  }

  execute() {
    this.container.classList.add('full-screen')
    this.fullscreenCharts(() => {
      this.container.classList.remove('full-screen')
      setTimeout(() => {
        this.chart._repositionLabels()
      }, 100)
    })

    setTimeout(() => {
      this.chart._repositionLabels()
    }, 100)
  }

  fullscreenCharts(callback) {
    const root = document.body

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (typeof callback === 'function') {
          callback()
        }
        document.removeEventListener('fullscreenchange', handleFullscreenChange)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    if (!document.fullscreenElement) {
      root.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Esta herramienta no necesita eventos persistentes
  _subscribeEvents() {}
  _unsubscribeEvents() {}
  async _loadSavedData() {}
  async _saveData() {}
}