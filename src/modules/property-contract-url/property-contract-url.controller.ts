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
  CreatePropertyContractUrlDto,
  PropertyContractUrlQueryDto,
  UpdatePropertyContractUrlDto
} from './property-contract-url.dto'
import type { IPropertyContractUrlService } from './property-contract-url.interface'

@ApiTags('Property Contract URL')
@ApiBearerAuth('JWT-auth')
@Controller('property-contract-url')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyContractUrlController {
  constructor(
    @Inject('IPropertyContractUrlService')
    private readonly propertyContractUrlService: IPropertyContractUrlService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({
    summary:
      'Create a new property contract URL (Super Admin or internal users with property update permission and partial access)'
  })
  @ApiResponse({
    status: 201,
    description: 'Property contract URL created successfully'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only Super Admin or internal users with property update permission and partial access can upload contracts'
  })
  create(
    @Body() createPropertyContractUrlDto: CreatePropertyContractUrlDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyContractUrlService.create(
      createPropertyContractUrlDto,
      user
    )
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all property contract URLs accessible to the user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of property contract URLs retrieved successfully'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only Super Admin or users with property update permission and partial access can view contracts'
  })
  findAll(
    @Query() query: PropertyContractUrlQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyContractUrlService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all property contract URLs without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All property contract URLs retrieved successfully'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only Super Admin or users with property update permission and partial access can view contracts'
  })
  findAllForExport(
    @Query() query: PropertyContractUrlQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyContractUrlService.findAllForExport(query, user)
  }

  @Get('property/:propertyId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({
    summary: 'Get all property contract URLs for a specific property'
  })
  @ApiResponse({
    status: 200,
    description: 'Property contract URLs retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only Super Admin or users with property update permission and partial access can view contracts'
  })
  findByProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyContractUrlService.findByProperty(propertyId, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a property contract URL by ID' })
  @ApiResponse({
    status: 200,
    description: 'Property contract URL retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Property contract URL not found' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only Super Admin or users with property update permission and partial access can view contracts'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyContractUrlService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a property contract URL (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Property contract URL updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Property contract URL not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can update contracts'
  })
  update(
    @Param('id') id: string,
    @Body() updatePropertyContractUrlDto: UpdatePropertyContractUrlDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyContractUrlService.update(
      id,
      updatePropertyContractUrlDto,
      user
    )
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a property contract URL (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Property contract URL deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Property contract URL not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admin can delete contracts'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyContractUrlService.remove(id, user)
  }
}
