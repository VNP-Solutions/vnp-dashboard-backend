import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BankType } from '@prisma/client'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { Configuration } from '../../config/configuration'
import type { ICurrencyRepository } from '../currency/currency.interface'
import type { IPortfolioRepository } from '../portfolio/portfolio.interface'
import type { IPropertyBankDetailsRepository } from '../property-bank-details/property-bank-details.interface'
import type { IPropertyCredentialsRepository } from '../property-credentials/property-credentials.interface'
import {
  BulkImportResultDto,
  BulkTransferPropertyDto,
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
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>
  ) {}

  async create(data: CreatePropertyDto, _user: IUserWithPermissions) {
    const existingProperty = await this.propertyRepository.findByName(data.name)

    if (existingProperty) {
      throw new ConflictException('Property with this name already exists')
    }

    // Validate portfolio exists
    const portfolio = await this.portfolioRepository.findById(data.portfolio_id)
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    return this.propertyRepository.create(data)
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
    if (query.batch_id) {
      additionalFilters.batch_id = query.batch_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
    }
    if (query.bank_type) {
      additionalFilters.bank_type = query.bank_type
    }
    if (query.access_level) {
      additionalFilters.access_level = query.access_level
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
      searchFields: [
        'id',
        'name',
        'address',
        'card_descriptor',
        'portfolio.name',
        'batch.batch_no',
        'currency.code',
        'currency.name'
      ],
      filterableFields: [
        'batch_id',
        'is_active',
        'bank_type',
        'portfolio_id',
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
        'batch.batch_no',
        'currency.code'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        batch_name: 'batch.batch_no',
        currency_code: 'currency.code',
        bank_type: 'bankDetails.bank_type'
      }
    }

    // Build base where clause with permission filter
    let baseWhere: any =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Add portfolio filter if specified
    if (Object.keys(portfolioFilter).length > 0) {
      baseWhere = {
        ...baseWhere,
        ...portfolioFilter
      }
    }

    // Build Prisma query options
    const { skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )
    let { where } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Handle access_level filter for credentials
    if (query.access_level && query.access_level.toLowerCase() !== 'all') {
      const accessLevel = query.access_level.toLowerCase()

      if (accessLevel === 'full') {
        // All three IDs must exist
        where = {
          ...where,
          credentials: {
            AND: [
              { expedia_id: { not: null } },
              { agoda_id: { not: null } },
              { booking_id: { not: null } }
            ]
          }
        }
      } else if (accessLevel === 'expedia') {
        where = {
          ...where,
          credentials: {
            expedia_id: { not: null }
          }
        }
      } else if (accessLevel === 'booking') {
        where = {
          ...where,
          credentials: {
            booking_id: { not: null }
          }
        }
      } else if (accessLevel === 'agoda') {
        where = {
          ...where,
          credentials: {
            agoda_id: { not: null }
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

    // Add access_type field to each property
    const enrichedData = data.map((property: any) => {
      const accessType =
        query.portfolio_id && property.portfolio_id !== query.portfolio_id
          ? 'shared'
          : 'owned'
      return {
        ...property,
        access_type: accessType
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
    if (query.batch_id) {
      additionalFilters.batch_id = query.batch_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
    }
    if (query.bank_type) {
      additionalFilters.bank_type = query.bank_type
    }
    if (query.access_level) {
      additionalFilters.access_level = query.access_level
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
      searchFields: [
        'id',
        'name',
        'address',
        'card_descriptor',
        'portfolio.name',
        'batch.batch_no',
        'currency.code',
        'currency.name'
      ],
      filterableFields: [
        'batch_id',
        'is_active',
        'bank_type',
        'portfolio_id',
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
        'batch.batch_no',
        'currency.code'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        batch_name: 'batch.batch_no',
        currency_code: 'currency.code',
        bank_type: 'bankDetails.bank_type'
      }
    }

    // Build base where clause with permission filter
    let baseWhere: any =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Add portfolio filter if specified
    if (Object.keys(portfolioFilter).length > 0) {
      baseWhere = {
        ...baseWhere,
        ...portfolioFilter
      }
    }

    // Build Prisma query options (without pagination)
    const { orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )
    let { where } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Handle access_level filter for credentials
    if (query.access_level && query.access_level.toLowerCase() !== 'all') {
      const accessLevel = query.access_level.toLowerCase()

      if (accessLevel === 'full') {
        // All three IDs must exist
        where = {
          ...where,
          credentials: {
            AND: [
              { expedia_id: { not: null } },
              { agoda_id: { not: null } },
              { booking_id: { not: null } }
            ]
          }
        }
      } else if (accessLevel === 'expedia') {
        where = {
          ...where,
          credentials: {
            expedia_id: { not: null }
          }
        }
      } else if (accessLevel === 'booking') {
        where = {
          ...where,
          credentials: {
            booking_id: { not: null }
          }
        }
      } else if (accessLevel === 'agoda') {
        where = {
          ...where,
          credentials: {
            agoda_id: { not: null }
          }
        }
      }
    }

    // Fetch all data without pagination
    const data = await this.propertyRepository.findAll(
      { where, orderBy },
      undefined
    )

    // Add access_type field to each property
    const enrichedData = data.map((property: any) => {
      const accessType =
        query.portfolio_id && property.portfolio_id !== query.portfolio_id
          ? 'shared'
          : 'owned'
      return {
        ...property,
        access_type: accessType
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

      // Add access_type field to each property
      return properties.map((property: any) => ({
        ...property,
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

    // Add access_type field to each property
    return properties.map((property: any) => {
      const accessType = data.portfolio_ids.includes(property.portfolio_id)
        ? 'owned'
        : 'shared'
      return {
        ...property,
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

    // Add access_type field - for findOne, we consider it owned if it's in user's portfolio
    // This is a simplified approach; you may want to add portfolio context if needed
    return {
      ...property,
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

    // Perform the transfer by updating the portfolio_id
    return this.propertyRepository.update(id, {
      portfolio_id: data.new_portfolio_id
    })
  }

  async bulkTransfer(
    data: BulkTransferPropertyDto,
    _user: IUserWithPermissions
  ) {
    // Validate the target portfolio exists
    const targetPortfolio = await this.portfolioRepository.findById(
      data.new_portfolio_id
    )
    if (!targetPortfolio) {
      throw new NotFoundException('Target portfolio not found')
    }

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

        // Transfer the property
        await this.propertyRepository.update(propertyId, {
          portfolio_id: data.new_portfolio_id
        })

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

    // Check ownership: Only the owner portfolio can delete the property
    await this.validatePropertyOwnership(property, user)

    const auditCount = await this.propertyRepository.countAudits(id)

    if (auditCount > 0) {
      throw new BadRequestException(
        `Cannot delete property with ${auditCount} associated audits. Please delete or reassign the audits first.`
      )
    }

    await this.propertyRepository.delete(id)

    return { message: 'Property deleted successfully' }
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

      // Helper function to get raw value (preserves type for dates and numbers)
      const getRawValue = (row: any, possibleNames: string[]): any => {
        for (const name of possibleNames) {
          const value = row[name]
          if (value !== undefined && value !== null && value !== '') {
            return value
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
          // Extract property name
          const propertyName = findHeaderValue(row, [
            'Property Name',
            'Property name',
            'Name'
          ])

          if (!propertyName) {
            result.errors.push({
              row: rowNumber,
              property: 'Unknown',
              error: 'Property name is required'
            })
            result.failureCount++
            continue
          }

          // Check if property already exists
          const existingProperty =
            await this.propertyRepository.findByName(propertyName)

          // Extract property address
          const address = findHeaderValue(row, ['Address', 'Property Address'])
          if (!address) {
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Address is required'
            })
            result.failureCount++
            continue
          }

          // Extract currency code
          const currencyCode = findHeaderValue(row, [
            'Currency',
            'Currency Code'
          ])
          if (!currencyCode) {
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Currency is required'
            })
            result.failureCount++
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

          // Extract card descriptor
          const cardDescriptor = findHeaderValue(row, [
            'Card Descriptor',
            'Card descriptor',
            'Descriptor'
          ])
          if (!cardDescriptor) {
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Card descriptor is required'
            })
            result.failureCount++
            continue
          }

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
              result.errors.push({
                row: rowNumber,
                property: propertyName,
                error:
                  'Invalid date format for Next Due Date (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
          }

          // Extract portfolio name
          const portfolioName = findHeaderValue(row, [
            'Portfolio Name',
            'Portfolio',
            'Portfolio name'
          ])
          if (!portfolioName) {
            result.errors.push({
              row: rowNumber,
              property: propertyName,
              error: 'Portfolio name is required'
            })
            result.failureCount++
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
              is_contract_signed: false,
              is_active: true,
              is_commissionable: false
            })
          }

          // Extract batch (optional)
          const batchValue = findHeaderValue(row, ['Batch', 'Batch No'])
          let batchId: string | undefined = undefined

          if (batchValue) {
            // Find or create batch
            let batch = await this.prisma.propertyBatch.findFirst({
              where: { batch_no: batchValue }
            })

            if (!batch) {
              batch = await this.prisma.propertyBatch.create({
                data: { batch_no: batchValue }
              })
            }

            batchId = batch.id
          }

          // Create or update property
          let propertyId: string

          if (existingProperty) {
            // Update existing property
            const updateData: UpdatePropertyDto = {
              address: address,
              currency_id: currency.id,
              card_descriptor: cardDescriptor,
              is_active: true,
              next_due_date: nextDueDate
                ? nextDueDate.toISOString()
                : undefined,
              portfolio_id: portfolio.id,
              batch_id: batchId
            }

            await this.propertyRepository.update(
              existingProperty.id,
              updateData
            )
            propertyId = existingProperty.id
          } else {
            // Create new property
            const propertyData: CreatePropertyDto = {
              name: propertyName,
              address: address,
              currency_id: currency.id,
              card_descriptor: cardDescriptor,
              is_active: true,
              next_due_date: nextDueDate
                ? nextDueDate.toISOString()
                : undefined,
              portfolio_id: portfolio.id,
              batch_id: batchId
            }

            const createdProperty =
              await this.propertyRepository.create(propertyData)
            propertyId = createdProperty.id
          }

          // Extract and create credentials if provided
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

          // Create or update credentials if any OTA credentials are provided
          if (
            expediaId ||
            expediaUsername ||
            expediaPassword ||
            agodaId ||
            agodaUsername ||
            agodaPassword ||
            bookingId ||
            bookingUsername ||
            bookingPassword
          ) {
            // Check if credentials already exist
            const existingCredentials =
              await this.credentialsRepository.findByPropertyId(propertyId)

            const encryptionSecret = this.configService.get(
              'encryption.secret',
              {
                infer: true
              }
            )!

            const credentialsData: any = {}

            // Validate Expedia credentials (required)
            if (!expediaId || !expediaUsername || !expediaPassword) {
              result.errors.push({
                row: rowNumber,
                property: propertyName,
                error: `Property ${existingProperty ? 'updated' : 'created'} but credentials require all Expedia fields (ID, Username, Password)`
              })
              result.successCount++
              result.successfulImports.push(propertyName)
              continue
            }

            // Set required Expedia credentials
            credentialsData.expedia_id = expediaId
            credentialsData.expedia_username = expediaUsername
            credentialsData.expedia_password = EncryptionUtil.encrypt(
              expediaPassword,
              encryptionSecret
            )

            // Update Agoda credentials only if provided
            if (agodaId || agodaUsername || agodaPassword) {
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
            }

            // Update Booking credentials only if provided
            if (bookingId || bookingUsername || bookingPassword) {
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
            }

            if (existingCredentials) {
              // Update existing credentials (merge with existing)
              await this.credentialsRepository.update(
                propertyId,
                credentialsData
              )
            } else {
              // Create new credentials
              credentialsData.property_id = propertyId
              await this.credentialsRepository.create(credentialsData)
            }
          }

          // Extract and create bank details if provided
          const stripeAccountEmail = findHeaderValue(row, [
            'Stripe Account Email',
            'Stripe Email',
            'Stripe account email'
          ])

          const accountNumber = findHeaderValue(row, [
            'Account Number',
            'Account number',
            'Bank Account'
          ])
          const accountName = findHeaderValue(row, [
            'Account Name',
            'Account name',
            'Account Holder'
          ])
          const bankName = findHeaderValue(row, [
            'Bank Name',
            'Bank name',
            'Bank'
          ])
          const bankBranch = findHeaderValue(row, [
            'Bank Branch',
            'Bank branch',
            'Branch'
          ])
          const swiftCode = findHeaderValue(row, [
            'Swift Code',
            'Swift code',
            'SWIFT'
          ])
          const routingNumber = findHeaderValue(row, [
            'Routing Number',
            'Routing number',
            'Routing'
          ])

          // Create or update bank details if any banking information is provided
          if (
            stripeAccountEmail ||
            accountNumber ||
            accountName ||
            bankName ||
            bankBranch ||
            swiftCode ||
            routingNumber
          ) {
            // Check if bank details already exist
            const existingBankDetails =
              await this.bankDetailsRepository.findByPropertyId(propertyId)

            const bankDetailsData: any = {}

            // Determine bank type and validate based on the same rules as the service
            if (stripeAccountEmail && stripeAccountEmail.trim()) {
              // Stripe account
              bankDetailsData.bank_type = BankType.stripe
              bankDetailsData.stripe_account_email = stripeAccountEmail.trim()
              // Clear bank fields for stripe
              bankDetailsData.account_number = null
              bankDetailsData.account_name = null
              bankDetailsData.bank_name = null
              bankDetailsData.bank_branch = null
              bankDetailsData.swift_code = null
              bankDetailsData.routing_number = null
            } else if (
              accountNumber ||
              accountName ||
              bankName ||
              bankBranch ||
              swiftCode ||
              routingNumber
            ) {
              // Bank account - validate all required fields
              const missingFields: string[] = []

              if (!accountNumber || !accountNumber.trim()) {
                missingFields.push('Account Number')
              }
              if (!accountName || !accountName.trim()) {
                missingFields.push('Account Name')
              }
              if (!bankName || !bankName.trim()) {
                missingFields.push('Bank Name')
              }
              if (!bankBranch || !bankBranch.trim()) {
                missingFields.push('Bank Branch')
              }
              if (!swiftCode || !swiftCode.trim()) {
                missingFields.push('Swift Code')
              }
              if (!routingNumber || !routingNumber.trim()) {
                missingFields.push('Routing Number')
              }

              if (missingFields.length > 0) {
                result.errors.push({
                  row: rowNumber,
                  property: propertyName,
                  error: `Property ${existingProperty ? 'updated' : 'created'} but bank details missing required fields: ${missingFields.join(', ')}`
                })
                result.successCount++
                result.successfulImports.push(propertyName)
                continue
              }

              bankDetailsData.bank_type = BankType.bank
              bankDetailsData.account_number = accountNumber
              bankDetailsData.account_name = accountName
              bankDetailsData.bank_name = bankName
              bankDetailsData.bank_branch = bankBranch
              bankDetailsData.swift_code = swiftCode
              bankDetailsData.routing_number = routingNumber
              bankDetailsData.stripe_account_email = null
            }

            if (existingBankDetails) {
              // Update existing bank details
              await this.bankDetailsRepository.update(
                propertyId,
                bankDetailsData
              )
            } else {
              // Create new bank details
              bankDetailsData.property_id = propertyId
              await this.bankDetailsRepository.create(bankDetailsData)
            }
          }

          result.successCount++
          result.successfulImports.push(propertyName)
        } catch (error) {
          const propertyName =
            findHeaderValue(row, ['Property Name', 'Property name', 'Name']) ||
            'Unknown'

          result.errors.push({
            row: rowNumber,
            property: propertyName,
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
      total_amount_collectable: auditAggregates._sum.amount_collectable || 0,
      total_amount_confirmed: auditAggregates._sum.amount_confirmed || 0,
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        card_descriptor: property.card_descriptor,
        is_active: property.is_active,
        next_due_date: property.next_due_date,
        portfolio_id: property.portfolio_id,
        batch_id: property.batch_id,
        currency_id: property.currency_id,
        currency: property.currency,
        credentials: property.credentials
          ? {
              expedia_id: property.credentials.expedia_id,
              agoda_id: property.credentials.agoda_id,
              booking_id: property.credentials.booking_id
            }
          : null
      }
    }
  }

  // Add prisma service accessor for currency and batch lookups
  private get prisma() {
    return (this.propertyRepository as any).prisma
  }
}
