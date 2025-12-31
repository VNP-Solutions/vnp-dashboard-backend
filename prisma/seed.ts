import {
  PrismaClient,
  OtaType,
  BillingType,
  Portfolio,
  Property,
  ServiceType,
  Currency,
  AuditStatus
} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // First, ensure we have required reference data
  // 1. Create or get ServiceTypes
  const serviceTypes = await Promise.all([
    prisma.serviceType.upsert({
      where: { type: 'Full Service' },
      update: {},
      create: { type: 'Full Service', is_active: true, order: 1 }
    }),
    prisma.serviceType.upsert({
      where: { type: 'Limited Service' },
      update: {},
      create: { type: 'Limited Service', is_active: true, order: 2 }
    }),
    prisma.serviceType.upsert({
      where: { type: 'Select Service' },
      update: {},
      create: { type: 'Select Service', is_active: true, order: 3 }
    })
  ])
  console.log(`Created/found ${serviceTypes.length} service types`)

  // 2. Create or get Currencies
  const currencies = await Promise.all([
    prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', name: 'US Dollar', symbol: '$', is_active: true, order: 1 }
    }),
    prisma.currency.upsert({
      where: { code: 'EUR' },
      update: {},
      create: { code: 'EUR', name: 'Euro', symbol: '\u20AC', is_active: true, order: 2 }
    }),
    prisma.currency.upsert({
      where: { code: 'GBP' },
      update: {},
      create: { code: 'GBP', name: 'British Pound', symbol: '\u00A3', is_active: true, order: 3 }
    })
  ])
  console.log(`Created/found ${currencies.length} currencies`)

  // 3. Create or get AuditStatuses
  const auditStatuses = await Promise.all([
    prisma.auditStatus.upsert({
      where: { id: await getOrCreateAuditStatusId('Pending Review') },
      update: {},
      create: { status: 'Pending Review', order: 1 }
    }),
    prisma.auditStatus.upsert({
      where: { id: await getOrCreateAuditStatusId('In Progress') },
      update: {},
      create: { status: 'In Progress', order: 2 }
    }),
    prisma.auditStatus.upsert({
      where: { id: await getOrCreateAuditStatusId('Completed') },
      update: {},
      create: { status: 'Completed', order: 3 }
    }),
    prisma.auditStatus.upsert({
      where: { id: await getOrCreateAuditStatusId('On Hold') },
      update: {},
      create: { status: 'On Hold', order: 4 }
    })
  ])
  console.log(`Created/found ${auditStatuses.length} audit statuses`)

  // Get the actual audit status records for use later
  const pendingStatus = await prisma.auditStatus.findFirst({ where: { status: 'Pending Review' } })
  const inProgressStatus = await prisma.auditStatus.findFirst({ where: { status: 'In Progress' } })
  const completedStatus = await prisma.auditStatus.findFirst({ where: { status: 'Completed' } })
  const onHoldStatus = await prisma.auditStatus.findFirst({ where: { status: 'On Hold' } })

  if (!pendingStatus || !inProgressStatus || !completedStatus || !onHoldStatus) {
    throw new Error('Failed to create audit statuses')
  }

  // 4. Create Portfolios
  const portfolioData = [
    { name: 'Marriott Hotels Group', serviceTypeIndex: 0, contact_email: 'contact@marriott.com', is_commissionable: true },
    { name: 'Hilton Worldwide', serviceTypeIndex: 1, contact_email: 'contact@hilton.com', is_commissionable: true },
    { name: 'Hyatt Hotels', serviceTypeIndex: 0, contact_email: 'contact@hyatt.com', is_commissionable: false },
    { name: 'IHG Hotels & Resorts', serviceTypeIndex: 2, contact_email: 'contact@ihg.com', is_commissionable: true },
    { name: 'Wyndham Hotels', serviceTypeIndex: 1, contact_email: 'contact@wyndham.com', is_commissionable: false }
  ]

  const portfolios: Portfolio[] = []
  for (const data of portfolioData) {
    const portfolio = await prisma.portfolio.upsert({
      where: { name: data.name },
      update: {},
      create: {
        name: data.name,
        service_type_id: serviceTypes[data.serviceTypeIndex].id,
        currency: 'USD',
        is_active: true,
        contact_email: data.contact_email,
        is_commissionable: data.is_commissionable,
        sales_agent: 'Sales Team',
        access_email: data.contact_email,
        access_phone: '+1-555-0100'
      }
    })
    portfolios.push(portfolio)
  }
  console.log(`Created/found ${portfolios.length} portfolios`)

  // 5. Create Properties (multiple per portfolio)
  const propertyConfigs = [
    // Marriott properties
    { name: 'Marriott Downtown NYC', portfolioIndex: 0, currencyIndex: 0, address: '123 Broadway, New York, NY 10001' },
    { name: 'Marriott LAX Airport', portfolioIndex: 0, currencyIndex: 0, address: '5855 W Century Blvd, Los Angeles, CA 90045' },
    { name: 'Marriott Chicago Magnificent Mile', portfolioIndex: 0, currencyIndex: 0, address: '540 N Michigan Ave, Chicago, IL 60611' },
    // Hilton properties
    { name: 'Hilton Times Square', portfolioIndex: 1, currencyIndex: 0, address: '234 W 42nd St, New York, NY 10036' },
    { name: 'Hilton San Francisco', portfolioIndex: 1, currencyIndex: 0, address: '333 O\'Farrell St, San Francisco, CA 94102' },
    { name: 'Hilton London Metropole', portfolioIndex: 1, currencyIndex: 2, address: '225 Edgware Rd, London W2 1JU' },
    // Hyatt properties
    { name: 'Grand Hyatt New York', portfolioIndex: 2, currencyIndex: 0, address: '109 E 42nd St, New York, NY 10017' },
    { name: 'Park Hyatt Paris', portfolioIndex: 2, currencyIndex: 1, address: '5 Rue de la Paix, 75002 Paris' },
    // IHG properties
    { name: 'InterContinental Miami', portfolioIndex: 3, currencyIndex: 0, address: '100 Chopin Plaza, Miami, FL 33131' },
    { name: 'Holiday Inn Express Boston', portfolioIndex: 3, currencyIndex: 0, address: '69 Boston St, Boston, MA 02125' },
    { name: 'Crowne Plaza Berlin', portfolioIndex: 3, currencyIndex: 1, address: 'N\u00FCrnberger Str 65, 10787 Berlin' },
    // Wyndham properties
    { name: 'Wyndham Grand Orlando', portfolioIndex: 4, currencyIndex: 0, address: '8629 International Dr, Orlando, FL 32819' },
    { name: 'Ramada by Wyndham Seattle', portfolioIndex: 4, currencyIndex: 0, address: '2140 N Northgate Way, Seattle, WA 98133' }
  ]

  const properties: Property[] = []
  for (const config of propertyConfigs) {
    const property = await prisma.property.upsert({
      where: { name: config.name },
      update: {},
      create: {
        name: config.name,
        address: config.address,
        currency_id: currencies[config.currencyIndex].id,
        portfolio_id: portfolios[config.portfolioIndex].id,
        is_active: true,
        next_due_date: getRandomFutureDate(),
        show_in_portfolio: []
      }
    })
    properties.push(property)

    // Create credentials for each property
    await prisma.propertyCredentials.upsert({
      where: { property_id: property.id },
      update: {},
      create: {
        property_id: property.id,
        expedia_id: `EXP-${property.id.substring(0, 8)}`,
        expedia_username: `expedia_${property.name.toLowerCase().replace(/\s+/g, '_').substring(0, 15)}`,
        expedia_password: 'encrypted_password_placeholder',
        agoda_id: `AGO-${property.id.substring(0, 8)}`,
        agoda_username: `agoda_${property.name.toLowerCase().replace(/\s+/g, '_').substring(0, 15)}`,
        agoda_password: 'encrypted_password_placeholder',
        booking_id: `BOK-${property.id.substring(0, 8)}`,
        booking_username: `booking_${property.name.toLowerCase().replace(/\s+/g, '_').substring(0, 15)}`,
        booking_password: 'encrypted_password_placeholder'
      }
    })
  }
  console.log(`Created/found ${properties.length} properties with credentials`)

  // 6. Create Audits (multiple per property, various OTA types and statuses)
  const otaTypes: OtaType[] = [OtaType.expedia, OtaType.agoda, OtaType.booking]
  const billingTypes: BillingType[] = [BillingType.VCC, BillingType.DB, BillingType.EBS]
  const statusOptions = [pendingStatus, inProgressStatus, completedStatus, onHoldStatus]

  let auditCount = 0
  for (const property of properties) {
    // Create 3-5 audits per property
    const numAudits = 3 + Math.floor(Math.random() * 3)

    for (let i = 0; i < numAudits; i++) {
      const otaType = otaTypes[i % otaTypes.length]
      const billingType = billingTypes[Math.floor(Math.random() * billingTypes.length)]
      const status = statusOptions[Math.floor(Math.random() * statusOptions.length)]
      const startDate = getRandomPastDate(365)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 30 + Math.floor(Math.random() * 60))

      const amountCollectable = 1000 + Math.floor(Math.random() * 50000)
      const amountConfirmed = status.status === 'Completed'
        ? amountCollectable
        : Math.floor(amountCollectable * Math.random())

      await prisma.audit.create({
        data: {
          property_id: property.id,
          type_of_ota: otaType,
          billing_type: billingType,
          audit_status_id: status.id,
          amount_collectable: amountCollectable,
          amount_confirmed: amountConfirmed,
          is_archived: Math.random() < 0.1, // 10% archived
          start_date: startDate,
          end_date: endDate
        }
      })
      auditCount++
    }
  }
  console.log(`Created ${auditCount} audits`)

  // Print summary for testing
  console.log('\n--- SEED SUMMARY ---')
  console.log('Portfolios created:')
  for (const p of portfolios) {
    console.log(`  - ${p.name} (ID: ${p.id})`)
  }

  console.log('\nProperties per portfolio:')
  for (const portfolio of portfolios) {
    const props = properties.filter(p => p.portfolio_id === portfolio.id)
    console.log(`  ${portfolio.name}:`)
    for (const prop of props) {
      console.log(`    - ${prop.name} (ID: ${prop.id})`)
    }
  }

  console.log('\nAudit Statuses:')
  console.log(`  - Pending Review (ID: ${pendingStatus.id})`)
  console.log(`  - In Progress (ID: ${inProgressStatus.id})`)
  console.log(`  - Completed (ID: ${completedStatus.id})`)
  console.log(`  - On Hold (ID: ${onHoldStatus.id})`)

  console.log('\nCurrencies:')
  for (const c of currencies) {
    console.log(`  - ${c.code} (ID: ${c.id})`)
  }

  console.log('\nService Types:')
  for (const st of serviceTypes) {
    console.log(`  - ${st.type} (ID: ${st.id})`)
  }

  console.log('\n--- END SUMMARY ---')
  console.log('\nSeed completed successfully!')
}

async function getOrCreateAuditStatusId(status: string): Promise<string> {
  const existing = await prisma.auditStatus.findFirst({ where: { status } })
  if (existing) return existing.id

  const created = await prisma.auditStatus.create({
    data: { status, order: 0 }
  })
  return created.id
}

function getRandomFutureDate(maxDays = 90): Date {
  const date = new Date()
  date.setDate(date.getDate() + Math.floor(Math.random() * maxDays) + 1)
  return date
}

function getRandomPastDate(maxDays = 365): Date {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * maxDays) - 1)
  return date
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
