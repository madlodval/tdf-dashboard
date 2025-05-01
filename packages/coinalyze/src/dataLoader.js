import { access, readFile } from 'fs/promises'

export class JsonDataLoader {
  constructor (filePath) {
    if (!filePath) {
      throw new Error('JSON file path is required.')
    }
    this.filePath = filePath
  }

  async load () {
    try {
      await access(this.filePath)
    } catch {
      throw new Error(`File ${this.filePath} does not exist`)
    }

    try {
      const jsonContent = await readFile(this.filePath, 'utf8')
      const data = JSON.parse(jsonContent)
      return data
    } catch (error) {
      throw new Error(`Error reading or decoding JSON from ${this.filePath}: ${error.message}`)
    }
  }
}
