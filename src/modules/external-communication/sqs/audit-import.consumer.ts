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
      console.log(
        '[AuditImportConsumer] AUDIT_IMPORT_QUEUE_URL is not set — consumer will not start'
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

    console.log('[AuditImportConsumer] Starting long-poll loop...')

    void this.startPolling()
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutdownSignal = true

    const timeout = Date.now() + 30_000

    while (this.isRunning && Date.now() < timeout) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log('[AuditImportConsumer] Shutdown complete')
  }

  private async startPolling(): Promise<void> {
    while (!this.shutdownSignal) {
      try {
        const messages = await receiveAuditImportMessages(
          this.sqsClient,

          this.queueUrl
        )

        for (const message of messages) {
          if (this.shutdownSignal) break

          await this.processMessage(message)
        }
      } catch (error) {
        if (!this.shutdownSignal) {
          console.error(
            '[AuditImportConsumer] Poll error:',

            (error as Error).message
          )

          await new Promise(resolve => setTimeout(resolve, 5_000))
        }
      }
    }
  }

  private async processMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return

    let parsedMessage: AuditImportSqsMessage

    try {
      parsedMessage = JSON.parse(message.Body) as AuditImportSqsMessage
    } catch {
      console.error(
        '[AuditImportConsumer] Invalid JSON in message — dropping:',

        message.MessageId
      )

      await deleteAuditImportMessage(
        this.sqsClient,

        this.queueUrl,

        message.ReceiptHandle
      )

      return
    }

    if (!parsedMessage.jobId || !parsedMessage.s3Key) {
      console.error(
        '[AuditImportConsumer] Missing required fields — dropping:',

        message.MessageId
      )

      await deleteAuditImportMessage(
        this.sqsClient,

        this.queueUrl,

        message.ReceiptHandle
      )

      return
    }

    this.isRunning = true

    console.log(
      `[AuditImportConsumer] Processing job ${parsedMessage.jobId} (${parsedMessage.originalName})`
    )

    try {
      const report = await this.runImport(parsedMessage)

      console.log(
        `[AuditImportConsumer] Job ${parsedMessage.jobId} complete — ` +
          `total: ${report.totalRows}, success: ${report.successCount}, failed: ${report.failureCount}`
      )

      await this.onImportComplete(parsedMessage.jobId, report)

      await deleteAuditImportMessage(
        this.sqsClient,

        this.queueUrl,

        message.ReceiptHandle
      )
    } catch (error) {
      console.error(
        `[AuditImportConsumer] Job ${parsedMessage.jobId} failed:`,

        (error as Error).message
      )
    } finally {
      this.isRunning = false
    }
  }

  private async runImport(
    msg: AuditImportSqsMessage
  ): Promise<AuditImportReport> {
    const fileBuffer = await downloadFileFromS3(
      this.s3Client,

      this.bucketName,

      msg.s3Key
    )

    const fakeFile = {
      buffer: fileBuffer,

      originalname: msg.originalName,

      mimetype: 'application/octet-stream',

      size: fileBuffer.length
    } as Express.Multer.File

    validateSpreadsheetFile(fakeFile)

    const rows = parseSpreadsheetToJson(fakeFile)

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

    const result = await this.auditService.autoImport(
      fakeFile,

      EXTERNAL_API_SUPER_ADMIN_CONTEXT
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
    } else if (result.success) {
      report.successCount = report.totalRows
      report.failureCount = 0

      if (result.created_audits?.length) {
        report.successfulImports = result.created_audits.map(
          a => `${a.property} - Audit created (${a.audit_id})`
        )
      }
    }

    this.logSummary(report)

    try {
      await deleteFileFromS3(this.s3Client, this.bucketName, msg.s3Key)
    } catch (err) {
      console.warn(
        `[AuditImportConsumer] Could not delete temp S3 file ${msg.s3Key}:`,

        (err as Error).message
      )
    }

    return report
  }

  /**

   * Called after every import job completes.

   * Fires POST {EXTERNAL_BASE_URL}/qa-panel/import-callback with a communication JWT

   * and the full import report so the external system knows the job outcome.

   */

  private async onImportComplete(
    _jobId: string,

    report: AuditImportReport
  ): Promise<void> {
    const baseUrl = this.configService.externalBaseUrl

    if (!baseUrl) {
      console.warn(
        '[AuditImportConsumer] EXTERNAL_BASE_URL is not set — skipping import callback'
      )

      return
    }

    const communicationSecret = this.configService.jwt.communicationSecret

    if (!communicationSecret) {
      console.warn(
        '[AuditImportConsumer] JWT_COMMUNICATION_SECRET is not set — skipping import callback'
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

    const url = `${baseUrl.replace(/\/$/, '')}/qa-panel/import-callback`

    try {
      console.log(
        `[AuditImportConsumer] Sending import callback to ${url} (status=${status})`
      )

      const response = await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')

        console.error(
          `[AuditImportConsumer] Callback responded with ${response.status}: ${text}`
        )
      } else {
        console.log(
          `[AuditImportConsumer] Callback acknowledged (${response.status})`
        )
      }
    } catch (err) {
      console.error(
        '[AuditImportConsumer] Failed to send import callback:',

        (err as Error).message
      )
    }
  }

  private logSummary(report: AuditImportReport): void {
    console.log(
      '\n\x1b[36m%s\x1b[0m',

      '========================================'
    )

    console.log('\x1b[36m%s\x1b[0m', `📊 IMPORT SUMMARY — Job ${report.jobId}`)

    console.log('\x1b[36m%s\x1b[0m', '========================================')

    console.log('\x1b[33m%s\x1b[0m', `📝 Total Rows: ${report.totalRows}`)

    console.log('\x1b[32m%s\x1b[0m', `✅ Successful: ${report.successCount}`)

    console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${report.failureCount}`)

    if (report.failureCount > 0) {
      console.log('\n\x1b[31m%s\x1b[0m', '❌ Errors:')

      console.table(report.errors)
    }

    console.log(
      '\x1b[36m%s\x1b[0m',

      '========================================\n'
    )
  }
}

export type { AuditImportRowError }
