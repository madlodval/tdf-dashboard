import { Repository } from '@tdf/database'
import { BaseSyncRepository } from './base_sync.js'

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
      high
    }) => ({
      exchange_id: +exchangeId,
      asset_id: +assetId,
      timestamp: +timestamp,
      open_value: +open,
      high_value: +high,
      low_value: +low,
      close_value: +close
    })), ['exchange_id', 'asset_id', 'timestamp'])
  }
}

export class OpenInterestRepository extends BaseSyncRepository {
  constructor (db) {
    super(db, 'open_interest')
  }

  get BaseRepository () {
    return new BaseRepository(this.db, this.tableName)
  }

  getDataFields ({ open, low, close, high }) {
    return {
      open_value: +open,
      high_value: +high,
      low_value: +low,
      close_value: +close
    }
  }

  async findAllByAssetId (assetId, intervalId) {
    const sql = `
      SELECT timestamp, exchange_id, open_value, high_value, low_value, close_value
      FROM ${this.quotedTableName}
      WHERE asset_id = ? AND interval_id = ?
      ORDER BY timestamp ASC
    `
    const params = [assetId, intervalId]
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

  async findAllAccumByAssetId (assetId, intervalId) {
    const sql = `
    SELECT
      timestamp,
      open,
      high,
      low,
      close
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
