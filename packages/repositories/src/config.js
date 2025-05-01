import 'dotenv/config'

export const config = {
  connection: process.env.DB_CONNECTION,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  timezone: process.env.DB_TIMEZONE || 'Z'
}
