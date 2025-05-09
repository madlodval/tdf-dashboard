import { DatabaseConnectionError, DatabaseQueryError, DatabaseConnection } from './base.js'

export class PostgreSQLConnection extends DatabaseConnection {
  constructor (config) {
    super()
    this.config = config
    this.client = null
    this.pool = null
  }

  quote (string) {
    if (string.length >= 2 && string[0] === '"' && string[string.length - 1] === '"') {
      return string
    }
    return `"${string}"`
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
      return values.map((_, i) => `$${i + 1}`).join(',')
    }

    if (values instanceof Map) {
      const keys = Array.from(values.keys())
      if (keys.length === 0) {
        throw new Error('Cannot generate placeholders for an empty Map')
      }
      return keys.map((_, i) => `$${i + 1}`).join(',')
    }

    if (typeof values === 'object' && values !== null) {
      const keys = Object.keys(values)
      if (keys.length === 0) {
        throw new Error('Cannot generate placeholders for an empty object')
      }
      return keys.map((_, i) => `$${i + 1}`).join(',')
    }

    throw new Error(`Unsupported parameter type: ${typeof values}`)
  }

  async connect () {
    const { Pool } = await import('pg')
    this.pool = new Pool(this.config)
    this.client = await this.pool.connect()
  }

  async query (sql, params) {
    try {
      const pgSql = this.#replacePlaceholders(sql)
      const result = await this.client.query(pgSql, params)
      return [result.rows, result.fields]
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL query failed: ${err.message}`)
    }
  }

  async execute (sql, params) {
    try {
      const pgSql = this.#replacePlaceholders(sql)
      return await this.client.query(pgSql, params)
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL execute failed: ${err.message}`)
    }
  }

  async call (procedureName, ...args) {
    try {
      const placeholders = `(${Array(args.length).fill('$1').join(', ')})`
      const sql = `CALL ${this.quote(procedureName)}${placeholders}`
      return await this.execute(sql, args)
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL call failed: ${err.message}`)
    }
  }

  #insertIntoSql (table, columns, select, uniqueKeys) {
    const quotedCols = columns.map(col => this.quote(col)).join(', ')
    const updateColumns = columns.filter(col => !uniqueKeys.includes(col))
    const quotedUpdateColumns = updateColumns.map(col => {
      return `${this.quote(col)} = EXCLUDED.${this.quote(col)}`
    }).join(', ')

    if (!uniqueKeys || uniqueKeys.length === 0) {
      throw new DatabaseQueryError('PostgreSQL requires at least one unique key to perform an upsert')
    }

    const conflictClause = `ON CONFLICT (${uniqueKeys.map(key => this.quote(key)).join(', ')})`
    return `INSERT INTO ${this.quote(table)} (${quotedCols}) ${select} ${conflictClause} DO UPDATE SET ${quotedUpdateColumns}`
  }

  async replaceInto (table, data, uniqueKeys = []) {
    if (!Array.isArray(data)) {
      data = [data]
    }

    if (data.length === 0) return

    const columns = Object.keys(data[0])

    const rowPlaceholders = data.map((_, rowIndex) =>
      `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ')

    const select = `VALUES ${rowPlaceholders}`
    const sql = this.#insertIntoSql(table, columns, select, uniqueKeys)

    const values = data.flatMap(item => Object.values(item))

    try {
      return await this.execute(sql, values)
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL execute failed: ${err.message}`)
    }
  }

  async disconnect () {
    if (this.client) {
      this.client.release()
    }
    if (this.pool) {
      await this.pool.end()
    }
  }

  async ensureConnected () {
    if (this.client === null) {
      await this.connect()
    }
    if (this.client === null) {
      throw new DatabaseConnectionError('Failed to establish database connection.')
    }
  }

  async transaction (callback) {
    try {
      await this.ensureConnected()
      await this.client.query('BEGIN')

      try {
        const result = await callback(this)
        await this.client.query('COMMIT')
        return result
      } catch (err) {
        await this.client.query('ROLLBACK')
        throw err
      }
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL transaction failed: ${err.message}`)
    }
  }

  #replacePlaceholders (sql) {
    let counter = 1
    return sql.replace(/\?/g, () => `$${counter++}`)
  }
}
