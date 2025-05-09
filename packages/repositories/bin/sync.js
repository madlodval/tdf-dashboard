#!/usr/bin/env node

import { LiquidationRepository, VolumeRepository, OpenInterestRepository, connection } from '../src/index.js'

async function syncMasterTables () {
  const db = connection()
  try {
    await db.connect()
    const oiSynced = await new OpenInterestRepository(db).syncFromBase()
    console.log(`Volume synced: ${oiSynced} rows`)

    const volumeSynced = await new VolumeRepository(db).syncFromBase()
    console.log(`Volume synced: ${volumeSynced} rows`)

    const liquidationsSynced = await new LiquidationRepository(db)
      .syncFromBase()
    console.log(`Liquidations synced: ${liquidationsSynced} rows`)
  } catch (err) {
    console.error('Error syncing master tables:', err)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run the sync
syncMasterTables().catch(console.error)
