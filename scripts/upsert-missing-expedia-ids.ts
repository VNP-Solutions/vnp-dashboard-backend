/**
 * Upsert PropertyCredentials expedia_id (and optional booking_id) from
 * data/missing_expedia_id_properties.json.
 *
 * Usage:
 *   yarn upsert:expedia-ids              # dry-run (default)
 *   yarn upsert:expedia-ids -- --apply   # write changes
 *   yarn upsert:expedia-ids -- --apply --file=./data/missing_expedia_id_properties.json
 */
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'

config({ path: resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

type JsonRow = {
  propertyId: string
  expediaId: string | null
  bookingId?: string | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const fileArg = args.find(a => a.startsWith('--file='))
  const file = fileArg
    ? resolve(process.cwd(), fileArg.slice('--file='.length))
    : resolve(process.cwd(), 'data/missing_expedia_id_properties.json')
  return { apply, file }
}

async function main() {
  const { apply, file } = parseArgs()
  const mode = apply ? 'APPLY' : 'DRY-RUN'

  console.log(`\nUpsert missing Expedia IDs [${mode}]`)
  console.log(`JSON: ${file}\n`)

  const rows = JSON.parse(readFileSync(file, 'utf8')) as JsonRow[]
  if (!Array.isArray(rows)) {
    throw new Error('JSON root must be an array')
  }

  const summary = {
    total: rows.length,
    skippedNoExpediaId: 0,
    propertyNotFound: 0,
    expediaIdConflict: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0
  }

  for (const row of rows) {
    const propertyId = row.propertyId?.trim()
    const expediaId =
      row.expediaId == null ? null : String(row.expediaId).trim()
    const bookingId =
      row.bookingId == null || row.bookingId === ''
        ? null
        : String(row.bookingId).trim()

    if (!propertyId) {
      console.log('  SKIP  missing propertyId in row')
      summary.errors++
      continue
    }

    if (!expediaId) {
      console.log(
        `  SKIP  ${propertyId} — no expediaId in JSON (nothing to write)`
      )
      summary.skippedNoExpediaId++
      continue
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        credentials: {
          select: {
            id: true,
            expedia_id: true,
            booking_id: true
          }
        }
      }
    })

    if (!property) {
      console.log(`  MISS  ${propertyId} — property not found in DB`)
      summary.propertyNotFound++
      continue
    }

    // Unique expedia_id: another property already owns this id
    const conflict = await prisma.propertyCredentials.findFirst({
      where: {
        expedia_id: expediaId,
        NOT: { property_id: propertyId }
      },
      select: {
        property_id: true,
        property: { select: { name: true } }
      }
    })

    if (conflict) {
      console.log(
        `  CONFLICT  ${property.name} (${propertyId}) — expedia_id "${expediaId}" already on ${conflict.property.name} (${conflict.property_id})`
      )
      summary.expediaIdConflict++
      continue
    }

    const existing = property.credentials

    if (!existing) {
      console.log(
        `  CREATE  ${property.name} (${propertyId}) → expedia_id=${expediaId}` +
          (bookingId ? `, booking_id=${bookingId}` : '')
      )
      if (apply) {
        try {
          await prisma.propertyCredentials.create({
            data: {
              property_id: propertyId,
              expedia_id: expediaId,
              ...(bookingId ? { booking_id: bookingId } : {})
            }
          })
          summary.created++
        } catch (err) {
          console.error(`  ERROR   create failed for ${propertyId}:`, err)
          summary.errors++
        }
      } else {
        summary.created++
      }
      continue
    }

    const needsExpediaUpdate = existing.expedia_id !== expediaId
    const needsBookingUpdate =
      bookingId != null && existing.booking_id !== bookingId

    if (!needsExpediaUpdate && !needsBookingUpdate) {
      console.log(
        `  OK      ${property.name} (${propertyId}) — already expedia_id=${existing.expedia_id}`
      )
      summary.unchanged++
      continue
    }

    const changes: string[] = []
    if (needsExpediaUpdate) {
      changes.push(`expedia_id: "${existing.expedia_id}" → "${expediaId}"`)
    }
    if (needsBookingUpdate) {
      changes.push(
        `booking_id: "${existing.booking_id ?? ''}" → "${bookingId}"`
      )
    }

    console.log(
      `  UPDATE  ${property.name} (${propertyId}) — ${changes.join(', ')}`
    )

    if (apply) {
      try {
        await prisma.propertyCredentials.update({
          where: { property_id: propertyId },
          data: {
            expedia_id: expediaId,
            ...(needsBookingUpdate ? { booking_id: bookingId } : {})
          }
        })
        summary.updated++
      } catch (err) {
        console.error(`  ERROR   update failed for ${propertyId}:`, err)
        summary.errors++
      }
    } else {
      summary.updated++
    }
  }

  console.log('\n--- Summary ---')
  console.log(`  total rows:              ${summary.total}`)
  console.log(`  skipped (no expediaId):  ${summary.skippedNoExpediaId}`)
  console.log(`  property not found:     ${summary.propertyNotFound}`)
  console.log(`  expedia_id conflicts:   ${summary.expediaIdConflict}`)
  console.log(`  would create / created: ${summary.created}`)
  console.log(`  would update / updated: ${summary.updated}`)
  console.log(`  unchanged:              ${summary.unchanged}`)
  console.log(`  errors:                 ${summary.errors}`)
  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to write changes.')
  } else {
    console.log('\nDone.')
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
