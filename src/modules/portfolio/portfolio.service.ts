import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AccessLevel,
  ModuleType
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { COMPLETED_AUDIT_STATUSES } from '../../common/utils/audit.util'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import {
  isInternalUser,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { roundAmount } from '../../common/utils/amount.util'
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

  async create(data: CreatePortfolioDto, user: IUserWithPermissions) {
    const existingPortfolio = await this.portfolioRepository.findByName(
      data.name
    )

    if (existingPortfolio) {
      throw new ConflictException('Portfolio with this name already exists')
    }

    // Validate sales_agent requirement
    if (data.is_commissionable && !data.sales_agent) {
      throw new BadRequestException(
        'Sales agent is required when portfolio is commissionable'
      )
    }

    // Extract contract_url from data before creating portfolio
    const { contract_url, ...portfolioData } = data

    // Check if user is trying to create contract URL
    if (contract_url && !isUserSuperAdmin(user)) {
      throw new BadRequestException(
        'Only Super Admin can upload contract URLs. Please remove the contract_url field or contact a Super Admin.'
      )
    }

    const isSuperAdmin = isUserSuperAdmin(user)
    const portfolio = await this.portfolioRepository.create(
      portfolioData,
      user.id,
      isSuperAdmin
    )

    // If contract_url is provided and user is super admin, create a contract URL entry
    if (contract_url && isSuperAdmin) {
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

    // Re-fetch the portfolio to include the newly created contract URL
    const portfolioWithContractUrls = await this.portfolioRepository.findById(
      portfolio.id,
      user.id,
      isSuperAdmin
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
        isSuperAdmin
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

  async findAllForExport(query: PortfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PORTFOLIO
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

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
      userIsSuperAdmin
    )

    // Add pending action info to each portfolio
    const enrichedData = data.map((portfolio: any) => {
      const pendingActions = portfolio.pendingActions || []

      // Remove pendingActions array from response to avoid duplication
      const {
        pendingActions: _pendingActions,
        ...portfolioWithoutPendingActions
      } = portfolio

      return {
        ...portfolioWithoutPendingActions,
        has_pending_action: pendingActions.length > 0,
        pending_actions: pendingActions
      }
    })

    return enrichedData
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)
    const portfolio = await this.portfolioRepository.findById(
      id,
      user.id,
      isSuperAdmin
    )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // External users cannot see deactivated portfolios
    if (!isSuperAdmin && !isInternal && !portfolio.is_active) {
      throw new NotFoundException('Portfolio not found')
    }

    return portfolio
  }

  async update(
    id: string,
    data: UpdatePortfolioDto,
    user: IUserWithPermissions
  ) {
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

    // Validate sales_agent requirement
    const isCommissionable =
      data.is_commissionable !== undefined
        ? data.is_commissionable
        : portfolio.is_commissionable

    const salesAgent =
      data.sales_agent !== undefined ? data.sales_agent : portfolio.sales_agent

    if (isCommissionable && !salesAgent) {
      throw new BadRequestException(
        'Sales agent is required when portfolio is commissionable'
      )
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

  async deactivate(
    id: string,
    password: string,
    user: IUserWithPermissions,
    reason?: string
  ) {
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    // Only super admin and internal users can deactivate portfolios
    if (!isSuperAdmin && !isInternal) {
      throw new BadRequestException(
        'Only Super Admin and internal users can deactivate portfolios'
      )
    }

    // Internal users (non-super admin) must provide a reason
    if (!isSuperAdmin && isInternal && !reason) {
      throw new BadRequestException(
        'Reason is required for internal users to deactivate portfolios'
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

    // Super admin can deactivate directly
    if (isSuperAdmin) {
      await this.prisma.portfolio.update({
        where: { id },
        data: { is_active: false }
      })
      return { message: 'Portfolio deactivated successfully' }
    }

    // Internal users (non-super admin) need to create a pending action
    // Check if there's already a pending deactivation request
    const existingPendingAction = await this.prisma.pendingAction.findFirst({
      where: {
        portfolio_id: id,
        action_type: 'PORTFOLIO_DEACTIVATE',
        status: 'PENDING'
      }
    })

    if (existingPendingAction) {
      throw new BadRequestException(
        'A deactivation request for this portfolio is already pending approval'
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

    // Only super admin and internal users can activate portfolios
    if (!isSuperAdmin && !isInternal) {
      throw new BadRequestException(
        'Only Super Admin and internal users can activate portfolios'
      )
    }

    // Internal users (non-super admin) must provide a reason
    if (!isSuperAdmin && isInternal && !reason) {
      throw new BadRequestException(
        'Reason is required for internal users to activate portfolios'
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

    // Super admin can activate directly
    if (isSuperAdmin) {
      await this.prisma.portfolio.update({
        where: { id },
        data: { is_active: true }
      })
      return { message: 'Portfolio activated successfully' }
    }

    // Internal users (non-super admin) need to create a pending action
    // Check if there's already a pending activation request
    const existingPendingAction = await this.prisma.pendingAction.findFirst({
      where: {
        portfolio_id: id,
        action_type: 'PORTFOLIO_ACTIVATE',
        status: 'PENDING'
      }
    })

    if (existingPendingAction) {
      throw new BadRequestException(
        'An activation request for this portfolio is already pending approval'
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

    // Log email details for debugging
    console.log('📧 Sending email to portfolio contact:', {
      requestedPortfolioId: id,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      contact_email: portfolio.contact_email,
      access_email: portfolio.access_email,
      sending_to: portfolio.contact_email,
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

    await this.emailUtil.sendEmail(
      portfolio.contact_email,
      subject,
      body,
      allAttachments.length > 0 ? allAttachments : undefined
    )

    return { message: 'Email sent successfully' }
  }

  async bulkImport(
    file: Express.Multer.File,
    _user: IUserWithPermissions
  ): Promise<BulkImportResultDto> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    if (
      !file.originalname.endsWith('.xlsx') &&
      !file.originalname.endsWith('.xls')
    ) {
      throw new BadRequestException(
        'File must be an Excel file (.xlsx or .xls)'
      )
    }

    const result: BulkImportResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulImports: []
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty')
      }

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
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

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

          // Extract sales agent (OPTIONAL)
          const salesAgent = findHeaderValue(row, [
            'Sales Agent',
            'Sales agent'
          ])

          // Validate: If commissionable is true, sales_agent is required
          if (isCommissionable && !salesAgent) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Sales Agent is required when portfolio is commissionable'
            })
            result.failureCount++
            continue
          }

          // Create portfolio
          const portfolioData: Omit<CreatePortfolioDto, 'contract_url'> = {
            name: portfolioName,
            service_type_id: serviceType.id,
            currency: currency,
            is_active: isActive,
            contact_email: contactEmail || undefined,
            is_commissionable: isCommissionable,
            sales_agent: salesAgent || undefined,
            access_email: accessEmail || undefined,
            access_phone: accessPhone || undefined
          }

          const newPortfolio = await this.portfolioRepository.create(
            portfolioData,
            _user.id
          )

          // If contract URL is provided, create contract URL entries for the user
          // Handle comma-separated values
          // Only super admin can create contract URLs
          if (contractUrl && isUserSuperAdmin(_user)) {
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
    // Only super admins and internal users can bulk update portfolios
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    if (!isSuperAdmin && !isInternal) {
      throw new BadRequestException(
        'Only Super Admin and internal users can bulk update portfolios'
      )
    }

    if (!file) {
      throw new BadRequestException('No file provided')
    }

    if (
      !file.originalname.endsWith('.xlsx') &&
      !file.originalname.endsWith('.xls')
    ) {
      throw new BadRequestException(
        'File must be an Excel file (.xlsx or .xls)'
      )
    }

    const result: BulkUpdateResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulUpdates: []
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file is empty')
      }

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
        const firstRow = data[0] as any
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
        const row = data[i] as any
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

          // Extract sales agent (if provided)
          const salesAgent = findHeaderValue(row, [
            'Sales Agent',
            'Sales agent'
          ])
          if (salesAgent !== undefined) {
            updateData.sales_agent = salesAgent || undefined
          }

          // Validate: If commissionable is true, sales_agent is required
          const isCommissionable =
            updateData.is_commissionable !== undefined
              ? updateData.is_commissionable
              : existingPortfolio.is_commissionable

          const finalSalesAgent =
            updateData.sales_agent !== undefined
              ? updateData.sales_agent
              : existingPortfolio.sales_agent

          if (isCommissionable && !finalSalesAgent) {
            result.errors.push({
              row: rowNumber,
              portfolioId: portfolioIdValue,
              error: 'Sales Agent is required when portfolio is commissionable'
            })
            result.failureCount++
            continue
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

          // If contract URL is provided and user is super admin, create contract URL entries
          if (contractUrl && isSuperAdmin) {
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
        completed_audit_count: 0,
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
        amount_collectable: true,
        amount_confirmed: true
      }
    })

    // Get count of completed audits within the duration
    const completedAuditCount = await this.prisma.audit.count({
      where: {
        property_id: {
          in: propertyIds
        },
        is_archived: false,
        created_at: {
          gte: startDate,
          lte: now
        },
        auditStatus: {
          status: {
            in: COMPLETED_AUDIT_STATUSES
          }
        }
      }
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

    // Process aggregated data
    auditAggregates.forEach(aggregate => {
      const collectableAmount = aggregate._sum.amount_collectable || 0
      const confirmedAmount = aggregate._sum.amount_confirmed || 0

      amountCollectable.total += collectableAmount
      amountConfirmed.total += confirmedAmount

      if (aggregate.type_of_ota === 'expedia') {
        amountCollectable.expedia += collectableAmount
        amountConfirmed.expedia += confirmedAmount
      } else if (aggregate.type_of_ota === 'booking') {
        amountCollectable.booking += collectableAmount
        amountConfirmed.booking += confirmedAmount
      } else if (aggregate.type_of_ota === 'agoda') {
        amountCollectable.agoda += collectableAmount
        amountConfirmed.agoda += confirmedAmount
      }
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
      amount_collectable: audit.amount_collectable,
      amount_confirmed: audit.amount_confirmed,
      start_date: audit.start_date,
      end_date: audit.end_date,
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
      completed_audit_count: completedAuditCount,
      recent_audits: formattedRecentAudits.map(audit => ({
        ...audit,
        amount_collectable: audit.amount_collectable !== null && audit.amount_collectable !== undefined
          ? roundAmount(audit.amount_collectable)
          : null,
        amount_confirmed: audit.amount_confirmed !== null && audit.amount_confirmed !== undefined
          ? roundAmount(audit.amount_confirmed)
          : null
      }))
    }
  }
}
