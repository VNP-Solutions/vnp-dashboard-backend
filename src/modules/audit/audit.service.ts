import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { OtaType, PendingActionType, Property } from '@prisma/client'
import * as ExcelJS from 'exceljs'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AccessLevel,
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { roundAmount, roundToDecimals } from '../../common/utils/amount.util'
import {
  canArchiveAudit,
  getArchiveErrorMessage,
  getStatusesByCategory
} from '../../common/utils/audit.util'
import { ColoredLogger } from '../../common/utils/colored-logger.util'
import { EmailUtil } from '../../common/utils/email.util'
import {
  isInternalUser,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  parseSpreadsheetToJson,
  validateSpreadsheetFile
} from '../../common/utils/spreadsheet.util'
import type { IAuditBatchRepository } from '../audit-batch/audit-batch.interface'
import type { IAuditStatusRepository } from '../audit-status/audit-status.interface'
import type { IFileUploadService } from '../file-upload/file-upload.interface'
import type { IPendingActionRepository } from '../pending-action/pending-action.interface'
import type { IPortfolioRepository } from '../portfolio/portfolio.interface'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyRepository } from '../property/property.interface'
import {
  AuditQueryDto,
  AutoImportAuditErrorDto,
  AutoImportAuditResultDto,
  BulkArchiveAuditDto,
  BulkDeleteAuditDto,
  BulkImportResultDto,
  BulkUpdateResultDto,
  BulkUploadReportDto,
  CreateAuditDto,
  DeleteAuditsByPortfolioDto,
  GlobalStatsResponseDto,
  RequestUpdateAmountConfirmedDto,
  UpdateAuditDto,
  UpdateReportUrlDto
} from './audit.dto'
import type { IAuditRepository, IAuditService } from './audit.interface'

@Injectable()
export class AuditService implements IAuditService {
  private readonly logger = new ColoredLogger(AuditService.name)

  constructor(
    @Inject('IAuditRepository')
    private auditRepository: IAuditRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject('IAuditStatusRepository')
    private auditStatusRepository: IAuditStatusRepository,
    @Inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository,
    @Inject('IPortfolioRepository')
    private portfolioRepository: IPortfolioRepository,
    @Inject('IAuditBatchRepository')
    private auditBatchRepository: IAuditBatchRepository,
    @Inject('IPendingActionRepository')
    private pendingActionRepository: IPendingActionRepository,
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil,
    @Inject('IFileUploadService')
    private fileUploadService: IFileUploadService
  ) {}

  /**
   * Helper method to convert status category or status IDs to actual status IDs
   * @param statusParam - Can be 'pending', 'upcoming', 'completed', or comma-separated status IDs
   * @returns Array of status IDs or null if no valid status found
   */
  private async resolveStatusIds(
    statusParam: string
  ): Promise<string[] | null> {
    const trimmedStatus = statusParam.trim().toLowerCase()

    // Check if it's a status category
    const validCategories = ['pending', 'upcoming', 'completed'] as const
    type StatusCategory = (typeof validCategories)[number]

    if (validCategories.includes(trimmedStatus as StatusCategory)) {
      const statusNames = getStatusesByCategory(trimmedStatus as StatusCategory)

      // Fetch all audit statuses and filter by names (case-insensitive)
      const allStatuses = await this.auditStatusRepository.findAll()
      const matchingStatuses = allStatuses.filter(status =>
        statusNames.some(
          name => name.toLowerCase() === status.status.toLowerCase()
        )
      )

      return matchingStatuses.length > 0 ? matchingStatuses.map(s => s.id) : []
    }

    // Otherwise, treat as comma-separated status IDs
    const statusIds = statusParam
      .split(',')
      .map(s => s.trim())
      .filter(s => s)

    return statusIds.length > 0 ? statusIds : null
  }

  async create(data: CreateAuditDto, user: IUserWithPermissions) {
    // Only internal users can create audits
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can create audits')
    }

    // Round amount fields to 2 decimal places
    const createData = {
      ...data,
      expedia_amount_collectable:
        data.expedia_amount_collectable !== undefined &&
        data.expedia_amount_collectable !== null
          ? (roundToDecimals(data.expedia_amount_collectable) ?? undefined)
          : undefined,
      expedia_amount_confirmed:
        data.expedia_amount_confirmed !== undefined &&
        data.expedia_amount_confirmed !== null
          ? (roundToDecimals(data.expedia_amount_confirmed) ?? undefined)
          : undefined,
      agoda_amount_collectable:
        data.agoda_amount_collectable !== undefined &&
        data.agoda_amount_collectable !== null
          ? (roundToDecimals(data.agoda_amount_collectable) ?? undefined)
          : undefined,
      agoda_amount_confirmed:
        data.agoda_amount_confirmed !== undefined &&
        data.agoda_amount_confirmed !== null
          ? (roundToDecimals(data.agoda_amount_confirmed) ?? undefined)
          : undefined,
      booking_amount_collectable:
        data.booking_amount_collectable !== undefined &&
        data.booking_amount_collectable !== null
          ? (roundToDecimals(data.booking_amount_collectable) ?? undefined)
          : undefined,
      booking_amount_confirmed:
        data.booking_amount_confirmed !== undefined &&
        data.booking_amount_confirmed !== null
          ? (roundToDecimals(data.booking_amount_confirmed) ?? undefined)
          : undefined
    }

