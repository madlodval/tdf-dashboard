import { BaseRepository } from '@tdf/database'

export class ExchangeRepository extends BaseRepository {
  constructor (db) {
    super(db, 'exchanges')
  }

  async findIdByNames (...exchangeNames) {
    const results = new Map()
    if (Array.isArray(exchangeNames) &&
      exchangeNames.length === 1 &&
      Array.isArray(exchangeNames[0])
    ) {
      exchangeNames = exchangeNames[0]
    }
    const placeholders = this.toParams(exchangeNames)
    const sql = `SELECT id, name FROM ${this.quotedTableName} WHERE name IN (${placeholders})`
    const [rows] = await this.query(sql, exchangeNames)
    const foundMap = new Map(rows.map(row => [row.name, parseInt(row.id)]))
    for (const name of exchangeNames) {
      const id = foundMap.get(name) || null
      results.set(name, id)
    }
    return results
  }

  async findIdByCode (code) {
    const [rows] = await this.query(`SELECT id FROM ${this.quotedTableName} WHERE code = ?`, [code])
    if (rows.length === 0) return null
    return rows[0].id
  }

  async findAll () {
    const [rows] = await this.query(`SELECT id, name FROM ${this.quotedTableName}`, [])
    const exchanges = new Map()
    for (const row of rows) {
      exchanges.set(row.id, row.name)
    }
    return exchanges
  }

  async findNamesByIds (...exchangeIds) {
    const results = new Map()
    if (Array.isArray(exchangeIds) &&
      exchangeIds.length === 1 &&
      Array.isArray(exchangeIds[0])
    ) {
      exchangeIds = exchangeIds[0]
    }
    if (!exchangeIds.length) return results
    const placeholders = this.toParams(exchangeIds)
    const sql = `SELECT id, name FROM ${this.quotedTableName} WHERE id IN (${placeholders})`
    const [rows] = await this.query(sql, exchangeIds)
    const foundMap = new Map(rows.map(row => [parseInt(row.id), row.name]))
    for (const id of exchangeIds) {
      const name = foundMap.get(parseInt(id)) || null
      results.set(id, name)
    }
    return results
  }
}
