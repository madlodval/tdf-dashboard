import { BaseRepository, DatabaseFactory } from './db.js'

export { DatabaseFactory }

// Interval base in seconds for 5 minutes
const INTERVAL_BASE = 300

export function isIntervalBase (seconds) {
  return seconds === INTERVAL_BASE
}

export class AssetRepository extends BaseRepository {
  constructor (db) {
    super(db, 'assets')
  }

  async findIdBySymbol (symbol) {
    const [rows] = await this.query(`SELECT id FROM ${this.quotedTableName} WHERE symbol = ?`, [symbol])
    if (rows.length === 0) return
    return rows[0].id
  }
}

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

export class IntervalRepository extends BaseRepository {
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

// Base class for sync repositories
class BaseSyncRepository extends BaseRepository {
  constructor (db, tableName) {
    super(db, tableName)
    this.syncTableName = `sync_${tableName}`
  }

  get quotedSyncTableName () {
    return this.quote(this.syncTableName)
  }

  get baseTableName () {
    return `base_${this.tableName}`
  }

  get quotedBaseTableName () {
    return this.quote(this.baseTableName)
  }

  async getMaxBaseTimestamp () {
    const [maxBaseTimestampRow] = await this.query(
      `SELECT MAX(timestamp) as max_ts FROM ${this.quotedBaseTableName}`
    )
    return maxBaseTimestampRow[0].max_ts ? maxBaseTimestampRow[0].max_ts : 0
  }

  async getLastTimestamp (intervalId) {
    const [rows] = await this.query(
      `SELECT timestamp FROM ${this.quotedSyncTableName} WHERE interval_id = ?`,
      [intervalId]
    )
    return rows.length > 0 && rows[0].timestamp !== null ? +rows[0].timestamp : 0
  }

  async updateLastTimestamp (intervalId, timestamp) {
    await this.execute(
      `UPDATE ${this.quotedSyncTableName} SET timestamp = ? WHERE interval_id = ?`,
      [timestamp, intervalId]
    )
  }
}

// Base class for data repositories
class BaseDataRepository extends BaseRepository {
  async save (data) {
    return this.replaceInto({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      interval_id: data.intervalId,
      timestamp: data.timestamp,
      ...this.getDataFields(data)
    }, ['exchange_id', 'asset_id', 'interval_id', 'timestamp'])
  }

  get aggregatedTableName () {
    return this.quote(`aggregated_${this.tableName}`)
  }

  async syncFromBase () {
    const syncRepo = new this.constructor.SyncRepository(this.db)
    return syncRepo.syncFromBase()
  }
}

// Specific implementation for liquidations
class LiquidationSyncRepository extends BaseSyncRepository {
  constructor (db) {
    super(db, 'liquidations')
  }

  async syncFromBase () {
    return this.transaction(async (db) => {
      const intervalRepo = new IntervalRepository(db)
      const intervals = await intervalRepo.findAll()
      let totalSynced = 0
      const maxBaseTimestamp = await this.getMaxBaseTimestamp()
      for (const interval of intervals) {
        const result = await this.call(
          'sync_liquidations_intervals',
          interval.id,
          interval.seconds,
          maxBaseTimestamp,
          INTERVAL_BASE
        )

        console.log(result)

        const affectedRows = result && result[0] && result[0].affectedRows !== undefined ? result[0].affectedRows : 0

        console.log(`Synced ${affectedRows} liquidation rows for interval ${interval.name}.`)
        totalSynced += affectedRows
      }

      return totalSynced
    })
  }
}

// Specific implementation for volume
class VolumeSyncRepository extends BaseSyncRepository {
  constructor (db) {
    super(db, 'volume')
  }

