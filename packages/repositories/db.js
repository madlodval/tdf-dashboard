class DatabaseConnectionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

class DatabaseQueryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DatabaseQueryError'
  }
}

class DatabaseConnection {
  async connect() { throw new DatabaseConnectionError('Method connect not implemented or connection failure') }
  async query(sql, params) { throw new DatabaseQueryError('Method query not implemented or query failure') }
  async execute(sql, params) { throw new DatabaseQueryError('Method execute not implemented or query failure') }
  async disconnect() { throw new DatabaseConnectionError('Method disconnect not implemented or disconnect failure') }

  async ensureConnected() { throw new DatabaseConnectionError('Method ensureConnected not implemented or connection failure') }

  async replaceInto(table, data, uniqueKeys) {
    throw new DatabaseQueryError('Method replaceInto not implemented or query failure')
  }
}

class MySQLConnection extends DatabaseConnection {
  constructor(config) {
    super()
    this.config = config
    this.connection = null
  }

  quoteField(field) {
    return `\`${field}\``
  }

  async connect() {
    const mysql = await import('mysql2/promise')
    this.connection = await mysql.createConnection(this.config)
  }

  async query(sql, params) {
    try {
      return await this.connection.query(sql, params)
    } catch (err) {
      throw new DatabaseQueryError(`MySQL query failed: ${err.message}`)
    }
  }

  async execute(sql, params) {
    try {
      return await this.connection.execute(sql, params)
    } catch (err) {
      throw new DatabaseQueryError(`MySQL execute failed: ${err.message}`)
    }
  }

  async replaceInto(table, data, uniqueKeys = []) {
    const columns = Object.keys(data)
    const placeholders = columns.map(() => '?').join(', ')
    const values = Object.values(data)
    const quotedCols = columns.map(col => this.quoteField(col)).join(', ')
    const sql = `REPLACE INTO ${this.quoteField(table)} (${quotedCols}) VALUES (${placeholders})`
    try {
      return await this.connection.execute(sql, values)
    } catch (err) {
      throw new DatabaseQueryError(`MySQL execute failed: ${err.message}`)
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end()
    }
  }

  async ensureConnected() {
    if (this.connection === null) {
      await this.connect()
    }
    if (this.connection === null) {
      throw new DatabaseConnectionError('Failed to establish database connection.')
    }
  }
}

class PostgreSQLConnection extends DatabaseConnection {
  constructor(config) {
    super()
    this.config = config
    this.client = null
  }

  quoteField(field) {
    return `"${field}"`
  }

  async ensureConnected() {
    if (this.client === null) {
      await this.connect()
    }
    if (this.client === null) {
      throw new DatabaseConnectionError('Failed to establish database connection.')
    }
  }

  async connect() {
    const { Pool } = await import('pg')
    this.pool = new Pool(this.config)
    this.client = await this.pool.connect()
  }

  async query(sql, params) {
    try {
      // PostgreSQL uses $1, $2, etc. instead of ?, convert the SQL
      const pgSql = sql.replace(/\?/g, (_, i) => `$${i + 1}`)
      const result = await this.client.query(pgSql, params)
      return [result.rows, result.fields]
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL query failed: ${err.message}`)
    }
  }

  async execute(sql, params) {
    try {
      // PostgreSQL uses $1, $2, etc. instead of ?, convert the SQL
      const pgSql = sql.replace(/\?/g, (_, i) => `$${i + 1}`)
      return await this.client.query(pgSql, params)
    } catch (err) {
      throw new DatabaseQueryError(`PostgreSQL execute failed: ${err.message}`)
    }
  }

  async replaceInto(table, data, uniqueKeys = []) {
    if (!uniqueKeys.length) {
      throw new DatabaseQueryError('PostgreSQL requires at least one unique key to perform an upsert')
    }

    const columns = Object.keys(data)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const values = Object.values(data)

    // Build the ON CONFLICT clause
    const conflictKey = uniqueKeys.join(', ')

    // Build the SET clause for the update
    const updateSet = columns
      .filter(col => !uniqueKeys.includes(col)) // Exclude unique keys from the SET
      .map((col, i) => `${this.quoteField(col)} = $${columns.length + i + 1}`)
      .join(', ')

    // Additional values for the UPDATE
    const updateValues = values.filter((_, i) => !uniqueKeys.includes(columns[i]))

    const sql = `
      INSERT INTO ${this.quoteField(table)} (${columns.map(col => this.quoteField(col)).join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (${conflictKey})
      ${updateSet ? `DO UPDATE SET ${updateSet}` : 'DO NOTHING'}
    `

    return this.execute(sql, updateSet ? [...values, ...updateValues] : values)
  }

  async disconnect() {
    if (this.client) {
      this.client.release()
    }
    if (this.pool) {
      await this.pool.end()
    }
  }
}

// Factory to create the appropriate connection
export class DatabaseFactory {
  static instance = null
  static createConnection({ connection, ...config }) {
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

  constructor(db) {
    this.#db = db
  }

  async query(sql, params) {
    await this.#db.ensureConnected()
    return this.#db.query(sql, params)
  }

  async execute(sql, params) {
    await this.#db.ensureConnected()
    return this.#db.execute(sql, params)
  }

  async replaceInto(table, data, uniqueKeys = []) {
    await this.#db.ensureConnected()
    return this.#db.replaceInto(table, data, uniqueKeys)
  }

  quote(field) {
    return this.#db.quoteField(field)
  }
}
