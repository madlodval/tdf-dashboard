import fs from 'fs/promises'
import yargs from 'yargs'
import path from 'path'
import { hideBin } from 'yargs/helpers'

import { JsonDataLoader } from '../src/dataLoader.js'
import { connection, DatabaseQueryError, DatabaseConnectionError } from '@tdf/repositories'
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
  [RESOURCE_VL]: processVolume,
  [RESOURCE_LQ]: processLiquidations
}

const CHOICES_RESOURCES = Object.keys(processors)

const argv = yargs(hideBin(process.argv))
  .option('resource', {
    alias: 'r',
    type: 'array',
    description: 'Resources to import (oi, vl, lq). If not specified, imports all in order: oi, vl, lq.',
    choices: CHOICES_RESOURCES,
    default: CHOICES_RESOURCES
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
    description: 'Specific interval to import (e.g. 1day, 1min). If not provided, all intervals will be processed.',
    choices: Object.keys(INTERVAL_CONVERT),
    demandOption: false
  })
  .option('sync', {
    type: 'boolean',
    description: 'Synchronize intervals during processing',
    default: false
  })
  .help()
  .alias('help', 'h')
  .argv

async function getIntervalsToProcess (assetDataDir, specifiedInterval) {
  if (specifiedInterval) {
    return [specifiedInterval]
  }
  try {
    const entries = await fs.readdir(assetDataDir, { withFileTypes: true })
    const intervals = entries
      .filter(dirent => dirent.isDirectory() && Object.keys(INTERVAL_CONVERT).includes(dirent.name))
      .map(dirent => dirent.name)

    intervals.sort((a, b) => {
      const valueA = INTERVAL_CONVERT[a] || 0
      const valueB = INTERVAL_CONVERT[b] || 0
      return valueB - valueA
    })

    return intervals
  } catch (readDirError) {
    if (readDirError.code === 'ENOENT') {
      return []
    } else {
      throw new Error(`Error reading asset data directory ${assetDataDir}: ${readDirError.message}`)
    }
  }
}

function parseFilenameTimeRange (filename) {
  const [from, to] = path
    .basename(filename, '.json')
    .split('-').map(Number)

  return [from, to]
}

async function deleteFileWithLogging (jsonFilePath, filename, interval) {
  try {
    await fs.unlink(jsonFilePath)
  } catch (unlinkError) {
    console.error(`Error deleting file ${filename} for interval ${interval}: ${unlinkError.message}`)
  }
}

async function processFile (db, asset, interval, processor, jsonFilePath, highestProcessedEndTime, sync) {
  const filename = path.basename(jsonFilePath)
  const [currentFrom, currentTo] = parseFilenameTimeRange(filename)

  const shouldProcessData = currentFrom >= highestProcessedEndTime || currentTo > highestProcessedEndTime

  if (shouldProcessData) {
    const dataLoader = new JsonDataLoader(jsonFilePath)
    try {
      const data = await dataLoader.load()
      const recordsImportedInFile = await db.transaction(() =>
        processor({ db, asset: asset.toUpperCase(), data, interval, sync })
      )
      await deleteFileWithLogging(jsonFilePath, filename, interval)
      return { recordsImported: recordsImportedInFile, endTime: currentTo }
    } catch (importError) {
      console.error('-----------------------------------------')
      console.error(`Error importing data from file ${filename} for interval ${interval}:`)
      console.error(importError.message)
      console.error('-----------------------------------------')
      if (importError instanceof DatabaseQueryError || importError instanceof DatabaseConnectionError) {
        throw importError
      }
      return { recordsImported: 0, endTime: null }
    }
  }
  await deleteFileWithLogging(jsonFilePath, filename, interval)
  return { recordsImported: 0, endTime: null }
}

async function getAndSortFilesToImport (dataDir) {
  try {
    let filesToImport = await fs.readdir(dataDir)
    filesToImport = filesToImport.filter(file => file.endsWith('.json'))

    filesToImport.sort((a, b) => {
      const [fromA, toA] = parseFilenameTimeRange(a)
      const [fromB, toB] = parseFilenameTimeRange(b)

      if (fromA === fromB) {
        return toB - toA
      }
      return fromA - fromB
    })

    if (filesToImport.length === 0) {
      throw new Error(`No files found on ${dataDir}.`)
    }
    return filesToImport // Retorna el array de archivos ordenados
  } catch (readDirError) {
    if (readDirError.code === 'ENOENT') {
      return []
    } else {
      throw readDirError
    }
  }
}

async function processInterval (db, resource, asset, interval, processor, sync) {
  const dataDir = path.join(baseStorageDir, resource, asset.toLowerCase(), interval)
  let filesToImport = []
  let highestProcessedEndTime = -Infinity
  let filesProcessedCount = 0
  let recordsImportedCount = 0

  try {
    filesToImport = await getAndSortFilesToImport(dataDir)
  } catch (readDirError) {
    return { filesProcessed: 0, recordsImported: 0 }
  }

  for (const filename of filesToImport) {
    const jsonFilePath = path.join(dataDir, filename)
    const result = await processFile(db, asset, interval, processor, jsonFilePath, highestProcessedEndTime, sync)

    if (result.recordsImported > 0) {
      filesProcessedCount++
      recordsImportedCount += result.recordsImported
      if (result.endTime !== null) {
        highestProcessedEndTime = Math.max(highestProcessedEndTime, result.endTime)
      }
    }
  }

  return {
    filesProcessed: filesProcessedCount,
    recordsImported: recordsImportedCount
  }
}

async function handler () {
  const { resource: selectedResources, asset, interval: specifiedInterval, sync } = argv

  const db = connection()

  try {
    await db.connect()
    for (const resource of selectedResources) {
      const assetDataDir = path.join(baseStorageDir, resource, asset.toLowerCase())

      const intervalsToProcess = await getIntervalsToProcess(assetDataDir, specifiedInterval)

      if (intervalsToProcess.length === 0) {
        continue
      }

      const processor = processors[resource]
      for (const interval of intervalsToProcess) {
        console.log(`Importing ${resource} for ${asset} ${interval}`)
        await processInterval(db, resource, asset, interval, processor, sync)
      }
    }
  } catch (error) {
    console.error('-----------------------------------------')
    console.error('Critical error during execution:')
    console.error(error.message)
    console.error(error.stack)
    console.error('-----------------------------------------')
    if (db) {
      await db.disconnect()
    }
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
