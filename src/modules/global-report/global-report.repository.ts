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
