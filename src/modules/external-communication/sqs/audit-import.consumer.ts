import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common'
import { SQSClient, Message } from '@aws-sdk/client-sqs'
import { S3Client } from '@aws-sdk/client-s3'
import { OtaType } from '@prisma/client'
import { ConfigService } from '../../../config/config.service'
import type { IAuditRepository } from '../../audit/audit.interface'
import type { IAuditStatusRepository } from '../../audit-status/audit-status.interface'
import type { IPropertyRepository } from '../../property/property.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ParallelProcessor } from '../../../common/utils/parallel-processor.util'
import {
  parseSpreadsheetToJson,
  validateSpreadsheetFile
} from '../../../common/utils/spreadsheet.util'
import {
  AuditImportSqsMessage,
  createS3Client,
  createSqsClient,
  deleteAuditImportMessage,
  deleteFileFromS3,
  downloadFileFromS3,
  receiveAuditImportMessages
} from './audit-import-sqs.util'
import { AuditImportReport, AuditImportRowError } from '../external-communication.dto'

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
    @Inject('IAuditRepository')
    private readonly auditRepository: IAuditRepository,
    @Inject('IAuditStatusRepository')
    private readonly auditStatusRepository: IAuditStatusRepository,
    @Inject('IPropertyRepository')
    private readonly propertyRepository: IPropertyRepository,
    private readonly prisma: PrismaService
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
      totalRows: rows.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulImports: []
    }

    const batchSize = ParallelProcessor.getWorkerCount()

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map((row, idx) => this.processRow(row, i + idx + 2))
      )

      for (const result of batchResults) {
        if (result.success) {
          report.successCount++
          report.successfulImports.push(result.description!)
        } else {
          report.failureCount++
          report.errors.push({
            row: result.rowNumber,
            expediaId: result.expediaId ?? 'Unknown',
            reason: result.error!
          })
        }
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

  private async processRow(
    row: any,
    rowNumber: number
  ): Promise<{
    success: boolean
    rowNumber: number
    expediaId?: string
    description?: string
    error?: string
  }> {
    try {
      const expediaId = this.findHeaderValue(row, [
        'Expedia ID',
        'Expedia Id',
        'Expedia id',
        'expedia_id'
      ])

      if (!expediaId) {
        return {
          success: false,
          rowNumber,
          error:
            'Expedia ID is required. Available columns: ' +
            Object.keys(row).join(', ')
        }
      }

      const property = await this.propertyRepository.findByExpediaId(expediaId)
      if (!property) {
        return {
          success: false,
          rowNumber,
          expediaId,
          error: 'Property not found with this Expedia ID'
        }
      }

      const otaTypeValue = this.findHeaderValue(row, [
        'OTA',
        'OTA Type',
        'Ota Type',
        'Ota type',
        'type_of_ota'
      ])

      const typeOfOtaArray: OtaType[] = []
      if (otaTypeValue) {
        for (const otaStr of otaTypeValue.split(',').map(s => s.trim()).filter(Boolean)) {
          const parsed = this.parseOtaType(otaStr)
          if (parsed && !typeOfOtaArray.includes(parsed)) {
            typeOfOtaArray.push(parsed)
          }
        }
      }

      const auditStatusValue = this.findHeaderValue(row, [
        'Audit Status',
        'Audit status',
        'Status',
        'audit_status_id'
      ])
      if (!auditStatusValue) {
        return {
          success: false,
          rowNumber,
          expediaId,
          error: 'Audit status is required'
        }
      }

      let auditStatus = await this.auditStatusRepository.findByStatus(auditStatusValue)
      if (!auditStatus) {
        auditStatus = await this.auditStatusRepository.create({ status: auditStatusValue })
      }

      const expediaAmountCollectable = this.parseAmount(
        this.findHeaderValue(row, ['Expedia Amount Collectable', 'Expedia Collectable', 'expedia_amount_collectable'])
      )
      const expediaAmountConfirmed = this.parseAmount(
        this.findHeaderValue(row, ['Expedia Amount Confirmed', 'Expedia Confirmed', 'expedia_amount_confirmed'])
      )
      const agodaAmountCollectable = this.parseAmount(
        this.findHeaderValue(row, ['Agoda Amount Collectable', 'Agoda Collectable', 'agoda_amount_collectable'])
      )
      const agodaAmountConfirmed = this.parseAmount(
        this.findHeaderValue(row, ['Agoda Amount Confirmed', 'Agoda Confirmed', 'agoda_amount_confirmed'])
      )
      const bookingAmountCollectable = this.parseAmount(
        this.findHeaderValue(row, ['Booking Amount Collectable', 'Booking Collectable', 'booking_amount_collectable'])
      )
      const bookingAmountConfirmed = this.parseAmount(
        this.findHeaderValue(row, ['Booking Amount Confirmed', 'Booking Confirmed', 'booking_amount_confirmed'])
      )

      const reportUrl = this.findHeaderValue(row, [
        'Report URL', 'Report url', 'report_url', 'Report', 'URL'
      ])

      const reviewCollectionDateRaw = this.getRawValue(row, [
        'Review/Collection Date', 'Review/collection date',
        'Review Collection Date', 'Review collection date',
        'review_collection_date'
      ])
      let reviewCollectionDate: Date | null = null
      if (reviewCollectionDateRaw) {
        reviewCollectionDate = this.parseDate(reviewCollectionDateRaw)
        if (!reviewCollectionDate) {
          return {
            success: false,
            rowNumber,
            expediaId,
            error: 'Invalid review collection date format (expected mm/dd/yyyy)'
          }
        }
      }

      const batchValue = this.findHeaderValue(row, ['Batch', 'Batch No'])
      let batchId: string | undefined

      if (batchValue) {
        let batch = await this.prisma.auditBatch.findFirst({
          where: { batch_no: batchValue }
        })
        if (!batch) {
          batch = await this.prisma.auditBatch.create({
            data: { batch_no: batchValue }
          })
        }
        batchId = batch.id
      }

      await this.auditRepository.create({
        property_id: property.id,
        audit_status_id: auditStatus.id,
        type_of_ota: typeOfOtaArray.length > 0 ? typeOfOtaArray : undefined,
        expedia_amount_collectable: expediaAmountCollectable,
        expedia_amount_confirmed: expediaAmountConfirmed,
        agoda_amount_collectable: agodaAmountCollectable,
        agoda_amount_confirmed: agodaAmountConfirmed,
        booking_amount_collectable: bookingAmountCollectable,
        booking_amount_confirmed: bookingAmountConfirmed,
        report_url: reportUrl,
        review_collection_date: reviewCollectionDate
          ? reviewCollectionDate.toISOString()
          : undefined,
        batch_id: batchId
      })

      const description = `${expediaId} - ${typeOfOtaArray.length > 0 ? typeOfOtaArray.join(', ') : 'Unknown OTA'} Audit`
      return { success: true, rowNumber, expediaId, description }
    } catch (error) {
      return {
        success: false,
        rowNumber,
        error: (error as Error).message || 'Unknown error occurred'
      }
    }
  }

  /**
   * Stub — will be implemented once the callback API contract is defined.
   * Called after every import job completes (success or partial failure).
   */
   
  private async onImportComplete(
    _jobId: string,
    _report: AuditImportReport
  ): Promise<void> {
    // TODO: call external API with the completed report
  }

  private findHeaderValue(row: any, possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      const value = row[name]
      if (value !== undefined && value !== null && value !== '') {
        return String(value).trim()
      }
    }

    const rowKeys = Object.keys(row)
    for (const name of possibleNames) {
      for (const key of rowKeys) {
        const cleanKey = key.split('*')[0].trim()
        if (cleanKey.toLowerCase() === name.toLowerCase()) {
          const value = row[key]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }
      }
    }

    return undefined
  }

  private getRawValue(row: any, possibleNames: string[]): any {
    for (const name of possibleNames) {
      const value = row[name]
      if (value !== undefined && value !== null && value !== '') return value
    }

    const rowKeys = Object.keys(row)
    for (const name of possibleNames) {
      for (const key of rowKeys) {
        const cleanKey = key.split('*')[0].trim()
        if (cleanKey.toLowerCase() === name.toLowerCase()) {
          const value = row[key]
          if (value !== undefined && value !== null && value !== '') return value
        }
      }
    }

    return undefined
  }

  private parseAmount(value: string | undefined): number | undefined {
    if (!value) return undefined
    const parsed = parseFloat(value)
    if (isNaN(parsed)) return undefined
    return Math.round(parsed * 100) / 100
  }

  private parseDate(dateValue: any): Date | null {
    if (!dateValue) return null
    try {
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue
      }
      if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30)
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
          return date
        }
        return null
      }
      const dateString = String(dateValue)
      const parts = dateString.trim().split('/')
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10)
        const day = parseInt(parts[1], 10)
        const year = parseInt(parts[2], 10)
        if (!isNaN(month) && !isNaN(day) && !isNaN(year) && year >= 1900 && year <= 2100) {
          return new Date(year, month - 1, day)
        }
      }
      const date = new Date(dateString)
      if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
        return date
      }
      return null
    } catch {
      return null
    }
  }

  private parseOtaType(otaString: string): OtaType | null {
    const normalized = otaString.toLowerCase().trim()
    switch (normalized) {
      case 'expedia':
      case 'exp':
        return OtaType.expedia
      case 'agoda':
      case 'ago':
        return OtaType.agoda
      case 'booking':
      case 'booking.com':
      case 'book':
        return OtaType.booking
      default:
        return null
    }
  }

  private logSummary(report: AuditImportReport): void {
    console.log('\n\x1b[36m%s\x1b[0m', '========================================')
    console.log('\x1b[36m%s\x1b[0m', `📊 IMPORT SUMMARY — Job ${report.jobId}`)
    console.log('\x1b[36m%s\x1b[0m', '========================================')
    console.log('\x1b[33m%s\x1b[0m', `📝 Total Rows: ${report.totalRows}`)
    console.log('\x1b[32m%s\x1b[0m', `✅ Successful: ${report.successCount}`)
    console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${report.failureCount}`)
    if (report.failureCount > 0) {
      console.log('\n\x1b[31m%s\x1b[0m', '❌ Errors:')
      console.table(report.errors)
    }
    console.log('\x1b[36m%s\x1b[0m', '========================================\n')
  }
}

export type { AuditImportRowError }
