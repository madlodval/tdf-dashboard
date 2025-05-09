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