import {
  Body,
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
  BulkAuditImportBodyDto,
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
   *
   * This endpoint is for OUTBOUND communication — our system calls this first to obtain
   * a signed JWT, then attaches that JWT as a Bearer token when calling the external backend's API.
   */
  @Post('generate-token')
  @UseGuards(ExternalRawSecretGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate an outbound communication JWT token',
    description:
      '**Purpose — outbound calls only.**\n\n' +
      "This endpoint is used by *our* system when it needs to call the external backend's API " +
      '(e.g. the post-import callback). Pass the raw `JWT_COMMUNICATION_SECRET` as the Bearer token; ' +
      'the response contains a signed JWT that can then be attached as the Bearer token on the outbound request.\n\n' +
      '> The external backend does **not** need to call this endpoint before calling our APIs. ' +
      'Their inbound calls are authenticated with the raw `JWT_COMMUNICATION_SECRET` directly.\n\n' +
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
   * @auth Bearer <signed-JWT>  (JWT signed with JWT_COMMUNICATION_SECRET, obtained from /generate-token)
   */
  @Post('bulk-audit-import')
  @UseGuards(ExternalJwtGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Auto-import audits from an OTA reservation sheet (async via SQS)',
    description:
      'Upload an Excel (.xlsx, .xls) or CSV spreadsheet containing OTA reservation rows. ' +
      'Processing follows the same rules as `POST /audit/auto-import`.\n\n' +
      '**Authentication:** Pass a signed JWT as the Bearer token. ' +
      'The JWT must be signed with `JWT_COMMUNICATION_SECRET` and must not be expired. ' +
      'Obtain the token first from `POST /external/generate-token`.\n\n' +
      '**Response:** Returns **HTTP 202** immediately once the file has been uploaded to S3 and the job has been enqueued. ' +
      'The `jobId` in the response identifies the background job. ' +
      'The actual import (validation, property lookup, grouped audit creation, per-property report upload) runs asynchronously. ' +
      'Once complete, a callback is sent to the external system with the full import report.\n\n' +
      '**Required columns:**\n' +
      '- **OTA** — `expedia`, `agoda`, or `booking`\n' +
      '- **Status / Audit Status** — matched case-insensitively to an existing status, or created if not found\n' +
      '- **Property lookup** (either):\n' +
      '  - **Hotel ID** + OTA — must match the property credential ID for that OTA, or\n' +
      '  - **Hotel Name** — must match an existing property when Hotel ID is not used\n' +
      '- **Amount Collected** — numeric amount for the reservation row\n\n' +
      '**Optional columns:** Check In, Check Out, Batch, Review/Collection Date, Portfolio (carried into generated report sheets).\n\n' +
      '**Behaviour:**\n' +
      '- Rows are grouped by resolved property + status — one audit is created per unique combination.\n' +
      '- OTA types are collected from all rows in the group; amounts are summed per OTA (collectable and confirmed set to the same sum).\n' +
      '- A per-property Excel report is generated and uploaded to S3; its URL is stored as `report_url` on the audit.\n' +
      '- If any row fails validation, no audits are created and all errors are returned in the callback.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'qa_panel_id', 'email'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx, .xls) or CSV spreadsheet file'
        },
        qa_panel_id: {
          type: 'string',
          description:
            'QA Panel ID to associate with this import job. Forwarded to the callback API when the import completes.',
          example: '6a2fbcbd4e6bed36e9c31654'
        },
        email: {
          type: 'string',
          format: 'email',
          description:
            'Email address to associate with this import job. Carried through the SQS message and included in the import report.',
          example: 'user@example.com'
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
    @UploadedFile() file: Express.Multer.File,
    @Body() body: BulkAuditImportBodyDto
  ): Promise<BulkAuditImportAcceptedDto> {
    return this.externalCommunicationService.enqueueBulkAuditImport(
      file,
      body.qa_panel_id,
      body.email
    )
  }
}
