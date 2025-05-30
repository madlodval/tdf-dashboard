import html2canvas from 'html2canvas'
import { BaseChartTool } from './base.js'

/**
 * Captura uno o más charts con todos sus elementos HTML en un solo PNG y dispara la descarga.
 *
 * @param {string[]} containerSelectors
 *   Array de selectores CSS de los contenedores completos de los charts.
 * @param {Object} [options]
 * @param {string} [options.filename='charts-screenshot.png']
 *   Nombre del archivo PNG resultante.
 */
export async function screenshotCharts (
  containerSelectors,
  {
    filename = 'charts-screenshot.png'
  } = {}
) {
  try {
    // Si html2canvas falla, intentaremos con un enfoque más básico
    const containers = containerSelectors
      .map(sel => document.querySelector(sel))
      .filter(container => container !== null)

    if (containers.length === 0) {
      return
    }

    // Configuración de html2canvas con opciones que evitan problemas de color
    const html2canvasOptions = {
      allowTaint: true,
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      // Ignorar estilos problemáticos
      ignoreElements: (element) => {
        // Si hay un elemento específico causando problemas, podríamos identificarlo aquí
        return false
      },
      // Método personalizado para manejar colores problemáticos
      onclone: (documentClone) => {
        // Reemplazar temporalmente colores LAB o problemáticos en el clon del documento
        const elements = documentClone.querySelectorAll('*')
        elements.forEach(el => {
          const style = window.getComputedStyle(el)
          // Si hay propiedades de color que usan LAB, convertirlas a RGB estándar
          if (style.color && style.color.includes('lab')) {
            el.style.color = '#333333' // Color de respaldo seguro
          }
          if (style.backgroundColor && style.backgroundColor.includes('lab')) {
            el.style.backgroundColor = 'transparent'
          }
        })
      }
    }

    // Capturar cada contenedor con html2canvas
    try {
      const captures = await Promise.all(
        containers.map(container => html2canvas(container, html2canvasOptions))
      )

      // Calcular dimensiones y crear canvas combinado
      const width = Math.max(...captures.map(c => c.width))
      const totalHeight = captures.reduce((sum, c) => sum + c.height, 0)

      const combo = document.createElement('canvas')
      combo.width = width
      combo.height = totalHeight
      const ctx = combo.getContext('2d')

      // Dibujar capturas
      let offsetY = 0
      for (const capture of captures) {
        ctx.drawImage(capture, 0, offsetY)
        offsetY += capture.height
      }

      // Descargar imagen
      const dataUrl = combo.toDataURL('image/png')
      downloadImage(dataUrl, filename)
    } catch (error) {
      console.warn('html2canvas failed, falling back to canvas-only capture:', error)
      return fallbackToCanvasOnly(containers, filename)
    }
  } catch (error) {
    console.error('Error capturing charts:', error)
  }
}

// Función fallback que captura solo los elementos canvas dentro de los contenedores
function fallbackToCanvasOnly (containers, filename) {
  try {
    // Extraer todos los canvas de los contenedores
    const canvases = []
    containers.forEach(container => {
      const containerCanvases = container.querySelectorAll('canvas')
      containerCanvases.forEach(canvas => canvases.push(canvas))
    })

    if (canvases.length === 0) {
      return
    }

    // Calcular dimensiones
    const width = Math.max(...canvases.map(c => c.width))
    const height = canvases.reduce((sum, c) => sum + c.height, 0)

    // Crear canvas combinado
    const combo = document.createElement('canvas')
    combo.width = width
    combo.height = height
    const ctx = combo.getContext('2d')

    // Dibujar cada canvas
    let offsetY = 0
    for (const canvas of canvases) {
      ctx.drawImage(canvas, 0, offsetY)
      offsetY += canvas.height
    }

    // Descargar imagen
    const dataUrl = combo.toDataURL('image/png')
    downloadImage(dataUrl, filename)
  } catch (error) {
    console.error('Fallback capture failed:', error)
  }
}

// Función auxiliar para descargar la imagen
function downloadImage (dataUrl, filename) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}


export class ScreenshotTool extends BaseChartTool {
  constructor(chartInstance, symbol, stateManager, config = {}) {
    super(chartInstance, symbol, stateManager, config)
  }

  getDefaultConfig() {
    return {
      filename: 'chart-screenshot.png'
    }
  }

