import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OtaType } from '@prisma/client'
import { Transform } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateAuditDto {
  @ApiPropertyOptional({
    enum: OtaType,
    example: [OtaType.expedia, OtaType.agoda],
    description: 'Array of OTA types (expedia, agoda, booking). No duplicates allowed.',
    isArray: true,
    type: [String]
  })
  @IsArray()
  @IsEnum(OtaType, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    // Ensure it's an array
    if (!Array.isArray(value)) {
      return value
    }
    // Remove duplicates by converting to Set and back to array
    return [...new Set(value)]
  })
  type_of_ota?: OtaType[]

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Audit status ID'
  })
  @IsString()
  @IsNotEmpty()
  audit_status_id: string

  // Expedia amounts
  @ApiPropertyOptional({
    example: 5000.50,
    description: 'Expedia amount collectable'
  })
  @IsNumber()
  @IsOptional()
  expedia_amount_collectable?: number

  @ApiPropertyOptional({
    example: 4500.75,
    description: 'Expedia amount confirmed'
  })
  @IsNumber()
  @IsOptional()
  expedia_amount_confirmed?: number

  // Agoda amounts
  @ApiPropertyOptional({
    example: 3000.00,
    description: 'Agoda amount collectable'
  })
  @IsNumber()
  @IsOptional()
  agoda_amount_collectable?: number

  @ApiPropertyOptional({
    example: 2800.50,
    description: 'Agoda amount confirmed'
  })
  @IsNumber()
  @IsOptional()
  agoda_amount_confirmed?: number

  // Booking amounts
  @ApiPropertyOptional({
    example: 2000.00,
    description: 'Booking amount collectable'
  })
  @IsNumber()
  @IsOptional()
  booking_amount_collectable?: number

  @ApiPropertyOptional({
    example: 1900.25,
    description: 'Booking amount confirmed'
  })
  @IsNumber()
  @IsOptional()
  booking_amount_confirmed?: number

  @ApiPropertyOptional({
    example: '2024-01-01T00:00:00Z',
    description: 'Audit start date'
  })
  @IsDateString()
  @IsOptional()
  start_date?: string

  @ApiPropertyOptional({
    example: '2024-01-31T23:59:59Z',
    description: 'Audit end date'
  })
  @IsDateString()
  @IsOptional()
  end_date?: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439013',
    description: 'Audit Batch ID (optional)'
  })
  @IsString()
  @IsOptional()
  batch_id?: string

  @ApiPropertyOptional({
    example: 'https://example.com/report.pdf',
    description: 'Report URL'
  })
  @IsString()
  @IsOptional()
  report_url?: string

  @ApiPropertyOptional({
    example: '2024-01-15T00:00:00Z',
    description: 'Review collection date'
  })
  @IsDateString()
  @IsOptional()
  review_collection_date?: string
}

export class UpdateAuditDto extends PartialType(CreateAuditDto) {}

export class AuditQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by batch ID',
    example: '507f1f77bcf86cd799439013'
  })
  @IsOptional()
  @IsString()
  batch_id?: string

  @ApiPropertyOptional({
    enum: OtaType,
    description: 'Filter by OTA type (expedia, agoda, booking). Can filter by single value or use operators like "in" for multiple values.',
    example: OtaType.expedia
  })
  @IsOptional()
  @IsString()
  type_of_ota?: string

  @ApiPropertyOptional({
    description: 'Filter by audit status ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  audit_status_id?: string

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Filter by Expedia ID from property credentials',
    example: 'EXP123456'
  })
  @IsOptional()
  @IsString()
  expedia_id?: string

  @ApiPropertyOptional({
    description:
      'Filter by archived status (true/false/All/empty string to ignore filter)',
    example: 'false'
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value.toString()
    if (typeof value === 'string') return value
    return value
  })
  is_archived?: string

  @ApiPropertyOptional({
    description:
      'Filter by status category (pending, upcoming, completed) or by specific status IDs. For categories, use single values: "pending", "upcoming", or "completed". For status IDs, multiple IDs can be provided as comma-separated string, e.g., "507f1f77bcf86cd799439011,507f1f77bcf86cd799439012"',
    example: 'upcoming'
  })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string
}

export class BulkArchiveAuditDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of audit IDs to archive'
  })
  @IsArray()
  @IsNotEmpty()
  audit_ids: string[]
}

