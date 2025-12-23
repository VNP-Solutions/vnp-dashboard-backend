import {
  ForbiddenException,
  Inject,
  Injectable,
  BadRequestException
} from '@nestjs/common'
import * as XLSX from 'xlsx'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import {
  REPORT_COLUMNS,
  getAllColumnKeys
} from './column-metadata'
import {
  GlobalReportQueryDto,
  GlobalReportExportDto,
  GlobalReportResponseDto,
  ColumnsMetadataResponseDto,
  ReportRowDto,
  ColumnFilterDto,
  SortDto
} from './global-report.dto'
import type { IGlobalReportRepository, IGlobalReportService } from './global-report.interface'

@Injectable()
export class GlobalReportService implements IGlobalReportService {
  constructor(
    @Inject('IGlobalReportRepository')
    private globalReportRepository: IGlobalReportRepository
  ) {}

  /**
   * Get paginated report data with filters and sorting
   */
  async getReport(
    query: GlobalReportQueryDto,
    user: IUserWithPermissions
  ): Promise<GlobalReportResponseDto> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can access global reports')
    }

    // Validate filters
    this.validateFilters(query.filters || [])

    // Validate sort
    this.validateSort(query.sort || [])

    const { data, total } = await this.globalReportRepository.findAll({
      filters: query.filters || [],
      sort: query.sort || [],
      page: query.page || 1,
      limit: query.limit || 25,
      excludeArchived: !query.includeArchived
    })

    // Transform raw MongoDB documents to response DTOs
    const transformedData = data.map(doc => this.transformToReportRow(doc))

    return {
      data: transformedData,
      metadata: {
        totalDocuments: total,
        currentPage: query.page || 1,
        totalPages: Math.ceil(total / (query.limit || 25)),
        pageSize: query.limit || 25
      }
    }
  }

  /**
   * Export report data to CSV or Excel
   */
  async exportReport(
    query: GlobalReportExportDto,
    user: IUserWithPermissions
  ): Promise<Buffer> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can export global reports')
    }

    // Validate filters
    this.validateFilters(query.filters || [])

    // Validate sort
    this.validateSort(query.sort || [])

    const data = await this.globalReportRepository.findAllForExport({
      filters: query.filters || [],
      sort: query.sort || [],
      excludeArchived: !query.includeArchived
    })

    // Transform data
    const transformedData = data.map(doc => this.transformToReportRow(doc))

    // Determine columns to export
    const columnsToExport = query.columns?.length
      ? query.columns.filter(col => col in REPORT_COLUMNS)
      : getAllColumnKeys()

    // Build export rows with proper labels
    const exportRows = transformedData.map(row => {
      const exportRow: any = {}
      for (const colKey of columnsToExport) {
        const col = REPORT_COLUMNS[colKey]
        if (col) {
          const value = (row as any)[colKey]
          // Format dates for export
          if (value instanceof Date) {
            exportRow[col.label] = value.toISOString().split('T')[0]
          } else if (value === null || value === undefined) {
            exportRow[col.label] = ''
          } else {
            exportRow[col.label] = value
          }
        }
      }
      return exportRow
    })

    if (query.format === 'xlsx') {
      return this.generateExcel(exportRows)
    } else {
      return this.generateCsv(exportRows)
    }
  }

  /**
   * Get column metadata for the frontend
   */
  getColumnsMetadata(): ColumnsMetadataResponseDto {
    const columns = Object.values(REPORT_COLUMNS).map(col => ({
      key: col.key,
      label: col.label,
      dataType: col.dataType,
      filterable: col.filterable,
      sortable: col.sortable,
      allowedOperators: col.allowedOperators,
      enumValues: col.enumValues
    }))

    return { columns }
  }

  /**
   * Validate filters against column metadata
   */
  private validateFilters(filters: ColumnFilterDto[]): void {
    for (const filter of filters) {
      const col = REPORT_COLUMNS[filter.column]
      if (!col) {
        throw new BadRequestException(`Unknown column: ${filter.column}`)
      }
      if (!col.filterable) {
        throw new BadRequestException(`Column ${filter.column} is not filterable`)
      }
      if (!col.allowedOperators.includes(filter.operator)) {
        throw new BadRequestException(
          `Operator '${filter.operator}' is not allowed for column '${filter.column}'. Allowed operators: ${col.allowedOperators.join(', ')}`
        )
      }
      // Validate enum values
      if (col.enumValues && filter.value !== null && filter.value !== undefined) {
        const valuesToCheck = Array.isArray(filter.value)
          ? filter.value
          : [filter.value]
        for (const val of valuesToCheck) {
          if (typeof val === 'string' && !col.enumValues.includes(val)) {
            throw new BadRequestException(
              `Invalid value '${val}' for column '${filter.column}'. Allowed values: ${col.enumValues.join(', ')}`
            )
          }
        }
      }
    }
  }

  /**
   * Validate sort columns
   */
  private validateSort(sort: SortDto[]): void {
    for (const s of sort) {
      const col = REPORT_COLUMNS[s.column]
      if (!col) {
        throw new BadRequestException(`Unknown column: ${s.column}`)
      }
      if (!col.sortable) {
        throw new BadRequestException(`Column ${s.column} is not sortable`)
      }
    }
  }

  /**
   * Transform raw MongoDB document to ReportRowDto
   */
  private transformToReportRow(doc: any): ReportRowDto {
    return {
      auditId: this.extractId(doc._id),
      otaType: doc.type_of_ota || null,
      billingType: doc.billing_type || null,
      startDate: doc.start_date ? new Date(doc.start_date) : null,
      endDate: doc.end_date ? new Date(doc.end_date) : null,
      amountCollectable: doc.amount_collectable ?? null,
      amountConfirmed: doc.amount_confirmed ?? null,
      isArchived: doc.is_archived || false,
      auditStatus: doc.auditStatus?.status || null,
      batchNo: doc.batch?.batch_no || null,
      propertyId: this.extractId(doc.property?._id) || this.extractId(doc.property_id) || '',
      propertyName: doc.property?.name || '',
      propertyAddress: doc.property?.address || null,
      propertyIsActive: doc.property?.is_active ?? false,
      nextDueDate: doc.property?.next_due_date
        ? new Date(doc.property.next_due_date)
        : null,
      currency: doc.currency?.code || '',
      currencySymbol: doc.currency?.symbol || null,
      portfolioId:
        this.extractId(doc.portfolio?._id) ||
        this.extractId(doc.property?.portfolio_id) ||
        '',
      portfolioName: doc.portfolio?.name || '',
      portfolioContactEmail: doc.portfolio?.contact_email || null,
      serviceType: doc.serviceType?.type || null,
      expediaId: doc.credentials?.expedia_id || null,
      expediaUsername: doc.credentials?.expedia_username || null,
      agodaId: doc.credentials?.agoda_id || null,
      agodaUsername: doc.credentials?.agoda_username || null,
      bookingId: doc.credentials?.booking_id || null,
      bookingUsername: doc.credentials?.booking_username || null,
      bankType: doc.bankDetails?.bank_type || null,
      reportUrl: doc.report_url || null,
      auditCreatedAt: doc.created_at ? new Date(doc.created_at) : new Date(),
      auditUpdatedAt: doc.updated_at ? new Date(doc.updated_at) : new Date()
    }
  }

  /**
   * Extract ID string from MongoDB ObjectId or $oid format
   */
  private extractId(id: any): string {
    if (!id) return ''
    if (typeof id === 'string') return id
    if (id.$oid) return id.$oid
    if (id.toString) return id.toString()
    return ''
  }

  /**
   * Generate Excel file from data
   */
  private generateExcel(data: any[]): Buffer {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Auto-size columns
    const maxWidth = 50
    const colWidths: { [key: string]: number } = {}

    // Get header widths
    if (data.length > 0) {
      Object.keys(data[0]).forEach(key => {
        colWidths[key] = key.length
      })
    }

    // Get data widths
    data.forEach(row => {
      Object.entries(row).forEach(([key, value]) => {
        let stringValue = ''
        if (value != null) {
          if (typeof value === 'object') {
            stringValue = JSON.stringify(value)
          } else {
            stringValue = String(value as string | number | boolean)
          }
        }
        const valueLength = stringValue.length
        colWidths[key] = Math.min(
          Math.max(colWidths[key] || 0, valueLength),
          maxWidth
        )
      })
    })

    worksheet['!cols'] = Object.values(colWidths).map(w => ({ wch: w + 2 }))

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Global Report')
    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    )
  }

  /**
   * Generate CSV file from data
   */
  private generateCsv(data: any[]): Buffer {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Global Report')
    const csvContent = XLSX.utils.sheet_to_csv(worksheet)
    return Buffer.from(csvContent, 'utf-8')
  }
}
