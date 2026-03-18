import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import * as ExcelJS from 'exceljs'
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

const REPORT_AUDIT_STATUSES = [
  'OTA POST Completed',
  'VCC Invoiced',
  'MOR completed and Invoiced',
  'Direct Bill Invoiced'
]

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
}

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
      sortableFields: ['full_name', 'commission', 'created_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const
    }

    const baseWhere: any = {}
    if (query.portfolio_id) {
      baseWhere.portfolios = { some: { id: query.portfolio_id } }
    }

    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      query,
      queryConfig,
      baseWhere
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
    // and whose start_date >= from AND end_date <= to,
    // and whose status is one of the 4 report-eligible statuses (case-insensitive)
    const audits = await this.prisma.audit.findMany({
      where: {
        is_archived: false,
        start_date: { not: null, gte: fromDate },
        end_date: { not: null, lte: toDate },
        property: { portfolio_id: { in: portfolioIds } },
        auditStatus: {
          status: {
            in: REPORT_AUDIT_STATUSES,
            mode: 'insensitive'
          }
        }
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

    const format = query.format ?? 'xlsx'
    if (format === 'csv') {
      return this.generateCsvReport(
        salesAgent,
        query,
        auditsByCurrency,
        portfolioMap
      )
    }

    const workbook = new ExcelJS.Workbook()
    const commissionPct = salesAgent.commission

    // Table column definitions: [header, width, alignment]
    const TABLE_COLS: Array<{ header: string; width: number; align: ExcelJS.Alignment['horizontal'] }> = [
      { header: 'Portfolio',          width: 22, align: 'left'  },
      { header: 'Property',           width: 22, align: 'left'  },
      { header: 'Audit Status',       width: 22, align: 'left'  },
      { header: 'OTA Types',          width: 22, align: 'left'  },
      { header: 'Start Date',         width: 14, align: 'center' },
      { header: 'End Date',           width: 14, align: 'center' },
      { header: 'Expedia Confirmed',  width: 20, align: 'right' },
      { header: 'Agoda Confirmed',    width: 20, align: 'right' },
      { header: 'Booking Confirmed',  width: 20, align: 'right' },
      { header: 'Total Confirmed',    width: 20, align: 'right' }
    ]
    const NUM_COLS = TABLE_COLS.length // 10

    const buildSheet = (currency: string, currencyAudits: typeof audits) => {
      const sheet = workbook.addWorksheet(currency.substring(0, 31))

      // ── Column widths ──────────────────────────────────────────────────────
      // First two cols used for agent info key/value
      sheet.getColumn(1).width = 18
      sheet.getColumn(2).width = 30
      TABLE_COLS.forEach((col, i) => {
        sheet.getColumn(i + 1).width = col.width
      })

      let currentRow = 1

      // ── Row 1: "Sales Agent Report" title ─────────────────────────────────
      const titleRow = sheet.getRow(currentRow++)
      const titleCell = titleRow.getCell(1)
      titleCell.value = 'Sales Agent Report'
      titleCell.font = { bold: true, size: 13 }
      titleRow.commit()

      // ── Rows 2–6: Agent details (two-column: bold label | value) ──────────
      const agentDetails: Array<[string, string]> = [
        ['Agent:', salesAgent.full_name],
        ['Email:', salesAgent.email],
        ['Phone:', salesAgent.phone],
        ['Period:', `${query.from} to ${query.to}`],
        ['Currency:', currency]
      ]
      for (const [label, value] of agentDetails) {
        const row = sheet.getRow(currentRow++)
        const labelCell = row.getCell(1)
        labelCell.value = label
        labelCell.font = { bold: true }
        const valueCell = row.getCell(2)
        valueCell.value = value
        row.commit()
      }

      // ── Blank gap ──────────────────────────────────────────────────────────
      currentRow++

      // ── Table header row ───────────────────────────────────────────────────
      const headerRow = sheet.getRow(currentRow++)
      TABLE_COLS.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = col.header
        cell.font = { bold: true }
        cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: true }
        cell.border = THIN_BORDER
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9D9D9' }
        }
      })
      headerRow.height = 20
      headerRow.commit()

      // ── Audit data rows ────────────────────────────────────────────────────
      let grandTotalConfirmed = 0

      for (const audit of currencyAudits) {
        const portfolio = portfolioMap.get(audit.property.portfolio_id)
        const expediaConfirmed = audit.expedia_amount_confirmed ?? 0
        const agodaConfirmed   = audit.agoda_amount_confirmed   ?? 0
        const bookingConfirmed = audit.booking_amount_confirmed ?? 0
        const rowTotal = expediaConfirmed + agodaConfirmed + bookingConfirmed
        grandTotalConfirmed += rowTotal

        const startDateStr = audit.start_date
          ? new Date(audit.start_date).toISOString().split('T')[0]
          : ''
        const endDateStr = audit.end_date
          ? new Date(audit.end_date).toISOString().split('T')[0]
          : ''

        const dataRow = sheet.getRow(currentRow++)
        const values = [
          portfolio?.name ?? '',
          audit.property.name,
          audit.auditStatus.status,
          audit.type_of_ota.join(', '),
          startDateStr,
          endDateStr,
          expediaConfirmed,
          agodaConfirmed,
          bookingConfirmed,
          rowTotal
        ]
        values.forEach((val, i) => {
          const cell = dataRow.getCell(i + 1)
          cell.value = val
          cell.alignment = { horizontal: TABLE_COLS[i].align, vertical: 'middle' }
          cell.border = THIN_BORDER
        })
        dataRow.commit()
      }

      // ── Blank gap before summary ───────────────────────────────────────────
      currentRow++

      // ── Summary section: placed in last two columns (I & J = cols 9 & 10) ─
      // Label in col 9 (bold), value in col 10 (right-aligned)
      const summaryLabelCol = NUM_COLS - 1 // col 9
      const summaryValueCol = NUM_COLS     // col 10

      const commissionAmount = (grandTotalConfirmed * commissionPct) / 100

      const summaryRows: Array<[string, string | number]> = [
        ['Currency',              currency],
        ['Total Amount Confirmed', grandTotalConfirmed],
        ['Commission',            `${commissionPct}%`],
        ['Commission for Agent',  commissionAmount]
      ]

      for (const [label, value] of summaryRows) {
        const row = sheet.getRow(currentRow++)
        const labelCell = row.getCell(summaryLabelCol)
        labelCell.value = label
        labelCell.font = { bold: true }
        if (value !== '') {
          const valueCell = row.getCell(summaryValueCol)
          valueCell.value = value
          valueCell.alignment = { horizontal: 'right' }
        }
        row.commit()
      }

      return sheet
    }

    if (auditsByCurrency.size === 0) {
      // No audits found — single sheet with agent info and message
      const sheet = workbook.addWorksheet('Report')
      sheet.getColumn(1).width = 18
      sheet.getColumn(2).width = 40

      let r = 1
      const titleCell = sheet.getRow(r++).getCell(1)
      titleCell.value = 'Sales Agent Report'
      titleCell.font = { bold: true, size: 13 }

      const agentDetails: Array<[string, string]> = [
        ['Agent:', salesAgent.full_name],
        ['Email:', salesAgent.email],
        ['Phone:', salesAgent.phone],
        ['Period:', `${query.from} to ${query.to}`]
      ]
      for (const [label, value] of agentDetails) {
        const row = sheet.getRow(r++)
        row.getCell(1).value = label
        row.getCell(1).font = { bold: true }
        row.getCell(2).value = value
        row.commit()
      }

      r++
      sheet.getRow(r).getCell(1).value = 'No audits found for this period.'
    } else {
      for (const [currency, currencyAudits] of auditsByCurrency.entries()) {
        buildSheet(currency, currencyAudits)
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  /**
   * Generate flat CSV report (same audit data as Excel, single table with Currency column)
   */
  private generateCsvReport(
    _salesAgent: { full_name: string; email: string; phone: string },
    _query: SalesAgentReportQueryDto,
    auditsByCurrency: Map<string, any[]>,
    portfolioMap: Map<string, { name: string }>
  ): Buffer {
    const escapeCsv = (val: unknown): string => {
      const str =
        val === null || val === undefined
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val as string | number | boolean)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const headers = [
      'Currency',
      'Portfolio',
      'Property',
      'Audit Status',
      'OTA Types',
      'Start Date',
      'End Date',
      'Expedia Confirmed',
      'Agoda Confirmed',
      'Booking Confirmed',
      'Total Confirmed'
    ]
    const lines: string[] = [headers.join(',')]

    for (const [currency, currencyAudits] of auditsByCurrency.entries()) {
      for (const audit of currencyAudits) {
        const portfolio = portfolioMap.get(String(audit.property.portfolio_id))
        const expediaConfirmed = audit.expedia_amount_confirmed ?? 0
        const agodaConfirmed = audit.agoda_amount_confirmed ?? 0
        const bookingConfirmed = audit.booking_amount_confirmed ?? 0
        const rowTotal = expediaConfirmed + agodaConfirmed + bookingConfirmed

        const startDateStr = audit.start_date
          ? new Date(audit.start_date).toISOString().split('T')[0]
          : ''
        const endDateStr = audit.end_date
          ? new Date(audit.end_date).toISOString().split('T')[0]
          : ''
        const otaTypes = Array.isArray(audit.type_of_ota)
          ? audit.type_of_ota.join(', ')
          : ''

        const row = [
          escapeCsv(currency),
          escapeCsv(portfolio?.name ?? ''),
          escapeCsv(audit.property?.name ?? ''),
          escapeCsv(audit.auditStatus?.status ?? ''),
          escapeCsv(otaTypes),
          escapeCsv(startDateStr),
          escapeCsv(endDateStr),
          escapeCsv(expediaConfirmed),
          escapeCsv(agodaConfirmed),
          escapeCsv(bookingConfirmed),
          escapeCsv(rowTotal)
        ]
        lines.push(row.join(','))
      }
    }

    return Buffer.from(lines.join('\r\n'), 'utf-8')
  }
}
