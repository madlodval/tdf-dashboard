import express from 'express'

const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Retry logic for DB connection
export async function connectWithRetry(db, retries = 5, delayMs = 2000) {
  let attempt = 0
  while (attempt < retries) {
    try {
      await db.connect()
      console.info('Database connection established.')
      return
    } catch (err) {
      attempt++
      console.warn(`Intento de conexión a BD fallido (${attempt}/${retries}):`, err.message)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else {
        console.error('No se pudo conectar a la base de datos después de varios intentos.')
        throw err
      }
    }
  }
}

// Graceful shutdown para cierre de conexiones
export function setupGracefulShutdown(db) {
  const shutdown = async () => {
    try {
      console.info('Cerrando conexión a la base de datos...')
      await db.disconnect()
      console.info('Conexión cerrada. Saliendo.')
      process.exit(0)
    } catch (err) {
      console.error('Error cerrando la conexión:', err)
      process.exit(1)
    }
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}


/**
 * Registra múltiples módulos de rutas en la app de express.
 * @param {Express.Application} app - Instancia de express
 * @param {Array<{ apiPath: string, routes: object }>} modules - Módulos con path base y objeto de rutas
 * @param {object} sharedDeps - Dependencias compartidas (repositorios, etc)
 */
export function registerRoutes(app, modules, sharedDeps) {
  modules.forEach(({ apiPath, routes }) => {
    const router = express.Router()
    Object.entries(routes).forEach(([path, handlerFactory]) => {
      router.get(path, asyncHandler(handlerFactory(sharedDeps)))
      // Si soportas otros métodos, podrías usar:
      // router[method](path, ...)
    })
    app.use(apiPath, router)
  })
}
