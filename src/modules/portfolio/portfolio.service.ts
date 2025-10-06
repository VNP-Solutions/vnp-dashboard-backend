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
import { EmailUtil } from '../../common/utils/email.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  CreatePortfolioDto,
  PortfolioQueryDto,
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
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil
  ) {}

  async create(data: CreatePortfolioDto, _user: IUserWithPermissions) {
    const existingPortfolio = await this.portfolioRepository.findByName(
      data.name
    )

    if (existingPortfolio) {
      throw new ConflictException('Portfolio with this name already exists')
    }

    return this.portfolioRepository.create(data)
  }

  async findAll(query: PortfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
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

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.service_type_id) {
      additionalFilters.service_type_id = query.service_type_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
    }
    if (query.is_contract_signed) {
      additionalFilters.is_contract_signed = query.is_contract_signed
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
      filterableFields: ['service_type_id', 'is_active', 'is_contract_signed'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_contract_signed',
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

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.portfolioRepository.findAll(
        { where, skip, take, orderBy },
        undefined
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

  async findOne(id: string, _user: IUserWithPermissions) {
    const portfolio = await this.portfolioRepository.findById(id)

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    return portfolio
  }

  async update(
    id: string,
    data: UpdatePortfolioDto,
    _user: IUserWithPermissions
  ) {
    const portfolio = await this.portfolioRepository.findById(id)

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

    return this.portfolioRepository.update(id, data)
  }

  async remove(id: string, _user: IUserWithPermissions) {
    const portfolio = await this.portfolioRepository.findById(id)

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

  async sendEmail(
    id: string,
    subject: string,
    body: string,
    _user: IUserWithPermissions
  ) {
    const portfolio = await this.portfolioRepository.findById(id)

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }

    if (!portfolio.contact_email) {
      throw new BadRequestException(
        'Portfolio does not have a contact email configured'
      )
    }

    await this.emailUtil.sendEmail(portfolio.contact_email, subject, body)

    return { message: 'Email sent successfully' }
  }
}
