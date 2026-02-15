import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixDuplicateExpediaIds() {
  console.log('🔍 Starting to fix duplicate Expedia IDs...\n')

  try {
    // Get all property credentials first
    const allCredentialsRaw = await prisma.propertyCredentials.findMany({
      select: {
        id: true,
        expedia_id: true,
        property_id: true
      },
      orderBy: {
        property_id: 'asc'
      }
    })

    console.log(`📊 Total PropertyCredentials records: ${allCredentialsRaw.length}`)

    // Find all valid property IDs
    const validPropertyIds = new Set(
      (await prisma.property.findMany({
        select: { id: true }
      })).map(p => p.id)
    )

    console.log(`📊 Valid properties in database: ${validPropertyIds.size}\n`)

    // Filter out orphaned credentials
    const orphanedCredentials = allCredentialsRaw.filter(
      cred => !validPropertyIds.has(cred.property_id)
    )

    if (orphanedCredentials.length > 0) {
      console.log(`⚠️  Found ${orphanedCredentials.length} orphaned PropertyCredentials (property_id doesn't exist)`)
      console.log('These will be deleted to fix data integrity.\n')

      // Delete orphaned records
      for (const orphan of orphanedCredentials) {
        await prisma.propertyCredentials.delete({
          where: { id: orphan.id }
        })
        console.log(`  🗑️  Deleted orphaned credential: ${orphan.id} (property_id: ${orphan.property_id}, expedia_id: ${orphan.expedia_id})`)
      }
      console.log('')
    }

    // Get credentials with valid properties and their property details
    const validCredentials = await prisma.propertyCredentials.findMany({
      where: {
        id: {
          in: allCredentialsRaw
            .filter(cred => validPropertyIds.has(cred.property_id))
            .map(cred => cred.id)
        }
      },
      select: {
        id: true,
        expedia_id: true,
        property_id: true,
        property: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        property_id: 'asc'
      }
    })

    console.log(`📊 Valid properties with credentials: ${validCredentials.length}\n`)

    // Group by expedia_id to find duplicates
    const expediaIdGroups = new Map<string, typeof validCredentials>()

    for (const credential of validCredentials) {
      const expediaId = credential.expedia_id
      if (!expediaIdGroups.has(expediaId)) {
        expediaIdGroups.set(expediaId, [])
      }
      expediaIdGroups.get(expediaId)!.push(credential)
    }

    // Find only the groups with duplicates
    const duplicateGroups = Array.from(expediaIdGroups.entries()).filter(
      ([_, group]) => group.length > 1
    )

    console.log(`🔍 Found ${duplicateGroups.length} Expedia IDs with duplicates\n`)

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate Expedia IDs found. Nothing to fix!')
      return
    }

    let totalUpdated = 0

    // Process each group of duplicates
    for (const [originalExpediaId, group] of duplicateGroups) {
      console.log(
        `\n📝 Processing Expedia ID: "${originalExpediaId}" (${group.length} properties)`
      )

      // Keep the first one as-is, append letters to the rest
      for (let i = 0; i < group.length; i++) {
        const credential = group[i]

        if (i === 0) {
          // First occurrence - keep as is
          console.log(
            `  ✓ Property "${credential.property.name}" - keeping Expedia ID: ${originalExpediaId}`
          )
        } else {
          // Generate suffix: a, b, c, ..., z, aa, ab, etc.
          const suffix = generateSuffix(i - 1)
          const newExpediaId = `${originalExpediaId}${suffix}`

          console.log(
            `  → Property "${credential.property.name}" - updating to: ${newExpediaId}`
          )

          // Update the expedia_id
          await prisma.propertyCredentials.update({
            where: { id: credential.id },
            data: { expedia_id: newExpediaId }
          })

          totalUpdated++
        }
      }
    }

    console.log(`\n✅ Successfully updated ${totalUpdated} duplicate Expedia IDs!`)
    console.log(
      `📊 Summary: ${duplicateGroups.length} groups processed, ${totalUpdated} IDs updated`
    )
  } catch (error) {
    console.error('❌ Error fixing duplicate Expedia IDs:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Generate suffix for duplicate index
 * 0 -> 'a', 1 -> 'b', ..., 25 -> 'z', 26 -> 'aa', 27 -> 'ab', etc.
 */
function generateSuffix(index: number): string {
  let suffix = ''
  let num = index

  do {
    suffix = String.fromCharCode(97 + (num % 26)) + suffix
    num = Math.floor(num / 26) - 1
  } while (num >= 0)

  return suffix
}

// Run the script
fixDuplicateExpediaIds()
  .then(() => {
    console.log('\n✨ Script completed successfully!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
