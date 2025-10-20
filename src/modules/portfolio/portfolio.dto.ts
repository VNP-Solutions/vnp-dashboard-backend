import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreatePortfolioDto {
  @ApiProperty({
    example: 'Luxury Hotels Portfolio',
    description: 'Portfolio name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Service type ID'
  })
  @IsString()
  @IsNotEmpty()
  service_type_id: string

  @ApiProperty({ example: true, description: 'Whether contract is signed' })
  @IsBoolean()
  @IsNotEmpty()
  is_contract_signed: boolean

  @ApiPropertyOptional({
    example: 'https://example.com/contract.pdf',
    description: 'Contract document URL'
  })
  @IsString()
  @IsOptional()
  contract_url?: string

  @ApiProperty({ example: true, description: 'Whether portfolio is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean

  @ApiPropertyOptional({
    example: 'contact@example.com',
    description: 'Contact email for portfolio'
  })
  @IsString()
  @IsEmail()
  @IsOptional()
  contact_email?: string

  @ApiProperty({
    example: true,
    description: 'Whether portfolio is commissionable'
  })
  @IsBoolean()
  @IsNotEmpty()
  is_commissionable: boolean
}

export class UpdatePortfolioDto extends PartialType(CreatePortfolioDto) {}

export class PortfolioQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by service type ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  service_type_id?: string

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false/All)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_active?: string

  @ApiPropertyOptional({
    description: 'Filter by contract signed status (true/false/All)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_contract_signed?: string
}

export class SendPortfolioEmailDto {
  @ApiProperty({
    example: 'Quarterly Review Meeting',
    description: 'Email subject'
  })
  @IsString()
  @IsNotEmpty()
  subject: string

  @ApiProperty({
    example:
      'Dear Team,\n\nWe would like to schedule a quarterly review meeting...',
    description: 'Email body (plain text)'
  })
  @IsString()
  @IsNotEmpty()
  body: string
}

export class BulkImportResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of portfolios successfully imported'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      { row: 3, portfolio: 'Test Portfolio', error: 'Portfolio already exists' }
    ],
    description: 'List of errors encountered during import'
  })
  errors: Array<{
    row: number
    portfolio: string
    error: string
  }>

  @ApiProperty({
    example: ['Portfolio A', 'Portfolio B'],
    description: 'List of successfully imported portfolio names'
  })
  successfulImports: string[]
}

export class PortfolioStatsQueryDto {
  @ApiProperty({
    enum: ['week', 'month', 'year'],
    example: 'month',
    description: 'Time duration for stats calculation'
  })
  @IsString()
  @IsNotEmpty()
  duration: 'week' | 'month' | 'year'
}

export class PortfolioStatsAmountDto {
  @ApiProperty({ example: 150000, description: 'Total amount' })
  total: number

  @ApiProperty({ example: 50000, description: 'Amount for Expedia' })
  expedia: number

  @ApiProperty({ example: 60000, description: 'Amount for Booking' })
  booking: number

  @ApiProperty({ example: 40000, description: 'Amount for Agoda' })
  agoda: number
}

export class PortfolioStatsAuditDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Audit ID' })
  id: string

  @ApiProperty({ example: 'expedia', description: 'OTA type' })
  type_of_ota: string | null

  @ApiProperty({ example: 25000, description: 'Amount collectable' })
  amount_collectable: number | null

  @ApiProperty({ example: 20000, description: 'Amount confirmed' })
  amount_confirmed: number | null

  @ApiProperty({ example: '2024-01-01', description: 'Start date' })
  start_date: Date

  @ApiProperty({ example: '2024-01-31', description: 'End date' })
  end_date: Date

  @ApiProperty({ example: 'Hotel ABC', description: 'Property name' })
  property_name: string

  @ApiProperty({ example: 'Confirmed', description: 'Audit status' })
  audit_status: string
}

export class PortfolioStatsResponseDto {
  @ApiProperty({ description: 'Amount collectable breakdown by platform' })
  amount_collectable: PortfolioStatsAmountDto

  @ApiProperty({ description: 'Amount confirmed breakdown by platform' })
  amount_confirmed: PortfolioStatsAmountDto

  @ApiProperty({
    example: 15,
    description: 'Count of completed audits within the specified duration'
  })
  completed_audit_count: number

  @ApiProperty({
    type: [PortfolioStatsAuditDto],
    description: 'Recent 10 audits for the portfolio'
  })
  recent_audits: PortfolioStatsAuditDto[]
}
