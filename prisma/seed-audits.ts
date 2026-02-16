import { AuditStatus, BillingType, OtaType, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// OTA and Billing type arrays
const otaTypes: OtaType[] = [OtaType.expedia, OtaType.agoda, OtaType.booking]
const billingTypes: BillingType[] = [
  BillingType.VCC,
  BillingType.DB,
  BillingType.EBS
]

// Helper functions
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomPastDate(maxDaysAgo: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - getRandomNumber(1, maxDaysAgo))
  return date
}

function getRandomFutureDate(maxDaysAhead: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + getRandomNumber(1, maxDaysAhead))
  return date
}

function generateDateRange(): { start_date: Date; end_date: Date } {
  // Generate audits for various time periods (past and future)
  const isPast = Math.random() > 0.3 // 70% past audits, 30% future/ongoing

  if (isPast) {
    // Past audits
    const endDate = getRandomPastDate(365) // Up to 1 year ago
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - getRandomNumber(28, 92)) // 1-3 months duration
    return { start_date: startDate, end_date: endDate }
  } else {
    // Ongoing or future audits
    const startDate = getRandomPastDate(60) // Started up to 2 months ago
    const endDate = getRandomFutureDate(90) // Ends up to 3 months from now
    return { start_date: startDate, end_date: endDate }
  }
}

function generateAuditAmounts(status: string): {
  amount_collectable: number
  amount_confirmed: number
} {
  const baseAmount = getRandomNumber(5000, 150000)

  // Adjust amounts based on status
  if (status === 'Completed' || status === 'Confirmed') {
    // Completed audits have confirmed amounts
    return {
      amount_collectable: baseAmount,
      amount_confirmed: baseAmount + getRandomNumber(-1000, 2000) // Small variance
    }
  } else if (status === 'In Progress' || status === 'Under Review') {
    // In progress audits may have partial confirmation
    return {
      amount_collectable: baseAmount,
      amount_confirmed:
        Math.random() > 0.5 ? Math.floor(baseAmount * Math.random()) : 0
    }
  } else if (status === 'Pending' || status === 'Pending Review') {
    // Pending audits may not have confirmed amounts yet
    return {
      amount_collectable: baseAmount,
      amount_confirmed: Math.random() > 0.7 ? Math.floor(baseAmount * 0.3) : 0
    }
  } else {
    // On Hold, Disputed, etc.
    return {
      amount_collectable: baseAmount,
      amount_confirmed:
        Math.random() > 0.6 ? Math.floor(baseAmount * Math.random() * 0.5) : 0
    }
  }
}

function generateReportUrl(
  propertyId: string,
  auditIndex: number
): string | null {
  // 60% of audits have report URLs
  if (Math.random() > 0.4) {
    const timestamp = Date.now()
    return `https://s3.amazonaws.com/vnp-audits/${propertyId}/audit-report-${auditIndex}-${timestamp}.pdf`
  }
  return null
}

async function getOrCreateAuditStatus(
  status: string,
  order: number
): Promise<AuditStatus> {
  const existing = await prisma.auditStatus.findFirst({ where: { status } })
  if (existing) return existing

  return await prisma.auditStatus.create({
    data: { status, order }
  })
}

