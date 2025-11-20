import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { EmailAttachment } from '../email/email.dto'
import {
  CreatePortfolioDto,
  DeactivatePortfolioDto,
  DeletePortfolioDto,
  PortfolioQueryDto,
  PortfolioStatsQueryDto,
  SendPortfolioEmailDto,
  UpdatePortfolioDto
} from './portfolio.dto'
import type { IPortfolioService } from './portfolio.interface'

@ApiTags('Portfolio')
@ApiBearerAuth('JWT-auth')
@Controller('portfolio')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PortfolioController {
  constructor(
    @Inject('IPortfolioService')
    private readonly portfolioService: IPortfolioService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new portfolio' })
  @ApiResponse({ status: 201, description: 'Portfolio created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createPortfolioDto: CreatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.create(createPortfolioDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all portfolios accessible to the user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of portfolios retrieved successfully'
  })
  findAll(
    @Query() query: PortfolioQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all portfolios without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All portfolios retrieved successfully'
  })
  findAllForExport(
    @Query() query: PortfolioQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.findAllForExport(query, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this portfolio'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a portfolio' })
  @ApiResponse({ status: 200, description: 'Portfolio updated successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updatePortfolioDto: UpdatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.update(id, updatePortfolioDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a portfolio (Super Admin only with password verification)' })
  @ApiResponse({ status: 200, description: 'Portfolio deleted successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete portfolio with associated properties or only Super Admin can delete portfolios or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(
    @Param('id') id: string,
    @Body() deletePortfolioDto: DeletePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.remove(id, deletePortfolioDto.password, user)
  }

  @Post(':id/deactivate')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Deactivate a portfolio (Super Admin and internal users with password verification)',
    description:
      'Super Admin can deactivate directly. Internal users create a pending action for approval.'
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio deactivated successfully or deactivation request submitted'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Portfolio already deactivated or pending request exists or only Super Admin and internal users can deactivate or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  deactivate(
    @Param('id') id: string,
    @Body() deactivatePortfolioDto: DeactivatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.deactivate(id, deactivatePortfolioDto.password, user, deactivatePortfolioDto.reason)
  }

  @Post(':id/send-email')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @UseInterceptors(FilesInterceptor('attachments', 5)) // Allow up to 5 file attachments
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Send email to portfolio contact with optional attachments',
    description:
      'Send an email to the portfolio contact email with optional attachments. ' +
      'Attachments can be provided as direct file uploads or URLs to files.'
  })
  @ApiBody({
    description:
      'Email data with optional file attachments (upload) or attachment URLs',
    schema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          example: 'Quarterly Review Meeting',
          description: 'Email subject'
        },
        body: {
          type: 'string',
          example:
            'Dear Team,\n\nWe would like to schedule a quarterly review meeting...',
          description: 'Email body (plain text)'
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
                example: 'quarterly-report.pdf',
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
      required: ['subject', 'body']
    }
  })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Portfolio does not have a contact email configured or failed to fetch attachment from URL'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this portfolio'
  })
  sendEmail(
    @Param('id') id: string,
    @Body() sendEmailDto: SendPortfolioEmailDto,
    @CurrentUser() user: IUserWithPermissions,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    // Convert uploaded files to EmailAttachment format
    const attachments: EmailAttachment[] | undefined = files?.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }))

    return this.portfolioService.sendEmail(
      id,
      sendEmailDto.subject,
      sendEmailDto.body,
      user,
      attachments,
      sendEmailDto.attachment_urls
    )
  }

  @Post('bulk-import')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import portfolios from Excel file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx) containing portfolio data'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed with results'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing file'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.bulkImport(file, user)
  }

  @Get(':id/stats')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({
    summary:
      'Get portfolio statistics with amount breakdown by platform and recent audits'
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio statistics retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this portfolio'
  })
  getStats(
    @Param('id') id: string,
    @Query() query: PortfolioStatsQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.getStats(id, query, user)
  }
}
