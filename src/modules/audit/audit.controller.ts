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
import { AuditQueryDto, CreateAuditDto, UpdateAuditDto } from './audit.dto'
import type { IAuditService } from './audit.interface'

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(
    @Inject('IAuditService')
    private readonly auditService: IAuditService
  ) {}

  @Post()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new audit' })
  @ApiResponse({ status: 201, description: 'Audit created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data'
  })
  create(
    @Body() createAuditDto: CreateAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.create(createAuditDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all audits accessible to the user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of audits retrieved successfully'
  })
  findAll(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.findAll(query, user)
  }

  @Get('export/all')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all audits without pagination for export purposes (supports search, filter, and sort)'
  })
  @ApiResponse({
    status: 200,
    description: 'All audits retrieved successfully'
  })
  findAllForExport(
    @Query() query: AuditQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.findAllForExport(query, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get an audit by ID' })
  @ApiResponse({ status: 200, description: 'Audit retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this audit'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update an audit' })
  @ApiResponse({ status: 200, description: 'Audit updated successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data'
  })
  update(
    @Param('id') id: string,
    @Body() updateAuditDto: UpdateAuditDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.auditService.update(id, updateAuditDto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.AUDIT, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete an audit' })
  @ApiResponse({ status: 200, description: 'Audit deleted successfully' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.auditService.remove(id, user)
  }
}
