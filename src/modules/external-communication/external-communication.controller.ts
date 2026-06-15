import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import {
  BulkAuditImportAcceptedDto,
  GenerateTokenResponseDto
} from './external-communication.dto'
import { ExternalCommunicationService } from './external-communication.service'
import { ExternalJwtGuard } from './guards/external-jwt.guard'
import { ExternalRawSecretGuard } from './guards/external-raw-secret.guard'

@ApiTags('External Communication')
@ApiBearerAuth('JWT-auth')
@Controller('external')
@Public()
export class ExternalCommunicationController {
  constructor(
    private readonly externalCommunicationService: ExternalCommunicationService
  ) {}

  /**
   * @route POST /api/external/generate-token
   * @auth Bearer <JWT_COMMUNICATION_SECRET>  (raw secret string, not a JWT)
   */
  @Post('generate-token')
  @UseGuards(ExternalRawSecretGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a communication JWT token',
    description:
      'Authenticate by passing the raw `JWT_COMMUNICATION_SECRET` value as the Bearer token.\n\n' +
      'On success, returns a signed JWT that the external backend can use as a Bearer token for all other `/external/*` endpoints.\n\n' +
      '**Token TTL:** 24 hours.'
  })
  @ApiResponse({
    status: 200,
    description: 'Token generated successfully',
    type: GenerateTokenResponseDto
  })
  @ApiResponse({
    status: 401,
    description:
      'Unauthorized — Bearer token does not match the communication secret'
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal Server Error — JWT_COMMUNICATION_SECRET is not configured on this server'
  })
  generateToken(): GenerateTokenResponseDto {
    return this.externalCommunicationService.generateToken()
  }

  /**
   * @route POST /api/external/bulk-audit-import
   * @auth Bearer <communication_jwt>  (JWT obtained from /external/generate-token)
   */
  @Post('bulk-audit-import')
  @UseGuards(ExternalJwtGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import audits from a spreadsheet (async via SQS)',
    description:
      'Upload an Excel (.xlsx, .xls) or CSV spreadsheet to bulk-import audits.\n\n' +
      '**Authentication:** Bearer token must be a valid communication JWT obtained from `POST /external/generate-token`.\n\n' +
      '**Response:** Returns **HTTP 202** immediately once the file has been uploaded to S3 and the job has been enqueued. ' +
      'The `jobId` in the response identifies the background job. ' +
      'The actual import (row parsing, property lookup, audit creation) runs asynchronously. ' +
      'Once complete, a callback is triggered (endpoint TBD) with the full import report.\n\n' +
      '**Spreadsheet columns:**\n' +
      '| Column | Required | Notes |\n' +
      '|---|---|---|\n' +
      '| Expedia ID | ✅ | Must match a property in the system |\n' +
      '| Audit Status | ✅ | Created automatically if not found |\n' +
      '| OTA / OTA Type | — | `expedia`, `agoda`, `booking` (comma-separated for multiple) |\n' +
      '| Expedia Amount Collectable | — | Numeric |\n' +
      '| Expedia Amount Confirmed | — | Numeric |\n' +
      '| Agoda Amount Collectable | — | Numeric |\n' +
      '| Agoda Amount Confirmed | — | Numeric |\n' +
      '| Booking Amount Collectable | — | Numeric |\n' +
      '| Booking Amount Confirmed | — | Numeric |\n' +
      '| Report URL | — | URL string |\n' +
      '| Review/Collection Date | — | `mm/dd/yyyy` format |\n' +
      '| Batch / Batch No | — | Auto-created if not found |'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx, .xls) or CSV spreadsheet file'
        }
      }
    }
  })
  @ApiResponse({
    status: 202,
    description:
      'Accepted — file received and import job enqueued for background processing',
    type: BulkAuditImportAcceptedDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request — no file provided or unsupported file format'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — Bearer token is missing, invalid, or expired'
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal Server Error — SQS queue URL (AUDIT_IMPORT_QUEUE_URL) is not configured'
  })
  async bulkAuditImport(
    @UploadedFile() file: Express.Multer.File
  ): Promise<BulkAuditImportAcceptedDto> {
    return this.externalCommunicationService.enqueueBulkAuditImport(file)
  }
}
