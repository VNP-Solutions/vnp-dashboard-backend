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
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  AuditQueryDto,
  BulkArchiveAuditDto,
  BulkDeleteAuditDto,
  BulkUploadReportDto,
  CreateAuditDto,
  DeleteAuditDto,
  GlobalStatsResponseDto,
  RequestUpdateAmountConfirmedDto,
  UpdateAuditDto,
  UpdateReportUrlDto
} from './audit.dto'
import type { IAuditService } from './audit.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IAuthRepository } from '../auth/auth.interface'

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
    description: 'Only internal users can create audits. Requires audit UPDATE permission.'
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
    summary: 'Archive an audit (Super admins and internal users only, no password required)',
    description: 'Super admins and internal users can archive audits. Allowed statuses: "OTA POST Completed", "VCC Invoiced", "MOR completed and Invoiced", "Direct Bill Invoiced", "Nothing To Report". External users cannot archive audits.'
  })
  @ApiResponse({ status: 200, description: 'Audit archived successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cannot archive audit due to validation failure or audit already archived'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - External users cannot archive audits or insufficient permissions'
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
    Upload an Excel file (.xlsx or .xls) to bulk update existing audits.
    
    Required column:
    - Audit ID/Audit Id/Audit id/ID/Id/id: ID of the audit to update (must exist)
    
    Optional columns (only update if provided):
    - Property Name/Property name/Property/Name: Name of the property (must exist)
    - OTA/OTA Type/Ota Type/Ota type: OTA type (expedia, agoda, booking)
    - Audit Status/Audit status/Status: Status name (will be created if doesn't exist)
    - Amount Collectable/Amount collectable/amount_collectable: Collectable amount
    - Amount Confirmed/Amount confirmed/amount_confirmed: Confirmed amount  
    - Start Date/Start date/start_date/From Date/From: Audit start date (mm/dd/yyyy)
    - End Date/End date/end_date/To Date/To: Audit end date (mm/dd/yyyy)
    - Report URL/Report url/report_url/Report/URL: Report URL
    - Batch/Batch No: Batch number (will be created if doesn't exist)
    
    Note: Empty cells will keep existing values unchanged.
    `
  })
  @ApiBody({
    description: 'Excel file containing audit update data',
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
    Upload an Excel file (.xlsx or .xls) to bulk import audits.

    Required columns:
    - Expedia ID/Expedia Id/Expedia id/expedia_id: Expedia ID of the property (must exist)
    - Audit Status/Audit status/Status: Status name (will be created if doesn't exist)

    Optional columns:
    - Start Date/Start date/start_date/From Date/From: Audit start date (mm/dd/yyyy)
    - End Date/End date/end_date/To Date/To: Audit end date (mm/dd/yyyy)
    - OTA/OTA Type/Ota Type/Ota type: OTA type (expedia, agoda, booking)
    - Amount Collectable/Amount collectable/amount_collectable: Collectable amount
    - Amount Confirmed/Amount confirmed/amount_confirmed: Confirmed amount
    - Report URL/Report url/report_url/Report/URL: Report URL
    - Batch/Batch No: Batch number (will be created if doesn't exist)

    Note: If both start and end dates are provided, start date must be before end date.
    `
  })
  @ApiBody({
    description: 'Excel file containing audit data',
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

  @Post('bulk-delete')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Bulk delete multiple audits (Super admin only, requires password verification)',
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
    description: 'Bad Request - Invalid data, no audit IDs provided, or invalid password'
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
    summary: 'Delete an audit (Super admin only, requires password verification)',
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
    description: 'Only internal users can update audits. This includes editing audit details and adding audits to batches.'
  })
  @ApiResponse({ status: 200, description: 'Audit updated successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data'
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
      'Request to update amount confirmed (external users only, when amount_confirmed is not set). Creates a pending action for super admin approval.'
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
    description: 'Updates the report URL field for a specific audit. Only internal users can upload report URLs. This is a dedicated endpoint for updating only the report URL.'
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
