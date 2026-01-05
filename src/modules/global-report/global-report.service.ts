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
import {
  ParallelProcessor,
  createDecryptionProcessor
} from '../../common/utils/parallel-processor.util'
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

interface DecryptedPasswordsCacheEntry {
  data: { password: string; otaType: string }[]
  timestamp: number
}

@Injectable()
export class GlobalReportService implements IGlobalReportService {
  private readonly encryptionSecret: string
  private readonly parallelWorkers: number

  /** Cache TTL in milliseconds (5 minutes) */
  private readonly CACHE_TTL = 5 * 60 * 1000

  /** Cache for decrypted passwords (decryption is expensive) */
  private decryptedPasswordsCache: DecryptedPasswordsCacheEntry | null = null

  constructor(
    @Inject('IGlobalReportRepository')
    private globalReportRepository: IGlobalReportRepository,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>
  ) {
    this.encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!
    this.parallelWorkers = this.configService.get('parallel.workers', {
      infer: true
    }) ?? 8
  }

  /**
   * Check if cache entry is valid (exists and not expired)
   */
  private isCacheValid(cache: DecryptedPasswordsCacheEntry | null): cache is DecryptedPasswordsCacheEntry {
    return cache !== null && Date.now() - cache.timestamp < this.CACHE_TTL
  }

