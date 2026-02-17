import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function revertAuditOtaTypeToSingleValue() {
  console.log(
    'Starting REVERT migration: Converting type_of_ota from array back to single value...'
  )
  console.log(
    '⚠️  WARNING: This will revert the array structure back to single value!'
  )
  console.log(
    '⚠️  If an audit has multiple OTA types, only the FIRST one will be kept!\n'
  )

  try {
    // Fetch all audits from MongoDB
    const audits = await prisma.audit.findMany({
      select: {
        id: true,
        type_of_ota: true
      }
    })

    console.log(`Found ${audits.length} audits to process\n`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    let multipleValueWarnings = 0

    for (const audit of audits) {
      try {
        const rawAudit = audit as any

        // Check if type_of_ota exists
        if (
          rawAudit.type_of_ota !== null &&
          rawAudit.type_of_ota !== undefined
        ) {
          // If it's already a single value (not an array), skip
          if (!Array.isArray(rawAudit.type_of_ota)) {
            console.log(`Audit ${audit.id}: Already a single value, skipping`)
            skippedCount++
            continue
          }

          // If it's an array
          const arrayValue = rawAudit.type_of_ota as any[]

          if (arrayValue.length === 0) {
            // Empty array -> set to null
            await prisma.$runCommandRaw({
              update: 'Audit',
              updates: [
                {
                  q: { _id: { $oid: audit.id } },
                  u: { $set: { type_of_ota: null } }
                }
              ]
            })

            console.log(`Audit ${audit.id}: Converted empty array [] to null`)
            updatedCount++
          } else {
            // Take the first value from the array
            const singleValue = arrayValue[0]

            // Warn if there were multiple values
            if (arrayValue.length > 1) {
              console.warn(
                `⚠️  Audit ${audit.id}: Had ${arrayValue.length} OTA types [${arrayValue.join(', ')}], keeping only the first: "${singleValue}"`
              )
              multipleValueWarnings++
            }

            // Update using raw MongoDB query to handle the type conversion
            await prisma.$runCommandRaw({
              update: 'Audit',
              updates: [
                {
                  q: { _id: { $oid: audit.id } },
                  u: { $set: { type_of_ota: singleValue } }
                }
              ]
            })

            if (arrayValue.length === 1) {
              console.log(
                `Audit ${audit.id}: Converted ["${singleValue}"] to "${singleValue}"`
              )
            }
            updatedCount++
          }
        } else {
          // If null or undefined, keep it as null
          await prisma.$runCommandRaw({
            update: 'Audit',
            updates: [
              {
                q: { _id: { $oid: audit.id } },
                u: { $set: { type_of_ota: null } }
              }
            ]
          })

          console.log(`Audit ${audit.id}: Kept null/undefined as null`)
          updatedCount++
        }
      } catch (error) {
        console.error(`Error processing audit ${audit.id}:`, error)
        errorCount++
      }
    }

    console.log('\n=== REVERT Migration Summary ===')
    console.log(`Total audits processed: ${audits.length}`)
    console.log(`Successfully reverted: ${updatedCount}`)
    console.log(`Already single values (skipped): ${skippedCount}`)
    console.log(
      `Audits with multiple OTA types (data loss): ${multipleValueWarnings}`
    )
    console.log(`Errors: ${errorCount}`)
    console.log('================================\n')

    if (multipleValueWarnings > 0) {
      console.warn(
        `⚠️  WARNING: ${multipleValueWarnings} audit(s) had multiple OTA types. Only the first value was kept!`
      )
    }

    if (errorCount > 0) {
      console.warn(
        '⚠️  Migration completed with some errors. Please review the logs above.'
      )
    } else {
      console.log('✅ Revert migration completed successfully!')
    }

    console.log('\n📝 NEXT STEPS:')
    console.log(
      '1. Update your Prisma schema to change type_of_ota from OtaType[] back to OtaType?'
    )
    console.log('2. Run: yarn generate')
    console.log('3. Run: yarn push')
    console.log('4. Restart your application')
  } catch (error) {
    console.error('Revert migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the revert migration
revertAuditOtaTypeToSingleValue()
  .then(() => {
    console.log('\nRevert migration script finished')
    process.exit(0)
  })
  .catch(error => {
    console.error('\nRevert migration script failed:', error)
    process.exit(1)
  })
