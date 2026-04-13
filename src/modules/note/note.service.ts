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
  addNotesTasksScopeOrFilters,
  assertAuditNotesTasksPolicy,
  assertPortfolioNotesTasksPolicy,
  assertPropertyNotesTasksPolicy
} from '../../common/utils/note-task-permission.util'
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

    // Check permissions based on the entity type (view + partial on that module; internal user)
    if (data.portfolio_id) {
      assertPortfolioNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        data.portfolio_id
      )
    } else if (data.property_id) {
      assertPropertyNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        data.property_id
      )
    } else if (data.audit_id) {
      assertAuditNotesTasksPolicy(user)
      const audit = await this.noteRepository.findAuditById(data.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.AUDIT,
        PermissionAction.READ,
        data.audit_id
      )
    }

    return this.noteRepository.create({
      ...data,
      user_id: user.id
    })
  }

  async findAll(query: NoteQueryDto, user: IUserWithPermissions) {
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Notes are only accessible by internal users'
      )
    }

    // Build where clause based on accessible resources
    const where: any = {}

    const portfolioIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )
    const propertyIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    const permissionFilters: any[] = []
    addNotesTasksScopeOrFilters(
      permissionFilters,
      user,
      portfolioIds,
      propertyIds
    )

    if (permissionFilters.length === 0) {
      return []
    }

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
          // Only show notes that have a portfolio_id set (not null)
          where.portfolio_id = { not: null }
          break
        case NoteEntityType.PROPERTY:
          // Only show notes that have a property_id set (not null)
          where.property_id = { not: null }
          break
        case NoteEntityType.AUDIT:
          // Only show notes that have an audit_id set (not null)
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

    if (note.portfolio_id) {
      assertPortfolioNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
    } else if (note.property_id) {
      assertPropertyNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
    } else if (note.audit_id) {
      assertAuditNotesTasksPolicy(user)
      const audit = await this.noteRepository.findAuditById(note.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.AUDIT,
        PermissionAction.READ,
        note.audit_id
      )
    }

    return note
  }

  async update(id: string, data: UpdateNoteDto, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    if (note.portfolio_id) {
      assertPortfolioNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
    } else if (note.property_id) {
      assertPropertyNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
    } else if (note.audit_id) {
      assertAuditNotesTasksPolicy(user)
      const audit = await this.noteRepository.findAuditById(note.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.AUDIT,
        PermissionAction.READ,
        note.audit_id
      )
    }

    return this.noteRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const note = await this.noteRepository.findById(id)

    if (!note) {
      throw new NotFoundException('Note not found')
    }

    if (note.portfolio_id) {
      assertPortfolioNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        note.portfolio_id
      )
    } else if (note.property_id) {
      assertPropertyNotesTasksPolicy(user)
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        note.property_id
      )
    } else if (note.audit_id) {
      assertAuditNotesTasksPolicy(user)
      const audit = await this.noteRepository.findAuditById(note.audit_id)
      if (!audit) {
        throw new NotFoundException('Audit not found')
      }
      await this.permissionService.requirePermission(
        user,
        ModuleType.AUDIT,
        PermissionAction.READ,
        note.audit_id
      )
    }

    await this.noteRepository.delete(id)

    return { message: 'Note deleted successfully' }
  }

  async removeAll(query: DeleteAllNotesDto, user: IUserWithPermissions) {
    if (user.role.is_external) {
      throw new ForbiddenException(
        'Notes are only accessible by internal users'
      )
    }

    const where: any = {}

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

    const portfolioIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )
    const propertyIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    const permissionFilters: any[] = []
    addNotesTasksScopeOrFilters(
      permissionFilters,
      user,
      portfolioIds,
      propertyIds
    )

    if (permissionFilters.length === 0) {
      return {
        message: '0 note(s) deleted successfully',
        deletedCount: 0
      }
    }

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
