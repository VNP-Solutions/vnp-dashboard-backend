import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'
import { ExpediaCredentialsDto, OtaCredentialsDto } from '../property-credentials/property-credentials.dto'

export type AccessType = 'owned' | 'shared'

export class CreatePropertyDto {
  @ApiProperty({
    example: 'Grand Hotel',
    description: 'Property name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: '123 Main Street, New York, NY 10001',
    description: 'Property address'
  })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Currency ID'
  })
  @IsString()
  @IsNotEmpty()
  currency_id: string

  @ApiPropertyOptional({
    example: 'GRAND HOTEL NY',
    description: 'Card descriptor for payment processing (optional)'
  })
  @IsString()
  @IsOptional()
  card_descriptor?: string

  @ApiProperty({
    example: true,
    description: 'Whether property is active'
  })
  @IsBoolean()
  @IsOptional()
  is_active: boolean

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Next due date for payment or audit (optional)'
  })
  @IsDateString()
  @IsOptional()
  next_due_date?: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'Portfolio ID'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
    description:
      'Array of Portfolio IDs where this property should be visible (optional)',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  show_in_portfolio?: string[]
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class TransferPropertyDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'New Portfolio ID to transfer the property to'
  })
  @IsString()
  @IsNotEmpty()
  new_portfolio_id: string

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class BulkTransferPropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of Property IDs to transfer',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  property_ids: string[]

  @ApiProperty({
    example: '507f1f77bcf86cd799439013',
    description: 'Target Portfolio ID to transfer all properties to'
  })
  @IsString()
  @IsNotEmpty()
  new_portfolio_id: string

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class PropertyQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by bank type (bank/stripe/All)',
    example: 'bank'
  })
  @IsOptional()
  @IsString()
  bank_type?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false/All)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_active?: string

  @ApiPropertyOptional({
    description: 'Filter by access level (full/expedia/booking/agoda/All)',
    example: 'full'
  })
  @IsOptional()
  @IsString()
  access_level?: string
}

export class SharePropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
    description: 'Array of Portfolio IDs to share this property with',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  portfolio_ids: string[]
}

export class UnsharePropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
    description: 'Array of Portfolio IDs to remove access from',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  portfolio_ids: string[]
}

export class BulkImportResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of properties successfully imported'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      { row: 3, property: 'Test Property', error: 'Property already exists' }
    ],
    description: 'List of errors encountered during import'
  })
  errors: Array<{
    row: number
    property: string
    error: string
  }>

  @ApiProperty({
    example: ['Property A', 'Property B'],
    description: 'List of successfully imported property names'
  })
  successfulImports: string[]
}

export class PropertyStatsResponseDto {
  @ApiProperty({
    example: 50000,
    description: 'Total amount collectable from all audits for this property'
  })
  total_amount_collectable: number

  @ApiProperty({
    example: 45000,
    description: 'Total amount confirmed from all audits for this property'
  })
  total_amount_confirmed: number

  @ApiProperty({
    description: 'Property details including credentials and currency'
  })
  property: {
    id: string
    name: string
    address: string
    card_descriptor: string | null
    is_active: boolean
    next_due_date: Date | null
    portfolio_id: string
    currency_id: string
    currency: {
      id: string
      code: string
      name: string
      symbol: string | null
    }
    credentials: {
      expedia_id: string | null
      agoda_id: string | null
      booking_id: string | null
    } | null
  }
}

export class GetPropertiesByPortfoliosDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
    description:
      'Array of Portfolio IDs to get properties from. If empty array is provided, returns all properties accessible to the user.',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  portfolio_ids: string[]
}

export class DeletePropertyDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class DeactivatePropertyDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class CompletePropertyCredentialsDto {
  @ApiProperty({
    description: 'Expedia credentials (required)',
    type: ExpediaCredentialsDto
  })
  @ValidateNested()
  @Type(() => ExpediaCredentialsDto)
  @IsNotEmpty()
  expedia: ExpediaCredentialsDto

  @ApiPropertyOptional({
    description: 'Agoda credentials (optional)',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  agoda?: OtaCredentialsDto

  @ApiPropertyOptional({
    description: 'Booking.com credentials (optional)',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  booking?: OtaCredentialsDto
}

export class CompleteBankDetailsDto {
  @ApiProperty({
    enum: ['bank', 'stripe'],
    example: 'bank',
    description: 'Type of bank account (bank or stripe)',
    default: 'bank'
  })
  @IsString()
  @IsNotEmpty()
  bank_type: string

  @ApiPropertyOptional({
    enum: ['ach', 'domestic_wire', 'international_wire'],
    example: 'ach',
    description: 'Bank sub-type when bank_type is "bank"'
  })
  @IsString()
  @IsOptional()
  bank_sub_type?: string

  @ApiPropertyOptional({
    example: 'Grand Hotel',
    description: 'Hotel or Portfolio name'
  })
  @IsString()
  @IsOptional()
  hotel_portfolio_name?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Beneficiary name'
  })
  @IsString()
  @IsOptional()
  beneficiary_name?: string

  @ApiPropertyOptional({
    example: '123 Main Street, New York, NY 10001',
    description: 'Beneficiary address'
  })
  @IsString()
  @IsOptional()
  beneficiary_address?: string

  @ApiPropertyOptional({
    example: '1234567890',
    description: 'Bank account number'
  })
  @IsString()
  @IsOptional()
  account_number?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Account holder name'
  })
  @IsString()
  @IsOptional()
  account_name?: string

  @ApiPropertyOptional({
    example: 'Chase Bank',
    description: 'Name of the bank'
  })
  @IsString()
  @IsOptional()
  bank_name?: string

  @ApiPropertyOptional({
    example: 'New York Branch',
    description: 'Bank branch name or location'
  })
  @IsString()
  @IsOptional()
  bank_branch?: string

  @ApiPropertyOptional({
    example: 'CHASUS33XXX',
    description: 'SWIFT or BIC or IBAN code'
  })
  @IsString()
  @IsOptional()
  swift_bic_iban?: string

  @ApiPropertyOptional({
    example: '021000021',
    description: 'Routing number (minimum 9 digits)'
  })
  @IsString()
  @IsOptional()
  routing_number?: string

  @ApiPropertyOptional({
    enum: ['checking', 'savings'],
    example: 'checking',
    description: 'Bank account type'
  })
  @IsString()
  @IsOptional()
  bank_account_type?: string

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency code'
  })
  @IsString()
  @IsOptional()
  currency?: string

  @ApiPropertyOptional({
    example: 'stripe@example.com',
    description: 'Stripe account email'
  })
  @IsString()
  @IsOptional()
  stripe_account_email?: string
}

export class CompleteCreatePropertyDto {
  @ApiProperty({
    description: 'Property data',
    type: CreatePropertyDto
  })
  @ValidateNested()
  @Type(() => CreatePropertyDto)
  @IsNotEmpty()
  property: CreatePropertyDto

  @ApiPropertyOptional({
    description: 'Property credentials (optional)',
    type: CompletePropertyCredentialsDto
  })
  @ValidateNested()
  @Type(() => CompletePropertyCredentialsDto)
  @IsOptional()
  credentials?: CompletePropertyCredentialsDto

  @ApiPropertyOptional({
    description: 'Property bank details (optional)',
    type: CompleteBankDetailsDto
  })
  @ValidateNested()
  @Type(() => CompleteBankDetailsDto)
  @IsOptional()
  bank_details?: CompleteBankDetailsDto
}
