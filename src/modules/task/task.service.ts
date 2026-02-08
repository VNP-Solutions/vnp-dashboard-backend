import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import {
  CreateTaskDto,
  DeleteAllTasksDto,
  TaskEntityType,
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
    // Tasks are only accessible by internal users
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Tasks are only accessible by internal users'
      )
    }

    if (!data.portfolio_id && !data.property_id && !data.audit_id) {
      throw new BadRequestException(
        'Task must be associated with either a portfolio, property, or audit'
      )
    }

    // Check permissions based on the entity type
    if (data.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        data.portfolio_id
      )
    } else if (data.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        data.property_id
      )
    } else if (data.audit_id) {
      // For audit tasks, check property permission
      // We need to get the property_id from the audit
      const audit = await this.taskRepository.findAuditById(data.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        audit.property_id
      )
    }

    return this.taskRepository.create({
      ...data,
      user_id: user.id
    })
  }

  async findAll(query: TaskQueryDto, user: IUserWithPermissions) {
    // Tasks are only accessible by internal users
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Tasks are only accessible by internal users'
      )
    }

    // Build where clause based on accessible resources
    const where: any = {}

    // Get accessible portfolios and properties
    const portfolioIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )
    const propertyIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    // Build permission-based filters
    const permissionFilters: any[] = []

    // Portfolio tasks - if user has view access to portfolios
    if (portfolioIds === 'all' || (portfolioIds && portfolioIds.length > 0)) {
      permissionFilters.push({
        portfolio_id:
          portfolioIds === 'all' ? { not: null } : { in: portfolioIds }
      })
    }

    // Property tasks - if user has view access to properties
    if (propertyIds === 'all' || (propertyIds && propertyIds.length > 0)) {
      permissionFilters.push({
        property_id: propertyIds === 'all' ? { not: null } : { in: propertyIds }
      })
    }

    // Audit tasks - based on property permission (audit belongs to property)
    if (propertyIds === 'all' || (propertyIds && propertyIds.length > 0)) {
      permissionFilters.push({
        AND: [
          { audit_id: { not: null } },
          {
            audit: {
              property_id:
                propertyIds === 'all' ? { not: null } : { in: propertyIds }
            }
          }
        ]
      })
    }

    // If no access to any resource type, return empty
    if (permissionFilters.length === 0) {
      return []
    }

    // Combine permission filters with OR
    where.OR = permissionFilters

    // Add portfolio filter if provided
    if (query.portfolio_id) {
      where.portfolio_id = query.portfolio_id
    }

    // Add property filter if provided
    if (query.property_id) {
      where.property_id = query.property_id
    }

    // Add audit filter if provided
    if (query.audit_id) {
      where.audit_id = query.audit_id
    }

    // Filter by entity type - get all tasks for a specific entity type
    // TaskEntityType.ALL is equivalent to no filter (returns all tasks)
    if (query.entity_type && query.entity_type !== TaskEntityType.ALL) {
      switch (query.entity_type) {
        case TaskEntityType.PORTFOLIO:
          where.portfolio_id = { not: null }
          break
        case TaskEntityType.PROPERTY:
          where.property_id = { not: null }
          break
        case TaskEntityType.AUDIT:
          where.audit_id = { not: null }
          break
      }
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
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
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
    // Tasks are only accessible by internal users
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Tasks are only accessible by internal users'
      )
    }

    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    // Check permissions based on the entity type
    if (task.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        task.portfolio_id
      )
    } else if (task.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        task.property_id
      )
    } else if (task.audit_id && task.audit) {
      // For audit tasks, check property permission
      const audit = await this.taskRepository.findAuditById(task.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        audit.property_id
      )
    }

    return task
  }

  async update(id: string, data: UpdateTaskDto, user: IUserWithPermissions) {
    // Tasks are only accessible by internal users
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Tasks are only accessible by internal users'
      )
    }

    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    // Check permissions based on the entity type
    if (task.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        task.portfolio_id
      )
    } else if (task.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        task.property_id
      )
    } else if (task.audit_id) {
      // For audit tasks, check property permission
      const audit = await this.taskRepository.findAuditById(task.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        audit.property_id
      )
    }

    return this.taskRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    // Tasks are only accessible by internal users
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Tasks are only accessible by internal users'
      )
    }

    const task = await this.taskRepository.findById(id)

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    // Check permissions based on the entity type
    if (task.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        task.portfolio_id
      )
    } else if (task.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        task.property_id
      )
    } else if (task.audit_id) {
      // For audit tasks, check property permission
      const audit = await this.taskRepository.findAuditById(task.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        audit.property_id
      )
    }

    await this.taskRepository.delete(id)

    return { message: 'Task deleted successfully' }
  }

  async removeAll(query: DeleteAllTasksDto, user: IUserWithPermissions) {
    // Tasks are only accessible by internal users
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Tasks are only accessible by internal users'
      )
    }

    // Build where clause based on accessible resources
    const where: any = {}

    // Ensure at least one filter is provided
    if (
      !query.portfolio_id &&
      !query.property_id &&
      !query.audit_id &&
      query.is_done === undefined
    ) {
      throw new BadRequestException(
        'At least one filter (portfolio_id, property_id, audit_id, or is_done) must be provided'
      )
    }

    // Get accessible portfolios and properties
    const portfolioIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )
    const propertyIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    // Build permission-based filters
    const permissionFilters: any[] = []

    // Portfolio tasks - if user has view access to portfolios
    if (portfolioIds === 'all' || (portfolioIds && portfolioIds.length > 0)) {
      permissionFilters.push({
        portfolio_id:
          portfolioIds === 'all' ? { not: null } : { in: portfolioIds }
      })
    }

    // Property tasks - if user has view access to properties
    if (propertyIds === 'all' || (propertyIds && propertyIds.length > 0)) {
      permissionFilters.push({
        property_id: propertyIds === 'all' ? { not: null } : { in: propertyIds }
      })
    }

    // Audit tasks - based on property permission
    if (propertyIds === 'all' || (propertyIds && propertyIds.length > 0)) {
      permissionFilters.push({
        AND: [
          { audit_id: { not: null } },
          {
            audit: {
              property_id:
                propertyIds === 'all' ? { not: null } : { in: propertyIds }
            }
          }
        ]
      })
    }

    // If no access to any resource type, return 0
    if (permissionFilters.length === 0) {
      return {
        message: '0 task(s) deleted successfully',
        deletedCount: 0
      }
    }

    // Combine permission filters with OR
    where.OR = permissionFilters

    // Build filter based on query
    if (query.portfolio_id) {
      where.portfolio_id = query.portfolio_id
    }

    if (query.property_id) {
      where.property_id = query.property_id
    }

    if (query.audit_id) {
      where.audit_id = query.audit_id
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
