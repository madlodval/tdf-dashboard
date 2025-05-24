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
      longs,
      shorts
    }) => ({
      exchange_id: +exchangeId,
      asset_id: +assetId,
      timestamp: +timestamp,
      longs,
      shorts
    })),
    ['exchange_id', 'asset_id', 'timestamp'])
  }
}

export class LiquidationRepository extends BaseSyncRepository {
  constructor (db) {
    super(db, 'liquidations')
  }

  get BaseRepository () {
    return new BaseRepository(this.db, this.tableName)
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
