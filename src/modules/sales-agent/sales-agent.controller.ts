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
  CreateSalesAgentDto,
  SalesAgentQueryDto,
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
