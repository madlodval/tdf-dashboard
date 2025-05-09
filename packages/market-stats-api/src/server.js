import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { config } from './config/index.js'
import { registerRoutes } from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { setupGracefulShutdown } from './utils/gracefulShutdown.js'
import { connectWithRetry } from './utils/database.js'
import {
  OpenInterestRepository,
  ExchangeRepository,
  AssetRepository,
  IntervalRepository,
  LiquidationRepository,
  VolumeRepository,
  connection
} from '@tdf/repositories'

const app = express()

// Middleware
app.use(cors(config.cors))
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'))
app.use(express.json())

// Inicialización de repositorios
const db = connection()

// Registro de rutas
registerRoutes(app, {
  openInterestRepository: new OpenInterestRepository(db),
  exchangeRepository: new ExchangeRepository(db),
  assetRepository: new AssetRepository(db),
  intervalRepository: new IntervalRepository(db),
  liquidationRepository: new LiquidationRepository(db),
  volumeRepository: new VolumeRepository(db)
})

// Manejo de errores
app.use(errorHandler)

// Configuración de cierre graceful
setupGracefulShutdown(db)

// Inicio del servidor
const server = app.listen(config.port, () => {
  console.info(`Servidor escuchando en el puerto ${config.port}...`)
  connectWithRetry(db).catch(() => {
    server.close(() => {
      process.exit(0)
    })
  })
})
