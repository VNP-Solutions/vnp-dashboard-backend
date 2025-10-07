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
  CreatePropertyDto,
  PropertyQueryDto,
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
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

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
