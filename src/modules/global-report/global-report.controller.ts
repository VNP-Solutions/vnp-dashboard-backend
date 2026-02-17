import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Res,
  UseGuards
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  GlobalReportQueryDto,
  GlobalReportExportDto,
  GlobalReportResponseDto,
  ColumnsMetadataResponseDto,
  OtaIdsResponseDto,
  PortfolioContactEmailsResponseDto,
  OtaUsernamesResponseDto,
  OtaPasswordsResponseDto,
  PortfoliosListResponseDto,
  PropertiesListResponseDto
} from './global-report.dto'
import type { IGlobalReportService } from './global-report.interface'

@ApiTags('Global Report')
@ApiBearerAuth('JWT-auth')
@Controller('global-report')
@UseGuards(JwtAuthGuard)
export class GlobalReportController {
  constructor(
    @Inject('IGlobalReportService')
    private readonly globalReportService: IGlobalReportService
  ) {}

  @Get('columns')
  @ApiOperation({
    summary: 'Get available columns metadata',
    description:
      'Returns metadata about all available report columns including data types, allowed operators, and enum values. Use this to build dynamic filter UIs.'
  })
  @ApiResponse({
    status: 200,
    description: 'Column metadata retrieved successfully',
    type: ColumnsMetadataResponseDto
  })
  getColumnsMetadata(): ColumnsMetadataResponseDto {
    return this.globalReportService.getColumnsMetadata()
  }

