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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
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
  CreateContractUrlDto,
  ContractUrlQueryDto,
  UpdateContractUrlDto
} from './contract-url.dto'
import type { IContractUrlService } from './contract-url.interface'

@ApiTags('Contract URL')
@ApiBearerAuth('JWT-auth')
@Controller('contract-url')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractUrlController {
  constructor(
    @Inject('IContractUrlService')
    private readonly contractUrlService: IContractUrlService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new contract URL (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Contract URL created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can upload contracts'
  })
  create(
    @Body() createContractUrlDto: CreateContractUrlDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.contractUrlService.create(createContractUrlDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all contract URLs accessible to the user with pagination, search, filter, and sort (Portfolio Manager only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of contract URLs retrieved successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Portfolio Managers can access contracts'
  })
  findAll(
    @Query() query: ContractUrlQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.contractUrlService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all contract URLs without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All contract URLs retrieved successfully'
  })
  findAllForExport(
    @Query() query: ContractUrlQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.contractUrlService.findAllForExport(query, user)
  }

  @Get('portfolio/:portfolioId')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get all contract URLs for a specific portfolio' })
  @ApiResponse({
    status: 200,
    description: 'Contract URLs retrieved successfully'
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
    return this.contractUrlService.findByPortfolio(portfolioId, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a contract URL by ID' })
  @ApiResponse({
    status: 200,
    description: 'Contract URL retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Contract URL not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this contract URL'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.contractUrlService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a contract URL (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Contract URL updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Contract URL not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can update contracts'
  })
  update(
    @Param('id') id: string,
    @Body() updateContractUrlDto: UpdateContractUrlDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.contractUrlService.update(id, updateContractUrlDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a contract URL (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Contract URL deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Contract URL not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can delete contracts'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.contractUrlService.remove(id, user)
  }
}

