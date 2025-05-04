import { BaseRepository } from '@tdf/database'
import { INTERVAL_BASE, IntervalRepository } from './interval.js'
import { BaseSyncRepository, BaseDataRepository } from './base_sync.js'

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
