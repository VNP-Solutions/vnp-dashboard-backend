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
import {
  AuditQueryDto,
  BulkUpdateAuditDto,
  CreateAuditDto,
  UpdateAuditDto
} from './audit.dto'
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
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.AUDIT
      )

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
    // Handle is_archived filter: true/false/All/empty
    if (
      query.is_archived !== undefined &&
      query.is_archived !== null &&
      query.is_archived !== 'All' &&
      query.is_archived !== ''
    ) {
      additionalFilters.is_archived = query.is_archived === 'true'
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
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.AUDIT
      )

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
    // Handle is_archived filter: true/false/All/empty
    if (
      query.is_archived !== undefined &&
      query.is_archived !== null &&
      query.is_archived !== 'All' &&
      query.is_archived !== ''
    ) {
      additionalFilters.is_archived = query.is_archived === 'true'
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

  async archive(id: string, _user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check if audit is already archived
    if (audit.is_archived) {
      throw new BadRequestException('Audit is already archived')
    }

    // Check if audit has report URL (invoiced)
    if (!audit.report_url || audit.report_url.trim() === '') {
      throw new BadRequestException(
        'Cannot archive audit without a report URL (not invoiced)'
      )
    }

    // Get the service type from property's portfolio
    const serviceType = audit.property.portfolio.serviceType.type
    const auditStatus = audit.auditStatus.status.toUpperCase()

    // Validation logic based on service type
    if (serviceType === 'OTA POST') {
      // For OTA POST: must be COMPLETE status
      if (auditStatus !== 'COMPLETE') {
        throw new BadRequestException(
          'Cannot archive OTA POST audit. Status must be COMPLETE and audit must be invoiced'
        )
      }
    } else if (serviceType === 'MOR') {
      // For MOR: must be INVOICED status
      if (auditStatus !== 'INVOICED') {
        throw new BadRequestException(
          'Cannot archive MOR audit. Status must be INVOICED'
        )
      }
    } else {
      throw new BadRequestException(
        `Cannot archive audit with service type: ${serviceType}. Only OTA POST and MOR audits can be archived`
      )
    }

    // If all validations pass, archive the audit
    return this.auditRepository.archive(id)
  }

  async bulkUpdate(data: BulkUpdateAuditDto, _user: IUserWithPermissions) {
    const { audit_ids, ...updateData } = data

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    // Validate date range if dates are being updated
    if (updateData.start_date || updateData.end_date) {
      const startDate = new Date(updateData.start_date || new Date())
      const endDate = new Date(updateData.end_date || new Date())

      if (
        updateData.start_date &&
        updateData.end_date &&
        startDate >= endDate
      ) {
        throw new BadRequestException('Start date must be before end date')
      }
    }

    const result = await this.auditRepository.bulkUpdate(audit_ids, updateData)

    return {
      message: `Successfully updated ${result.count} audit(s)`,
      updated_count: result.count
    }
  }
}
