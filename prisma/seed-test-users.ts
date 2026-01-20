import { PrismaClient, UserRole, User, PermissionLevel, AccessLevel } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEST_PASSWORD = 'AluVaj!1*'
const SALT_ROUNDS = 10

interface UserWithRoleName extends User {
  role_name: string
}

interface RoleData {
  name: string
  description: string
  is_external: boolean
  is_active: boolean
  order: number
  portfolio_permission: {
    set: {
      permission_level: PermissionLevel
      access_level: AccessLevel
    }
  }
  property_permission: {
    set: {
      permission_level: PermissionLevel
      access_level: AccessLevel
    }
  }
  audit_permission: {
    set: {
      permission_level: PermissionLevel
      access_level: AccessLevel
    }
  }
  user_permission: {
    set: {
      permission_level: PermissionLevel
      access_level: AccessLevel
    }
  }
  system_settings_permission: {
    set: {
      permission_level: PermissionLevel
      access_level: AccessLevel
    }
  }
  bank_details_permission: {
    set: {
      permission_level: PermissionLevel
      access_level: AccessLevel
    }
  }
}

/**
 * Seed script for creating test users and roles.
 * This script creates a comprehensive set of roles and users for testing
 * the invitation hierarchy and permission system.
 *
 * All users have the same password: AluVaj!1*
 */
async function main() {
  console.log('🌱 Starting test users and roles seed...\n')

  // Hash the test password once for reuse
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS)

  // ========================================
  // Step 1: Create User Roles
  // ========================================
  console.log('📋 Creating user roles...')

  const roles = await createRoles()
  console.log(`✅ Created ${roles.length} roles\n`)

  // Print roles summary
  console.log('📊 Roles Summary:')
  roles.forEach((role) => {
    console.log(`  - ${role.name} (${role.is_external ? 'External' : 'Internal'})`)
  })
  console.log('')

  // ========================================
  // Step 2: Create Users
  // ========================================
  console.log('👥 Creating test users...')

  const users = await createUsers(roles, hashedPassword)
  console.log(`✅ Created ${users.length} users\n`)

  // ========================================
  // Step 3: Grant Partial Access
  // ========================================
  console.log('🔐 Setting up partial access constraints...')

  await setupPartialAccess(users, roles)
  console.log('✅ Partial access configured\n')

  // ========================================
  // Final Summary
  // ========================================
  printTestSummary(users, roles)

  console.log('\n✨ Test seed completed successfully!\n')
}

/**
 * Create all test roles with various permission levels
 */
async function createRoles(): Promise<UserRole[]> {
  const roleData: RoleData[] = [
    // ===== INTERNAL ROLES =====
    {
      name: 'Super Admin',
      description: 'Full system access with all permissions',
      is_external: false,
      is_active: true,
      order: 1,
      portfolio_permission: {
        set: {
          permission_level: 'all',
          access_level: 'all'
        }
      },
      property_permission: {
        set: {
          permission_level: 'all',
          access_level: 'all'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'all',
          access_level: 'all'
        }
      },
      user_permission: {
        set: {
          permission_level: 'all',
          access_level: 'all'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'all',
          access_level: 'all'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'all',
          access_level: 'all'
        }
      }
    },
    {
      name: 'Portfolio Manager',
      description: 'Manage portfolios and properties with full access',
      is_external: false,
      is_active: true,
      order: 2,
      portfolio_permission: {
        set: {
          permission_level: 'all',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'update',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'update',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'update',
          access_level: 'partial'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'all'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      }
    },
    {
      name: 'Property Manager',
      description: 'Manage properties with limited user management',
      is_external: false,
      is_active: true,
      order: 3,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'all',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'update',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      }
    },
    {
      name: 'Auditor',
      description: 'View and manage audits only',
      is_external: false,
      is_active: true,
      order: 4,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'all',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      }
    },
    {
      name: 'Team Member',
      description: 'Basic team member with view access',
      is_external: false,
      is_active: true,
      order: 5,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      }
    },
    {
      name: 'Viewer',
      description: 'Read-only access to most resources',
      is_external: false,
      is_active: true,
      order: 6,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      }
    },

    // ===== EXTERNAL ROLES =====
    {
      name: 'External Auditor',
      description: 'External auditor with audit management access',
      is_external: true,
      is_active: true,
      order: 7,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'update',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      }
    },
    {
      name: 'External Collaborator',
      description: 'External team member with limited access',
      is_external: true,
      is_active: true,
      order: 8,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      property_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'view',
          access_level: 'partial'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      }
    },
    {
      name: 'External Viewer',
      description: 'External read-only access',
      is_external: true,
      is_active: true,
      order: 9,
      portfolio_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      property_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      audit_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      user_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      system_settings_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      },
      bank_details_permission: {
        set: {
          permission_level: 'view',
          access_level: 'none'
        }
      }
    }
  ]

  const createdRoles: UserRole[] = []

  for (const data of roleData) {
    const role = await prisma.userRole.upsert({
      where: { name: data.name },
      update: data,
      create: data
    })
    createdRoles.push(role)
  }

  return createdRoles
}

