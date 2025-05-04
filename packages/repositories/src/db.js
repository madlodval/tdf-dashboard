class DatabaseConnectionError extends Error {
  constructor (message) {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

class DatabaseQueryError extends Error {
  constructor (message) {
    super(message)
    this.name = 'DatabaseQueryError'
  }
}

class DatabaseConnection {
  async connect () { throw new DatabaseConnectionError('Method connect not implemented or connection failure') }
  async query (sql, params) { throw new DatabaseQueryError('Method query not implemented or query failure') }
  async execute (sql, params) { throw new DatabaseQueryError('Method execute not implemented or query failure') }
  async disconnect () { throw new DatabaseConnectionError('Method disconnect not implemented or disconnect failure') }

  async ensureConnected () { throw new DatabaseConnectionError('Method ensureConnected not implemented or connection failure') }

  async replaceInto (table, data, uniqueKeys) {
    throw new DatabaseQueryError('Method replaceInto not implemented or query failure')
  }

  async transaction (callback) {
    throw new DatabaseQueryError('Method transaction not implemented or transaction failure')
  }

  async call (procedureName, ...args) {
    throw new DatabaseQueryError('Method call not implemented or failure')
  }

  toParams (values) {
    throw new DatabaseQueryError('Method call not implemented or failure')
  }
}

class MySQLConnection extends DatabaseConnection {
  constructor (config) {
    super()
    this.config = config
    this.connection = null
  }

  quoteField (field) {
    return `\`${field}\``
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
      const sql = `CALL ${this.quoteField(procedureName)}${placeholders}`
      return await this.execute(sql, args) // Pasar los argumentos como array
    } catch (err) {
      throw new DatabaseQueryError(`MySQL call failed: ${err.message}`)
    }
  }

  #insertIntoSql (table, columns, select, uniqueKeys) {
    const quotedCols = columns.map(col => this.quoteField(col)).join(', ')
    const updateColumns = columns.filter(col => !uniqueKeys.includes(col))
    const quotedUpdateColumns = updateColumns.map(col => {
      return `${this.quoteField(col)} = VALUES(${this.quoteField(col)})`
    }).join(', ')
    return `INSERT INTO ${this.quoteField(table)} (${quotedCols}) ${select} ON DUPLICATE KEY UPDATE ${quotedUpdateColumns}`
  }

  async replaceInto (table, data, uniqueKeys = []) {
    const columns = Object.keys(data)
    const placeholders = columns.map(() => '?').join(', ')
    const select = `VALUES (${placeholders})`
    const sql = this.#insertIntoSql(table, columns, select, uniqueKeys)
    const values = Object.values(data)
    try {
      return await this.execute(sql, values)
    } catch (err) {
      throw new DatabaseQueryError(`MySQL execute failed: ${err.message}`)
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
      throw new DatabaseQueryError(`MySQL transaction failed: ${err.message}`)
    }
  }
}

class PostgreSQLConnection extends DatabaseConnection {
  constructor (config) {
    super()
    this.config = config
    this.client = null
  }

  quoteField (field) {
    return `"${field}"`
  }

  toParams (values) {
    // Aplanar si se pasa un único array como argumento
    if (
      Array.isArray(values) &&
      values.length === 1 &&
      Array.isArray(values[0])
    ) {
      values = values[0]
    }

    // Validación: array vacío
    if (Array.isArray(values)) {
      if (values.length === 0) {
        throw new Error('Cannot generate placeholders for an empty array')
      }
      return values.map((_, i) => `$${i + 1}`).join(',')
    }

    // Caso: Map -> extraer claves como valores
    if (values instanceof Map) {
      const keys = Array.from(values.keys())
      if (keys.length === 0) {
        throw new Error('Cannot generate placeholders for an empty Map')
      }
      return keys.map((_, i) => `$${i + 1}`).join(',')
    }

    // Caso: objeto plano -> extraer claves como valores
    if (typeof values === 'object' && values !== null) {
      const keys = Object.keys(values)
      if (keys.length === 0) {
        throw new Error('Cannot generate placeholders for an empty object')
      }
      return keys.map((_, i) => `$${i + 1}`).join(',')
    }

    // Caso: tipo no soportado
    throw new Error(`Unsupported parameter type: ${typeof values}`)
  }

