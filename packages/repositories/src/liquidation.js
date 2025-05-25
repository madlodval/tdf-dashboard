import { BaseSyncRepository } from './sync.js'

export class LiquidationRepository extends BaseSyncRepository {
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
      WHERE asset_id = ? AND interval_id = ?
      `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp,
      longs: row.longs,
      shorts: row.shorts
    }))
  }
}
