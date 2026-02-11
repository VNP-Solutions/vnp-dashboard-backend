import { MongoClient } from 'mongodb'
import * as dotenv from 'dotenv'

dotenv.config()

interface MigrationResult {
  totalRecords: number
  migrated: number
  skipped: number
  errors: number
  details: Array<{
    id: string
    oldValue: string | null
    newIban: string | null
    newSwift: string | null
    action: string
  }>
}

/**
 * Determines if a string is likely an IBAN number
 */
function isIBAN(value: string): boolean {
  if (!value || value.length < 15 || value.length > 34) {
    return false
  }
  const ibanPattern = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/i
  return ibanPattern.test(value)
}

/**
 * Determines if a string is likely a SWIFT/BIC code
 */
function isSWIFT(value: string): boolean {
  if (!value) return false
  const length = value.length
  if (length !== 8 && length !== 11) return false
  const swiftPattern = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/i
  return swiftPattern.test(value)
}

/**
 * Intelligently splits swift_bic_iban into iban_number and swift_bic_number
 */
function parseSwiftBicIban(value: string | null | undefined): {
  iban_number: string | null
  swift_bic_number: string | null
} {
  if (!value || value.trim() === '') {
    return { iban_number: null, swift_bic_number: null }
  }

  const trimmedValue = value.trim()

  if (isIBAN(trimmedValue)) {
    return { iban_number: trimmedValue, swift_bic_number: null }
  }

  if (isSWIFT(trimmedValue)) {
    return { iban_number: null, swift_bic_number: trimmedValue }
  }

  console.log(`  ⚠ Ambiguous format: "${trimmedValue}" - defaulting to SWIFT/BIC`)
  return { iban_number: null, swift_bic_number: trimmedValue }
}

async function migrateWithMongoDB(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalRecords: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    details: []
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment variables')
  }

  const client = new MongoClient(dbUrl)

  try {
    console.log('========================================')
    console.log('PropertyBankDetails Migration (MongoDB Direct)')
    console.log('========================================\n')

    await client.connect()
    console.log('✓ Connected to MongoDB\n')

    const db = client.db()
    const collection = db.collection('PropertyBankDetails')

    // Count total records
    result.totalRecords = await collection.countDocuments()
    console.log(`📊 Found ${result.totalRecords} PropertyBankDetails records\n`)

    if (result.totalRecords === 0) {
      console.log('✓ No records to migrate')
      return result
    }

    // Fetch all records
    const records = await collection.find({}).toArray()
    console.log('🔄 Processing records...\n')

    // Process each record
    for (const record of records) {
      try {
        const oldValue = record.swift_bic_iban || null
        const { iban_number, swift_bic_number } = parseSwiftBicIban(oldValue)

        // Update with new fields
        await collection.updateOne(
          { _id: record._id },
          {
            $set: {
              iban_number,
              swift_bic_number,
              bank_wiring_routing_number: null,
              contact_name: null,
              email_address: null,
              bank_address: null,
              comments: null
            },
            $unset: {
              swift_bic_iban: '' // Remove old field
            }
          }
        )

        result.migrated++
        result.details.push({
          id: record._id.toString(),
          oldValue,
          newIban: iban_number,
          newSwift: swift_bic_number,
          action: 'migrated'
        })

        const displayOld = oldValue || '(empty)'
        const displayNew = iban_number
          ? `IBAN: ${iban_number}`
          : swift_bic_number
          ? `SWIFT: ${swift_bic_number}`
          : '(both null)'

        console.log(`  ✓ ${record._id.toString().substring(0, 8)}... | ${displayOld} → ${displayNew}`)

      } catch (error: any) {
        result.errors++
        console.error(`  ❌ Failed to migrate record ${record._id}:`, error.message)
        result.details.push({
          id: record._id.toString(),
          oldValue: record.swift_bic_iban || null,
          newIban: null,
          newSwift: null,
          action: `error: ${error.message}`
        })
      }
    }

    // Summary
    console.log('\n========================================')
    console.log('Migration Summary')
    console.log('========================================')
    console.log(`Total records:         ${result.totalRecords}`)
    console.log(`Successfully migrated: ${result.migrated}`)
    console.log(`Skipped:               ${result.skipped}`)
    console.log(`Errors:                ${result.errors}`)
    console.log('========================================\n')

    if (result.errors > 0) {
      console.log('⚠ WARNING: Some records failed to migrate!')
      console.log('Review the errors above before proceeding.\n')
    } else {
      console.log('✅ All records migrated successfully!')
      console.log('You can now proceed with: yarn push\n')
    }

    // Save log
    const fs = require('fs')
    const path = require('path')
    const logDir = path.join(process.cwd(), 'backups')
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    const logFile = path.join(logDir, `migration-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(logFile, JSON.stringify(result, null, 2))
    console.log(`📄 Migration log: ${logFile}\n`)

    return result

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error)
    console.error('Review the error and consider restoring from backup.')
    process.exit(1)
  } finally {
    await client.close()
    console.log('✓ MongoDB connection closed')
  }
}

if (require.main === module) {
  migrateWithMongoDB()
}

export default migrateWithMongoDB
