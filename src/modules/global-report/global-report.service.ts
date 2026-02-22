import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as XLSX from 'xlsx'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { roundToDecimals } from '../../common/utils/amount.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { canAccessGlobalReport } from '../../common/utils/permission.util'
import { Configuration } from '../../config/configuration'
import { REPORT_COLUMNS, getAllColumnKeys } from './column-metadata'
import {
  ColumnFilterDto,
  ColumnsMetadataResponseDto,
  GlobalReportExportDto,
  GlobalReportQueryDto,
  GlobalReportResponseDto,
  OtaIdsResponseDto,
  OtaPasswordsResponseDto,
  OtaUsernamesResponseDto,
  PortfolioContactEmailsResponseDto,
  PortfoliosListResponseDto,
  PropertiesListResponseDto,
  ReportRowDto,
  SortDto
} from './global-report.dto'
import type {
  IGlobalReportRepository,
  IGlobalReportService
} from './global-report.interface'

interface DecryptedPasswordsCacheEntry {
  data: { password: string; otaType: string }[]
  timestamp: number
}

@Injectable()
export class GlobalReportService implements IGlobalReportService {
  /**
   * Pre-derived encryption key for fast bulk decryption
   * Derived once at startup to avoid expensive scryptSync calls
   */
  private readonly encryptionKey: Buffer

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
    // Pre-derive the encryption key once at startup (scryptSync is expensive)
    const encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })!
    this.encryptionKey = EncryptionUtil.deriveKey(encryptionSecret)
  }

  /**
   * Check if cache entry is valid (exists and not expired)
   */
  private isCacheValid(
    cache: DecryptedPasswordsCacheEntry | null
  ): cache is DecryptedPasswordsCacheEntry {
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
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access global reports'
      )
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
    const transformedData = this.transformReportDataWithDecryption(data)

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
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to export global reports'
      )
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
    const transformedData = this.transformReportDataWithDecryption(data)

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
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access OTA IDs'
      )
    }

    const otaIds = await this.globalReportRepository.findAllOtaIds()
    return { data: otaIds }
  }

  /**
   * Get all portfolio contact emails for filtering
   */
  async getPortfolioContactEmails(
    user: IUserWithPermissions
  ): Promise<PortfolioContactEmailsResponseDto> {
    // Super admin only
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access portfolio contact emails'
      )
    }

    const emails =
      await this.globalReportRepository.findAllPortfolioContactEmails()
    return { data: emails }
  }

  /**
   * Get all OTA usernames for filtering
   */
  async getOtaUsernames(
    user: IUserWithPermissions
  ): Promise<OtaUsernamesResponseDto> {
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access OTA usernames'
      )
    }

    const usernames = await this.globalReportRepository.findAllOtaUsernames()
    return { data: usernames }
  }

  /**
   * Get all OTA passwords for filtering
   * Passwords are decrypted using parallel processing for performance
   * Results are cached to avoid repeated decryption
   */
  async getOtaPasswords(
    user: IUserWithPermissions
  ): Promise<OtaPasswordsResponseDto> {
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access OTA passwords'
      )
    }

    // Return cached decrypted passwords if valid
    if (this.isCacheValid(this.decryptedPasswordsCache)) {
      return { data: this.decryptedPasswordsCache.data }
    }

    const encryptedPasswords =
      await this.globalReportRepository.findAllOtaPasswords()

    // Decrypt passwords using pre-derived key (fast)
    const decryptedPasswords: { password: string; otaType: string }[] = []
    for (const item of encryptedPasswords) {
      try {
        const decrypted = EncryptionUtil.decryptWithKey(
          item.password,
          this.encryptionKey
        )
        decryptedPasswords.push({ password: decrypted, otaType: item.otaType })
      } catch {
        // If decryption fails, skip this password
      }
    }

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
   * Get Expedia IDs only
   */
  async getExpediaIds(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Expedia IDs')
    }

    const allOtaIds = await this.globalReportRepository.findAllOtaIds()
    const expediaIds = allOtaIds
      .filter(item => item.otaType === 'expedia')
      .map(item => item.otaId)
    
    return { data: expediaIds }
  }

  /**
   * Get Agoda IDs only
   */
  async getAgodaIds(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Agoda IDs')
    }

    const allOtaIds = await this.globalReportRepository.findAllOtaIds()
    const agodaIds = allOtaIds
      .filter(item => item.otaType === 'agoda')
      .map(item => item.otaId)
    
    return { data: agodaIds }
  }

  /**
   * Get Booking IDs only
   */
  async getBookingIds(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Booking IDs')
    }

    const allOtaIds = await this.globalReportRepository.findAllOtaIds()
    const bookingIds = allOtaIds
      .filter(item => item.otaType === 'booking')
      .map(item => item.otaId)
    
    return { data: bookingIds }
  }

  /**
   * Get Expedia usernames only
   */
  async getExpediaUsernames(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Expedia usernames')
    }

    const allUsernames = await this.globalReportRepository.findAllOtaUsernames()
    const expediaUsernames = allUsernames
      .filter(item => item.otaType === 'expedia')
      .map(item => item.username)
    
    return { data: expediaUsernames }
  }

  /**
   * Get Agoda usernames only
   */
  async getAgodaUsernames(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Agoda usernames')
    }

    const allUsernames = await this.globalReportRepository.findAllOtaUsernames()
    const agodaUsernames = allUsernames
      .filter(item => item.otaType === 'agoda')
      .map(item => item.username)
    
    return { data: agodaUsernames }
  }

  /**
   * Get Booking usernames only
   */
  async getBookingUsernames(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Booking usernames')
    }

    const allUsernames = await this.globalReportRepository.findAllOtaUsernames()
    const bookingUsernames = allUsernames
      .filter(item => item.otaType === 'booking')
      .map(item => item.username)
    
    return { data: bookingUsernames }
  }

  /**
   * Get Expedia passwords only (decrypted)
   */
  async getExpediaPasswords(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Expedia passwords')
    }

    const allPasswords = await this.getOtaPasswords(user)
    const expediaPasswords = allPasswords.data
      .filter(item => item.otaType === 'expedia')
      .map(item => item.password)
    
    return { data: expediaPasswords }
  }

  /**
   * Get Agoda passwords only (decrypted)
   */
  async getAgodaPasswords(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Agoda passwords')
    }

    const allPasswords = await this.getOtaPasswords(user)
    const agodaPasswords = allPasswords.data
      .filter(item => item.otaType === 'agoda')
      .map(item => item.password)
    
    return { data: agodaPasswords }
  }

  /**
   * Get Booking passwords only (decrypted)
   */
  async getBookingPasswords(user: IUserWithPermissions): Promise<{ data: string[] }> {
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException('You do not have permission to access Booking passwords')
    }

    const allPasswords = await this.getOtaPasswords(user)
    const bookingPasswords = allPasswords.data
      .filter(item => item.otaType === 'booking')
      .map(item => item.password)
    
    return { data: bookingPasswords }
  }

  /**
   * Get all portfolios (id and name only) for filtering
   * Uses optimized repository method with caching
   */
  async getPortfolios(
    user: IUserWithPermissions
  ): Promise<PortfoliosListResponseDto> {
    // Super admin only
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access portfolios list'
      )
    }

    const portfolios = await this.globalReportRepository.findAllPortfolios()
    return { data: portfolios }
  }

  /**
   * Get all properties (id and name only) for filtering
   * Uses optimized repository method with caching
   */
  async getProperties(
    user: IUserWithPermissions
  ): Promise<PropertiesListResponseDto> {
    // Super admin only
    // Check access permissions
    if (!canAccessGlobalReport(user)) {
      throw new ForbiddenException(
        'You do not have permission to access properties list'
      )
    }

    const properties = await this.globalReportRepository.findAllProperties()
    return { data: properties }
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
        throw new BadRequestException(
          `Column ${filter.column} is not filterable`
        )
      }
      if (!col.allowedOperators.includes(filter.operator)) {
        throw new BadRequestException(
          `Operator '${filter.operator}' is not allowed for column '${filter.column}'. Allowed operators: ${col.allowedOperators.join(', ')}`
        )
      }
      // Validate enum values
      if (
        col.enumValues &&
        filter.value !== null &&
        filter.value !== undefined
      ) {
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
   * Transform report data with password decryption
   *
   * Passwords are stored encrypted (iv:encrypted format).
   * This method decrypts them using EncryptionUtil.
   */
  private transformReportDataWithDecryption(data: any[]): ReportRowDto[] {
    // Step 1: Extract all unique encrypted passwords from all OTA types
    const passwordMap = new Map<string, string>() // encrypted -> decrypted

    for (const doc of data) {
      const credentials = doc.credentials || {}

      // Collect all encrypted passwords (for all OTA types)
      const passwordFields = [
        'expedia_password',
        'agoda_password',
        'booking_password'
      ]

      for (const field of passwordFields) {
        const encryptedPassword = credentials[field]
        if (encryptedPassword && !passwordMap.has(encryptedPassword)) {
          // Decrypt the password using pre-derived key (fast)
          try {
            const decrypted = EncryptionUtil.decryptWithKey(
              encryptedPassword,
              this.encryptionKey
            )
            passwordMap.set(encryptedPassword, decrypted)
          } catch {
            // If decryption fails, store empty string
            passwordMap.set(encryptedPassword, '')
          }
        }
      }
    }

    // Step 2: Transform data using password map
    return data.map(doc =>
      this.transformToReportRowWithDecryptedPasswords(doc, passwordMap)
    )
  }

  /**
   * Transform raw MongoDB document to ReportRowDto using pre-decrypted passwords
   */
  private transformToReportRowWithDecryptedPasswords(
    doc: any,
    passwordMap: Map<string, string>
  ): ReportRowDto {
    // type_of_ota is now an array
    const otaTypeArray =
      doc.type_of_ota && Array.isArray(doc.type_of_ota) ? doc.type_of_ota : []
    
    const credentials = doc.credentials || {}

    // Extract individual OTA credentials
    const expediaId = credentials.expedia_id || null
    const expediaUsername = credentials.expedia_username || null
    const expediaPassword = credentials.expedia_password
      ? (passwordMap.get(credentials.expedia_password) || null)
      : null

    const agodaId = credentials.agoda_id || null
    const agodaUsername = credentials.agoda_username || null
    const agodaPassword = credentials.agoda_password
      ? (passwordMap.get(credentials.agoda_password) || null)
      : null

    const bookingId = credentials.booking_id || null
    const bookingUsername = credentials.booking_username || null
    const bookingPassword = credentials.booking_password
      ? (passwordMap.get(credentials.booking_password) || null)
      : null

    // Extract audit ID from MongoDB document
    const auditId = this.extractObjectId(doc._id)

    // Build result with amounts
    const result = {
      auditId,
      portfolioName: doc.portfolio?.name || '',
      propertyName: doc.property?.name || '',
      serviceType: doc.serviceType?.type || null,
      billingType: doc.billing_type || null,
      otaType: otaTypeArray,
      expediaId,
      expediaUsername,
      expediaPassword,
      agodaId,
      agodaUsername,
      agodaPassword,
      bookingId,
      bookingUsername,
      bookingPassword,
      auditStatus: doc.auditStatus?.status || null,
      startDate: this.extractDate(doc.start_date),
      endDate: this.extractDate(doc.end_date),
      nextDueDate: this.extractDate(doc.property?.next_due_date),
      currency: doc.currency?.code || '',
      amountCollectable: roundToDecimals(doc.amount_collectable) ?? null,
      amountConfirmed: roundToDecimals(doc.amount_confirmed) ?? null,
      portfolioContactEmail: doc.portfolio?.contact_email || null
    }

    return result
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
   * Get OTA password based on otaType
   * Handles both plain text and encrypted passwords via passwordMap
   */
  private getOtaPassword(
    otaType: string | null,
    credentials: any,
    passwordMap: Map<string, string>
  ): string | null {
    if (!otaType || !credentials) return null

    const otaLower = otaType.toLowerCase()
    const passwordField = `${otaLower}_password`
    const rawPassword = credentials[passwordField]

    if (!rawPassword) return null

    // Look up in password map first (for decrypted passwords)
    // Fall back to raw password (for plain text passwords not in map)
    return passwordMap.get(rawPassword) ?? rawPassword
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
