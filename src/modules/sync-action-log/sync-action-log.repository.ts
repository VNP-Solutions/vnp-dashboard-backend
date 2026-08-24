import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type {
  ISyncActionLogRepository,
  SyncActionLogRecord
} from './sync-action-log.interface'

@Injectable()
export class SyncActionLogRepository implements ISyncActionLogRepository {
  constructor(private prisma: PrismaService) {}

  create(data: {
    scope: string
    entity_type: string
    action: string
    entity_id?: string
    entity_name?: string
    items: Array<{
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
    total_count: number
    success_count: number
    failed_count: number
    search_text?: string
    performed_by_email?: string
    performed_by_name?: string
    job_id?: string
  }): Promise<SyncActionLogRecord> {
    return this.prisma.syncActionLog.create({
      data: {
        scope: data.scope as any,
        entity_type: data.entity_type as any,
        action: data.action as any,
        entity_id: data.entity_id,
        entity_name: data.entity_name,
        items: data.items.map(item => ({
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
        })),
        total_count: data.total_count,
        success_count: data.success_count,
        failed_count: data.failed_count,
        search_text: data.search_text,
        performed_by_email: data.performed_by_email,
        performed_by_name: data.performed_by_name,
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
}
