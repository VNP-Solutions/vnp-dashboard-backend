import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import {
  isPortfolioManager,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  ContractUrlQueryDto,
  CreateContractUrlDto,
  UpdateContractUrlDto
} from './contract-url.dto'
import type {
  IContractUrlRepository,
  IContractUrlService
} from './contract-url.interface'

@Injectable()
export class ContractUrlService implements IContractUrlService {
  constructor(
    @Inject('IContractUrlRepository')
    private contractUrlRepository: IContractUrlRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreateContractUrlDto, user: IUserWithPermissions) {
    // Only super admin can upload/create contract URLs
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only Super Admin can upload contract URLs')
    }

    // Verify user has access to the portfolio
    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      accessiblePortfolioIds !== 'all' &&
      Array.isArray(accessiblePortfolioIds) &&
      !accessiblePortfolioIds.includes(data.portfolio_id)
    ) {
      throw new BadRequestException('You do not have access to this portfolio')
    }

    // Create contract URL with the current user's ID
    const contractUrl = await this.contractUrlRepository.create({
      ...data,
      user_id: user.id,
      is_active: data.is_active !== undefined ? data.is_active : true
    })

    return contractUrl
  }

  async findAll(query: ContractUrlQueryDto, user: IUserWithPermissions) {
    // Only portfolio managers can access contract URLs
    if (!isPortfolioManager(user)) {
      throw new ForbiddenException(
        'Only Portfolio Managers can access contract URLs'
      )
    }

    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      Array.isArray(accessiblePortfolioIds) &&
      accessiblePortfolioIds.length === 0
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
    if (query.portfolio_id) {
      additionalFilters.portfolio_id = query.portfolio_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
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
      searchFields: ['url', 'description'],
      filterableFields: ['portfolio_id', 'is_active', 'user_id'],
      sortableFields: [
        'url',
        'created_at',
        'updated_at',
        'is_active',
        'description'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        user_name: 'user.first_name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessiblePortfolioIds === 'all'
        ? {}
        : {
            portfolio_id: {
              in: accessiblePortfolioIds
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
      this.contractUrlRepository.findAll(
        { where, skip, take, orderBy },
        undefined
      ),
      this.contractUrlRepository.count(where, undefined)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(
    query: ContractUrlQueryDto,
    user: IUserWithPermissions
  ) {
    // Only portfolio managers can access contract URLs
    if (!isPortfolioManager(user)) {
      throw new ForbiddenException(
        'Only Portfolio Managers can access contract URLs'
      )
    }

    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      Array.isArray(accessiblePortfolioIds) &&
      accessiblePortfolioIds.length === 0
    ) {
      return []
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.portfolio_id) {
      additionalFilters.portfolio_id = query.portfolio_id
    }
    if (query.is_active) {
      additionalFilters.is_active = query.is_active
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
      searchFields: ['url', 'description'],
      filterableFields: ['portfolio_id', 'is_active', 'user_id'],
      sortableFields: [
        'url',
        'created_at',
        'updated_at',
        'is_active',
        'description'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        user_name: 'user.first_name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessiblePortfolioIds === 'all'
        ? {}
        : {
            portfolio_id: {
              in: accessiblePortfolioIds
            }
          }

    // Build Prisma query options (without pagination)
    const { where, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch all data without pagination
    const data = await this.contractUrlRepository.findAll(
      { where, orderBy },
      undefined
    )

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    // Only portfolio managers can access contract URLs
    if (!isPortfolioManager(user)) {
      throw new ForbiddenException(
        'Only Portfolio Managers can access contract URLs'
      )
    }

    const contractUrl = await this.contractUrlRepository.findById(id)

    if (!contractUrl) {
      throw new NotFoundException('Contract URL not found')
    }

    // Verify user has access to the portfolio
    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      accessiblePortfolioIds !== 'all' &&
      Array.isArray(accessiblePortfolioIds) &&
      !accessiblePortfolioIds.includes(contractUrl.portfolio_id)
    ) {
      throw new NotFoundException('Contract URL not found')
    }

    return contractUrl
  }

  async findByPortfolio(portfolioId: string, user: IUserWithPermissions) {
    // Only portfolio managers can access contract URLs
    if (!isPortfolioManager(user)) {
      throw new ForbiddenException(
        'Only Portfolio Managers can access contract URLs'
      )
    }

    // Verify user has access to the portfolio
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

    const isSuperAdmin = isUserSuperAdmin(user)
    const contractUrls = await this.contractUrlRepository.findByPortfolioId(
      portfolioId,
      isSuperAdmin ? undefined : user.id
    )

    return contractUrls
  }

  async update(
    id: string,
    data: UpdateContractUrlDto,
    user: IUserWithPermissions
  ) {
    // Only super admin can update contract URLs
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only Super Admin can update contract URLs')
    }

    const contractUrl = await this.contractUrlRepository.findById(id)

    if (!contractUrl) {
      throw new NotFoundException('Contract URL not found')
    }

    // Verify user has access to the portfolio
    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      accessiblePortfolioIds !== 'all' &&
      Array.isArray(accessiblePortfolioIds) &&
      !accessiblePortfolioIds.includes(contractUrl.portfolio_id)
    ) {
      throw new NotFoundException('Contract URL not found')
    }

    // If portfolio_id is being changed, verify access to new portfolio
    if (data.portfolio_id && data.portfolio_id !== contractUrl.portfolio_id) {
      if (
        accessiblePortfolioIds !== 'all' &&
        Array.isArray(accessiblePortfolioIds) &&
        !accessiblePortfolioIds.includes(data.portfolio_id)
      ) {
        throw new BadRequestException(
          'You do not have access to the new portfolio'
        )
      }
    }

    return this.contractUrlRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    // Only super admin can delete contract URLs
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only Super Admin can delete contract URLs')
    }

    const contractUrl = await this.contractUrlRepository.findById(id)

    if (!contractUrl) {
      throw new NotFoundException('Contract URL not found')
    }

    // Verify user has access to the portfolio
    const accessiblePortfolioIds =
      await this.permissionService.getAccessibleResourceIds(
        user,
        ModuleType.PORTFOLIO
      )

    if (
      accessiblePortfolioIds !== 'all' &&
      Array.isArray(accessiblePortfolioIds) &&
      !accessiblePortfolioIds.includes(contractUrl.portfolio_id)
    ) {
      throw new NotFoundException('Contract URL not found')
    }

    await this.contractUrlRepository.delete(id)

    return { message: 'Contract URL deleted successfully' }
  }
}
