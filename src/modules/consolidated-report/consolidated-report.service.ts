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
  isInternalUser,
  isUserSuperAdmin
} from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  ConsolidatedReportQueryDto,
  CreateConsolidatedReportDto,
  UpdateConsolidatedReportDto
} from './consolidated-report.dto'
import type {
  IConsolidatedReportRepository,
  IConsolidatedReportService
} from './consolidated-report.interface'

@Injectable()
export class ConsolidatedReportService implements IConsolidatedReportService {
  constructor(
    @Inject('IConsolidatedReportRepository')
    private consolidatedReportRepository: IConsolidatedReportRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService
  ) {}

  async create(data: CreateConsolidatedReportDto, user: IUserWithPermissions) {
    // Only internal users (super admin and internal) can create consolidated reports
    if (!isInternalUser(user)) {
      throw new ForbiddenException(
        'Only internal users can create consolidated reports'
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
      !accessiblePortfolioIds.includes(data.portfolio_id)
    ) {
      throw new BadRequestException('You do not have access to this portfolio')
    }

    const consolidatedReport =
      await this.consolidatedReportRepository.create(data)

    return consolidatedReport
  }

  async findAll(
    query: ConsolidatedReportQueryDto,
    user: IUserWithPermissions
  ) {
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
      searchFields: ['url'],
      filterableFields: ['portfolio_id'],
      sortableFields: ['url', 'created_at', 'updated_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name'
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
      this.consolidatedReportRepository.findAll(
        { where, skip, take, orderBy },
        undefined
      ),
      this.consolidatedReportRepository.count(where, undefined)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findAllForExport(
    query: ConsolidatedReportQueryDto,
    user: IUserWithPermissions
  ) {
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
      searchFields: ['url'],
      filterableFields: ['portfolio_id'],
      sortableFields: ['url', 'created_at', 'updated_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name'
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
    const data = await this.consolidatedReportRepository.findAll(
      { where, orderBy },
      undefined
    )

    return data
  }

  async findOne(id: string, user: IUserWithPermissions) {
    const consolidatedReport =
      await this.consolidatedReportRepository.findById(id)

    if (!consolidatedReport) {
      throw new NotFoundException('Consolidated report not found')
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
      !accessiblePortfolioIds.includes(consolidatedReport.portfolio_id)
    ) {
      throw new NotFoundException('Consolidated report not found')
    }

    return consolidatedReport
  }

  async findByPortfolio(portfolioId: string, user: IUserWithPermissions) {
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

    const consolidatedReports =
      await this.consolidatedReportRepository.findByPortfolioId(portfolioId)

    return consolidatedReports
  }

  async update(
    id: string,
    data: UpdateConsolidatedReportDto,
    user: IUserWithPermissions
  ) {
    // Only internal users (super admin and internal) can update consolidated reports
    if (!isInternalUser(user)) {
      throw new ForbiddenException(
        'Only internal users can update consolidated reports'
      )
    }

    const consolidatedReport =
      await this.consolidatedReportRepository.findById(id)

    if (!consolidatedReport) {
      throw new NotFoundException('Consolidated report not found')
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
      !accessiblePortfolioIds.includes(consolidatedReport.portfolio_id)
    ) {
      throw new NotFoundException('Consolidated report not found')
    }

    // If portfolio_id is being changed, verify access to new portfolio
    if (
      data.portfolio_id &&
      data.portfolio_id !== consolidatedReport.portfolio_id
    ) {
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

    return this.consolidatedReportRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    // Only super admin can delete consolidated reports
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only Super Admin can delete consolidated reports'
      )
    }

    const consolidatedReport =
      await this.consolidatedReportRepository.findById(id)

    if (!consolidatedReport) {
      throw new NotFoundException('Consolidated report not found')
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
      !accessiblePortfolioIds.includes(consolidatedReport.portfolio_id)
    ) {
      throw new NotFoundException('Consolidated report not found')
    }

    await this.consolidatedReportRepository.delete(id)

    return { message: 'Consolidated report deleted successfully' }
  }
}
