import { BaseRepository } from '@tdf/database'

// Base class for sync repositories
export class BaseSyncRepository extends BaseRepository {
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
    return maxBaseTimestampRow[0].max_ts ? maxBaseTimestampRow[0].max_ts : 0
  }

  async getLastTimestamp (intervalId) {
    const [rows] = await this.query(
      `SELECT timestamp FROM ${this.quotedSyncTableName} WHERE interval_id = ?`,
      [intervalId]
    )
    return rows.length > 0 && rows[0].timestamp !== null ? +rows[0].timestamp : 0
  }

  async updateLastTimestamp (intervalId, timestamp) {
    await this.execute(
      `UPDATE ${this.quotedSyncTableName} SET timestamp = ? WHERE interval_id = ?`,
      [timestamp, intervalId]
    )
  }
}

// Base class for data repositories
export class BaseDataRepository extends BaseRepository {
  async save (data) {
    return this.replaceInto({
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      interval_id: data.intervalId,
      timestamp: data.timestamp,
      ...this.getDataFields(data)
    }, ['exchange_id', 'asset_id', 'interval_id', 'timestamp'])
  }

  get aggregatedTableName () {
    return this.quote(`aggregated_${this.tableName}`)
  }

  async syncFromBase () {
    // Assuming SyncRepository is a static property of the concrete class
    const syncRepo = new this.constructor.SyncRepository(this.db)
    return syncRepo.syncFromBase()
  }

  // Abstract method to be implemented by subclasses
  getDataFields (data) {
    throw new Error('getDataFields method must be implemented by subclasses')
  }
}
