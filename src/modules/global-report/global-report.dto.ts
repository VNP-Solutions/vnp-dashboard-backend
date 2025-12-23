import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type, Transform } from 'class-transformer'
import {
  Allow,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  IsIn,
  IsNotEmpty
} from 'class-validator'
import { FilterOperator } from './column-metadata'

/**
 * Column filter DTO for specifying filter criteria
 */
export class ColumnFilterDto {
  @ApiProperty({
    description: 'Column key to filter on',
    example: 'portfolioName'
  })
  @IsString()
  @IsNotEmpty()
  column: string

  @ApiProperty({
    description: 'Filter operator',
    enum: FilterOperator,
    example: FilterOperator.CONTAINS
  })
  @IsEnum(FilterOperator)
  operator: FilterOperator

  @ApiProperty({
    description:
      'Filter value. For "between" operator, use {from: value, to: value}. For "in" operator, use array.',
    example: 'Marriott'
  })
  @Allow()
  value: any
}

/**
 * Sort configuration DTO
 */
export class SortDto {
  @ApiProperty({
    description: 'Column key to sort by',
    example: 'startDate'
  })
  @IsString()
  @IsNotEmpty()
  column: string

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc'
  })
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc'
}

/**
 * Main query DTO for the Global Report API
 */
export class GlobalReportQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({
    description: 'Number of items per page (max 100)',
    example: 25,
    minimum: 1,
    maximum: 100,
    default: 25
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25

  @ApiPropertyOptional({
    description: 'Array of column filters',
    type: [ColumnFilterDto],
    example: [
      { column: 'portfolioName', operator: 'contains', value: 'Marriott' },
      { column: 'amountCollectable', operator: 'gte', value: 1000 }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnFilterDto)
  filters?: ColumnFilterDto[]

  @ApiPropertyOptional({
    description: 'Array of sort configurations (multi-column sort)',
    type: [SortDto],
    example: [
      { column: 'startDate', order: 'desc' },
      { column: 'portfolioName', order: 'asc' }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  sort?: SortDto[]

  @ApiPropertyOptional({
    description: 'Include archived audits (default: false)',
    example: false,
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeArchived?: boolean = false
}

/**
 * Export DTO extends query DTO with format and column selection
 */
export class GlobalReportExportDto extends GlobalReportQueryDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['csv', 'xlsx'],
    example: 'xlsx'
  })
  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx'

  @ApiPropertyOptional({
    description:
      'Columns to include in export (if not specified, all columns will be included)',
    type: [String],
    example: ['portfolioName', 'propertyName', 'otaType', 'amountCollectable']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[]
}

/**
 * Single row in the report response
 *
 * Fields:
 * - portfolio
 * - property
 * - service type
 * - billing type
 * - ota type
 * - ota id
 * - ota review status
 * - start date
 * - end date
 * - next due date
 * - currency
 * - amount collectable
 * - amount confirmed
 * - portfolio contact email
 * - ota username
 * - ota password
 */
export class ReportRowDto {
  @ApiProperty({ description: 'Portfolio Name' })
  portfolioName: string

  @ApiProperty({ description: 'Property Name' })
  propertyName: string

  @ApiPropertyOptional({ description: 'Service Type' })
  serviceType: string | null

  @ApiPropertyOptional({ description: 'Billing Type (VCC, DB, EBS)' })
  billingType: string | null

  @ApiPropertyOptional({ description: 'OTA Type (expedia, agoda, booking)' })
  otaType: string | null

  @ApiPropertyOptional({ description: 'OTA ID (computed based on otaType)' })
  otaId: string | null

  @ApiPropertyOptional({ description: 'OTA Review Status' })
  auditStatus: string | null

  @ApiPropertyOptional({ description: 'Start Date' })
  startDate: Date | null

  @ApiPropertyOptional({ description: 'End Date' })
  endDate: Date | null

  @ApiPropertyOptional({ description: 'Next Due Date' })
  nextDueDate: Date | null

  @ApiProperty({ description: 'Currency Code' })
  currency: string

  @ApiPropertyOptional({ description: 'Amount Collectable' })
  amountCollectable: number | null

  @ApiPropertyOptional({ description: 'Amount Confirmed' })
  amountConfirmed: number | null

  @ApiPropertyOptional({ description: 'Portfolio Contact Email' })
  portfolioContactEmail: string | null

  @ApiPropertyOptional({ description: 'OTA Username (computed based on otaType)' })
  otaUsername: string | null

  @ApiPropertyOptional({ description: 'OTA Password (computed based on otaType)' })
  otaPassword: string | null
}

/**
 * Pagination metadata
 */
export class PaginationMetadataDto {
  @ApiProperty({ example: 1500 })
  totalDocuments: number

  @ApiProperty({ example: 1 })
  currentPage: number

  @ApiProperty({ example: 60 })
  totalPages: number

  @ApiProperty({ example: 25 })
  pageSize: number
}

/**
 * Full response for the global report endpoint
 */
export class GlobalReportResponseDto {
  @ApiProperty({ type: [ReportRowDto] })
  data: ReportRowDto[]

  @ApiProperty({ type: PaginationMetadataDto })
  metadata: PaginationMetadataDto
}

/**
 * Single column metadata for frontend
 */
export class ColumnMetadataDto {
  @ApiProperty({ example: 'portfolioName' })
  key: string

  @ApiProperty({ example: 'Portfolio' })
  label: string

  @ApiProperty({ example: 'string' })
  dataType: string

  @ApiProperty({ example: true })
  filterable: boolean

  @ApiProperty({ example: true })
  sortable: boolean

  @ApiProperty({ type: [String], example: ['eq', 'contains', 'in'] })
  allowedOperators: string[]

  @ApiPropertyOptional({ type: [String], example: ['expedia', 'agoda', 'booking'] })
  enumValues?: string[]
}

/**
 * Response for columns metadata endpoint
 */
export class ColumnsMetadataResponseDto {
  @ApiProperty({ type: [ColumnMetadataDto] })
  columns: ColumnMetadataDto[]
}
