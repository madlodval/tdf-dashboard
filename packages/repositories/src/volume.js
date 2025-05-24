import { Repository } from '@tdf/database'
import { BaseSyncRepository } from './sync.js'

class BaseRepository extends Repository {
  constructor (db, tableName) {
    super(db, `base_${tableName}`)
  }

  async save (data) {
    if (!Array.isArray(data)) {
      data = [data]
    }
    return this.replaceInto(data.map(({
      exchangeId,
      assetId,
      timestamp,
      open,
      low,
      close,
      high,
      volume
    }) => ({
      exchange_id: +exchangeId,
      asset_id: +assetId,
      timestamp: +timestamp,
      open_value: +open,
      high_value: +high,
      low_value: +low,
      close_value: +close,
      volume_value: +volume
    })), ['exchange_id', 'asset_id', 'timestamp'])
  }
}

export class VolumeRepository extends BaseSyncRepository {
  constructor (db) {
    super(db, 'volume')
  }

  get BaseRepository () {
    return new BaseRepository(this.db, this.tableName)
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
