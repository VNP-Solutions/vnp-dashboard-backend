import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ExternalJwtGuard } from '../portfolio/guards/external-jwt.guard'
import {
  BulkDeleteSyncActionLogDto,
  CreateSyncActionLogDto,
  SyncActionLogQueryDto
} from './sync-action-log.dto'
import type { ISyncActionLogService } from './sync-action-log.interface'

@ApiTags('Sync Action Logs')
@Controller('sync-action-log')
export class SyncActionLogController {
  constructor(
    @Inject('ISyncActionLogService')
    private readonly service: ISyncActionLogService
  ) {}

  @Post()
  @Public()
  @UseGuards(ExternalJwtGuard)
  @ApiOperation({ summary: 'Create a sync action log (DBMS communication JWT)' })
  @ApiResponse({ status: 201, description: 'Log created' })
  create(@Body() dto: CreateSyncActionLogDto) {
    return this.service.create(dto)
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List sync action logs (super admin only)' })
  findAll(
    @Query() query: SyncActionLogQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.findAll(query, user)
  }

  @Post('bulk-delete')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bulk delete sync action logs (super admin only)' })
  @ApiResponse({ status: 200, description: 'Logs deleted' })
  bulkDelete(
    @Body() dto: BulkDeleteSyncActionLogDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.bulkDelete(dto, user)
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get sync action log detail including items (super admin only)'
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.findOne(id, user)
  }
}
