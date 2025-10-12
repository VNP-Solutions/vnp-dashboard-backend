import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { AuditQueryDto, CreateAuditDto, UpdateAuditDto } from './audit.dto'
import type { IAuditRepository, IAuditService } from './audit.interface'

@Injectable()
export class AuditService implements IAuditService {
  constructor(
    @Inject('IAuditRepository')
    private auditRepository: IAuditRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreateAuditDto, _user: IUserWithPermissions) {
    // Validate date range
    const startDate = new Date(data.start_date)
    const endDate = new Date(data.end_date)

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date')
    }

    return this.auditRepository.create(data)
  }

  async findAll(query: AuditQueryDto, user: IUserWithPermissions) {
    const accessiblePropertyIds =
      this.permissionService.getAccessibleResourceIds(user, ModuleType.AUDIT)

    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.type_of_ota) {
      additionalFilters.type_of_ota = query.type_of_ota
    }
    if (query.audit_status_id) {
      additionalFilters.audit_status_id = query.audit_status_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    if (query.is_archived) {
      additionalFilters.is_archived = query.is_archived
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: ['ota_id', 'property.name', 'id'], // Search by ota_id, property name, mongodb id
      filterableFields: [
        'type_of_ota',
        'audit_status_id',
        'property_id',
        'is_archived'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'start_date',
        'end_date',
        'type_of_ota',
        'amount_collectable',
        'amount_confirmed',
        'is_archived'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        audit_status: 'auditStatus.status'
      }
    }

    // Build base where clause
    const baseWhere =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Build Prisma query options
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.auditRepository.findAll(
        { where, skip, take, orderBy },
        Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
      ),
      this.auditRepository.count(
        where,
        Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
      )
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(query: AuditQueryDto, user: IUserWithPermissions) {
    const accessiblePropertyIds =
      this.permissionService.getAccessibleResourceIds(user, ModuleType.AUDIT)

    if (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.length === 0
    ) {
      return []
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.type_of_ota) {
      additionalFilters.type_of_ota = query.type_of_ota
    }
    if (query.audit_status_id) {
      additionalFilters.audit_status_id = query.audit_status_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    if (query.is_archived) {
      additionalFilters.is_archived = query.is_archived
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: ['ota_id', 'property.name', 'id'], // Search by ota_id, property name, mongodb id
      filterableFields: [
        'type_of_ota',
        'audit_status_id',
        'property_id',
        'is_archived'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'start_date',
        'end_date',
        'type_of_ota',
        'amount_collectable',
        'amount_confirmed',
        'is_archived'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        audit_status: 'auditStatus.status'
      }
    }

    // Build base where clause
    const baseWhere =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Build Prisma query options (without pagination)
    const { where, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch all data without pagination
    const data = await this.auditRepository.findAll(
      { where, orderBy },
      Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
    )

    return data
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    return audit
  }

  async update(id: string, data: UpdateAuditDto, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Validate date range if dates are being updated
    if (data.start_date || data.end_date) {
      const startDate = new Date(data.start_date || audit.start_date)
      const endDate = new Date(data.end_date || audit.end_date)

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date')
      }
    }

    return this.auditRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    await this.auditRepository.delete(id)

    return { message: 'Audit deleted successfully' }
  }
}
