import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import 'dotenv/config'
import { connectWithRetry, registerRoutes, setupGracefulShutdown } from './helpers.js'
import {
  openInterestHandler,
  latestOIByExchangeHandler,
  ohlcvHandler,
  liquidationsHandler, latestLiquidationsByExchangeHandler
} from './controllers.js'
import {
  DatabaseFactory,
  OpenInterestRepository,
  ExchangeRepository,
  AssetRepository,
  IntervalRepository,
  LiquidationRepository,
  VolumeRepository
} from '@tdf/repositories'

const PORT = process.env.PORT || 3001
const dbConfig = {
  connection: process.env.DB_CONNECTION,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: process.env.DB_TIMEZONE || 'Z'
}
const app = express()
app.use(cors())
app.use(morgan('dev')) // Logging de requests HTTP
app.use(express.json())

const db = DatabaseFactory.createConnection(dbConfig)

const openInterestRepository = new OpenInterestRepository(db)
const exchangeRepository = new ExchangeRepository(db)
const assetRepository = new AssetRepository(db)
const intervalRepository = new IntervalRepository(db)
const liquidationRepository = new LiquidationRepository(db)
const volumeRepository = new VolumeRepository(db)

// Declaración de módulos de rutas
const modules = [
  {
    apiPath: '/api/open-interest',
    routes: { '/:symbol': openInterestHandler }
  },
  {
    apiPath: '/api/open-interest/latest-by-exchange',
    routes: {
      '/:symbol': latestOIByExchangeHandler
    }
  },
  {
    apiPath: '/api/liquidations',
    routes: {
      '/:symbol': liquidationsHandler,
      '/latest-by-exchange/:symbol': latestLiquidationsByExchangeHandler
    }
  },
  { apiPath: '/api/ohlcv', routes: { '/:symbol': ohlcvHandler } }
  // { apiPath: '/api/exchanges', routes: { '': exchangesListHandler } }
  // Agrega aquí más módulos de rutas
]

// Registro centralizado de rutas
registerRoutes(app, modules, {
  assetRepository,
  openInterestRepository,
  exchangeRepository,
  intervalRepository,
  liquidationRepository,
  volumeRepository
})

setupGracefulShutdown(db)

app.use((err, req, res, next) => {
  const statusCode = err.status || 500
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  console.error('Error en la petición:', err)
  res.status(statusCode).json({ message })
})

const server = app.listen(PORT, () => {
  console.info(`Servidor escuchando en el puerto ${PORT}...`)
  connectWithRetry(db).catch(() => {
    server.close(() => {
      process.exit(0)
    })
  })
})