    return this.auditRepository.create(createData)
  }

  async findAll(query: AuditQueryDto, user: IUserWithPermissions) {
    // Get audit access level to determine behavior
    const auditPermission = user.role.audit_permission

    // If audit access level is 'none', return empty result
    if (!auditPermission || auditPermission.access_level === 'none') {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Determine accessible property IDs based on audit access level
    let accessiblePropertyIds: string[] | 'all'

    if (auditPermission.access_level === 'all') {
      // If audit access is 'all', show all audits
      accessiblePropertyIds = 'all'
    } else {
      // If audit access is 'partial', rely on property access level and accessed property list
      accessiblePropertyIds =
        await this.permissionService.getAccessibleResourceIds(
          user,
          ModuleType.PROPERTY
        )

      // If user has no accessible properties, return empty result
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
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.batch_id) {
      additionalFilters.batch_id = query.batch_id
    }
    if (query.type_of_ota) {
      // Since type_of_ota is now an array, use "has" operator to check if array contains value
      additionalFilters.type_of_ota = { has: query.type_of_ota }
    }
    if (query.audit_status_id) {
      additionalFilters.audit_status_id = query.audit_status_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    if (query.portfolio_id) {
      additionalFilters.portfolio_id = query.portfolio_id
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

    // For MongoDB: pre-query all searchable relations since Prisma MongoDB
    // does not support nested relation filters or contains on enum fields
    const searchOrConditions: any[] = []
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim()

      const [matchingProperties, matchingBatches, matchingStatuses] =
        await Promise.all([
          this.prisma.property.findMany({
            where: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                {
                  credentials: {
                    expedia_id: { contains: searchTerm, mode: 'insensitive' }
                  }
                }
              ]
            },
            select: { id: true }
          }),
          this.prisma.auditBatch.findMany({
            where: { batch_no: { contains: searchTerm, mode: 'insensitive' } },
            select: { id: true }
          }),
          this.prisma.auditStatus.findMany({
            where: { status: { contains: searchTerm, mode: 'insensitive' } },
            select: { id: true }
          })
        ])

      if (matchingProperties.length > 0) {
        searchOrConditions.push({
          property_id: { in: matchingProperties.map(p => p.id) }
        })
      }
      if (matchingBatches.length > 0) {
        searchOrConditions.push({
          batch_id: { in: matchingBatches.map(b => b.id) }
        })
      }
      if (matchingStatuses.length > 0) {
        searchOrConditions.push({
          audit_status_id: { in: matchingStatuses.map(s => s.id) }
        })
      }
    }

    // Configuration for query builder
    // searchFields is empty — search is handled via pre-queries above since
    // MongoDB does not support contains on relation paths or enum array fields
    const queryConfig = {
      searchFields: [],
      filterableFields: [
        'batch_id',
        'type_of_ota',
        'audit_status_id',
        'property_id',
        'portfolio_id',
        'is_archived'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'type_of_ota',
        'amount_collectable',
        'amount_confirmed',
        'expedia_amount_collectable',
        'expedia_amount_confirmed',
        'agoda_amount_collectable',
        'agoda_amount_confirmed',
        'booking_amount_collectable',
        'booking_amount_confirmed',
        'is_archived'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        audit_status: 'auditStatus.status',
        expedia_id: 'property.credentials.expedia_id',
        portfolio_id: 'property.portfolio_id'
      }
    }

    // Build base where clause (access scope only)
    const baseWhere: any =
      accessiblePropertyIds === 'all'
        ? {}
        : {
            property_id: {
              in: accessiblePropertyIds
            }
          }

    // Build Prisma query options (handles explicit filters, sorting, pagination)
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Add expedia_id filter if provided
    let finalWhere = where
    if (query.expedia_id) {
      finalWhere = {
        ...where,
        property: {
          credentials: {
            expedia_id: {
              contains: query.expedia_id,
              mode: 'insensitive'
            }
          }
        }
      }
    }

    // Add status filter if provided (supports categories: pending/upcoming/completed or comma-separated status IDs)
    if (query.status) {
      const statusIds = await this.resolveStatusIds(query.status)

      if (statusIds && statusIds.length > 0) {
        finalWhere = {
          ...finalWhere,
          audit_status_id: {
            in: statusIds
          }
        }
      }
    }

    // Add portfolio_id filter if provided
    if (query.portfolio_id) {
      // Find all properties in the specified portfolio
      const portfolioProperties = await this.prisma.property.findMany({
        where: {
          portfolio_id: query.portfolio_id
        },
        select: {
          id: true
        }
      })

      if (portfolioProperties.length > 0) {
        const portfolioPropertyIds = portfolioProperties.map(p => p.id)

        // Add property filter to intersect with existing property filters
        if (finalWhere.property_id && finalWhere.property_id.in) {
          // Intersect with existing property IDs
          finalWhere.property_id.in = finalWhere.property_id.in.filter(
            (id: string) => portfolioPropertyIds.includes(id)
          )
        } else {
          // Set property ID filter to portfolio properties
          finalWhere.property_id = {
            in: portfolioPropertyIds
          }
        }
      } else {
        // If portfolio has no properties, return no results
        finalWhere.property_id = {
          in: []
        }
      }
    }

    // Apply search OR conditions — must happen after all other filter mutations
    if (query.search && query.search.trim()) {
      if (searchOrConditions.length > 0) {
        finalWhere = { ...finalWhere, OR: searchOrConditions }
      } else {
        // Search term provided but nothing matched — force empty result set
        finalWhere = { ...finalWhere, id: { in: [] } }
      }
    }

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.auditRepository.findAll(
        { where: finalWhere, skip, take, orderBy },
        Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
      ),
      this.auditRepository.count(
        finalWhere,
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
    // Get audit access level to determine behavior
    const auditPermission = user.role.audit_permission

    // If audit access level is 'none', return empty result
    if (!auditPermission || auditPermission.access_level === 'none') {
      return []
    }

    // Determine accessible property IDs based on audit access level
    let accessiblePropertyIds: string[] | 'all'

    if (auditPermission.access_level === 'all') {
      // If audit access is 'all', show all audits
      accessiblePropertyIds = 'all'
    } else {
      // If audit access is 'partial', rely on property access level and accessed property list
      accessiblePropertyIds =
        await this.permissionService.getAccessibleResourceIds(
          user,
          ModuleType.PROPERTY
        )

      // If user has no accessible properties, return empty result
      if (
        Array.isArray(accessiblePropertyIds) &&
        accessiblePropertyIds.length === 0
      ) {
        return []
      }
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.batch_id) {
      additionalFilters.batch_id = query.batch_id
    }
    if (query.type_of_ota) {
      // Since type_of_ota is now an array, use "has" operator to check if array contains value
      additionalFilters.type_of_ota = { has: query.type_of_ota }
    }
    if (query.audit_status_id) {
      additionalFilters.audit_status_id = query.audit_status_id
    }
    if (query.property_id) {
      additionalFilters.property_id = query.property_id
    }
    if (query.portfolio_id) {
      additionalFilters.portfolio_id = query.portfolio_id
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

    // For MongoDB: pre-query all searchable relations since Prisma MongoDB
    // does not support nested relation filters or contains on enum fields
    const searchOrConditions: any[] = []
    if (query.search && query.search.trim()) {
      const searchTerm = query.search.trim()

      const [matchingProperties, matchingBatches, matchingStatuses] =
        await Promise.all([
          this.prisma.property.findMany({
            where: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                {
                  credentials: {
                    expedia_id: { contains: searchTerm, mode: 'insensitive' }
                  }
                }
              ]
            },
            select: { id: true }
          }),
          this.prisma.auditBatch.findMany({
            where: { batch_no: { contains: searchTerm, mode: 'insensitive' } },
            select: { id: true }
          }),
          this.prisma.auditStatus.findMany({
            where: { status: { contains: searchTerm, mode: 'insensitive' } },
            select: { id: true }
          })
        ])

      if (matchingProperties.length > 0) {
        searchOrConditions.push({
          property_id: { in: matchingProperties.map(p => p.id) }
        })
      }
      if (matchingBatches.length > 0) {
        searchOrConditions.push({
          batch_id: { in: matchingBatches.map(b => b.id) }
        })
      }
      if (matchingStatuses.length > 0) {
        searchOrConditions.push({
          audit_status_id: { in: matchingStatuses.map(s => s.id) }
        })
      }
    }

    // Configuration for query builder
    // searchFields is empty — search is handled via pre-queries above since
    // MongoDB does not support contains on relation paths or enum array fields
    const queryConfig = {
      searchFields: [],
      filterableFields: [
        'batch_id',
        'type_of_ota',
        'audit_status_id',
        'property_id',
        'portfolio_id',
        'is_archived'
      ],
      sortableFields: [
        'created_at',
        'updated_at',
        'type_of_ota',
        'amount_collectable',
        'amount_confirmed',
        'expedia_amount_collectable',
        'expedia_amount_confirmed',
        'agoda_amount_collectable',
        'agoda_amount_confirmed',
        'booking_amount_collectable',
        'booking_amount_confirmed',
        'is_archived'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        property_name: 'property.name',
        audit_status: 'auditStatus.status',
        expedia_id: 'property.credentials.expedia_id',
        portfolio_id: 'property.portfolio_id'
      }
    }

    // Build base where clause (access scope only)
    const baseWhere: any =
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

    // Add expedia_id filter if provided
    let finalWhere = where
    if (query.expedia_id) {
      finalWhere = {
        ...where,
        property: {
          credentials: {
            expedia_id: {
              contains: query.expedia_id,
              mode: 'insensitive'
            }
          }
        }
      }
    }

    // Add status filter if provided (supports categories: pending/upcoming/completed or comma-separated status IDs)
    if (query.status) {
      const statusIds = await this.resolveStatusIds(query.status)

      if (statusIds && statusIds.length > 0) {
        finalWhere = {
          ...finalWhere,
          audit_status_id: {
            in: statusIds
          }
        }
      }
    }

    // Add portfolio_id filter if provided
    if (query.portfolio_id) {
      // Find all properties in the specified portfolio
      const portfolioProperties = await this.prisma.property.findMany({
        where: {
          portfolio_id: query.portfolio_id
        },
        select: {
          id: true
        }
      })

      if (portfolioProperties.length > 0) {
        const portfolioPropertyIds = portfolioProperties.map(p => p.id)

        // Add property filter to intersect with existing property filters
        if (finalWhere.property_id && finalWhere.property_id.in) {
          // Intersect with existing property IDs
          finalWhere.property_id.in = finalWhere.property_id.in.filter(
            (id: string) => portfolioPropertyIds.includes(id)
          )
        } else {
          // Set property ID filter to portfolio properties
          finalWhere.property_id = {
            in: portfolioPropertyIds
          }
        }
      } else {
        // If portfolio has no properties, return no results
        finalWhere.property_id = {
          in: []
        }
      }
    }

    // Apply search OR conditions — must happen after all other filter mutations
    if (query.search && query.search.trim()) {
      if (searchOrConditions.length > 0) {
        finalWhere = { ...finalWhere, OR: searchOrConditions }
      } else {
        // Search term provided but nothing matched — force empty result set
        finalWhere = { ...finalWhere, id: { in: [] } }
      }
    }

    // Fetch all data without pagination
    const data = await this.auditRepository.findAll(
      { where: finalWhere, orderBy },
      Array.isArray(accessiblePropertyIds) ? accessiblePropertyIds : undefined
    )

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check if user has permission to view this audit
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    }

    return audit
  }

  async update(id: string, data: UpdateAuditDto, user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Only super admins and internal users can update audits
    if (!isUserSuperAdmin(user) && !isInternalUser(user)) {
      throw new ForbiddenException('External users cannot update audits')
    }

    // Check if user has permission to update this audit
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    }

    // Check amount_confirmed update restriction for non-super-admin internal users
    if (!isUserSuperAdmin(user)) {
      // For each OTA type, check if the amount_confirmed is already set
      if (
        data.expedia_amount_confirmed !== undefined &&
        data.expedia_amount_confirmed !== null
      ) {
        if (
          audit.expedia_amount_confirmed !== null &&
          audit.expedia_amount_confirmed !== undefined
        ) {
          throw new BadRequestException(
            'Expedia amount confirmed is already set for this audit. Only super admins can update it once it has been set.'
          )
        }
      }
      if (
        data.agoda_amount_confirmed !== undefined &&
        data.agoda_amount_confirmed !== null
      ) {
        if (
          audit.agoda_amount_confirmed !== null &&
          audit.agoda_amount_confirmed !== undefined
        ) {
          throw new BadRequestException(
            'Agoda amount confirmed is already set for this audit. Only super admins can update it once it has been set.'
          )
        }
      }
      if (
        data.booking_amount_confirmed !== undefined &&
        data.booking_amount_confirmed !== null
      ) {
        if (
          audit.booking_amount_confirmed !== null &&
          audit.booking_amount_confirmed !== undefined
        ) {
          throw new BadRequestException(
            'Booking amount confirmed is already set for this audit. Only super admins can update it once it has been set.'
          )
        }
      }
    }

    // Validate batch_id if provided
    if (data.batch_id !== undefined && data.batch_id !== null) {
      const batch = await this.auditBatchRepository.findById(data.batch_id)
      if (!batch) {
        throw new NotFoundException(
          `Audit batch with ID ${data.batch_id} not found`
        )
      }
    }

    // Check if status is changing and send email notification
    if (
      data.audit_status_id &&
      data.audit_status_id !== audit.audit_status_id
    ) {
      await this.sendAuditStatusChangeNotification(audit, data.audit_status_id)
    }

    // Round amount fields to 2 decimal places if provided
    const updateData = {
      ...data,
      expedia_amount_collectable:
        data.expedia_amount_collectable !== undefined &&
        data.expedia_amount_collectable !== null
          ? (roundToDecimals(data.expedia_amount_collectable) ?? undefined)
          : data.expedia_amount_collectable,
      expedia_amount_confirmed:
        data.expedia_amount_confirmed !== undefined &&
        data.expedia_amount_confirmed !== null
          ? (roundToDecimals(data.expedia_amount_confirmed) ?? undefined)
          : data.expedia_amount_confirmed,
      agoda_amount_collectable:
        data.agoda_amount_collectable !== undefined &&
        data.agoda_amount_collectable !== null
          ? (roundToDecimals(data.agoda_amount_collectable) ?? undefined)
          : data.agoda_amount_collectable,
      agoda_amount_confirmed:
        data.agoda_amount_confirmed !== undefined &&
        data.agoda_amount_confirmed !== null
          ? (roundToDecimals(data.agoda_amount_confirmed) ?? undefined)
          : data.agoda_amount_confirmed,
      booking_amount_collectable:
        data.booking_amount_collectable !== undefined &&
        data.booking_amount_collectable !== null
          ? (roundToDecimals(data.booking_amount_collectable) ?? undefined)
          : data.booking_amount_collectable,
      booking_amount_confirmed:
        data.booking_amount_confirmed !== undefined &&
        data.booking_amount_confirmed !== null
          ? (roundToDecimals(data.booking_amount_confirmed) ?? undefined)
          : data.booking_amount_confirmed
    }

    return this.auditRepository.update(id, updateData)
  }

  async requestUpdateAmountConfirmed(
    id: string,
    data: RequestUpdateAmountConfirmedDto,
    user: IUserWithPermissions
  ) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Only external users should use this endpoint
    // Super admins and internal users can update directly
    if (isUserSuperAdmin(user) || isInternalUser(user)) {
      throw new BadRequestException(
        'Only external users can request amount confirmed updates. Internal users and super admins can update directly.'
      )
    }

    // Check if user has permission to request update for this audit
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    }

    // Validate that at least one amount is provided
    const hasAnyAmount =
      data.expedia_amount_confirmed !== undefined ||
      data.agoda_amount_confirmed !== undefined ||
      data.booking_amount_confirmed !== undefined

    if (!hasAnyAmount) {
      throw new BadRequestException(
        'At least one OTA amount confirmed must be provided.'
      )
    }

    // Check if any of the requested amounts are already set
    const alreadySetAmounts: string[] = []
    if (
      data.expedia_amount_confirmed !== undefined &&
      audit.expedia_amount_confirmed !== null &&
      audit.expedia_amount_confirmed !== undefined
    ) {
      alreadySetAmounts.push('Expedia')
    }
    if (
      data.agoda_amount_confirmed !== undefined &&
      audit.agoda_amount_confirmed !== null &&
      audit.agoda_amount_confirmed !== undefined
    ) {
      alreadySetAmounts.push('Agoda')
    }
    if (
      data.booking_amount_confirmed !== undefined &&
      audit.booking_amount_confirmed !== null &&
      audit.booking_amount_confirmed !== undefined
    ) {
      alreadySetAmounts.push('Booking')
    }

    if (alreadySetAmounts.length > 0) {
      throw new BadRequestException(
        `The following amounts are already set for this audit: ${alreadySetAmounts.join(', ')}. You cannot request an update for these.`
      )
    }

    const existingPendingForAudit =
      await this.pendingActionRepository.findByAuditId(id)
    if (existingPendingForAudit.length > 0) {
      throw new BadRequestException(
        'There is already a pending update request for this audit. Please wait for it to be approved or rejected.'
      )
    }

    // Create the pending action with rounded amounts
    const auditUpdateData: any = {}
    if (data.expedia_amount_confirmed !== undefined) {
      auditUpdateData.expedia_amount_confirmed =
        roundToDecimals(data.expedia_amount_confirmed) ??
        data.expedia_amount_confirmed
    }
    if (data.agoda_amount_confirmed !== undefined) {
      auditUpdateData.agoda_amount_confirmed =
        roundToDecimals(data.agoda_amount_confirmed) ??
        data.agoda_amount_confirmed
    }
    if (data.booking_amount_confirmed !== undefined) {
      auditUpdateData.booking_amount_confirmed =
        roundToDecimals(data.booking_amount_confirmed) ??
        data.booking_amount_confirmed
    }

    const pendingAction = await this.pendingActionRepository.create({
      resource_type: 'audit',
      audit_id: id,
      action_type: PendingActionType.AUDIT_UPDATE_AMOUNT_CONFIRMED,
      requested_user_id: user.id,
      audit_update_data: auditUpdateData,
      reason: data.reason
    })
    void this.emailUtil.notifySuperAdminsOfPendingActionRequest(pendingAction.id)

    return {
      message:
        'Update request submitted for approval. A super admin will review your request.',
      pending_action: pendingAction
    }
  }

  async archive(id: string, user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Only super admins and internal users can archive audits
    if (!isUserSuperAdmin(user) && !isInternalUser(user)) {
      throw new ForbiddenException('External users cannot archive audits')
    }

    // Check if user has permission to archive this audit
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    }

    // Check if audit is already archived
    if (audit.is_archived) {
      throw new BadRequestException('Audit is already archived')
    }

    // Get the audit status
    const auditStatus = audit.auditStatus.status

    // Check if audit can be archived based on status
    if (!canArchiveAudit(auditStatus)) {
      const errorMessage = getArchiveErrorMessage(auditStatus)
      throw new BadRequestException(errorMessage)
    }

    // If all validations pass, archive the audit
    return this.auditRepository.archive(id)
  }

  async bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkUpdateResultDto> {
    // Only super admins and internal users can bulk update audits
    if (!isUserSuperAdmin(user) && !isInternalUser(user)) {
      throw new ForbiddenException('External users cannot bulk update audits')
    }

    if (!file) {
      throw new BadRequestException('No file provided')
    }

    validateSpreadsheetFile(file)

    const result: BulkUpdateResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulUpdates: []
    }

    try {
      const data = parseSpreadsheetToJson(file)
      result.totalRows = data.length

      // Helper function to find header value with flexible naming
      // Handles column names with asterisks (e.g., "Property*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
          }
        }

        return undefined
      }

      // Helper function to get raw value (preserves type for dates and numbers)
      // Handles column names with asterisks (e.g., "Property*")
      const getRawValue = (row: any, possibleNames: string[]): any => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return value
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return value
              }
            }
          }
        }

        return undefined
      }

      // Helper function to parse date in mm/dd/yyyy format or Excel serial number
      const parseDate = (dateValue: any): Date | null => {
        if (!dateValue) return null

        try {
          // If it's already a Date object, return it
          if (dateValue instanceof Date) {
            if (!isNaN(dateValue.getTime())) {
              return dateValue
            }
            return null
          }

          // If it's a number (Excel serial date), convert it
          if (typeof dateValue === 'number') {
            // Excel stores dates as days since January 1, 1900
            // Excel has a bug where it considers 1900 a leap year, so we use December 30, 1899 as epoch
            const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
            const date = new Date(
              excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000
            )
            if (
              !isNaN(date.getTime()) &&
              date.getFullYear() >= 1900 &&
              date.getFullYear() <= 2100
            ) {
              return date
            }
            return null
          }

          // Convert to string for string parsing
          const dateString = String(dateValue)

          // Try to parse mm/dd/yyyy format
          const parts = dateString.trim().split('/')
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10)
            const day = parseInt(parts[1], 10)
            const year = parseInt(parts[2], 10)

            if (
              !isNaN(month) &&
              !isNaN(day) &&
              !isNaN(year) &&
              year >= 1900 &&
              year <= 2100
            ) {
              return new Date(year, month - 1, day)
            }
          }

          // Try to parse as ISO date
          const date = new Date(dateString)
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() >= 1900 &&
            date.getFullYear() <= 2100
          ) {
            return date
          }

          return null
        } catch {
          return null
        }
      }

      // Helper function to parse OTA type
      const parseOtaType = (otaString: string): OtaType | null => {
        if (!otaString) return null

        const normalized = otaString.toLowerCase().trim()
        switch (normalized) {
          case 'expedia':
          case 'exp':
            return OtaType.expedia
          case 'agoda':
          case 'ago':
            return OtaType.agoda
          case 'booking':
          case 'booking.com':
            return OtaType.booking
          default:
            return null
        }
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract audit ID (required)
          const auditIdValue = findHeaderValue(row, [
            'Audit ID',
            'Audit Id',
            'Audit id',
            'audit_id',
            'ID',
            'Id',
            'id'
          ])

          if (!auditIdValue) {
            result.errors.push({
              row: rowNumber,
              auditId: 'Unknown',
              error: 'Audit ID is required'
            })
            result.failureCount++
            continue
          }

          // Validate MongoDB ObjectId format
          if (!QueryBuilder.isValidObjectId(auditIdValue)) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error:
                'Invalid audit ID format (must be a valid MongoDB ObjectId)'
            })
            result.failureCount++
            continue
          }

          // Find existing audit
          const existingAudit =
            await this.auditRepository.findById(auditIdValue)
          if (!existingAudit) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error: 'Audit not found'
            })
            result.failureCount++
            continue
          }

          // Check if user has permission to update this audit
          // For partial access, check property ownership instead of audit ownership
          try {
            const auditPermission = user.role.audit_permission

            // If user has partial audit access, check if they have access to the property
            if (auditPermission?.access_level === AccessLevel.partial) {
              const propertyId = existingAudit.property_id
              const hasPropertyAccess =
                await this.permissionService.canAccessResource(
                  user,
                  ModuleType.PROPERTY,
                  propertyId
                )

              if (!hasPropertyAccess) {
                result.errors.push({
                  row: rowNumber,
                  auditId: auditIdValue,
                  error:
                    'Access denied: You do not have access to the property associated with this audit'
                })
                result.failureCount++
                continue
              }
            } else {
              // For non-partial access, use standard permission check
              await this.permissionService.requirePermission(
                user,
                ModuleType.AUDIT,
                PermissionAction.UPDATE
              )
            }
          } catch (error) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error:
                error.message ||
                'You do not have permission to update this audit'
            })
            result.failureCount++
            continue
          }

          // Prepare update data (only include fields that have values)
          const updateData: any = {}

          // Extract property name (if provided, find the property)
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Property',
            'Name'
          ])
          if (propertyName) {
            const property =
              await this.propertyRepository.findByName(propertyName)
            if (!property) {
              result.errors.push({
                row: rowNumber,
                auditId: auditIdValue,
                error: `Property '${propertyName}' not found`
              })
              result.failureCount++
              continue
            }
            updateData.property_id = property.id
          }

          // Extract OTA type (if provided) - can be comma-separated values
          const otaTypeValue = findHeaderValue(row, [
            'OTA',
            'OTA Type',
            'Ota Type',
            'Ota type',
            'type_of_ota'
          ])
          if (otaTypeValue) {
            // Handle comma-separated multiple OTA types
            const otaTypesArray = otaTypeValue
              .split(',')
              .map(s => s.trim())
              .filter(s => s)
            const parsedOtaTypes: OtaType[] = []

            for (const otaStr of otaTypesArray) {
              const typeOfOta = parseOtaType(otaStr)
              if (typeOfOta && !parsedOtaTypes.includes(typeOfOta)) {
                parsedOtaTypes.push(typeOfOta)
              }
            }

            if (parsedOtaTypes.length > 0) {
              updateData.type_of_ota = parsedOtaTypes
            }
          }

          // Extract audit status (if provided)
          const auditStatusValue = findHeaderValue(row, [
            'Audit Status',
            'Status To',
            'Status to',
            'Status'
          ])
          if (auditStatusValue) {
            // Find or create audit status
            let auditStatus =
              await this.auditStatusRepository.findByStatus(auditStatusValue)
            if (!auditStatus) {
              // Create new audit status
              auditStatus = await this.auditStatusRepository.create({
                status: auditStatusValue
              })
            }
            updateData.audit_status_id = auditStatus.id
          }

          // Extract Expedia amount collectable (if provided)
          const expediaAmountCollectableValue = findHeaderValue(row, [
            'Expedia Amount Collectable',
            'Expedia Collectable',
            'expedia_amount_collectable'
          ])
          if (expediaAmountCollectableValue) {
            const expediaAmountCollectable = parseFloat(
              expediaAmountCollectableValue
            )
            if (!isNaN(expediaAmountCollectable)) {
              updateData.expedia_amount_collectable = roundToDecimals(
                expediaAmountCollectable
              )
            }
          }

          // Extract Expedia amount confirmed (if provided)
          const expediaAmountConfirmedValue = findHeaderValue(row, [
            'Expedia Amount Confirmed',
            'Expedia Confirmed',
            'expedia_amount_confirmed'
          ])
          if (expediaAmountConfirmedValue) {
            const expediaAmountConfirmed = parseFloat(
              expediaAmountConfirmedValue
            )
            if (!isNaN(expediaAmountConfirmed)) {
              // Check expedia_amount_confirmed update restriction for non-super-admin internal users
              if (!isUserSuperAdmin(user)) {
                if (
                  existingAudit.expedia_amount_confirmed !== null &&
                  existingAudit.expedia_amount_confirmed !== undefined
                ) {
                  result.errors.push({
                    row: rowNumber,
                    auditId: auditIdValue,
                    error:
                      'Expedia amount confirmed is already set for this audit. Only super admins can update it once it has been set.'
                  })
                  result.failureCount++
                  continue
                }
              }
              updateData.expedia_amount_confirmed = roundToDecimals(
                expediaAmountConfirmed
              )
            }
          }

          // Extract Agoda amount collectable (if provided)
          const agodaAmountCollectableValue = findHeaderValue(row, [
            'Agoda Amount Collectable',
            'Agoda Collectable',
            'agoda_amount_collectable'
          ])
          if (agodaAmountCollectableValue) {
            const agodaAmountCollectable = parseFloat(
              agodaAmountCollectableValue
            )
            if (!isNaN(agodaAmountCollectable)) {
              updateData.agoda_amount_collectable = roundToDecimals(
                agodaAmountCollectable
              )
            }
          }

          // Extract Agoda amount confirmed (if provided)
          const agodaAmountConfirmedValue = findHeaderValue(row, [
            'Agoda Amount Confirmed',
            'Agoda Confirmed',
            'agoda_amount_confirmed'
          ])
          if (agodaAmountConfirmedValue) {
            const agodaAmountConfirmed = parseFloat(agodaAmountConfirmedValue)
            if (!isNaN(agodaAmountConfirmed)) {
              // Check agoda_amount_confirmed update restriction for non-super-admin internal users
              if (!isUserSuperAdmin(user)) {
                if (
                  existingAudit.agoda_amount_confirmed !== null &&
                  existingAudit.agoda_amount_confirmed !== undefined
                ) {
                  result.errors.push({
                    row: rowNumber,
                    auditId: auditIdValue,
                    error:
                      'Agoda amount confirmed is already set for this audit. Only super admins can update it once it has been set.'
                  })
                  result.failureCount++
                  continue
                }
              }
              updateData.agoda_amount_confirmed =
                roundToDecimals(agodaAmountConfirmed)
            }
          }

          // Extract Booking amount collectable (if provided)
          const bookingAmountCollectableValue = findHeaderValue(row, [
            'Booking Amount Collectable',
            'Booking Collectable',
            'booking_amount_collectable'
          ])
          if (bookingAmountCollectableValue) {
            const bookingAmountCollectable = parseFloat(
              bookingAmountCollectableValue
            )
            if (!isNaN(bookingAmountCollectable)) {
              updateData.booking_amount_collectable = roundToDecimals(
                bookingAmountCollectable
              )
            }
          }

          // Extract Booking amount confirmed (if provided)
          const bookingAmountConfirmedValue = findHeaderValue(row, [
            'Booking Amount Confirmed',
            'Booking Confirmed',
            'booking_amount_confirmed'
          ])
          if (bookingAmountConfirmedValue) {
            const bookingAmountConfirmed = parseFloat(
              bookingAmountConfirmedValue
            )
            if (!isNaN(bookingAmountConfirmed)) {
              // Check booking_amount_confirmed update restriction for non-super-admin internal users
              if (!isUserSuperAdmin(user)) {
                if (
                  existingAudit.booking_amount_confirmed !== null &&
                  existingAudit.booking_amount_confirmed !== undefined
                ) {
                  result.errors.push({
                    row: rowNumber,
                    auditId: auditIdValue,
                    error:
                      'Booking amount confirmed is already set for this audit. Only super admins can update it once it has been set.'
                  })
                  result.failureCount++
                  continue
                }
              }
              updateData.booking_amount_confirmed = roundToDecimals(
                bookingAmountConfirmed
              )
            }
          }

          // Extract report URL (if provided)
          const reportUrl = findHeaderValue(row, [
            'Report URL',
            'Report url',
            'report_url',
            'Report',
            'URL'
          ])
          if (reportUrl) {
            updateData.report_url = reportUrl
          }

          // Extract review collection date (if provided) - use raw value to preserve Excel date format
          const reviewCollectionDateValue = getRawValue(row, [
            'Review/Collection Date',
            'Review/collection date',
            'Review Collection Date',
            'Review collection date',
            'Review collection Date',
            'review_collection_date'
          ])
          if (reviewCollectionDateValue) {
            const reviewCollectionDate = parseDate(reviewCollectionDateValue)
            if (!reviewCollectionDate) {
              result.errors.push({
                row: rowNumber,
                auditId: auditIdValue,
                error: 'Invalid review collection date format (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
            updateData.review_collection_date =
              reviewCollectionDate.toISOString()
          }

          // Extract batch (optional)
          const batchValue = findHeaderValue(row, ['Batch', 'Batch No'])
          if (batchValue) {
            // Find or create batch
            let batch = await this.prisma.auditBatch.findFirst({
              where: { batch_no: batchValue }
            })

            if (!batch) {
              batch = await this.prisma.auditBatch.create({
                data: { batch_no: batchValue }
              })
            }

            updateData.batch_id = batch.id
          }

          // Only update if there's something to update
          if (Object.keys(updateData).length === 0) {
            result.errors.push({
              row: rowNumber,
              auditId: auditIdValue,
              error: 'No fields to update (all fields are empty)'
            })
            result.failureCount++
            continue
          }

          // Update the audit
          await this.auditRepository.update(auditIdValue, updateData)

          result.successCount++
          result.successfulUpdates.push(auditIdValue)
        } catch (error) {
          const auditIdValue =
            findHeaderValue(row, [
              'Audit ID',
              'Audit Id',
              'Audit id',
              'audit_id',
              'ID',
              'Id',
              'id'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            auditId: auditIdValue,
            error: error.message || 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }

  async unarchive(id: string, user: IUserWithPermissions) {
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check if user has permission to unarchive this audit
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    }

    // Check if audit is not archived
    if (!audit.is_archived) {
      throw new BadRequestException('Audit is not archived')
    }

    // Unarchive the audit (no conditions to check)
    return this.auditRepository.unarchive(id)
  }

  async bulkArchive(data: BulkArchiveAuditDto, user: IUserWithPermissions) {
    // Only internal users can bulk archive audits
    if (!isInternalUser(user)) {
      throw new BadRequestException(
        'Only internal users can bulk archive audits'
      )
    }

    const { audit_ids } = data

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    // Fetch all audits
    const audits = await this.auditRepository.findByIds(audit_ids)

    const successfulIds: string[] = []
    const failedAudits: Array<{ id: string; reason: string }> = []

    // Check each audit individually
    for (const auditId of audit_ids) {
      const audit = audits.find(a => a.id === auditId)

      // Audit not found
      if (!audit) {
        failedAudits.push({
          id: auditId,
          reason: 'Audit not found'
        })
        continue
      }

      // Check if user has permission to archive this audit
      // For partial access, check property ownership
      const auditPermission = user.role.audit_permission
      if (auditPermission?.access_level === AccessLevel.partial) {
        const hasPropertyAccess =
          await this.permissionService.canAccessResource(
            user,
            ModuleType.PROPERTY,
            audit.property_id
          )

        if (!hasPropertyAccess) {
          failedAudits.push({
            id: auditId,
            reason:
              'Access denied: You do not have access to the property associated with this audit'
          })
          continue
        }
      }

      // Already archived
      if (audit.is_archived) {
        failedAudits.push({
          id: auditId,
          reason: 'Audit is already archived'
        })
        continue
      }

      // Check if can be archived based on status
      const auditStatus = audit.auditStatus.status
      if (!canArchiveAudit(auditStatus)) {
        const errorMessage = getArchiveErrorMessage(auditStatus)
        failedAudits.push({
          id: auditId,
          reason: errorMessage
        })
        continue
      }

      // Passed all validations
      successfulIds.push(auditId)
    }

    // Archive all successful audits
    let archivedCount = 0
    if (successfulIds.length > 0) {
      const result = await this.auditRepository.bulkArchive(successfulIds)
      archivedCount = result.count
    }

    return {
      message: `Successfully archived ${archivedCount} audit(s), ${failedAudits.length} failed`,
      successfully_archived: archivedCount,
      failed_to_archive: failedAudits.length,
      failed_audits: failedAudits
    }
  }

  async bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkImportResultDto> {
    // Only internal users can bulk import audits
    if (!isInternalUser(user)) {
      throw new BadRequestException(
        'Only internal users can bulk import audits'
      )
    }

    if (!file) {
      throw new BadRequestException('No file provided')
    }

    validateSpreadsheetFile(file)

    const result: BulkImportResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulImports: []
    }

    try {
      const data = parseSpreadsheetToJson(file)
      result.totalRows = data.length

      // Helper function to find header value with flexible naming
      // Handles column names with asterisks (e.g., "Property*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
          }
        }

        return undefined
      }

      // Helper function to get raw value (preserves type for dates and numbers)
      // Handles column names with asterisks (e.g., "Property*")
      const getRawValue = (row: any, possibleNames: string[]): any => {
        // First, try to find exact matches
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return value
          }
        }

        // If no exact match, try matching by removing asterisks from Excel column names
        const rowKeys = Object.keys(row)
        for (const name of possibleNames) {
          for (const key of rowKeys) {
            // Remove asterisk and trim from the Excel column name
            const cleanKey = key.split('*')[0].trim()
            if (cleanKey.toLowerCase() === name.toLowerCase()) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return value
              }
            }
          }
        }

        return undefined
      }

      // Helper function to parse date in mm/dd/yyyy format or Excel serial number
      const parseDate = (dateValue: any): Date | null => {
        if (!dateValue) return null

        try {
          // If it's already a Date object, return it
          if (dateValue instanceof Date) {
            if (!isNaN(dateValue.getTime())) {
              return dateValue
            }
            return null
          }

          // If it's a number (Excel serial date), convert it
          if (typeof dateValue === 'number') {
            // Excel stores dates as days since January 1, 1900
            // Excel has a bug where it considers 1900 a leap year, so we use December 30, 1899 as epoch
            const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
            const date = new Date(
              excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000
            )
            if (
              !isNaN(date.getTime()) &&
              date.getFullYear() >= 1900 &&
              date.getFullYear() <= 2100
            ) {
              return date
            }
            return null
          }

          // Convert to string for string parsing
          const dateString = String(dateValue)

          // Try to parse mm/dd/yyyy format
          const parts = dateString.trim().split('/')
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10)
            const day = parseInt(parts[1], 10)
            const year = parseInt(parts[2], 10)

            if (
              !isNaN(month) &&
              !isNaN(day) &&
              !isNaN(year) &&
              year >= 1900 &&
              year <= 2100
            ) {
              return new Date(year, month - 1, day)
            }
          }

          // Try to parse as ISO date
          const date = new Date(dateString)
          if (
            !isNaN(date.getTime()) &&
            date.getFullYear() >= 1900 &&
            date.getFullYear() <= 2100
          ) {
            return date
          }

          return null
        } catch {
          return null
        }
      }

      // Helper function to parse OTA type
      const parseOtaType = (otaString: string): OtaType | null => {
        if (!otaString) return null

        const normalized = otaString.toLowerCase().trim()
        switch (normalized) {
          case 'expedia':
          case 'exp':
            return OtaType.expedia
          case 'agoda':
          case 'ago':
            return OtaType.agoda
          case 'booking':
          case 'booking.com':
          case 'book':
            return OtaType.booking
          default:
            return null
        }
      }

      // Log available columns for debugging
      if (data.length > 0) {
        const firstRow = data[0]
        const availableColumns = Object.keys(firstRow)
        console.log(
          'Available Excel columns:',
          JSON.stringify(availableColumns)
        )
        console.log(
          'Sample first row values:',
          JSON.stringify(firstRow, null, 2)
        )
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract Expedia ID (required)
          const expediaId = findHeaderValue(row, [
            'Expedia ID',
            'Expedia Id',
            'Expedia id',
            'expedia_id'
          ])

          // Debug log
          console.log(
            `Row ${rowNumber}: expediaId =`,
            expediaId,
            'from row:',
            JSON.stringify(row)
          )

          if (!expediaId) {
            result.errors.push({
              row: rowNumber,
              audit: 'Unknown',
              error:
                'Expedia ID is required. Available columns: ' +
                Object.keys(row).join(', ')
            })
            result.failureCount++
            continue
          }

          // Find property by Expedia ID
          const property =
            await this.propertyRepository.findByExpediaId(expediaId)
          if (!property) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Property with Expedia ID '${expediaId}' not found in database`
            )
            result.errors.push({
              row: rowNumber,
              audit: expediaId,
              error: 'Property not found with this Expedia ID'
            })
            result.failureCount++
            continue
          }

          // Extract OTA type - can be comma-separated values
          const otaTypeValue = findHeaderValue(row, [
            'OTA',
            'OTA Type',
            'Ota Type',
            'Ota type',
            'type_of_ota'
          ])

          const typeOfOtaArray: OtaType[] = []
          if (otaTypeValue) {
            const otaTypesArray = otaTypeValue
              .split(',')
              .map(s => s.trim())
              .filter(s => s)
            for (const otaStr of otaTypesArray) {
              const parsedType = parseOtaType(otaStr)
              if (parsedType && !typeOfOtaArray.includes(parsedType)) {
                typeOfOtaArray.push(parsedType)
              }
            }
          }

          // Extract audit status
          const auditStatusValue = findHeaderValue(row, [
            'Audit Status',
            'Audit status',
            'Status',
            'audit_status_id'
          ])
          if (!auditStatusValue) {
            console.log(
              '\x1b[31m%s\x1b[0m',
              `❌ Row ${rowNumber} FAILED: Audit status is required`
            )
            result.errors.push({
              row: rowNumber,
              audit: expediaId,
              error: 'Audit status is required'
            })
            result.failureCount++
            continue
          }

          // Find or create audit status
          let auditStatus =
            await this.auditStatusRepository.findByStatus(auditStatusValue)
          if (!auditStatus) {
            // Create new audit status
            auditStatus = await this.auditStatusRepository.create({
              status: auditStatusValue
            })
          }

          // Extract Expedia amount collectable
          const expediaAmountCollectableValue = findHeaderValue(row, [
            'Expedia Amount Collectable',
            'Expedia Collectable',
            'expedia_amount_collectable'
          ])
          const parsedExpediaCollectable = expediaAmountCollectableValue
            ? parseFloat(expediaAmountCollectableValue)
            : NaN
          const expediaAmountCollectable = !isNaN(parsedExpediaCollectable)
            ? (roundToDecimals(parsedExpediaCollectable) ?? undefined)
            : undefined

          // Extract Expedia amount confirmed
          const expediaAmountConfirmedValue = findHeaderValue(row, [
            'Expedia Amount Confirmed',
            'Expedia Confirmed',
            'expedia_amount_confirmed'
          ])
          const parsedExpediaConfirmed = expediaAmountConfirmedValue
            ? parseFloat(expediaAmountConfirmedValue)
            : NaN
          const expediaAmountConfirmed = !isNaN(parsedExpediaConfirmed)
            ? (roundToDecimals(parsedExpediaConfirmed) ?? undefined)
            : undefined

          // Extract Agoda amount collectable
          const agodaAmountCollectableValue = findHeaderValue(row, [
            'Agoda Amount Collectable',
            'Agoda Collectable',
            'agoda_amount_collectable'
          ])
          const parsedAgodaCollectable = agodaAmountCollectableValue
            ? parseFloat(agodaAmountCollectableValue)
            : NaN
          const agodaAmountCollectable = !isNaN(parsedAgodaCollectable)
            ? (roundToDecimals(parsedAgodaCollectable) ?? undefined)
            : undefined

          // Extract Agoda amount confirmed
          const agodaAmountConfirmedValue = findHeaderValue(row, [
            'Agoda Amount Confirmed',
            'Agoda Confirmed',
            'agoda_amount_confirmed'
          ])
          const parsedAgodaConfirmed = agodaAmountConfirmedValue
            ? parseFloat(agodaAmountConfirmedValue)
            : NaN
          const agodaAmountConfirmed = !isNaN(parsedAgodaConfirmed)
            ? (roundToDecimals(parsedAgodaConfirmed) ?? undefined)
            : undefined

          // Extract Booking amount collectable
          const bookingAmountCollectableValue = findHeaderValue(row, [
            'Booking Amount Collectable',
            'Booking Collectable',
            'booking_amount_collectable'
          ])
          const parsedBookingCollectable = bookingAmountCollectableValue
            ? parseFloat(bookingAmountCollectableValue)
            : NaN
          const bookingAmountCollectable = !isNaN(parsedBookingCollectable)
            ? (roundToDecimals(parsedBookingCollectable) ?? undefined)
            : undefined

          // Extract Booking amount confirmed
          const bookingAmountConfirmedValue = findHeaderValue(row, [
            'Booking Amount Confirmed',
            'Booking Confirmed',
            'booking_amount_confirmed'
          ])
          const parsedBookingConfirmed = bookingAmountConfirmedValue
            ? parseFloat(bookingAmountConfirmedValue)
            : NaN
          const bookingAmountConfirmed = !isNaN(parsedBookingConfirmed)
            ? (roundToDecimals(parsedBookingConfirmed) ?? undefined)
            : undefined

          // Extract report URL
          const reportUrl = findHeaderValue(row, [
            'Report URL',
            'Report url',
            'report_url',
            'Report',
            'URL'
          ])

          // Extract review collection date (use raw value to preserve Excel date format) - optional
          const reviewCollectionDateValue = getRawValue(row, [
            'Review/Collection Date',
            'Review/collection date',
            'Review Collection Date',
            'Review collection date',
            'Review collection Date',
            'review_collection_date'
          ])

          let reviewCollectionDate: Date | null = null
          if (reviewCollectionDateValue) {
            reviewCollectionDate = parseDate(reviewCollectionDateValue)
            if (!reviewCollectionDate) {
              console.log(
                '\x1b[31m%s\x1b[0m',
                `❌ Row ${rowNumber} FAILED: Invalid review collection date format`
              )
              result.errors.push({
                row: rowNumber,
                audit: expediaId,
                error: 'Invalid review collection date format (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
          }

          // Extract batch (optional)
          const batchValue = findHeaderValue(row, ['Batch', 'Batch No'])
          let batchId: string | undefined = undefined

          if (batchValue) {
            // Find or create batch
            let batch = await this.prisma.auditBatch.findFirst({
              where: { batch_no: batchValue }
            })

            if (!batch) {
              batch = await this.prisma.auditBatch.create({
                data: { batch_no: batchValue }
              })
            }

            batchId = batch.id
          }

          // Create audit data
          const auditData: CreateAuditDto = {
            property_id: property.id,
            audit_status_id: auditStatus.id,
            type_of_ota: typeOfOtaArray.length > 0 ? typeOfOtaArray : undefined,
            expedia_amount_collectable: expediaAmountCollectable,
            expedia_amount_confirmed: expediaAmountConfirmed,
            agoda_amount_collectable: agodaAmountCollectable,
            agoda_amount_confirmed: agodaAmountConfirmed,
            booking_amount_collectable: bookingAmountCollectable,
            booking_amount_confirmed: bookingAmountConfirmed,
            report_url: reportUrl,
            review_collection_date: reviewCollectionDate
              ? reviewCollectionDate.toISOString()
              : undefined,
            batch_id: batchId
          }

          // Create the audit
          await this.auditRepository.create(auditData)

          const auditDescription = `${expediaId} - ${typeOfOtaArray.length > 0 ? typeOfOtaArray.join(', ') : 'Unknown OTA'} Audit`
          result.successCount++
          result.successfulImports.push(auditDescription)
          console.log(
            '\x1b[32m%s\x1b[0m',
            `✅ Row ${rowNumber} SUCCESS: Created audit for Expedia ID '${expediaId}' (${typeOfOtaArray.join(', ') || 'Unknown OTA'})`
          )
        } catch (error) {
          const expediaIdValue =
            findHeaderValue(row, [
              'Expedia ID',
              'Expedia Id',
              'Expedia id',
              'expedia_id'
            ]) || 'Unknown'

          console.log(
            '\x1b[31m%s\x1b[0m',
            `❌ Row ${rowNumber} FAILED: ${error.message || 'Unknown error occurred'}`
          )
          result.errors.push({
            row: rowNumber,
            audit: expediaIdValue,
            error: error.message || 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      // Final summary report
      console.log(
        '\n\x1b[36m%s\x1b[0m',
        '========================================'
      )
      console.log('\x1b[36m%s\x1b[0m', '📊 IMPORT SUMMARY REPORT')
      console.log(
        '\x1b[36m%s\x1b[0m',
        '========================================'
      )
      console.log(
        '\x1b[33m%s\x1b[0m',
        `📝 Total Rows Processed: ${result.totalRows}`
      )
      console.log(
        '\x1b[32m%s\x1b[0m',
        `✅ Successfully Imported: ${result.successCount}`
      )
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${result.failureCount}`)

      if (result.successCount > 0) {
        console.log('\n\x1b[32m%s\x1b[0m', '✅ Successful Imports:')
        result.successfulImports.forEach((audit, idx) => {
          console.log('\x1b[32m%s\x1b[0m', `   ${idx + 1}. ${audit}`)
        })
      }

      if (result.failureCount > 0) {
        console.log('\n\x1b[31m%s\x1b[0m', '❌ Failed Imports:')
        console.table(result.errors)
      }

      console.log(
        '\x1b[36m%s\x1b[0m',
        '========================================\n'
      )

      return result
    } catch (error) {
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      )
    }
  }

  async getGlobalStats(
    user: IUserWithPermissions
  ): Promise<GlobalStatsResponseDto> {
    // Get audit access level to determine behavior
    const auditPermission = user.role.audit_permission
    const emptyStats = {
      amount_collectable: {
        total: 0,
        expedia: 0,
        booking: 0,
        agoda: 0
      },
      amount_confirmed: {
        total: 0,
        expedia: 0,
        booking: 0,
        agoda: 0
      },
      total_audit_count: 0
    }

    // If audit access level is 'none', return zeros
    if (!auditPermission || auditPermission.access_level === 'none') {
      return emptyStats
    }

    // Determine accessible property IDs based on audit access level
    let accessiblePropertyIds: string[] | 'all'

    if (auditPermission.access_level === 'all') {
      // If audit access is 'all', show stats for all audits
      accessiblePropertyIds = 'all'
    } else {
      // If audit access is 'partial', rely on property access level and accessed property list
      accessiblePropertyIds =
        await this.permissionService.getAccessibleResourceIds(
          user,
          ModuleType.PROPERTY
        )

      // If user has no accessible properties, return zeros
      if (
        Array.isArray(accessiblePropertyIds) &&
        accessiblePropertyIds.length === 0
      ) {
        return emptyStats
      }
    }

    // Build where clause for accessible properties
    const whereClause =
      accessiblePropertyIds === 'all'
        ? { is_archived: false }
        : {
            property_id: { in: accessiblePropertyIds },
            is_archived: false
          }

    // Since type_of_ota is now an array, we need to fetch all audits and process them
    const audits = await this.prisma.audit.findMany({
      where: whereClause,
      select: {
        type_of_ota: true,
        expedia_amount_collectable: true,
        expedia_amount_confirmed: true,
        agoda_amount_collectable: true,
        agoda_amount_confirmed: true,
        booking_amount_collectable: true,
        booking_amount_confirmed: true
      }
    })

    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )
    const consolidatedReportWhere =
      accessiblePortfolioIds === 'all'
        ? {}
        : { portfolio_id: { in: accessiblePortfolioIds } }
    const totalAuditCount = await this.prisma.consolidatedReport.count({
      where: consolidatedReportWhere
    })

    // Initialize amounts
    const amountCollectable = {
      total: 0,
      expedia: 0,
      booking: 0,
      agoda: 0
    }

    const amountConfirmed = {
      total: 0,
      expedia: 0,
      booking: 0,
      agoda: 0
    }

    // Process each audit and sum amounts by OTA type
    audits.forEach(audit => {
      const expediaCollectable = audit.expedia_amount_collectable || 0
      const expediaConfirmed = audit.expedia_amount_confirmed || 0
      const agodaCollectable = audit.agoda_amount_collectable || 0
      const agodaConfirmed = audit.agoda_amount_confirmed || 0
      const bookingCollectable = audit.booking_amount_collectable || 0
      const bookingConfirmed = audit.booking_amount_confirmed || 0

      // Add to each OTA type's total
      amountCollectable.expedia += expediaCollectable
      amountConfirmed.expedia += expediaConfirmed
      amountCollectable.agoda += agodaCollectable
      amountConfirmed.agoda += agodaConfirmed
      amountCollectable.booking += bookingCollectable
      amountConfirmed.booking += bookingConfirmed

      // Calculate total (sum of all OTA types)
      amountCollectable.total +=
        expediaCollectable + agodaCollectable + bookingCollectable
      amountConfirmed.total +=
        expediaConfirmed + agodaConfirmed + bookingConfirmed
    })

    // Round all amounts to 2 decimal places
    return {
      amount_collectable: {
        total: roundAmount(amountCollectable.total),
        expedia: roundAmount(amountCollectable.expedia),
        booking: roundAmount(amountCollectable.booking),
        agoda: roundAmount(amountCollectable.agoda)
      },
      amount_confirmed: {
        total: roundAmount(amountConfirmed.total),
        expedia: roundAmount(amountConfirmed.expedia),
        booking: roundAmount(amountConfirmed.booking),
        agoda: roundAmount(amountConfirmed.agoda)
      },
      total_audit_count: totalAuditCount
    }
  }

  async bulkUploadReport(
    data: BulkUploadReportDto,
    user: IUserWithPermissions
  ) {
    // Only internal users can bulk upload report URLs
    if (!isInternalUser(user)) {
      throw new BadRequestException(
        'Only internal users can bulk upload report URLs'
      )
    }

    const { audit_ids, report_url } = data

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    if (!report_url) {
      throw new BadRequestException('Report URL is required')
    }

    // Validate all audit IDs exist and user has access to them
    const audits = await this.auditRepository.findByIds(audit_ids)
    const foundIds = audits.map(a => a.id)
    const notFoundIds = audit_ids.filter((id: string) => !foundIds.includes(id))

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Audits not found with IDs: ${notFoundIds.join(', ')}`
      )
    }

    // Check if user has permission to update all audits
    // For partial access, check property ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const inaccessibleAuditIds: string[] = []

      for (const audit of audits) {
        const hasPropertyAccess =
          await this.permissionService.canAccessResource(
            user,
            ModuleType.PROPERTY,
            audit.property_id
          )

        if (!hasPropertyAccess) {
          inaccessibleAuditIds.push(audit.id)
        }
      }

      if (inaccessibleAuditIds.length > 0) {
        throw new ForbiddenException(
          `Access denied: You do not have access to the properties associated with these audits: ${inaccessibleAuditIds.join(', ')}`
        )
      }
    }

    // Update all audits with the report URL
    const result = await this.auditRepository.bulkUpdate(audit_ids, {
      report_url
    })

    return {
      message: `Successfully updated ${result.count} audit(s) with report URL`,
      updated_count: result.count,
      updated_ids: audit_ids
    }
  }

  /**
   * Send email notification when audit status changes
   */
  private async sendAuditStatusChangeNotification(
    audit: any,
    newStatusId: string
  ) {
    try {
      // Get old and new status details
      const oldStatus = await this.auditStatusRepository.findById(
        audit.audit_status_id
      )
      const newStatus = await this.auditStatusRepository.findById(newStatusId)

      if (!oldStatus || !newStatus) {
        console.error('Could not find audit status for email notification')
        return
      }

      // Get property details
      const property = await this.propertyRepository.findById(audit.property_id)

      if (!property) {
        console.error('Property not found for audit status change notification')
        return
      }

      const recipientEmails: string[] = []

      // Get portfolio details with contact_email
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: property.portfolio_id },
        select: { contact_email: true }
      })

      // Add portfolio contact email if exists
      if (portfolio?.contact_email) {
        recipientEmails.push(portfolio.contact_email)
      }

      // Generate audit name from type_of_ota array
      const auditName =
        audit.type_of_ota && audit.type_of_ota.length > 0
          ? audit.type_of_ota
              .map(
                (ota: string) => `${ota.charAt(0).toUpperCase() + ota.slice(1)}`
              )
              .join(' + ') + ' Audit'
          : 'Audit'

      // Send the email
      await this.emailUtil.sendAuditStatusChangeEmail(
        recipientEmails,
        auditName,
        oldStatus.status,
        newStatus.status,
        new Date()
      )
    } catch (error) {
      // Log the error but don't fail the status update
      console.error('Failed to send audit status change notification:', error)
    }
  }

  async remove(id: string, user: IUserWithPermissions) {
    // Validate that only super admins can delete audits
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can delete audits')
    }

    // Check if audit exists and user has permission to access it
    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check permission to access this audit
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    } else {
      // For non-partial access, use standard permission check
      await this.permissionService.requirePermission(
        user,
        ModuleType.AUDIT,
        PermissionAction.DELETE
      )
    }

    // Delete the audit
    await this.auditRepository.delete(id)

    return { message: 'Audit deleted successfully' }
  }

  async bulkDelete(data: BulkDeleteAuditDto, user: IUserWithPermissions) {
    const { audit_ids } = data

    // Validate that only super admins can delete audits
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can delete audits')
    }

    if (!audit_ids || audit_ids.length === 0) {
      throw new BadRequestException('No audit IDs provided')
    }

    // Fetch all audits
    const audits = await this.auditRepository.findByIds(audit_ids)

    const successfulIds: string[] = []
    const failedAudits: Array<{ id: string; reason: string }> = []

    // Check each audit individually
    for (const auditId of audit_ids) {
      const audit = audits.find(a => a.id === auditId)

      // Audit not found
      if (!audit) {
        failedAudits.push({
          id: auditId,
          reason: 'Audit not found'
        })
        continue
      }

      // Check if user has permission to delete this audit
      // For partial access, check property ownership
      const auditPermission = user.role.audit_permission
      if (auditPermission?.access_level === AccessLevel.partial) {
        const hasPropertyAccess =
          await this.permissionService.canAccessResource(
            user,
            ModuleType.PROPERTY,
            audit.property_id
          )

        if (!hasPropertyAccess) {
          failedAudits.push({
            id: auditId,
            reason:
              'Access denied: You do not have access to the property associated with this audit'
          })
          continue
        }
      }

      // Passed all validations
      successfulIds.push(auditId)
    }

    // Delete all successful audits
    let deletedCount = 0
    if (successfulIds.length > 0) {
      const result = await this.auditRepository.bulkDelete(successfulIds)
      deletedCount = result.count
    }

    return {
      message: `Successfully deleted ${deletedCount} audit(s), ${failedAudits.length} failed`,
      successfully_deleted: deletedCount,
      failed_to_delete: failedAudits.length,
      failed_audits: failedAudits
    }
  }

  async updateReportUrl(
    id: string,
    data: UpdateReportUrlDto,
    user: IUserWithPermissions
  ): Promise<any> {
    // Only internal users can update report URLs
    if (!isInternalUser(user)) {
      throw new BadRequestException(
        'Only internal users can update report URLs'
      )
    }

    const audit = await this.auditRepository.findById(id)

    if (!audit) {
      throw new NotFoundException('Audit not found')
    }

    // Check if user has permission to update this audit's report URL
    // For partial access, check property ownership instead of audit ownership
    const auditPermission = user.role.audit_permission
    if (auditPermission?.access_level === AccessLevel.partial) {
      const hasPropertyAccess = await this.permissionService.canAccessResource(
        user,
        ModuleType.PROPERTY,
        audit.property_id
      )

      if (!hasPropertyAccess) {
        throw new ForbiddenException(
          'Access denied: You do not have access to the property associated with this audit'
        )
      }
    }

    // Update the report URL
    await this.auditRepository.update(id, { report_url: data.report_url })

    // Return full details by fetching again with full relations
    const updatedAudit = await this.auditRepository.findById(id)

    if (!updatedAudit) {
      throw new NotFoundException('Audit not found after update')
    }

    return updatedAudit
  }

  async autoImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<AutoImportAuditResultDto> {
    this.logger.info(
      `Starting auto-import for user: ${user.email} (${user.role.name})`
    )

    if (!isInternalUser(user)) {
      this.logger.error(
        `Access denied: User ${user.email} is not an internal user`
      )
      throw new BadRequestException(
        'Only internal users can auto-import audits'
      )
    }

    if (!file) {
      this.logger.error('No file provided')
      throw new BadRequestException('No file provided')
    }

    validateSpreadsheetFile(file)

    const data = parseSpreadsheetToJson(file)
    this.logger.info(
      `File parsed successfully. Found ${data.length} data rows`
    )

    // --- Column name resolution helpers ---
    const OTA_COLS = ['OTA', 'ota', 'Ota']
    const PORTFOLIO_COLS = [
      'Portfolio',
      'portfolio',
      'Portfolio Name',
      'portfolio_name'
    ]
    const HOTEL_NAME_COLS = [
      'Hotel Name',
      'hotel name',
      'Hotel name',
      'HotelName',
      'Property Name',
      'Property',
      'property_name'
    ]
    const HOTEL_ID_COLS = [
      'Hotel ID',
      'hotel id',
      'Hotel Id',
      'HotelID',
      'hotel_id',
      'Hotel_Id'
    ]
    const CHECK_IN_COLS = [
      'Check In (MM/DD/YYYY)',
      'Check In',
      'check in',
      'Check-In',
      'CheckIn',
      'check_in'
    ]
    const CHECK_OUT_COLS = [
      'Check Out (MM/DD/YYYY)',
      'Check Out',
      'check out',
      'Check-Out',
      'CheckOut',
      'check_out'
    ]
    const AMOUNT_COLS = [
      'Amount Collected',
      'amount collected',
      'Amount_Collected',
      'amount_collected',
      'AmountCollected'
    ]
    const BATCH_COLS = ['Batch', 'Batch No', 'Batch NO', 'Batch no']
    const REVIEW_COLLECTION_DATE_COLS = [
      'Review/Collection Date',
      'Review/collection date',
      'Review Collection Date',
      'Review collection date',
      'Review collection Date',
      'review_collection_date'
    ]
    const STATUS_COLS = [
      'Status',
      'status',
      'Audit Status',
      'Audit status',
      'audit_status_id'
    ]

    const findCol = (row: any, names: string[]): string | undefined => {
      for (const name of names) {
        const val = row[name]
        if (val !== undefined && val !== null && val !== '') {
          return String(val).trim()
        }
      }
      // Try stripping asterisks / extra whitespace from actual keys
      const rowKeys = Object.keys(row)
      for (const name of names) {
        for (const key of rowKeys) {
          if (key.split('*')[0].trim().toLowerCase() === name.toLowerCase()) {
            const val = row[key]
            if (val !== undefined && val !== null && val !== '') {
              return String(val).trim()
            }
          }
        }
      }
      return undefined
    }

    const parseDate = (raw: any): Date | null => {
      if (!raw) return null

      const isValidYear = (d: Date): boolean =>
        !isNaN(d.getTime()) &&
        d.getFullYear() >= 1900 &&
        d.getFullYear() <= 2100

      const fromExcelSerial = (serial: number): Date | null => {
        const date = new Date(
          new Date(1899, 11, 30).getTime() + serial * 24 * 60 * 60 * 1000
        )
        return isValidYear(date) ? date : null
      }

      // Date object returned by xlsx for date-formatted cells
      if (raw instanceof Date) return isValidYear(raw) ? raw : null

      // Numeric Excel serial (e.g. 46087 → somewhere in 2026)
      if (typeof raw === 'number') return fromExcelSerial(raw)

      const s = String(raw).trim()

      // Slash dates: MM/DD/YYYY when unambiguous; DD/MM/YYYY when day is first (>12)
      const slashParts = s.split('/')
      if (slashParts.length === 3) {
        const [a, b, y] = slashParts.map(Number)
        if (!isNaN(a) && !isNaN(b) && !isNaN(y) && y >= 1900 && y <= 2100) {
          if (a > 12) {
            return new Date(y, b - 1, a)
          }
          if (b > 12) {
            return new Date(y, a - 1, b)
          }
          return new Date(y, a - 1, b)
        }
      }

      // Numeric string that is an Excel serial (e.g. "46087")
      // Must be handled BEFORE new Date(s) because new Date("46087") = year 46087
      const numericSerial = Number(s)
      if (Number.isInteger(numericSerial) && numericSerial > 0) {
        const result = fromExcelSerial(numericSerial)
        if (result) return result
      }

      // Generic ISO or other parseable string — guard year range to prevent
      // new Date("46087") silently producing year 46087
      const dt = new Date(s)
      return isValidYear(dt) ? dt : null
    }

    const parseAmount = (raw: any): number => {
      if (raw === undefined || raw === null || raw === '') return 0
      if (typeof raw === 'number') return raw
      // Strip any currency symbol, thousands separators, and whitespace,
      // keeping only digits, decimal point, and leading minus sign
      const cleaned = String(raw).replace(/[^\d.-]/g, '')
      const n = parseFloat(cleaned)
      return isNaN(n) ? 0 : n
    }

    const parseOta = (raw: string | undefined): OtaType | null => {
      if (!raw) return null
      const n = raw.toLowerCase().trim()
      if (n === 'expedia' || n === 'exp') return OtaType.expedia
      if (n === 'agoda' || n === 'ago') return OtaType.agoda
      if (n === 'booking' || n === 'booking.com' || n === 'book')
        return OtaType.booking
      return null
    }

    // --- Preserve original header order from first row ---
    const originalHeaders = data.length > 0 ? Object.keys(data[0]) : []

    if (data.length === 0) {
      throw new BadRequestException(
        'No valid rows found. Ensure the file has a "Hotel Name" or "Hotel ID" column with data.'
      )
    }

    // --- Row-level validation with DB lookup caches ---
    // Each row is validated individually so every error surfaces in the response.
    this.logger.info('Starting row validation and database lookups...')

    const errors: AutoImportAuditErrorDto[] = []

    // Caches to avoid repeated DB calls for the same lookup key
    const portfolioCache = new Map<string, boolean>() // name  → exists
    const propertyIdCache = new Map<string, string | null>() // lookup key → id | null
    const accessCache = new Map<string, boolean>() // id    → hasAccess

    const auditPermission = user.role.audit_permission

    // validGroups is built in this same pass so that audit creation uses only
    // rows that belong to groups that fully passed validation.
    const validGroups = new Map<
      string,
      {
        rows: any[]
        propertyId: string
        displayName: string
        batch?: string
        reviewCollectionDate?: string
        statusLabel: string
      }
    >()

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // row 1 is the header in the sheet
      const rowErrors: string[] = []

      const hotelName = findCol(row, HOTEL_NAME_COLS)
      const hotelIdRaw = findCol(row, HOTEL_ID_COLS)
      const portfolioName = findCol(row, PORTFOLIO_COLS)
      const otaRaw = findCol(row, OTA_COLS)
      const checkInRaw = findCol(row, CHECK_IN_COLS)
      const checkOutRaw = findCol(row, CHECK_OUT_COLS)
      const amountRaw = findCol(row, AMOUNT_COLS)
      const batchRaw = findCol(row, BATCH_COLS)
      const reviewCollectionDateRaw = findCol(row, REVIEW_COLLECTION_DATE_COLS)
      const statusRaw = findCol(row, STATUS_COLS)
      const statusTrimmed = statusRaw ? String(statusRaw).trim() : ''

      const hotelIdStr =
        hotelIdRaw !== undefined && hotelIdRaw !== null && hotelIdRaw !== ''
          ? hotelIdRaw.trim()
          : undefined

      const otaParsed = parseOta(otaRaw)

      const label =
        hotelName ??
        (hotelIdStr ? `${otaRaw ?? 'OTA'} ${hotelIdStr}` : 'Unknown')

      // Log row processing details
      this.logger.info(
        `Processing row ${rowNum}: Hotel="${hotelName || 'N/A'}", ` +
          `HotelID="${hotelIdStr || 'N/A'}", ` +
          `Portfolio="${portfolioName || 'N/A'}", ` +
          `OTA="${otaRaw || 'N/A'}", ` +
          `CheckIn="${checkInRaw || 'N/A'}", ` +
          `CheckOut="${checkOutRaw || 'N/A'}", ` +
          `Amount="${amountRaw || 'N/A'}", ` +
          `Batch="${batchRaw || 'N/A'}", ` +
          `ReviewCollectionDate="${reviewCollectionDateRaw || 'N/A'}", ` +
          `Status="${statusTrimmed || 'N/A'}"`
      )

      // --- Required field presence ---
      if (!hotelName && !hotelIdStr) {
        errors.push({
          row: rowNum,
          property: label,
          ota: otaRaw,
          hotel_id: hotelIdStr,
          error: 'Hotel Name or Hotel ID is missing'
        })
        continue
      }

      // --- Status (audit status name) ---
      if (!statusTrimmed) {
        rowErrors.push('Status is missing')
      }

      // --- OTA ---
      if (!otaRaw) {
        rowErrors.push('OTA is missing')
      } else if (!otaParsed) {
        rowErrors.push(
          `OTA "${otaRaw}" is not recognised. Expected: expedia, agoda, or booking`
        )
      }

      // --- Portfolio ---
      if (!portfolioName) {
        rowErrors.push('Portfolio name is missing')
      } else {
        if (!portfolioCache.has(portfolioName)) {
          const p = await this.portfolioRepository.findByName(portfolioName)
          portfolioCache.set(portfolioName, !!p)
        }
        if (!portfolioCache.get(portfolioName)) {
          rowErrors.push(
            `Portfolio "${portfolioName}" not found in the database`
          )
        }
      }

      // --- Property: OTA + Hotel ID (credentials) preferred; else Hotel Name ---
      let propertyId: string | undefined

      if (hotelIdStr && otaParsed) {
        const cacheKey = `credentials:${otaParsed}:${hotelIdStr}`
        if (!propertyIdCache.has(cacheKey)) {
          let p: Property | null = null
          if (otaParsed === OtaType.expedia) {
            p = await this.propertyRepository.findByExpediaId(hotelIdStr)
          } else if (otaParsed === OtaType.agoda) {
            p = await this.propertyRepository.findByAgodaId(hotelIdStr)
          } else if (otaParsed === OtaType.booking) {
            p = await this.propertyRepository.findByBookingId(hotelIdStr)
          }
          propertyIdCache.set(cacheKey, p?.id ?? null)
        }
        propertyId = propertyIdCache.get(cacheKey) ?? undefined
        if (!propertyId) {
          rowErrors.push(
            `Property not found for ${otaRaw} hotel ID "${hotelIdStr}"`
          )
        }
      } else if (hotelName && !hotelIdStr) {
        const cacheKey = `name:${hotelName}`
        if (!propertyIdCache.has(cacheKey)) {
          const p = await this.propertyRepository.findByName(hotelName)
          propertyIdCache.set(cacheKey, p?.id ?? null)
        }
        propertyId = propertyIdCache.get(cacheKey) ?? undefined
        if (!propertyId) {
          rowErrors.push(`Property "${hotelName}" not found in the database`)
        }
      }

      if (propertyId && auditPermission?.access_level === AccessLevel.partial) {
        if (!accessCache.has(propertyId)) {
          const ok = await this.permissionService.canAccessResource(
            user,
            ModuleType.PROPERTY,
            propertyId
          )
          accessCache.set(propertyId, ok)
        }
        if (!accessCache.get(propertyId)) {
          const propertyLabel =
            hotelName ?? `${otaRaw ?? 'OTA'} ${hotelIdStr ?? ''}`.trim()
          rowErrors.push(
            `Access denied: You do not have access to property "${propertyLabel}"`
          )
        }
      }

      // --- Check-in / Check-out (optional): validate only when a value is present ---
      const checkIn = checkInRaw ? parseDate(checkInRaw) : null
      if (checkInRaw && !checkIn) {
        rowErrors.push(
          `Check In date "${checkInRaw}" could not be parsed. Expected format: MM/DD/YYYY`
        )
      }

      const checkOut = checkOutRaw ? parseDate(checkOutRaw) : null
      if (checkOutRaw && !checkOut) {
        rowErrors.push(
          `Check Out date "${checkOutRaw}" could not be parsed. Expected format: MM/DD/YYYY`
        )
      }

      if (checkIn && checkOut && checkIn >= checkOut) {
        rowErrors.push('Check In date must be before Check Out date')
      }

      // --- Amount Collected ---
      if (!amountRaw) {
        rowErrors.push('Amount Collected is missing')
      } else {
        const amount = parseAmount(amountRaw)
        if (amount === 0 && String(amountRaw).replace(/[^\d]/g, '') !== '0') {
          rowErrors.push(
            `Amount Collected "${amountRaw}" could not be parsed as a number`
          )
        }
      }

      // Collect all errors for this row
      for (const err of rowErrors) {
        errors.push({
          row: rowNum,
          property: label,
          ota: otaRaw,
          hotel_id: hotelIdStr,
          error: err
        })
      }

      // Build valid group only if this row has zero errors so far
      // Groups are keyed by property + status (case-insensitive) so one property can yield multiple audits.
      if (rowErrors.length === 0 && propertyId) {
        const groupKey = `${propertyId}::${statusTrimmed.toLowerCase()}`
        if (!validGroups.has(groupKey)) {
          const displayName =
            hotelName ??
            (hotelIdStr && otaRaw ? `${otaRaw} ${hotelIdStr}` : hotelIdStr ?? 'Unknown')
          validGroups.set(groupKey, {
            rows: [],
            propertyId,
            displayName,
            batch: batchRaw,
            reviewCollectionDate: reviewCollectionDateRaw,
            statusLabel: statusTrimmed
          })
        }
        validGroups.get(groupKey)!.rows.push(row)
      }
    }

    if (errors.length > 0) {
      this.logger.error(
        `✗ Validation failed with ${errors.length} error(s). ` +
          `Valid properties: ${validGroups.size}, Invalid rows: ${errors.length}`
      )

      // Log each error in detail
      errors.forEach((err) => {
        this.logger.error(
          `  Row ${err.row} (${err.property}): ${err.error}`
        )
      })

      return { success: false, errors }
    }

    this.logger.success(
      `✓ Validation successful. ${validGroups.size} property group(s) ready for audit creation`
    )

    // --- Resolve audit status IDs: find by name (case-insensitive), else create ---
    const uniqueStatusLabels = Array.from(
      new Set(
        Array.from(validGroups.values()).map(g => g.statusLabel.trim())
      )
    ).filter(Boolean)

    const statusIdByNormalized = new Map<string, string>()
    let allStatusesForImport = await this.auditStatusRepository.findAll()

    for (const label of uniqueStatusLabels) {
      const norm = label.toLowerCase()
      if (statusIdByNormalized.has(norm)) continue

      let matched =
        allStatusesForImport.find(s => s.status.toLowerCase() === norm) ??
        null
      if (!matched) {
        matched = await this.auditStatusRepository.create({ status: label })
        allStatusesForImport = [...allStatusesForImport, matched]
      }
      statusIdByNormalized.set(norm, matched.id)
    }

    this.logger.info('Starting audit creation process...')

    // --- Create audits, generate per-property xlsx sheets, upload to S3 ---
    const createdAudits: Array<{
      property: string
      audit_id: string
      report_url: string
    }> = []

    for (const [
      _groupKey,
      { rows, propertyId, displayName, batch, reviewCollectionDate, statusLabel }
    ] of validGroups) {
      const auditStatusId = statusIdByNormalized.get(statusLabel.toLowerCase())
      if (!auditStatusId) {
        throw new BadRequestException(
          `Failed to resolve audit status for "${statusLabel}"`
        )
      }

      this.logger.info(
        `Processing property group: "${displayName}" (${rows.length} rows)` +
          `${batch ? `, Batch="${batch}"` : ''}` +
          `${reviewCollectionDate
            ? `, ReviewCollectionDate="${reviewCollectionDate}"`
            : ''
          }` +
          `, Status="${statusLabel}"`
      )

      // Aggregate data from all rows for this property
      const otaSet = new Set<OtaType>()
      let expediaSum = 0
      let agodaSum = 0
      let bookingSum = 0

      for (const row of rows) {
        const ota = parseOta(findCol(row, OTA_COLS))
        const amount = parseAmount(findCol(row, AMOUNT_COLS))

        if (ota) {
          otaSet.add(ota)
          if (ota === OtaType.expedia) expediaSum += amount
          if (ota === OtaType.agoda) agodaSum += amount
          if (ota === OtaType.booking) bookingSum += amount
        }
      }

      // --- Handle batch assignment ---
      let batchId: string | undefined
      if (batch) {
        // Try to find existing batch by batch_no
        let existingBatch = await this.auditBatchRepository.findByBatchNo(batch)
        if (!existingBatch) {
          // Create new batch if not found
          this.logger.info(
            `Creating new batch "${batch}" for property "${displayName}"`
          )
          existingBatch = await this.auditBatchRepository.create({
            batch_no: batch
          })
          this.logger.success(
            `✓ Batch created: ID=${existingBatch.id}, Batch No="${batch}"`
          )
        } else {
          this.logger.info(
            `Using existing batch: ID=${existingBatch.id}, Batch No="${batch}"`
          )
        }
        batchId = existingBatch.id
      }

      // Parse review collection date if provided
      const parsedReviewCollectionDate = reviewCollectionDate
        ? parseDate(reviewCollectionDate)
        : null

      const auditData: CreateAuditDto = {
        property_id: propertyId,
        audit_status_id: auditStatusId,
        type_of_ota: [...otaSet],
        batch_id: batchId,
        review_collection_date: parsedReviewCollectionDate
          ? parsedReviewCollectionDate.toISOString()
          : undefined,
        expedia_amount_collectable: otaSet.has(OtaType.expedia)
          ? roundAmount(expediaSum)
          : undefined,
        expedia_amount_confirmed: otaSet.has(OtaType.expedia)
          ? roundAmount(expediaSum)
          : undefined,
        agoda_amount_collectable: otaSet.has(OtaType.agoda)
          ? roundAmount(agodaSum)
          : undefined,
        agoda_amount_confirmed: otaSet.has(OtaType.agoda)
          ? roundAmount(agodaSum)
          : undefined,
        booking_amount_collectable: otaSet.has(OtaType.booking)
          ? roundAmount(bookingSum)
          : undefined,
        booking_amount_confirmed: otaSet.has(OtaType.booking)
          ? roundAmount(bookingSum)
          : undefined
      }

      try {
        this.logger.info(
          `Creating audit for property "${displayName}" with ${rows.length} rows`
        )

        const audit = await this.auditRepository.create(auditData)

        this.logger.success(
          `✓ Audit created successfully: ID=${audit.id}, ` +
            `Property="${displayName}", ` +
            `Expedia=$${expediaSum.toFixed(2)}, ` +
            `Agoda=$${agodaSum.toFixed(2)}, ` +
            `Booking=$${bookingSum.toFixed(2)}, ` +
            `Batch="${batch || 'None'}", ` +
            `Review/Collection Date=${parsedReviewCollectionDate
              ? parsedReviewCollectionDate.toISOString().split('T')[0]
              : 'Not set'
            }`
        )

        // Build per-property xlsx (always xlsx regardless of uploaded file type)
      // Uses ExcelJS for bold headers and auto-fitted column widths
      // SheetJS leaves Excel date cells as serial numbers; write real Date + numFmt so
      // opened files show dates instead of raw numbers (e.g. 46125).
      const isDateLikeColumnHeader = (header: string): boolean => {
        const h = header.split('*')[0].trim().toLowerCase()
        const markers = [
          'date',
          'check in',
          'check-in',
          'checkin',
          'check out',
          'checkout',
          'review',
          'collection',
          'arrival',
          'departure'
        ]
        return markers.some(m => h.includes(m))
      }

      const cellValueForExport = (header: string, raw: unknown): ExcelJS.CellValue => {
        if (raw === undefined || raw === null || raw === '') return ''
        if (!isDateLikeColumnHeader(header)) {
          return raw as ExcelJS.CellValue
        }
        if (raw instanceof Date) return raw
        const parsed = parseDate(raw)
        return parsed ?? (raw as ExcelJS.CellValue)
      }

      const excelWb = new ExcelJS.Workbook()
      const excelWs = excelWb.addWorksheet('Report')

      // Header row — bold text
      const headerRow = excelWs.addRow(originalHeaders)
      headerRow.eachCell(cell => {
        cell.font = { bold: true }
      })

      // Data rows
      for (const dataRow of rows) {
        const row = excelWs.addRow(
          originalHeaders.map(h => cellValueForExport(h, dataRow[h]))
        )
        row.eachCell(cell => {
          if (cell.value instanceof Date) {
            // Match typical auto-import sheet display: month/day/year (US-style)
            cell.numFmt = 'mm/dd/yyyy'
          }
        })
      }

      // Column widths: based on the longest value in each column (header + data)
      originalHeaders.forEach((header, colIdx) => {
        const maxContentLen = rows.reduce((max, dataRow) => {
          const exported = cellValueForExport(header, dataRow[header])
          const len =
            exported instanceof Date
              ? 10
              : typeof exported === 'number' ||
                  typeof exported === 'string' ||
                  typeof exported === 'boolean'
                ? String(exported).length
                : 12
          return Math.max(max, len)
        }, 0)
        const width = Math.min(Math.max(header.length, maxContentLen) + 4, 60)
        excelWs.getColumn(colIdx + 1).width = width
      })

      const xlsxBuffer = Buffer.from(await excelWb.xlsx.writeBuffer())

      // Upload to S3 via FileUploadService
      const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_')
      const fakeFile = {
        buffer: xlsxBuffer,
        originalname: `auto-import_${safeName}_${Date.now()}.xlsx`,
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: xlsxBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: ''
      } as Express.Multer.File

      const uploadResult = await this.fileUploadService.uploadFile(fakeFile)

      // Persist report_url on the created audit
      await this.auditRepository.update(audit.id, {
        report_url: uploadResult.url
      })

      createdAudits.push({
        property: displayName,
        audit_id: audit.id,
        report_url: uploadResult.url
      })

        this.logger.success(
          `✓ Report uploaded for property "${displayName}": ${uploadResult.url}`
        )
      } catch (error) {
        this.logger.error(
          `✗ Failed to create audit for property "${displayName}": ` +
            `${error instanceof Error ? error.message : 'Unknown error'}`
        )
        // Continue to next property even if this one fails
      }
    }

    this.logger.success(
      `✓ Auto-import completed successfully. ` +
        `Total audits created: ${createdAudits.length}`
    )

    // Log summary of created audits
    if (createdAudits.length > 0) {
      this.logger.info('Summary of created audits:')
      createdAudits.forEach((audit) => {
        this.logger.info(
          `  - Property: "${audit.property}", Audit ID: ${audit.audit_id}, Report: ${audit.report_url}`
        )
      })
    }

    return { success: true, created_audits: createdAudits }
  }

  async deleteAllByPortfolio(
    portfolioId: string,
    _data: DeleteAuditsByPortfolioDto,
    user: IUserWithPermissions
  ): Promise<{ message: string; deleted_count: number }> {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can delete all audits for a portfolio'
      )
    }

    const portfolio = await this.portfolioRepository.findById(
      portfolioId,
      user.id,
      true
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    const result = await this.auditRepository.deleteByPortfolioId(portfolioId)

    return {
      message: `Successfully deleted ${result.count} audit(s) for portfolio "${portfolio.name}"`,
      deleted_count: result.count
    }
  }
}
