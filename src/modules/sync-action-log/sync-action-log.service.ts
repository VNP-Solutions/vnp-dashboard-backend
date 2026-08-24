import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type {
  BulkDeleteSyncActionLogDto,
  CreateSyncActionLogDto,
  SyncActionLogItemDto,
  SyncActionLogQueryDto
} from './sync-action-log.dto'
import type {
  ISyncActionLogRepository,
  ISyncActionLogService,
  SyncActionLogRecord
} from './sync-action-log.interface'

function countSuccess(items: SyncActionLogItemDto[]): number {
  return items.filter(i => i.success !== false).length
}

function countFailed(items: SyncActionLogItemDto[]): number {
  return items.filter(i => i.success === false).length
}

@Injectable()
export class SyncActionLogService implements ISyncActionLogService {
  constructor(
    @Inject('ISyncActionLogRepository')
    private readonly repository: ISyncActionLogRepository
  ) {}

  async create(data: CreateSyncActionLogDto): Promise<SyncActionLogRecord> {
    const items = data.items ?? []
    const portfolioItems = data.portfolio_items ?? []
    const propertyItems = data.property_items ?? []

    const successCount =
      data.success_count ?? countSuccess(items.length ? items : [...portfolioItems, ...propertyItems])
    const failedCount =
      data.failed_count ?? countFailed(items.length ? items : [...portfolioItems, ...propertyItems])
    const totalCount =
      data.total_count ??
      (items.length
        ? items.length
        : portfolioItems.length + propertyItems.length)

    const portfolioTotal =
      data.portfolio_total_count ?? portfolioItems.length
    const portfolioSuccess =
      data.portfolio_success_count ?? countSuccess(portfolioItems)
    const portfolioFailed =
      data.portfolio_failed_count ?? countFailed(portfolioItems)

    const propertyTotal = data.property_total_count ?? propertyItems.length
    const propertySuccess =
      data.property_success_count ?? countSuccess(propertyItems)
    const propertyFailed =
      data.property_failed_count ?? countFailed(propertyItems)

    const nameParts = [
      data.entity_name,
      data.performed_by_email,
      data.performed_by_name,
      data.performed_by_role,
      ...items.map(i => i.name),
      ...items.map(i => i.from_portfolio_name),
      ...items.map(i => i.to_portfolio_name),
      ...portfolioItems.map(i => i.name),
      ...propertyItems.map(i => i.name),
      ...propertyItems.map(i => i.from_portfolio_name),
      ...propertyItems.map(i => i.to_portfolio_name)
    ].filter(Boolean) as string[]

    const searchText = nameParts.join(' ').toLowerCase() || undefined

    return this.repository.create({
      scope: data.scope,
      entity_type: data.entity_type,
      action: data.action,
      entity_id: data.entity_id,
      entity_name: data.entity_name,
      items,
      portfolio_items: portfolioItems,
      property_items: propertyItems,
      total_count: totalCount,
      success_count: successCount,
      failed_count: failedCount,
      portfolio_total_count: portfolioTotal,
      portfolio_success_count: portfolioSuccess,
      portfolio_failed_count: portfolioFailed,
      property_total_count: propertyTotal,
      property_success_count: propertySuccess,
      property_failed_count: propertyFailed,
      search_text: searchText,
      performed_by_email: data.performed_by_email,
      performed_by_name: data.performed_by_name,
      performed_by_role: data.performed_by_role,
      job_id: data.job_id
    })
  }

  async findAll(
    query: SyncActionLogQueryDto,
    _user: IUserWithPermissions
  ): Promise<PaginatedResult<SyncActionLogRecord>> {
    const additionalFilters: Record<string, string> = {}
    if (query.scope) additionalFilters.scope = query.scope
    if (query.entity_type) additionalFilters.entity_type = query.entity_type
    if (query.action) additionalFilters.action = query.action

    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    const queryConfig = {
      searchFields: [
        'entity_name',
        'search_text',
        'performed_by_email',
        'performed_by_name',
        'performed_by_role',
        'job_id',
        'entity_id'
      ],
      filterableFields: ['scope', 'entity_type', 'action', 'job_id'],
      sortableFields: [
        'created_at',
        'scope',
        'entity_type',
        'action',
        'entity_name',
        'total_count',
        'success_count',
        'failed_count'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const
    }

    const { skip, take, orderBy, where } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      {}
    )

    const [data, total] = await Promise.all([
      this.repository.findAll({ where, skip, take, orderBy }),
      this.repository.count(where)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findOne(
    id: string,
    _user: IUserWithPermissions
  ): Promise<SyncActionLogRecord> {
    const log = await this.repository.findById(id)
    if (!log) {
      throw new NotFoundException('Sync action log not found')
    }
    return log
  }

  async bulkDelete(
    data: BulkDeleteSyncActionLogDto,
    _user: IUserWithPermissions
  ): Promise<{ deletedCount: number }> {
    const deletedCount = await this.repository.deleteMany(data.ids)
    return { deletedCount }
  }
}
