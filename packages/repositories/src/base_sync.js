import { Repository } from '@tdf/database'
import { AssetRepository } from './asset.js'
import { IntervalRepository, INTERVAL_BASE } from './interval.js'

// Base class for sync repositories
export class SyncRepository extends Repository {
  constructor (db, tableName) {
    super(db, `sync_${tableName}`)
  }

  async getLastTimestamp (assetId, intervalId) {
    const [rows] = await this.query(
      `SELECT timestamp
        FROM ${this.quotedTableName}
        WHERE asset_id = ? AND interval_id = ?`,
      [assetId, intervalId]
    )
    return rows.length > 0 && rows[0].timestamp !== null ? +rows[0].timestamp : 0
  }

  async updateLastTimestamp (assetId, intervalId, timestamp) {
    await this.replaceInto({
      asset_id: assetId,
      interval_id: intervalId,
      timestamp
    },
    ['assetId', 'intervalId']
    )
  }

  async syncFromBase (assetId = 0) {
    return this.transaction(async (db) => {
      const intervals = await new IntervalRepository(db).findAll()
      const assets = assetId
        ? [assetId]
        : await new AssetRepository(db).findAllIds()
      let totalSynced = 0
      for (const assetId of assets) {
        for (const interval of intervals) {
          const result = await this.call(
            `${this.tableName}_intervals`, // procedure name
            assetId,
            interval.id,
            interval.seconds,
            INTERVAL_BASE
          )

          const affectedRows = result && result[0] && result[0].affectedRows !== undefined ? result[0].affectedRows : 0
          totalSynced += affectedRows
        }
      }
      return totalSynced
    })
  }
}

// Base class for data repositories
export class BaseSyncRepository extends Repository {
  async save (data) {
    if (!Array.isArray(data)) {
      data = [data]
    }
    return this.replaceInto(data.map(data => ({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      interval_id: data.intervalId,
      timestamp: data.timestamp,
      ...this.getDataFields(data)
    })), this.getKeys())
  }

  getKeys () {
    return ['exchange_id', 'asset_id', 'interval_id', 'timestamp']
  }

  get aggregatedTableName () {
    return this.quote(`aggregated_${this.tableName}`)
  }

  get SyncRepository () {
    return new SyncRepository(this.db, this.tableName)
  }

  async syncFromBase () {
    return this.SyncRepository.syncFromBase()
  }

  // Abstract method to be implemented by subclasses
  getDataFields (data) {
    throw new Error('getDataFields method must be implemented by subclasses')
  }
}
