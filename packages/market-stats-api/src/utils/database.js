export async function connectWithRetry (db, retries = 5, delayMs = 2000) {
  let attempt = 0
  while (attempt < retries) {
    try {
      await db.connect()
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
