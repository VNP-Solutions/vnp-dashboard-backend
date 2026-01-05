import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  GlobalReportQueryDto,
  GlobalReportExportDto,
  GlobalReportResponseDto,
  ColumnsMetadataResponseDto,
  OtaIdsResponseDto,
  PortfolioContactEmailsResponseDto,
  OtaUsernamesResponseDto,
  OtaPasswordsResponseDto,
  PortfoliosListResponseDto,
  PropertiesListResponseDto
} from './global-report.dto'
import { ColumnFilter, SortConfig } from './aggregation-builder'

/**
 * Aggregation options for repository queries
 */
export interface AggregationOptions {
  filters: ColumnFilter[]
  sort: SortConfig[]
  page: number
  limit: number
  excludeArchived: boolean
}

/**
 * Repository result with data and total count
 */
export interface AggregationResult<T> {
  data: T[]
  total: number
}

/**
 * OTA ID item from database
 */
export interface OtaIdItem {
  otaId: string
  otaType: string
}

/**
 * Portfolio contact email item from database
 */
export interface PortfolioContactEmailItem {
  email: string
  portfolioName: string
}

/**
 * OTA username item from database
 */
export interface OtaUsernameItem {
  username: string
  otaType: string
}

/**
 * OTA password item from database (encrypted in storage, decrypted for API)
 */
export interface OtaPasswordItem {
  password: string
  otaType: string
}

/**
 * Portfolio list item (id and name only)
 */
export interface PortfolioListItem {
  id: string
  name: string
}

/**
 * Property list item (id and name only)
 */
export interface PropertyListItem {
  id: string
  name: string
}

/**
 * Global Report Repository Interface
 */
export interface IGlobalReportRepository {
  /**
   * Execute aggregation pipeline and return paginated results
   */
  findAll(options: AggregationOptions): Promise<AggregationResult<any>>

  /**
   * Execute aggregation pipeline for export (no pagination)
   */
  findAllForExport(
    options: Omit<AggregationOptions, 'page' | 'limit'>
  ): Promise<any[]>

  /**
   * Get all unique OTA IDs from PropertyCredentials
   */
  findAllOtaIds(): Promise<OtaIdItem[]>

  /**
   * Get all unique portfolio contact emails
   */
  findAllPortfolioContactEmails(): Promise<PortfolioContactEmailItem[]>

  /**
   * Get all unique OTA usernames from PropertyCredentials
   */
  findAllOtaUsernames(): Promise<OtaUsernameItem[]>

  /**
   * Get all OTA passwords from PropertyCredentials (encrypted)
   */
  findAllOtaPasswords(): Promise<{ password: string; otaType: string }[]>

  /**
   * Get all portfolios (id and name only)
   */
  findAllPortfolios(): Promise<PortfolioListItem[]>

  /**
   * Get all properties (id and name only)
   */
  findAllProperties(): Promise<PropertyListItem[]>

  /**
   * Invalidate all cached data (call when credentials/portfolios are modified)
   */
  invalidateCache(): void
}

/**
 * Global Report Service Interface
 */
export interface IGlobalReportService {
  /**
   * Get paginated report data with filters and sorting
   */
  getReport(
    query: GlobalReportQueryDto,
    user: IUserWithPermissions
  ): Promise<GlobalReportResponseDto>

  /**
   * Export report data to CSV or Excel
   */
  exportReport(
    query: GlobalReportExportDto,
    user: IUserWithPermissions
  ): Promise<Buffer>

  /**
   * Get column metadata for the frontend
   */
  getColumnsMetadata(): ColumnsMetadataResponseDto

  /**
   * Get all OTA IDs for filtering
   */
  getOtaIds(user: IUserWithPermissions): Promise<OtaIdsResponseDto>

  /**
   * Get all portfolio contact emails for filtering
   */
  getPortfolioContactEmails(user: IUserWithPermissions): Promise<PortfolioContactEmailsResponseDto>

  /**
   * Get all OTA usernames for filtering
   */
  getOtaUsernames(user: IUserWithPermissions): Promise<OtaUsernamesResponseDto>

  /**
   * Get all OTA passwords for filtering
   */
  getOtaPasswords(user: IUserWithPermissions): Promise<OtaPasswordsResponseDto>

  /**
   * Get all portfolios (id and name only) for filtering
   */
  getPortfolios(user: IUserWithPermissions): Promise<PortfoliosListResponseDto>

  /**
   * Get all properties (id and name only) for filtering
   */
  getProperties(user: IUserWithPermissions): Promise<PropertiesListResponseDto>
}
