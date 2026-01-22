import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BankType } from '@prisma/client'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AccessLevel,
  ModuleType
} from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import {
  canCreateBankDetails,
  canReadBankDetails,
  canUpdateBankDetails,
  canPerformBulkTransfer,
  isInternalUser,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { roundAmount } from '../../common/utils/amount.util'
import { Configuration } from '../../config/configuration'
import type { ICurrencyRepository } from '../currency/currency.interface'
import type { IPendingActionRepository } from '../pending-action/pending-action.interface'
import type { IPortfolioRepository } from '../portfolio/portfolio.interface'
import type { IPropertyBankDetailsRepository } from '../property-bank-details/property-bank-details.interface'
import type { IPropertyCredentialsRepository } from '../property-credentials/property-credentials.interface'
import {
  BulkImportResultDto,
  BulkTransferPropertyDto,
  BulkUpdateResultDto,
  CompleteCreatePropertyDto,
  CompleteUpdatePropertyDto,
  CreatePropertyDto,
  GetPropertiesByPortfoliosDto,
  PropertyQueryDto,
  PropertyStatsResponseDto,
  SharePropertyDto,
  TransferPropertyDto,
  UnsharePropertyDto,
  UpdatePropertyDto
} from './property.dto'
import type {
  IPropertyRepository,
  IPropertyService
} from './property.interface'

@Injectable()
export class PropertyService implements IPropertyService {
  constructor(
    @Inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository,
    @Inject('IPortfolioRepository')
    private portfolioRepository: IPortfolioRepository,
    @Inject('ICurrencyRepository')
    private currencyRepository: ICurrencyRepository,
    @Inject('IPropertyCredentialsRepository')
    private credentialsRepository: IPropertyCredentialsRepository,
    @Inject('IPropertyBankDetailsRepository')
    private bankDetailsRepository: IPropertyBankDetailsRepository,
    @Inject(forwardRef(() => 'IPendingActionRepository'))
    private pendingActionRepository: IPendingActionRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil
  ) {}

  async create(data: CreatePropertyDto, user: IUserWithPermissions) {
    const existingProperty = await this.propertyRepository.findByName(data.name)

    if (existingProperty) {
      throw new ConflictException('Property with this name already exists')
    }

    // Validate portfolio exists
    const portfolio = await this.portfolioRepository.findById(data.portfolio_id)
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    const property = await this.propertyRepository.create(data)

    // If user has partial access, grant them access to the created property
    const permission = user.role.property_permission
    if (permission?.access_level === AccessLevel.partial) {
      await this.permissionService.grantResourceAccess(
        user.id,
        ModuleType.PROPERTY,
        property.id
      )
    }

    return property
  }

  async completeCreate(
    data: CompleteCreatePropertyDto,
    user: IUserWithPermissions
  ) {
    // Validate property name is unique
    const existingProperty = await this.propertyRepository.findByName(
      data.property.name
    )

    if (existingProperty) {
      throw new ConflictException('Property with this name already exists')
    }

    // Validate portfolio exists
    const portfolio = await this.portfolioRepository.findById(
      data.property.portfolio_id
    )
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    // Validate currency exists
    const currency = await this.currencyRepository.findById(
      data.property.currency_id
    )
    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    // Check if user has permission to create bank details
    // If not, skip bank_details creation silently
    const bankDetailsToCreate = canCreateBankDetails(user)
      ? data.bank_details
      : undefined

    // Create property with credentials and bank details in a transaction
    const property = await this.propertyRepository.completeCreate(
      data.property,
      data.credentials,
      bankDetailsToCreate,
      user.id
    )

    // If user has partial access, grant them access to the created property
    const permission = user.role.property_permission
    if (permission?.access_level === AccessLevel.partial) {
      await this.permissionService.grantResourceAccess(
        user.id,
        ModuleType.PROPERTY,
        property.id
      )
    }

    return property
  }

  async completeUpdate(
    id: string,
    data: CompleteUpdatePropertyDto,
    user: IUserWithPermissions
  ) {
    // Validate property exists
    const property = await this.propertyRepository.findById(id)
    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check ownership: Only the owner portfolio can update the property
    await this.validatePropertyOwnership(property, user)

    // Validate property name uniqueness if being updated
    if (data.property?.name && data.property.name !== property.name) {
      const existingProperty = await this.propertyRepository.findByName(
        data.property.name
      )
      if (existingProperty) {
        throw new ConflictException('Property with this name already exists')
      }
    }

    // Validate portfolio exists if being updated
    if (
      data.property?.portfolio_id &&
      data.property.portfolio_id !== property.portfolio_id
    ) {
      const portfolio = await this.portfolioRepository.findById(
        data.property.portfolio_id
      )
      if (!portfolio) {
        throw new NotFoundException('Portfolio not found')
      }
    }

    // Validate currency exists if being updated
    if (
      data.property?.currency_id &&
      data.property.currency_id !== property.currency_id
    ) {
      const currency = await this.currencyRepository.findById(
        data.property.currency_id
      )
      if (!currency) {
        throw new NotFoundException('Currency not found')
      }
    }

    // Check if user has permission to update bank details
    // If not, skip bank_details update silently
    const bankDetailsToUpdate = canUpdateBankDetails(user)
      ? data.bank_details
      : undefined

    // Update property with credentials and bank details in a transaction
    return this.propertyRepository.completeUpdate(
      id,
      data.property,
      data.credentials,
      bankDetailsToUpdate,
      user.id
    )
  }

  async findAll(query: PropertyQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
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
    } else {
      // Filter out deactivated properties for non-super-admins and non-internal users
      if (!isUserSuperAdmin(user) && !isInternalUser(user)) {
        additionalFilters.is_active = true
      }
    }
    if (query.bank_type) {
      additionalFilters.bank_type = query.bank_type
    }
    // Handle portfolio_id filter with shared properties support
    let portfolioFilter: any = {}
    if (query.portfolio_id) {
      // Include both owned properties and shared properties for this portfolio
      portfolioFilter = {
        OR: [
          { portfolio_id: query.portfolio_id },
          { show_in_portfolio: { has: query.portfolio_id } }
        ]
      }
    }

    // Merge with existing filters - EXCLUDE portfolio_id as it's handled separately
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    // Note: credentials.expedia_id is handled separately below with proper Prisma 'is' syntax for one-to-one relations
    const queryConfig = {
      searchFields: [
        'id',
        'name',
        'address',
        'card_descriptor',
        'portfolio.name',
        'currency.code',
        'currency.name'
      ],
      filterableFields: [
        'is_active',
        'bank_type',
        // 'portfolio_id' removed - handled separately with OR logic for shared properties
        'currency_id'
      ],
      sortableFields: [
        'name',
        'address',
        'card_descriptor',
        'next_due_date',
        'created_at',
        'updated_at',
        'is_active',
        'portfolio.name',
        'currency.code'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        currency_code: 'currency.code',
        bank_type: 'bankDetails.bank_type'
      }
    }

    // Build Prisma query options WITHOUT portfolio filter first
    const queryResult = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    )
    let where = queryResult.where
    const { skip, take, orderBy } = queryResult

    // Add credentials.expedia_id search if search term is provided
    // This uses proper Prisma 'is' syntax for one-to-one optional relations
    if (query.search && !QueryBuilder.shouldIgnoreValue(query.search)) {
      const searchTerm = query.search
      // Add credentials.expedia_id to the OR conditions if they exist
      if (where.OR && Array.isArray(where.OR)) {
        where.OR.push({
          credentials: {
            is: {
              expedia_id: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            }
          }
        })
      } else if (Object.keys(where).length === 0) {
        // No existing conditions, create OR with just credentials search
        where = {
          OR: [
            {
              credentials: {
                is: {
                  expedia_id: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                }
              }
            }
          ]
        }
      } else {
        // Existing conditions but no OR, need to restructure
        // The search should already have created OR conditions, but handle edge case
        const existingConditions = { ...where }
        where = {
          AND: [
            existingConditions,
            {
              OR: [
                {
                  credentials: {
                    is: {
                      expedia_id: {
                        contains: searchTerm,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    }

    // Manually add portfolio filter to ensure it's properly combined with search/filters
    if (Object.keys(portfolioFilter).length > 0) {
      // If where has conditions (search or filters), wrap everything in AND
      if (Object.keys(where).length > 0) {
        where = {
          AND: [where, portfolioFilter]
        }
      } else {
        // No other conditions, just use portfolio filter
        where = portfolioFilter
      }
    }

    // Handle credential_type filter for credentials
    // Filter properties based on which OTA credentials they have
    if (
      query.credential_type &&
      query.credential_type.toLowerCase() !== 'all'
    ) {
      const credentialType = query.credential_type.toLowerCase()

      // Use gt: '' to check field is not null AND not empty (works for MongoDB string fields)
      if (credentialType === 'full') {
        // All three IDs must exist and be non-empty
        where = {
          ...where,
          credentials: {
            is: {
              expedia_id: { gt: '' },
              agoda_id: { gt: '' },
              booking_id: { gt: '' }
            }
          }
        }
      } else if (credentialType === 'expedia') {
        where = {
          ...where,
          credentials: {
            is: {
              expedia_id: { gt: '' }
            }
          }
        }
      } else if (credentialType === 'booking') {
        where = {
          ...where,
          credentials: {
            is: {
              booking_id: { gt: '' }
            }
          }
        }
      } else if (credentialType === 'agoda') {
        where = {
          ...where,
          credentials: {
            is: {
              agoda_id: { gt: '' }
            }
          }
        }
      }
    }

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.propertyRepository.findAll(
        { where, skip, take, orderBy },
        undefined
      ),
      this.propertyRepository.count(where, undefined)
    ])

    // Get encryption secret for decrypting passwords
    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    // Add access_type field, viewing context, and pending action info to each property
    // Also decrypt credential passwords
    const enrichedData = data.map((property: any) => {
      const isShared =
        query.portfolio_id && property.portfolio_id !== query.portfolio_id
      const accessType = isShared ? 'shared' : 'owned'

      // Add pending action info if exists
      const pendingActions = property.pendingActions || []

      // Remove pendingActions array from response to avoid duplication
      const {
        pendingActions: _pendingActions,
        ...propertyWithoutPendingActions
      } = property

      // Decrypt credential passwords if credentials exist
      let decryptedCredentials = propertyWithoutPendingActions.credentials
      if (decryptedCredentials) {
        decryptedCredentials = { ...decryptedCredentials }

        // Decrypt Expedia password
        if (decryptedCredentials.expedia_password) {
          try {
            decryptedCredentials.expedia_password = EncryptionUtil.decrypt(
              decryptedCredentials.expedia_password,
              encryptionSecret
            )
          } catch {
            // If decryption fails, keep the original value
          }
        }

        // Decrypt Agoda password
        if (decryptedCredentials.agoda_password) {
          try {
            decryptedCredentials.agoda_password = EncryptionUtil.decrypt(
              decryptedCredentials.agoda_password,
              encryptionSecret
            )
          } catch {
            // If decryption fails, keep the original value
          }
        }

        // Decrypt Booking password
        if (decryptedCredentials.booking_password) {
          try {
            decryptedCredentials.booking_password = EncryptionUtil.decrypt(
              decryptedCredentials.booking_password,
              encryptionSecret
            )
          } catch {
            // If decryption fails, keep the original value
          }
        }
      }

      // Filter bank details based on user permission
      // If user doesn't have READ permission for bank_details, set bankDetails to null
      const filteredBankDetails = canReadBankDetails(user)
        ? propertyWithoutPendingActions.bankDetails
        : null

      return {
        ...propertyWithoutPendingActions,
        credentials: decryptedCredentials,
        bankDetails: filteredBankDetails,
        access_type: accessType,
        // Add viewing_portfolio_id for shared properties (the portfolio context user is viewing from)
        viewing_portfolio_id: isShared
          ? query.portfolio_id
          : property.portfolio_id,
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

  async findAllForExport(query: PropertyQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
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
    } else {
      // Filter out deactivated properties for non-super-admins and non-internal users
      if (!isUserSuperAdmin(user) && !isInternalUser(user)) {
        additionalFilters.is_active = true
      }
    }
    if (query.bank_type) {
      additionalFilters.bank_type = query.bank_type
    }

    // Handle portfolio_id filter with shared properties support
    let portfolioFilter: any = {}
    if (query.portfolio_id) {
      // Include both owned properties and shared properties for this portfolio
      portfolioFilter = {
        OR: [
          { portfolio_id: query.portfolio_id },
          { show_in_portfolio: { has: query.portfolio_id } }
        ]
      }
    }

    // Merge with existing filters - EXCLUDE portfolio_id as it's handled separately
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    // Note: credentials.expedia_id is handled separately below with proper Prisma 'is' syntax for one-to-one relations
    const queryConfig = {
      searchFields: [
        'id',
        'name',
        'address',
        'card_descriptor',
        'portfolio.name',
        'currency.code',
        'currency.name'
      ],
      filterableFields: [
        'is_active',
        'bank_type',
        // 'portfolio_id' removed - handled separately with OR logic for shared properties
        'currency_id'
      ],
      sortableFields: [
        'name',
        'address',
        'card_descriptor',
        'next_due_date',
        'created_at',
        'updated_at',
        'is_active',
        'portfolio.name',
        'currency.code'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        currency_code: 'currency.code',
        bank_type: 'bankDetails.bank_type'
      }
    }

    // Build Prisma query options WITHOUT portfolio filter first
    const queryResult = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    )
    let where = queryResult.where
    const { orderBy } = queryResult

    // Add credentials.expedia_id search if search term is provided
    // This uses proper Prisma 'is' syntax for one-to-one optional relations
    if (query.search && !QueryBuilder.shouldIgnoreValue(query.search)) {
      const searchTerm = query.search
      // Add credentials.expedia_id to the OR conditions if they exist
      if (where.OR && Array.isArray(where.OR)) {
        where.OR.push({
          credentials: {
            is: {
              expedia_id: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            }
          }
        })
      } else if (Object.keys(where).length === 0) {
        // No existing conditions, create OR with just credentials search
        where = {
          OR: [
            {
              credentials: {
                is: {
                  expedia_id: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                }
              }
            }
          ]
        }
      } else {
        // Existing conditions but no OR, need to restructure
        // The search should already have created OR conditions, but handle edge case
        const existingConditions = { ...where }
        where = {
          AND: [
            existingConditions,
            {
              OR: [
                {
                  credentials: {
                    is: {
                      expedia_id: {
                        contains: searchTerm,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    }

    // Manually add portfolio filter to ensure it's properly combined with search/filters
    if (Object.keys(portfolioFilter).length > 0) {
      // If where has conditions (search or filters), wrap everything in AND
      if (Object.keys(where).length > 0) {
        where = {
          AND: [where, portfolioFilter]
        }
      } else {
        // No other conditions, just use portfolio filter
        where = portfolioFilter
      }
    }

    // Handle credential_type filter for credentials
    // Filter properties based on which OTA credentials they have
    if (
      query.credential_type &&
      query.credential_type.toLowerCase() !== 'all'
    ) {
      const credentialType = query.credential_type.toLowerCase()

      // Use gt: '' to check field is not null AND not empty (works for MongoDB string fields)
      if (credentialType === 'full') {
        // All three IDs must exist and be non-empty
        where = {
          ...where,
          credentials: {
            is: {
              expedia_id: { gt: '' },
              agoda_id: { gt: '' },
              booking_id: { gt: '' }
            }
          }
        }
      } else if (credentialType === 'expedia') {
        where = {
          ...where,
          credentials: {
            is: {
              expedia_id: { gt: '' }
            }
          }
        }
      } else if (credentialType === 'booking') {
        where = {
          ...where,
          credentials: {
            is: {
              booking_id: { gt: '' }
            }
          }
        }
      } else if (credentialType === 'agoda') {
        where = {
          ...where,
          credentials: {
            is: {
              agoda_id: { gt: '' }
            }
          }
        }
      }
    }

    // Fetch all data without pagination
    const data = await this.propertyRepository.findAll(
      { where, orderBy },
      undefined
    )

    // Get encryption secret for decrypting passwords
    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!

    // Add access_type field and pending action info to each property
    // Also decrypt credential passwords for export
    const enrichedData = data.map((property: any) => {
      const isShared =
        query.portfolio_id && property.portfolio_id !== query.portfolio_id
      const accessType = isShared ? 'shared' : 'owned'

      // Add pending action info if exists
      const pendingActions = property.pendingActions || []

      // Remove pendingActions array from response to avoid duplication
      const {
        pendingActions: _pendingActions,
        ...propertyWithoutPendingActions
      } = property

      // Decrypt credential passwords if credentials exist
      let decryptedCredentials = propertyWithoutPendingActions.credentials
      if (decryptedCredentials) {
        decryptedCredentials = { ...decryptedCredentials }

        // Decrypt Expedia password
        if (decryptedCredentials.expedia_password) {
          try {
            decryptedCredentials.expedia_password = EncryptionUtil.decrypt(
              decryptedCredentials.expedia_password,
              encryptionSecret
            )
          } catch {
            // If decryption fails, keep the original value
          }
        }

        // Decrypt Agoda password
        if (decryptedCredentials.agoda_password) {
          try {
            decryptedCredentials.agoda_password = EncryptionUtil.decrypt(
              decryptedCredentials.agoda_password,
              encryptionSecret
            )
          } catch {
            // If decryption fails, keep the original value
          }
        }

        // Decrypt Booking password
        if (decryptedCredentials.booking_password) {
          try {
            decryptedCredentials.booking_password = EncryptionUtil.decrypt(
              decryptedCredentials.booking_password,
              encryptionSecret
            )
          } catch {
            // If decryption fails, keep the original value
          }
        }
      }

      // Filter bank details based on user permission
      // If user doesn't have READ permission for bank_details, set bankDetails to null
      const filteredBankDetails = canReadBankDetails(user)
        ? propertyWithoutPendingActions.bankDetails
        : null

      return {
        ...propertyWithoutPendingActions,
        credentials: decryptedCredentials,
        bankDetails: filteredBankDetails,
        access_type: accessType,
        // Add viewing_portfolio_id for shared properties (the portfolio context user is viewing from)
        viewing_portfolio_id: isShared
          ? query.portfolio_id
          : property.portfolio_id,
        has_pending_action: pendingActions.length > 0,
        pending_actions: pendingActions
      }
    })

    return enrichedData
  }

  async getPropertiesByPortfolios(
    data: GetPropertiesByPortfoliosDto,
    user: IUserWithPermissions
  ) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    // Build base where clause with permission filter
    const baseWhere: any =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // If portfolio_ids is empty, return all accessible properties
    if (data.portfolio_ids.length === 0) {
      const queryOptions = {
        where: baseWhere,
        orderBy: { created_at: 'desc' as const }
      }

      const properties = await this.propertyRepository.findAll(
        queryOptions,
        undefined
      )

      // Add access_type field to each property and filter bank details based on permission
      return properties.map((property: any) => ({
        ...property,
        bankDetails: canReadBankDetails(user) ? property.bankDetails : null,
        access_type: 'owned' as const
      }))
    }

    // Filter by specific portfolio IDs (include both owned and shared properties)
    const portfolioFilter = {
      OR: [
        // Properties owned by the specified portfolios
        { portfolio_id: { in: data.portfolio_ids } },
        // Properties shared with the specified portfolios
        {
          show_in_portfolio: {
            hasSome: data.portfolio_ids
          }
        }
      ]
    }

    const whereClause = {
      ...baseWhere,
      ...portfolioFilter
    }

    const queryOptions = {
      where: whereClause,
      orderBy: { created_at: 'desc' as const }
    }

    const properties = await this.propertyRepository.findAll(
      queryOptions,
      undefined
    )

    // Add access_type field to each property and filter bank details based on permission
    return properties.map((property: any) => {
      const accessType = data.portfolio_ids.includes(property.portfolio_id)
        ? 'owned'
        : 'shared'
      return {
        ...property,
        bankDetails: canReadBankDetails(user) ? property.bankDetails : null,
        access_type: accessType
      }
    })
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Determine access type based on user's accessible portfolios
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    // Check if user has access to this property
    if (
      accessibleIds !== 'all' &&
      Array.isArray(accessibleIds) &&
      !accessibleIds.includes(id)
    ) {
      throw new NotFoundException('Property not found')
    }

    // Hide deactivated properties from non-super-admins and non-internal users
    if (
      !property.is_active &&
      !isUserSuperAdmin(user) &&
      !isInternalUser(user)
    ) {
      throw new NotFoundException('Property not found')
    }

    // Add access_type field - for findOne, we consider it owned if it's in user's portfolio
    // This is a simplified approach; you may want to add portfolio context if needed
    // Filter bank details based on user permission
    return {
      ...property,
      bankDetails: canReadBankDetails(user) ? property.bankDetails : null,
      access_type: 'owned' as const
    }
  }

  async update(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check ownership: Only the owner portfolio can update the property
    await this.validatePropertyOwnership(property, user)

    if (data.name && data.name !== property.name) {
      const existingProperty = await this.propertyRepository.findByName(
        data.name
      )

      if (existingProperty) {
        throw new ConflictException('Property with this name already exists')
      }
    }

    // If portfolio_id is being updated, validate it exists
    if (data.portfolio_id && data.portfolio_id !== property.portfolio_id) {
      const portfolio = await this.portfolioRepository.findById(
        data.portfolio_id
      )
      if (!portfolio) {
        throw new NotFoundException('Portfolio not found')
      }
    }

    return this.propertyRepository.update(id, data)
  }

  async transfer(
    id: string,
    data: TransferPropertyDto,
    user: IUserWithPermissions
  ) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check ownership: Only the owner portfolio can transfer the property
    await this.validatePropertyOwnership(property, user)

    // Validate the new portfolio exists
    const newPortfolio = await this.portfolioRepository.findById(
      data.new_portfolio_id
    )
    if (!newPortfolio) {
      throw new NotFoundException('Target portfolio not found')
    }

    // Check if property is already in the target portfolio
    if (property.portfolio_id === data.new_portfolio_id) {
      throw new BadRequestException(
        'Property is already in the target portfolio'
      )
    }

    const isSuperAdmin = isUserSuperAdmin(user)

    // Non-super admin users must provide a reason
    if (!isSuperAdmin && !data.reason) {
      throw new BadRequestException(
        'Reason is required for non-super admin users to transfer properties'
      )
    }

    // Super admin can directly transfer
    if (isSuperAdmin) {
      const updatedProperty = await this.propertyRepository.update(id, {
        portfolio_id: data.new_portfolio_id,
        previous_portfolio_id: property.portfolio_id
      })

      // Update user access after property transfer
      await this.permissionService.updateUserAccessAfterPropertyTransfer(
        id,
        data.new_portfolio_id
      )

      // Send transfer notification email to both portfolio contact emails
      try {
        // Get current portfolio details
        const currentPortfolio = await this.portfolioRepository.findById(
          property.portfolio_id
        )

        const recipientEmails: string[] = []

        // Add current portfolio contact email if exists
        if (currentPortfolio?.contact_email) {
          recipientEmails.push(currentPortfolio.contact_email)
        }

        // Add new portfolio contact email if exists
        if (newPortfolio.contact_email) {
          recipientEmails.push(newPortfolio.contact_email)
        }

        await this.emailUtil.sendPropertyTransferEmail(
          recipientEmails,
          property.name,
          newPortfolio.name,
          new Date()
        )
      } catch (emailError) {
        // Log the error but don't fail the transfer
        console.error('Failed to send property transfer email:', emailError)
      }

      return updatedProperty
    }

    // Property manager (with ownership rights) creates pending action for approval
    // Get current portfolio details for history
    const currentPortfolio = property.portfolio
      ? {
          id: property.portfolio.id,
          name: property.portfolio.name
        }
      : undefined

    const pendingAction = await this.pendingActionRepository.create({
      resource_type: 'property',
      property_id: id,
      action_type: 'PROPERTY_TRANSFER',
      requested_user_id: user.id,
      transfer_data: {
        new_portfolio_id: data.new_portfolio_id,
        portfolio_from: currentPortfolio,
        portfolio_to: {
          id: newPortfolio.id,
          name: newPortfolio.name
        }
      },
      reason: data.reason
    })

    return {
      message:
        'Transfer request submitted for approval. A super admin will review your request.',
      pending_action: pendingAction
    }
  }

  async bulkTransfer(
    data: BulkTransferPropertyDto,
    user: IUserWithPermissions
  ) {
    // Validate the target portfolio exists
    const targetPortfolio = await this.portfolioRepository.findById(
      data.new_portfolio_id
    )
    if (!targetPortfolio) {
      throw new NotFoundException('Target portfolio not found')
    }

    // Validate properties exist
    if (!data.property_ids || data.property_ids.length === 0) {
      throw new BadRequestException('At least one property ID is required')
    }

    // Only super admins or internal property/portfolio managers can perform bulk transfers
    if (!canPerformBulkTransfer(user)) {
      throw new ForbiddenException(
        'Only super admins or internal property/portfolio managers can perform bulk transfers. Please transfer properties one at a time or contact a super admin.'
      )
    }

    // Perform bulk transfer
    const results: Array<{
      property_id: string
      success: boolean
      message?: string
    }> = []
    let successCount = 0
    let failedCount = 0

    // Process each property
    for (const propertyId of data.property_ids) {
      try {
        // Find the property
        const property = await this.propertyRepository.findById(propertyId)

        if (!property) {
          results.push({
            property_id: propertyId,
            success: false,
            message: 'Property not found'
          })
          failedCount++
          continue
        }

        // Check if property is already in the target portfolio
        if (property.portfolio_id === data.new_portfolio_id) {
          results.push({
            property_id: propertyId,
            success: false,
            message: 'Property is already in the target portfolio'
          })
          failedCount++
          continue
        }

        // Transfer the property - preserve old portfolio
        await this.propertyRepository.update(propertyId, {
          portfolio_id: data.new_portfolio_id,
          previous_portfolio_id: property.portfolio_id
        })

        // Update user access after property transfer
        await this.permissionService.updateUserAccessAfterPropertyTransfer(
          propertyId,
          data.new_portfolio_id
        )

        results.push({
          property_id: propertyId,
          success: true
        })
        successCount++
      } catch (error) {
        results.push({
          property_id: propertyId,
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

  async remove(id: string, user: IUserWithPermissions) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Only super admins can delete properties
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can delete properties')
    }

    // Check if there are any unarchived audits
    const unarchivedAuditCount = await this.prisma.audit.count({
      where: {
        property_id: id,
        is_archived: false
      }
    })

    if (unarchivedAuditCount > 0) {
      throw new BadRequestException(
        `Cannot delete property. It has ${unarchivedAuditCount} unarchived audit${unarchivedAuditCount === 1 ? '' : 's'}. Please archive all audits before deleting the property.`
      )
    }

    // Delete the property
    await this.propertyRepository.delete(id)
    return { message: 'Property deleted successfully' }
  }

  async deactivate(id: string, user: IUserWithPermissions, reason?: string) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check if property is already deactivated
    if (!property.is_active) {
      throw new BadRequestException('Property is already deactivated')
    }

    const isSuperAdmin = isUserSuperAdmin(user)

    // Non-super admin users must provide a reason
    if (!isSuperAdmin && !reason) {
      throw new BadRequestException(
        'Reason is required to request property deactivation'
      )
    }

    // Super admins can directly deactivate
    if (isSuperAdmin) {
      await this.prisma.property.update({
        where: { id },
        data: { is_active: false }
      })
      return { message: 'Property deactivated successfully' }
    }

    // All other users (internal and external) create pending action for approval
    const pendingAction = await this.pendingActionRepository.create({
      resource_type: 'property',
      property_id: id,
      action_type: 'PROPERTY_DEACTIVATE',
      requested_user_id: user.id,
      reason: reason
    })

    return {
      message:
        'Deactivation request submitted for approval. A super admin will review your request.',
      pending_action: pendingAction
    }
  }

  async activate(id: string, user: IUserWithPermissions, reason?: string) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check if property is already active
    if (property.is_active) {
      throw new BadRequestException('Property is already active')
    }

    const isSuperAdmin = isUserSuperAdmin(user)

    // Non-super admin users must provide a reason
    if (!isSuperAdmin && !reason) {
      throw new BadRequestException(
        'Reason is required to request property activation'
      )
    }

    // Super admins can directly activate
    if (isSuperAdmin) {
      await this.prisma.property.update({
        where: { id },
        data: { is_active: true }
      })
      return { message: 'Property activated successfully' }
    }

    // All other users (internal and external) create pending action for approval
    const pendingAction = await this.pendingActionRepository.create({
      resource_type: 'property',
      property_id: id,
      action_type: 'PROPERTY_ACTIVATE',
      requested_user_id: user.id,
      reason: reason
    })

    return {
      message:
        'Activation request submitted for approval. A super admin will review your request.',
      pending_action: pendingAction
    }
  }

  async bulkImport(
    file: Express.Multer.File,
    user: IUserWithPermissions
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

      console.log(`📊 Starting bulk import of ${result.totalRows} properties...`)

      // Helper function to add error and log it
      const addError = (row: number, property: string, errorMessage: string) => {
        result.errors.push({
          row,
          property,
          error: errorMessage
        })
        result.failureCount++
        console.error(`❌ Row ${row} - Property "${property}": ${errorMessage}`)
      }

      // Helper function to log success
      const logSuccess = (row: number, property: string, action: 'created' | 'updated') => {
        console.log(`✅ Row ${row} - Property "${property}" ${action} successfully`)
      }

      // Helper function to clean column name - removes asterisks and other markers, trims whitespace
      const cleanColumnName = (name: string): string => {
        return name
          .replace(/[*＊✱✲⁎∗]/g, '') // Remove various asterisk characters
          .trim()
          .toLowerCase()
      }

      // Helper function to find header value with flexible naming
      // Handles column names with asterisks (e.g., "Property Name*")
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

      // Helper function to get raw value (preserves type for dates and numbers)
      // Handles column names with asterisks (e.g., "Property Name*")
      const getRawValue = (row: any, possibleNames: string[]): any => {
        const rowKeys = Object.keys(row)

        // Try to find a matching column
        for (const name of possibleNames) {
          const cleanName = cleanColumnName(name)

          for (const key of rowKeys) {
            const cleanKey = cleanColumnName(key)

            if (cleanKey === cleanName) {
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

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any
        const rowNumber = i + 2 // Excel row number (header is row 1)

        try {
          // Extract property name (REQUIRED)
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Name'
          ])

          if (!propertyName) {
            addError(rowNumber, 'Unknown', 'Property Name is required')
            continue
          }

          // Check if property already exists
          const existingProperty =
            await this.propertyRepository.findByName(propertyName)

          // Extract property address (OPTIONAL, will use empty string if not provided)
          const address =
            findHeaderValue(row, ['Address', 'Property Address']) || ''

          // Extract currency code (REQUIRED) - now called "Property Currency"
          const currencyCode = findHeaderValue(row, [
            'Property Currency',
            'Currency',
            'Currency Code'
          ])
          if (!currencyCode) {
            addError(rowNumber, propertyName, 'Property Currency is required')
            continue
          }

          // Find or create currency
          let currency = await this.currencyRepository.findByCode(currencyCode)

          if (!currency) {
            // Create new currency with code as name
            currency = await this.currencyRepository.create({
              code: currencyCode,
              name: currencyCode,
              symbol: currencyCode,
              is_active: true
            })
          }

          // Extract card descriptor (optional)
          const cardDescriptor = findHeaderValue(row, [
            'Card Descriptor',
            'Card descriptor',
            'Descriptor'
          ])

          // Extract next due date (optional) - use raw value to preserve Excel date format
          const nextDueDateValue = getRawValue(row, [
            'Next Due Date',
            'Next due date',
            'Due Date'
          ])
          let nextDueDate: Date | null = null

          if (nextDueDateValue) {
            nextDueDate = parseDate(nextDueDateValue)
            if (!nextDueDate) {
              addError(rowNumber, propertyName, 'Invalid date format for Next Due Date (expected mm/dd/yyyy)')
              continue
            }
          }

          // Extract portfolio name (REQUIRED)
          const portfolioName = findHeaderValue(row, [
            'Portfolio',
            'Portfolio Name',
            'Portfolio name'
          ])
          if (!portfolioName) {
            addError(rowNumber, propertyName, 'Portfolio is required')
            continue
          }

          // Extract credentials first - Expedia ID is REQUIRED
          // If no Expedia ID is provided, skip the entire property import
          const expediaId = findHeaderValue(row, [
            'Expedia ID',
            'Expedia Id',
            'Expedia id',
            'ExpediaID'
          ])

          if (!expediaId) {
            addError(rowNumber, propertyName, 'Expedia ID is required')
            continue
          }

          // Find or create portfolio
          let portfolio =
            await this.portfolioRepository.findByName(portfolioName)

          if (!portfolio) {
            // Create new portfolio with default service type
            // First, find or create a default service type
            let defaultServiceType = await this.prisma.serviceType.findFirst({
              where: { type: 'Default' }
            })

            if (!defaultServiceType) {
              defaultServiceType = await this.prisma.serviceType.create({
                data: {
                  type: 'Default',
                  is_active: true
                }
              })
            }

            portfolio = await this.portfolioRepository.create({
              name: portfolioName,
              service_type_id: defaultServiceType.id,
              is_active: true,
              is_commissionable: false
            } as any)
          }

          // Create or update property
          let propertyId: string

          if (existingProperty) {
            // Update existing property - use Prisma directly since bulk import
            // needs to set is_active which is excluded from UpdatePropertyDto
            await this.prisma.property.update({
              where: { id: existingProperty.id },
              data: {
                address: address,
                currency_id: currency.id,
                card_descriptor: cardDescriptor || undefined,
                is_active: true,
                next_due_date: nextDueDate || undefined,
                portfolio_id: portfolio.id
              }
            })
            propertyId = existingProperty.id
          } else {
            // Create new property
            const propertyData: CreatePropertyDto = {
              name: propertyName,
              address: address,
              currency_id: currency.id,
              card_descriptor: cardDescriptor || undefined,
              is_active: true,
              next_due_date: nextDueDate
                ? nextDueDate.toISOString()
                : undefined,
              portfolio_id: portfolio.id
            }

            const createdProperty =
              await this.propertyRepository.create(propertyData)
            propertyId = createdProperty.id
          }

          // Extract remaining credentials fields
          const expediaUsername = findHeaderValue(row, [
            'Expedia Username',
            'Expedia username',
            'Expedia User'
          ])
          const expediaPassword = findHeaderValue(row, [
            'Expedia Password',
            'Expedia password',
            'Expedia Pass'
          ])

          const agodaId = findHeaderValue(row, [
            'Agoda ID',
            'Agoda Id',
            'Agoda id',
            'AgodaID'
          ])
          const agodaUsername = findHeaderValue(row, [
            'Agoda Username',
            'Agoda username',
            'Agoda User'
          ])
          const agodaPassword = findHeaderValue(row, [
            'Agoda Password',
            'Agoda password',
            'Agoda Pass'
          ])

          const bookingId = findHeaderValue(row, [
            'Booking ID',
            'Booking Id',
            'Booking id',
            'BookingID'
          ])
          const bookingUsername = findHeaderValue(row, [
            'Booking Username',
            'Booking username',
            'Booking User'
          ])
          const bookingPassword = findHeaderValue(row, [
            'Booking Password',
            'Booking password',
            'Booking Pass'
          ])

          // Validate username/password pairs - if one is provided, both must be provided
          const hasExpediaUsername = !!expediaUsername
          const hasExpediaPassword = !!expediaPassword
          if (hasExpediaUsername !== hasExpediaPassword) {
            addError(rowNumber, propertyName, 'Expedia username and password must be provided together')
            continue
          }

          // Validate Agoda credentials: username can be provided alone,
          // but if password is provided, username must also be provided
          if (agodaPassword && !agodaUsername) {
            addError(rowNumber, propertyName, 'Agoda username is required when Agoda password is provided')
            continue
          }

          const hasBookingUsername = !!bookingUsername
          const hasBookingPassword = !!bookingPassword
          if (hasBookingUsername !== hasBookingPassword) {
            addError(rowNumber, propertyName, 'Booking username and password must be provided together')
            continue
          }

          // Create or update credentials - only expedia_id is required
          // Check if credentials already exist
          const existingCredentials =
            await this.credentialsRepository.findByPropertyId(propertyId)

          const encryptionSecret = this.configService.get('encryption.secret', {
            infer: true
          })!

          const credentialsData: any = {}

          // Set Expedia credentials - only ID is required
          credentialsData.expedia_id = expediaId
          credentialsData.expedia_username = expediaUsername || null
          credentialsData.expedia_password = expediaPassword
            ? EncryptionUtil.encrypt(expediaPassword, encryptionSecret)
            : null

          // Set Agoda credentials if any field is provided
          if (agodaId || agodaUsername) {
            credentialsData.agoda_id = agodaId || null
            credentialsData.agoda_username = agodaUsername || null
            credentialsData.agoda_password = agodaPassword
              ? EncryptionUtil.encrypt(agodaPassword, encryptionSecret)
              : null
          }

          // Set Booking credentials if any field is provided
          if (bookingId || bookingUsername) {
            credentialsData.booking_id = bookingId || null
            credentialsData.booking_username = bookingUsername || null
            credentialsData.booking_password = bookingPassword
              ? EncryptionUtil.encrypt(bookingPassword, encryptionSecret)
              : null
          }

          if (existingCredentials) {
            // Update existing credentials (merge with existing)
            await this.credentialsRepository.update(propertyId, credentialsData)
          } else {
            // Create new credentials
            credentialsData.property_id = propertyId
            await this.credentialsRepository.create(credentialsData)
          }

          // Check if user has permission to create bank details
          // If not, silently skip bank details creation and mark as success
          if (!canCreateBankDetails(user)) {
            result.successCount++
            result.successfulImports.push(propertyName)
            logSuccess(rowNumber, propertyName, existingProperty ? 'updated' : 'created')
            continue
          }

          // Extract and create bank details if provided
          // Bank Type is REQUIRED - can be "None", "Stripe", or "Bank"
          const bankTypeRaw = findHeaderValue(row, [
            'Bank Type (None / Stripe / Bank)',
            'Bank Type',
            'Bank type',
            'bank_type'
          ])

          if (!bankTypeRaw) {
            addError(rowNumber, propertyName, 'Bank Type is required (None / Stripe / Bank)')
            continue
          }

          const bankTypeNormalized = bankTypeRaw.toLowerCase().trim()

          // If bank type is "None", skip bank details processing
          if (bankTypeNormalized === 'none') {
            // Successfully created property without bank details
            result.successCount++
            result.successfulImports.push(propertyName)
            logSuccess(rowNumber, propertyName, existingProperty ? 'updated' : 'created')
            continue
          }

          const stripeAccountEmail = findHeaderValue(row, [
            'Stripe Account Email',
            'Stripe Email',
            'Stripe account email',
            'stripe_account_email'
          ])

          const bankSubTypeRaw = findHeaderValue(row, [
            'Bank Sub Type (ACH / Domestic US Wire / International Wire)',
            'Bank Sub Type',
            'Bank sub type',
            'Bank Sub type',
            'bank_sub_type',
            'Sub Type',
            'SubType',
            'Subtype',
            'Bank Subtype'
          ])
          const hotelPortfolioName = findHeaderValue(row, [
            'Hotel Portfolio Name',
            'Hotel portfolio name',
            'hotel_portfolio_name',
            'Hotel Name',
            'Hotel name',
            'Portfolio Name (Bank)'
          ])
          const beneficiaryName = findHeaderValue(row, [
            'Beneficiary Name',
            'Beneficiary name',
            'beneficiary_name',
            'Beneficiary',
            'Beneficiary Name (ACH)'
          ])
          const beneficiaryAddress = findHeaderValue(row, [
            'Beneficiary Address',
            'Beneficiary address',
            'beneficiary_address',
            'Address (Beneficiary)',
            'Beneficiary addr'
          ])
          const accountNumber = findHeaderValue(row, [
            'Account Number',
            'Account number',
            'account_number',
            'Bank Account',
            'Bank Account Number',
            'Account No',
            'Account #'
          ])
          const accountName = findHeaderValue(row, [
            'Account Name',
            'Account name',
            'account_name',
            'Account Holder',
            'Account holder'
          ])
          const bankName = findHeaderValue(row, [
            'Bank Name',
            'Bank name',
            'bank_name',
            'Bank'
          ])
          const bankBranch = findHeaderValue(row, [
            'Bank Branch',
            'Bank branch',
            'bank_branch',
            'Branch',
            'Branch Name'
          ])
          const swiftBicIban = findHeaderValue(row, [
            'Swift or BIC or IBAN',
            'Swift or Bic or Iban',
            'Swift/BIC/IBAN',
            'Swift/Bic/Iban',
            'swift_bic_iban',
            'Swift Code',
            'Swift code',
            'SWIFT',
            'Swift',
            'SWIFT Code',
            'BIC',
            'SWIFT/BIC',
            'IBAN',
            'Iban'
          ])
          const routingNumber = findHeaderValue(row, [
            'Routing Number',
            'Routing number',
            'routing_number',
            'Routing',
            'Routing No',
            'ABA Number',
            'ABA'
          ])
          const bankAccountType = findHeaderValue(row, [
            'Bank Account Type',
            'Bank account type',
            'bank_account_type',
            'Account Type',
            'Account type',
            'Type'
          ])
          const bankCurrency = findHeaderValue(row, [
            'Currency (Bank)',
            'Bank Currency',
            'currency',
            'Currency Code (Bank)'
          ])

          // Process bank details based on Bank Type
          // Check if bank details already exist
          const existingBankDetails =
            await this.bankDetailsRepository.findByPropertyId(propertyId)

          const bankDetailsData: any = {}

          // Determine bank type based on the Bank Type column value
          if (bankTypeNormalized === 'stripe') {
            // Validate Stripe Account Email is provided
            if (!stripeAccountEmail || !stripeAccountEmail.trim()) {
              addError(rowNumber, propertyName, 'Stripe Account Email is required when Bank Type is Stripe')
              continue
            }

            // Stripe account
            bankDetailsData.bank_type = BankType.stripe
            bankDetailsData.stripe_account_email = stripeAccountEmail.trim()
            // Clear bank fields for stripe
            bankDetailsData.bank_sub_type = null
            bankDetailsData.hotel_portfolio_name = null
            bankDetailsData.beneficiary_name = null
            bankDetailsData.beneficiary_address = null
            bankDetailsData.account_number = null
            bankDetailsData.account_name = null
            bankDetailsData.bank_name = null
            bankDetailsData.bank_branch = null
            bankDetailsData.swift_bic_iban = null
            bankDetailsData.routing_number = null
            bankDetailsData.bank_account_type = null
            bankDetailsData.currency = null
          } else if (bankTypeNormalized === 'bank') {
            // Bank account - validate bank_sub_type is provided
            if (!bankSubTypeRaw) {
              addError(rowNumber, propertyName, 'Bank Sub Type is required when Bank Type is Bank (ACH / Domestic US Wire / International Wire)')
              continue
            }

            bankDetailsData.bank_type = BankType.bank
            bankDetailsData.stripe_account_email = null

            // Map bank sub type from Excel values to enum values
            // "ACH" -> "ach"
            // "Domestic US Wire" -> "domestic_wire"
            // "International Wire" -> "international_wire"
            const bankSubTypeNormalized = bankSubTypeRaw.toLowerCase().trim()
            let mappedBankSubType: string

            if (bankSubTypeNormalized === 'ach') {
              mappedBankSubType = 'ach'
            } else if (
              bankSubTypeNormalized === 'domestic us wire' ||
              bankSubTypeNormalized === 'domestic_us_wire' ||
              bankSubTypeNormalized === 'domestic wire'
            ) {
              mappedBankSubType = 'domestic_wire'
            } else if (
              bankSubTypeNormalized === 'international wire' ||
              bankSubTypeNormalized === 'international_wire'
            ) {
              mappedBankSubType = 'international_wire'
            } else {
              addError(rowNumber, propertyName, `Invalid Bank Sub Type '${bankSubTypeRaw}'. Must be one of: ACH, Domestic US Wire, International Wire`)
              continue
            }

            bankDetailsData.bank_sub_type = mappedBankSubType

            // Set all provided fields
            if (hotelPortfolioName !== undefined) {
              bankDetailsData.hotel_portfolio_name = hotelPortfolioName
            }
            if (beneficiaryName !== undefined) {
              bankDetailsData.beneficiary_name = beneficiaryName
            }
            if (beneficiaryAddress !== undefined) {
              bankDetailsData.beneficiary_address = beneficiaryAddress
            }
            if (accountNumber !== undefined) {
              bankDetailsData.account_number = accountNumber
            }
            if (accountName !== undefined) {
              bankDetailsData.account_name = accountName
            }
            if (bankName !== undefined) {
              bankDetailsData.bank_name = bankName
            }
            if (bankBranch !== undefined) {
              bankDetailsData.bank_branch = bankBranch
            }
            if (swiftBicIban !== undefined) {
              bankDetailsData.swift_bic_iban = swiftBicIban
            }
            if (routingNumber !== undefined) {
              // Validate routing number has at least 9 digits
              if (routingNumber.trim().length < 9) {
                console.warn(`⚠️  Row ${rowNumber} - Property "${propertyName}": routing number '${routingNumber}' has less than 9 digits. Routing number was not saved.`)
                // Don't set routing number, but continue processing other fields
              } else {
                bankDetailsData.routing_number = routingNumber
              }
            }
            if (bankAccountType !== undefined) {
              const normalizedAccountType = bankAccountType.toLowerCase()
              if (!['checking', 'savings'].includes(normalizedAccountType)) {
                console.warn(`⚠️  Row ${rowNumber} - Property "${propertyName}": Invalid bank account type '${bankAccountType}'. Property was ${existingProperty ? 'updated' : 'created'} but bank account type was not saved.`)
                result.successCount++
                result.successfulImports.push(propertyName)
                logSuccess(rowNumber, propertyName, existingProperty ? 'updated' : 'created')
                continue
              }
              bankDetailsData.bank_account_type = normalizedAccountType
            }
            if (bankCurrency !== undefined) {
              bankDetailsData.currency = bankCurrency
            }
          } else {
            // Invalid bank type
            addError(rowNumber, propertyName, `Invalid Bank Type '${bankTypeRaw}'. Must be one of: None, Stripe, Bank`)
            continue
          }

          // Create or update bank details
          if (existingBankDetails) {
            // Update existing bank details
            await this.bankDetailsRepository.update(propertyId, bankDetailsData)
          } else {
            // Create new bank details
            bankDetailsData.property_id = propertyId
            await this.bankDetailsRepository.create(bankDetailsData)
          }

          result.successCount++
          result.successfulImports.push(propertyName)

          logSuccess(rowNumber, propertyName, existingProperty ? 'updated' : 'created')
        } catch (error) {
          const propertyName =
            findHeaderValue(row, ['Property Name', 'Property name', 'Name']) ||
            'Unknown'

          addError(rowNumber, propertyName, error.message || 'Unknown error occurred')
        }
      }

      console.log(`📊 Bulk import completed: ${result.successCount} succeeded, ${result.failureCount} failed out of ${result.totalRows} total`)

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
    // Only super admins and internal users can bulk update properties
    const isSuperAdmin = isUserSuperAdmin(user)
    const isInternal = isInternalUser(user)

    if (!isSuperAdmin && !isInternal) {
      throw new BadRequestException(
        'Only Super Admin and internal users can bulk update properties'
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

      // Helper function to find header value with flexible naming
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

      const encryptionSecret = this.configService.get('encryption.secret', {
        infer: true
      })!

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
          // Extract Property ID (required)
          const propertyIdValue = findHeaderValue(row, [
            'Property ID',
            'Property Id',
            'Property id',
            'property_id',
            'ID',
            'Id',
            'id'
          ])

          if (!propertyIdValue) {
            // Log row keys for debugging
            console.log(`Row ${rowNumber} keys:`, Object.keys(row))
            console.log(`Row ${rowNumber} values:`, row)
            result.errors.push({
              row: rowNumber,
              propertyId: 'Unknown',
              error: 'Property ID is required'
            })
            result.failureCount++
            continue
          }

          // Validate MongoDB ObjectId format
          if (!QueryBuilder.isValidObjectId(propertyIdValue)) {
            result.errors.push({
              row: rowNumber,
              propertyId: propertyIdValue,
              error:
                'Invalid property ID format (must be a valid MongoDB ObjectId)'
            })
            result.failureCount++
            continue
          }

          // Find existing property
          const existingProperty =
            await this.propertyRepository.findById(propertyIdValue)
          if (!existingProperty) {
            result.errors.push({
              row: rowNumber,
              propertyId: propertyIdValue,
              error: 'Property not found'
            })
            result.failureCount++
            continue
          }

          // Prepare update data (only include fields that have values)
          const updateData: any = {}

          // Extract property name (if provided)
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Name'
          ])
          if (propertyName) {
            // Check if name is being changed and if new name already exists
            if (propertyName !== existingProperty.name) {
              const propertyWithSameName =
                await this.propertyRepository.findByName(propertyName)
              if (propertyWithSameName) {
                result.errors.push({
                  row: rowNumber,
                  propertyId: propertyIdValue,
                  error: 'Property with this name already exists'
                })
                result.failureCount++
                continue
              }
            }
            updateData.name = propertyName
          }

          // Extract address (if provided)
          const address = findHeaderValue(row, ['Address', 'Property Address'])
          if (address !== undefined) {
            updateData.address = address || ''
          }

          // Extract currency code (if provided)
          const currencyCode = findHeaderValue(row, [
            'Property Currency',
            'Currency',
            'Currency Code'
          ])
          if (currencyCode) {
            // Find or create currency
            let currency =
              await this.currencyRepository.findByCode(currencyCode)
            if (!currency) {
              currency = await this.currencyRepository.create({
                code: currencyCode,
                name: currencyCode,
                symbol: currencyCode,
                is_active: true
              })
            }
            updateData.currency_id = currency.id
          }

          // Extract card descriptor (if provided)
          const cardDescriptor = findHeaderValue(row, [
            'Card Descriptor',
            'Card descriptor',
            'Descriptor'
          ])
          if (cardDescriptor !== undefined) {
            updateData.card_descriptor = cardDescriptor || undefined
          }

          // Extract next due date (if provided)
          const nextDueDateValue = getRawValue(row, [
            'Next Due Date',
            'Next due date',
            'Due Date'
          ])
          if (nextDueDateValue) {
            const nextDueDate = parseDate(nextDueDateValue)
            if (!nextDueDate) {
              result.errors.push({
                row: rowNumber,
                propertyId: propertyIdValue,
                error:
                  'Invalid date format for Next Due Date (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
            updateData.next_due_date = nextDueDate.toISOString()
          }

          // Extract portfolio name (if provided)
          const portfolioName = findHeaderValue(row, [
            'Portfolio',
            'Portfolio Name',
            'Portfolio name'
          ])
          if (portfolioName) {
            let portfolio =
              await this.portfolioRepository.findByName(portfolioName)
            if (!portfolio) {
              // Create new portfolio with default service type
              let defaultServiceType = await this.prisma.serviceType.findFirst({
                where: { type: 'Default' }
              })
              if (!defaultServiceType) {
                defaultServiceType = await this.prisma.serviceType.create({
                  data: {
                    type: 'Default',
                    is_active: true
                  }
                })
              }
              portfolio = await this.portfolioRepository.create({
                name: portfolioName,
                service_type_id: defaultServiceType.id,
                is_active: true,
                is_commissionable: false
              } as any)
            }
            updateData.portfolio_id = portfolio.id
          }

          // Extract credential fields to check if credentials need updating
          const expediaId = findHeaderValue(row, [
            'Expedia ID',
            'Expedia Id',
            'Expedia id',
            'ExpediaID'
          ])
          const expediaUsername = findHeaderValue(row, [
            'Expedia Username',
            'Expedia username',
            'Expedia User'
          ])
          const expediaPassword = findHeaderValue(row, [
            'Expedia Password',
            'Expedia password',
            'Expedia Pass'
          ])
          const agodaId = findHeaderValue(row, [
            'Agoda ID',
            'Agoda Id',
            'Agoda id',
            'AgodaID'
          ])
          const agodaUsername = findHeaderValue(row, [
            'Agoda Username',
            'Agoda username',
            'Agoda User'
          ])
          const agodaPassword = findHeaderValue(row, [
            'Agoda Password',
            'Agoda password',
            'Agoda Pass'
          ])
          const bookingId = findHeaderValue(row, [
            'Booking ID',
            'Booking Id',
            'Booking id',
            'BookingID'
          ])
          const bookingUsername = findHeaderValue(row, [
            'Booking Username',
            'Booking username',
            'Booking User'
          ])
          const bookingPassword = findHeaderValue(row, [
            'Booking Password',
            'Booking password',
            'Booking Pass'
          ])

          const hasCredentialsUpdate =
            expediaId ||
            expediaUsername ||
            expediaPassword ||
            agodaId ||
            agodaUsername ||
            agodaPassword ||
            bookingId ||
            bookingUsername ||
            bookingPassword

          // Validate username/password pairs - if one is provided, both must be provided
          const hasExpediaUsername = !!expediaUsername
          const hasExpediaPassword = !!expediaPassword
          if (hasExpediaUsername !== hasExpediaPassword) {
            result.errors.push({
              row: rowNumber,
              propertyId: propertyIdValue,
              error: 'Expedia username and password must be provided together'
            })
            result.failureCount++
            continue
          }

          // Validate Agoda credentials: username can be provided alone,
          // but if password is provided, username must also be provided
          if (agodaPassword && !agodaUsername) {
            result.errors.push({
              row: rowNumber,
              propertyId: propertyIdValue,
              error: 'Agoda username is required when Agoda password is provided'
            })
            result.failureCount++
            continue
          }

          const hasBookingUsername = !!bookingUsername
          const hasBookingPassword = !!bookingPassword
          if (hasBookingUsername !== hasBookingPassword) {
            result.errors.push({
              row: rowNumber,
              propertyId: propertyIdValue,
              error: 'Booking username and password must be provided together'
            })
            result.failureCount++
            continue
          }

          const hasPropertyUpdate = Object.keys(updateData).length > 0

          // Check if there's anything to update
          // Note: Bank details are now updated via dedicated bulk update API
          if (!hasPropertyUpdate && !hasCredentialsUpdate) {
            result.errors.push({
              row: rowNumber,
              propertyId: propertyIdValue,
              error: 'No fields to update (all fields are empty)'
            })
            result.failureCount++
            continue
          }

          // Update property if there's data to update
          if (hasPropertyUpdate) {
            await this.propertyRepository.update(propertyIdValue, updateData)
          }

          // Update credentials if any credential field is provided
          if (hasCredentialsUpdate) {
            const existingCredentials =
              await this.credentialsRepository.findByPropertyId(propertyIdValue)

            const credentialsData: any = {}

            // Update Expedia credentials if provided
            if (expediaId !== undefined) {
              credentialsData.expedia_id = expediaId || null
            }
            if (expediaUsername !== undefined) {
              credentialsData.expedia_username = expediaUsername || null
            }
            if (expediaPassword) {
              credentialsData.expedia_password = EncryptionUtil.encrypt(
                expediaPassword,
                encryptionSecret
              )
            }

            // Update Agoda credentials if provided
            if (agodaId !== undefined) {
              credentialsData.agoda_id = agodaId || null
            }
            if (agodaUsername !== undefined) {
              credentialsData.agoda_username = agodaUsername || null
            }
            if (agodaPassword) {
              credentialsData.agoda_password = EncryptionUtil.encrypt(
                agodaPassword,
                encryptionSecret
              )
            }

            // Update Booking credentials if provided
            if (bookingId !== undefined) {
              credentialsData.booking_id = bookingId || null
            }
            if (bookingUsername !== undefined) {
              credentialsData.booking_username = bookingUsername || null
            }
            if (bookingPassword) {
              credentialsData.booking_password = EncryptionUtil.encrypt(
                bookingPassword,
                encryptionSecret
              )
            }

            if (existingCredentials) {
              // Merge with existing credentials
              await this.credentialsRepository.update(
                propertyIdValue,
                credentialsData
              )
            } else if (Object.keys(credentialsData).length > 0) {
              // Create new credentials
              credentialsData.property_id = propertyIdValue
              await this.credentialsRepository.create(credentialsData)
            }
          }

          // Note: Bank details are now updated via dedicated bulk update API
          // Use POST /property-bank-details/bulk-update for bank details

          result.successCount++
          result.successfulUpdates.push(propertyIdValue)
        } catch (error) {
          const propertyIdValue =
            findHeaderValue(row, [
              'Property ID',
              'Property Id',
              'Property id',
              'property_id',
              'ID',
              'Id',
              'id'
            ]) || 'Unknown'

          result.errors.push({
            row: rowNumber,
            propertyId: propertyIdValue,
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

  async share(id: string, data: SharePropertyDto, user: IUserWithPermissions) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check ownership: Only the owner portfolio can share the property
    await this.validatePropertyOwnership(property, user)

    // Validate all portfolio IDs exist
    for (const portfolioId of data.portfolio_ids) {
      const portfolio = await this.portfolioRepository.findById(portfolioId)
      if (!portfolio) {
        throw new NotFoundException(
          `Portfolio with ID ${portfolioId} not found`
        )
      }

      // Prevent sharing with the owner portfolio
      if (portfolioId === property.portfolio_id) {
        throw new BadRequestException(
          'Cannot share property with its owner portfolio'
        )
      }
    }

    // Get current show_in_portfolio array
    const currentSharedPortfolios = (property as any).show_in_portfolio || []

    // Add new portfolio IDs (avoid duplicates)
    const updatedSharedPortfolios = [
      ...new Set([...currentSharedPortfolios, ...data.portfolio_ids])
    ]

    // Update the property
    return this.propertyRepository.update(id, {
      show_in_portfolio: updatedSharedPortfolios
    })
  }

  async unshare(
    id: string,
    data: UnsharePropertyDto,
    user: IUserWithPermissions
  ) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check ownership: Only the owner portfolio can unshare the property
    await this.validatePropertyOwnership(property, user)

    // Get current show_in_portfolio array
    const currentSharedPortfolios = (property as any).show_in_portfolio || []

    // Remove specified portfolio IDs
    const updatedSharedPortfolios = currentSharedPortfolios.filter(
      portfolioId => !data.portfolio_ids.includes(portfolioId)
    )

    // Update the property
    return this.propertyRepository.update(id, {
      show_in_portfolio: updatedSharedPortfolios
    })
  }

  /**
   * Validates that the user has ownership rights to the property.
   * Only users with access to the property's owner portfolio can perform ownership actions.
   */
  private async validatePropertyOwnership(
    property: any,
    user: IUserWithPermissions
  ): Promise<void> {
    // Get accessible portfolio IDs for the user
    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    // If user has access to all portfolios, they have ownership rights
    if (accessiblePortfolioIds === 'all') {
      return
    }

    // Check if user has access to the property's owner portfolio
    if (
      Array.isArray(accessiblePortfolioIds) &&
      !accessiblePortfolioIds.includes(property.portfolio_id)
    ) {
      throw new ForbiddenException(
        'You do not have permission to modify this property. This property is shared with you for view-only access.'
      )
    }
  }

  async getStats(
    propertyId: string,
    user: IUserWithPermissions
  ): Promise<PropertyStatsResponseDto> {
    // Verify property exists and user has access
    const property = await this.propertyRepository.findById(propertyId)
    if (!property) {
      throw new NotFoundException('Property not found')
    }

    // Check if user has access to this property
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.PROPERTY
    )

    if (
      accessibleIds !== 'all' &&
      Array.isArray(accessibleIds) &&
      !accessibleIds.includes(propertyId)
    ) {
      throw new NotFoundException('Property not found')
    }

    // Aggregate audit amounts for this property
    const auditAggregates = await this.prisma.audit.aggregate({
      where: {
        property_id: propertyId,
        is_archived: false
      },
      _sum: {
        amount_collectable: true,
        amount_confirmed: true
      }
    })

    return {
      total_amount_collectable: roundAmount(auditAggregates._sum.amount_collectable),
      total_amount_confirmed: roundAmount(auditAggregates._sum.amount_confirmed),
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        card_descriptor: property.card_descriptor,
        is_active: property.is_active,
        next_due_date: property.next_due_date,
        portfolio_id: property.portfolio_id,
        currency_id: property.currency_id,
        currency: property.currency,
        credentials: property?.credentials
          ? {
              expedia_id: property?.credentials?.expedia_id || null,
              agoda_id: property?.credentials?.agoda_id || null,
              booking_id: property?.credentials?.booking_id || null
            }
          : null
      }
    }
  }

  // Add prisma service accessor for currency lookups
  private get prisma() {
    return (this.propertyRepository as any).prisma
  }
}
