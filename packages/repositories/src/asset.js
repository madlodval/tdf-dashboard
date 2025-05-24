import { Repository } from '@tdf/database'

export class AssetRepository extends Repository {
  constructor (db) {
    super(db, 'assets')
  }

  async findIdBySymbol (symbol) {
    const [rows] = await this.query(`SELECT id FROM ${this.quotedTableName} WHERE symbol = ?`, [symbol])
    if (rows.length === 0) return
    return rows[0].id
  }

  async findAllIds () {
    const [rows] = await this.query(`SELECT id FROM ${this.quotedTableName}`)
    return rows.reduce((acc, row) => {
      acc.push(+row.id)
      return acc
    }, [])
  }
}
