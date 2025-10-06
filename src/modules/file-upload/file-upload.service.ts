import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common'
import { ConfigService } from '../../config/config.service'
import type {
  FileUploadResponse,
  IFileUploadService
} from './file-upload.interface'

@Injectable()
export class FileUploadService implements IFileUploadService {
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly bucketUrl: string

  constructor(private readonly configService: ConfigService) {
    const s3Config = this.configService.s3

    this.s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey
      }
    })

    this.bucketName = s3Config.bucketName
    this.bucketUrl = s3Config.bucketUrl
  }

  async uploadFile(file: Express.Multer.File): Promise<FileUploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    const timestamp = Date.now()
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `uploads/${timestamp}-${sanitizedFileName}`

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype
          // ACL: 'public-read'
        }
      })

      await upload.done()

      const url = `${this.bucketUrl}/${key}`

      return {
        url,
        key,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
