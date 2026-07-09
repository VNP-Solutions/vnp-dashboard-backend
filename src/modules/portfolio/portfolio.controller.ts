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
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import {
  ActivatePortfolioDto,
  BulkDeletePortfolioDto,
  CreatePortfolioDto,
  DeactivatePortfolioDto,
  DeletePortfolioDto,
  GetPortfoliosByIdsSecureDto,
  PortfolioQueryDto,
  PortfolioStatsQueryDto,
  SecurePortfolioDto,
  SecurePortfolioListDto,
  SyncUpsertPortfolioDto,
  SyncUpdatePortfolioDto,
  UpdateFileCountDto,
  UpdatePortfolioDto
} from './portfolio.dto'
import type { IPortfolioService } from './portfolio.interface'
import { Public } from '../auth/decorators/public.decorator'
import { ServiceTokenGuard } from 'src/common/guards/service-token.guard'
import { ExternalJwtGuard } from './guards/external-jwt.guard'

@ApiTags('Portfolio')
@ApiBearerAuth('JWT-auth')
@Controller('portfolio')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PortfolioController {
  constructor(
    @Inject('IPortfolioService')
    private readonly portfolioService: IPortfolioService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Create a new portfolio (Internal users only)' })
  @ApiResponse({ status: 201, description: 'Portfolio created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
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

  @Get('export/all')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all portfolios without pagination for export purposes (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'All portfolios retrieved successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin only'
  })
  findAllForExport(
    @Query() query: PortfolioQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.findAllForExport(query, user)
  }

  @Post('secure')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all portfolios with full bank details (password required)',
    description:
      'Identical to GET /portfolio (same query params, same pagination/filter/sort), ' +
      'but returns unmasked bank details. Requires the current user to verify their password in the request body.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: {
          type: 'string',
          example: 'MySecureP@ssw0rd',
          description: 'Current user password for verification'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of portfolios with full bank details'
  })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  async findAllSecure(
    @Query() query: PortfolioQueryDto,
    @Body() body: SecurePortfolioListDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })
    if (!dbUser) throw new BadRequestException('User not found')
    const isPasswordValid = await EncryptionUtil.comparePassword(
      body.password,
      dbUser.password
    )
    if (!isPasswordValid) throw new BadRequestException('Invalid password')
    return this.portfolioService.findAllSecure(query, user)
  }

  @Post('by-ids/secure')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get specific portfolios by IDs with full bank details (password required)',
    description:
      'Returns full details including unmasked bank details for the specified portfolio IDs. ' +
      'IDs the user has no access to are silently excluded from the results. ' +
      'Requires the current user to verify their password.'
  })
  @ApiBody({ type: GetPortfoliosByIdsSecureDto })
  @ApiResponse({
    status: 200,
    description: 'List of portfolios with full bank details'
  })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  async findManyByIdsSecure(
    @Body() body: GetPortfoliosByIdsSecureDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })
    if (!dbUser) throw new BadRequestException('User not found')
    const isPasswordValid = await EncryptionUtil.comparePassword(
      body.password,
      dbUser.password
    )
    if (!isPasswordValid) throw new BadRequestException('Invalid password')
    return this.portfolioService.findManyByIdsSecure(body.portfolio_ids, user)
  }

  @Post(':id/secure')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({
    summary: 'Get a portfolio by ID with full bank details (password required)',
    description:
      'Identical to GET /portfolio/:id but returns unmasked bank details. ' +
      'Requires the current user to verify their password in the request body.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: {
          type: 'string',
          example: 'MySecureP@ssw0rd',
          description: 'Current user password for verification'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio with full bank details retrieved successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this portfolio'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async findOneSecure(
    @Param('id') id: string,
    @Body() body: SecurePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })
    if (!dbUser) throw new BadRequestException('User not found')
    const isPasswordValid = await EncryptionUtil.comparePassword(
      body.password,
      dbUser.password
    )
    if (!isPasswordValid) throw new BadRequestException('Invalid password')
    return this.portfolioService.findOneSecure(id, user)
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
  @ApiOperation({ summary: 'Update a portfolio (Internal users only)' })
  @ApiResponse({ status: 200, description: 'Portfolio updated successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  update(
    @Param('id') id: string,
    @Body() updatePortfolioDto: UpdatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.update(id, updatePortfolioDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({
    summary: 'Delete a portfolio (Super Admin only with password verification)'
  })
  @ApiResponse({ status: 200, description: 'Portfolio deleted successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot delete portfolio with associated properties or only Super Admin can delete portfolios or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(
    @Param('id') id: string,
    @Body() deletePortfolioDto: DeletePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.remove(id, deletePortfolioDto.password, user)
  }

  @Post('bulk-delete')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE)
  @ApiOperation({
    summary:
      'Bulk delete multiple portfolios (Super Admin only with password verification)',
    description:
      'Allows bulk deletion of multiple portfolios. Only super admin can perform this operation. ' +
      'Will skip portfolios that have associated properties and add them to the error list. ' +
      'Password verification is required.'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed with results',
    schema: {
      example: {
        success: 3,
        failed: 2,
        results: [
          { portfolio_id: '507f1f77bcf86cd799439011', success: true },
          {
            portfolio_id: '507f1f77bcf86cd799439012',
            success: false,
            message:
              'Cannot delete portfolio with 5 associated properties. Please delete or reassign the properties first.'
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or validation errors'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can bulk delete portfolios'
  })
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeletePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.bulkDelete(
      bulkDeleteDto.portfolio_ids,
      bulkDeleteDto.password,
      user
    )
  }

  @Post(':id/deactivate')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Deactivate a portfolio or submit deactivation request',
    description:
      'Super Admin can deactivate directly with password (no reason required). Internal users submit a pending action for approval with password and reason.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Portfolio deactivated successfully or deactivation request submitted'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Portfolio already deactivated or pending request exists or only Super Admin and internal users can deactivate or invalid password or reason required for internal users'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  deactivate(
    @Param('id') id: string,
    @Body() deactivatePortfolioDto: DeactivatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.deactivate(
      id,
      deactivatePortfolioDto.password,
      user,
      deactivatePortfolioDto.reason
    )
  }

  @Post(':id/activate')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Activate a portfolio or submit activation request',
    description:
      'Super Admin can activate directly with password (no reason required). Internal users submit a pending action for approval with password and reason.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Portfolio activated successfully or activation request submitted'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Portfolio already active or pending request exists or only Super Admin and internal users can activate or invalid password or reason required for internal users'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  activate(
    @Param('id') id: string,
    @Body() activatePortfolioDto: ActivatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.activate(
      id,
      activatePortfolioDto.password,
      user,
      activatePortfolioDto.reason
    )
  }

  @Post('bulk-import')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import portfolios from Excel file (Internal users only)',
    description: `
    Upload an Excel (.xlsx, .xls) or CSV file to bulk import portfolios.
    
    Required columns:
    - Portfolio Name: Name of the portfolio
    - Service Type: Service type name (will be created if doesn't exist)
    - Active status: Active status (Active/Inactive)
    
    Optional columns:
    - Currency: Currency code (defaults to USD)
    - Parent ID: Optional parent portfolio identifier
    - Documents/Contract URL: Contract URL(s) - comma-separated (Super Admin only)
    - Commissionable: Commissionable status (Yes/No)
    - Sales Agent: Sales agent name (required if commissionable is Yes)
    `
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Excel (.xlsx/.xls) or CSV file containing portfolio data'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed with results'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing file'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or not an internal user'
  })
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.bulkImport(file, user)
  }

  @Post('bulk-update')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk update portfolios from Excel file',
    description: `
    Upload an Excel (.xlsx, .xls) or CSV file to bulk update existing portfolios.
    Only Super Admin and internal users can use this endpoint.
    
    Required column:
    - Portfolio ID/Portfolio Id/Portfolio id/portfolio_id/ID/Id/id: ID of the portfolio to update (must exist)
    
    Optional columns (only update if provided):
    - Portfolio Name/Portfolio name/Name: Name of the portfolio
    - Service Type/Service type: Service type name (will be created if doesn't exist)
    - Active status/Active Status/Status/Is Active: Active status (Active/Inactive)
    - Parent ID/Parent Id/Parent id/parent_id: Optional parent portfolio identifier
    - Documents/Contract URL/Contract Url/Contract url: Contract URL(s) - comma-separated (Super Admin only)
    - Commissionable/Is Commissionable/is_commissionable: Commissionable status (Yes/No)
    - Sales Agent/Sales agent: Sales agent name (required if commissionable is Yes)
    
    Note: Empty cells will keep existing values unchanged.
    `
  })
  @ApiBody({
    description:
      'Excel (.xlsx/.xls) or CSV file containing portfolio update data',
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
            portfolioId: '507f1f77bcf86cd799439011',
            error: 'Portfolio not found'
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
    description:
      'Bad Request - Invalid file or file format or only Super Admin and internal users can bulk update'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  bulkUpdate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.bulkUpdate(file, user)
  }

  @Get(':id/stats')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({
    summary:
      'Get portfolio statistics with amount breakdown by platform and recent audits (amounts and recent list use review collection date when set, else record creation date, within the duration window)'
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio statistics retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this portfolio'
  })
  getStats(
    @Param('id') id: string,
    @Query() query: PortfolioStatsQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.getStats(id, query, user)
  }

  @Post('sync-upsert/:parent_id')
  @Public()
  @UseGuards(ExternalJwtGuard)
  syncUpsert(
    @Param('parent_id') parentId: string,
    @Body() dto: SyncUpsertPortfolioDto
  ) {
    return this.portfolioService.syncUpsert(parentId, dto)
  }

  @Post('sync-update')
  @Public()
  @UseGuards(ExternalJwtGuard)
  syncUpdate(@Body() dto: SyncUpdatePortfolioDto) {
    return this.portfolioService.syncUpdate(dto)
  }

  @Post('sync-delete/:parent_id')
  @Public()
  @UseGuards(ExternalJwtGuard)
  syncDelete(@Param('parent_id') parentId: string) {
    return this.portfolioService.syncDelete(parentId)
  }

  @Post('sync-file-count/:parent_id')
  @Public()
  @UseGuards(ExternalJwtGuard)
  updateFileCount(
    @Param('parent_id') parentId: string,
    @Body() dto: UpdateFileCountDto
  ) {
    return this.portfolioService.updateFileCount(parentId, dto.type, dto.count)
  }
}
