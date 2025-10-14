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
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  CreateTaskDto,
  DeleteAllTasksDto,
  TaskQueryDto,
  UpdateTaskDto
} from './task.dto'
import type { ITaskService } from './task.interface'

@ApiTags('Task')
@ApiBearerAuth('JWT-auth')
@Controller('task')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TaskController {
  constructor(
    @Inject('ITaskService')
    private readonly taskService: ITaskService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Task must be associated with either a portfolio or property'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.taskService.create(createTaskDto, user)
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tasks with search, filter, and sort (no pagination)'
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully'
  })
  findAll(
    @Query() query: TaskQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.taskService.findAll(query, user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.taskService.findOne(id, user)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.taskService.update(id, updateTaskDto, user)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.taskService.remove(id, user)
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all tasks matching the filter criteria'
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks deleted successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'At least one filter parameter is required'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  removeAll(
    @Query() query: DeleteAllTasksDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.taskService.removeAll(query, user)
  }
}
