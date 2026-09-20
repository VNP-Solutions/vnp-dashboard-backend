import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  BulkFileUploadResponseDto,
  FileUploadResponseDto
} from './file-upload.dto'
import type { IFileUploadService } from './file-upload.interface'

@ApiTags('File Upload')
@Controller('file-upload')
export class FileUploadController {
  constructor(
    @Inject('IFileUploadService')
    private readonly fileUploadService: IFileUploadService
  ) {}

  /**
   * Open without a token so the help page can attach a file before anyone signs in. Anonymous
   * uploads are capped, type-checked and land under their own prefix; see file-upload.policy.
   */
  @Post()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
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
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user?: IUserWithPermissions
  ): Promise<FileUploadResponseDto> {
    return this.fileUploadService.uploadFile(file, Boolean(user?.id))
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
