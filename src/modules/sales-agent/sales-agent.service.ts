import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isInternalUser, isUserSuperAdmin } from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateSalesAgentDto,
  SalesAgentQueryDto,
  SalesAgentReportQueryDto,
  UpdateSalesAgentDto
} from './sales-agent.dto'
import type { ISalesAgentRepository, ISalesAgentService } from './sales-agent.interface'

@Injectable()
export class SalesAgentService implements ISalesAgentService {
  constructor(
    @Inject('ISalesAgentRepository')
    private salesAgentRepository: ISalesAgentRepository,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async create(data: CreateSalesAgentDto, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can create sales agents')
    }

    const existing = await this.salesAgentRepository.findByEmail(data.email)
    if (existing) {
      throw new ConflictException('A sales agent with this email already exists')
    }

    return this.salesAgentRepository.create(data)
  }

  async findAll(query: SalesAgentQueryDto, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can view sales agents')
    }

    const queryConfig = {
      searchFields: ['full_name', 'email', 'phone'],
      filterableFields: [],
      sortableFields: ['full_name', 'email', 'commission', 'created_at', 'updated_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const
    }

    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      query,
      queryConfig,
      {}
    )

    const [data, total] = await Promise.all([
      this.salesAgentRepository.findAll({ where, skip, take, orderBy }),
      this.salesAgentRepository.count(where)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }

  async findOne(id: string, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can view sales agents')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    return salesAgent
  }

  async update(id: string, data: UpdateSalesAgentDto, user: IUserWithPermissions) {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can update sales agents')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    if (data.email && data.email !== salesAgent.email) {
      const existing = await this.salesAgentRepository.findByEmail(data.email)
      if (existing) {
        throw new ConflictException('A sales agent with this email already exists')
      }
    }

    return this.salesAgentRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    if (!isUserSuperAdmin(user)) {
      throw new BadRequestException('Only Super Admin can delete sales agents')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    if (salesAgent.portfolios.length > 0) {
      throw new BadRequestException(
        `Cannot delete sales agent assigned to ${salesAgent.portfolios.length} portfolio(s). Please unassign them first.`
      )
    }

    await this.salesAgentRepository.delete(id)
    return { message: 'Sales agent deleted successfully' }
  }

  async downloadReport(
    id: string,
    query: SalesAgentReportQueryDto,
    user: IUserWithPermissions
  ): Promise<Buffer> {
    if (!isInternalUser(user)) {
      throw new BadRequestException('Only internal users can download sales agent reports')
    }

    const salesAgent = await this.salesAgentRepository.findById(id)
    if (!salesAgent) {
      throw new NotFoundException('Sales agent not found')
    }

    const fromDate = new Date(query.from)
    const toDate = new Date(query.to)
    // Include the full last day
    toDate.setHours(23, 59, 59, 999)

    if (fromDate > toDate) {
      throw new BadRequestException('"from" date must be before "to" date')
    }

    // Fetch all portfolios assigned to this sales agent with their currency
    const portfolios = await this.prisma.portfolio.findMany({
      where: { sales_agent_id: id },
      select: { id: true, name: true, currency: true }
    })

    if (portfolios.length === 0) {
      throw new BadRequestException('This sales agent has no assigned portfolios')
    }

    const portfolioIds = portfolios.map(p => p.id)
    const portfolioMap = new Map(portfolios.map(p => [p.id, p]))

    // Fetch all matching audits across those portfolios
    // Only audits that have both start_date and end_date, not archived,
    // and whose start_date >= from AND end_date <= to
    const audits = await this.prisma.audit.findMany({
      where: {
        is_archived: false,
        start_date: { not: null, gte: fromDate },
        end_date: { not: null, lte: toDate },
        property: { portfolio_id: { in: portfolioIds } }
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            portfolio_id: true
          }
        },
        auditStatus: { select: { status: true } }
      },
      orderBy: [{ property: { portfolio_id: 'asc' } }, { start_date: 'asc' }]
    })

    // Group audits by currency (via their portfolio)
    const auditsByCurrency = new Map<string, typeof audits>()
    for (const audit of audits) {
      const portfolio = portfolioMap.get(audit.property.portfolio_id)
      const currency = portfolio?.currency ?? 'USD'
      if (!auditsByCurrency.has(currency)) {
        auditsByCurrency.set(currency, [])
      }
      auditsByCurrency.get(currency)!.push(audit)
    }

