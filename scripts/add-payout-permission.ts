import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Permission = {
  permission_level: string
  access_level: string
} | null

const SUPER_ADMIN_PERMISSION = {
  permission_level: 'all' as const,
  access_level: 'all' as const
}

const NO_ACCESS_PERMISSION = {
  permission_level: 'view' as const,
  access_level: 'none' as const
}

function isFullAccess(permission: Permission): boolean {
  return permission?.permission_level === 'all' && permission?.access_level === 'all'
}

/**
 * Migration script to add payout_permission to existing UserRoles.
 *
 * Payout is deliberately NOT copied from audit_permission: paying out is a money movement, so it
 * starts closed and is granted per role by hand. The one exception is full super admins, who would
 * otherwise lose access to a feature they already administer.
 */
async function addPayoutPermission() {
  try {
    console.log(
      'Starting migration to add payout_permission to existing user roles...\n'
    )

    const allRoles = await prisma.userRole.findMany({
      select: {
        id: true,
        name: true,
        portfolio_permission: true,
        property_permission: true,
        audit_permission: true,
        user_permission: true,
        system_settings_permission: true,
        bank_details_permission: true,
        payout_permission: true
      }
    })

    console.log(`Found ${allRoles.length} total roles\n`)

    let superAdminCount = 0
    let defaultedCount = 0
    let alreadyHasPermission = 0

    for (const role of allRoles) {
      if (role.payout_permission) {
        console.log(
          `Role "${role.name}" already has payout_permission - skipping`
        )
        alreadyHasPermission++
        continue
      }

      const isSuperAdmin = [
        role.portfolio_permission,
        role.property_permission,
        role.audit_permission,
        role.user_permission,
        role.system_settings_permission,
        role.bank_details_permission
      ].every(isFullAccess)

      if (isSuperAdmin) {
        await prisma.userRole.update({
          where: { id: role.id },
          data: { payout_permission: SUPER_ADMIN_PERMISSION }
        })
        console.log(
          `Role "${role.name}" is a full super admin - set payout_permission to all/all`
        )
        superAdminCount++
      } else {
        await prisma.userRole.update({
          where: { id: role.id },
          data: { payout_permission: NO_ACCESS_PERMISSION }
        })
        console.log(
          `Role "${role.name}" - set payout_permission to view/none (grant manually if needed)`
        )
        defaultedCount++
      }
    }

    console.log('\n========================================')
    console.log('Migration Summary:')
    console.log('========================================')
    console.log(`Total roles found: ${allRoles.length}`)
    console.log(`Roles already with payout_permission: ${alreadyHasPermission}`)
    console.log(`Super admin roles set to all/all: ${superAdminCount}`)
    console.log(`Roles set to default (view/none): ${defaultedCount}`)
    console.log('========================================')
    console.log(
      '\nMigration completed successfully! Users must sign out and back in for the new permission to appear in their session.'
    )
  } catch (error) {
    console.error('Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addPayoutPermission().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