/**
 * Create test users with different roles
 */
async function createUsers(roles: UserRole[], hashedPassword: string): Promise<UserWithRoleName[]> {
  const userData = [
    // Super Admin (already exists, just update)
    {
      email: 'superadmin@vnp.com',
      first_name: 'Super',
      last_name: 'Admin',
      role_name: 'Super Admin',
      language: 'en'
    },
    // Portfolio Managers
    {
      email: 'pm.marriott@vnp.com',
      first_name: 'Marriott',
      last_name: 'Manager',
      role_name: 'Portfolio Manager',
      language: 'en'
    },
    {
      email: 'pm.hilton@vnp.com',
      first_name: 'Hilton',
      last_name: 'Manager',
      role_name: 'Portfolio Manager',
      language: 'en'
    },
    // Property Managers
    {
      email: 'propmanager.nyc@vnp.com',
      first_name: 'NYC',
      last_name: 'Property Manager',
      role_name: 'Property Manager',
      language: 'en'
    },
    {
      email: 'propmanager.london@vnp.com',
      first_name: 'London',
      last_name: 'Property Manager',
      role_name: 'Property Manager',
      language: 'en'
    },
    // Auditors
    {
      email: 'auditor1@vnp.com',
      first_name: 'Internal',
      last_name: 'Auditor 1',
      role_name: 'Auditor',
      language: 'en'
    },
    {
      email: 'auditor2@vnp.com',
      first_name: 'Internal',
      last_name: 'Auditor 2',
      role_name: 'Auditor',
      language: 'en'
    },
    // Team Members
    {
      email: 'teammember1@vnp.com',
      first_name: 'Team',
      last_name: 'Member 1',
      role_name: 'Team Member',
      language: 'en'
    },
    {
      email: 'teammember2@vnp.com',
      first_name: 'Team',
      last_name: 'Member 2',
      role_name: 'Team Member',
      language: 'en'
    },
    // Viewers
    {
      email: 'viewer1@vnp.com',
      first_name: 'View',
      last_name: 'Only 1',
      role_name: 'Viewer',
      language: 'en'
    },
    // External Users
    {
      email: 'ext.auditor1@external.com',
      first_name: 'External',
      last_name: 'Auditor 1',
      role_name: 'External Auditor',
      language: 'en'
    },
    {
      email: 'ext.auditor2@external.com',
      first_name: 'External',
      last_name: 'Auditor 2',
      role_name: 'External Auditor',
      language: 'en'
    },
    {
      email: 'ext.collab1@external.com',
      first_name: 'External',
      last_name: 'Collaborator 1',
      role_name: 'External Collaborator',
      language: 'en'
    },
    {
      email: 'ext.viewer1@external.com',
      first_name: 'External',
      last_name: 'Viewer 1',
      role_name: 'External Viewer',
      language: 'en'
    }
  ]

  const createdUsers: UserWithRoleName[] = []

  for (const data of userData) {
    const role = roles.find((r) => r.name === data.role_name)
    if (!role) {
      console.warn(`⚠️  Role not found: ${data.role_name}`)
      continue
    }

    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        first_name: data.first_name,
        last_name: data.last_name,
        user_role_id: role.id,
        password: hashedPassword,
        is_verified: true,
        temp_password: null,
        language: data.language
      },
      create: {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        user_role_id: role.id,
        password: hashedPassword,
        is_verified: true,
        language: data.language
      }
    })
    createdUsers.push({ ...user, role_name: data.role_name })
  }

  return createdUsers
}

/**
 * Setup partial access for users
 */
