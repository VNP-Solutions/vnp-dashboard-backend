import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
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
    private taskRepository: ITaskRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreateTaskDto, user: IUserWithPermissions) {
    // Only super admin can access tasks
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admin can access tasks. You must have all permissions set to "all" level with "all" access.'
      )
    }

    if (!data.portfolio_id && !data.property_id) {
      throw new BadRequestException(
        'Task must be associated with either a portfolio or property'
      )
    }

    /* COMMENTED OUT - Previous permission checking logic (may revert back later)
    // Check permission based on the entity type
    if (data.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.CREATE,
        data.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to create portfolio task'
        )
      }
    } else if (data.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.CREATE,
        data.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to create property task'
        )
      }
    }
    */

    return this.taskRepository.create(data)
  }

  async findAll(query: TaskQueryDto, user: IUserWithPermissions) {
    // Only super admin can access tasks
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admin can access tasks. You must have all permissions set to "all" level with "all" access.'
      )
    }

    // Build where clause
    const where: any = {}

    /* COMMENTED OUT - Previous permission checking logic (may revert back later)
    // Get accessible portfolio and property IDs
    const accessiblePortfolioIds =
      this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )
    const accessiblePropertyIds =
      this.permissionService.getAccessibleResourceIds(user, ModuleType.PROPERTY)

    // Build OR condition for portfolio and property access
    const orConditions: any[] = []

    // Add portfolio filter
    if (query.portfolio_id) {
      // Check if user has permission for this specific portfolio
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        query.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to read portfolio tasks'
        )
      }
      where.portfolio_id = query.portfolio_id
    } else if (
      accessiblePortfolioIds !== 'all' &&
      Array.isArray(accessiblePortfolioIds)
    ) {
      if (accessiblePortfolioIds.length > 0) {
        orConditions.push({
          portfolio_id: { in: accessiblePortfolioIds }
        })
      }
    } else if (accessiblePortfolioIds === 'all') {
      orConditions.push({
        portfolio_id: { not: null }
      })
    }

    // Add property filter
    if (query.property_id) {
      // Check if user has permission for this specific property
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        query.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to read property tasks'
        )
      }
      where.property_id = query.property_id
    } else if (
      accessiblePropertyIds !== 'all' &&
      Array.isArray(accessiblePropertyIds)
    ) {
      if (accessiblePropertyIds.length > 0) {
        orConditions.push({
          property_id: { in: accessiblePropertyIds }
        })
      }
    } else if (accessiblePropertyIds === 'all') {
      orConditions.push({
        property_id: { not: null }
      })
    }

    // Apply OR conditions only if no specific portfolio_id or property_id is provided
    if (!query.portfolio_id && !query.property_id && orConditions.length > 0) {
      where.OR = orConditions
    }

    // If user has no access to any portfolios or properties, return empty
    if (
      orConditions.length === 0 &&
      !query.portfolio_id &&
      !query.property_id
    ) {
      return []
    }
    */

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

    // Search by title or description
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
    // Only super admin can access tasks
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admin can access tasks. You must have all permissions set to "all" level with "all" access.'
      )
    }

    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    /* COMMENTED OUT - Previous permission checking logic (may revert back later)
    // Check permission based on the entity type
    if (task.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        task.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to read this portfolio task'
        )
      }
    } else if (task.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        task.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to read this property task'
        )
      }
    }
    */

    return task
  }

  async update(id: string, data: UpdateTaskDto, user: IUserWithPermissions) {
    // Only super admin can access tasks
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admin can access tasks. You must have all permissions set to "all" level with "all" access.'
      )
    }

    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    /* COMMENTED OUT - Previous permission checking logic (may revert back later)
    // Check permission based on the entity type
    if (task.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.UPDATE,
        task.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to update this portfolio task'
        )
      }
    } else if (task.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.UPDATE,
        task.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to update this property task'
        )
      }
    }
    */

    return this.taskRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    // Only super admin can access tasks
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admin can access tasks. You must have all permissions set to "all" level with "all" access.'
      )
    }

    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    /* COMMENTED OUT - Previous permission checking logic (may revert back later)
    // Check permission based on the entity type
    if (task.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.DELETE,
        task.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to delete this portfolio task'
        )
      }
    } else if (task.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.DELETE,
        task.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to delete this property task'
        )
      }
    }
    */

    await this.taskRepository.delete(id)

    return { message: 'Task deleted successfully' }
  }

  async removeAll(query: DeleteAllTasksDto, user: IUserWithPermissions) {
    // Only super admin can access tasks
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admin can access tasks. You must have all permissions set to "all" level with "all" access.'
      )
    }

    // Build where clause
    const where: any = {}

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

    /* COMMENTED OUT - Previous permission checking logic (may revert back later)
    // Check permissions and build filter
    if (query.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.DELETE,
        query.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to delete portfolio tasks'
        )
      }
      where.portfolio_id = query.portfolio_id
    }

    if (query.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.DELETE,
        query.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to delete property tasks'
        )
      }
      where.property_id = query.property_id
    }
    */

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