  async syncFromBase () {
    return this.transaction(async (db) => {
      const intervalRepo = new IntervalRepository(db)
      const intervals = await intervalRepo.findAll()
      let totalSynced = 0
      const maxBaseTimestamp = await this.getMaxBaseTimestamp()
      for (const interval of intervals) {
        const result = await this.call(
          'sync_volume_intervals',
          interval.id,
          interval.seconds,
          maxBaseTimestamp,
          INTERVAL_BASE
        )

        const affectedRows = result && result[0] && result[0].affectedRows !== undefined ? result[0].affectedRows : 0

        console.log(`Synced ${affectedRows} liquidation rows for interval ${interval.name}.`)
        totalSynced += affectedRows
        await this.updateLastTimestamp(interval.id, maxBaseTimestamp)
      }
      return totalSynced
    })
  }
}

// Specific implementation for liquidations
export class LiquidationRepository extends BaseDataRepository {
  static SyncRepository = LiquidationSyncRepository

  constructor (db) {
    super(db, 'liquidations')
  }

  getDataFields (data) {
    return {
      longs: data.longs,
      shorts: data.shorts
    }
  }

  async findAllAccumByAssetId (assetId, intervalId) {
    const sql = `
    SELECT
      timestamp,
      longs,
      shorts,
    FROM ${this.aggregatedTableName}
    WHERE asset_id = ? AND interval_id % ? = 0
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp,
      longs: +row.longs,
      shorts: +row.shorts
    }))
  }
}

// Specific implementation for volume
export class VolumeRepository extends BaseDataRepository {
  static SyncRepository = VolumeSyncRepository

  constructor (db) {
    super(db, 'volume')
  }

  getDataFields (data) {
    return {
      open_value: data.open,
      high_value: data.high,
      low_value: data.low,
      close_value: data.close,
      volume_value: data.volume
    }
  }

  async findAllAccumByAssetId (assetId, intervalId) {
    const sql = `
    SELECT
      timestamp,
      open,
      high,
      low,
      close,
      volume
    FROM ${this.aggregatedTableName}
    WHERE asset_id = ? AND interval_id = ?
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp,
      open: +row.open,
      high: +row.high,
      low: +row.low,
      close: +row.close,
      volume: +row.volume
    }))
  }
}

// Repositorio para datos crudos de Volumen (ej. 5 minutos)
export class VolumeBaseRepository extends BaseRepository {
  constructor (db) {
    super(db, 'base_volume')
  }

  async save (data) {
    // Guarda datos crudos de Volumen (ej. 5 minutos) en volume_base.
    return this.replaceInto({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      timestamp: data.timestamp,
      open_value: data.open,
      high_value: data.high,
      low_value: data.low,
      close_value: data.close,
      volume_value: data.volume
    }, ['exchange_id', 'asset_id', 'timestamp'])
  }

  async findAllByAssetId (assetId) {
    // Consulta todos los datos crudos de 5 minutos para un activo.
    const sql = `
      SELECT timestamp, exchange_id, open_value, high_value, low_value, close_value, volume_value
      FROM ${this.quotedTableName}
      WHERE asset_id = ?
      ORDER BY timestamp ASC
    `
    const params = [assetId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp, exchange_id: exchangeId, open_value: openValue, high_value: highValue, low_value: lowValue, close_value: closeValue, volume_value: volumeValue }) => ({
      timestamp: +timestamp,
      exchange_id: +exchangeId,
      open: +openValue,
      high: +highValue,
      low: +lowValue,
      close: +closeValue,
      volume: +volumeValue
    }))
  }

  // Método para obtener datos de 5min en un rango de tiempo específico
  async findByAssetIdAndTimeRange (assetId, startTime, endTime) {
    const sql = `
          SELECT timestamp, exchange_id, open_value, high_value, low_value, close_value, volume_value
          FROM ${this.quotedTableName}
          WHERE asset_id = ? AND timestamp >= ? AND timestamp < ?
          ORDER BY timestamp ASC
      `
    const params = [assetId, startTime, endTime]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp, exchange_id: exchangeId, open_value: openValue, high_value: highValue, low_value: lowValue, close_value: closeValue, volume_value: volumeValue }) => ({
      timestamp: +timestamp,
      exchange_id: +exchangeId,
      open: +openValue,
      high: +highValue,
      low: +lowValue,
      close: +closeValue,
      volume: +volumeValue
    }))
  }
}