async function setupPartialAccess(users: any[], roles: any[]) {
  // Get portfolios
  const portfolios = await prisma.portfolio.findMany({
    select: { id: true, name: true }
  })

  // Get properties
  const properties = await prisma.property.findMany({
    select: { id: true, name: true, portfolio_id: true }
  })

  if (portfolios.length === 0 || properties.length === 0) {
    console.log('⚠️  No portfolios or properties found. Skipping partial access setup.')
    return
  }

  // Group properties by portfolio
  const propertiesByPortfolio: Record<string, string[]> = {}
  properties.forEach((prop) => {
    if (!propertiesByPortfolio[prop.portfolio_id]) {
      propertiesByPortfolio[prop.portfolio_id] = []
    }
    propertiesByPortfolio[prop.portfolio_id].push(prop.id)
  })

  // Setup access for each user based on role
  for (const user of users) {
    const role = roles.find((r) => r.id === user.user_role_id)
    if (!role) continue

    // Skip users with ALL access level - they don't need explicit access
    if (
      role.portfolio_permission?.access_level === 'all' &&
      role.property_permission?.access_level === 'all'
    ) {
      continue
    }

    // Determine which portfolios/properties this user should access
    let portfolioIds: string[] = []
    let propertyIds: string[] = []

    // Assign specific portfolios based on user email patterns
    if (user.email.includes('marriott')) {
      // Marriott manager gets first portfolio
      portfolioIds = [portfolios[0]?.id].filter(Boolean)
      propertyIds = (propertiesByPortfolio[portfolios[0]?.id] || []).slice(0, 2)
    } else if (user.email.includes('hilton')) {
      // Hilton manager gets second portfolio
      portfolioIds = [portfolios[1]?.id].filter(Boolean)
      propertyIds = (propertiesByPortfolio[portfolios[1]?.id] || []).slice(0, 2)
    } else if (user.email.includes('nyc')) {
      // NYC property manager gets Marriott NYC properties
      portfolioIds = [portfolios[0]?.id].filter(Boolean)
      propertyIds = (propertiesByPortfolio[portfolios[0]?.id] || []).slice(0, 1)
    } else if (user.email.includes('london')) {
      // London property manager gets Hilton London properties
      portfolioIds = [portfolios[1]?.id].filter(Boolean)
      propertyIds = (propertiesByPortfolio[portfolios[1]?.id] || []).slice(2, 3)
    } else if (user.email.includes('auditor1')) {
      // First auditors get first two portfolios
      portfolioIds = [portfolios[0]?.id, portfolios[1]?.id].filter(Boolean)
      propertyIds = [
        ...(propertiesByPortfolio[portfolios[0]?.id] || []).slice(0, 1),
        ...(propertiesByPortfolio[portfolios[1]?.id] || []).slice(0, 1)
      ]
    } else if (user.email.includes('auditor2')) {
      // Second auditors get middle portfolios
      portfolioIds = [portfolios[2]?.id, portfolios[3]?.id].filter(Boolean)
      propertyIds = [
        ...(propertiesByPortfolio[portfolios[2]?.id] || []).slice(0, 1),
        ...(propertiesByPortfolio[portfolios[3]?.id] || []).slice(0, 1)
      ]
    } else if (user.email.includes('teammember')) {
      // Team members get first portfolio
      portfolioIds = [portfolios[0]?.id].filter(Boolean)
      propertyIds = (propertiesByPortfolio[portfolios[0]?.id] || []).slice(0, 1)
    } else if (user.email.includes('ext.')) {
      // External users get limited access to first portfolio
      portfolioIds = [portfolios[0]?.id].filter(Boolean)
      propertyIds = (propertiesByPortfolio[portfolios[0]?.id] || []).slice(0, 1)
    }

    // Only create UserAccessedProperty if there's something to grant
    if (portfolioIds.length > 0 || propertyIds.length > 0) {
      // Check if user access already exists
      const existingAccess = await prisma.userAccessedProperty.findFirst({
        where: { user_id: user.id }
      })

      if (existingAccess) {
        // Update existing access
        await prisma.userAccessedProperty.update({
          where: { id: existingAccess.id },
          data: {
            portfolio_id: portfolioIds,
            property_id: propertyIds
          }
        })
      } else {
        // Create new access
        await prisma.userAccessedProperty.create({
          data: {
            user_id: user.id,
            portfolio_id: portfolioIds,
            property_id: propertyIds
          }
        })
      }
    }
  }
}

/**
 * Print comprehensive test summary
 */
function printTestSummary(users: UserWithRoleName[], roles: UserRole[]) {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║              🧪 TEST USERS & ROLES SUMMARY                     ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  console.log('🔐 COMMON PASSWORD FOR ALL USERS:')
  console.log(`   AluVaj!1*\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 INTERNAL USERS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const internalUsers = users.filter((u) => !u.email.includes('ext.'))

  internalUsers.forEach((user) => {
    const role = roles.find((r) => r.id === user.user_role_id)
    console.log(`👤 ${user.first_name} ${user.last_name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${role?.name}`)
    console.log(`   Type: ${role?.is_external ? 'External' : 'Internal'}`)
    console.log('')
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🌐 EXTERNAL USERS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const externalUsers = users.filter((u) => u.email.includes('ext.'))

  externalUsers.forEach((user) => {
    const role = roles.find((r) => r.id === user.user_role_id)
    console.log(`👤 ${user.first_name} ${user.last_name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${role?.name}`)
    console.log(`   Type: ${role?.is_external ? 'External' : 'Internal'}`)
    console.log('')
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 ROLE HIERARCHY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('Permission Level Hierarchy:')
  console.log('   1. all      → Create, Read, Update, Delete')
  console.log('   2. update   → Create, Read, Update')
  console.log('   3. view     → Read Only\n')

  console.log('Access Level Hierarchy:')
  console.log('   1. all      → All resources in system')
  console.log('   2. partial  → Only assigned resources')
  console.log('   3. none     → No access\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('✅ Ready for testing!')
  console.log(`📝 See TESTING_GUIDE.md for detailed test scenarios\n`)
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
