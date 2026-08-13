import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { computeAuditDerivedAmounts } from '../src/common/utils/amount.util'
import { ColoredLogger } from '../src/common/utils/colored-logger.util'

config()

const prisma = new PrismaClient()
const logger = new ColoredLogger('BackfillAuditDerivedAmounts')
const dryRun = process.argv.includes('--dry-run')

async function backfillAuditDerivedAmounts() {
  logger.info(
    `Starting audit derived amounts backfill${dryRun ? ' (dry run)' : ''}...`
  )

  const audits = await prisma.audit.findMany({
    select: {
      id: true,
      expedia_amount_confirmed: true,
      agoda_amount_confirmed: true,
      booking_amount_confirmed: true,
      gross_total: true,
      due_to_vnp: true,
      due_to_property: true
    }
  })

  logger.info(`Found ${audits.length} audit(s) to process`)

  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const audit of audits) {
    try {
      const derived = computeAuditDerivedAmounts({
        expedia_amount_confirmed: audit.expedia_amount_confirmed,
        agoda_amount_confirmed: audit.agoda_amount_confirmed,
        booking_amount_confirmed: audit.booking_amount_confirmed
      })

      const alreadyCorrect =
        audit.gross_total === derived.gross_total &&
        audit.due_to_vnp === derived.due_to_vnp &&
        audit.due_to_property === derived.due_to_property

      if (alreadyCorrect) {
        skippedCount++
        continue
      }

      if (dryRun) {
        logger.warn(
          `  [dry run] Would update audit ${audit.id}: ` +
            `gross_total=${derived.gross_total}, ` +
            `due_to_vnp=${derived.due_to_vnp}, ` +
            `due_to_property=${derived.due_to_property}`
        )
        updatedCount++
        continue
      }

      await prisma.audit.update({
        where: { id: audit.id },
        data: derived
      })

      logger.success(
        `  Updated audit ${audit.id}: ` +
          `gross_total=${derived.gross_total}, ` +
          `due_to_vnp=${derived.due_to_vnp}, ` +
          `due_to_property=${derived.due_to_property}`
      )
      updatedCount++
    } catch (error) {
      errorCount++
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`  Failed audit ${audit.id}: ${message}`)
    }
  }

  logger.info('--- Summary ---')
  logger.info(`Total: ${audits.length}`)
  logger.info(`Updated: ${updatedCount}`)
  logger.info(`Skipped (already correct): ${skippedCount}`)
  logger.info(`Errors: ${errorCount}`)
  logger.success('Backfill complete')
}

backfillAuditDerivedAmounts()
  .catch(error => {
    logger.error(
      `Backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
