export class ChartToolsManager {
  constructor (chartInstance, stateManager, toolsConfig = {}) {
    this.chart = chartInstance
    this.stateManager = stateManager
    this.symbol = null
    this.toolDefinitions = new Map()
    this.instantiatedTools = new Map()
    this.buttonHandlers = new Map()
    this.tools(toolsConfig)
  }

  async setSymbol (symbol) {
    this.symbol = symbol
    this.instantiatedTools = new Map()
    this.toolDefinitions.keys().forEach((name) => {
      this.getTool(name)
    })
    await this.loadSavedData()
    return this
  }

  addTool (name, toolClass, config = {}) {
    if (this.instantiatedTools.has(name)) {
      const oldToolInstance = this.instantiatedTools.get(name)
      if (typeof oldToolInstance.destroy === 'function') {
        oldToolInstance.destroy()
      }
      this.instantiatedTools.delete(name)
    }
    this.toolDefinitions.set(name, { toolClass, config })
    return this
  }

  getTool (name) {
    if (this.instantiatedTools.has(name)) {
      return this.instantiatedTools.get(name)
    }

    if (this.toolDefinitions.has(name)) {
      const definition = this.toolDefinitions.get(name)

      if (!this.chart) {
        return undefined
      }

      try {
        // @ts-ignore
        // eslint-disable-next-line
        const toolInstance = new definition.toolClass(
          this.chart,
          this.symbol,
          this.stateManager,
          definition.config
        )
        this.instantiatedTools.set(name, toolInstance)
        return toolInstance
      } catch (error) {
        return undefined
      }
    }

    return undefined
  }

  enableTool (name) {
    const tool = this.getTool(name)
    if (tool && typeof tool.enable === 'function') {
      tool.enable()
    } else if (tool && typeof tool.enable !== 'function') {
      // Tool does not have an enable() method.
    }
    return this
  }

  disableTool (name) {
    const tool = this.getTool(name)
    if (tool && typeof tool.disable === 'function') {
      tool.disable()
    } else if (tool && typeof tool.disable !== 'function') {
      // Tool does not have a disable() method.
    }
    return this
  }

  toggleTool (name) {
    const tool = this.getTool(name)
    if (tool && typeof tool.toggle === 'function') {
      tool.toggle()
    } else if (tool && typeof tool.toggle !== 'function') {
      // Tool does not have a toggle() method.
    }
    return this
  }

  executeTool (name, ...args) {
    const tool = this.getTool(name)
    if (tool && typeof tool.execute === 'function') {
      tool.execute(...args)
    } else if (tool && typeof tool.execute !== 'function') {
      // Tool does not have an execute() method.
    }
    return this
  }

  tool (name, toolClass, buttonId, action = 'toggle', config = {}) {
    // Agregar la herramienta
    this.addTool(name, toolClass, config)

    // Hacer el binding del botón
    this.bindButton(buttonId, name, action)

    return this
  }

  tools (toolsConfig) {
    Object.entries(toolsConfig).forEach(([name, toolConfig]) => {
      const {
        class: toolClass,
        buttonId,
        config = {}
      } = toolConfig

      this.tool(name, toolClass, buttonId || name, 'execute', config)
    })

    return this
  }

  bindButton (buttonId, toolName, action = 'toggle') {
    const button = document.getElementById(buttonId)
    if (!button) {
      return this
    }

    if (this.buttonHandlers.has(buttonId)) {
      const oldHandler = this.buttonHandlers.get(buttonId)
      button.removeEventListener('click', oldHandler)
      this.buttonHandlers.delete(buttonId)
    }

    const handler = (event) => {
      event.preventDefault()
      const tool = this.getTool(toolName)

      if (!tool) {
        return
      }

      let isActive = false

      if (action === 'toggle') {
        if (typeof tool.toggle === 'function') {
          tool.toggle()
          isActive = tool.isEnabled === true || (typeof tool.isActive === 'function' && tool.isActive())
        } else {
          // Tool does not have a toggle() method.
        }
      } else if (action === 'execute') {
        if (typeof tool.execute === 'function') {
          tool.execute(this)
          isActive = false
        } else {
          // Tool does not have an execute() method.
        }
      } else {
        // Unknown action.
        return
      }

      if (button.dataset && Object.hasOwn(button.dataset, 'active')) {
        isActive = tool.isEnabled === true || (typeof tool.isActive === 'function' && tool.isActive())
        button.dataset.active = isActive ? 'true' : 'false'
      }
    }

    button.addEventListener('click', handler)
    this.buttonHandlers.set(buttonId, handler)

    return this
  }

  reset () {
    this.instantiatedTools.forEach((tool) => {
      if (typeof tool.reset === 'function') {
        tool.reset()
      }
    })
    return this
  }

  async loadSavedData () {
    await Promise.all(
      this.instantiatedTools.values().map(tool => {
        try {
          return tool.loadSavedData()
        } catch (e) {
          return undefined
        }
      })
    )
    return this
  }

  destroy () {
    this.buttonHandlers.forEach((handler, buttonId) => {
      const button = document.getElementById(buttonId)
      if (button) {
        button.removeEventListener('click', handler)
        if (button.dataset) {
          button.dataset.active = 'false'
        }
      }
    })
    this.buttonHandlers.clear()

    this.instantiatedTools.forEach((tool) => {
      if (typeof tool.destroy === 'function') {
        tool.destroy()
      }
    })
    this.instantiatedTools.clear()
    this.toolDefinitions.clear()

    this.chart = null
    this.stateManager = null
    this.symbol = null
  }
}
