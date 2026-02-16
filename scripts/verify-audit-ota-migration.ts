import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Helper script to verify the migration worked correctly
 * Run after applying code changes
 */
async function verifyMigration() {
  console.log('🔍 Verifying audit OTA type migration...\n')

  try {
    // 1. Check sample audits
    const audits = await prisma.audit.findMany({
      take: 10,
      select: {
        id: true,
        type_of_ota: true,
        property: {
          select: {
            name: true
          }
        }
      }
    })

    console.log(`📊 Sample of ${audits.length} audits:`)
    audits.forEach(audit => {
      const otaTypes = Array.isArray(audit.type_of_ota) 
        ? audit.type_of_ota 
        : [audit.type_of_ota].filter(Boolean)
      
      console.log(`  - ${audit.property.name}: [${otaTypes.join(', ')}]`)
    })

    // 2. Check for any audits with duplicate values in array
    const allAudits = await prisma.audit.findMany({
      select: {
        id: true,
        type_of_ota: true
      }
    })

    let duplicatesFound = 0
    for (const audit of allAudits) {
      if (Array.isArray(audit.type_of_ota)) {
        const unique = new Set(audit.type_of_ota)
        if (unique.size !== audit.type_of_ota.length) {
          console.warn(`⚠️  Audit ${audit.id} has duplicate OTA types:`, audit.type_of_ota)
          duplicatesFound++
        }
      }
    }

    if (duplicatesFound === 0) {
      console.log('\n✅ No duplicate OTA types found in arrays')
    } else {
      console.log(`\n⚠️  Found ${duplicatesFound} audits with duplicate OTA types`)
    }

    // 3. Check statistics
    const totalAudits = await prisma.audit.count()
    const auditsWithOta = await prisma.audit.count({
      where: {
        type_of_ota: {
          isEmpty: false
        }
      }
    })
    const auditsWithoutOta = totalAudits - auditsWithOta

    console.log('\n📈 Statistics:')
    console.log(`  Total audits: ${totalAudits}`)
    console.log(`  With OTA types: ${auditsWithOta}`)
    console.log(`  Without OTA types: ${auditsWithoutOta}`)

    console.log('\n✅ Migration verification complete!')
  } catch (error) {
    console.error('❌ Verification failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run verification
verifyMigration()
  .then(() => {
    console.log('\n✨ Script completed successfully!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
