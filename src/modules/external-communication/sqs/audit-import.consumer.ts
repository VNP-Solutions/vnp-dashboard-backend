import { S3Client } from '@aws-sdk/client-s3'

import { Message, SQSClient } from '@aws-sdk/client-sqs'

import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common'

import { JwtService } from '@nestjs/jwt'

import { EXTERNAL_API_SUPER_ADMIN_CONTEXT } from '../../../common/constants/external-api-user.context'

import { ColoredLogger } from '../../../common/utils/colored-logger.util'

import {
  parseSpreadsheetToJson,
  validateSpreadsheetFile
} from '../../../common/utils/spreadsheet.util'

import { ConfigService } from '../../../config/config.service'

import type { IAuditService } from '../../audit/audit.interface'

import {
  AuditImportReport,
  AuditImportRowError
} from '../external-communication.dto'

import {
  BULK_AUDIT_IMPORT_CALLBACK_PATHS,
  EXTERNAL_BULK_IMPORT_AUDIT_STATUS,
  type BulkAuditImportType,
  isBulkAuditImportType
} from '../external-communication.constants'

import {
  AuditImportSqsMessage,
  createS3Client,
  createSqsClient,
  deleteAuditImportMessage,
  deleteFileFromS3,
  downloadFileFromS3,
  receiveAuditImportMessages
} from './audit-import-sqs.util'

