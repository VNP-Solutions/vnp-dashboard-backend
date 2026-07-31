import { PrismaClient, Portfolio } from '@prisma/client'

const prisma = new PrismaClient()

type PortfolioWithServiceType = Portfolio & {
  serviceType: { type: string }
}

async function main() {
  console.log('='.repeat(80))
  console.log('PORTFOLIO SEED SCRIPT')
  console.log('='.repeat(80))

  // 1. Ensure service types exist
  const serviceTypeData = [
    { type: 'Full Service', is_active: true, order: 1 },
    { type: 'Limited Service', is_active: true, order: 2 },
    { type: 'Select Service', is_active: true, order: 3 },
    { type: 'Audit Only', is_active: true, order: 4 }
  ]

  const serviceTypes: Awaited<ReturnType<typeof prisma.serviceType.upsert>>[] =
    []
  for (const data of serviceTypeData) {
    const serviceType = await prisma.serviceType.upsert({
      where: { type: data.type },
      update: { is_active: data.is_active, order: data.order },
      create: data
    })
    serviceTypes.push(serviceType)
  }
  console.log(`✓ Ensured ${serviceTypes.length} service types exist`)

  // 2. Create 5 portfolios with diverse data
  const portfolioData = [
    {
      name: 'Marriott Hotels Group',
      service_type_id: serviceTypes[0].id,
      currency: 'USD',
      is_active: true,
      is_commissionable: true,
      parent_id: null as string | null
    },
    {
      name: 'Hilton Worldwide',
      service_type_id: serviceTypes[1].id,
      currency: 'USD',
      is_active: true,
      is_commissionable: true,
      parent_id: null as string | null
    },
    {
      name: 'Hyatt Hotels Corporation',
      service_type_id: serviceTypes[0].id,
      currency: 'EUR',
      is_active: true,
      is_commissionable: false,
      parent_id: null as string | null
    },
    {
      name: 'IHG Hotels & Resorts',
      service_type_id: serviceTypes[2].id,
      currency: 'GBP',
      is_active: true,
      is_commissionable: true,
      parent_id: null as string | null
    },
    {
      name: 'Wyndham Hotels & Resorts',
      service_type_id: serviceTypes[3].id,
      currency: 'USD',
      is_active: true,
      is_commissionable: false,
      parent_id: null as string | null
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
          is_commissionable: data.is_commissionable,
          parent_id: data.parent_id
        },
        create: {
          name: data.name,
          service_type_id: data.service_type_id,
          currency: data.currency,
          is_active: data.is_active,
          is_commissionable: data.is_commissionable,
          parent_id: data.parent_id
        },
        include: {
          serviceType: true
        }
      })
      createdPortfolios.push(portfolio)
      console.log(`  ✓ ${portfolio.name}`)
    } catch (error) {
      console.error(`  ✗ Failed to create portfolio ${data.name}:`, error)
    }
  }

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
    console.log(`   Parent ID:       ${portfolio.parent_id ?? '—'}`)
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
