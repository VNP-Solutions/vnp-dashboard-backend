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
