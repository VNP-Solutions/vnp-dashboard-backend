import { Portfolio, PrismaClient, ServiceType } from '@prisma/client'

const prisma = new PrismaClient()

type PortfolioWithServiceType = Portfolio & {
  serviceType: ServiceType
}

async function main() {
  console.log('Starting portfolio seeding...')

  // 1. Ensure ServiceTypes exist (required for portfolios)
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
    }),
    prisma.serviceType.upsert({
      where: { type: 'Audit Only' },
      update: {},
      create: { type: 'Audit Only', is_active: true, order: 4 }
    })
  ])
  console.log(`✓ Ensured ${serviceTypes.length} service types exist`)

  // 2. Create 5 portfolios with diverse data
  const portfolioData = [
    {
      name: 'Marriott Hotels Group',
      service_type_id: serviceTypes[0].id, // Full Service
      currency: 'USD',
      is_active: true,
      contact_email: 'contact@marriott.com',
      is_commissionable: true,
      sales_agent: 'John Smith',
      access_email: 'access@marriott.com',
      access_phone: '+1-555-0101'
    },
    {
      name: 'Hilton Worldwide',
      service_type_id: serviceTypes[1].id, // Limited Service
      currency: 'USD',
      is_active: true,
      contact_email: 'contact@hilton.com',
      is_commissionable: true,
      sales_agent: 'Sarah Johnson',
      access_email: 'access@hilton.com',
      access_phone: '+1-555-0102'
    },
    {
      name: 'Hyatt Hotels Corporation',
      service_type_id: serviceTypes[0].id, // Full Service
      currency: 'EUR',
      is_active: true,
      contact_email: 'contact@hyatt.com',
      is_commissionable: false,
      sales_agent: null,
      access_email: 'access@hyatt.com',
      access_phone: '+44-20-5555-0103'
    },
    {
      name: 'IHG Hotels & Resorts',
      service_type_id: serviceTypes[2].id, // Select Service
      currency: 'GBP',
      is_active: true,
      contact_email: 'contact@ihg.com',
      is_commissionable: true,
      sales_agent: 'Michael Brown',
      access_email: 'access@ihg.com',
      access_phone: '+44-20-5555-0104'
    },
    {
      name: 'Wyndham Hotels & Resorts',
      service_type_id: serviceTypes[3].id, // Audit Only
      currency: 'USD',
      is_active: true,
      contact_email: 'contact@wyndham.com',
      is_commissionable: false,
      sales_agent: null,
      access_email: 'access@wyndham.com',
      access_phone: '+1-555-0105'
    }
  ]

  console.log('\nCreating portfolios...')
  const createdPortfolios: PortfolioWithServiceType[] = []

  for (const data of portfolioData) {
    try {
      const portfolio = await prisma.portfolio.upsert({
        where: { name: data.name },
        update: {
          service_type_id: data.service_type_id,
          currency: data.currency,
          is_active: data.is_active,
          contact_email: data.contact_email,
          is_commissionable: data.is_commissionable,
          sales_agent: data.sales_agent,
          access_email: data.access_email,
          access_phone: data.access_phone
        },
        create: {
          name: data.name,
          service_type_id: data.service_type_id,
          currency: data.currency,
          is_active: data.is_active,
          contact_email: data.contact_email,
          is_commissionable: data.is_commissionable,
          sales_agent: data.sales_agent,
          access_email: data.access_email,
          access_phone: data.access_phone
        },
        include: {
          serviceType: true
        }
      })
      createdPortfolios.push(portfolio)
      console.log(`  ✓ ${portfolio.name}`)
    } catch (error) {
      console.error(`  ✗ Failed to create ${data.name}:`, error.message)
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80))
  console.log('PORTFOLIO SEED SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total portfolios created/updated: ${createdPortfolios.length}`)
  console.log('\nPortfolio Details:\n')

  for (const portfolio of createdPortfolios) {
    console.log(`📁 ${portfolio.name}`)
    console.log(`   ID:              ${portfolio.id}`)
    console.log(`   Service Type:    ${portfolio.serviceType.type}`)
    console.log(`   Currency:        ${portfolio.currency}`)
    console.log(`   Active:          ${portfolio.is_active ? 'Yes' : 'No'}`)
    console.log(
      `   Commissionable:  ${portfolio.is_commissionable ? 'Yes' : 'No'}`
    )
    if (portfolio.sales_agent) {
      console.log(`   Sales Agent:     ${portfolio.sales_agent}`)
    }
    console.log(`   Contact Email:   ${portfolio.contact_email}`)
    console.log(`   Access Email:    ${portfolio.access_email}`)
    console.log(`   Access Phone:    ${portfolio.access_phone}`)
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('✅ Portfolio seeding completed successfully!')
  console.log('='.repeat(80))
}

main()
  .catch(e => {
    console.error('❌ Portfolio seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
