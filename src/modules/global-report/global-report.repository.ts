import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AggregationBuilder, AggregationOptions } from './aggregation-builder'
import type {
  IGlobalReportRepository,
  AggregationResult,
  OtaIdItem
} from './global-report.interface'

@Injectable()
export class GlobalReportRepository implements IGlobalReportRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Execute aggregation pipeline and return paginated results
   */
  async findAll(options: AggregationOptions): Promise<AggregationResult<any>> {
    const builder = new AggregationBuilder(options)
    const pipeline = builder.build()

    // Use Prisma's aggregateRaw for MongoDB aggregation
    const result = (await this.prisma.audit.aggregateRaw({
      pipeline: pipeline
    })) as unknown as any[]

    // Parse $facet result
    const facetResult = result[0] || { data: [], totalCount: [] }
    const data = facetResult.data || []
    const total = facetResult.totalCount[0]?.count || 0

    return { data, total }
  }

  /**
   * Execute aggregation pipeline for export (no pagination)
   */
  async findAllForExport(
    options: Omit<AggregationOptions, 'page' | 'limit'>
  ): Promise<any[]> {
    const builder = new AggregationBuilder({
      ...options,
      page: 1,
      limit: Number.MAX_SAFE_INTEGER
    })
    const pipeline = builder.buildForExport()

    const result = (await this.prisma.audit.aggregateRaw({
      pipeline: pipeline
    })) as unknown as any[]

    return Array.isArray(result) ? result : []
  }

  /**
   * Get all unique OTA IDs from PropertyCredentials
   */
  async findAllOtaIds(): Promise<OtaIdItem[]> {
    const credentials = await this.prisma.propertyCredentials.findMany({
      select: {
        expedia_id: true,
        agoda_id: true,
        booking_id: true
      }
    })

    const otaIds: OtaIdItem[] = []

    for (const cred of credentials) {
      if (cred.expedia_id) {
        otaIds.push({ otaId: cred.expedia_id, otaType: 'expedia' })
      }
      if (cred.agoda_id) {
        otaIds.push({ otaId: cred.agoda_id, otaType: 'agoda' })
      }
      if (cred.booking_id) {
        otaIds.push({ otaId: cred.booking_id, otaType: 'booking' })
      }
    }

    // Remove duplicates and sort
    const uniqueOtaIds = otaIds.filter(
      (item, index, self) =>
        index === self.findIndex(t => t.otaId === item.otaId && t.otaType === item.otaType)
    )

    return uniqueOtaIds.sort((a, b) => {
      // Sort by OTA type first, then by ID
      if (a.otaType !== b.otaType) {
        return a.otaType.localeCompare(b.otaType)
      }
      return a.otaId.localeCompare(b.otaId)
    })
  }
}
