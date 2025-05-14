import { DatabaseConnectionError, DatabaseQueryError, DatabaseConnection } from './base.js'

export class MySQLConnection extends DatabaseConnection {
  constructor (config) {
    super()
    this.config = config
    this.connection = null
  }

  quote (string) {
    if (string.length >= 2 && string[0] === '`' && string[string.length - 1] === '`') {
      return string
    }
    return `\`${string}\``
  }

  toParams (values) {
    if (
      Array.isArray(values) &&
      values.length === 1 &&
      Array.isArray(values[0])
    ) {
      values = values[0]
    }

    if (Array.isArray(values)) {
      if (values.length === 0) {
        throw new Error('Cannot generate placeholders for an empty array')
      }
      return values.map(() => '?').join(',')
    }

    if (values instanceof Map) {
      const keys = Array.from(values.keys())
      if (keys.length === 0) {
        throw new Error('Cannot generate placeholders for an empty Map')
      }
      return keys.map(() => '?').join(',')
    }

    if (typeof values === 'object' && values !== null) {
      const keys = Object.keys(values)
      if (keys.length === 0) {
        throw new Error('Cannot generate placeholders for an empty object')
      }
      return keys.map(() => '?').join(',')
    }

    throw new Error(`Unsupported parameter type: ${typeof values}`)
  }

  async connect () {
    const mysql = await import('mysql2/promise')
    this.connection = await mysql.createConnection(this.config)
  }

  async query (sql, params) {
    try {
      return await this.connection.query(sql, params)
    } catch (err) {
      throw new DatabaseQueryError(`MySQL query failed: ${err.message}`)
    }
  }

  async execute (sql, params) {
    try {
      return await this.connection.execute(sql, params)
    } catch (err) {
      throw new DatabaseQueryError(`MySQL execute failed: ${err.message}`)
    }
  }

  async call (procedureName, ...args) {
    try {
      const placeholders = `(${Array(args.length).fill('?').join(', ')})`
      const sql = `CALL ${this.quote(procedureName)}${placeholders}`
      return await this.execute(sql, args) // Pasar los argumentos como array
    } catch (err) {
      throw new DatabaseQueryError(`MySQL call failed: ${err.message}`)
    }
  }

  #insertIntoSql (table, columns, select, uniqueKeys) {
    const quotedCols = columns.map(col => this.quote(col)).join(', ')
    const updateColumns = columns.filter(col => !uniqueKeys.includes(col))
    const quotedUpdateColumns = updateColumns.map(col => {
      return `${this.quote(col)} = VALUES(${this.quote(col)})`
    }).join(', ')
    return `INSERT INTO ${this.quote(table)} (${quotedCols}) ${select} ON DUPLICATE KEY UPDATE ${quotedUpdateColumns}`
  }

  async replaceInto(table, data, uniqueKeys = []) {
    if (!Array.isArray(data)) {
      data = [data]
    }
  
    if (data.length === 0) return
  
    const columns = Object.keys(data[0])
    const totalColumns = columns.length
    const safeBatchSize = Math.floor(65535 / totalColumns)
  
    for (let i = 0; i < data.length; i += safeBatchSize) {
      const batch = data.slice(i, i + safeBatchSize)
      const rowPlaceholders = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ')
      const select = `VALUES ${rowPlaceholders}`
      const sql = this.#insertIntoSql(table, columns, select, uniqueKeys)
      const values = batch.flatMap(item => Object.values(item))
      try {
        await this.execute(sql, values)
      } catch (err) {
        throw new DatabaseQueryError(`MySQL execute failed: ${err.message}`)
      }
    }
  }

  async disconnect () {
    if (this.connection) {
      await this.connection.end()
    }
  }

  async ensureConnected () {
    if (this.connection === null) {
      await this.connect()
    }
    if (this.connection === null) {
      throw new DatabaseConnectionError('Failed to establish database connection.')
    }
  }

  async transaction (callback) {
    try {
      await this.ensureConnected()
      await this.connection.beginTransaction()

      try {
        // eslint-disable-next-line n/no-callback-literal
        const result = await callback(this)
        await this.connection.commit()
        return result
      } catch (err) {
        await this.connection.rollback()
        throw err
      }
    } catch (err) {
      console.log(err)
      throw new DatabaseQueryError(`MySQL transaction failed: ${err.message}`)
    }
  }
}
