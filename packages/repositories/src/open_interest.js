import { Repository } from '@tdf/database'

export class OpenInterestRepository extends Repository {
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

  async getLastTimestamp (assetId, seconds) {
    const [rows] = await this.query(
      `SELECT MAX(timestamp) as max_ts FROM ${this.quotedTableName} WHERE asset_id = ? AND seconds % ? = 0`
      , [assetId, seconds])
    return rows.length > 0 && rows[0].max_ts !== null ? +rows[0].max_ts : 0
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
