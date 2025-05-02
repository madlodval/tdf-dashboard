import { BaseRepository, DatabaseFactory } from './db.js'

export { DatabaseFactory }

// Interval base in seconds for 5 minutes
export const INTERVAL_BASE = 300

// --- UTILIDAD UTC SEGURA ---
// Convierte cualquier fecha a 'YYYY-MM-DD HH:mm:ss' UTC, compatible con MySQL y PostgreSQL
function toUtcDatetimeString (date) {
  const d = (typeof date === 'number')
    ? new Date(date * (date < 1e12 ? 1000 : 1)) // segundos o ms
    : new Date(date)
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0') + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0') + ':' +
    String(d.getUTCSeconds()).padStart(2, '0')
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
    const placeholders = exchangeNames.map(() => '?').join(',')
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

  async all () {
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
    const placeholders = exchangeIds.map(() => '?').join(',')
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

export class OpenInterestRepository extends BaseRepository {
  constructor (db) {
    super(db, 'open_interest')
  }

  async save (data) {
    return this.replaceInto({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      timestamp: toUtcDatetimeString(data.timestamp),
      open_value: data.open,
      high_value: data.high,
      low_value: data.low,
      close_value: data.close
    }, ['exchange_id', 'asset_id', 'timestamp'])
  }

  async findAllByAssetId (assetId, seconds) {
    const sql = `
      SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, open_value, high_value, low_value, close_value
      FROM ${this.quotedTableName}
      WHERE asset_id = ? AND seconds % ? = 0
      ORDER BY timestamp ASC
    `
    const params = [assetId, seconds]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix: timestampUnix, exchange_id: exchangeId, open_value: openValue, high_value: highValue, low_value: lowValue, close_value: closeValue }) => ({
      timestamp: +timestampUnix,
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
      UNIX_TIMESTAMP(timestamp) AS timestamp_unix,
      SUM(open_value) AS open,
      SUM(high_value) AS high,
      SUM(low_value) AS low,
      SUM(close_value) AS close
    FROM ${this.quotedTableName}
    WHERE asset_id = ? AND seconds % ? = 0
    GROUP BY timestamp
    ORDER BY timestamp ASC
    `
    const params = [assetId, seconds]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp_unix,
      open: +row.open,
      high: +row.high,
      low: +row.low,
      close: +row.close
    }))
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
    const [rows] = await this.query(`SELECT id, name, seconds FROM ${this.quotedTableName} ORDER BY seconds ASC`)
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
    return maxBaseTimestampRow[0].max_ts ? new Date(maxBaseTimestampRow[0].max_ts).getTime() / 1000 : 0
  }

  async getLastSyncTimestamp (intervalId) {
    const [rows] = await this.query(
      `SELECT UNIX_TIMESTAMP(last_sync_timestamp) as last_sync_timestamp FROM ${this.quotedSyncTableName} WHERE interval_id = ?`,
      [intervalId]
    )
    return rows.length > 0 && rows[0].last_sync_timestamp !== null ? +rows[0].last_sync_timestamp : 0
  }

  async updateLastSyncTimestamp (intervalId, timestamp) {
    const timestampString = toUtcDatetimeString(timestamp)
    await this.execute(
      `UPDATE ${this.quotedSyncTableName} SET last_sync_timestamp = ? WHERE interval_id = ?`,
      [timestampString, intervalId]
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
      timestamp: toUtcDatetimeString(data.timestamp),
      ...this.getDataFields(data)
    }, ['exchange_id', 'asset_id', 'interval_id', 'timestamp'])
  }

  async findAllByAssetId (assetId, intervalId) {
    const sql = `
      SELECT UNIX_TIMESTAMP(timestamp) AS timestampUnix,
             exchange_id AS exchangeId,
             interval_id AS intervalId,
             ${this.getSelectFields()}
      FROM ${this.quotedTableName}
      WHERE asset_id = ? AND interval_id = ?
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(this.mapRow.bind(this))
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
        if (interval.seconds === INTERVAL_BASE) {
          continue // default is sync on import
        }
        const lastSync = await this.getLastSyncTimestamp(interval.id)
        const syncStartTime = lastSync + 1
        if (maxBaseTimestamp < syncStartTime) {
          continue
        }
        const sql = `
          INSERT INTO ${this.quotedTableName} (exchange_id, asset_id, interval_id, timestamp, longs, shorts)
          SELECT
            exchange_id,
            asset_id,
            ? as interval_id,
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / ?) * ?) as timestamp,
            SUM(longs) as longs,
            SUM(shorts) as shorts
          FROM ${this.quotedBaseTableName}
          WHERE UNIX_TIMESTAMP(timestamp) >= ? AND UNIX_TIMESTAMP(timestamp) <= ?
          GROUP BY exchange_id, asset_id, FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / ?) * ?)
          HAVING COUNT(*) = (? / ?)
          ON DUPLICATE KEY UPDATE
            longs = VALUES(longs),
            shorts = VALUES(shorts);
        `
        const result = await this.execute(sql, [
          interval.id,
          interval.seconds,
          interval.seconds,
          syncStartTime,
          maxBaseTimestamp,
          interval.seconds,
          interval.seconds,
          interval.seconds,
          INTERVAL_BASE
        ])

        const affectedRows = result ? (result.affectedRows || 0) : 0
        console.log(`Synced ${affectedRows} liquidation rows for interval ${interval.name}.`)
        totalSynced += affectedRows

        await this.updateLastSyncTimestamp(interval.id, maxBaseTimestamp)
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
        if (interval.seconds === INTERVAL_BASE) {
          continue // default is sync on import
        }
        const lastSync = await this.getLastSyncTimestamp(interval.id)
        const syncStartTime = lastSync + 1
        if (maxBaseTimestamp < syncStartTime) {
          continue
        }
        const sql = `
          INSERT INTO ${this.quotedTableName} (exchange_id, asset_id, interval_id, timestamp, open_value, high_value, low_value, close_value, volume_value)
          SELECT
            exchange_id,
            asset_id,
            ? as interval_id,
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / ?) * ?) as timestamp,
            SUBSTRING_INDEX(GROUP_CONCAT(open_value ORDER BY timestamp ASC), ',', 1) as open_value,
            MAX(high_value) as high_value,
            MIN(low_value) as low_value,
            SUBSTRING_INDEX(GROUP_CONCAT(close_value ORDER BY timestamp DESC), ',', 1) as close_value,
            SUM(volume_value) as volume_value
          FROM ${this.quotedBaseTableName}
          WHERE UNIX_TIMESTAMP(timestamp) >= ? AND UNIX_TIMESTAMP(timestamp) <= ?
          GROUP BY exchange_id, asset_id, FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / ?) * ?)
          HAVING COUNT(*) = (? / ?)
          ON DUPLICATE KEY UPDATE
              open_value = VALUES(open_value),
              high_value = VALUES(high_value),
              low_value = VALUES(low_value),
              close_value = VALUES(close_value),
              volume_value = VALUES(volume_value);
        `
        const [result] = await this.execute(sql, [
          interval.id,
          interval.seconds,
          interval.seconds,
          syncStartTime,
          maxBaseTimestamp,
          interval.seconds,
          interval.seconds,
          interval.seconds,
          INTERVAL_BASE
        ])
        const affectedRows = result ? (result.affectedRows || 0) : 0
        console.log(`Synced ${affectedRows} liquidation rows for interval ${interval.name}.`)
        totalSynced += affectedRows
        await this.updateLastSyncTimestamp(interval.id, maxBaseTimestamp)
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

  getSelectFields () {
    return 'longs, shorts'
  }

  mapRow ({ timestampUnix, exchangeId, intervalId, longs, shorts }) {
    return {
      timestamp: +timestampUnix,
      exchangeId: +exchangeId,
      intervalId: +intervalId,
      longs: +longs,
      shorts: +shorts
    }
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

  getSelectFields () {
    return 'open_value AS openValue, high_value AS highValue, low_value AS lowValue, close_value AS closeValue, volume_value AS volumeValue'
  }

  mapRow ({ timestampUnix, exchangeId, intervalId, openValue, highValue, lowValue, closeValue, volumeValue }) {
    return {
      timestamp: +timestampUnix,
      exchangeId: +exchangeId,
      intervalId: +intervalId,
      open: +openValue,
      high: +highValue,
      low: +lowValue,
      close: +closeValue,
      volume: +volumeValue
    }
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
      timestamp: toUtcDatetimeString(data.timestamp),
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
      SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, open_value, high_value, low_value, close_value, volume_value
      FROM ${this.quotedTableName}
      WHERE asset_id = ?
      ORDER BY timestamp ASC
    `
    const params = [assetId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix: timestampUnix, exchange_id: exchangeId, open_value: openValue, high_value: highValue, low_value: lowValue, close_value: closeValue, volume_value: volumeValue }) => ({
      timestamp: +timestampUnix,
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
          SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, open_value, high_value, low_value, close_value, volume_value
          FROM ${this.quotedTableName}
          WHERE asset_id = ? AND timestamp >= FROM_UNIXTIME(?) AND timestamp < FROM_UNIXTIME(?)
          ORDER BY timestamp ASC
      `
    const params = [assetId, startTime, endTime]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix: timestampUnix, exchange_id: exchangeId, open_value: openValue, high_value: highValue, low_value: lowValue, close_value: closeValue, volume_value: volumeValue }) => ({
      timestamp: +timestampUnix,
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
      timestamp: toUtcDatetimeString(data.timestamp),
      longs: data.longs,
      shorts: data.shorts
    }, ['exchange_id', 'asset_id', 'timestamp'])
  }

  async findAllByAssetId (assetId) {
    // Consulta todos los datos crudos de 5 minutos para un activo.
    const sql = `
      SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, longs, shorts
      FROM ${this.quotedTableName}
      WHERE asset_id = ?
      ORDER BY timestamp ASC
    `
    const params = [assetId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix: timestampUnix, exchange_id: exchangeId, longs, shorts }) => ({
      timestamp: +timestampUnix,
      exchange_id: +exchangeId,
      longs: +longs,
      shorts: +shorts
    }))
  }

  // Método para obtener datos de 5min en un rango de tiempo específico
  async findByAssetIdAndTimeRange (assetId, startTime, endTime) {
    const sql = `
            SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, longs, shorts
            FROM ${this.quotedTableName}
            WHERE asset_id = ? AND timestamp >= FROM_UNIXTIME(?) AND timestamp < FROM_UNIXTIME(?)
            ORDER BY timestamp ASC
        `
    const params = [assetId, startTime, endTime]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix: timestampUnix, exchange_id: exchangeId, longs, shorts }) => ({
      timestamp: +timestampUnix,
      exchange_id: +exchangeId,
      longs: +longs,
      shorts: +shorts
    }))
  }
}
