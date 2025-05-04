import { MySQLConnection } from './mysql.js'
import { PostgreSQLConnection } from './postgresql.js'
import { DatabaseConnectionError } from './base.js'

export class DatabaseFactory {
  static instance = null
  static createConnection ({ connection, ...config }) {
    switch (connection.toLowerCase()) {
      case 'mysql':
        return new MySQLConnection(config)
      case 'postgresql':
      case 'postgres':
        return new PostgreSQLConnection(config)
      default:
        throw new DatabaseConnectionError(`Unsupported database type: ${connection}`)
    }
  }
}
