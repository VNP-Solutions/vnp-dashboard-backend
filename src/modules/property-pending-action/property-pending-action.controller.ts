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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  ApprovePropertyPendingActionDto,
  CreatePropertyPendingActionDto,
  PropertyPendingActionQueryDto
} from './property-pending-action.dto'
import type { IPropertyPendingActionService } from './property-pending-action.interface'

@ApiTags('Property Pending Actions')
@Controller('property-pending-actions')
@UseGuards(JwtAuthGuard)
export class PropertyPendingActionController {
  constructor(
    @Inject('IPropertyPendingActionService')
    private readonly service: IPropertyPendingActionService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a pending property action request' })
  @ApiResponse({
    status: 201,
    description: 'Pending action created successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async create(
    @Body() createDto: CreatePropertyPendingActionDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.create(createDto, user)
  }

  @Get()
  @ApiOperation({ summary: 'Get all pending actions' })
  @ApiResponse({
    status: 200,
    description: 'Returns all pending actions based on user role'
  })
  async findAll(
    @Query() query: PropertyPendingActionQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.findAll(query, user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific pending action by ID' })
  @ApiResponse({ status: 200, description: 'Returns the pending action' })
  @ApiResponse({ status: 404, description: 'Pending action not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.findOne(id, user)
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a pending action (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Action approved and executed successfully'
  })
  @ApiResponse({ status: 403, description: 'Only super admins can approve' })
  @ApiResponse({ status: 404, description: 'Pending action not found' })
  async approve(
    @Param('id') id: string,
    @Body() data: ApprovePropertyPendingActionDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.approve(id, data, user)
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending action (Super Admin only)'
  })
  @ApiResponse({ status: 200, description: 'Action rejected successfully' })
  @ApiResponse({ status: 403, description: 'Only super admins can reject' })
  @ApiResponse({ status: 404, description: 'Pending action not found' })
  @ApiResponse({
    status: 400,
    description: 'Rejection reason is required'
  })
  async reject(
    @Param('id') id: string,
    @Body() data: ApprovePropertyPendingActionDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.service.reject(id, data, user)
  }
}
