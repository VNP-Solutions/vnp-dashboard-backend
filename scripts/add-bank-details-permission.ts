import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Migration script to add bank_details_permission to existing UserRoles
 *
 * Strategy: Copy the property_permission settings to bank_details_permission
 * This maintains backward compatibility - users who could manage properties
 * will also be able to manage bank details by default.
 *
 * Uses raw MongoDB commands since Prisma doesn't support querying null composite types.
 */
async function addBankDetailsPermission() {
  try {
    console.log(
      'Starting migration to add bank_details_permission to existing user roles...\n'
    )

    // Step 1: Get all roles to check their current state
    const allRoles = await prisma.userRole.findMany({
      select: {
        id: true,
        name: true,
        property_permission: true,
        bank_details_permission: true
      }
    })

    console.log(`Found ${allRoles.length} total roles\n`)

    let updatedCount = 0
    let skippedCount = 0
    let alreadyHasPermission = 0

    for (const role of allRoles) {
      // Skip if role already has bank_details_permission
      if (role.bank_details_permission) {
        console.log(
          `⏭️  Role "${role.name}" already has bank_details_permission - skipping`
        )
        alreadyHasPermission++
        continue
      }

      if (role.property_permission) {
        // Copy property_permission to bank_details_permission
        await prisma.userRole.update({
          where: { id: role.id },
          data: {
            bank_details_permission: {
              permission_level: role.property_permission.permission_level,
              access_level: role.property_permission.access_level
            }
          }
        })
        console.log(
          `✅ Updated role "${role.name}" - copied property_permission (${role.property_permission.permission_level}/${role.property_permission.access_level}) to bank_details_permission`
        )
        updatedCount++
      } else {
        // Role has no property_permission, set bank_details_permission to view/none (no access)
        await prisma.userRole.update({
          where: { id: role.id },
          data: {
            bank_details_permission: {
              permission_level: 'view',
              access_level: 'none'
            }
          }
        })
        console.log(
          `⚠️  Role "${role.name}" has no property_permission - set bank_details_permission to view/none`
        )
        skippedCount++
      }
    }

    console.log('\n========================================')
    console.log('Migration Summary:')
    console.log('========================================')
    console.log(`Total roles found: ${allRoles.length}`)
    console.log(`Roles already with bank_details_permission: ${alreadyHasPermission}`)
    console.log(`Roles updated with copied permission: ${updatedCount}`)
    console.log(`Roles set to default (view/none): ${skippedCount}`)
    console.log('========================================')
    console.log('\nMigration completed successfully!')
  } catch (error) {
    console.error('Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addBankDetailsPermission().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
