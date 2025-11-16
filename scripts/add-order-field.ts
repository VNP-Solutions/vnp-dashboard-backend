import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addOrderField() {
  try {
    console.log(
      'Starting migration to add order field based on creation date...\n'
    )

    // Update UserRole collection
    console.log('Updating UserRole collection...')
    const userRoles = await prisma.userRole.findMany({
      orderBy: { created_at: 'asc' },
      select: { id: true }
    })

    for (let i = 0; i < userRoles.length; i++) {
      await prisma.userRole.update({
        where: { id: userRoles[i].id },
        data: { order: i + 1 }
      })
    }
    console.log(
      `Updated ${userRoles.length} UserRole documents with order 1-${userRoles.length}`
    )

    // Update ServiceType collection
    console.log('Updating ServiceType collection...')
    const serviceTypes = await prisma.serviceType.findMany({
      orderBy: { created_at: 'asc' },
      select: { id: true }
    })

    for (let i = 0; i < serviceTypes.length; i++) {
      await prisma.serviceType.update({
        where: { id: serviceTypes[i].id },
        data: { order: i + 1 }
      })
    }
    console.log(
      `Updated ${serviceTypes.length} ServiceType documents with order 1-${serviceTypes.length}`
    )

    // Update Currency collection
    console.log('Updating Currency collection...')
    const currencies = await prisma.currency.findMany({
      orderBy: { created_at: 'asc' },
      select: { id: true }
    })

    for (let i = 0; i < currencies.length; i++) {
      await prisma.currency.update({
        where: { id: currencies[i].id },
        data: { order: i + 1 }
      })
    }
    console.log(
      `Updated ${currencies.length} Currency documents with order 1-${currencies.length}`
    )

    // Update AuditStatus collection
    console.log('Updating AuditStatus collection...')
    const auditStatuses = await prisma.auditStatus.findMany({
      orderBy: { created_at: 'asc' },
      select: { id: true }
    })

    for (let i = 0; i < auditStatuses.length; i++) {
      await prisma.auditStatus.update({
        where: { id: auditStatuses[i].id },
        data: { order: i + 1 }
      })
    }
    console.log(
      `Updated ${auditStatuses.length} AuditStatus documents with order 1-${auditStatuses.length}`
    )

    // Update AuditBatch collection
    console.log('Updating AuditBatch collection...')
    const auditBatches = await prisma.auditBatch.findMany({
      orderBy: { created_at: 'asc' },
      select: { id: true }
    })

    for (let i = 0; i < auditBatches.length; i++) {
      await prisma.auditBatch.update({
        where: { id: auditBatches[i].id },
        data: { order: i + 1 }
      })
    }
    console.log(
      `Updated ${auditBatches.length} AuditBatch documents with order 1-${auditBatches.length}`
    )

    console.log('\nMigration completed successfully!')
  } catch (error) {
    console.error('Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addOrderField().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
