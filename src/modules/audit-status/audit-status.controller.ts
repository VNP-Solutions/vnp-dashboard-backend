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
import { CreateAuditStatusDto, ReorderAuditStatusDto, UpdateAuditStatusDto } from './audit-status.dto'
import type { IAuditStatusService } from './audit-status.interface'

@ApiTags('Audit Status')
@ApiBearerAuth('JWT-auth')
@Controller('audit-status')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditStatusController {
  constructor(
    @Inject('IAuditStatusService')
    private readonly auditStatusService: IAuditStatusService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new audit status' })
  @ApiResponse({
    status: 201,
    description: 'Audit status created successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createAuditStatusDto: CreateAuditStatusDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditStatusService.create(createAuditStatusDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all audit statuses' })
  @ApiResponse({
    status: 200,
    description: 'List of audit statuses retrieved successfully'
  })
  findAll(@CurrentUser() user: IUserWithPermissions) {
    return this.auditStatusService.findAll(user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get an audit status by ID' })
  @ApiResponse({
    status: 200,
    description: 'Audit status retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Audit status not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditStatusService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update an audit status' })
  @ApiResponse({
    status: 200,
    description: 'Audit status updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Audit status not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateAuditStatusDto: UpdateAuditStatusDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditStatusService.update(id, updateAuditStatusDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete an audit status' })
  @ApiResponse({
    status: 200,
    description: 'Audit status deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Audit status not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete audit status with associated audits'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditStatusService.remove(id, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder an audit status' })
  @ApiResponse({ status: 200, description: 'Audit status order updated successfully' })
  @ApiResponse({ status: 404, description: 'Audit status not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  reorder(
    @Param('id') id: string,
    @Body() reorderAuditStatusDto: ReorderAuditStatusDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditStatusService.reorder(id, reorderAuditStatusDto, user)
  }
}
