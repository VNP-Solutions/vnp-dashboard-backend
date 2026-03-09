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
  CreateSalesAgentDto,
  SalesAgentQueryDto,
  SalesAgentReportQueryDto,
  UpdateSalesAgentDto
} from './sales-agent.dto'
import type { ISalesAgentService } from './sales-agent.interface'

@ApiTags('Sales Agent')
@ApiBearerAuth('JWT-auth')
@Controller('sales-agent')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesAgentController {
  constructor(
    @Inject('ISalesAgentService')
    private readonly salesAgentService: ISalesAgentService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Create a new sales agent (Internal users only)' })
  @ApiResponse({ status: 201, description: 'Sales agent created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - not an internal user' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  create(
    @Body() createSalesAgentDto: CreateSalesAgentDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.salesAgentService.create(createSalesAgentDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all sales agents with pagination, search, and sort (Internal users only)'
  })
  @ApiResponse({ status: 200, description: 'Paginated list of sales agents retrieved successfully' })
  findAll(
    @Query() query: SalesAgentQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.salesAgentService.findAll(query, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get a sales agent by ID (Internal users only)' })
  @ApiResponse({ status: 200, description: 'Sales agent retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Sales agent not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.salesAgentService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a sales agent (Internal users only)' })
  @ApiResponse({ status: 200, description: 'Sales agent updated successfully' })
  @ApiResponse({ status: 404, description: 'Sales agent not found' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  update(
    @Param('id') id: string,
    @Body() updateSalesAgentDto: UpdateSalesAgentDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.salesAgentService.update(id, updateSalesAgentDto, user)
  }

  @Get(':id/report')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({
    summary: 'Download commission report for a sales agent as Excel (Internal users only)',
    description:
      'Generates an Excel report for the given sales agent showing all audits ' +
      'across their assigned portfolios within the specified date range. ' +
      'Audits are grouped by currency. Each sheet shows per-OTA confirmed amounts, ' +
      'grand total, commission % and the calculated commission amount.'
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file download',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {}
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request — invalid date range or no portfolios assigned' })
  @ApiResponse({ status: 404, description: 'Sales agent not found' })
  async downloadReport(
    @Param('id') id: string,
    @Query() query: SalesAgentReportQueryDto,
    @CurrentUser() user: IUserWithPermissions,
    @Res() res: Response
  ): Promise<void> {
    const buffer = await this.salesAgentService.downloadReport(id, query, user)
    const fromStr = query.from.replace(/-/g, '')
    const toStr = query.to.replace(/-/g, '')
    const filename = `sales-agent-report-${fromStr}-${toStr}.xlsx`
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a sales agent (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Sales agent deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete agent assigned to portfolios' })
  @ApiResponse({ status: 404, description: 'Sales agent not found' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.salesAgentService.remove(id, user)
  }
}
