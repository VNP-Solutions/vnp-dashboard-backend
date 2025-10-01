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
import { CreateUserRoleDto, UpdateUserRoleDto } from './user-role.dto'
import type { IUserRoleService } from './user-role.interface'

@ApiTags('User Role')
@ApiBearerAuth('JWT-auth')
@Controller('user-role')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserRoleController {
  constructor(
    @Inject('IUserRoleService')
    private readonly userRoleService: IUserRoleService
  ) {}

  @Post()
  @RequirePermission(ModuleType.USER_ROLE, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createUserRoleDto: CreateUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.create(createUserRoleDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.USER_ROLE, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({
    status: 200,
    description: 'List of roles retrieved successfully'
  })
  findAll(@CurrentUser() user: IUserWithPermissions) {
    return this.userRoleService.findAll(user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.USER_ROLE, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this role'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.userRoleService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.USER_ROLE, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.update(id, updateUserRoleDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.USER_ROLE, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete role with assigned users'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.userRoleService.remove(id, user)
  }
}
