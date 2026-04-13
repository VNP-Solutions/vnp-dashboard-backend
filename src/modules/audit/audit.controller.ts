import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IAuthRepository } from '../auth/auth.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  AutoImportAuditResultDto,
  AuditQueryDto,
  BulkArchiveAuditDto,
  BulkDeleteAuditDto,
  DeleteAuditsByPortfolioDto,
  BulkUploadReportDto,
  CreateAuditDto,
  DeleteAuditDto,
  GlobalStatsResponseDto,
  RequestUpdateAmountConfirmedDto,
  UpdateAuditDto,
  UpdateReportUrlDto
} from './audit.dto'
import type { IAuditService } from './audit.interface'

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(
    @Inject('IAuditService')
    private readonly auditService: IAuditService,
    @Inject('IAuthRepository')
    private readonly authRepository: IAuthRepository
  ) {}

  @Post()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @ApiOperation({
    summary: 'Create a new audit (Internal users only)',
    description:
      'Only internal users can create audits. Requires audit UPDATE permission.'
  })
  @ApiResponse({ status: 201, description: 'Audit created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data'
  })
  create(
    @Body() createAuditDto: CreateAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.create(createAuditDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all audits accessible to the user with pagination, search, filter, and sort. Filter by status: Use category names (pending, upcoming, completed) or comma-separated status IDs (e.g., status=upcoming or status=507f1f77bcf86cd799439011,507f1f77bcf86cd799439012)'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of audits retrieved successfully'
  })
  findAll(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all audits without pagination for export purposes (supports search, filter, and sort). Filter by status: Use category names (pending, upcoming, completed) or comma-separated status IDs (e.g., status=upcoming or status=507f1f77bcf86cd799439011,507f1f77bcf86cd799439012)'
  })
  @ApiResponse({
    status: 200,
    description: 'All audits retrieved successfully'
  })
  findAllForExport(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.findAllForExport(query, user)
  }

  @Get('global-stats')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get global audit statistics across all accessible properties'
  })
  @ApiResponse({
    status: 200,
    description: 'Global audit statistics retrieved successfully',
    type: GlobalStatsResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  getGlobalStats(@CurrentUser() user: IUserWithPermissions) {
    return this.auditService.getGlobalStats(user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get an audit by ID' })
  @ApiResponse({ status: 200, description: 'Audit retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this audit'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditService.findOne(id, user)
  }

  @Patch(':id/archive')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary:
      'Archive an audit (Super admins and internal users only, no password required)',
    description:
      'Super admins and internal users can archive audits. Allowed statuses: "OTA POST Completed", "VCC Invoiced", "MOR completed and Invoiced", "Direct Bill Invoiced", "Nothing To Report". External users cannot archive audits.'
  })
  @ApiResponse({ status: 200, description: 'Audit archived successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Cannot archive audit due to validation failure or audit already archived'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - External users cannot archive audits or insufficient permissions'
  })
  archive(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditService.archive(id, user)
  }

  @Post('bulk-update')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk update audits from Excel file (Internal users only)',
    description: `
    Upload an Excel (.xlsx, .xls) or CSV file to bulk update existing audits.

    Required column:
    - Audit ID/Audit Id/Audit id/ID/Id/id: ID of the audit to update (must exist)

    Optional columns (only update if provided):
    - Property Name/Property name/Property/Name: Name of the property (must exist)
    - OTA/OTA Type/Ota Type/Ota type: OTA type (expedia, agoda, booking)
    - Audit Status/Audit status/Status: Status name (will be created if doesn't exist)
    - Expedia Amount Collectable/Expedia Collectable/expedia_amount_collectable: Expedia collectable amount
    - Expedia Amount Confirmed/Expedia Confirmed/expedia_amount_confirmed: Expedia confirmed amount (Note: Non-super-admin internal users can only set this once. Once it has been set, only super admins can update it.)
    - Agoda Amount Collectable/Agoda Collectable/agoda_amount_collectable: Agoda collectable amount
    - Agoda Amount Confirmed/Agoda Confirmed/agoda_amount_confirmed: Agoda confirmed amount (Note: Non-super-admin internal users can only set this once. Once it has been set, only super admins can update it.)
    - Booking Amount Collectable/Booking Collectable/booking_amount_collectable: Booking collectable amount
    - Booking Amount Confirmed/Booking Confirmed/booking_amount_confirmed: Booking confirmed amount (Note: Non-super-admin internal users can only set this once. Once it has been set, only super admins can update it.)
    - Report URL/Report url/report_url/Report/URL: Report URL
    - Review Collection Date/Review collection date/review_collection_date: Review collection date (mm/dd/yyyy)
    - Batch/Batch No: Batch number (will be created if doesn't exist)

    Note: Empty cells will keep existing values unchanged.
    `
  })
  @ApiBody({
    description: 'Excel (.xlsx/.xls) or CSV file containing audit update data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update completed successfully',
    schema: {
      example: {
        totalRows: 10,
        successCount: 8,
        failureCount: 2,
        errors: [
          {
            row: 3,
            auditId: '507f1f77bcf86cd799439011',
            error: 'Audit not found'
          }
        ],
        successfulUpdates: [
          '507f1f77bcf86cd799439012',
          '507f1f77bcf86cd799439013'
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file or file format'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkUpdate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkUpdate(file, user)
  }

  @Patch(':id/unarchive')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Unarchive an audit (no conditions required)'
  })
  @ApiResponse({ status: 200, description: 'Audit unarchived successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Audit is not archived'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  unarchive(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.unarchive(id, user)
  }

  @Patch('bulk-archive')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @ApiOperation({
    summary:
      'Bulk archive multiple audits (Internal users only). Checks each audit for archivability and returns success/failure counts'
  })
  @ApiBody({
    type: BulkArchiveAuditDto,
    description: 'Bulk archive payload with audit IDs',
    examples: {
      'Basic Example': {
        value: {
          audit_ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
        }
      },
      'Multiple Audits': {
        value: {
          audit_ids: [
            '507f1f77bcf86cd799439011',
            '507f1f77bcf86cd799439012',
            '507f1f77bcf86cd799439013',
            '507f1f77bcf86cd799439014'
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk archive completed with success/failure details',
    schema: {
      example: {
        message: 'Successfully archived 2 audit(s), 1 failed',
        successfully_archived: 2,
        failed_to_archive: 1,
        failed_audits: [
          {
            id: '507f1f77bcf86cd799439013',
            reason:
              'Cannot archive audit. Current status is "Pending". Audit can only be archived with one of these statuses: OTA POST Completed, VCC Invoiced, MOR completed and Invoiced, Direct Bill Invoiced, Nothing To Report.'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data or no audit IDs provided'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkArchive(
    @Body() bulkArchiveDto: BulkArchiveAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkArchive(bulkArchiveDto, user)
  }

  @Post('bulk-import')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import audits from Excel file (Internal users only)',
    description: `
    Upload an Excel (.xlsx, .xls) or CSV file to bulk import audits.

    Required columns:
    - Expedia ID/Expedia Id/Expedia id/expedia_id: Expedia ID of the property (must exist)
    - Audit Status/Audit status/Status: Status name (will be created if doesn't exist)

    Optional columns:
    - OTA/OTA Type/Ota Type/Ota type: OTA type (expedia, agoda, booking)
    - Expedia Amount Collectable/Expedia Collectable/expedia_amount_collectable: Expedia collectable amount
    - Expedia Amount Confirmed/Expedia Confirmed/expedia_amount_confirmed: Expedia confirmed amount
    - Agoda Amount Collectable/Agoda Collectable/agoda_amount_collectable: Agoda collectable amount
    - Agoda Amount Confirmed/Agoda Confirmed/agoda_amount_confirmed: Agoda confirmed amount
    - Booking Amount Collectable/Booking Collectable/booking_amount_collectable: Booking collectable amount
    - Booking Amount Confirmed/Booking Confirmed/booking_amount_confirmed: Booking confirmed amount
    - Report URL/Report url/report_url/Report/URL: Report URL
    - Review Collection Date/Review collection date/review_collection_date: Review collection date (mm/dd/yyyy)
    - Batch/Batch No: Batch number (will be created if doesn't exist)
    `
  })
  @ApiBody({
    description: 'Excel (.xlsx/.xls) or CSV file containing audit data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed successfully',
    schema: {
      example: {
        totalRows: 10,
        successCount: 8,
        failureCount: 2,
        errors: [
          {
            row: 3,
            audit: 'Property A',
            error: 'Property not found'
          }
        ],
        successfulImports: [
          'Property B - Expedia Audit',
          'Property C - Agoda Audit'
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file or file format'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkImport(file, user)
  }

  @Post('auto-import')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Auto-import audits from OTA reservation sheet (Internal users only)',
    description: `
    Upload an Excel (.xlsx, .xls) or CSV file containing OTA reservation rows.

    Required columns:
    - OTA: Platform name (Expedia, Agoda, Booking)
    - Portfolio: Portfolio name (must already exist in the database)
    - Status / Audit Status: Audit status name (matched case-insensitively to an existing status, or created if it does not exist)
    - Property lookup (either):
      - Hotel ID + OTA: Hotel ID must match the property's Expedia, Agoda, or Booking credential ID for that OTA, or
      - Hotel Name: Property name (must already exist in the database) when Hotel ID is not used
    - Amount Collected: Amount collected for this reservation

    Optional columns (recognised header aliases include Check In / Start Date and Check Out / End Date):
    - Check-in and check-out dates: if a cell is empty, it is skipped. If a cell has a value, it must parse as a date (MM/DD/YYYY or supported formats), and when both are present Check In must be before Check Out; otherwise the row is reported in the error list.
    - Batch: Batch number (will be created if doesn't exist). If present multiple times for the same property+status group, the first value is used.
    - Review Collection Date/Review collection date/review_collection_date: Review collection date (MM/DD/YYYY or supported formats). If present multiple times for the same property+status group, the first value is used.

    All other columns in the sheet are preserved in the generated per-property report files.

    Behaviour:
    - Rows are grouped by resolved property (Hotel ID + OTA or Hotel Name) and Status — one audit is created per unique property + status combination.
    - OTA types are collected from all rows of that group.
    - Amounts are summed per OTA type; both collectable and confirmed are set to the same sum.
    - Audit status is taken from the Status column (find existing by name, case-insensitive, or create a new status record).
    - A per-property Excel sheet (all original columns, filtered to that property) is uploaded to S3 and its URL is stored as report_url on the audit.
    - If Batch column is present, audits are assigned to the specified batch (created if doesn't exist).
    - If Review Collection Date column is present, the date value is set on the audit (first value per property+status group is used).

    Validation (pre-flight):
    - If any Portfolio or property (by Hotel ID + OTA or by Hotel Name) cannot be found in the database, NO audits are created and the full error list is returned.
    `
  })
  @ApiBody({
    description: 'Excel (.xlsx/.xls) or CSV file containing OTA reservation rows',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Auto-import result',
    type: AutoImportAuditResultDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request – Invalid file, missing columns, or validation errors found'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden – Insufficient permissions or not an internal user'
  })
  autoImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.autoImport(file, user)
  }

  @Patch('bulk-upload-report')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @ApiOperation({
    summary: 'Bulk upload report URL for multiple audits (Internal users only)',
    description: `
    Update multiple audits with the same report URL at once.
    
    Required fields:
    - audit_ids: Array of audit IDs to update
    - report_url: The report URL to set for all audits
    
    All audits must exist, otherwise the operation will fail.
    `
  })
  @ApiBody({
    type: BulkUploadReportDto,
    description: 'Bulk upload report payload with audit IDs and report URL',
    examples: {
      'Basic Example': {
        value: {
          audit_ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          report_url: 'https://example.com/report.pdf'
        }
      },
      'Multiple Audits': {
        value: {
          audit_ids: [
            '507f1f77bcf86cd799439011',
            '507f1f77bcf86cd799439012',
            '507f1f77bcf86cd799439013',
            '507f1f77bcf86cd799439014'
          ],
          report_url:
            'https://storage.example.com/reports/2024/audit-report.pdf'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk upload completed successfully',
    schema: {
      example: {
        message: 'Successfully updated 4 audit(s) with report URL',
        updated_count: 4,
        updated_ids: [
          '507f1f77bcf86cd799439011',
          '507f1f77bcf86cd799439012',
          '507f1f77bcf86cd799439013',
          '507f1f77bcf86cd799439014'
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data or no audit IDs provided'
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - One or more audits not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkUploadReport(
    @Body() bulkUploadReportDto: BulkUploadReportDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkUploadReport(bulkUploadReportDto, user)
  }

  @Post('delete-by-portfolio/:portfolioId')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Delete all audits for a portfolio (Super admin only, requires password verification)',
    description:
      'Only super admins can use this endpoint. All audits belonging to any property in the given portfolio will be permanently deleted. Password verification is required. This action cannot be undone.'
  })
  @ApiResponse({
    status: 200,
    description: 'All audits for the portfolio deleted successfully',
    schema: {
      example: {
        message: 'Successfully deleted 42 audit(s) for portfolio "ARP Hospitality"',
        deleted_count: 42
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can delete audits'
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Portfolio not found'
  })
  async deleteByPortfolio(
    @Param('portfolioId') portfolioId: string,
    @Body() deleteDto: DeleteAuditsByPortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      deleteDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.auditService.deleteAllByPortfolio(portfolioId, deleteDto, user)
  }

  @Post('bulk-delete')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE)
  @ApiOperation({
    summary:
      'Bulk delete multiple audits (Super admin only, requires password verification)',
    description:
      'Only super admins can delete audits. Password verification is required. The audits will be permanently deleted and this action cannot be undone.'
  })
  @ApiBody({
    type: BulkDeleteAuditDto,
    description: 'Bulk delete payload with audit IDs and password',
    examples: {
      'Basic Example': {
        value: {
          audit_ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          password: 'YourPassword123!'
        }
      },
      'Multiple Audits': {
        value: {
          audit_ids: [
            '507f1f77bcf86cd799439011',
            '507f1f77bcf86cd799439012',
            '507f1f77bcf86cd799439013',
            '507f1f77bcf86cd799439014'
          ],
          password: 'YourPassword123!'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed with success/failure details',
    schema: {
      example: {
        message: 'Successfully deleted 2 audit(s), 1 failed',
        successfully_deleted: 2,
        failed_to_delete: 1,
        failed_audits: [
          {
            id: '507f1f77bcf86cd799439013',
            reason: 'Audit not found'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid data, no audit IDs provided, or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can delete audits'
  })
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during deletion
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      bulkDeleteDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.auditService.bulkDelete(bulkDeleteDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE, true)
  @ApiOperation({
    summary:
      'Delete an audit (Super admin only, requires password verification)',
    description:
      'Only super admins can delete audits. Password verification is required. The audit will be permanently deleted and this action cannot be undone.'
  })
  @ApiResponse({ status: 200, description: 'Audit deleted successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can delete audits'
  })
  async remove(
    @Param('id') id: string,
    @Body() deleteAuditDto: DeleteAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during deletion
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      deleteAuditDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.auditService.remove(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update an audit (Internal users only)',
    description:
      'Only internal users can update audits. This includes editing audit details and adding audits to batches. Note: Non-super-admin internal users can only set amount_confirmed fields once per OTA type. Once an OTA type\'s amount_confirmed has been set, only super admins can update it.'
  })
  @ApiResponse({ status: 200, description: 'Audit updated successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid data or attempting to update OTA amount_confirmed when it is already set (non-super-admin users only)'
  })
  update(
    @Param('id') id: string,
    @Body() updateAuditDto: UpdateAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.update(id, updateAuditDto, user)
  }

  @Post(':id/request-update-amount-confirmed')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Request to update amount confirmed for specific OTA types (external users only, when the amount is not yet set). Creates a pending action for super admin approval. At least one OTA amount must be provided.'
  })
  @ApiResponse({
    status: 201,
    description: 'Update request submitted successfully'
  })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid password, non-external user, amount already set, or pending request already exists'
  })
  async requestUpdateAmountConfirmed(
    @Param('id') id: string,
    @Body() data: RequestUpdateAmountConfirmedDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Verify password
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      data.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.auditService.requestUpdateAmountConfirmed(id, data, user)
  }

  @Patch(':id/report-url')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update report URL for an audit (Internal users only)',
    description:
      'Updates the report URL field for a specific audit. Only internal users can upload report URLs. This is a dedicated endpoint for updating only the report URL.'
  })
  @ApiResponse({ status: 200, description: 'Report URL updated successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data'
  })
  updateReportUrl(
    @Param('id') id: string,
    @Body() updateReportUrlDto: UpdateReportUrlDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.updateReportUrl(id, updateReportUrlDto, user)
  }
}
