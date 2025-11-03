import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateTaskDto,
  DeleteAllTasksDto,
  TaskQueryDto,
  UpdateTaskDto
} from './task.dto'
import type { ITaskRepository, ITaskService } from './task.interface'

@Injectable()
export class TaskService implements ITaskService {
  constructor(
    @Inject('ITaskRepository')
    private taskRepository: ITaskRepository
  ) {}

  async create(data: CreateTaskDto, user: IUserWithPermissions) {
    if (!data.portfolio_id && !data.property_id) {
      throw new BadRequestException(
        'Task must be associated with either a portfolio or property'
      )
    }

    return this.taskRepository.create({
      ...data,
      user_id: user.id
    })
  }

  async findAll(query: TaskQueryDto, user: IUserWithPermissions) {
    // Build where clause - always filter by user_id
    const where: any = {
      user_id: user.id
    }

    // Add portfolio filter if provided
    if (query.portfolio_id) {
      where.portfolio_id = query.portfolio_id
    }

    // Add property filter if provided
    if (query.property_id) {
      where.property_id = query.property_id
    }

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    // Filter by due_date
    if (query.due_date) {
      where.due_date = new Date(query.due_date)
    }

    // Search by title, description, portfolio name, and property name
    if (query.search) {
      where.OR = [
        {
          title: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          portfolio: {
            name: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        },
        {
          property: {
            name: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    // Build orderBy - sort by created_at or due_date
    const sortField = query.sortBy === 'due_date' ? 'due_date' : 'created_at'
    const orderBy = {
      [sortField]: query.sortOrder === 'asc' ? 'asc' : 'desc'
    }

    const data = await this.taskRepository.findAll({ where, orderBy })

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    // Ensure the task belongs to the authenticated user
    if (task.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this task')
    }

    return task
  }

  async update(id: string, data: UpdateTaskDto, user: IUserWithPermissions) {
    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    // Ensure the task belongs to the authenticated user
    if (task.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this task')
    }

    return this.taskRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    // Ensure the task belongs to the authenticated user
    if (task.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this task')
    }

    await this.taskRepository.delete(id)

    return { message: 'Task deleted successfully' }
  }

  async removeAll(query: DeleteAllTasksDto, user: IUserWithPermissions) {
    // Build where clause - always filter by user_id
    const where: any = {
      user_id: user.id
    }

    // Ensure at least one filter is provided
    if (
      !query.portfolio_id &&
      !query.property_id &&
      query.is_done === undefined
    ) {
      throw new BadRequestException(
        'At least one filter (portfolio_id, property_id, or is_done) must be provided'
      )
    }

    // Build filter based on query
    if (query.portfolio_id) {
      where.portfolio_id = query.portfolio_id
    }

    if (query.property_id) {
      where.property_id = query.property_id
    }

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    const deletedCount = await this.taskRepository.deleteMany(where)

    return {
      message: `${deletedCount} task(s) deleted successfully`,
      deletedCount
    }
  }
}
