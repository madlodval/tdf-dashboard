// Unified storage class for chart symbol, interval, and lines
export class ChartState {
  constructor(dbName = 'tdf-charts', linesStore = 'lines', metaStore = 'meta') {
    this.dbName = dbName
    this.linesStore = linesStore
    this.metaStore = metaStore
    this.db = null
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = (event) => reject('IndexedDB error:', event)
      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Crear stores si no existen
        if (!db.objectStoreNames.contains(this.linesStore)) {
          const linesStore = db.createObjectStore(this.linesStore, { keyPath: ['symbol', 'id'] })
          // Crear índice compuesto para búsquedas por symbol y type
          linesStore.createIndex('symbol_type', ['symbol', 'type'], { unique: false })
        }
        
        if (!db.objectStoreNames.contains(this.metaStore)) {
          db.createObjectStore(this.metaStore, { keyPath: 'key' })
        }
      }
    })
  }

  async saveMeta({ symbol, interval }) {
    if (!this.db) await this.init()
    const tx = this.db.transaction(this.metaStore, 'readwrite')
    const store = tx.objectStore(this.metaStore)
    
    if (symbol) store.put({ key: 'symbol', value: symbol })
    if (interval) store.put({ key: 'interval', value: interval })
    
    await tx.complete
    
    const currentState = {}
    if (symbol) currentState.symbol = symbol
    if (interval) currentState.interval = interval
    
    const meta = await this.loadMeta()
    return { ...meta, ...currentState }
  }

  async loadMeta({ symbol = 'BTC', interval = '1D' } = {}) {
    if (!this.db) await this.init()
    
    // Primero obtenemos los valores guardados
    const tx = this.db.transaction(this.metaStore, 'readonly')
    const store = tx.objectStore(this.metaStore)
    const keys = ['symbol', 'interval']

    const results = await Promise.all(
      keys.map(key =>
        new Promise((resolve, reject) => {
          const req = store.get(key)
          req.onsuccess = () => resolve({ key, value: req.result?.value })
          req.onerror = reject
        })
      )
    )

    // Construir el objeto de resultado con valores por defecto
    const savedValues = results.reduce((acc, { key, value }) => {
      if (value !== undefined) acc[key] = value
      return acc
    }, {})

    const out = {
      symbol: savedValues.symbol || symbol,
      interval: savedValues.interval || interval
    }

    // Si faltan valores, los guardamos
    const missingValues = []
    if (savedValues.symbol === undefined) {
      missingValues.push({ key: 'symbol', value: symbol })
    }
    if (savedValues.interval === undefined) {
      missingValues.push({ key: 'interval', value: interval })
    }

    if (missingValues.length > 0) {
      await this.saveMeta({
        symbol: out.symbol,
        interval: out.interval
      })
    }

    return out
  }

  async saveLines({ symbol, hLines, vLines, type, lines }) {
    if (!this.db) await this.init()

    if (type && lines.length === 0) {
      await this.deleteLinesByType(symbol, type)
      return
    }
    
    const tx = this.db.transaction(this.linesStore, 'readwrite')
    const store = tx.objectStore(this.linesStore)

    // Limpiar usando la misma transacción
    const range = IDBKeyRange.bound([symbol, ''], [symbol, '\uffff'])
    await new Promise((resolve, reject) => {
      const deleteRequest = store.delete(range)
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = (event) => reject('Clear error:', event)
    })

    // Agregar nuevas líneas usando la misma transacción
    const operations = []

    if (type) {
      lines.forEach(line => {
        operations.push(new Promise((resolve, reject) => {
          const request = store.put({ 
            symbol, 
            type,
            ...line
          })
          request.onsuccess = () => resolve()
          request.onerror = reject
        }))
      })
    }
    
    if (hLines) {
      hLines.forEach(line => {
        operations.push(new Promise((resolve, reject) => {
          const request = store.put({ 
            symbol, 
            id: line.type + '-' + line.id, 
            type: line.type, 
            price: line.price 
          })
          request.onsuccess = () => resolve()
          request.onerror = reject
        }))
      })
    }

    if (vLines) {
      vLines.forEach(line => {
        operations.push(new Promise((resolve, reject) => {
          const request = store.put({ 
            symbol, 
            id: line.type  + '-' + line.id, 
            type: line.type, 
            time: line.time 
          })
          request.onsuccess = () => resolve()
          request.onerror = reject
        }))
      })
    }

    await Promise.all(operations)
    return tx.complete
  }

  async loadLines(symbol, type) {
    if (!this.db) await this.init()
    const tx = this.db.transaction(this.linesStore, 'readonly')
    const store = tx.objectStore(this.linesStore)
    
    // Si se proporciona type, usar el índice compuesto para mejor rendimiento
    if (type) {
      const index = store.index('symbol_type')
      const range = IDBKeyRange.only([symbol, type])
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(range)
        request.onsuccess = () => resolve(request.result)
        request.onerror = (event) => reject('Load error:', event)
      })
    }
    
    // Si no se proporciona type, filtrar solo por symbol
    const range = IDBKeyRange.bound(
      [symbol, ''],
      [symbol, '\uffff']
    )
    return new Promise((resolve, reject) => {
      const request = store.getAll(range)
      request.onsuccess = () => resolve(request.result)
      request.onerror = (event) => reject('Load error:', event)
    })
  }

  async clearLines(symbol, existingTx = null) {
    if (!this.db) await this.init()
    
    const tx = existingTx || this.db.transaction(this.linesStore, 'readwrite')
    const store = tx.objectStore(this.linesStore)
    const range = IDBKeyRange.bound([symbol, ''], [symbol, '\uffff'])
    
    return new Promise((resolve, reject) => {
      const request = store.delete(range)
      request.onsuccess = () => resolve()
      request.onerror = (event) => reject('Clear error:', event)
    })
  }

  async deleteLinesByType(symbol, type) {
    if (!this.db) await this.init()
    const tx = this.db.transaction(this.linesStore, 'readwrite')
    const store = tx.objectStore(this.linesStore)
    const index = store.index('symbol_type')
    const range = IDBKeyRange.only([symbol, type])
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range)
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = (event) => reject('Delete error:', event)
    })
  }  
}

export const chartState = new ChartState()