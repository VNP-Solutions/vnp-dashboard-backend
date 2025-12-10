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
  UseGuards
} from '@nestjs/common'
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
  BulkCreateConsolidatedReportDto,
  ConsolidatedReportQueryDto,
  CreateConsolidatedReportDto,
  UpdateConsolidatedReportDto
} from './consolidated-report.dto'
import type { IConsolidatedReportService } from './consolidated-report.interface'

@ApiTags('Consolidated Report')
@ApiBearerAuth('JWT-auth')
@Controller('consolidated-report')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ConsolidatedReportController {
  constructor(
    @Inject('IConsolidatedReportService')
    private readonly consolidatedReportService: IConsolidatedReportService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @ApiOperation({
    summary: 'Create a new consolidated report (Internal users only)'
  })
  @ApiResponse({
    status: 201,
    description: 'Consolidated report created successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only internal users can create consolidated reports'
  })
  create(
    @Body() createConsolidatedReportDto: CreateConsolidatedReportDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.consolidatedReportService.create(
      createConsolidatedReportDto,
      user
    )
  }

  @Post('bulk')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @ApiOperation({
    summary:
      'Create multiple consolidated reports for a portfolio (Internal users only)'
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk consolidated reports created successfully'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only internal users can create consolidated reports'
  })
  bulkCreate(
    @Body() bulkCreateDto: BulkCreateConsolidatedReportDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.consolidatedReportService.bulkCreate(bulkCreateDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all consolidated reports accessible to the user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of consolidated reports retrieved successfully'
  })
  findAll(
    @Query() query: ConsolidatedReportQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.consolidatedReportService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all consolidated reports without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All consolidated reports retrieved successfully'
  })
  findAllForExport(
    @Query() query: ConsolidatedReportQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.consolidatedReportService.findAllForExport(query, user)
  }

  @Get('portfolio/:portfolioId')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({
    summary: 'Get all consolidated reports for a specific portfolio'
  })
  @ApiResponse({
    status: 200,
    description: 'Consolidated reports retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this portfolio'
  })
  findByPortfolio(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.consolidatedReportService.findByPortfolio(portfolioId, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a consolidated report by ID' })
  @ApiResponse({
    status: 200,
    description: 'Consolidated report retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Consolidated report not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this consolidated report'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.consolidatedReportService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update a consolidated report (Internal users only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Consolidated report updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Consolidated report not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only internal users can update consolidated reports'
  })
  update(
    @Param('id') id: string,
    @Body() updateConsolidatedReportDto: UpdateConsolidatedReportDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.consolidatedReportService.update(
      id,
      updateConsolidatedReportDto,
      user
    )
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({
    summary: 'Delete a consolidated report (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Consolidated report deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Consolidated report not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can delete consolidated reports'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.consolidatedReportService.remove(id, user)
  }
}
