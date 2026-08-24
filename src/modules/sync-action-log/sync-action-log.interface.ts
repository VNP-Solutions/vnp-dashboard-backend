import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type {
  BulkDeleteSyncActionLogDto,
  CreateSyncActionLogDto,
  SyncActionLogQueryDto
} from './sync-action-log.dto'

export type SyncActionLogItemRecord = {
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
}

export interface SyncActionLogRecord {
  id: string
  scope: string
  entity_type: string
  action: string
  entity_id?: string | null
  entity_name?: string | null
  items: SyncActionLogItemRecord[]
  portfolio_items?: SyncActionLogItemRecord[]
  property_items?: SyncActionLogItemRecord[]
  total_count: number
  success_count: number
  failed_count: number
  portfolio_total_count?: number
  portfolio_success_count?: number
  portfolio_failed_count?: number
  property_total_count?: number
  property_success_count?: number
  property_failed_count?: number
  search_text?: string | null
  performed_by_email?: string | null
  performed_by_name?: string | null
  performed_by_role?: string | null
  job_id?: string | null
  created_at: Date
}

export type SyncActionLogCreateData = {
  scope: string
  entity_type: string
  action: string
  entity_id?: string
  entity_name?: string
  items: CreateSyncActionLogDto['items']
  portfolio_items?: CreateSyncActionLogDto['portfolio_items']
  property_items?: CreateSyncActionLogDto['property_items']
  total_count: number
  success_count: number
  failed_count: number
  portfolio_total_count: number
  portfolio_success_count: number
  portfolio_failed_count: number
  property_total_count: number
  property_success_count: number
  property_failed_count: number
  search_text?: string
  performed_by_email?: string
  performed_by_name?: string
  performed_by_role?: string
  job_id?: string
}

export interface ISyncActionLogRepository {
  create(data: SyncActionLogCreateData): Promise<SyncActionLogRecord>

  findAll(queryOptions: {
    where?: any
    orderBy?: any
    skip?: number
    take?: number
  }): Promise<SyncActionLogRecord[]>

  count(where?: any): Promise<number>

  findById(id: string): Promise<SyncActionLogRecord | null>

  deleteMany(ids: string[]): Promise<number>
}

export interface ISyncActionLogService {
  create(data: CreateSyncActionLogDto): Promise<SyncActionLogRecord>
  findAll(
    query: SyncActionLogQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<SyncActionLogRecord>>
  findOne(id: string, user: IUserWithPermissions): Promise<SyncActionLogRecord>
  bulkDelete(
    data: BulkDeleteSyncActionLogDto,
    user: IUserWithPermissions
  ): Promise<{ deletedCount: number }>
}
