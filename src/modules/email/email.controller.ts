import {
  Body,
  Controller,
  Inject,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { EmailAttachment, SendEmailDto } from './email.dto'
import type { IEmailService } from './email.interface'

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(
    @Inject('IEmailService')
    private readonly emailService: IEmailService
  ) {}

  @Post('send')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FilesInterceptor('attachments', 5)) // Allow up to 5 file attachments
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Send email with optional file uploads or URL-based attachments',
    description:
      'Send an email to any recipient with optional attachments. Attachments can be provided in two ways: ' +
      '1) Direct file upload (multipart/form-data) or 2) URLs to files (application/json with attachment_urls). ' +
      'Both methods can be combined in a single request. ' +
      'Authentication is optional: without a Bearer token the sender footer is generic; with a valid JWT the logged-in user is used in the footer when send_sender_data is true.'
  })
  @ApiBody({
    description:
      'Email data with optional file attachments (upload) or attachment URLs',
    schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          example: 'recipient@example.com',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          example: 'Important Update',
          description: 'Email subject'
        },
        body: {
          type: 'string',
          example: 'Dear recipient,\n\nThis is an important update...',
          description: 'Email body content (plain text)'
        },
        send_sender_data: {
          type: 'boolean',
          example: true,
          description:
            'Whether to include sender information at the end of the email body (defaults to true)'
        },
        attachment_urls: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                example: 'https://s3.amazonaws.com/bucket/report.pdf',
                description: 'URL of the file to attach'
              },
              filename: {
                type: 'string',
                example: 'monthly-report.pdf',
                description:
                  'Optional custom filename (extracted from URL if not provided)'
              }
            },
            required: ['url']
          },
          description:
            'Optional array of file URLs to attach (downloaded and attached to email)'
        },
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary'
          },
          description: 'Optional direct file uploads (max 5 files)'
        }
      },
      required: ['to', 'subject', 'body']
    }
  })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or failed to fetch attachment from URL'
  })
  @ApiResponse({
    status: 401,
    description:
      'Unauthorized — only when an Authorization Bearer token is sent but invalid or expired'
  })
  sendEmail(
    @Body() sendEmailDto: SendEmailDto,
    @CurrentUser() user: IUserWithPermissions | Record<string, never>,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    // Convert uploaded files to EmailAttachment format
    const attachments: EmailAttachment[] | undefined = files?.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }))

    const authUser =
      user && typeof user === 'object' && 'id' in user && typeof user.id === 'string'
        ? (user as IUserWithPermissions)
        : undefined

    return this.emailService.sendEmail(sendEmailDto, authUser, attachments)
  }
}
