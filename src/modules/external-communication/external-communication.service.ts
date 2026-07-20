import { S3Client } from '@aws-sdk/client-s3'
import { SQSClient } from '@aws-sdk/client-sqs'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import { ColoredLogger } from '../../common/utils/colored-logger.util'
import { validateSpreadsheetFile } from '../../common/utils/spreadsheet.util'
import { ConfigService } from '../../config/config.service'
import {
  BulkAuditImportAcceptedDto,
  GenerateTokenResponseDto
} from './external-communication.dto'
import type { BulkAuditImportType } from './external-communication.constants'
import {
  AuditImportSqsMessage,
  createS3Client,
  createSqsClient,
  enqueueAuditImport,
  uploadFileToS3
} from './sqs/audit-import-sqs.util'

const TOKEN_EXPIRES_IN = '24h'

@Injectable()
export class ExternalCommunicationService {
  private readonly logger = new ColoredLogger(ExternalCommunicationService.name)
  private readonly sqsClient: SQSClient
  private readonly s3Client: S3Client

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {
    const s3Config = configService.s3
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
  }

  generateToken(): GenerateTokenResponseDto {
    const token = this.jwtService.sign(
      { type: 'external-communication' },
      { expiresIn: TOKEN_EXPIRES_IN }
    )
    return { token, expiresIn: TOKEN_EXPIRES_IN }
  }

  async enqueueBulkAuditImport(
    file: Express.Multer.File,
    qaPanelId: string,
    email: string,
    importType: BulkAuditImportType
  ): Promise<BulkAuditImportAcceptedDto> {
    this.logger.info(
      `\n📥 BULK AUDIT IMPORT REQUEST RECEIVED — type=${importType}`
    )
    this.logger.info(`   ├─ qa_panel_id=${qaPanelId}, email=${email}`)
    this.logger.info(
      `   └─ file="${file?.originalname ?? 'N/A'}" size=${file?.size ?? 0} bytes mimetype="${file?.mimetype ?? 'N/A'}"`
    )

    if (!file) {
      this.logger.error('❌ No file provided — rejecting request')
      throw new BadRequestException('No file provided')
    }

    this.logger.info('🔍 Validating spreadsheet file format...')
    validateSpreadsheetFile(file)
    this.logger.success('✓ Spreadsheet file validated')

    const queueUrl = this.configService.sqs.auditImportQueueUrl
    if (!queueUrl) {
      this.logger.error(
        '❌ AUDIT_IMPORT_QUEUE_URL is not configured — cannot enqueue job'
      )
      throw new InternalServerErrorException(
        'Audit import queue is not configured on this server'
      )
    }
    this.logger.info(`📬 SQS queue URL resolved: ${queueUrl}`)

    const jobId = randomUUID()
    const ext = file.originalname.split('.').pop() ?? 'xlsx'
    const s3Key = `external/audit-imports/${jobId}.${ext}`
    this.logger.info(`🆔 Generated jobId=${jobId}`)
    this.logger.info(`🔑 S3 object key=${s3Key}`)

    this.logger.info('☁️  Uploading spreadsheet to S3...')
    const s3UploadStart = Date.now()
    await uploadFileToS3(
      this.s3Client,
      this.configService.s3.bucketName,
      s3Key,
      file.buffer,
      file.mimetype || 'application/octet-stream'
    )
    this.logger.success(
      `✓ S3 upload complete (${Date.now() - s3UploadStart}ms) → bucket="${this.configService.s3.bucketName}" key="${s3Key}"`
    )

    const message: AuditImportSqsMessage = {
      jobId,
      s3Key,
      originalName: file.originalname,
      requestedAt: new Date().toISOString(),
      qaPanelId,
      email,
      importType
    }
    this.logger.info('📦 Built SQS message body for job')

    this.logger.info('📨 Enqueuing job to SQS...')
    const sqsEnqueueStart = Date.now()
    const messageId = await enqueueAuditImport(
      this.sqsClient,
      queueUrl,
      message
    )
    this.logger.success(
      `✓ SQS enqueue complete (${Date.now() - sqsEnqueueStart}ms) → SQS MessageId=${messageId ?? 'N/A'}`
    )

    this.logger.success(
      `🚀 Job ${jobId} accepted — returning HTTP 202 to caller. ` +
        `Background consumer will pick up the SQS message and write audits to the dashboard DB.`
    )

    return {
      jobId,
      message:
        "Import is on processing, you'll get an email once the import is done"
    }
  }
}