  async execute(options = {}) {
    const filename = options.filename || this.config.filename
    // this.screenshotCharts([`#${this.chart.containerId}`], { filename })
    const canvas = await this.chart.takeScreenshot(true, options);
    const dataUrl = canvas.toDataURL('image/png');
    downloadImage(dataUrl, filename);
  }

  /**
   * Captura uno o más charts con todos sus elementos HTML en un solo PNG y dispara la descarga.
   *
   * @param {string[]} containerSelectors
   *   Array de selectores CSS de los contenedores completos de los charts.
   * @param {Object} [options]
   * @param {string} [options.filename='charts-screenshot.png']
   *   Nombre del archivo PNG resultante.
   */
  async screenshotCharts(
    containerSelectors,
    {
      filename = 'charts-screenshot.png'
    } = {}
  ) {
    try {
      // Si html2canvas falla, intentaremos con un enfoque más básico
      const containers = containerSelectors
        .map(sel => document.querySelector(sel))
        .filter(container => container !== null)

      if (containers.length === 0) {
        return
      }

      // Configuración de html2canvas con opciones que evitan problemas de color
      const html2canvasOptions = {
        allowTaint: true,
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        // Ignorar estilos problemáticos
        ignoreElements: (element) => {
          // Si hay un elemento específico causando problemas, podríamos identificarlo aquí
          return false
        },
        // Método personalizado para manejar colores problemáticos
        onclone: (documentClone) => {
          // Reemplazar temporalmente colores LAB o problemáticos en el clon del documento
          const elements = documentClone.querySelectorAll('*')
          elements.forEach(el => {
            const style = window.getComputedStyle(el)
            // Si hay propiedades de color que usan LAB, convertirlas a RGB estándar
            if (style.color && style.color.includes('lab')) {
              el.style.color = '#333333' // Color de respaldo seguro
            }
            if (style.backgroundColor && style.backgroundColor.includes('lab')) {
              el.style.backgroundColor = 'transparent'
            }
          })
        }
      }

      // Capturar cada contenedor con html2canvas
      try {
        const captures = await Promise.all(
          containers.map(container => html2canvas(container, html2canvasOptions))
        )

        // Calcular dimensiones y crear canvas combinado
        const width = Math.max(...captures.map(c => c.width))
        const totalHeight = captures.reduce((sum, c) => sum + c.height, 0)

        const combo = document.createElement('canvas')
        combo.width = width
        combo.height = totalHeight
        const ctx = combo.getContext('2d')

        // Dibujar capturas
        let offsetY = 0
        for (const capture of captures) {
          ctx.drawImage(capture, 0, offsetY)
          offsetY += capture.height
        }

        // Descargar imagen
        const dataUrl = combo.toDataURL('image/png')
        this.downloadImage(dataUrl, filename)
      } catch (error) {
        console.warn('html2canvas failed, falling back to canvas-only capture:', error)
        return this.fallbackToCanvasOnly(containers, filename)
      }
    } catch (error) {
      console.error('Error capturing charts:', error)
    }
  }

  // Función fallback que captura solo los elementos canvas dentro de los contenedores
  fallbackToCanvasOnly(containers, filename) {
    try {
      // Extraer todos los canvas de los contenedores
      const canvases = []
      containers.forEach(container => {
        const containerCanvases = container.querySelectorAll('canvas')
        containerCanvases.forEach(canvas => canvases.push(canvas))
      })

      if (canvases.length === 0) {
        return
      }

      // Calcular dimensiones
      const width = Math.max(...canvases.map(c => c.width))
      const height = canvases.reduce((sum, c) => sum + c.height, 0)

      // Crear canvas combinado
      const combo = document.createElement('canvas')
      combo.width = width
      combo.height = height
      const ctx = combo.getContext('2d')

      // Dibujar cada canvas
      let offsetY = 0
      for (const canvas of canvases) {
        ctx.drawImage(canvas, 0, offsetY)
        offsetY += canvas.height
      }

      // Descargar imagen
      const dataUrl = combo.toDataURL('image/png')
      this.downloadImage(dataUrl, filename)
    } catch (error) {
      console.error('Fallback capture failed:', error)
    }
  }

  // Función auxiliar para descargar la imagen
  downloadImage(dataUrl, filename) {
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }

  // Esta herramienta no necesita eventos persistentes
  _subscribeEvents() {}
  _unsubscribeEvents() {}
  async _loadSavedData() {}
  async _saveData() {}
}
