import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

export class JsonCache {
  constructor (cacheDir, defaultTtl = 3600) {
    this.cacheDir = cacheDir
    this.defaultTtl = defaultTtl
  }

  async remember (key, callback, ttl = null) {
    const sentinel = {}
    const cachedValue = await this.load(key, sentinel)

    if (cachedValue !== sentinel) {
      return cachedValue
    }

    const freshData = await callback()

    await this.save(key, freshData, ttl)

    return freshData
  }

  async save (key, data, ttl = null) {
    const filePath = this.getFilePath(key)
    const expiresAt = (ttl <= 0) ? 0 : (Date.now() + ((ttl === null ? this.defaultTtl : ttl) * 1000))

    const cacheData = {
      expiresAt,
      data
    }

    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2), 'utf8')
      return true
    } catch (err) {
      console.error(`Error al guardar en caché: ${filePath}`, err)
      return false
    }
  }

  async load (key, defaultVal = null) {
    const filePath = this.getFilePath(key)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const cacheData = JSON.parse(content)

      if (cacheData.expiresAt !== 0 && Date.now() > cacheData.expiresAt) {
        await fs.unlink(filePath)
        return defaultVal
      }

      return cacheData.data
    } catch (err) {
      // Si no existe, devuelve null, si es otro error lo muestra
      if (err.code !== 'ENOENT') {
        console.error(`Error al cargar caché: ${filePath}`, err)
      }
      return defaultVal
    }
  }

  async has (key) {
    const filePath = this.getFilePath(key)

    try {
      await fs.access(filePath)
      const content = await fs.readFile(filePath, 'utf8')
      const cacheData = JSON.parse(content)

      if (cacheData.expiresAt !== 0 && Date.now() > cacheData.expiresAt) {
        await fs.unlink(filePath)
        return false
      }

      return true
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error al verificar caché: ${filePath}`, err)
      }
      return false
    }
  }

  async delete (key) {
    const filePath = this.getFilePath(key)

    try {
      await fs.unlink(filePath)
      return true
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error al eliminar caché: ${filePath}`, err)
      }
      return false
    }
  }

  async clear () {
    let success = true
    try {
      const files = await fs.readdir(this.cacheDir)
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file)
        try {
          const stat = await fs.stat(filePath)
          if (stat.isFile()) {
            await fs.unlink(filePath)
          }
        } catch (err) {
          console.error(`No se pudo eliminar el archivo de caché: ${filePath}`, err)
          success = false
        }
      }
    } catch (err) {
      console.error(`Error al intentar listar archivos en el directorio de caché: ${this.cacheDir}`, err)
      return false
    }
    return success
  }

  getFilePath (key) {
    const filename = crypto.createHash('md5').update(key).digest('hex') + '.json'
    return path.join(this.cacheDir, filename)
  }
}
