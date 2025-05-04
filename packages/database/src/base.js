export class DatabaseConnection {
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

export class DatabaseConnectionError extends Error {
  constructor (message) {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

export class DatabaseQueryError extends Error {
  constructor (message) {
    super(message)
    this.name = 'DatabaseQueryError'
  }
}
