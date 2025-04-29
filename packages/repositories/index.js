import { BaseRepository, DatabaseFactory } from './db.js'

export { DatabaseFactory }

// --- UTILIDAD UTC SEGURA ---
// Convierte cualquier fecha a 'YYYY-MM-DD HH:mm:ss' UTC, compatible con MySQL y PostgreSQL
function toUtcDatetimeString(date) {
  const d = (typeof date === 'number')
    ? new Date(date * (date < 1e12 ? 1000 : 1)) // segundos o ms
    : new Date(date)
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0') + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0') + ':' +
    String(d.getUTCSeconds()).padStart(2, '0')
}

export class AssetRepository extends BaseRepository {
  async findIdBySymbol(symbol) {
    const [rows] = await this.query('SELECT id FROM assets WHERE symbol = ?', [symbol])
    if (rows.length === 0) return
    return rows[0].id
  }
}

export class ExchangeRepository extends BaseRepository {
  async findIdByNames(...exchangeNames) {
    const results = new Map()
    if (Array.isArray(exchangeNames) &&
      exchangeNames.length === 1 &&
      Array.isArray(exchangeNames[0])
    ) {
      exchangeNames = exchangeNames[0]
    }
    const placeholders = exchangeNames.map(() => '?').join(',')
    const sql = `SELECT id, name FROM exchanges WHERE name IN (${placeholders})`
    const [rows] = await this.query(sql, exchangeNames)
    const foundMap = new Map(rows.map(row => [row.name, parseInt(row.id)]))
    for (const name of exchangeNames) {
      const id = foundMap.get(name) || null
      results.set(name, id)
    }
    return results
  }

  async findIdByCode(code) {
    const [rows] = await this.query('SELECT id FROM exchanges WHERE code = ?', [code])
    if (rows.length === 0) return null
    return rows[0].id
  }

  async all() {
    const [rows] = await this.query('SELECT id, name FROM exchanges', [])
    const exchanges = new Map()
    for (const row of rows) {
      exchanges.set(row.id, row.name)
    }
    return exchanges
  }

  async findNamesByIds(...exchangeIds) {
    const results = new Map()
    if (Array.isArray(exchangeIds) &&
      exchangeIds.length === 1 &&
      Array.isArray(exchangeIds[0])
    ) {
      exchangeIds = exchangeIds[0]
    }
    if (!exchangeIds.length) return results
    const placeholders = exchangeIds.map(() => '?').join(',')
    const sql = `SELECT id, name FROM exchanges WHERE id IN (${placeholders})`
    const [rows] = await this.query(sql, exchangeIds)
    const foundMap = new Map(rows.map(row => [parseInt(row.id), row.name]))
    for (const id of exchangeIds) {
      const name = foundMap.get(parseInt(id)) || null
      results.set(id, name)
    }
    return results
  }
}

export class OpenInterestRepository extends BaseRepository {
  async save(data) {
    return this.replaceInto('open_interest', {
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      interval_id: data.intervalId,
      timestamp: toUtcDatetimeString(data.timestamp),
      open_value: data.open,
      high_value: data.high,
      low_value: data.low,
      close_value: data.close
    }, ['exchange_id', 'asset_id', 'interval_id', 'timestamp'])
  }

