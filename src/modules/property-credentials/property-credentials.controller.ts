import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
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
  BulkUpdatePropertyCredentialsDto,
  CreatePropertyCredentialsDto,
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

  @Patch('bulk-update')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({
    summary: 'Bulk update property credentials',
    description:
      'Update the same credentials for multiple properties at once. ' +
      'Existing credentials will be merged with the new ones. ' +
      'Username and password must be provided together when updating optional credentials (Agoda/Booking). ' +
      'Passwords will be encrypted before storage.'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update completed successfully',
    schema: {
      example: {
        updated_count: 5,
        updated_property_ids: [
          '507f1f77bcf86cd799439011',
          '507f1f77bcf86cd799439012'
        ],
        skipped_count: 2,
        skipped_property_ids: ['507f1f77bcf86cd799439013']
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdatePropertyCredentialsDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.credentialsService.bulkUpdate(bulkUpdateDto, user)
  }
}