  @Get('ota-ids')
  @ApiOperation({
    summary: 'Get all OTA IDs for filtering (Super Admin only)',
    description:
      'Returns all unique OTA IDs from property credentials, grouped by OTA type. Use this to populate OTA ID filter dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'OTA IDs retrieved successfully',
    type: OtaIdsResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getOtaIds(
    @CurrentUser() user: IUserWithPermissions
  ): Promise<OtaIdsResponseDto> {
    return this.globalReportService.getOtaIds(user)
  }

  @Get('portfolio-contact-emails')
  @ApiOperation({
    summary: 'Get all portfolio contact emails for filtering (Super Admin only)',
    description:
      'Returns all unique portfolio contact emails. Use this to populate contact email filter dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio contact emails retrieved successfully',
    type: PortfolioContactEmailsResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getPortfolioContactEmails(
    @CurrentUser() user: IUserWithPermissions
  ): Promise<PortfolioContactEmailsResponseDto> {
    return this.globalReportService.getPortfolioContactEmails(user)
  }

  @Get('ota-usernames')
  @ApiOperation({
    summary: 'Get all OTA usernames for filtering (Super Admin only)',
    description:
      'Returns all unique OTA usernames from property credentials, grouped by OTA type. Use this to populate OTA username filter dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'OTA usernames retrieved successfully',
    type: OtaUsernamesResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getOtaUsernames(
    @CurrentUser() user: IUserWithPermissions
  ): Promise<OtaUsernamesResponseDto> {
    return this.globalReportService.getOtaUsernames(user)
  }

  @Get('ota-passwords')
  @ApiOperation({
    summary: 'Get all OTA passwords for filtering (Super Admin only)',
    description:
      'Returns all unique OTA passwords from property credentials (decrypted), grouped by OTA type. Use this to populate OTA password filter dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'OTA passwords retrieved successfully',
    type: OtaPasswordsResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getOtaPasswords(
    @CurrentUser() user: IUserWithPermissions
  ): Promise<OtaPasswordsResponseDto> {
    return this.globalReportService.getOtaPasswords(user)
  }

  @Get('expedia-ids')
  @ApiOperation({
    summary: 'Get Expedia IDs only (Super Admin only)',
    description: 'Returns all unique Expedia IDs from property credentials.'
  })
  @ApiResponse({ status: 200, description: 'Expedia IDs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getExpediaIds(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getExpediaIds(user)
  }

  @Get('agoda-ids')
  @ApiOperation({
    summary: 'Get Agoda IDs only (Super Admin only)',
    description: 'Returns all unique Agoda IDs from property credentials.'
  })
  @ApiResponse({ status: 200, description: 'Agoda IDs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getAgodaIds(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getAgodaIds(user)
  }

  @Get('booking-ids')
  @ApiOperation({
    summary: 'Get Booking IDs only (Super Admin only)',
    description: 'Returns all unique Booking IDs from property credentials.'
  })
  @ApiResponse({ status: 200, description: 'Booking IDs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getBookingIds(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getBookingIds(user)
  }

  @Get('expedia-usernames')
  @ApiOperation({
    summary: 'Get Expedia usernames only (Super Admin only)',
    description: 'Returns all unique Expedia usernames from property credentials.'
  })
  @ApiResponse({ status: 200, description: 'Expedia usernames retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getExpediaUsernames(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getExpediaUsernames(user)
  }

  @Get('agoda-usernames')
  @ApiOperation({
    summary: 'Get Agoda usernames only (Super Admin only)',
    description: 'Returns all unique Agoda usernames from property credentials.'
  })
  @ApiResponse({ status: 200, description: 'Agoda usernames retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getAgodaUsernames(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getAgodaUsernames(user)
  }

  @Get('booking-usernames')
  @ApiOperation({
    summary: 'Get Booking usernames only (Super Admin only)',
    description: 'Returns all unique Booking usernames from property credentials.'
  })
  @ApiResponse({ status: 200, description: 'Booking usernames retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getBookingUsernames(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getBookingUsernames(user)
  }

  @Get('expedia-passwords')
  @ApiOperation({
    summary: 'Get Expedia passwords only (Super Admin only)',
    description: 'Returns all unique Expedia passwords from property credentials (decrypted).'
  })
  @ApiResponse({ status: 200, description: 'Expedia passwords retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getExpediaPasswords(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getExpediaPasswords(user)
  }

  @Get('agoda-passwords')
  @ApiOperation({
    summary: 'Get Agoda passwords only (Super Admin only)',
    description: 'Returns all unique Agoda passwords from property credentials (decrypted).'
  })
  @ApiResponse({ status: 200, description: 'Agoda passwords retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getAgodaPasswords(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getAgodaPasswords(user)
  }

  @Get('booking-passwords')
  @ApiOperation({
    summary: 'Get Booking passwords only (Super Admin only)',
    description: 'Returns all unique Booking passwords from property credentials (decrypted).'
  })
  @ApiResponse({ status: 200, description: 'Booking passwords retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super admin access required' })
  async getBookingPasswords(@CurrentUser() user: IUserWithPermissions): Promise<{ data: string[] }> {
    return this.globalReportService.getBookingPasswords(user)
  }

  @Get('portfolios')
  @ApiOperation({
    summary: 'Get all portfolios (id and name only) for filtering (Super Admin only)',
    description:
      'Returns all portfolios with only id and name fields. Optimized for fast loading with in-memory caching. Use this to populate portfolio filter dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolios list retrieved successfully',
    type: PortfoliosListResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getPortfolios(
    @CurrentUser() user: IUserWithPermissions
  ): Promise<PortfoliosListResponseDto> {
    return await this.globalReportService.getPortfolios(user)
  }

  @Get('properties')
  @ApiOperation({
    summary: 'Get all properties (id and name only) for filtering (Super Admin only)',
    description:
      'Returns all properties with only id and name fields. Optimized for fast loading with in-memory caching. Use this to populate property filter dropdowns.'
  })
  @ApiResponse({
    status: 200,
    description: 'Properties list retrieved successfully',
    type: PropertiesListResponseDto
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getProperties(
    @CurrentUser() user: IUserWithPermissions
  ): Promise<PropertiesListResponseDto> {
    return await this.globalReportService.getProperties(user)
  }

  @Post()
  @ApiOperation({
    summary: 'Get global report data (Super Admin only)',
    description: `
Query audit data across all properties and portfolios with Excel-like filtering.

**Filtering:**
- Each filter has: column, operator, and value
- Operators vary by column data type (see /columns endpoint)
- Multiple filters are combined with AND logic

**Sorting:**
- Multi-column sort supported
- Each sort has: column and order (asc/desc)

**Example filters:**
- Filter by portfolio: { column: "portfolioName", operator: "contains", value: "Marriott" }
- Filter by date range: { column: "startDate", operator: "between", value: { from: "2024-01-01", to: "2024-12-31" } }
- Filter by amount: { column: "amountCollectable", operator: "gte", value: 5000 }
- Filter nulls: { column: "batchNo", operator: "isNull", value: true }
- Filter by enum: { column: "otaType", operator: "in", value: ["expedia", "booking"] }
    `
  })
  @ApiResponse({
    status: 200,
    description: 'Report data retrieved successfully',
    type: GlobalReportResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid filter or sort configuration'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async getReport(
    @Body() query: GlobalReportQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ): Promise<GlobalReportResponseDto> {
    return this.globalReportService.getReport(query, user)
  }

  @Post('export')
  @ApiOperation({
    summary: 'Export global report to CSV/Excel (Super Admin only)',
    description: `
Export all matching audit data to CSV or Excel format.
Uses the same filtering as the main report endpoint.

**Options:**
- format: 'csv' or 'xlsx'
- columns: Optional array of column keys to include (default: all)

**Note:** For large datasets, this may take longer. The response is a file download.
    `
  })
  @ApiResponse({
    status: 200,
    description: 'File download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
      'text/csv': {}
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid filter or export configuration'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required'
  })
  async exportReport(
    @Body() query: GlobalReportExportDto,
    @CurrentUser() user: IUserWithPermissions,
    @Res() res: Response
  ): Promise<void> {
    const buffer = await this.globalReportService.exportReport(query, user)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `global-report-${timestamp}`

    if (query.format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.xlsx"`
      )
    } else {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.csv"`
      )
    }

    res.send(buffer)
  }
}
