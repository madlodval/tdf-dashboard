#!/usr/bin/env node

import { LiquidationRepository, VolumeRepository, OpenInterestRepository, connection, AssetRepository } from '../src/index.js'

async function syncMasterTables (asset) {
  const db = connection()
  try {
    await db.connect()
    // await db.transaction(async () => {
    const assetRepo = new AssetRepository(db)
    const assetId = await assetRepo.findIdBySymbol(asset)
    if (!assetId) {
      console.error(`Asset ${asset} not found`)
      process.exit(1)
    }

    const oiSynced = await new OpenInterestRepository(db).syncFromBase({
      assetId
    })
    console.log(`OI synced: ${oiSynced} rows`)

    const volumeSynced = await new VolumeRepository(db).syncFromBase({
      assetId
    })
    console.log(`VL synced: ${volumeSynced} rows`)

    const liquidationsSynced = await new LiquidationRepository(db)
      .syncFromBase({
        assetId
      })
    console.log(`LQ synced: ${liquidationsSynced} rows`)
    // })
  } catch (err) {
    console.error('Error syncing master tables:', err)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}
const args = process.argv.slice(2)

const assetParam = args[0] ? args[0].toUpperCase() : undefined

if (!assetParam) {
  console.error('Please provide an asset symbol as the first argument')
  process.exit(1)
}

syncMasterTables(assetParam).catch(console.error)
