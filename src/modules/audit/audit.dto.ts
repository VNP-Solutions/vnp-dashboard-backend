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
    example: OtaType.expedia,
    description: 'Type of OTA (expedia, agoda, booking)'
  })
  @IsEnum(OtaType)
  @IsOptional()
  type_of_ota?: OtaType

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Audit status ID'
  })
  @IsString()
  @IsNotEmpty()
  audit_status_id: string

  @ApiPropertyOptional({
    example: 5000,
    description: 'Amount collectable'
  })
  @IsNumber()
  @IsOptional()
  amount_collectable?: number

  @ApiPropertyOptional({
    example: 4500,
    description: 'Amount confirmed'
  })
  @IsNumber()
  @IsOptional()
  amount_confirmed?: number

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: 'Audit start date'
  })
  @IsDateString()
  @IsNotEmpty()
  start_date: string

  @ApiProperty({
    example: '2024-01-31T23:59:59Z',
    description: 'Audit end date'
  })
  @IsDateString()
  @IsNotEmpty()
  end_date: string

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
    description: 'Filter by OTA type (expedia, agoda, booking)',
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
      'Filter by status category (pending/upcoming/in_progress/completed). Multiple values can be provided as comma-separated string, e.g., "pending,upcoming"',
    example: 'completed'
  })
  @IsOptional()
  @IsString()
  status?: string
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
    example: 25,
    description: 'Count of completed audits across all accessible properties'
  })
  completed_audit_count: number
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
