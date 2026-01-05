import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AggregationBuilder, AggregationOptions } from './aggregation-builder'
import type {
  IGlobalReportRepository,
  AggregationResult,
  OtaIdItem,
  PortfolioContactEmailItem,
  OtaUsernameItem
} from './global-report.interface'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

@Injectable()
export class GlobalReportRepository implements IGlobalReportRepository {
  /** Cache TTL in milliseconds (5 minutes) */
  private readonly CACHE_TTL = 5 * 60 * 1000

  /** In-memory cache for OTA IDs */
  private otaIdsCache: CacheEntry<OtaIdItem[]> | null = null

  /** In-memory cache for portfolio contact emails */
  private portfolioEmailsCache: CacheEntry<PortfolioContactEmailItem[]> | null = null

  /** In-memory cache for OTA usernames */
  private otaUsernamesCache: CacheEntry<OtaUsernameItem[]> | null = null

  /** In-memory cache for OTA passwords */
  private otaPasswordsCache: CacheEntry<{ password: string; otaType: string }[]> | null = null

  constructor(private prisma: PrismaService) {}

  /**
   * Check if cache entry is valid (exists and not expired)
   */
  private isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
    return cache !== null && Date.now() - cache.timestamp < this.CACHE_TTL
  }

  /**
   * Invalidate all caches (call when credentials are modified)
   */
  invalidateCache(): void {
    this.otaIdsCache = null
    this.portfolioEmailsCache = null
    this.otaUsernamesCache = null
    this.otaPasswordsCache = null
  }

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
   * Uses MongoDB aggregation for efficient deduplication and in-memory caching
   */
  async findAllOtaIds(): Promise<OtaIdItem[]> {
    // Return cached data if valid
    if (this.isCacheValid(this.otaIdsCache)) {
      return this.otaIdsCache.data
    }

    // Use MongoDB aggregation for efficient deduplication at DB level
    const result = await this.prisma.propertyCredentials.aggregateRaw({
      pipeline: [
        // Project each OTA ID as separate documents
        {
          $project: {
            items: {
              $filter: {
                input: [
                  {
                    $cond: [
                      { $and: [{ $ne: ['$expedia_id', null] }, { $ne: ['$expedia_id', ''] }] },
                      { otaId: '$expedia_id', otaType: 'expedia' },
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $and: [{ $ne: ['$agoda_id', null] }, { $ne: ['$agoda_id', ''] }] },
                      { otaId: '$agoda_id', otaType: 'agoda' },
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $and: [{ $ne: ['$booking_id', null] }, { $ne: ['$booking_id', ''] }] },
                      { otaId: '$booking_id', otaType: 'booking' },
                      null
                    ]
                  }
                ],
                as: 'item',
                cond: { $ne: ['$$item', null] }
              }
            }
          }
        },
        // Unwind the array to get individual documents
        { $unwind: '$items' },
        // Group by otaId and otaType to remove duplicates
        {
          $group: {
            _id: { otaId: '$items.otaId', otaType: '$items.otaType' }
          }
        },
        // Project to final format
        {
          $project: {
            _id: 0,
            otaId: '$_id.otaId',
            otaType: '$_id.otaType'
          }
        },
        // Sort by otaType, then otaId
        { $sort: { otaType: 1, otaId: 1 } }
      ]
    })

    const data = result as unknown as OtaIdItem[]

    // Cache the result
    this.otaIdsCache = { data, timestamp: Date.now() }

    return data
  }

  /**
   * Get all unique portfolio contact emails
   */
  async findAllPortfolioContactEmails(): Promise<PortfolioContactEmailItem[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: {
        contact_email: {
          not: null
        }
      },
      select: {
        name: true,
        contact_email: true
      }
    })

    const emails: PortfolioContactEmailItem[] = []

    for (const portfolio of portfolios) {
      if (portfolio.contact_email) {
        emails.push({
          email: portfolio.contact_email,
          portfolioName: portfolio.name
        })
      }
    }

    // Remove duplicates by email and sort
    const uniqueEmails = emails.filter(
      (item, index, self) =>
        index === self.findIndex(t => t.email === item.email)
    )

    return uniqueEmails.sort((a, b) => a.email.localeCompare(b.email))
  }

  /**
   * Get all unique OTA usernames from PropertyCredentials
   */
  async findAllOtaUsernames(): Promise<OtaUsernameItem[]> {
    const credentials = await this.prisma.propertyCredentials.findMany({
      select: {
        expedia_username: true,
        agoda_username: true,
        booking_username: true
      }
    })

    const usernames: OtaUsernameItem[] = []

    for (const cred of credentials) {
      if (cred.expedia_username) {
        usernames.push({ username: cred.expedia_username, otaType: 'expedia' })
      }
      if (cred.agoda_username) {
        usernames.push({ username: cred.agoda_username, otaType: 'agoda' })
      }
      if (cred.booking_username) {
        usernames.push({ username: cred.booking_username, otaType: 'booking' })
      }
    }

    // Remove duplicates and sort
    const uniqueUsernames = usernames.filter(
      (item, index, self) =>
        index === self.findIndex(t => t.username === item.username && t.otaType === item.otaType)
    )

    return uniqueUsernames.sort((a, b) => {
      if (a.otaType !== b.otaType) {
        return a.otaType.localeCompare(b.otaType)
      }
      return a.username.localeCompare(b.username)
    })
  }

  /**
   * Get all OTA passwords from PropertyCredentials (encrypted)
   */
  async findAllOtaPasswords(): Promise<{ password: string; otaType: string }[]> {
    const credentials = await this.prisma.propertyCredentials.findMany({
      select: {
        expedia_password: true,
        agoda_password: true,
        booking_password: true
      }
    })

    const passwords: { password: string; otaType: string }[] = []

    for (const cred of credentials) {
      if (cred.expedia_password) {
        passwords.push({ password: cred.expedia_password, otaType: 'expedia' })
      }
      if (cred.agoda_password) {
        passwords.push({ password: cred.agoda_password, otaType: 'agoda' })
      }
      if (cred.booking_password) {
        passwords.push({ password: cred.booking_password, otaType: 'booking' })
      }
    }

    // Remove duplicates and sort
    const uniquePasswords = passwords.filter(
      (item, index, self) =>
        index === self.findIndex(t => t.password === item.password && t.otaType === item.otaType)
    )

    return uniquePasswords.sort((a, b) => {
      if (a.otaType !== b.otaType) {
        return a.otaType.localeCompare(b.otaType)
      }
      return a.password.localeCompare(b.password)
    })
  }
}
