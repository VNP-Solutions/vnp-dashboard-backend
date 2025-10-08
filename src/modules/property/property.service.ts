import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IPortfolioRepository } from '../portfolio/portfolio.interface'
import {
  BulkTransferPropertyDto,
  CreatePropertyDto,
  PropertyQueryDto,
  TransferPropertyDto,
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
    @Inject(PermissionService)
    private permissionService: PermissionService
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
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
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
    if (query.portfolio_id) {
      additionalFilters.portfolio_id = query.portfolio_id
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
      searchFields: ['name', 'address', 'portfolio.name', 'batch.batch_no'],
      filterableFields: ['batch_id', 'portfolio_id', 'is_active', 'bank_type'],
      sortableFields: [
        'name',
        'address',
        'card_descriptor',
        'next_due_date',
        'created_at',
        'updated_at',
        'is_active'
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
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
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

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    return property
  }

  async update(
    id: string,
    data: UpdatePropertyDto,
    _user: IUserWithPermissions
  ) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

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
    _user: IUserWithPermissions
  ) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

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

  async remove(id: string, _user: IUserWithPermissions) {
    const property = await this.propertyRepository.findById(id)

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    const auditCount = await this.propertyRepository.countAudits(id)

    if (auditCount > 0) {
      throw new BadRequestException(
        `Cannot delete property with ${auditCount} associated audits. Please delete or reassign the audits first.`
      )
    }

    await this.propertyRepository.delete(id)

    return { message: 'Property deleted successfully' }
  }
}
