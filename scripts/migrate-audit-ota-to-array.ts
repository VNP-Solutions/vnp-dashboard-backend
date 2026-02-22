import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateAuditOtaTypeToArray() {
  console.log('Starting migration: Converting type_of_ota from single value to array...')

  try {
    // Fetch all audits from MongoDB
    const audits = await prisma.audit.findMany({
      select: {
        id: true,
        type_of_ota: true
      }
    })

    console.log(`Found ${audits.length} audits to process`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const audit of audits) {
      try {
        // MongoDB stores the old single value as a string
        // We need to convert it to an array
        const rawAudit = audit as any

        // Check if type_of_ota exists and is not already an array
        if (rawAudit.type_of_ota !== null && rawAudit.type_of_ota !== undefined) {
          if (Array.isArray(rawAudit.type_of_ota)) {
            console.log(`Audit ${audit.id}: Already an array, skipping`)
            skippedCount++
            continue
          }

          // Convert single value to array
          const singleValue = rawAudit.type_of_ota
          const arrayValue = [singleValue]

          // Update using raw MongoDB query to handle the type conversion
          await prisma.$runCommandRaw({
            update: 'Audit',
            updates: [
              {
                q: { _id: { $oid: audit.id } },
                u: { $set: { type_of_ota: arrayValue } }
              }
            ]
          })

          console.log(`Audit ${audit.id}: Converted "${singleValue}" to ["${singleValue}"]`)
          updatedCount++
        } else {
          // If null or undefined, set to empty array
          await prisma.$runCommandRaw({
            update: 'Audit',
            updates: [
              {
                q: { _id: { $oid: audit.id } },
                u: { $set: { type_of_ota: [] } }
              }
            ]
          })

          console.log(`Audit ${audit.id}: Set null/undefined to []`)
          updatedCount++
        }
      } catch (error) {
        console.error(`Error processing audit ${audit.id}:`, error)
        errorCount++
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total audits processed: ${audits.length}`)
    console.log(`Successfully updated: ${updatedCount}`)
    console.log(`Already arrays (skipped): ${skippedCount}`)
    console.log(`Errors: ${errorCount}`)
    console.log('========================\n')

    if (errorCount > 0) {
      console.warn('⚠️  Migration completed with some errors. Please review the logs above.')
    } else {
      console.log('✅ Migration completed successfully!')
    }
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateAuditOtaTypeToArray()
  .then(() => {
    console.log('Migration script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
