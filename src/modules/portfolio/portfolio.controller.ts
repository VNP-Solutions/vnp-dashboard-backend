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
  CreatePortfolioDto,
  PortfolioQueryDto,
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

  @Delete(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a portfolio' })
  @ApiResponse({ status: 200, description: 'Portfolio deleted successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete portfolio with associated properties'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.remove(id, user)
  }
}
