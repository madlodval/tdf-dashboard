import { config } from './config.js'
import { DatabaseFactory } from './factory.js'
import { BaseRepository } from './repository.js'

const connection = () => DatabaseFactory.createConnection(config)

export { connection, BaseRepository }