// Repositorio para datos crudos de Liquidaciones (ej. 5 minutos)
export class LiquidationBaseRepository extends BaseRepository {
  constructor (db) {
    super(db, 'base_liquidations')
  }

  async save (data) {
    // Guarda datos crudos de Liquidaciones (ej. 5 minutos) en liquidations_base.
    return this.replaceInto({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      timestamp: data.timestamp,
      longs: data.longs,
      shorts: data.shorts
    }, ['exchange_id', 'asset_id', 'timestamp'])
  }

  async findAllByAssetId (assetId) {
    // Consulta todos los datos crudos de 5 minutos para un activo.
    const sql = `
      SELECT timestamp, exchange_id, longs, shorts
      FROM ${this.quotedTableName}
      WHERE asset_id = ?
      ORDER BY timestamp ASC
    `
    const params = [assetId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp, exchange_id: exchangeId, longs, shorts }) => ({
      timestamp: +timestamp,
      exchange_id: +exchangeId,
      longs: +longs,
      shorts: +shorts
    }))
  }

  // Método para obtener datos de 5min en un rango de tiempo específico
  async findByAssetIdAndTimeRange (assetId, startTime, endTime) {
    const sql = `
            SELECT timestamp, exchange_id, longs, shorts
            FROM ${this.quotedTableName}
            WHERE asset_id = ? AND timestamp >= ? AND timestamp < ?
            ORDER BY timestamp ASC
        `
    const params = [assetId, startTime, endTime]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp, exchange_id: exchangeId, longs, shorts }) => ({
      timestamp: +timestamp,
      exchange_id: +exchangeId,
      longs: +longs,
      shorts: +shorts
    }))
  }
}

export class OpenInterestRepository extends BaseRepository {
  constructor (db) {
    super(db, 'open_interest')
  }

  get aggregatedTableName () {
    return this.quote(`aggregated_${this.tableName}`)
  }

  async save (data) {
    return this.replaceInto({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      timestamp: data.timestamp,
      open_value: data.open,
      high_value: data.high,
      low_value: data.low,
      close_value: data.close
    }, ['exchange_id', 'asset_id', 'timestamp'])
  }

  async findAllByAssetId (assetId, seconds) {
    const sql = `
      SELECT timestamp, exchange_id, open_value, high_value, low_value, close_value
      FROM ${this.quotedTableName}
      WHERE asset_id = ? AND seconds % ? = 0
      ORDER BY timestamp ASC
    `
    const params = [assetId, seconds]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp, exchange_id: exchangeId, open_value: openValue, high_value: highValue, low_value: lowValue, close_value: closeValue }) => ({
      timestamp: +timestamp,
      exchange_id: +exchangeId,
      open: +openValue,
      high: +highValue,
      low: +lowValue,
      close: +closeValue
    }))
  }

  async findAllAccumByAssetId (assetId, seconds) {
    const sql = `
    SELECT
      timestamp,
      open,
      high,
      low,
      close
    FROM ${this.aggregatedTableName}
    WHERE asset_id = ? AND seconds % ? = 0
    `
    const params = [assetId, seconds]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp,
      open: +row.open,
      high: +row.high,
      low: +row.low,
      close: +row.close
    }))
  }

  async getLastTimestamp (assetId) {
    const [maxBaseTimestampRow] = await this.query(
      `SELECT MAX(timestamp) as max_ts FROM ${this.quotedTableName} WHERE asset_id = ?`
      , [assetId])
    return maxBaseTimestampRow[0].max_ts ? maxBaseTimestampRow[0].max_ts : 0
  }

  async findLatestCloseByExchange (assetId, seconds) {
    const sql = `
      SELECT exchange_id, close_value as close
      FROM ${this.quotedTableName}
      WHERE asset_id = ? AND seconds % ? = 0
        AND timestamp = (
          SELECT MAX(sub.timestamp)
          FROM ${this.quotedTableName} sub
          WHERE sub.asset_id = ${this.quotedTableName}.asset_id AND sub.exchange_id = ${this.quotedTableName}.exchange_id
        )
    `
    const params = [assetId, seconds]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({ exchange_id: row.exchange_id, close: +row.close }))
  }
}
