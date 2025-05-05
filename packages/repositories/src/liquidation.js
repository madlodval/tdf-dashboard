import { Repository } from '@tdf/database'
import { BaseSyncRepository } from './base_sync.js'

/*
class LiquidationSyncRepository extends BaseSyncRepository {
}
*/

class LiquidationBaseRepository extends Repository {
  constructor (db, tableName) {
    super(db, `base_${tableName}`)
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

// Specific implementation for liquidations
export class LiquidationRepository extends BaseSyncRepository {
  constructor (db) {
    super(db, 'liquidations')
  }

  get BaseRepository () {
    return new LiquidationBaseRepository(this.db, this.tableName)
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
        shorts
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
