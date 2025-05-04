import { BaseRepository } from '@tdf/database'

import { INTERVAL_BASE, IntervalRepository } from './interval.js'
import { BaseSyncRepository, BaseDataRepository } from './base_sync.js'

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
