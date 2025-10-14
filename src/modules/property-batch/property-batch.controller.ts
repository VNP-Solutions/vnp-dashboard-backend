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
  CreatePropertyBatchDto,
  PropertyBatchQueryDto,
  UpdatePropertyBatchDto
} from './property-batch.dto'
import type { IPropertyBatchService } from './property-batch.interface'

@ApiTags('Property Batch')
@ApiBearerAuth('JWT-auth')
@Controller('property-batch')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyBatchController {
  constructor(
    @Inject('IPropertyBatchService')
    private readonly propertyBatchService: IPropertyBatchService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new property batch' })
  @ApiResponse({ status: 201, description: 'Batch created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Batch number already exists'
  })
  create(
    @Body() createPropertyBatchDto: CreatePropertyBatchDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBatchService.create(createPropertyBatchDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all property batches with search and sorting'
  })
  @ApiResponse({
    status: 200,
    description: 'List of batches retrieved successfully'
  })
  findAll(
    @Query() query: PropertyBatchQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBatchService.findAll(query, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({ summary: 'Get a property batch by ID' })
  @ApiResponse({ status: 200, description: 'Batch retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyBatchService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a property batch' })
  @ApiResponse({ status: 200, description: 'Batch updated successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Batch number already exists'
  })
  update(
    @Param('id') id: string,
    @Body() updatePropertyBatchDto: UpdatePropertyBatchDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyBatchService.update(id, updatePropertyBatchDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a property batch' })
  @ApiResponse({ status: 200, description: 'Batch deleted successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete batch with associated properties'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyBatchService.remove(id, user)
  }
}
