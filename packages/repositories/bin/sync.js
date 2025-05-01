#!/usr/bin/env node

import { DatabaseFactory } from '../src/db.js'
import { config } from '../src/config.js'
import { LiquidationRepository, VolumeRepository } from '../src/index.js'

async function syncMasterTables () {
  const db = DatabaseFactory.createConnection(config)
  try {
    await db.connect()
    console.log('Connected to database')

    // Sync liquidations
    console.log('Syncing liquidations...')
    const liquidationRepo = new LiquidationRepository(db)
    const liquidationsSynced = await liquidationRepo.syncFromBase()
    console.log(`Liquidations synced: ${liquidationsSynced} rows`)

    // Sync volume
    console.log('Syncing volume...')
    const volumeRepo = new VolumeRepository(db)
    const volumeSynced = await volumeRepo.syncFromBase()
    console.log(`Volume synced: ${volumeSynced} rows`)
  } catch (err) {
    console.error('Error syncing master tables:', err)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run the sync
syncMasterTables().catch(console.error)