@Injectable()
export class AuditImportConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new ColoredLogger(AuditImportConsumer.name)

  private sqsClient!: SQSClient

  private s3Client!: S3Client

  private queueUrl!: string

  private bucketName!: string

  private isRunning = false

  private shutdownSignal = false

  constructor(
    private readonly configService: ConfigService,

    private readonly jwtService: JwtService,

    @Inject('IAuditService')
    private readonly auditService: IAuditService
  ) {}

  onApplicationBootstrap(): void {
    const queueUrl = this.configService.sqs.auditImportQueueUrl

    if (!queueUrl) {
      this.logger.warn(
        'AUDIT_IMPORT_QUEUE_URL is not set — consumer will not start'
      )

      return
    }

    this.queueUrl = queueUrl

    this.bucketName = this.configService.s3.bucketName

    const s3Config = this.configService.s3

    this.sqsClient = createSqsClient({
      region: s3Config.region,

      accessKeyId: s3Config.accessKey,

      secretAccessKey: s3Config.secretKey
    })

    this.s3Client = createS3Client({
      region: s3Config.region,

      accessKeyId: s3Config.accessKey,

      secretAccessKey: s3Config.secretKey
    })

    this.logger.success(
      `SQS consumer bootstrapped — queue="${queueUrl}" bucket="${this.bucketName}"`
    )
    this.logger.info(
      '🔄 Starting long-poll loop (WaitTimeSeconds=20, VisibilityTimeout=300)...'
    )

    void this.startPolling()
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutdownSignal = true

    this.logger.warn(
      'Shutdown signal received — waiting for in-flight job to finish...'
    )

    const timeout = Date.now() + 30_000

    while (this.isRunning && Date.now() < timeout) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    this.logger.warn('Shutdown complete')
  }

  private async startPolling(): Promise<void> {
    while (!this.shutdownSignal) {
      try {
        const messages = await receiveAuditImportMessages(
          this.sqsClient,

          this.queueUrl
        )

        if (messages.length === 0) {
          // Long-poll returned no messages — stay quiet to avoid log spam.
          continue
        }

        this.logger.info(
          `📬 SQS long-poll returned ${messages.length} message(s)`
        )

        for (const message of messages) {
          if (this.shutdownSignal) break

          await this.processMessage(message)
        }
      } catch (error) {
        if (!this.shutdownSignal) {
          this.logger.error(`SQS poll error: ${(error as Error).message}`)

          await new Promise(resolve => setTimeout(resolve, 5_000))
        }
      }
    }
  }

  private async processMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return

    this.logger.info(
      `🆔 SQS message received — MessageId=${message.MessageId} (body length=${message.Body.length} chars)`
    )

    let parsedMessage: AuditImportSqsMessage

    try {
      parsedMessage = JSON.parse(message.Body) as AuditImportSqsMessage
      this.logger.info(
        `   ├─ Parsed SQS body → jobId=${parsedMessage.jobId} importType=${parsedMessage.importType} qa_panel_id=${parsedMessage.qaPanelId} email=${parsedMessage.email}`
      )
      this.logger.info(
        `   └─ s3Key=${parsedMessage.s3Key} originalName="${parsedMessage.originalName}" requestedAt=${parsedMessage.requestedAt}`
      )
    } catch {
      this.logger.error(
        `Invalid JSON in SQS message — dropping. MessageId=${message.MessageId}`
      )

      await deleteAuditImportMessage(
        this.sqsClient,

        this.queueUrl,

        message.ReceiptHandle
      )

      this.logger.warn(`🗑️  Deleted malformed SQS message ${message.MessageId}`)

      return
    }

    if (!parsedMessage.jobId || !parsedMessage.s3Key) {
      this.logger.error(
        `Missing required fields in SQS message — dropping. MessageId=${message.MessageId}`
      )

      await deleteAuditImportMessage(
        this.sqsClient,

        this.queueUrl,

        message.ReceiptHandle
      )

      this.logger.warn(`🗑️  Deleted invalid SQS message ${message.MessageId}`)

      return
    }

    this.isRunning = true

    this.logger.info(
      `▶️  Processing job ${parsedMessage.jobId} (${parsedMessage.originalName})`
    )

    const jobStart = Date.now()

    try {
      const report = await this.runImport(parsedMessage)

      this.logger.success(
        `✓ Job ${parsedMessage.jobId} import finished in ${Date.now() - jobStart}ms — ` +
          `total: ${report.totalRows}, success: ${report.successCount}, failed: ${report.failureCount}`
      )

      const importType = this.resolveImportType(parsedMessage.importType)

      await this.onImportComplete(parsedMessage.jobId, report, importType)

      await deleteAuditImportMessage(
        this.sqsClient,

        this.queueUrl,

        message.ReceiptHandle
      )

      this.logger.success(
        `🗑️  Deleted SQS message ${message.MessageId} (job ${parsedMessage.jobId} fully processed)`
      )
    } catch (error) {
      this.logger.error(
        `Job ${parsedMessage.jobId} failed: ${(error as Error).message}`
      )
    } finally {
      this.isRunning = false
    }
  }

  private async runImport(
    msg: AuditImportSqsMessage
  ): Promise<AuditImportReport> {
    this.logger.info(
      `☁️  Downloading spreadsheet from S3 — bucket="${this.bucketName}" key="${msg.s3Key}"`
    )
    const s3DownloadStart = Date.now()
    const fileBuffer = await downloadFileFromS3(
      this.s3Client,

      this.bucketName,

      msg.s3Key
    )
    this.logger.success(
      `✓ S3 download complete (${Date.now() - s3DownloadStart}ms) — ${fileBuffer.length} bytes`
    )

    const fakeFile = {
      buffer: fileBuffer,

      originalname: msg.originalName,

      mimetype: 'application/octet-stream',

      size: fileBuffer.length
    } as Express.Multer.File

    this.logger.info('🔍 Validating downloaded spreadsheet file format...')
    validateSpreadsheetFile(fakeFile)
    this.logger.success('✓ Downloaded spreadsheet validated')

    this.logger.info('📄 Parsing spreadsheet into JSON rows...')
    const rows = parseSpreadsheetToJson(fakeFile)
    this.logger.success(`✓ Parsed ${rows.length} data row(s) from spreadsheet`)

    const report: AuditImportReport = {
      jobId: msg.jobId,

      qaPanelId: msg.qaPanelId,

      email: msg.email,

      totalRows: rows.length,

      successCount: 0,

      failureCount: 0,

      errors: [],

      successfulImports: []
    }

    this.logger.info(
      `💾 Calling AuditService.autoImport → will validate rows, resolve properties, ` +
        `create audits (status="${EXTERNAL_BULK_IMPORT_AUDIT_STATUS}"), generate per-property ` +
        `xlsx reports and upload them to S3 — writing to the dashboard DB...`
    )
    const importStart = Date.now()
    const result = await this.auditService.autoImport(
      fakeFile,

      EXTERNAL_API_SUPER_ADMIN_CONTEXT,

      { fixedAuditStatusLabel: EXTERNAL_BULK_IMPORT_AUDIT_STATUS }
    )
    this.logger.info(
      `⏱️  AuditService.autoImport returned in ${Date.now() - importStart}ms (success=${result.success})`
    )

    if (!result.success && result.errors?.length) {
      const failedRows = new Set(result.errors.map(e => e.row))

      report.failureCount = failedRows.size
      report.successCount = report.totalRows - failedRows.size

      report.errors = result.errors.map(
        (e): AuditImportRowError => ({
          row: e.row,

          expediaId: e.hotel_id ?? e.property ?? 'Unknown',

          reason: e.error
        })
      )

      this.logger.error(
        `❌ autoImport reported ${report.failureCount} failed row(s) — no audits written to the dashboard DB`
      )
    } else if (result.success) {
      report.successCount = report.totalRows
      report.failureCount = 0

      if (result.created_audits?.length) {
        report.successfulImports = result.created_audits.map(
          a => `${a.property} - Audit created (${a.audit_id})`
        )
        this.logger.success(
          `✅ Wrote ${result.created_audits.length} audit(s) to the dashboard DB:`
        )
        result.created_audits.forEach(a => {
          this.logger.success(
            `   • property="${a.property}" audit_id=${a.audit_id} report_url=${a.report_url}`
          )
        })
      } else {
        this.logger.warn(
          'autoImport succeeded but created 0 audits — nothing written to the dashboard DB'
        )
      }
    }

    this.logSummary(report)

    try {
      await deleteFileFromS3(this.s3Client, this.bucketName, msg.s3Key)
      this.logger.info(`🗑️  Deleted temp S3 object "${msg.s3Key}"`)
    } catch (err) {
      this.logger.warn(
        `Could not delete temp S3 file ${msg.s3Key}: ${(err as Error).message}`
      )
    }

    return report
  }

  /**

   * Called after every import job completes.

   * Fires POST {EXTERNAL_BASE_URL}{callbackPath} with a communication JWT

   * and the full import report so the external system knows the job outcome.

   */

  private async onImportComplete(
    _jobId: string,

    report: AuditImportReport,
    importType: BulkAuditImportType = 'ota'
  ): Promise<void> {
    const baseUrl = this.configService.externalBaseUrl

    if (!baseUrl) {
      this.logger.warn(
        'EXTERNAL_BASE_URL is not set — skipping import callback'
      )

      return
    }

    const communicationSecret = this.configService.jwt.communicationSecret

    if (!communicationSecret) {
      this.logger.warn(
        'JWT_COMMUNICATION_SECRET is not set — skipping import callback'
      )

      return
    }

    const token = this.jwtService.sign(
      { type: 'external-communication' },

      { secret: communicationSecret, expiresIn: '24h' }
    )

    const status = report.failureCount === 0 ? 'Success' : 'Failed'

    const body = {
      qa_panel_id: report.qaPanelId,

      email: report.email,

      status,

      report: {
        total: report.totalRows,

        success: report.successCount,

        failed: report.failureCount
      },

      errors: report.errors.map(e => ({
        row: e.row,

        failed_reason: e.reason
      }))
    }

    const url = `${baseUrl.replace(/\/$/, '')}${BULK_AUDIT_IMPORT_CALLBACK_PATHS[importType]}`

    this.logger.info(
      `📤 Sending import callback → POST ${url} (importType=${importType}, status=${status})`
    )
    this.logger.info(
      `   ├─ qa_panel_id=${report.qaPanelId}, email=${report.email}`
    )
    this.logger.info(
      `   └─ report={total=${report.totalRows}, success=${report.successCount}, failed=${report.failureCount}}, errors=${report.errors.length}`
    )

    try {
      const callbackStart = Date.now()
      const response = await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify(body)
      })

      const elapsed = Date.now() - callbackStart

      if (!response.ok) {
        const text = await response.text().catch(() => '')

        this.logger.error(
          `❌ Callback responded with HTTP ${response.status} (${elapsed}ms): ${text}`
        )
      } else {
        this.logger.success(
          `✓ Callback acknowledged — HTTP ${response.status} (${elapsed}ms)`
        )
      }
    } catch (err) {
      this.logger.error(
        `Failed to send import callback: ${(err as Error).message}`
      )
    }
  }

  private resolveImportType(
    importType: string | undefined
  ): BulkAuditImportType {
    return importType && isBulkAuditImportType(importType) ? importType : 'ota'
  }

  private logSummary(report: AuditImportReport): void {
    const cyan = '\x1b[36m'
    const green = '\x1b[32m'
    const red = '\x1b[31m'
    const yellow = '\x1b[33m'
    const magenta = '\x1b[35m'
    const bold = '\x1b[1m'
    const reset = '\x1b[0m'

    const line = '════════════════════════════════════════════════════════════'

    process.stdout.write(`\n${magenta}${bold}${line}${reset}\n`)
    process.stdout.write(
      `${magenta}${bold}  📊 BULK AUDIT IMPORT SUMMARY — Job ${report.jobId}${reset}\n`
    )
    process.stdout.write(`${magenta}${bold}${line}${reset}\n`)

    process.stdout.write(
      `${yellow}  📝 Total Rows      : ${report.totalRows}${reset}\n`
    )
    process.stdout.write(
      `${green}  ✅ Successful     : ${report.successCount}${reset}\n`
    )
    process.stdout.write(
      `${red}  ❌ Failed         : ${report.failureCount}${reset}\n`
    )
    process.stdout.write(
      `${cyan}  🗄️  Audits in DB   : ${report.successfulImports.length}${reset}\n`
    )
    process.stdout.write(
      `${cyan}  📧 Email          : ${report.email}${reset}\n`
    )
    process.stdout.write(
      `${cyan}  🆔 QA Panel ID    : ${report.qaPanelId}${reset}\n`
    )

    if (report.successfulImports.length > 0) {
      process.stdout.write(
        `\n${green}${bold}  ✅ Audits written to dashboard DB:${reset}\n`
      )
      report.successfulImports.forEach(item => {
        process.stdout.write(`${green}     • ${item}${reset}\n`)
      })
    }

    if (report.failureCount > 0) {
      process.stdout.write(`\n${red}${bold}  ❌ Row errors:${reset}\n`)
      console.table(report.errors)
    }

    process.stdout.write(`${magenta}${bold}${line}${reset}\n\n`)
  }
}

export type { AuditImportRowError }
