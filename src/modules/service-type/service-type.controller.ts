import {
  Body,
  Controller,
  Delete,
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
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './service-type.dto'
import type { IServiceTypeService } from './service-type.interface'

@ApiTags('Service Type')
@ApiBearerAuth('JWT-auth')
@Controller('service-type')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceTypeController {
  constructor(
    @Inject('IServiceTypeService')
    private readonly serviceTypeService: IServiceTypeService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new service type' })
  @ApiResponse({
    status: 201,
    description: 'Service type created successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createServiceTypeDto: CreateServiceTypeDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.serviceTypeService.create(createServiceTypeDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all service types' })
  @ApiResponse({
    status: 200,
    description: 'List of service types retrieved successfully'
  })
  findAll(@CurrentUser() user: IUserWithPermissions) {
    return this.serviceTypeService.findAll(user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get a service type by ID' })
  @ApiResponse({
    status: 200,
    description: 'Service type retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.serviceTypeService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a service type' })
  @ApiResponse({
    status: 200,
    description: 'Service type updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateServiceTypeDto: UpdateServiceTypeDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.serviceTypeService.update(id, updateServiceTypeDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a service type' })
  @ApiResponse({
    status: 200,
    description: 'Service type deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete service type with associated portfolios'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.serviceTypeService.remove(id, user)
  }
}
