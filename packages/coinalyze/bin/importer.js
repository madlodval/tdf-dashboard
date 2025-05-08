import fs from 'fs/promises'
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
  INTERVAL_CONVERT
} from '../src/client.js'
import { RESOURCE_OI, RESOURCE_LQ, RESOURCE_VL } from '../src/helpers.js'

const baseStorageDir = path.resolve(process.cwd(), 'storage')

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
    choices: Object.keys(INTERVAL_CONVERT),
    demandOption: true
  })
  .help()
  .alias('help', 'h')
  .argv

async function handler () {
  const { resource, asset, interval } = argv

  const dataDir = path.join(baseStorageDir, resource, asset.toLowerCase(), interval)

  const db = connection()
  let filesToImport = []

  try {
    await db.connect()

    try {
      filesToImport = await fs.readdir(dataDir)
      filesToImport = filesToImport.filter(file => file.endsWith('.json'))

      filesToImport.sort((a, b) => {
        const [fromA, toA] = path.basename(a, '.json').split('-').map(Number)
        const [fromB, toB] = path.basename(b, '.json').split('-').map(Number)
        console.log(fromA, toA)
        console.log(fromB, toB)
        if (fromA === fromB) {
          return toB - toA
        }
        return fromA - fromB
      })

      if (filesToImport.length === 0) {
        console.log(`No .json files found in ${dataDir} to import.`)
        await db.disconnect()
        return
      }
    } catch (readDirError) {
      if (readDirError.code === 'ENOENT') {
        console.log(`Data directory not found: ${dataDir}. No files to import.`)
        await db.disconnect()
        return
      } else {
        throw new Error(`Error reading data directory ${dataDir}: ${readDirError.message}`)
      }
    }

    const processor = processors[resource]
    if (typeof processor !== 'function') {
      throw new Error(`Processor function not found for resource: ${resource}`)
    }

    let totalFilesProcessed = 0
    let totalRecordsImported = 0
    let highestProcessedEndTime = -Infinity
    console.log(filesToImport)
    for (const filename of filesToImport) {
      const jsonFilePath = path.join(dataDir, filename)
      console.log(filename)
      const [currentFrom, currentTo] = path
        .basename(filename, '.json')
        .split('-').map(Number)

      const shouldProcessData = currentFrom >= highestProcessedEndTime || currentTo > highestProcessedEndTime

      if (shouldProcessData) {
        const dataLoader = new JsonDataLoader(jsonFilePath)
        let data
        try {
          data = await dataLoader.load()
          console.log(`Importing data from file: ${filename}`)
          const recordsImportedInFile = await db.transaction(() =>
            processor({ db, asset: asset.toUpperCase(), data, interval })
          )
          console.log(`Successfully imported ${recordsImportedInFile} records from ${filename}.`)
          totalRecordsImported += recordsImportedInFile
          totalFilesProcessed++

          highestProcessedEndTime = Math.max(highestProcessedEndTime, currentTo)
        } catch (importError) {
          console.error('-----------------------------------------')
          console.error(`Error importing data from file ${filename}:`)
          console.error(importError.message)
          console.error('-----------------------------------------')
          continue
        }
      }

      try {
        await fs.unlink(jsonFilePath)
      } catch (unlinkError) {
        console.error(`Error deleting file ${filename}: ${unlinkError.message}`)
      }
    }

    console.log(`Import process finished for resource: ${resource}, asset: ${asset}, interval: ${interval}.`)
    console.log(`Total files processed: ${totalFilesProcessed}. Total records imported: ${totalRecordsImported}.`)
  } catch (error) {
    console.error('-----------------------------------------')
    console.error('Critical error during execution:')
    console.error(error.message)
    console.error(error.stack)
    console.error('-----------------------------------------')
    process.exit(1)
  } finally {
    if (db) {
      await db.disconnect()
    }
  }
}

handler().catch(err => {
  console.error(err)
  process.exit(1)
})
