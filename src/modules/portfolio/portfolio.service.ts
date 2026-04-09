import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AccessLevel,
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { maskBankDetails } from '../../common/utils/bank-details.util'
import { roundAmount } from '../../common/utils/amount.util'
import {
  parseSpreadsheetToJson,
  validateSpreadsheetFile
} from '../../common/utils/spreadsheet.util'
import { COMPLETED_AUDIT_STATUSES } from '../../common/utils/audit.util'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import {
  isInternalUser,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { splitEmails } from '../../common/validators/comma-separated-emails.validator'
import type { IContractUrlRepository } from '../contract-url/contract-url.interface'
import { AttachmentUrlDto, EmailAttachment } from '../email/email.dto'
import { PrismaService } from '../prisma/prisma.service'
import type { IServiceTypeRepository } from '../service-type/service-type.interface'
import {
  BulkImportResultDto,
  BulkUpdateResultDto,
  CreatePortfolioDto,
  PortfolioQueryDto,
  PortfolioStatsQueryDto,
  PortfolioStatsResponseDto,
  UpdatePortfolioDto
} from './portfolio.dto'
import type {
  IPortfolioRepository,
  IPortfolioService
} from './portfolio.interface'

@Injectable()
export class PortfolioService implements IPortfolioService {
  constructor(
    @Inject('IPortfolioRepository')
    private portfolioRepository: IPortfolioRepository,
    @Inject('IServiceTypeRepository')
    private serviceTypeRepository: IServiceTypeRepository,
    @Inject('IContractUrlRepository')
    private contractUrlRepository: IContractUrlRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  /**
   * Check if user can upload contract documents to a portfolio
   * User can upload if they are Super Admin OR
   * Internal user with at least 'update' permission level and 'partial' access level
   */
  private canUploadContractDocuments(user: IUserWithPermissions): boolean {
    // Super Admin can always upload
    if (isUserSuperAdmin(user)) {
      return true
    }

    // Must be internal user
    if (!isInternalUser(user)) {
      return false
    }

    // Check portfolio permissions
    const portfolioPermission = user.role.portfolio_permission
    if (!portfolioPermission) {
      return false
    }

    // Must have at least 'update' permission level
    const hasUpdatePermission =
      portfolioPermission.permission_level === 'all' ||
      portfolioPermission.permission_level === 'update'

    // Must have at least 'partial' access level
    const hasAccess =
      portfolioPermission.access_level === 'all' ||
      portfolioPermission.access_level === 'partial'

    return hasUpdatePermission && hasAccess
  }

  async create(data: CreatePortfolioDto, user: IUserWithPermissions) {
    // Only internal users can create portfolios
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can create portfolios')
    }

    const existingPortfolio = await this.portfolioRepository.findByName(
      data.name
    )

    if (existingPortfolio) {
      throw new ConflictException('Portfolio with this name already exists')
    }

    // Extract contract_url from data before creating portfolio
    const { contract_url, ...portfolioData } = data

    // Check if user can upload contract URLs
    if (contract_url && !this.canUploadContractDocuments(user)) {
      throw new BadRequestException(
        'Only Super Admin or internal users with at least update permission and partial access can upload contract URLs.'
      )
    }

    const isSuperAdmin = isUserSuperAdmin(user)
    const portfolio = await this.portfolioRepository.create(
      portfolioData,
      user.id,
      isSuperAdmin
    )

    // If contract_url is provided and user has permission, create a contract URL entry
    if (contract_url && this.canUploadContractDocuments(user)) {
      await this.contractUrlRepository.create({
        url: contract_url,
        portfolio_id: portfolio.id,
        user_id: user.id,
        is_active: true
      })
    }

    // If user has partial access, grant them access to the created portfolio
    const permission = user.role.portfolio_permission
    if (permission?.access_level === AccessLevel.partial) {
      await this.permissionService.grantResourceAccess(
        user.id,
        ModuleType.PORTFOLIO,
        portfolio.id
      )
    }

    // Get user's accessible property IDs for filtering property counts
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    // Re-fetch the portfolio to include the newly created contract URL
    const portfolioWithContractUrls = await this.portfolioRepository.findById(
      portfolio.id,
      user.id,
      isSuperAdmin,
      accessiblePropertyIds
    )

    return portfolioWithContractUrls || portfolio
  }

  async findAll(query: PortfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Get user's accessible property IDs for filtering property counts
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    const userIsSuperAdmin = isUserSuperAdmin(user)
    const userIsInternal = isInternalUser(user)

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.service_type_id) {
      additionalFilters.service_type_id = query.service_type_id
    }
    if (query.is_active) {
      const isActiveValue = query.is_active.toLowerCase().trim()
      if (isActiveValue === 'all') {
        // Don't apply is_active filter when "all" is specified
      } else if (isActiveValue === 'true') {
        additionalFilters.is_active = true
      } else if (isActiveValue === 'false') {
        additionalFilters.is_active = false
      } else {
        // Default to true if invalid value provided
        additionalFilters.is_active = true
      }
    }

    // External users can only see active portfolios
    if (!userIsSuperAdmin && !userIsInternal) {
      // Only override if is_active filter wasn't explicitly set to "all"
      if (!query.is_active || query.is_active.toLowerCase().trim() !== 'all') {
        additionalFilters.is_active = true
      }
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
      searchFields: ['name'], // Search only by portfolio name
      filterableFields: ['service_type_id', 'is_active'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_commissionable'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        service_type_name: 'serviceType.type'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Build Prisma query options
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    const isSuperAdmin = userIsSuperAdmin

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.portfolioRepository.findAll(
        { where, skip, take, orderBy },
        undefined,
        user.id,
        isSuperAdmin,
        accessiblePropertyIds
      ),
      this.portfolioRepository.count(where, undefined)
    ])

    // Add pending action info to each portfolio
    const enrichedData = data.map((portfolio: any) => {
      const pendingActions = portfolio.pendingActions || []

      // Remove pendingActions array from response to avoid duplication
      const {
        pendingActions: _pendingActions,
        ...portfolioWithoutPendingActions
      } = portfolio

      const portfolioData = {
        ...portfolioWithoutPendingActions,
        bankDetails: maskBankDetails(portfolioWithoutPendingActions.bankDetails),
        has_pending_action: pendingActions.length > 0,
        pending_actions: pendingActions
      }

      return portfolioData
    })

    return QueryBuilder.buildPaginatedResult(
      enrichedData,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(query: PortfolioQueryDto, user: IUserWithPermissions) {
    // Only super admin can export portfolios
    const userIsSuperAdmin = isUserSuperAdmin(user)
    if (!userIsSuperAdmin) {
      throw new BadRequestException('Only Super Admin can export portfolios')
    }

    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    // Get user's accessible property IDs for filtering property counts
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    const userIsInternal = isInternalUser(user)

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.service_type_id) {
      additionalFilters.service_type_id = query.service_type_id
    }
    if (query.is_active) {
      const isActiveValue = query.is_active.toLowerCase().trim()
      if (isActiveValue === 'all') {
        // Don't apply is_active filter when "all" is specified
      } else if (isActiveValue === 'true') {
        additionalFilters.is_active = true
      } else if (isActiveValue === 'false') {
        additionalFilters.is_active = false
      } else {
        // Default to true if invalid value provided
        additionalFilters.is_active = true
      }
    }

    // External users can only see active portfolios
    if (!userIsSuperAdmin && !userIsInternal) {
      // Only override if is_active filter wasn't explicitly set to "all"
      if (!query.is_active || query.is_active.toLowerCase().trim() !== 'all') {
        additionalFilters.is_active = true
      }
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
      searchFields: ['name'], // Search only by portfolio name
      filterableFields: ['service_type_id', 'is_active'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_commissionable'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        service_type_name: 'serviceType.type'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Build Prisma query options (without pagination)
    const { where, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch all data without pagination
    const data = await this.portfolioRepository.findAll(
      { where, orderBy },
      undefined,
      user.id,
      userIsSuperAdmin,
      accessiblePropertyIds
    )

    // Add pending action info to each portfolio
    const enrichedData = data.map((portfolio: any) => {
      const pendingActions = portfolio.pendingActions || []

      // Remove pendingActions array from response to avoid duplication
      const {
        pendingActions: _pendingActions,
        ...portfolioWithoutPendingActions
      } = portfolio

      const portfolioData = {
        ...portfolioWithoutPendingActions,
        has_pending_action: pendingActions.length > 0,
        pending_actions: pendingActions
      }

      return portfolioData
    })

    return enrichedData
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    // Get user's accessible property IDs for filtering property counts
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin,
      accessiblePropertyIds
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // External users cannot see deactivated portfolios
    if (!isSuperAdmin && !isInternal && !portfolio.is_active) {
      throw new NotFoundException('Portfolio not found')
    }

    return {
      ...portfolio,
      bankDetails: maskBankDetails(portfolio.bankDetails)
    }
  }

  async findOneSecure(id: string, user: IUserWithPermissions) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin,
      accessiblePropertyIds
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    if (!isSuperAdmin && !isInternal && !portfolio.is_active) {
      throw new NotFoundException('Portfolio not found')
    }

    return portfolio
  }

  async findManyByIdsSecure(
    portfolioIds: string[],
    user: IUserWithPermissions
  ) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    const results = await Promise.all(
      portfolioIds.map(async id => {
        const portfolio = await this.portfolioRepository.findById(
          id,
          user.id,
          isSuperAdmin,
          accessiblePropertyIds
        )

        if (!portfolio) return null

        // Respect access control
        if (
          accessibleIds !== 'all' &&
          Array.isArray(accessibleIds) &&
          !accessibleIds.includes(id)
        ) {
          return null
        }

        if (!isSuperAdmin && !isInternal && !portfolio.is_active) {
          return null
        }

        return portfolio
      })
    )

    return results.filter((p): p is NonNullable<typeof p> => p !== null)
  }

  async findAllSecure(
    query: PortfolioQueryDto,
    user: IUserWithPermissions
  ) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    const userIsSuperAdmin = isUserSuperAdmin(user)
    const userIsInternal = isInternalUser(user)

    const additionalFilters: any = {}
    if (query.service_type_id) {
      additionalFilters.service_type_id = query.service_type_id
    }
    if (query.is_active) {
      const isActiveValue = query.is_active.toLowerCase().trim()
      if (isActiveValue === 'all') {
        // no filter
      } else if (isActiveValue === 'true') {
        additionalFilters.is_active = true
      } else if (isActiveValue === 'false') {
        additionalFilters.is_active = false
      } else {
        additionalFilters.is_active = true
      }
    }

    if (!userIsSuperAdmin && !userIsInternal) {
      if (!query.is_active || query.is_active.toLowerCase().trim() !== 'all') {
        additionalFilters.is_active = true
      }
    }

    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    const queryConfig = {
      searchFields: ['name'],
      filterableFields: ['service_type_id', 'is_active'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_commissionable'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        service_type_name: 'serviceType.type'
      }
    }

    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : { id: { in: accessibleIds } }

    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    const [data, total] = await Promise.all([
      this.portfolioRepository.findAll(
        { where, skip, take, orderBy },
        undefined,
        user.id,
        userIsSuperAdmin,
        accessiblePropertyIds
      ),
      this.portfolioRepository.count(where, undefined)
    ])

    const enrichedData = data.map((portfolio: any) => {
      const pendingActions = portfolio.pendingActions || []
      const { pendingActions: _pendingActions, ...portfolioWithoutPendingActions } = portfolio
      return {
        ...portfolioWithoutPendingActions,
        has_pending_action: pendingActions.length > 0,
        pending_actions: pendingActions
      }
    })

    return QueryBuilder.buildPaginatedResult(
      enrichedData,
      total,
      query.page || 1,
      query.limit || 10
    )
  }


  async update(
    id: string,
    data: UpdatePortfolioDto,
    user: IUserWithPermissions
  ) {
    // Only internal users can update portfolios
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can update portfolios')
    }

    const isSuperAdmin = isUserSuperAdmin(user)
    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    if (data.name && data.name !== portfolio.name) {
      const existingPortfolio = await this.portfolioRepository.findByName(
        data.name
      )

      if (existingPortfolio) {
        throw new ConflictException('Portfolio with this name already exists')
      }
    }

    // Validate service_type_id if provided
    if (data.service_type_id) {
      const serviceType = await this.serviceTypeRepository.findById(
        data.service_type_id
      )

      if (!serviceType) {
        throw new NotFoundException('Service type not found')
      }
    }

    return this.portfolioRepository.update(id, data, user.id, isSuperAdmin)
  }

  async remove(id: string, password: string, user: IUserWithPermissions) {
    const isSuperAdmin = isUserSuperAdmin(user)

    // Only super admin can delete portfolios
    if (!isSuperAdmin) {
      throw new BadRequestException('Only Super Admin can delete portfolios')
    }

    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    const propertyCount = await this.portfolioRepository.countProperties(id)

    if (propertyCount > 0) {
      throw new BadRequestException(
        `Cannot delete portfolio with ${propertyCount} associated properties. Please delete or reassign the properties first.`
      )
    }

    await this.portfolioRepository.delete(id)

    return { message: 'Portfolio deleted successfully' }
  }

  async bulkDelete(
    portfolio_ids: string[],
    password: string,
    user: IUserWithPermissions
  ) {
    const isSuperAdmin = isUserSuperAdmin(user)

    // Only super admin can bulk delete portfolios
    if (!isSuperAdmin) {
      throw new BadRequestException(
        'Only Super Admin can bulk delete portfolios'
      )
    }

    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    // Validate at least one portfolio ID is provided
    if (!portfolio_ids || portfolio_ids.length === 0) {
      throw new BadRequestException('At least one portfolio ID is required')
    }

    const results: Array<{
      portfolio_id: string
      success: boolean
      message?: string
    }> = []
    let successCount = 0
    let failedCount = 0

    // Process each portfolio
    for (const portfolioId of portfolio_ids) {
      try {
        // Find the portfolio
        const portfolio = await this.portfolioRepository.findById(
          portfolioId,
          user.id,
          isSuperAdmin
        )

        if (!portfolio) {
          results.push({
            portfolio_id: portfolioId,
            success: false,
            message: 'Portfolio not found'
          })
          failedCount++
          continue
        }

        // Check if portfolio has properties
        const propertyCount =
          await this.portfolioRepository.countProperties(portfolioId)

        if (propertyCount > 0) {
          results.push({
            portfolio_id: portfolioId,
            success: false,
            message: `Cannot delete portfolio with ${propertyCount} associated properties. Please delete or reassign the properties first.`
          })
          failedCount++
          continue
        }

        // Delete the portfolio
        await this.portfolioRepository.delete(portfolioId)

        results.push({
          portfolio_id: portfolioId,
          success: true
        })
        successCount++
      } catch (error) {
        results.push({
          portfolio_id: portfolioId,
          success: false,
          message: error.message || 'Unknown error occurred'
        })
        failedCount++
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results
    }
  }

  async deactivate(
    id: string,
    password: string,
    user: IUserWithPermissions,
    reason?: string
  ) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    // Check if user has at least update permission for portfolio module
    const portfolioPermission = user.role.portfolio_permission

    if (!portfolioPermission) {
      throw new BadRequestException(
        'No portfolio permission found for this user'
      )
    }

    const hasUpdatePermission =
      portfolioPermission.permission_level === 'all' ||
      portfolioPermission.permission_level === 'update'

    const hasAccess =
      portfolioPermission.access_level === 'all' ||
      portfolioPermission.access_level === 'partial'

    // Only internal users with update (or all) permission and partial (or all) access can request deactivation
    if (!isInternal || !hasUpdatePermission || !hasAccess) {
      throw new BadRequestException(
        'Only internal users with at least update permission and partial access for portfolio module can deactivate portfolios'
      )
    }

    // For partial access, verify user has access to this portfolio
    if (portfolioPermission.access_level === 'partial' && !isSuperAdmin) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.UPDATE,
        id
      )
    }

    // Non-super admin users must provide a reason for pending request
    if (!isSuperAdmin && !reason) {
      throw new BadRequestException(
        'Reason is required for non-super admin users to submit deactivation request'
      )
    }

    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // Check if portfolio is already deactivated
    if (!portfolio.is_active) {
      throw new BadRequestException('Portfolio is already deactivated')
    }

    // Super admin can deactivate directly (no reason required)
    if (isSuperAdmin) {
      await this.prisma.portfolio.update({
        where: { id },
        data: { is_active: false }
      })
      return { message: 'Portfolio deactivated successfully' }
    }

    // Non-super admin users need to create a pending action
    const existingPendingAction = await this.prisma.pendingAction.findFirst({
      where: {
        portfolio_id: id,
        status: 'PENDING'
      }
    })

    if (existingPendingAction) {
      throw new BadRequestException(
        'A pending action request already exists for this portfolio. Please wait for it to be approved or rejected.'
      )
    }

    // Create pending action
    await this.prisma.pendingAction.create({
      data: {
        resource_type: 'portfolio',
        portfolio_id: id,
        action_type: 'PORTFOLIO_DEACTIVATE',
        status: 'PENDING',
        requested_user_id: user.id,
        reason: reason
      }
    })

    return {
      message:
        'Deactivation request submitted successfully and is pending super admin approval'
    }
  }

  async activate(
    id: string,
    password: string,
    user: IUserWithPermissions,
    reason?: string
  ) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    // Check if user has at least update permission for portfolio module
    const portfolioPermission = user.role.portfolio_permission

    if (!portfolioPermission) {
      throw new BadRequestException(
        'No portfolio permission found for this user'
      )
    }

    const hasUpdatePermission =
      portfolioPermission.permission_level === 'all' ||
      portfolioPermission.permission_level === 'update'

    const hasAccess =
      portfolioPermission.access_level === 'all' ||
      portfolioPermission.access_level === 'partial'

    // Only internal users with update (or all) permission and partial (or all) access can request activation
    if (!isInternal || !hasUpdatePermission || !hasAccess) {
      throw new BadRequestException(
        'Only internal users with at least update permission and partial access for portfolio module can activate portfolios'
      )
    }

    // For partial access, verify user has access to this portfolio
    if (portfolioPermission.access_level === 'partial' && !isSuperAdmin) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.UPDATE,
        id
      )
    }

    // Non-super admin users must provide a reason for pending request
    if (!isSuperAdmin && !reason) {
      throw new BadRequestException(
        'Reason is required for non-super admin users to submit activation request'
      )
    }

    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // Check if portfolio is already active
    if (portfolio.is_active) {
      throw new BadRequestException('Portfolio is already active')
    }

    // Super admin can activate directly (no reason required)
    if (isSuperAdmin) {
      await this.prisma.portfolio.update({
        where: { id },
        data: { is_active: true }
      })
      return { message: 'Portfolio activated successfully' }
    }

    // Non-super admin users need to create a pending action
    const existingPendingAction = await this.prisma.pendingAction.findFirst({
      where: {
        portfolio_id: id,
        status: 'PENDING'
      }
    })

    if (existingPendingAction) {
      throw new BadRequestException(
        'A pending action request already exists for this portfolio. Please wait for it to be approved or rejected.'
      )
    }

    // Create pending action
    await this.prisma.pendingAction.create({
      data: {
        resource_type: 'portfolio',
        portfolio_id: id,
        action_type: 'PORTFOLIO_ACTIVATE',
        status: 'PENDING',
        requested_user_id: user.id,
        reason: reason
      }
    })

    return {
      message:
        'Activation request submitted successfully and is pending super admin approval'
    }
  }

  async sendEmail(
    id: string,
    subject: string,
    body: string,
    user: IUserWithPermissions,
    uploadedAttachments?: EmailAttachment[],
    attachmentUrls?: AttachmentUrlDto[]
  ) {
    const isSuperAdmin = isUserSuperAdmin(user)

    // CRITICAL: Explicit permission check to ensure user has access to this portfolio
    // This prevents partial access users from sending emails to portfolios they cannot access
    if (!isSuperAdmin) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        id
      )
    }

    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    if (!portfolio.contact_email) {
      throw new BadRequestException(
        'Portfolio does not have a contact email configured'
      )
    }

    // Split comma-separated emails
    const emailAddresses = splitEmails(portfolio.contact_email)

    if (emailAddresses.length === 0) {
      throw new BadRequestException(
        'Portfolio does not have valid contact email addresses configured'
      )
    }

    // Log email details for debugging
    console.log('📧 Sending email to portfolio contact(s):', {
      requestedPortfolioId: id,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      contact_email: portfolio.contact_email,
      email_addresses: emailAddresses,
      recipient_count: emailAddresses.length,
      access_email: portfolio.access_email,
      subject,
      hasAttachments:
        (uploadedAttachments?.length || 0) + (attachmentUrls?.length || 0) > 0
    })

    // Combine attachments from file uploads and URLs
    let allAttachments: EmailAttachment[] = []

    // Add uploaded file attachments if provided
    if (uploadedAttachments && uploadedAttachments.length > 0) {
      allAttachments = [...uploadedAttachments]
    }

    // Fetch and add URL-based attachments if provided
    if (attachmentUrls && attachmentUrls.length > 0) {
      const urlAttachments =
        await this.emailUtil.fetchAttachmentsFromUrls(attachmentUrls)
      allAttachments = [...allAttachments, ...urlAttachments]
    }

    // Send email to each recipient
    for (const emailAddress of emailAddresses) {
      await this.emailUtil.sendEmail(
        emailAddress,
        subject,
        body,
        allAttachments.length > 0 ? allAttachments : undefined
      )
    }

    return {
      message: `Email sent successfully to ${emailAddresses.length} recipient(s)`,
      recipients: emailAddresses
    }
  }

  async bulkImport(
    file: Express.Multer.File,
    _user: IUserWithPermissions
  ): Promise<BulkImportResultDto> {
    // Only internal users can bulk import portfolios
    if (!isInternalUser(_user)) {
      throw new BadRequestException(
        'Only internal users can bulk import portfolios'
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

      // Helper function to clean column name - removes asterisks and other markers, trims whitespace
      const cleanColumnName = (name: string): string => {
        return name
          .replace(/[*＊✱✲⁎∗]/g, '') // Remove various asterisk characters
          .trim()
          .toLowerCase()
      }

      // Helper function to find header value with flexible naming
      // Handles column names with asterisks (e.g., "Portfolio Name*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        const rowKeys = Object.keys(row)

        // Try to find a matching column
        for (const name of possibleNames) {
          const cleanName = cleanColumnName(name)

          for (const key of rowKeys) {
            const cleanKey = cleanColumnName(key)

            if (cleanKey === cleanName) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
          }
        }

        return undefined
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // Spreadsheet row number (header is row 1)

        try {
          // Extract portfolio name (REQUIRED)
          const portfolioName = findHeaderValue(row, [
            'Portfolio Name',
            'Portofolio',
            'Portfolio name',
            'Name'
          ])

          if (!portfolioName) {
            result.errors.push({
              row: rowNumber,
              portfolio: 'Unknown',
              error: 'Portfolio Name is required'
            })
            result.failureCount++
            continue
          }

          // Check if portfolio already exists
          const existingPortfolio =
            await this.portfolioRepository.findByName(portfolioName)
          if (existingPortfolio) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Portfolio with this name already exists'
            })
            result.failureCount++
            continue
          }

          // Extract service type name (REQUIRED)
          const serviceTypeName = findHeaderValue(row, [
            'Service Type',
            'Service type'
          ])

          if (!serviceTypeName) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Service Type is required'
            })
            result.failureCount++
            continue
          }

          // Find or create service type
          let serviceType =
            await this.serviceTypeRepository.findByType(serviceTypeName)

          if (!serviceType) {
            // Create new service type
            serviceType = await this.serviceTypeRepository.create({
              type: serviceTypeName,
              is_active: true
            })
          }

          // Extract active status (REQUIRED) - map "Active"/"Inactive" to true/false
          const activeStatusRaw = findHeaderValue(row, [
            'Active status',
            'Active Status',
            'Status',
            'Is Active'
          ])

          if (!activeStatusRaw) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Active status is required'
            })
            result.failureCount++
            continue
          }

          const activeStatusNormalized = activeStatusRaw.toLowerCase().trim()
          let isActive: boolean
          if (activeStatusNormalized === 'active') {
            isActive = true
          } else if (activeStatusNormalized === 'inactive') {
            isActive = false
          } else {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: `Invalid Active status value: "${activeStatusRaw}". Expected "Active" or "Inactive"`
            })
            result.failureCount++
            continue
          }

          // Extract currency (OPTIONAL - defaults to USD)
          const currency =
            findHeaderValue(row, [
              'Currency',
              'currency',
              'Currency Code',
              'currency_code'
            ]) || 'USD'

          // Extract contact email (OPTIONAL)
          const contactEmail = findHeaderValue(row, [
            'Contact Email',
            'Contact email',
            'Contact'
          ])

          // Extract access email (OPTIONAL)
          const accessEmail = findHeaderValue(row, [
            'Access Email',
            'Access email'
          ])

          // Extract access phone (OPTIONAL)
          const accessPhone = findHeaderValue(row, [
            'Access Phone',
            'Access phone',
            'Access Phone NO',
            'Access Phone No',
            'Access Phone no',
            'Access phone no',
            'Access Contact',
            'Access contact'
          ])

        // Extract contract URL/Documents (OPTIONAL)
        const contractUrl = findHeaderValue(row, [
          'Documents',
          'Contract URL',
          'Contract Url',
          'Contract url'
        ])

        // Extract commissionable (OPTIONAL) - map "Yes"/"No" to true/false
        const commissionableRaw = findHeaderValue(row, [
          'Commissionable',
          'Is Commissionable',
          'is_commissionable'
        ])

          let isCommissionable = false
          if (commissionableRaw) {
            const commissionableNormalized = commissionableRaw
              .toLowerCase()
              .trim()
            if (commissionableNormalized === 'yes') {
              isCommissionable = true
            } else if (commissionableNormalized === 'no') {
              isCommissionable = false
            } else {
              result.errors.push({
                row: rowNumber,
                portfolio: portfolioName,
                error: `Invalid Commissionable value: "${commissionableRaw}". Expected "Yes" or "No"`
              })
              result.failureCount++
              continue
            }
          }

          // Create portfolio
          const portfolioData: Omit<CreatePortfolioDto, 'contract_url'> = {
            name: portfolioName,
            service_type_id: serviceType.id,
            currency: currency,
            is_active: isActive,
            contact_email: contactEmail || undefined,
            is_commissionable: isCommissionable,
            access_email: accessEmail || undefined,
            access_phone: accessPhone || undefined
          }

          const newPortfolio = await this.portfolioRepository.create(
            portfolioData,
            _user.id
          )

          // If user has partial access, grant them access to the created portfolio
          const permission = _user.role.portfolio_permission
          if (permission?.access_level === AccessLevel.partial) {
            await this.permissionService.grantResourceAccess(
              _user.id,
              ModuleType.PORTFOLIO,
              newPortfolio.id
            )
          }

          // If contract URL is provided and user has permission, create contract URL entries for the user
          // Handle comma-separated values
          if (contractUrl && this.canUploadContractDocuments(_user)) {
            const urls = contractUrl
              .split(',')
              .map(url => url.trim())
              .filter(url => url)
            for (const url of urls) {
              await this.contractUrlRepository.create({
                url,
                portfolio_id: newPortfolio.id,
                user_id: _user.id,
                is_active: true
              })
            }
          }

          result.successCount++
          result.successfulImports.push(portfolioName)
        } catch (error) {
          const portfolioName =
            findHeaderValue(row, [
              'Portfolio Name',
              'Portofolio',
              'Portfolio name',
              'Name'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            portfolio: portfolioName,
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

  async bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkUpdateResultDto> {
    // Only internal users can bulk update portfolios
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    if (!isInternal) {
      throw new BadRequestException(
        'Only internal users can bulk update portfolios'
      )
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

      // Helper function to clean column name - removes asterisks and other markers, trims whitespace
      const cleanColumnName = (name: string): string => {
        return name
          .replace(/[*＊✱✲⁎∗]/g, '') // Remove various asterisk characters
          .trim()
          .toLowerCase()
      }

      // Helper function to find header value with flexible naming
      // Handles column names with asterisks (e.g., "Portfolio Name*")
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        const rowKeys = Object.keys(row)

        // Try to find a matching column
        for (const name of possibleNames) {
          const cleanName = cleanColumnName(name)

          for (const key of rowKeys) {
            const cleanKey = cleanColumnName(key)

            if (cleanKey === cleanName) {
              const value = row[key]
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim()
              }
            }
          }
        }

        return undefined
      }

      // Log column headers from first row for debugging
      if (data.length > 0) {
        const firstRow = data[0]
        const columnHeaders = Object.keys(firstRow)
        console.log('Excel column headers:', columnHeaders)
        console.log(
          'Column headers (with char codes):',
          columnHeaders.map(h => ({
            header: h,
            chars: [...h].map(c => c.charCodeAt(0))
          }))
        )
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract Portfolio ID (required)
          const portfolioIdValue = findHeaderValue(row, [
            'Portfolio ID',
            'Portfolio Id',
            'Portfolio id',
            'portfolio_id',
            'ID',
            'Id',
            'id'
          ])

          if (!portfolioIdValue) {
            // Log row keys for debugging
            console.log(`Row ${rowNumber} keys:`, Object.keys(row))
            console.log(`Row ${rowNumber} values:`, row)
            result.errors.push({
              row: rowNumber,
              portfolioId: 'Unknown',
              error: 'Portfolio ID is required'
            })
            result.failureCount++
            continue
          }

          // Validate MongoDB ObjectId format
          if (!QueryBuilder.isValidObjectId(portfolioIdValue)) {
            result.errors.push({
              row: rowNumber,
              portfolioId: portfolioIdValue,
              error:
                'Invalid portfolio ID format (must be a valid MongoDB ObjectId)'
            })
            result.failureCount++
            continue
          }

          // Find existing portfolio
          const existingPortfolio = await this.portfolioRepository.findById(
            portfolioIdValue,
            user.id,
            isSuperAdmin
          )
          if (!existingPortfolio) {
            result.errors.push({
              row: rowNumber,
              portfolioId: portfolioIdValue,
              error: 'Portfolio not found'
            })
            result.failureCount++
            continue
          }

          // Check if user has permission to update this portfolio
          try {
            await this.permissionService.requirePermission(
              user,
              ModuleType.PORTFOLIO,
              PermissionAction.UPDATE,
              portfolioIdValue
            )
          } catch (error) {
            result.errors.push({
              row: rowNumber,
              portfolioId: portfolioIdValue,
              error:
                error.message ||
                'You do not have permission to update this portfolio'
            })
            result.failureCount++
            continue
          }

          // Prepare update data (only include fields that have values)
          const updateData: any = {}

          // Extract portfolio name (if provided)
          const portfolioName = findHeaderValue(row, [
            'Portfolio Name',
            'Portofolio',
            'Portfolio name',
            'Name'
          ])
          if (portfolioName) {
            // Check if name is being changed and if new name already exists
            if (portfolioName !== existingPortfolio.name) {
              const portfolioWithSameName =
                await this.portfolioRepository.findByName(portfolioName)
              if (portfolioWithSameName) {
                result.errors.push({
                  row: rowNumber,
                  portfolioId: portfolioIdValue,
                  error: 'Portfolio with this name already exists'
                })
                result.failureCount++
                continue
              }
            }
            updateData.name = portfolioName
          }

          // Extract service type name (if provided)
          const serviceTypeName = findHeaderValue(row, [
            'Service Type',
            'Service type'
          ])
          if (serviceTypeName) {
            // Find or create service type
            let serviceType =
              await this.serviceTypeRepository.findByType(serviceTypeName)

            if (!serviceType) {
              // Create new service type
              serviceType = await this.serviceTypeRepository.create({
                type: serviceTypeName,
                is_active: true
              })
            }
            updateData.service_type_id = serviceType.id
          }

          // Extract active status (if provided) - map "Active"/"Inactive" to true/false
          const activeStatusRaw = findHeaderValue(row, [
            'Active status',
            'Active Status',
            'Status',
            'Is Active'
          ])
          if (activeStatusRaw) {
            const activeStatusNormalized = activeStatusRaw.toLowerCase().trim()
            if (activeStatusNormalized === 'active') {
              updateData.is_active = true
            } else if (activeStatusNormalized === 'inactive') {
              updateData.is_active = false
            } else {
              result.errors.push({
                row: rowNumber,
                portfolioId: portfolioIdValue,
                error: `Invalid Active status value: "${activeStatusRaw}". Expected "Active" or "Inactive"`
              })
              result.failureCount++
              continue
            }
          }

          // Extract currency (if provided)
          const currency = findHeaderValue(row, [
            'Currency',
            'currency',
            'Currency Code',
            'currency_code'
          ])
          if (currency) {
            updateData.currency = currency
          }

          // Extract contact email (if provided)
          const contactEmail = findHeaderValue(row, [
            'Contact Email',
            'Contact email',
            'Contact'
          ])
          if (contactEmail !== undefined) {
            updateData.contact_email = contactEmail || undefined
          }

          // Extract access email (if provided)
          const accessEmail = findHeaderValue(row, [
            'Access Email',
            'Access email'
          ])
          if (accessEmail !== undefined) {
            updateData.access_email = accessEmail || undefined
          }

          // Extract access phone (if provided)
          const accessPhone = findHeaderValue(row, [
            'Access Phone',
            'Access phone',
            'Access Phone NO',
            'Access Phone No',
            'Access Phone no',
            'Access phone no',
            'Access Contact',
            'Access contact'
          ])
          if (accessPhone !== undefined) {
            updateData.access_phone = accessPhone || undefined
          }

          // Extract contract URL/Documents (if provided)
          const contractUrl = findHeaderValue(row, [
            'Documents',
            'Contract URL',
            'Contract Url',
            'Contract url'
          ])

          // Extract commissionable (if provided) - map "Yes"/"No" to true/false
          const commissionableRaw = findHeaderValue(row, [
            'Commissionable',
            'Is Commissionable',
            'is_commissionable'
          ])
          if (commissionableRaw !== undefined) {
            const commissionableNormalized = commissionableRaw
              .toLowerCase()
              .trim()
            if (commissionableNormalized === 'yes') {
              updateData.is_commissionable = true
            } else if (commissionableNormalized === 'no') {
              updateData.is_commissionable = false
            } else {
              result.errors.push({
                row: rowNumber,
                portfolioId: portfolioIdValue,
                error: `Invalid Commissionable value: "${commissionableRaw}". Expected "Yes" or "No"`
              })
              result.failureCount++
              continue
            }
          }

          // Only update if there's something to update
          if (Object.keys(updateData).length === 0) {
            result.errors.push({
              row: rowNumber,
              portfolioId: portfolioIdValue,
              error: 'No fields to update (all fields are empty)'
            })
            result.failureCount++
            continue
          }

          // Update the portfolio
          await this.portfolioRepository.update(
            portfolioIdValue,
            updateData,
            user.id,
            isSuperAdmin
          )

          // If contract URL is provided and user has permission, create contract URL entries
          if (contractUrl && this.canUploadContractDocuments(user)) {
            const urls = contractUrl
              .split(',')
              .map(url => url.trim())
              .filter(url => url)
            for (const url of urls) {
              await this.contractUrlRepository.create({
                url,
                portfolio_id: portfolioIdValue,
                user_id: user.id,
                is_active: true
              })
            }
          }

          result.successCount++
          result.successfulUpdates.push(portfolioIdValue)
        } catch (error) {
          const portfolioIdValue =
            findHeaderValue(row, [
              'Portfolio ID',
              'Portfolio Id',
              'Portfolio id',
              'portfolio_id',
              'ID',
              'Id',
              'id'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            portfolioId: portfolioIdValue,
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

  async getStats(
    portfolioId: string,
    query: PortfolioStatsQueryDto,
    user: IUserWithPermissions
  ): Promise<PortfolioStatsResponseDto> {
    // Verify portfolio exists and user has access
    const portfolio = await this.portfolioRepository.findById(portfolioId)
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // Check if user has access to this portfolio
    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      accessiblePortfolioIds !== 'all' &&
      Array.isArray(accessiblePortfolioIds) &&
      !accessiblePortfolioIds.includes(portfolioId)
    ) {
      throw new NotFoundException('Portfolio not found')
    }

    // Calculate date range based on duration
    const now = new Date()
    let startDate: Date

    switch (query.duration) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get all property IDs for this portfolio
    const allPropertiesInPortfolio = await this.prisma.property.findMany({
      where: {
        portfolio_id: portfolioId,
        is_active: true
      },
      select: {
        id: true
      }
    })

    // Get user's accessible property IDs
    const accessiblePropertyIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PROPERTY
      )

    // Filter portfolio properties by user's accessible properties
    let propertyIds: string[]
    if (accessiblePropertyIds === 'all') {
      // User has access to all properties
      propertyIds = allPropertiesInPortfolio.map(p => p.id)
    } else if (Array.isArray(accessiblePropertyIds)) {
      // User has partial access - only include properties they can access
      propertyIds = allPropertiesInPortfolio
        .map(p => p.id)
        .filter(id => accessiblePropertyIds.includes(id))
    } else {
      // User has no property access
      propertyIds = []
    }

    if (propertyIds.length === 0) {
      return {
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
        total_audit_count: 0,
        recent_audits: []
      }
    }

    // Get aggregate data for amount collectable and confirmed
    // Filter by audits that were created within the time period
    const auditAggregates = await this.prisma.audit.groupBy({
      by: ['type_of_ota'],
      where: {
        property_id: {
          in: propertyIds
        },
        is_archived: false,
        created_at: {
          gte: startDate,
          lte: now
        }
      },
      _sum: {
        expedia_amount_collectable: true,
        expedia_amount_confirmed: true,
        agoda_amount_collectable: true,
        agoda_amount_confirmed: true,
        booking_amount_collectable: true,
        booking_amount_confirmed: true
      }
    })

    // Get total count from portfolio's tracked import counter
    const totalAuditCount = portfolio.total_audit_count ?? 0

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

    // Process aggregated data - sum across all audits
    auditAggregates.forEach(aggregate => {
      const expediaCollectable = aggregate._sum.expedia_amount_collectable || 0
      const expediaConfirmed = aggregate._sum.expedia_amount_confirmed || 0
      const agodaCollectable = aggregate._sum.agoda_amount_collectable || 0
      const agodaConfirmed = aggregate._sum.agoda_amount_confirmed || 0
      const bookingCollectable = aggregate._sum.booking_amount_collectable || 0
      const bookingConfirmed = aggregate._sum.booking_amount_confirmed || 0

      amountCollectable.expedia += expediaCollectable
      amountConfirmed.expedia += expediaConfirmed
      amountCollectable.agoda += agodaCollectable
      amountConfirmed.agoda += agodaConfirmed
      amountCollectable.booking += bookingCollectable
      amountConfirmed.booking += bookingConfirmed

      amountCollectable.total += expediaCollectable + agodaCollectable + bookingCollectable
      amountConfirmed.total += expediaConfirmed + agodaConfirmed + bookingConfirmed
    })

    // Get recent 10 audits for the portfolio
    const recentAudits = await this.prisma.audit.findMany({
      where: {
        property_id: {
          in: propertyIds
        },
        is_archived: false
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10,
      include: {
        property: {
          select: {
            name: true
          }
        },
        auditStatus: {
          select: {
            status: true
          }
        }
      }
    })

    // Format recent audits for response
    const formattedRecentAudits = recentAudits.map(audit => ({
      id: audit.id,
      type_of_ota: audit.type_of_ota,
      expedia_amount_collectable: audit.expedia_amount_collectable,
      expedia_amount_confirmed: audit.expedia_amount_confirmed,
      agoda_amount_collectable: audit.agoda_amount_collectable,
      agoda_amount_confirmed: audit.agoda_amount_confirmed,
      booking_amount_collectable: audit.booking_amount_collectable,
      booking_amount_confirmed: audit.booking_amount_confirmed,
      property_name: audit.property.name,
      audit_status: audit.auditStatus.status
    }))

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
      total_audit_count: totalAuditCount,
      recent_audits: formattedRecentAudits.map(audit => ({
        ...audit,
        expedia_amount_collectable:
          audit.expedia_amount_collectable !== null &&
          audit.expedia_amount_collectable !== undefined
            ? roundAmount(audit.expedia_amount_collectable)
            : null,
        expedia_amount_confirmed:
          audit.expedia_amount_confirmed !== null &&
          audit.expedia_amount_confirmed !== undefined
            ? roundAmount(audit.expedia_amount_confirmed)
            : null,
        agoda_amount_collectable:
          audit.agoda_amount_collectable !== null &&
          audit.agoda_amount_collectable !== undefined
            ? roundAmount(audit.agoda_amount_collectable)
            : null,
        agoda_amount_confirmed:
          audit.agoda_amount_confirmed !== null &&
          audit.agoda_amount_confirmed !== undefined
            ? roundAmount(audit.agoda_amount_confirmed)
            : null,
        booking_amount_collectable:
          audit.booking_amount_collectable !== null &&
          audit.booking_amount_collectable !== undefined
            ? roundAmount(audit.booking_amount_collectable)
            : null,
        booking_amount_confirmed:
          audit.booking_amount_confirmed !== null &&
          audit.booking_amount_confirmed !== undefined
            ? roundAmount(audit.booking_amount_confirmed)
            : null
      }))
    }
  }
}
