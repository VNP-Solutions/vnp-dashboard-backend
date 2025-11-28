import {
  Body,
  Controller,
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
  AuditBatchQueryDto,
  CreateAuditBatchDto,
  DeleteAuditBatchDto,
  ReorderAuditBatchDto,
  UpdateAuditBatchDto
} from './audit-batch.dto'
import type { IAuditBatchService } from './audit-batch.interface'

@ApiTags('Audit Batch')
@ApiBearerAuth('JWT-auth')
@Controller('audit-batch')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditBatchController {
  constructor(
    @Inject('IAuditBatchService')
    private readonly auditBatchService: IAuditBatchService
  ) {}

  @Post()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new audit batch' })
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
    @Body() createAuditBatchDto: CreateAuditBatchDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditBatchService.create(createAuditBatchDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all audit batches with search and sorting'
  })
  @ApiResponse({
    status: 200,
    description: 'List of batches retrieved successfully'
  })
  findAll(
    @Query() query: AuditBatchQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditBatchService.findAll(query, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({ summary: 'Get an audit batch by ID' })
  @ApiResponse({ status: 200, description: 'Batch retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditBatchService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update an audit batch' })
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
    @Body() updateAuditBatchDto: UpdateAuditBatchDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditBatchService.update(id, updateAuditBatchDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Delete an audit batch (requires password verification)'
  })
  @ApiResponse({ status: 200, description: 'Batch deleted successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot delete batch with associated audits or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(
    @Param('id') id: string,
    @Body() deleteAuditBatchDto: DeleteAuditBatchDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditBatchService.remove(id, deleteAuditBatchDto.password, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder an audit batch' })
  @ApiResponse({ status: 200, description: 'Batch order updated successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  reorder(
    @Param('id') id: string,
    @Body() reorderAuditBatchDto: ReorderAuditBatchDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditBatchService.reorder(id, reorderAuditBatchDto, user)
  }
}