  async ensureConnected () {
    if (this.client === null) {
      await this.connect()
    }
    if (this.client === null) {
      throw new DatabaseConnectionError('Failed to establish database connection.')
    }
  }

  async connect () {
    const { Pool } = await import('pg')
    this.pool = new Pool(this.config)
    this.client = await this.pool.connect()
  }

  async query (sql, params) {
    try {
      // PostgreSQL uses $1, $2, etc. instead of ?, convert the SQL
      const pgSql = this.#replacePlaceholders(sql)
      const result = await this.client.query(pgSql, params)
      return [result.rows, result.fields]
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL query failed: ${err.message}`)
    }
  }

  async execute (sql, params) {
    try {
      // PostgreSQL uses $1, $2, etc. instead of ?, convert the SQL
      const pgSql = this.#replacePlaceholders(sql)
      return await this.client.query(pgSql, params)
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL execute failed: ${err.message}`)
    }
  }

  #insertIntoSql (table, columns, select, uniqueKeys) {
    const quotedCols = columns.map(col => this.quoteField(col)).join(', ')

    // Si no hay uniqueKeys, podríamos usar DO NOTHING, pero por coherencia con MySQL lanzamos error
    if (!uniqueKeys || uniqueKeys.length === 0) {
      throw new DatabaseQueryError('PostgreSQL requires at least one unique key to perform an upsert')
    }

    const conflictClause = `ON CONFLICT (${uniqueKeys.map(key => this.quoteField(key)).join(', ')})`

    // Construir la cláusula SET para actualización
    const updateColumns = columns.filter(col => !uniqueKeys.includes(col))

    if (updateColumns.length === 0) {
      return `INSERT INTO ${this.quoteField(table)} (${quotedCols}) ${select} ${conflictClause} DO NOTHING`
    } else {
      const updateSet = updateColumns
        .map(col => `${this.quoteField(col)} = EXCLUDED.${this.quoteField(col)}`)
        .join(', ')

      return `INSERT INTO ${this.quoteField(table)} (${quotedCols}) ${select} ${conflictClause} DO UPDATE SET ${updateSet}`
    }
  }

  async replaceInto (table, data, uniqueKeys = []) {
    if (!uniqueKeys.length) {
      throw new DatabaseQueryError('PostgreSQL requires at least one unique key to perform an upsert')
    }

    const columns = Object.keys(data)
    const values = Object.values(data)

    // PostgreSQL usa $1, $2, etc. en lugar de ?
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const select = `VALUES (${placeholders})`

    const sql = this.#insertIntoSql(table, columns, select, uniqueKeys)

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

  async transaction (callback) {
    try {
      await this.ensureConnected()
      await this.client.query('BEGIN')

      try {
        // eslint-disable-next-line n/no-callback-literal
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
    return sql.replace(/\?/g, (_, i) => `$${i + 1}`)
  }
}

// Factory to create the appropriate connection
export class DatabaseFactory {
  static instance = null
  static createConnection ({ connection, ...config }) {
    switch (connection.toLowerCase()) {
      case 'mysql':
        return new MySQLConnection(config)
      case 'postgresql':
      case 'postgres':
        return new PostgreSQLConnection(config)
      default:
        throw new DatabaseConnectionError(`Unsupported database type: ${connection}`)
    }
  }
}

export class BaseRepository {
  #db
  #tableName

  constructor (db, tableName) {
    this.#db = db
    this.#tableName = tableName
  }

  get db () {
    return this.#db
  }

  get tableName () {
    return this.#tableName
  }

  get quotedTableName () {
    return this.quote(this.tableName)
  }

  async query (sql, params = []) {
    return this.#db.query(sql, params)
  }

  async execute (sql, params = []) {
    return this.#db.execute(sql, params)
  }

  async call (procedureName, ...args) {
    return this.#db.call(procedureName, ...args)
  }

  toParams (...args) {
    return this.#db.toParams(args)
  }

  async replaceInto (data, uniqueKeys) {
    return this.#db.replaceInto(this.tableName, data, uniqueKeys)
  }

  async transaction (callback) {
    return this.#db.transaction(callback.bind(null, this.#db))
  }

  quote (field) {
    return this.#db.quoteField(field)
  }
}