export class BulkImportResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of audits successfully imported'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      {
        row: 3,
        audit: 'Property A - Expedia Audit',
        error: 'Property not found'
      }
    ],
    description: 'List of errors encountered during import'
  })
  errors: Array<{
    row: number
    audit: string
    error: string
  }>

  @ApiProperty({
    example: ['Property A - Expedia Audit', 'Property B - Agoda Audit'],
    description: 'List of successfully imported audit descriptions'
  })
  successfulImports: string[]
}

export class BulkUpdateResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of audits successfully updated'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      { row: 3, auditId: '507f1f77bcf86cd799439011', error: 'Audit not found' }
    ],
    description: 'List of errors encountered during update'
  })
  errors: Array<{
    row: number
    auditId: string
    error: string
  }>

  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'List of successfully updated audit IDs'
  })
  successfulUpdates: string[]
}

export class GlobalStatsAmountDto {
  @ApiProperty({ example: 150000, description: 'Total amount' })
  total: number

  @ApiProperty({ example: 50000, description: 'Amount for Expedia' })
  expedia: number

  @ApiProperty({ example: 60000, description: 'Amount for Booking' })
  booking: number

  @ApiProperty({ example: 40000, description: 'Amount for Agoda' })
  agoda: number
}

export class GlobalStatsResponseDto {
  @ApiProperty({ description: 'Amount collectable breakdown by platform' })
  amount_collectable: GlobalStatsAmountDto

  @ApiProperty({ description: 'Amount confirmed breakdown by platform' })
  amount_confirmed: GlobalStatsAmountDto

  @ApiProperty({
    example: 50,
    description: 'Total number of audits across all accessible properties'
  })
  total_audit_count: number
}

export class BulkUploadReportDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of audit IDs to update'
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  audit_ids: string[]

  @ApiProperty({
    example: 'https://example.com/report.pdf',
    description: 'Report URL to set for all audits'
  })
  @IsString()
  @IsNotEmpty()
  report_url: string
}

export class DeleteAuditDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class BulkDeleteAuditDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of audit IDs to delete'
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  audit_ids: string[]

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'Super admin password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class RequestUpdateAmountConfirmedDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  // At least one OTA amount confirmed must be provided
  @ApiPropertyOptional({
    example: 5000.50,
    description: 'New Expedia amount confirmed value'
  })
  @IsNumber()
  @IsOptional()
  expedia_amount_confirmed?: number

  @ApiPropertyOptional({
    example: 3000.00,
    description: 'New Agoda amount confirmed value'
  })
  @IsNumber()
  @IsOptional()
  agoda_amount_confirmed?: number

  @ApiPropertyOptional({
    example: 2000.00,
    description: 'New Booking amount confirmed value'
  })
  @IsNumber()
  @IsOptional()
  booking_amount_confirmed?: number

  @ApiPropertyOptional({
    description: 'Optional reason for the change request'
  })
  @IsString()
  @IsOptional()
  reason?: string
}

export class UpdateReportUrlDto {
  @ApiProperty({
    example: 'https://example.com/report.pdf',
    description: 'Report URL to update'
  })
  @IsString()
  @IsNotEmpty()
  report_url: string
}

export class AutoImportAuditErrorDto {
  @ApiProperty({ example: 2, description: 'Sheet row number (header = row 1)' })
  row: number

  @ApiProperty({ example: 'Hilton Garden Inn', description: 'Property / hotel name from sheet' })
  property: string

  @ApiProperty({
    example: 'expedia',
    description: 'OTA column value from the sheet row',
    required: false
  })
  ota?: string

  @ApiProperty({
    example: '12345',
    description: 'Hotel ID column value from the sheet row',
    required: false
  })
  hotel_id?: string

  @ApiProperty({ example: 'Portfolio "ARP Hospitality" not found in database', description: 'Error description' })
  error: string
}

export class AutoImportAuditSuccessDto {
  @ApiProperty({ example: 'Hilton Garden Inn', description: 'Property name' })
  property: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Created audit ID' })
  audit_id: string

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/auto-imports/Hilton_Garden_Inn_1234567890.xlsx', description: 'S3 URL of uploaded report sheet' })
  report_url: string
}

export class AutoImportAuditResultDto {
  @ApiProperty({ example: true, description: 'Whether import succeeded (false means validation errors were found)' })
  success: boolean

  @ApiProperty({
    type: [AutoImportAuditErrorDto],
    description: 'Validation errors found before any audit was created. Present when success=false.',
    required: false
  })
  errors?: AutoImportAuditErrorDto[]

  @ApiProperty({
    type: [AutoImportAuditSuccessDto],
    description: 'Successfully created audits with their report URLs. Present when success=true.',
    required: false
  })
  created_audits?: AutoImportAuditSuccessDto[]
}
