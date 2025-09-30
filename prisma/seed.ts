import { AccessLevel, PermissionLevel, PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  const portfolioPermission = await prisma.portfolioPermission.create({
    data: {
      permission_level: PermissionLevel.all,
      access_level: AccessLevel.all
    }
  })

  const propertyPermission = await prisma.propertyPermission.create({
    data: {
      permission_level: PermissionLevel.all,
      access_level: AccessLevel.all
    }
  })

  const auditPermission = await prisma.auditPermission.create({
    data: {
      permission_level: PermissionLevel.all,
      access_level: AccessLevel.all
    }
  })

  const userPermission = await prisma.userPermission.create({
    data: {
      permission_level: PermissionLevel.all,
      access_level: AccessLevel.all
    }
  })

  const systemSettingsPermission = await prisma.systemSettingsPermission.create(
    {
      data: {
        permission_level: PermissionLevel.all,
        access_level: AccessLevel.all
      }
    }
  )

  console.log('Permissions created')

  const adminRole = await prisma.userRole.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Super administrator with full system access',
      is_external: false,
      portfolio_permission_id: portfolioPermission.id,
      property_permission_id: propertyPermission.id,
      audit_permission_id: auditPermission.id,
      user_permission_id: userPermission.id,
      system_settings_permission_id: systemSettingsPermission.id
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

  const portfolioPermissionPartial = await prisma.portfolioPermission.create({
    data: {
      permission_level: PermissionLevel.update,
      access_level: AccessLevel.partial
    }
  })

  const propertyPermissionPartial = await prisma.propertyPermission.create({
    data: {
      permission_level: PermissionLevel.update,
      access_level: AccessLevel.partial
    }
  })

  const auditPermissionView = await prisma.auditPermission.create({
    data: {
      permission_level: PermissionLevel.view,
      access_level: AccessLevel.all
    }
  })

  const userPermissionNone = await prisma.userPermission.create({
    data: {
      permission_level: PermissionLevel.view,
      access_level: AccessLevel.none
    }
  })

  const systemSettingsPermissionNone =
    await prisma.systemSettingsPermission.create({
      data: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.none
      }
    })

  const managerRole = await prisma.userRole.upsert({
    where: { name: 'Manager' },
    update: {},
    create: {
      name: 'Manager',
      description: 'Manager with partial access to portfolios and properties',
      is_external: false,
      portfolio_permission_id: portfolioPermissionPartial.id,
      property_permission_id: propertyPermissionPartial.id,
      audit_permission_id: auditPermissionView.id,
      user_permission_id: userPermissionNone.id,
      system_settings_permission_id: systemSettingsPermissionNone.id
    }
  })

  console.log('Manager role created:', managerRole)

  const viewerPortfolioPermission = await prisma.portfolioPermission.create({
    data: {
      permission_level: PermissionLevel.view,
      access_level: AccessLevel.partial
    }
  })

  const viewerPropertyPermission = await prisma.propertyPermission.create({
    data: {
      permission_level: PermissionLevel.view,
      access_level: AccessLevel.partial
    }
  })

  const viewerAuditPermission = await prisma.auditPermission.create({
    data: {
      permission_level: PermissionLevel.view,
      access_level: AccessLevel.partial
    }
  })

  const viewerUserPermission = await prisma.userPermission.create({
    data: {
      permission_level: PermissionLevel.view,
      access_level: AccessLevel.none
    }
  })

  const viewerSystemSettingsPermission =
    await prisma.systemSettingsPermission.create({
      data: {
        permission_level: PermissionLevel.view,
        access_level: AccessLevel.none
      }
    })

  const viewerRole = await prisma.userRole.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Viewer with read-only access to assigned resources',
      is_external: true,
      portfolio_permission_id: viewerPortfolioPermission.id,
      property_permission_id: viewerPropertyPermission.id,
      audit_permission_id: viewerAuditPermission.id,
      user_permission_id: viewerUserPermission.id,
      system_settings_permission_id: viewerSystemSettingsPermission.id
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
