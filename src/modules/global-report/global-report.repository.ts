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
   * Uses MongoDB aggregation for efficient deduplication and in-memory caching
   */
  async findAllPortfolioContactEmails(): Promise<PortfolioContactEmailItem[]> {
    // Return cached data if valid
    if (this.isCacheValid(this.portfolioEmailsCache)) {
      return this.portfolioEmailsCache.data
    }

    // Use MongoDB aggregation for efficient deduplication at DB level
    const result = await this.prisma.portfolio.aggregateRaw({
      pipeline: [
        // Filter out null/empty contact emails
        {
          $match: {
            $and: [
              { contact_email: { $ne: null } },
              { contact_email: { $ne: '' } }
            ]
          }
        },
        // Group by email to remove duplicates, keep first portfolio name
        {
          $group: {
            _id: '$contact_email',
            portfolioName: { $first: '$name' }
          }
        },
        // Project to final format
        {
          $project: {
            _id: 0,
            email: '$_id',
            portfolioName: 1
          }
        },
        // Sort by email
        { $sort: { email: 1 } }
      ]
    })

    const data = result as unknown as PortfolioContactEmailItem[]

    // Cache the result
    this.portfolioEmailsCache = { data, timestamp: Date.now() }

    return data
  }

  /**
   * Get all unique OTA usernames from PropertyCredentials
   * Uses MongoDB aggregation for efficient deduplication and in-memory caching
   */
  async findAllOtaUsernames(): Promise<OtaUsernameItem[]> {
    // Return cached data if valid
    if (this.isCacheValid(this.otaUsernamesCache)) {
      return this.otaUsernamesCache.data
    }

    // Use MongoDB aggregation for efficient deduplication at DB level
    const result = await this.prisma.propertyCredentials.aggregateRaw({
      pipeline: [
        // Project each OTA username as separate documents
        {
          $project: {
            items: {
              $filter: {
                input: [
                  {
                    $cond: [
                      { $and: [{ $ne: ['$expedia_username', null] }, { $ne: ['$expedia_username', ''] }] },
                      { username: '$expedia_username', otaType: 'expedia' },
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $and: [{ $ne: ['$agoda_username', null] }, { $ne: ['$agoda_username', ''] }] },
                      { username: '$agoda_username', otaType: 'agoda' },
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $and: [{ $ne: ['$booking_username', null] }, { $ne: ['$booking_username', ''] }] },
                      { username: '$booking_username', otaType: 'booking' },
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
        // Group by username and otaType to remove duplicates
        {
          $group: {
            _id: { username: '$items.username', otaType: '$items.otaType' }
          }
        },
        // Project to final format
        {
          $project: {
            _id: 0,
            username: '$_id.username',
            otaType: '$_id.otaType'
          }
        },
        // Sort by otaType, then username
        { $sort: { otaType: 1, username: 1 } }
      ]
    })

    const data = result as unknown as OtaUsernameItem[]

    // Cache the result
    this.otaUsernamesCache = { data, timestamp: Date.now() }

    return data
  }

  /**
   * Get all OTA passwords from PropertyCredentials (encrypted)
   * Uses MongoDB aggregation for efficient deduplication and in-memory caching
   *
   * Note: Passwords are returned encrypted. Decryption happens in the service layer
   * with parallel processing for performance.
   */
  async findAllOtaPasswords(): Promise<{ password: string; otaType: string }[]> {
    // Return cached data if valid
    if (this.isCacheValid(this.otaPasswordsCache)) {
      return this.otaPasswordsCache.data
    }

    // Use MongoDB aggregation for efficient deduplication at DB level
    const result = await this.prisma.propertyCredentials.aggregateRaw({
      pipeline: [
        // Project each OTA password as separate documents
        {
          $project: {
            items: {
              $filter: {
                input: [
                  {
                    $cond: [
                      { $and: [{ $ne: ['$expedia_password', null] }, { $ne: ['$expedia_password', ''] }] },
                      { password: '$expedia_password', otaType: 'expedia' },
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $and: [{ $ne: ['$agoda_password', null] }, { $ne: ['$agoda_password', ''] }] },
                      { password: '$agoda_password', otaType: 'agoda' },
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $and: [{ $ne: ['$booking_password', null] }, { $ne: ['$booking_password', ''] }] },
                      { password: '$booking_password', otaType: 'booking' },
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
        // Group by password and otaType to remove duplicates
        {
          $group: {
            _id: { password: '$items.password', otaType: '$items.otaType' }
          }
        },
        // Project to final format
        {
          $project: {
            _id: 0,
            password: '$_id.password',
            otaType: '$_id.otaType'
          }
        },
        // Sort by otaType, then password
        { $sort: { otaType: 1, password: 1 } }
      ]
    })

    const data = result as unknown as { password: string; otaType: string }[]

    // Cache the result
    this.otaPasswordsCache = { data, timestamp: Date.now() }

    return data
  }
}