async function main() {
  console.log('Starting audit seeding...')
  console.log('='.repeat(80))

  // 1. Ensure audit statuses exist
  const auditStatuses = await Promise.all([
    getOrCreateAuditStatus('Pending Review', 1),
    getOrCreateAuditStatus('In Progress', 2),
    getOrCreateAuditStatus('Under Review', 3),
    getOrCreateAuditStatus('Completed', 4),
    getOrCreateAuditStatus('Confirmed', 5),
    getOrCreateAuditStatus('On Hold', 6),
    getOrCreateAuditStatus('Disputed', 7),
    getOrCreateAuditStatus('Cancelled', 8)
  ])

  console.log(`✓ Ensured ${auditStatuses.length} audit statuses exist`)

  // 2. Fetch first 10 properties
  const properties = await prisma.property.findMany({
    take: 10,
    orderBy: { created_at: 'asc' },
    include: {
      portfolio: true
    }
  })

  if (properties.length === 0) {
    console.error('❌ No properties found! Please run seed:properties first.')
    process.exit(1)
  }

  console.log(`✓ Found ${properties.length} properties for audit seeding`)

  // 3. Create 15 audits for each property
  const auditsPerProperty = 15
  const totalAudits = properties.length * auditsPerProperty
  let createdCount = 0
  let failedCount = 0

  console.log(
    `\n📊 Creating ${auditsPerProperty} audits for each of ${properties.length} properties...`
  )
  console.log(`📈 Total audits to create: ${totalAudits}`)
  console.log('-'.repeat(80))

  const auditsByProperty: Map<string, number> = new Map()
  const auditsByStatus: Map<string, number> = new Map()
  const auditsByOta: Map<string, number> = new Map()

  for (const property of properties) {
    console.log(`\n🏨 ${property.name}`)
    auditsByProperty.set(property.name, 0)

    for (let i = 1; i <= auditsPerProperty; i++) {
      try {
        // Generate random number of OTA types (1-3)
        const numOtaTypes = Math.floor(Math.random() * 3) + 1
        const selectedOtaTypes: OtaType[] = []
        
        // Randomly select OTA types without duplicates
        const availableOtas = [...otaTypes]
        for (let j = 0; j < numOtaTypes && availableOtas.length > 0; j++) {
          const randomIndex = Math.floor(Math.random() * availableOtas.length)
          selectedOtaTypes.push(availableOtas[randomIndex])
          availableOtas.splice(randomIndex, 1)
        }

        const billingType = getRandomElement(billingTypes)
        const status = getRandomElement(auditStatuses)
        const { start_date, end_date } = generateDateRange()
        const { amount_collectable, amount_confirmed } = generateAuditAmounts(
          status.status
        )
        const isArchived = Math.random() > 0.85 // 15% archived
        const reportUrl = generateReportUrl(property.id, i)

        await prisma.audit.create({
          data: {
            property_id: property.id,
            type_of_ota: selectedOtaTypes,
            billing_type: billingType,
            audit_status_id: status.id,
            amount_collectable,
            amount_confirmed,
            is_archived: isArchived,
            start_date,
            end_date,
            report_url: reportUrl,
            batch_id: null // Can be assigned later if needed
          }
        })

        createdCount++
        auditsByProperty.set(
          property.name,
          (auditsByProperty.get(property.name) || 0) + 1
        )
        auditsByStatus.set(
          status.status,
          (auditsByStatus.get(status.status) || 0) + 1
        )
        
        // Count each OTA type separately
        selectedOtaTypes.forEach(ota => {
          auditsByOta.set(ota, (auditsByOta.get(ota) || 0) + 1)
        })

        process.stdout.write(
          `  ✓ ${createdCount}/${totalAudits} audits created\r`
        )
      } catch (error) {
        failedCount++
        console.error(
          `  ✗ Failed to create audit ${i} for ${property.name}: ${error.message}`
        )
      }
    }
  }

  console.log('\n\n' + '='.repeat(80))
  console.log('AUDIT SEED SUMMARY')
  console.log('='.repeat(80))

  console.log(`\n✅ Successfully created: ${createdCount} audits`)
  console.log(`❌ Failed: ${failedCount} audits`)

  // Property distribution
  console.log('\n📊 Audits by Property:')
  for (const [propertyName, count] of auditsByProperty.entries()) {
    console.log(`  ${propertyName}: ${count} audits`)
  }

  // Status distribution
  console.log('\n📈 Audits by Status:')
  for (const [statusName, count] of auditsByStatus.entries()) {
    console.log(`  ${statusName}: ${count} audits`)
  }

  // OTA distribution
  console.log('\n🌐 Audits by OTA Type:')
  for (const [otaName, count] of auditsByOta.entries()) {
    console.log(`  ${otaName}: ${count} audits`)
  }

  // Billing type distribution
  const billingCounts = {
    VCC: 0,
    DB: 0,
    EBS: 0
  }

  const allAudits = await prisma.audit.findMany({
    select: { billing_type: true }
  })

  for (const audit of allAudits) {
    if (audit.billing_type) {
      billingCounts[audit.billing_type]++
    }
  }

  console.log('\n💳 Audits by Billing Type:')
  console.log(`  VCC (Virtual Credit Card): ${billingCounts.VCC} audits`)
  console.log(`  DB (Direct Bill): ${billingCounts.DB} audits`)
  console.log(`  EBS (Electronic Bank Statement): ${billingCounts.EBS} audits`)

  // Amount statistics
  const auditStats = await prisma.audit.aggregate({
    _sum: {
      amount_collectable: true,
      amount_confirmed: true
    },
    _avg: {
      amount_collectable: true,
      amount_confirmed: true
    }
  })

  console.log('\n💰 Financial Summary:')
  console.log(
    `  Total Collectable: $${auditStats._sum.amount_collectable?.toLocaleString() || 0}`
  )
  console.log(
    `  Total Confirmed: $${auditStats._sum.amount_confirmed?.toLocaleString() || 0}`
  )
  console.log(
    `  Average Collectable: $${Math.round(auditStats._avg.amount_collectable || 0).toLocaleString()}`
  )
  console.log(
    `  Average Confirmed: $${Math.round(auditStats._avg.amount_confirmed || 0).toLocaleString()}`
  )

  // Archive status
  const archivedCount = await prisma.audit.count({
    where: { is_archived: true }
  })
  const activeCount = await prisma.audit.count({
    where: { is_archived: false }
  })

  console.log('\n📂 Archive Status:')
  console.log(`  Active: ${activeCount} audits`)
  console.log(`  Archived: ${archivedCount} audits`)

  // Report URL status
  const withReportCount = await prisma.audit.count({
    where: { report_url: { not: null } }
  })
  const withoutReportCount = await prisma.audit.count({
    where: { report_url: null }
  })

  console.log('\n📄 Report Status:')
  console.log(`  With Reports: ${withReportCount} audits`)
  console.log(`  Without Reports: ${withoutReportCount} audits`)

  console.log('\n' + '='.repeat(80))
  console.log('✅ Audit seeding completed!')
  console.log('='.repeat(80))
}

main()
  .catch(e => {
    console.error('\n❌ Audit seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
