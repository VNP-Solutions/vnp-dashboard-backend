import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type {
  CreateSyncActionLogDto,
  SyncActionLogQueryDto
} from './sync-action-log.dto'

export interface SyncActionLogRecord {
  id: string
  scope: string
  entity_type: string
  action: string
  entity_id?: string | null
  entity_name?: string | null
  items: Array<{
    id?: string | null
    name: string
    success: boolean
    reason?: string | null
    dbms?: string | null
    dashboard?: string | null
    scraper?: string | null
    from_portfolio_id?: string | null
    from_portfolio_name?: string | null
    to_portfolio_id?: string | null
    to_portfolio_name?: string | null
  }>
  total_count: number
  success_count: number
  failed_count: number
  search_text?: string | null
  performed_by_email?: string | null
  performed_by_name?: string | null
  performed_by_role?: string | null
  job_id?: string | null
  created_at: Date
}

export interface ISyncActionLogRepository {
  create(data: {
    scope: string
    entity_type: string
    action: string
    entity_id?: string
    entity_name?: string
    items: CreateSyncActionLogDto['items']
    total_count: number
    success_count: number
    failed_count: number
    search_text?: string
    performed_by_email?: string
    performed_by_name?: string
    performed_by_role?: string
    job_id?: string
  }): Promise<SyncActionLogRecord>

  findAll(queryOptions: {
    where?: any
    orderBy?: any
    skip?: number
    take?: number
  }): Promise<SyncActionLogRecord[]>

  count(where?: any): Promise<number>

  findById(id: string): Promise<SyncActionLogRecord | null>
}

export interface ISyncActionLogService {
  create(data: CreateSyncActionLogDto): Promise<SyncActionLogRecord>
  findAll(
    query: SyncActionLogQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<SyncActionLogRecord>>
  findOne(id: string, user: IUserWithPermissions): Promise<SyncActionLogRecord>
}
