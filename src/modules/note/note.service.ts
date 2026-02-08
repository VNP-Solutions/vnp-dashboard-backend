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
  NoteEntityType,
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
    if (!data.portfolio_id && !data.property_id && !data.audit_id) {
      throw new BadRequestException(
        'Note must be associated with either a portfolio, property, or audit'
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
      // For audit notes, check property permission
      // We need to get the property_id from the audit
      const audit = await this.noteRepository.findAuditById(data.audit_id)
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

    return this.noteRepository.create({
      ...data,
      user_id: user.id
    })
  }

  async findAll(query: NoteQueryDto, user: IUserWithPermissions) {
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

    // Portfolio notes - if user has view access to portfolios
    if (portfolioIds === 'all' || (portfolioIds && portfolioIds.length > 0)) {
      permissionFilters.push({
        portfolio_id:
          portfolioIds === 'all' ? { not: null } : { in: portfolioIds }
      })
    }

    // Property notes - if user has view access to properties
    if (propertyIds === 'all' || (propertyIds && propertyIds.length > 0)) {
      permissionFilters.push({
        property_id: propertyIds === 'all' ? { not: null } : { in: propertyIds }
      })
    }

    // Audit notes - based on property permission (audit belongs to property)
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

    // Filter by entity type - get all notes for a specific entity type
    // NoteEntityType.ALL is equivalent to no filter (returns all notes)
    if (query.entity_type && query.entity_type !== NoteEntityType.ALL) {
      switch (query.entity_type) {
        case NoteEntityType.PORTFOLIO:
          where.portfolio_id = { not: null }
          break
        case NoteEntityType.PROPERTY:
          where.property_id = { not: null }
          break
        case NoteEntityType.AUDIT:
          where.audit_id = { not: null }
          break
      }
    }

    // Filter by is_done
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    // Search by text, portfolio name, property name, and audit details
    if (query.search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            {
              text: {
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

    // Check permissions based on the entity type
    if (note.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
    } else if (note.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
    } else if (note.audit_id && note.audit) {
      // For audit notes, check property permission
      const audit = await this.noteRepository.findAuditById(note.audit_id)
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

    return note
  }

  async update(id: string, data: UpdateNoteDto, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Check permissions based on the entity type
    if (note.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
    } else if (note.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
    } else if (note.audit_id) {
      // For audit notes, check property permission
      const audit = await this.noteRepository.findAuditById(note.audit_id)
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

    return this.noteRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    // Check permissions based on the entity type
    if (note.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
    } else if (note.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
    } else if (note.audit_id) {
      // For audit notes, check property permission
      const audit = await this.noteRepository.findAuditById(note.audit_id)
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

    await this.noteRepository.delete(id)

    return { message: 'Note deleted successfully' }
  }

  async removeAll(query: DeleteAllNotesDto, user: IUserWithPermissions) {
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

    // Portfolio notes - if user has view access to portfolios
    if (portfolioIds === 'all' || (portfolioIds && portfolioIds.length > 0)) {
      permissionFilters.push({
        portfolio_id:
          portfolioIds === 'all' ? { not: null } : { in: portfolioIds }
      })
    }

    // Property notes - if user has view access to properties
    if (propertyIds === 'all' || (propertyIds && propertyIds.length > 0)) {
      permissionFilters.push({
        property_id: propertyIds === 'all' ? { not: null } : { in: propertyIds }
      })
    }

    // Audit notes - based on property permission
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
        message: '0 note(s) deleted successfully',
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

    const deletedCount = await this.noteRepository.deleteMany(where)

    return {
      message: `${deletedCount} note(s) deleted successfully`,
      deletedCount
    }
  }
}
