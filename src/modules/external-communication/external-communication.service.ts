import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { S3Client } from '@aws-sdk/client-s3'
import { SQSClient } from '@aws-sdk/client-sqs'
import { randomUUID } from 'crypto'
import { ConfigService } from '../../config/config.service'
import { validateSpreadsheetFile } from '../../common/utils/spreadsheet.util'
import {
  BulkAuditImportAcceptedDto,
  GenerateTokenResponseDto
} from './external-communication.dto'
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
    file: Express.Multer.File
  ): Promise<BulkAuditImportAcceptedDto> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    validateSpreadsheetFile(file)

    const queueUrl = this.configService.sqs.auditImportQueueUrl
    if (!queueUrl) {
      throw new InternalServerErrorException(
        'Audit import queue is not configured on this server'
      )
    }

    const jobId = randomUUID()
    const ext = file.originalname.split('.').pop() ?? 'xlsx'
    const s3Key = `external/audit-imports/${jobId}.${ext}`

    await uploadFileToS3(
      this.s3Client,
      this.configService.s3.bucketName,
      s3Key,
      file.buffer,
      file.mimetype || 'application/octet-stream'
    )

    const message: AuditImportSqsMessage = {
      jobId,
      s3Key,
      originalName: file.originalname,
      requestedAt: new Date().toISOString()
    }

    const messageId = await enqueueAuditImport(
      this.sqsClient,
      queueUrl,
      message
    )

    console.log(
      `[ExternalCommunicationService] Enqueued audit import job ${jobId} (SQS MessageId: ${messageId})`
    )

    return { jobId, message: 'Import is on Processing' }
  }
}