    const workbook = XLSX.utils.book_new()

    const commissionPct = salesAgent.commission

    for (const [currency, currencyAudits] of auditsByCurrency.entries()) {
      const rows: any[] = []

      // Header info rows at the top
      rows.push({ A: 'Sales Agent Report' })
      rows.push({ A: `Agent: ${salesAgent.full_name}` })
      rows.push({ A: `Email: ${salesAgent.email}` })
      rows.push({ A: `Phone: ${salesAgent.phone}` })
      rows.push({ A: `Period: ${query.from} to ${query.to}` })
      rows.push({ A: `Currency: ${currency}` })
      rows.push({}) // blank separator

      // Column headers row
      rows.push({
        A: 'Portfolio',
        B: 'Property',
        C: 'Audit Status',
        D: 'OTA Types',
        E: 'Start Date',
        F: 'End Date',
        G: 'Expedia Confirmed',
        H: 'Agoda Confirmed',
        I: 'Booking Confirmed',
        J: 'Total Confirmed'
      })

      let grandTotalConfirmed = 0

      for (const audit of currencyAudits) {
        const portfolio = portfolioMap.get(audit.property.portfolio_id)
        const expediaConfirmed = audit.expedia_amount_confirmed ?? 0
        const agodaConfirmed = audit.agoda_amount_confirmed ?? 0
        const bookingConfirmed = audit.booking_amount_confirmed ?? 0
        const rowTotal = expediaConfirmed + agodaConfirmed + bookingConfirmed
        grandTotalConfirmed += rowTotal

        rows.push({
          A: portfolio?.name ?? '',
          B: audit.property.name,
          C: audit.auditStatus.status,
          D: audit.type_of_ota.join(', '),
          E: audit.start_date
            ? new Date(audit.start_date).toISOString().split('T')[0]
            : '',
          F: audit.end_date
            ? new Date(audit.end_date).toISOString().split('T')[0]
            : '',
          G: expediaConfirmed,
          H: agodaConfirmed,
          I: bookingConfirmed,
          J: rowTotal
        })
      }

      const commissionAmount = (grandTotalConfirmed * commissionPct) / 100

      // Blank separator before summary
      rows.push({})

      // Summary rows
      rows.push({ A: `Currency: ${currency}` })
      rows.push({ A: 'Total Amount Confirmed', J: grandTotalConfirmed })
      rows.push({ A: '% Commission', J: `${commissionPct}%` })
      rows.push({ A: 'Commission for Agent', J: commissionAmount })

      // Build worksheet from raw array of objects using sheet_from_array_of_arrays
      // We use aoa_to_sheet so we fully control the layout
      const aoa = rows.map(row => [
        row.A ?? '',
        row.B ?? '',
        row.C ?? '',
        row.D ?? '',
        row.E ?? '',
        row.F ?? '',
        row.G ?? '',
        row.H ?? '',
        row.I ?? '',
        row.J ?? ''
      ])

      const worksheet = XLSX.utils.aoa_to_sheet(aoa)

      // Set column widths
      worksheet['!cols'] = [
        { wch: 30 }, // Portfolio
        { wch: 30 }, // Property
        { wch: 20 }, // Status
        { wch: 20 }, // OTA Types
        { wch: 14 }, // Start Date
        { wch: 14 }, // End Date
        { wch: 20 }, // Expedia
        { wch: 20 }, // Agoda
        { wch: 20 }, // Booking
        { wch: 22 }  // Total
      ]

      const sheetName = currency.substring(0, 31)
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    }

    // If no audits found at all, create a single sheet with just the agent info
    if (auditsByCurrency.size === 0) {
      const aoa = [
        ['Sales Agent Report'],
        [`Agent: ${salesAgent.full_name}`],
        [`Email: ${salesAgent.email}`],
        [`Phone: ${salesAgent.phone}`],
        [`Period: ${query.from} to ${query.to}`],
        [],
        ['No audits found for this period.']
      ]
      const worksheet = XLSX.utils.aoa_to_sheet(aoa)
      worksheet['!cols'] = [{ wch: 50 }]
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  }
}
