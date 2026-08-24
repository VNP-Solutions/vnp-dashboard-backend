import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type {
  ISyncActionLogRepository,
  SyncActionLogCreateData,
  SyncActionLogItemRecord,
  SyncActionLogRecord
} from './sync-action-log.interface'

function mapItems(
  items?: Array<{
    id?: string
    name: string
    success?: boolean
    reason?: string
    dbms?: string
    dashboard?: string
    scraper?: string
    from_portfolio_id?: string
    from_portfolio_name?: string
    to_portfolio_id?: string
    to_portfolio_name?: string
  }>
): SyncActionLogItemRecord[] {
  return (items ?? []).map(item => ({
    id: item.id,
    name: item.name,
    success: item.success ?? true,
    reason: item.reason,
    dbms: item.dbms,
    dashboard: item.dashboard,
    scraper: item.scraper,
    from_portfolio_id: item.from_portfolio_id,
    from_portfolio_name: item.from_portfolio_name,
    to_portfolio_id: item.to_portfolio_id,
    to_portfolio_name: item.to_portfolio_name
  }))
}

@Injectable()
export class SyncActionLogRepository implements ISyncActionLogRepository {
  constructor(private prisma: PrismaService) {}

  create(data: SyncActionLogCreateData): Promise<SyncActionLogRecord> {
    return this.prisma.syncActionLog.create({
      data: {
        scope: data.scope as any,
        entity_type: data.entity_type as any,
        action: data.action as any,
        entity_id: data.entity_id,
        entity_name: data.entity_name,
        items: mapItems(data.items),
        portfolio_items: mapItems(data.portfolio_items),
        property_items: mapItems(data.property_items),
        total_count: data.total_count,
        success_count: data.success_count,
        failed_count: data.failed_count,
        portfolio_total_count: data.portfolio_total_count,
        portfolio_success_count: data.portfolio_success_count,
        portfolio_failed_count: data.portfolio_failed_count,
        property_total_count: data.property_total_count,
        property_success_count: data.property_success_count,
        property_failed_count: data.property_failed_count,
        search_text: data.search_text,
        performed_by_email: data.performed_by_email,
        performed_by_name: data.performed_by_name,
        performed_by_role: data.performed_by_role,
        job_id: data.job_id
      }
    }) as Promise<SyncActionLogRecord>
  }

  findAll(queryOptions: {
    where?: any
    orderBy?: any
    skip?: number
    take?: number
  }): Promise<SyncActionLogRecord[]> {
    return this.prisma.syncActionLog.findMany({
      where: queryOptions.where,
      orderBy: queryOptions.orderBy || { created_at: 'desc' },
      skip: queryOptions.skip,
      take: queryOptions.take
    }) as Promise<SyncActionLogRecord[]>
  }

  count(where?: any): Promise<number> {
    return this.prisma.syncActionLog.count({ where })
  }

  findById(id: string): Promise<SyncActionLogRecord | null> {
    return this.prisma.syncActionLog.findUnique({
      where: { id }
    }) as Promise<SyncActionLogRecord | null>
  }

  async deleteMany(ids: string[]): Promise<number> {
    const result = await this.prisma.syncActionLog.deleteMany({
      where: { id: { in: ids } }
    })
    return result.count
  }
}
