import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  GlobalReportQueryDto,
  GlobalReportExportDto,
  GlobalReportResponseDto,
  ColumnsMetadataResponseDto,
  OtaIdsResponseDto
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
}
