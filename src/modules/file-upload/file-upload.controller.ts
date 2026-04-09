import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import {
  BulkFileUploadResponseDto,
  FileUploadResponseDto
} from './file-upload.dto'
import type { IFileUploadService } from './file-upload.interface'

@ApiTags('File Upload')
@Public()
@Controller('file-upload')
export class FileUploadController {
  constructor(
    @Inject('IFileUploadService')
    private readonly fileUploadService: IFileUploadService
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to S3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileUploadResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request - No file provided' })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to upload file'
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File
  ): Promise<FileUploadResponseDto> {
    return this.fileUploadService.uploadFile(file)
  }

  @Post('bulk')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      limits: { fileSize: 50 * 1024 * 1024 } // 50 MB per file
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple files to S3 (max 50 files)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary'
          },
          description: 'Files to upload (max 50)'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    type: BulkFileUploadResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - No files provided'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to upload files'
  })
  async uploadBulkFiles(
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<BulkFileUploadResponseDto> {
    return this.fileUploadService.uploadBulkFiles(files)
  }
}
