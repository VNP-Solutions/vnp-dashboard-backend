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
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'
import type { INoteRepository, INoteService } from './note.interface'

@Injectable()
export class NoteService implements INoteService {
  constructor(
    @Inject('INoteRepository')
    private noteRepository: INoteRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreateNoteDto, user: IUserWithPermissions) {
    if (!data.portfolio_id && !data.property_id) {
      throw new BadRequestException(
        'Note must be associated with either a portfolio or property'
      )
    }

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
            'Insufficient permissions to create portfolio note'
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
            'Insufficient permissions to create property note'
        )
      }
    }

    return this.noteRepository.create(data)
  }

  async findAll(query: NoteQueryDto, user: IUserWithPermissions) {
    // Build where clause
    const where: any = {}

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
            'Insufficient permissions to read portfolio notes'
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
            'Insufficient permissions to read property notes'
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

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    // Search by text
    if (query.search) {
      where.text = {
        contains: query.search,
        mode: 'insensitive'
      }
    }

    // Build orderBy - only sort by created_at
    const orderBy = {
      created_at: query.sortOrder === 'asc' ? 'asc' : 'desc'
    }

    const data = await this.noteRepository.findAll({ where, orderBy })

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Check permission based on the entity type
    if (note.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to read this portfolio note'
        )
      }
    } else if (note.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to read this property note'
        )
      }
    }

    return note
  }

  async update(id: string, data: UpdateNoteDto, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Check permission based on the entity type
    if (note.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.UPDATE,
        note.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to update this portfolio note'
        )
      }
    } else if (note.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.UPDATE,
        note.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to update this property note'
        )
      }
    }

    return this.noteRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Check permission based on the entity type
    if (note.portfolio_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.DELETE,
        note.portfolio_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to delete this portfolio note'
        )
      }
    } else if (note.property_id) {
      const hasPermission = this.permissionService.checkPermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.DELETE,
        note.property_id
      )
      if (!hasPermission.allowed) {
        throw new ForbiddenException(
          hasPermission.reason ||
            'Insufficient permissions to delete this property note'
        )
      }
    }

    await this.noteRepository.delete(id)

    return { message: 'Note deleted successfully' }
  }

  async removeAll(query: DeleteAllNotesDto, user: IUserWithPermissions) {
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
            'Insufficient permissions to delete portfolio notes'
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
            'Insufficient permissions to delete property notes'
        )
      }
      where.property_id = query.property_id
    }

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    const deletedCount = await this.noteRepository.deleteMany(where)

    return {
      message: `${deletedCount} note(s) deleted successfully`,
      deletedCount
    }
  }
}
