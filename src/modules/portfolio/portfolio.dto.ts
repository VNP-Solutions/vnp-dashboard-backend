import { OmitType, PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'
import { IsCommaSeparatedEmails } from '../../common/validators/comma-separated-emails.validator'
import { AttachmentUrlDto } from '../email/email.dto'

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

  @ApiPropertyOptional({
    example: 'USD',
    description:
      'Currency code for the portfolio (defaults to USD if not provided)'
  })
  @IsString()
  @IsOptional()
  currency?: string

  @ApiPropertyOptional({
    example: 'https://example.com/contract.pdf',
    description:
      'Contract document URL (will be saved as user-specific contract URL)'
  })
  @IsString()
  @IsOptional()
  contract_url?: string

  @ApiProperty({ example: true, description: 'Whether portfolio is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean

  @ApiPropertyOptional({
    example: 'contact@example.com, contact2@example.com',
    description:
      'Contact email(s) for portfolio - can be a single email or comma-separated emails for multiple recipients'
  })
  @IsString()
  @IsCommaSeparatedEmails()
  @IsOptional()
  contact_email?: string

  @ApiProperty({
    example: true,
    description: 'Whether portfolio is commissionable'
  })
  @IsBoolean()
  @IsNotEmpty()
  is_commissionable: boolean

  @ApiPropertyOptional({
    example: 'access@example.com',
    description: 'Access email for portfolio'
  })
  @IsString()
  @IsEmail()
  @IsOptional()
  access_email?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Access phone number for portfolio'
  })
  @IsString()
  @IsOptional()
  access_phone?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Sales agent ID to assign to this portfolio'
  })
  @IsString()
  @IsOptional()
  sales_agent_id?: string
}

// Exclude is_active from UpdatePortfolioDto - use dedicated deactivate API instead
export class UpdatePortfolioDto extends PartialType(
  OmitType(CreatePortfolioDto, ['is_active'] as const)
) {}

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
    description: 'Filter by bank type (bank/stripe/All)',
    example: 'bank'
  })
  @IsOptional()
  @IsString()
  bank_type?: string

  @ApiPropertyOptional({
    description:
      'Filter by bank sub type (ach/domestic_wire/international_wire/all)',
    example: 'ach'
  })
  @IsOptional()
  @IsString()
  bank_sub_type?: string

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false/All)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_active?: string
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

  @ApiPropertyOptional({
    type: [AttachmentUrlDto],
    example: [
      {
        url: 'https://s3.amazonaws.com/bucket/report.pdf',
        filename: 'quarterly-report.pdf'
      }
    ],
    description: 'Optional array of file URLs to attach to the email'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentUrlDto)
  @IsOptional()
  attachment_urls?: AttachmentUrlDto[]
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

export class BulkUpdateResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of portfolios successfully updated'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      {
        row: 3,
        portfolioId: '507f1f77bcf86cd799439011',
        error: 'Portfolio not found'
      }
    ],
    description: 'List of errors encountered during update'
  })
  errors: Array<{
    row: number
    portfolioId: string
    error: string
  }>

  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'List of successfully updated portfolio IDs'
  })
  successfulUpdates: string[]
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

  @ApiProperty({
    example: ['expedia', 'agoda'],
    description: 'OTA types array',
    isArray: true,
    type: [String]
  })
  type_of_ota: string[]

  @ApiPropertyOptional({ example: 10000, description: 'Expedia amount collectable' })
  expedia_amount_collectable: number | null

  @ApiPropertyOptional({ example: 8000, description: 'Expedia amount confirmed' })
  expedia_amount_confirmed: number | null

  @ApiPropertyOptional({ example: 8000, description: 'Agoda amount collectable' })
  agoda_amount_collectable: number | null

  @ApiPropertyOptional({ example: 7000, description: 'Agoda amount confirmed' })
  agoda_amount_confirmed: number | null

  @ApiPropertyOptional({ example: 7000, description: 'Booking amount collectable' })
  booking_amount_collectable: number | null

  @ApiPropertyOptional({ example: 5000, description: 'Booking amount confirmed' })
  booking_amount_confirmed: number | null

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
    example: 25,
    description: 'Total number of audits for the portfolio'
  })
  total_audit_count: number

  @ApiProperty({
    type: [PortfolioStatsAuditDto],
    description: 'Recent 10 audits for the portfolio'
  })
  recent_audits: PortfolioStatsAuditDto[]
}

export class DeletePortfolioDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description:
      'User password for verification (required for super admin to delete portfolio)'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class SecurePortfolioDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'User password for verification to access full bank details'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class GetPortfoliosByIdsSecureDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of Portfolio IDs to retrieve with full bank details',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  portfolio_ids: string[]

  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'Current user password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class SecurePortfolioListDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'User password for verification to access full bank details'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class BulkDeletePortfolioDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of Portfolio IDs to delete',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  portfolio_ids: string[]

  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description:
      'User password for verification (required for super admin to bulk delete portfolios)'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class DeactivatePortfolioDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description:
      'User password for verification (required for super admin and internal users to deactivate portfolio)'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({
    example: 'Portfolio being consolidated with another portfolio',
    description:
      'Reason for deactivating the portfolio (required for internal users, optional for super admin)'
  })
  @IsString()
  @IsOptional()
  reason?: string
}

export class ActivatePortfolioDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description:
      'User password for verification (required for super admin and internal users to activate portfolio)'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({
    example: 'Portfolio is ready for operations again',
    description:
      'Reason for activating the portfolio (required for internal users, optional for super admin)'
  })
  @IsString()
  @IsOptional()
  reason?: string
}
