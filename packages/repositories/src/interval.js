import { Repository } from '@tdf/database'

// Interval base in seconds for 5 minutes - assuming this constant is still needed here or imported

export const INTERVAL_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '6h': 21600,
  '12h': 43200,
  '1d': 86400
}

export const INTERVAL_BASE = INTERVAL_SECONDS['5m']

export function isIntervalBase (seconds) {
  return seconds === INTERVAL_BASE
}

export class IntervalRepository extends Repository {
  static isBase (seconds) {
    return isIntervalBase(seconds)
  }

  static isDaily (seconds) {
    return seconds === INTERVAL_SECONDS['1d']
  }

  constructor (db) {
    super(db, 'intervals')
  }

  async findIdByName (name) {
    const [rows] = await this.query(`SELECT id FROM ${this.quotedTableName} WHERE name = ?`, [name])
    if (rows.length === 0) return null
    return rows[0].id
  }

  async findByName (name) {
    const [rows] = await this.query(`SELECT id, seconds FROM ${this.quotedTableName} WHERE name = ?`, [name])
    if (rows.length === 0) return { id: 0, seconds: 0 }
    return rows[0]
  }

  async findSecondsByName (name) {
    const [rows] = await this.query(`SELECT seconds FROM ${this.quotedTableName} WHERE name = ?`, [name])
    if (rows.length === 0) return null
    return rows[0].seconds
  }

  async findAll () {
    const [rows] = await this.query(`SELECT id, name, seconds FROM ${this.quotedTableName} WHERE seconds != ? ORDER BY seconds ASC`, [INTERVAL_BASE])
    return rows.map(row => ({
      id: +row.id,
      name: row.name,
      seconds: +row.seconds
    }))
  }
}
