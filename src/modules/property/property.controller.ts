import {
  BadRequestException,
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
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import type { IAuthRepository } from '../auth/auth.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  BulkTransferPropertyDto,
  CreatePropertyDto,
  GetPropertiesByPortfoliosDto,
  PropertyQueryDto,
  PropertyStatsResponseDto,
  SharePropertyDto,
  TransferPropertyDto,
  UnsharePropertyDto,
  UpdatePropertyDto
} from './property.dto'
import type { IPropertyService } from './property.interface'

@ApiTags('Property')
@ApiBearerAuth('JWT-auth')
@Controller('property')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyController {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService,
    @Inject('IAuthRepository')
    private readonly authRepository: IAuthRepository
  ) {}

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.create(createPropertyDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all properties accessible to the user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of properties retrieved successfully'
  })
  findAll(
    @Query() query: PropertyQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all properties without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All properties retrieved successfully'
  })
  findAllForExport(
    @Query() query: PropertyQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findAllForExport(query, user)
  }

  @Post('by-portfolios')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get properties from specific portfolios (used for user invitation flows). If empty array is provided, returns all accessible properties.'
  })
  @ApiResponse({
    status: 200,
    description:
      'Properties from specified portfolios retrieved successfully. Returns all properties if empty array provided.'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid portfolio IDs provided'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  getPropertiesByPortfolios(
    @Body() getPropertiesByPortfoliosDto: GetPropertiesByPortfoliosDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.getPropertiesByPortfolios(
      getPropertiesByPortfoliosDto,
      user
    )
  }

  @Get(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a property by ID' })
  @ApiResponse({ status: 200, description: 'Property retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this property'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a property' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.update(id, updatePropertyDto, user)
  }

  @Patch(':id/transfer')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Transfer a property to another portfolio (Super admin: direct transfer with password, Property manager: creates pending action without password)' })
  @ApiResponse({
    status: 200,
    description: 'Property transferred successfully or transfer request submitted for approval'
  })
  @ApiResponse({ status: 404, description: 'Property or Portfolio not found' })
  @ApiResponse({
    status: 400,
    description:
      'Property is already in the target portfolio or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  async transfer(
    @Param('id') id: string,
    @Body() transferPropertyDto: TransferPropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    // Password validation is required for all users during transfer
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      transferPropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.transfer(id, transferPropertyDto, user)
  }

  @Patch(':id/share')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Share a property with other portfolios (view-only access)'
  })
  @ApiResponse({
    status: 200,
    description: 'Property shared successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Property or one of the target portfolios not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot share property with its owner portfolio'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only property owner can share'
  })
  share(
    @Param('id') id: string,
    @Body() sharePropertyDto: SharePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.share(id, sharePropertyDto, user)
  }

  @Patch(':id/unshare')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Remove property sharing from specified portfolios'
  })
  @ApiResponse({
    status: 200,
    description: 'Property unshared successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only property owner can unshare'
  })
  unshare(
    @Param('id') id: string,
    @Body() unsharePropertyDto: UnsharePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.unshare(id, unsharePropertyDto, user)
  }

  @Post('bulk-transfer')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({
    summary: 'Bulk transfer multiple properties to another portfolio (Super admin or internal property/portfolio manager only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk transfer completed with results'
  })
  @ApiResponse({ status: 404, description: 'Target portfolio not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins or internal property/portfolio managers can perform bulk transfers'
  })
  async bulkTransfer(
    @Body() bulkTransferPropertyDto: BulkTransferPropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const dbUser = await this.authRepository.findUserByEmail(user.email)

    if (!dbUser) {
      throw new BadRequestException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      bulkTransferPropertyDto.password,
      dbUser.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    return this.propertyService.bulkTransfer(bulkTransferPropertyDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a property (Super admin: direct deletion, Property manager: creates pending action for approval)' })
  @ApiResponse({ status: 200, description: 'Property deleted successfully or delete request submitted for approval' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete property with associated audits'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.remove(id, user)
  }

  @Post('bulk-import')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import properties from Excel file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx) containing property data'
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
    description: 'Forbidden - Insufficient permissions'
  })
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.bulkImport(file, user)
  }

  @Get(':id/stats')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({
    summary: 'Get property statistics showing total amounts from all audits'
  })
  @ApiResponse({
    status: 200,
    description: 'Property statistics retrieved successfully',
    type: PropertyStatsResponseDto
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this property'
  })
  getStats(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.getStats(id, user)
  }
}