  async findAllByAssetId(assetId, intervalId) {
    const sql = `
      SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, interval_id, open_value, high_value, low_value, close_value
      FROM open_interest
      WHERE asset_id = ? AND interval_id = ?
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix, exchange_id, interval_id, open_value, high_value, low_value, close_value }) => ({
      timestamp: +timestamp_unix,
      exchange_id: +exchange_id,
      interval_id: +interval_id,
      open: +open_value,
      high: +high_value,
      low: +low_value,
      close: +close_value
    }))
  }

  async findAllAccumByAssetId(assetId, intervalId) {
    const sql = `
    SELECT
      UNIX_TIMESTAMP(timestamp) AS timestamp_unix,
      SUM(open_value) AS open,
      SUM(high_value) AS high,
      SUM(low_value) AS low,
      SUM(close_value) AS close
    FROM open_interest
    WHERE asset_id = ? AND interval_id = ?
    GROUP BY timestamp
    ORDER BY timestamp ASC
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp_unix,
      open: +row.open,
      high: +row.high,
      low: +row.low,
      close: +row.close
    }))
  }

  async findLatestCloseByExchange(assetId, intervalId) {
    const sql = `
      SELECT exchange_id, close_value as close
      FROM open_interest
      WHERE asset_id = ? AND interval_id = ?
        AND timestamp = (
          SELECT MAX(sub.timestamp)
          FROM open_interest sub
          WHERE sub.asset_id = open_interest.asset_id AND sub.interval_id = open_interest.interval_id AND sub.exchange_id = open_interest.exchange_id
        )
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({ exchange_id: row.exchange_id, close: +row.close }))
  }
}

export class IntervalRepository extends BaseRepository {
  async findIdByName(name) {
    const [rows] = await this.query('SELECT id FROM intervals WHERE name = ?', [name])
    if (rows.length === 0) return null
    return rows[0].id
  }
}

export class LiquidationRepository extends BaseRepository {
  async save(data) {
    return this.replaceInto('liquidations', {
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      interval_id: data.intervalId,
      timestamp: toUtcDatetimeString(data.timestamp),
      longs: data.longs,
      shorts: data.shorts
    }, ['exchange_id', 'asset_id', 'interval_id', 'timestamp'])
  }

  async findAllByAssetId(assetId, intervalId) {
    const sql = `
      SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, interval_id, longs, shorts
      FROM liquidations
      WHERE asset_id = ? AND interval_id = ?
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix, exchange_id, interval_id, longs, shorts }) => ({
      timestamp: +timestamp_unix,
      exchange_id: +exchange_id,
      interval_id: +interval_id,
      longs: +longs,
      shorts: +shorts
    }))
  }
}

export class PriceRepository extends BaseRepository {
  async save(data) {
    return this.replaceInto('price_assets', {
      asset_id: data.assetId,
      timestamp: toUtcDatetimeString(data.timestamp),
      price: data.price
    }, ['asset_id', 'timestamp'])
  }

  async findAllByAssetId(assetId, startDate = null, endDate = null) {
    let sql = 'SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, price FROM price_assets WHERE asset_id = ?'
    const params = [assetId]
    if (startDate) {
      sql += ' AND timestamp >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND timestamp <= ?'
      params.push(endDate)
    }
    sql += ' ORDER BY timestamp'
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix, price }) => ({
      timestamp: +timestamp_unix,
      price: +price
    }))
  }
}

export class VolumeRepository extends BaseRepository {
  async save(data) {
    return this.replaceInto('volume', {
      exchange_id: data.exchangeId,
      asset_id: data.assetId,
      interval_id: data.intervalId,
      timestamp: toUtcDatetimeString(data.timestamp),
      open_value: data.open,
      high_value: data.high,
      low_value: data.low,
      close_value: data.close,
      volume_value: data.volume
    }, ['exchange_id', 'asset_id', 'interval_id', 'timestamp'])
  }

  async findAllByAssetId(assetId, intervalId) {
    const sql = `
      SELECT UNIX_TIMESTAMP(timestamp) AS timestamp_unix, exchange_id, interval_id, open_value, high_value, low_value, close_value, volume_value
      FROM volume
      WHERE asset_id = ? AND interval_id = ?
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(({ timestamp_unix, exchange_id, interval_id, open_value, high_value, low_value, close_value, volume_value }) => ({
      timestamp: +timestamp_unix,
      exchange_id: +exchange_id,
      interval_id: +interval_id,
      open: +open_value,
      high: +high_value,
      low: +low_value,
      close: +close_value,
      volume: +volume_value
    }))
  }

  async findAllAccumByAssetId(assetId, intervalId) {
    const sql = `
    SELECT
      UNIX_TIMESTAMP(timestamp) AS timestamp_unix,
      AVG(open_value) AS open,
      AVG(high_value) AS high,
      AVG(low_value) AS low,
      AVG(close_value) AS close,
      SUM(volume_value) AS volume
    FROM volume
    WHERE asset_id = ? AND interval_id = ?
    GROUP BY timestamp
    ORDER BY timestamp ASC
    `
    const params = [assetId, intervalId]
    const [rows] = await this.query(sql, params)
    return rows.map(row => ({
      time: +row.timestamp_unix,
      open: +row.open,
      high: +row.high,
      low: +row.low,
      close: +row.close,
      volume: +row.volume
    }))
  }
}
