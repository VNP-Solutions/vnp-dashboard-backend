import { AccessLevel, PermissionLevel, PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  const adminRole = await prisma.userRole.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Super administrator with full system access',
      is_external: false,
      portfolio_permission: {
        permission_level: PermissionLevel.all,
        access_level: AccessLevel.all
      },
      property_permission: {
        permission_level: PermissionLevel.all,
        access_level: AccessLevel.all
      },
      audit_permission: {
        permission_level: PermissionLevel.all,
        access_level: AccessLevel.all
      },
      user_permission: {
        permission_level: PermissionLevel.all,
        access_level: AccessLevel.all
      },
      system_settings_permission: {
        permission_level: PermissionLevel.all,
        access_level: AccessLevel.all
      }
    }
  })

  console.log('Admin role created:', adminRole)

  const hashedPassword = await bcrypt.hash('AluVaj!1*', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'naeemhasan28@gmail.com' },
    update: {},
    create: {
      email: 'naeemhasan28@gmail.com',
      first_name: 'Admin',
      last_name: 'User',
      language: 'en',
      user_role_id: adminRole.id,
      password: hashedPassword,
      is_verified: true
    }
  })

  console.log('Admin user created:', {
    id: adminUser.id,
    email: adminUser.email,
    name: `${adminUser.first_name} ${adminUser.last_name}`
  })

  await prisma.userAccessedProperty.upsert({
    where: { id: adminUser.id },
    update: {},
    create: {
      user_id: adminUser.id,
      portfolio_id: [],
      property_id: []
    }
  })

  const serviceType = await prisma.serviceType.upsert({
    where: { type: 'Hotel Management' },
    update: {},
    create: {
      type: 'Hotel Management',
      is_active: true
    }
  })

  console.log('Service type created:', serviceType)

  const currency = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      is_active: true
    }
  })

  console.log('Currency created:', currency)

  const managerRole = await prisma.userRole.upsert({
    where: { name: 'Manager' },
    update: {},
    create: {
      name: 'Manager',
      description: 'Manager with partial access to portfolios and properties',
      is_external: false,
      portfolio_permission: {
        permission_level: PermissionLevel.update,
        access_level: AccessLevel.partial
      },
      property_permission: {
        permission_level: PermissionLevel.update,
        access_level: AccessLevel.partial
      },
      audit_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.all
      },
      user_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.none
      },
      system_settings_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.none
      }
    }
  })

  console.log('Manager role created:', managerRole)

  const viewerRole = await prisma.userRole.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Viewer with read-only access to assigned resources',
      is_external: true,
      portfolio_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.partial
      },
      property_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.partial
      },
      audit_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.partial
      },
      user_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.none
      },
      system_settings_permission: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.none
      }
    }
  })

  console.log('Viewer role created:', viewerRole)

  const auditStatus = await prisma.auditStatus.upsert({
    where: { id: 'pending' },
    update: {},
    create: {
      status: 'Pending'
    }
  })

  console.log('Audit status created:', auditStatus)

  console.log('Seed completed successfully!')
}

main()
  .catch(e => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
