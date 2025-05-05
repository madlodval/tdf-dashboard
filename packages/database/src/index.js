import { config } from './config.js'
import { DatabaseFactory } from './factory.js'
import { Repository } from './repository.js'

const connection = () => DatabaseFactory.createConnection(config)

export { connection, Repository }
