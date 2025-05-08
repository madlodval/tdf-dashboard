export class Repository {
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

  async replaceInto (data, uniqueKeys, tableName = undefined) {
    return this.#db.replaceInto(tableName || this.tableName, data, uniqueKeys)
  }

  async transaction (callback) {
    return this.#db.transaction(callback.bind(null, this.#db))
  }

  quote (string) {
    return this.#db.quote(string)
  }
}
