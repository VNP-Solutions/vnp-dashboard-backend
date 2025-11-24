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
import type { IContractUrlRepository } from '../contract-url/contract-url.interface'
import { AttachmentUrlDto, EmailAttachment } from '../email/email.dto'
import { PrismaService } from '../prisma/prisma.service'
import type { IServiceTypeRepository } from '../service-type/service-type.interface'
import {
  BulkImportResultDto,
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
      additionalFilters.is_active = query.is_active
    }

    // External users can only see active portfolios
    if (!userIsSuperAdmin && !userIsInternal) {
      additionalFilters.is_active = true
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

    return QueryBuilder.buildPaginatedResult(
      data,
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
      additionalFilters.is_active = query.is_active
    }

    // External users can only see active portfolios
    if (!userIsSuperAdmin && !userIsInternal) {
      additionalFilters.is_active = true
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

    return data
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
      await this.portfolioRepository.update(
        id,
        { is_active: false },
        user.id,
        isSuperAdmin
      )
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

      // Helper function to find header value with flexible naming
      const findHeaderValue = (
        row: any,
        possibleNames: string[]
      ): string | undefined => {
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim()
          }
        }
        return undefined
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract portfolio name
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
              error: 'Portfolio name is required'
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

          // Extract service type name
          const serviceTypeName = findHeaderValue(row, [
            'Service Type',
            'Service type'
          ])

          if (!serviceTypeName) {
            result.errors.push({
              row: rowNumber,
              portfolio: portfolioName,
              error: 'Service type is required'
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

          // Extract contact email (optional)
          const contactEmail = findHeaderValue(row, [
            'Contact Email',
            'Contact email',
            'Contact'
          ])

          // Extract contract URL (optional)
          const contractUrl = findHeaderValue(row, [
            'Documents',
            'Contract URL',
            'Contract Url',
            'Contract url'
          ])

          // Extract sales agent (instead of commissionable)
          const salesAgent = findHeaderValue(row, [
            'Sales Agent',
            'Sales agent'
          ])

          // If sales agent is provided, portfolio is commissionable
          const isCommissionable = salesAgent ? true : false

          // Extract access email (optional)
          const accessEmail = findHeaderValue(row, [
            'Access Email',
            'Access email'
          ])

          // Extract access phone (optional)
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

          // Create portfolio
          const portfolioData: Omit<CreatePortfolioDto, 'contract_url'> = {
            name: portfolioName,
            service_type_id: serviceType.id,
            is_active: true,
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
      amount_collectable: amountCollectable,
      amount_confirmed: amountConfirmed,
      completed_audit_count: completedAuditCount,
      recent_audits: formattedRecentAudits
    }
  }
}
