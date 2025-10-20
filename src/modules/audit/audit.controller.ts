import {
  Body,
  Controller,
  Delete,
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
  BulkUpdateAuditDto,
  CreateAuditDto,
  UpdateAuditDto
} from './audit.dto'
import type { IAuditService } from './audit.interface'

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(
    @Inject('IAuditService')
    private readonly auditService: IAuditService
  ) {}

  @Post()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new audit' })
  @ApiResponse({ status: 201, description: 'Audit created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
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
      'Get all audits accessible to the user with pagination, search, filter, and sort'
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
      'Get all audits without pagination for export purposes (supports search, filter, and sort)'
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

  @Patch(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update an audit' })
  @ApiResponse({ status: 200, description: 'Audit updated successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
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

  @Delete(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete an audit' })
  @ApiResponse({ status: 200, description: 'Audit deleted successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditService.remove(id, user)
  }

  @Patch(':id/archive')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary:
      'Archive an audit. Allowed statuses: "OTA POST Completed", "VCC Invoiced", "MOR completed and Invoiced", "Direct Bill Invoiced", "Nothing To Report"'
  })
  @ApiResponse({ status: 200, description: 'Audit archived successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cannot archive audit due to validation failure'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  archive(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditService.archive(id, user)
  }

  @Patch('bulk-update')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @ApiOperation({
    summary:
      'Bulk update multiple audits with same values. Provide an array of audit IDs and the values to update'
  })
  @ApiBody({
    type: BulkUpdateAuditDto,
    description: 'Bulk update payload with audit IDs and fields to update',
    examples: {
      'Full Update': {
        value: {
          audit_ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          type_of_ota: 'expedia',
          audit_status_id: '507f1f77bcf86cd799439013',
          amount_collectable: 5000,
          amount_confirmed: 4500,
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-01-31T23:59:59Z',
          property_id: '507f1f77bcf86cd799439014',
          report_url: 'https://example.com/report.pdf'
        }
      },
      'Partial Update': {
        value: {
          audit_ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          audit_status_id: '507f1f77bcf86cd799439013',
          amount_confirmed: 4500
        }
      },
      'Status Only': {
        value: {
          audit_ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          audit_status_id: '507f1f77bcf86cd799439013'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Audits updated successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkUpdate(bulkUpdateDto, user)
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
      'Bulk archive multiple audits. Checks each audit for archivability and returns success/failure counts'
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
    description: 'Forbidden - Insufficient permissions'
  })
  bulkArchive(
    @Body() bulkArchiveDto: BulkArchiveAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkArchive(bulkArchiveDto, user)
  }

  @Post('bulk-import')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.CREATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import audits from Excel file',
    description: `
    Upload an Excel file (.xlsx or .xls) to bulk import audits.
    
    Required columns:
    - Property Name/Property name/Property/Name: Name of the property (must exist)
    - Start Date/Start date/start_date/From Date/From: Audit start date (mm/dd/yyyy)
    - End Date/End date/end_date/To Date/To: Audit end date (mm/dd/yyyy)  
    - Audit Status/Audit status/Status: Status name (will be created if doesn't exist)
    
    Optional columns:
    - OTA/OTA Type/Ota Type/Ota type: OTA type (expedia, agoda, booking)
    - Amount Collectable/Amount collectable/amount_collectable: Collectable amount
    - Amount Confirmed/Amount confirmed/amount_confirmed: Confirmed amount  
    - Report URL/Report url/report_url/Report/URL: Report URL
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
    description: 'Forbidden - Insufficient permissions'
  })
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.bulkImport(file, user)
  }
}
