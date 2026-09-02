/**
 * Backfills the OTA access levels (expedia/booking/agoda) onto dashboard
 * properties from DBMS, which owns those values.
 *
 * Why this exists: the DBMS -> dashboard property sync is event-driven. It only
 * fires when a property is created, updated, imported or bulk-updated in DBMS,
 * and there is no reconciliation job anywhere. So every property that nobody
 * happens to edit would sit at null on the dashboard indefinitely. Run this
 * once after the sync change ships, and again any time a sync batch is
 * suspected to have failed silently.
 *
 * It writes ONLY the three access level fields. It deliberately does not reuse
 * the property sync path, which would also rewrite name, address, currency and
 * credentials, decrypt every stored password, and can fail on name conflicts.
 *
 * Join key: dashboard `Property.parent_id` holds the DBMS property `_id` as a
 * string. Dashboard properties without a parent_id were created directly here
 * and have no DBMS counterpart, so they are left alone.
 *
 * Usage:
 *   npm run backfill:access-levels -- --dry-run   # report only, no writes
 *   npm run backfill:access-levels                # apply
 *
 * Requires DBMS_DATABASE_URL in .env (read-only use) alongside the usual
 * DATABASE_URL for this service.
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { MongoClient, ObjectId } from 'mongodb'
import { ColoredLogger } from '../src/common/utils/colored-logger.util'

config()

const prisma = new PrismaClient()
const logger = new ColoredLogger('BackfillPropertyAccessLevels')
const dryRun = process.argv.includes('--dry-run')

const ACCESS_LEVEL_FIELDS = [
  'expedia_access_level',
  'booking_access_level',
  'agoda_access_level'
] as const

type AccessLevelField = (typeof ACCESS_LEVEL_FIELDS)[number]
type AccessLevels = Record<AccessLevelField, boolean | null>

/** Mongo stores nothing at all for fields that were never set; treat that as null. */
function readAccessLevels(doc: Record<string, unknown>): AccessLevels {
  return {
    expedia_access_level: (doc.expedia_access_level as boolean) ?? null,
    booking_access_level: (doc.booking_access_level as boolean) ?? null,
    agoda_access_level: (doc.agoda_access_level as boolean) ?? null
  }
}

function isSameAccessLevels(a: AccessLevels, b: AccessLevels): boolean {
  return ACCESS_LEVEL_FIELDS.every(field => a[field] === b[field])
}

function describe(levels: AccessLevels): string {
  return ACCESS_LEVEL_FIELDS.map(
    field => `${field.replace('_access_level', '')}=${String(levels[field])}`
  ).join(' ')
}

async function backfillPropertyAccessLevels(): Promise<void> {
  const dbmsUrl = process.env.DBMS_DATABASE_URL
  if (!dbmsUrl) {
    throw new Error(
      'Missing DBMS_DATABASE_URL. Add the DBMS MongoDB connection string to .env — ' +
        'this script reads access levels from DBMS and writes them here.'
    )
  }

  logger.info(
    `Starting property access level backfill${dryRun ? ' (dry run)' : ''}...`
  )

  const dbmsClient = new MongoClient(dbmsUrl, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  })

  let matchedCount = 0
  let updatedCount = 0
  let alreadyCorrectCount = 0
  let unmatchedCount = 0
  let noParentIdCount = 0
  let errorCount = 0

  try {
    await dbmsClient.connect()
    logger.info(`Connected to DBMS ("${dbmsClient.db().databaseName}")`)

    const dashboardProperties = await prisma.property.findMany({
      select: {
        id: true,
        name: true,
        parent_id: true,
        expedia_access_level: true,
        booking_access_level: true,
        agoda_access_level: true
      }
    })
    logger.info(`Found ${dashboardProperties.length} dashboard property(ies)`)

    // One read of the DBMS side, keyed by _id, rather than a query per row.
    const dbmsDocs = await dbmsClient
      .db()
      .collection('Property')
      .find(
        {},
        {
          projection: {
            _id: 1,
            expedia_access_level: 1,
            booking_access_level: 1,
            agoda_access_level: 1
          }
        }
      )
      .toArray()
    logger.info(`Found ${dbmsDocs.length} DBMS property(ies)`)

    const dbmsById = new Map<string, AccessLevels>(
      dbmsDocs.map(doc => [
        (doc._id as ObjectId).toHexString(),
        readAccessLevels(doc)
      ])
    )

    for (const property of dashboardProperties) {
      if (!property.parent_id) {
        noParentIdCount++
        continue
      }

      const source = dbmsById.get(property.parent_id)
      if (!source) {
        unmatchedCount++
        logger.warn(
          `  No DBMS property for parent_id ${property.parent_id} ("${property.name}") — skipping`
        )
        continue
      }

      matchedCount++

      const current = readAccessLevels(property as Record<string, unknown>)
      if (isSameAccessLevels(current, source)) {
        alreadyCorrectCount++
        continue
      }

      if (dryRun) {
        logger.warn(
          `  [dry run] Would update "${property.name}": ${describe(current)} -> ${describe(source)}`
        )
        updatedCount++
        continue
      }

      try {
        await prisma.property.update({
          where: { id: property.id },
          data: source
        })
        logger.success(`  Updated "${property.name}": ${describe(source)}`)
        updatedCount++
      } catch (error) {
        errorCount++
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error(`  Failed "${property.name}": ${message}`)
      }
    }

    logger.info('--- Summary ---')
    logger.info(`Dashboard properties: ${dashboardProperties.length}`)
    logger.info(`Matched to DBMS: ${matchedCount}`)
    logger.info(`${dryRun ? 'Would update' : 'Updated'}: ${updatedCount}`)
    logger.info(`Already correct: ${alreadyCorrectCount}`)
    logger.info(`No parent_id (dashboard-only): ${noParentIdCount}`)
    logger.info(`Unmatched parent_id: ${unmatchedCount}`)
    logger.info(`Errors: ${errorCount}`)
    logger.success(`Backfill complete${dryRun ? ' (dry run — nothing written)' : ''}`)
  } finally {
    await dbmsClient.close()
  }
}

backfillPropertyAccessLevels()
  .catch(error => {
    logger.error(
      `Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
