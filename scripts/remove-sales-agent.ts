import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeSalesAgent() {
  try {
    console.log('Scanning portfolios for sales_agent_id values...')

    const portfoliosWithAgent = await prisma.portfolio.findMany({
      where: {
        salesAgent: { isNot: null }
      },
      select: { id: true, name: true, sales_agent_id: true }
    })

    console.log(
      `Found ${portfoliosWithAgent.length} portfolio(s) with a sales_agent_id value.`
    )

    if (portfoliosWithAgent.length === 0) {
      console.log('Nothing to do.')
      return
    }

    for (const p of portfoliosWithAgent) {
      console.log(`  - "${p.name}" (${p.id})  sales_agent_id: "${p.sales_agent_id}"`)
    }

    const result = await prisma.portfolio.updateMany({
      where: { sales_agent_id: { not: null } },
      data: { sales_agent_id: null }
    })

    console.log(`\nCleared sales_agent_id on ${result.count} portfolio(s).`)
    console.log('Done.')
  } catch (error) {
    console.error('Error removing sales_agent values:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

removeSalesAgent()
