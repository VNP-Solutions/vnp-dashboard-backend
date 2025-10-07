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
  CreatePropertyCredentialsDto,
  PropertyCredentialsQueryDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'
import type { IPropertyCredentialsService } from './property-credentials.interface'

@ApiTags('Property Credentials')
@ApiBearerAuth('JWT-auth')
@Controller('property-credentials')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyCredentialsController {
  constructor(
    @Inject('IPropertyCredentialsService')
    private readonly credentialsService: IPropertyCredentialsService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create property credentials' })
  @ApiResponse({
    status: 201,
    description: 'Property credentials created successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  @ApiResponse({
    status: 409,
    description: 'Credentials already exist for this property'
  })
  create(
    @Body() createDto: CreatePropertyCredentialsDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.credentialsService.create(createDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all property credentials with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of property credentials retrieved successfully'
  })
  findAll(
    @Query() query: PropertyCredentialsQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.credentialsService.findAll(query, user)
  }

  @Get('property/:propertyId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get credentials by property ID' })
  @ApiResponse({
    status: 200,
    description: 'Property credentials retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Credentials not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this property'
  })
  findByPropertyId(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.credentialsService.findByPropertyId(propertyId, user)
  }

  @Patch('property/:propertyId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update property credentials' })
  @ApiResponse({
    status: 200,
    description: 'Property credentials updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Credentials not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('propertyId') propertyId: string,
    @Body() updateDto: UpdatePropertyCredentialsDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.credentialsService.update(propertyId, updateDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete property credentials' })
  @ApiResponse({
    status: 200,
    description: 'Property credentials deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Credentials not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.credentialsService.remove(id, user)
  }
}
