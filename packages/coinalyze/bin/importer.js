import fs from 'fs'
import yargs from 'yargs'
import path from 'path'
import { hideBin } from 'yargs/helpers'

import { JsonDataLoader } from '../src/dataLoader.js'
import { connection } from '@tdf/repositories'
import {
  processOpenInterest,
  processLiquidations,
  processVolume
} from '../src/processors.js'
import {
  INTERVAL_ONE_MIN,
  INTERVAL_FIVE_MIN,
  INTERVAL_FIFTEEN_MIN,
  INTERVAL_THIRTY_MIN,
  INTERVAL_ONE_HOUR,
  INTERVAL_TWO_HOUR,
  INTERVAL_FOUR_HOUR,
  INTERVAL_SIX_HOUR,
  INTERVAL_TWELVE_HOUR,
  INTERVAL_DAILY,
  INTERVAL_CONVERT
} from '../src/client.js'
import { RESOURCE_OI, RESOURCE_LQ, RESOURCE_VL } from '../src/helpers.js'

// Cambia el directorio de salida a 'storage' en el cwd actual
const storageDir = path.resolve(process.cwd(), 'storage')
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true })
}

// dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const processors = {
  [RESOURCE_OI]: processOpenInterest,
  [RESOURCE_LQ]: processLiquidations,
  [RESOURCE_VL]: processVolume
}

const argv = yargs(hideBin(process.argv))
  .option('resource', {
    alias: 'r',
    type: 'string',
    description: 'Resource to import (oi, lq, vl)',
    choices: Object.keys(processors),
    demandOption: true
  })
  .option('asset', {
    alias: 'a',
    type: 'string',
    description: 'Asset symbol (BTC, ETH)',
    demandOption: true
  })
  .option('interval', {
    alias: 'i',
    type: 'string',
    description: 'Interval of the data (e.g. 1day, 1min)',
    choices: [
      INTERVAL_ONE_MIN,
      INTERVAL_FIVE_MIN,
      INTERVAL_FIFTEEN_MIN,
      INTERVAL_THIRTY_MIN,
      INTERVAL_ONE_HOUR,
      INTERVAL_TWO_HOUR,
      INTERVAL_FOUR_HOUR,
      INTERVAL_SIX_HOUR,
      INTERVAL_TWELVE_HOUR,
      INTERVAL_DAILY
    ],
    demandOption: true
  })
  .help()
  .alias('help', 'h')
  .argv

async function handler () {
  const { resource, asset, interval } = argv
  const filename = `${asset.toLowerCase()}_${interval}_${resource}`
  const jsonFilePath = path.resolve(storageDir, `${filename}.json`)

  const db = connection()
  const dataLoader = new JsonDataLoader(jsonFilePath)
  let data
  try {
    data = await dataLoader.load()
    await db.connect()
    const processor = processors[resource]
    await processor({ db, asset: asset.toUpperCase(), data, interval: INTERVAL_CONVERT[interval] })
    console.log('Import finished.')
  } catch (error) {
    console.error('-----------------------------------------')
    console.error('Error crítico durante la ejecución:')
    console.error(error.message)
    console.error(error.stack) // Descomentar para ver el stack trace completo
    console.error('-----------------------------------------')
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

handler().catch(err => {
  console.error(err)
  process.exit(1)
})