  /**
   * Invalidate decrypted passwords cache
   */
  invalidateDecryptedPasswordsCache(): void {
    this.decryptedPasswordsCache = null
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

    // Transform raw MongoDB documents to response DTOs with parallel password decryption
    const transformedData = await this.transformReportDataWithParallelDecryption(data)

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

    // Transform data with parallel password decryption
    const transformedData = await this.transformReportDataWithParallelDecryption(data)

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
   * Passwords are decrypted using parallel processing for performance
   * Results are cached to avoid repeated decryption
   */
  async getOtaPasswords(user: IUserWithPermissions): Promise<OtaPasswordsResponseDto> {
    // Super admin only
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can access OTA passwords')
    }

    // Return cached decrypted passwords if valid
    if (this.isCacheValid(this.decryptedPasswordsCache)) {
      return { data: this.decryptedPasswordsCache.data }
    }

    const encryptedPasswords = await this.globalReportRepository.findAllOtaPasswords()

    // Decrypt passwords using parallel processing for large datasets
    const decryptedPasswords = await ParallelProcessor.processWithWorkers<
      { password: string; otaType: string },
      { password: string; otaType: string }
    >(
      encryptedPasswords,
      createDecryptionProcessor(),
      { secret: this.encryptionSecret },
      { workerCount: this.parallelWorkers }
    )

    // Sort by otaType then password (to match previous behavior)
    decryptedPasswords.sort((a, b) => {
      if (a.otaType !== b.otaType) {
        return a.otaType.localeCompare(b.otaType)
      }
      return a.password.localeCompare(b.password)
    })

    // Cache the decrypted results
    this.decryptedPasswordsCache = {
      data: decryptedPasswords,
      timestamp: Date.now()
    }

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
   * Transform report data with parallel password decryption
   *
   * This method optimizes the transformation by:
   * 1. Extracting all unique encrypted passwords from the data
   * 2. Decrypting them in parallel using worker threads
   * 3. Using the pre-decrypted passwords during row transformation
   *
   * This is significantly faster than decrypting passwords one-by-one for each row.
   */
  private async transformReportDataWithParallelDecryption(data: any[]): Promise<ReportRowDto[]> {
    // Step 1: Extract all unique encrypted passwords
    const encryptedPasswordsMap = new Map<string, string>() // encrypted -> placeholder
    const passwordsToDecrypt: { password: string; index: number }[] = []

    for (const doc of data) {
      const otaType = doc.type_of_ota?.toLowerCase()
      const credentials = doc.credentials || {}

      if (otaType && credentials) {
        const passwordField = `${otaType}_password`
        const encryptedPassword = credentials[passwordField]

        if (encryptedPassword && !encryptedPasswordsMap.has(encryptedPassword)) {
          encryptedPasswordsMap.set(encryptedPassword, '')
          passwordsToDecrypt.push({
            password: encryptedPassword,
            index: passwordsToDecrypt.length
          })
        }
      }
    }

    // Step 2: Decrypt all passwords in parallel
    if (passwordsToDecrypt.length > 0) {
      const decryptedPasswords = await ParallelProcessor.processWithWorkers<
        { password: string; index: number },
        { password: string; decrypted: string; index: number }
      >(
        passwordsToDecrypt,
        `
          const crypto = require('crypto');
          const ALGORITHM = 'aes-256-cbc';
          const secret = context.secret;

          try {
            const parts = item.password.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];

            const key = crypto.scryptSync(secret, 'salt', 32);
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return {
              password: item.password,
              decrypted: decrypted,
              index: item.index
            };
          } catch (err) {
            return null;
          }
        `,
        { secret: this.encryptionSecret },
        { workerCount: this.parallelWorkers }
      )

      // Build the decryption map
      for (const result of decryptedPasswords) {
        if (result) {
          encryptedPasswordsMap.set(result.password, result.decrypted)
        }
      }
    }

    // Step 3: Transform data using pre-decrypted passwords
    return data.map(doc => this.transformToReportRowWithDecryptedPasswords(doc, encryptedPasswordsMap))
  }

  /**
   * Transform raw MongoDB document to ReportRowDto using pre-decrypted passwords
   */
  private transformToReportRowWithDecryptedPasswords(
    doc: any,
    decryptedPasswordsMap: Map<string, string>
  ): ReportRowDto {
    const otaType = doc.type_of_ota || null
    const credentials = doc.credentials || {}

    // Compute OTA ID and Username
    const otaId = this.getOtaFieldValue(otaType, credentials, 'id')
    const otaUsername = this.getOtaFieldValue(otaType, credentials, 'username')

    // Get password from pre-decrypted map
    let otaPassword: string | null = null
    if (otaType && credentials) {
      const passwordField = `${otaType.toLowerCase()}_password`
      const encryptedPassword = credentials[passwordField]
      if (encryptedPassword) {
        otaPassword = decryptedPasswordsMap.get(encryptedPassword) || null
      }
    }

    // Extract audit ID from MongoDB document
    const auditId = this.extractObjectId(doc._id)

    return {
      auditId,
      portfolioName: doc.portfolio?.name || '',
      propertyName: doc.property?.name || '',
      serviceType: doc.serviceType?.type || null,
      billingType: doc.billing_type || null,
      otaType,
      otaId,
      auditStatus: doc.auditStatus?.status || null,
      startDate: this.extractDate(doc.start_date),
      endDate: this.extractDate(doc.end_date),
      nextDueDate: this.extractDate(doc.property?.next_due_date),
      currency: doc.currency?.code || '',
      amountCollectable: doc.amount_collectable ?? null,
      amountConfirmed: doc.amount_confirmed ?? null,
      portfolioContactEmail: doc.portfolio?.contact_email || null,
      otaUsername,
      otaPassword
    }
  }

  /**
   * Get OTA-specific field value (id or username) based on otaType
   * Does NOT decrypt - use for non-password fields only
   */
  private getOtaFieldValue(
    otaType: string | null,
    credentials: any,
    fieldType: 'id' | 'username'
  ): string | null {
    if (!otaType) return null

    const otaLower = otaType.toLowerCase()
    const fieldName = `${otaLower}_${fieldType}`

    return credentials[fieldName] || null
  }

  /**
   * Transform raw MongoDB document to ReportRowDto
   * @deprecated Use transformReportDataWithParallelDecryption for better performance
   */
  private transformToReportRow(doc: any): ReportRowDto {
    const otaType = doc.type_of_ota || null
    const credentials = doc.credentials || {}

    // Compute OTA ID, Username and Password based on otaType
    const otaId = this.getOtaField(otaType, credentials, 'id')
    const otaUsername = this.getOtaField(otaType, credentials, 'username')
    const otaPassword = this.getOtaField(otaType, credentials, 'password')

    // Extract audit ID from MongoDB document
    // MongoDB aggregateRaw returns _id as { $oid: "..." } format
    const auditId = this.extractObjectId(doc._id)

    return {
      // Unique identifier
      auditId,
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
   * Extract ObjectId string from MongoDB extended JSON format
   * MongoDB aggregateRaw returns _id as { $oid: "..." } format
   */
  private extractObjectId(value: any): string {
    if (!value) return ''

    // Handle MongoDB extended JSON ObjectId format: { $oid: "..." }
    if (typeof value === 'object' && value.$oid) {
      return value.$oid
    }

    // Handle plain string
    if (typeof value === 'string') {
      return value
    }

    return ''
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
