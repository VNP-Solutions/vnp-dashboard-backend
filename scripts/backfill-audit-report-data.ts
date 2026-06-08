import { Prisma, PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { ColoredLogger } from '../src/common/utils/colored-logger.util'
import {
  buildReportDataFromReportUrl,
  isMissingReportData
} from '../src/modules/audit/report-data.util'

config()

const prisma = new PrismaClient()
const logger = new ColoredLogger('BackfillReportData')
const dryRun = process.argv.includes('--dry-run')

async function backfillAuditReportData() {
  logger.info(
    `Starting audit report_data backfill${dryRun ? ' (dry run)' : ''}...`
  )

  const candidates = await prisma.audit.findMany({
    where: {
      report_url: { not: null }
    },
    select: {
      id: true,
      report_url: true,
      report_data: true
    }
  })

  const audits = candidates.filter(audit =>
    isMissingReportData(audit.report_data)
  )

  logger.info(
    `Found ${audits.length} audit(s) with report_url but no report_data`
  )

  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const audit of audits) {
    const reportUrl = audit.report_url
    if (!reportUrl) {
      skippedCount++
      continue
    }

    try {
      logger.info(`Processing audit ${audit.id}...`)

      const reportData = await buildReportDataFromReportUrl(reportUrl)

      if (dryRun) {
        logger.warn(
          `  [dry run] Would set report_data with ${reportData.length} row(s) for audit ${audit.id}`
        )
        updatedCount++
        continue
      }

      await prisma.audit.update({
        where: { id: audit.id },
        data: {
          report_data: reportData as unknown as Prisma.InputJsonValue
        }
      })

      logger.success(
        `  Updated audit ${audit.id} with ${reportData.length} report_data row(s)`
      )
      updatedCount++
    } catch (error) {
      errorCount++
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`  Failed audit ${audit.id}: ${message}`)
    }
  }

  logger.table(
    ['Metric', 'Count'],
    [
      ['Candidates', String(audits.length)],
      [dryRun ? 'Would update' : 'Updated', String(updatedCount)],
      ['Skipped', String(skippedCount)],
      ['Errors', String(errorCount)]
    ]
  )

  if (errorCount > 0) {
    logger.warn('Backfill completed with some errors. Review the logs above.')
  } else {
    logger.success('Backfill completed successfully.')
  }
}

backfillAuditReportData()
  .then(() => {
    logger.success('Backfill script finished')
    process.exit(0)
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`Backfill script failed: ${message}`)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
