import {
  Body,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
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
import { getLocationFromRequest } from '../../common/utils/ip.util'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  CreatePortfolioBankDetailsDto,
  UpdatePortfolioBankDetailsDto
} from './portfolio-bank-details.dto'
import type { IPortfolioBankDetailsService } from './portfolio-bank-details.interface'

@ApiTags('Portfolio Bank Details')
@ApiBearerAuth('JWT-auth')
@Controller('portfolio-bank-details')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PortfolioBankDetailsController {
  constructor(
    @Inject('IPortfolioBankDetailsService')
    private readonly portfolioBankDetailsService: IPortfolioBankDetailsService
  ) {}

  @Post()
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create bank details for a portfolio' })
  @ApiResponse({
    status: 201,
    description: 'Bank details created successfully and copied to all child properties'
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Conflict - bank details already exist' })
  async create(
    @Body() createPortfolioBankDetailsDto: CreatePortfolioBankDetailsDto,
    @Req() req: any
  ) {
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext
    const location = await getLocationFromRequest(context)
    return this.portfolioBankDetailsService.create(
      createPortfolioBankDetailsDto,
      req.user,
      location
    )
  }

  @Get(':portfolioId')
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get bank details for a portfolio' })
  @ApiResponse({ status: 200, description: 'Bank details retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Bank details not found' })
  async findByPortfolioId(
    @Param('portfolioId') portfolioId: string,
    @Req() req: any
  ) {
    return this.portfolioBankDetailsService.findByPortfolioId(
      portfolioId,
      req.user
    )
  }

  @Put(':portfolioId')
  @RequirePermission(ModuleType.BANK_DETAILS, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update bank details for a portfolio',
    description: 'Update bank details or delete by setting bank_type to "none". Changes are automatically copied to all child properties.'
  })
  @ApiResponse({
    status: 200,
    description: 'Bank details updated successfully and changes copied to all child properties'
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Bank details not found' })
  async update(
    @Param('portfolioId') portfolioId: string,
    @Body() updatePortfolioBankDetailsDto: UpdatePortfolioBankDetailsDto,
    @Req() req: any
  ) {
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext
    const location = await getLocationFromRequest(context)
    return this.portfolioBankDetailsService.update(
      portfolioId,
      updatePortfolioBankDetailsDto,
      req.user,
      location
    )
  }
}
