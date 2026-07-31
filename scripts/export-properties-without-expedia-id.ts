/**
 * Export properties with no Expedia ID to CSV.
 *
 * Usage:
 *   yarn ts-node scripts/export-properties-without-expedia-id.ts
 */
import { config } from 'dotenv'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'

config({ path: resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function main() {
  const properties = await prisma.property.findMany({
    where: {
      OR: [{ credentials: { is: null } }, { credentials: { expedia_id: '' } }]
    },
    select: {
      id: true,
      name: true,
      portfolio: {
        select: { name: true }
      }
    },
    orderBy: [{ portfolio: { name: 'asc' } }, { name: 'asc' }]
  })

  const header = 'property_id,property_name,portfolio_name'
  const lines = properties.map(p =>
    [escapeCsv(p.id), escapeCsv(p.name), escapeCsv(p.portfolio.name)].join(',')
  )

  const outputPath = resolve(
    process.cwd(),
    'data/properties-without-expedia-id.csv'
  )
  writeFileSync(outputPath, [header, ...lines].join('\n'), 'utf8')

  console.log(`Found ${properties.length} properties without Expedia ID`)
  console.log(`Wrote ${outputPath}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
