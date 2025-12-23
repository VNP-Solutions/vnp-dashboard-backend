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
  ColumnsMetadataResponseDto
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
