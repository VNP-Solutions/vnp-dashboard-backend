import {
  ForbiddenException,
  Inject,
  Injectable,
  BadRequestException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as XLSX from 'xlsx'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { Configuration } from '../../config/configuration'
import {
  REPORT_COLUMNS,
  getAllColumnKeys
} from './column-metadata'
import {
  GlobalReportQueryDto,
  GlobalReportExportDto,
  GlobalReportResponseDto,
  ColumnsMetadataResponseDto,
  OtaIdsResponseDto,
  PortfolioContactEmailsResponseDto,
  OtaUsernamesResponseDto,
  OtaPasswordsResponseDto,
  ReportRowDto,
  ColumnFilterDto,
  SortDto
} from './global-report.dto'
import type { IGlobalReportRepository, IGlobalReportService } from './global-report.interface'

@Injectable()
export class GlobalReportService implements IGlobalReportService {
  private readonly encryptionSecret: string

  constructor(
    @Inject('IGlobalReportRepository')
    private globalReportRepository: IGlobalReportRepository,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>
  ) {
    this.encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!
  }

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
   * Excludes filterOnly columns (ID columns used only for filtering)
   */
  getColumnsMetadata(): ColumnsMetadataResponseDto {
    const columns = Object.values(REPORT_COLUMNS)
      .filter(col => !col.filterOnly)
      .map(col => ({
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
   * Get all OTA IDs for filtering
   */
  async getOtaIds(user: IUserWithPermissions): Promise<OtaIdsResponseDto> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can access OTA IDs')
    }

    const otaIds = await this.globalReportRepository.findAllOtaIds()
    return { data: otaIds }
  }

  /**
   * Get all portfolio contact emails for filtering
   */
  async getPortfolioContactEmails(user: IUserWithPermissions): Promise<PortfolioContactEmailsResponseDto> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can access portfolio contact emails')
    }

    const emails = await this.globalReportRepository.findAllPortfolioContactEmails()
    return { data: emails }
  }

  /**
   * Get all OTA usernames for filtering
   */
  async getOtaUsernames(user: IUserWithPermissions): Promise<OtaUsernamesResponseDto> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can access OTA usernames')
    }

    const usernames = await this.globalReportRepository.findAllOtaUsernames()
    return { data: usernames }
  }

  /**
   * Get all OTA passwords for filtering
   * Passwords are decrypted before returning
   */
  async getOtaPasswords(user: IUserWithPermissions): Promise<OtaPasswordsResponseDto> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can access OTA passwords')
    }

    const encryptedPasswords = await this.globalReportRepository.findAllOtaPasswords()

    // Decrypt passwords
    const decryptedPasswords = encryptedPasswords
      .map(item => {
        try {
          return {
            password: EncryptionUtil.decrypt(item.password, this.encryptionSecret),
            otaType: item.otaType
          }
        } catch {
          // Skip passwords that fail to decrypt
          return null
        }
      })
      .filter((item): item is { password: string; otaType: string } => item !== null)

    return { data: decryptedPasswords }
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
   *
   * Returns only the 16 required fields:
   * - portfolio, property, service type, billing type, ota type, ota id,
   * - ota review status, start date, end date, next due date, currency,
   * - amount collectable, amount confirmed, portfolio contact email,
   * - ota username, ota password
   */
  private transformToReportRow(doc: any): ReportRowDto {
    const otaType = doc.type_of_ota || null
    const credentials = doc.credentials || {}

    // Compute OTA ID, Username and Password based on otaType
    const otaId = this.getOtaField(otaType, credentials, 'id')
    const otaUsername = this.getOtaField(otaType, credentials, 'username')
    const otaPassword = this.getOtaField(otaType, credentials, 'password')

    return {
      // 1. Portfolio
      portfolioName: doc.portfolio?.name || '',
      // 2. Property
      propertyName: doc.property?.name || '',
      // 3. Service Type
      serviceType: doc.serviceType?.type || null,
      // 4. Billing Type
      billingType: doc.billing_type || null,
      // 5. OTA Type
      otaType,
      // 6. OTA ID
      otaId,
      // 7. OTA Review Status
      auditStatus: doc.auditStatus?.status || null,
      // 8. Start Date
      startDate: this.extractDate(doc.start_date),
      // 9. End Date
      endDate: this.extractDate(doc.end_date),
      // 10. Next Due Date
      nextDueDate: this.extractDate(doc.property?.next_due_date),
      // 11. Currency
      currency: doc.currency?.code || '',
      // 12. Amount Collectable
      amountCollectable: doc.amount_collectable ?? null,
      // 13. Amount Confirmed
      amountConfirmed: doc.amount_confirmed ?? null,
      // 14. Portfolio Contact Email
      portfolioContactEmail: doc.portfolio?.contact_email || null,
      // 15. OTA Username
      otaUsername,
      // 16. OTA Password
      otaPassword
    }
  }

  /**
   * Extract Date from MongoDB extended JSON format or plain value
   * MongoDB aggregateRaw returns dates as { $date: "ISO_STRING" } or { $date: { $numberLong: "timestamp" } }
   */
  private extractDate(value: any): Date | null {
    if (!value) return null

    // Handle MongoDB extended JSON date format: { $date: "2024-01-01T00:00:00Z" }
    if (typeof value === 'object' && value.$date) {
      // Could be string ISO date or { $numberLong: "timestamp" }
      if (typeof value.$date === 'string') {
        return new Date(value.$date)
      }
      if (typeof value.$date === 'object' && value.$date.$numberLong) {
        return new Date(parseInt(value.$date.$numberLong, 10))
      }
    }

    // Handle plain Date object or ISO string
    if (value instanceof Date) {
      return value
    }

    if (typeof value === 'string') {
      return new Date(value)
    }

    return null
  }

  /**
   * Get OTA-specific field (id, username, or password) based on otaType
   * Passwords are decrypted before returning
   */
  private getOtaField(otaType: string | null, credentials: any, fieldType: 'id' | 'username' | 'password'): string | null {
    if (!otaType) return null

    const otaLower = otaType.toLowerCase()
    let value: string | null = null

    switch (otaLower) {
      case 'expedia':
        value = credentials[`expedia_${fieldType}`] || null
        break
      case 'agoda':
        value = credentials[`agoda_${fieldType}`] || null
        break
      case 'booking':
        value = credentials[`booking_${fieldType}`] || null
        break
      default:
        return null
    }

    // Decrypt password if it exists
    if (fieldType === 'password' && value) {
      try {
        return EncryptionUtil.decrypt(value, this.encryptionSecret)
      } catch {
        // If decryption fails, return null
        return null
      }
    }

    return value
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
