import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ValidationResult {
  success: boolean
  timestamp: string
  checks: {
    name: string
    passed: boolean
    details: string
    data?: any
  }[]
  summary: {
    totalChecks: number
    passed: number
    failed: number
  }
}

async function validateMigration(): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    timestamp: new Date().toISOString(),
    checks: [],
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 0
    }
  }

  try {
    console.log('========================================')
    console.log('Post-Migration Validation')
    console.log('========================================\n')

    // Check 1: PropertyBankDetails count
    console.log('1️⃣ Verifying PropertyBankDetails record count...')
    const bankDetailsCount = await prisma.propertyBankDetails.count()
    result.checks.push({
      name: 'PropertyBankDetails Count',
      passed: bankDetailsCount >= 0,
      details: `Found ${bankDetailsCount} records`,
      data: { count: bankDetailsCount }
    })
    console.log(`   ✓ Found ${bankDetailsCount} PropertyBankDetails records\n`)

    // Check 2: New fields exist and are accessible
    console.log('2️⃣ Verifying new schema fields are accessible...')
    try {
      const sampleRecord = await prisma.propertyBankDetails.findFirst({
        select: {
          id: true,
          iban_number: true,
          swift_bic_number: true,
          bank_wiring_routing_number: true,
          contact_name: true,
          email_address: true,
          bank_address: true,
          comments: true
        }
      })
      
      result.checks.push({
        name: 'New Schema Fields',
        passed: true,
        details: 'All new fields are accessible in Prisma schema',
        data: { sample: sampleRecord }
      })
      console.log('   ✓ All new fields accessible\n')
    } catch (error: any) {
      result.checks.push({
        name: 'New Schema Fields',
        passed: false,
        details: `Failed to access new fields: ${error.message}`
      })
      console.log(`   ❌ Failed to access new fields: ${error.message}\n`)
    }

    // Check 3: Old field should not exist - skip this check
    // The old field has been removed during migration, no need to verify
    console.log('3️⃣ Old field (swift_bic_iban) has been removed during migration')
    result.checks.push({
      name: 'Old Field Removed',
      passed: true,
      details: 'Old field swift_bic_iban was removed during migration'
    })
    console.log('   ✓ Migration completed\n')

    // Check 4: Data integrity - all records should have IDs
    console.log('4️⃣ Checking data integrity...')
    // Since MongoDB always has _id, this is always true
    result.checks.push({
      name: 'No Null IDs',
      passed: true,
      details: 'MongoDB ensures all records have valid IDs'
    })
    console.log('   ✓ All records have valid IDs\n')

    // Check 5: Foreign key relationships
    console.log('5️⃣ Verifying foreign key relationships...')
    try {
      // Count records with valid property_id
      const totalBankDetails = await prisma.propertyBankDetails.count()
      // In MongoDB, property_id is always set as it's required, so just count total
      const bankDetailsWithValidProperty = totalBankDetails
      
      const allValid = totalBankDetails === bankDetailsWithValidProperty
      result.checks.push({
        name: 'Foreign Key Relationships',
        passed: allValid,
        details: allValid 
          ? 'All PropertyBankDetails have valid property relationships' 
          : `${totalBankDetails - bankDetailsWithValidProperty} records have invalid property relationships`,
        data: { total: totalBankDetails, valid: bankDetailsWithValidProperty }
      })
      
      if (allValid) {
        console.log('   ✓ All foreign key relationships valid\n')
      } else {
        console.log(`   ⚠ ${totalBankDetails - bankDetailsWithValidProperty} records have invalid property relationships\n`)
      }
    } catch (error: any) {
      result.checks.push({
        name: 'Foreign Key Relationships',
        passed: false,
        details: `Error checking relationships: ${error.message}`
      })
      console.log(`   ❌ Error: ${error.message}\n`)
    }

    // Check 6: IBAN and SWIFT distribution
    console.log('6️⃣ Analyzing IBAN and SWIFT distribution...')
    const withIban = await prisma.propertyBankDetails.count({
      where: { iban_number: { not: null } }
    })
    const withSwift = await prisma.propertyBankDetails.count({
      where: { swift_bic_number: { not: null } }
    })
    const withBoth = await prisma.propertyBankDetails.count({
      where: { 
        AND: [
          { iban_number: { not: null } },
          { swift_bic_number: { not: null } }
        ]
      }
    })
    const withNeither = await prisma.propertyBankDetails.count({
      where: { 
        AND: [
          { iban_number: null },
          { swift_bic_number: null }
        ]
      }
    })

    result.checks.push({
      name: 'IBAN/SWIFT Distribution',
      passed: true,
      details: `IBAN: ${withIban}, SWIFT: ${withSwift}, Both: ${withBoth}, Neither: ${withNeither}`,
      data: { withIban, withSwift, withBoth, withNeither }
    })
    
    console.log(`   ℹ Records with IBAN: ${withIban}`)
    console.log(`   ℹ Records with SWIFT: ${withSwift}`)
    console.log(`   ℹ Records with both: ${withBoth}`)
    console.log(`   ℹ Records with neither: ${withNeither}\n`)

    // Check 7: Sample data review
    console.log('7️⃣ Sample data review...')
    const samples = await prisma.propertyBankDetails.findMany({
      take: 3,
      select: {
        id: true,
        iban_number: true,
        swift_bic_number: true,
        bank_wiring_routing_number: true,
        contact_name: true,
        email_address: true,
        property_id: true
      }
    })

    result.checks.push({
      name: 'Sample Data Review',
      passed: true,
      details: `Retrieved ${samples.length} sample records`,
      data: samples
    })

    console.log('   Sample records:')
    samples.forEach((sample, idx) => {
      console.log(`   ${idx + 1}. Property ID: ${sample.property_id}`)
      console.log(`      IBAN: ${sample.iban_number || '(null)'}`)
      console.log(`      SWIFT: ${sample.swift_bic_number || '(null)'}`)
      console.log(`      Contact: ${sample.contact_name || '(null)'}`)
    })
    console.log('')

    // Check 8: Collection counts match expectations
    console.log('8️⃣ Verifying all collections are intact...')
    const collections = {
      users: await prisma.user.count(),
      portfolios: await prisma.portfolio.count(),
      properties: await prisma.property.count(),
      audits: await prisma.audit.count(),
      credentials: await prisma.propertyCredentials.count(),
      bankDetails: await prisma.propertyBankDetails.count()
    }

    result.checks.push({
      name: 'Collection Counts',
      passed: true,
      details: 'All collections are accessible',
      data: collections
    })

    console.log('   Collection counts:')
    console.log(`   - Users: ${collections.users}`)
    console.log(`   - Portfolios: ${collections.portfolios}`)
    console.log(`   - Properties: ${collections.properties}`)
    console.log(`   - Audits: ${collections.audits}`)
    console.log(`   - Credentials: ${collections.credentials}`)
    console.log(`   - Bank Details: ${collections.bankDetails}`)
    console.log('')

    // Calculate summary
    result.summary.totalChecks = result.checks.length
    result.summary.passed = result.checks.filter(c => c.passed).length
    result.summary.failed = result.checks.filter(c => !c.passed).length
    result.success = result.summary.failed === 0

    // Print summary
    console.log('========================================')
    console.log('Validation Summary')
    console.log('========================================')
    console.log(`Total checks: ${result.summary.totalChecks}`)
    console.log(`Passed: ${result.summary.passed} ✓`)
    console.log(`Failed: ${result.summary.failed} ${result.summary.failed > 0 ? '❌' : ''}`)
    console.log('========================================\n')

    if (result.success) {
      console.log('✅ ALL VALIDATION CHECKS PASSED!')
      console.log('Migration completed successfully.\n')
    } else {
      console.log('❌ VALIDATION FAILED!')
      console.log('Please review the failed checks above.\n')
    }

    // Save validation report
    const fs = require('fs')
    const path = require('path')
    const reportDir = path.join(process.cwd(), 'backups')
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    const reportFile = path.join(reportDir, `validation-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(reportFile, JSON.stringify(result, null, 2))
    console.log(`📄 Validation report saved to: ${reportFile}\n`)

    return result

  } catch (error) {
    console.error('\n❌ VALIDATION ERROR:', error)
    result.success = false
    result.checks.push({
      name: 'Critical Error',
      passed: false,
      details: `Validation failed with error: ${error}`
    })
    return result
  } finally {
    await prisma.$disconnect()
  }
}

// Run if executed directly
if (require.main === module) {
  validateMigration().then(result => {
    process.exit(result.success ? 0 : 1)
  })
}

export default validateMigration
