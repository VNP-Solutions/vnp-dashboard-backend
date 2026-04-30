import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { BankSubType } from '@prisma/client'
import { RejectNumericBankIdentifier } from '../../common/decorators/bank-identifier.decorator'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length
} from 'class-validator'

export class CreatePropertyBankDetailsDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiProperty({
    enum: ['bank', 'stripe', 'none'],
    example: 'bank',
    description:
      'Type of bank account (bank, stripe, or none). Use "none" to remove existing bank details. Note: This will be automatically determined based on whether stripe_account_email is provided.',
    default: 'bank'
  })
  @IsString()
  @IsNotEmpty()
  bank_type: string

  @ApiPropertyOptional({
    enum: BankSubType,
    example: BankSubType.ach,
    description:
      'Bank sub-type when bank_type is "bank". Options: ach (ACH), domestic_wire (Domestic US Wire), international_wire (International Wire). Required when bank_type is "bank".'
  })
  @IsEnum(BankSubType)
  @IsOptional()
  bank_sub_type?: BankSubType

  @ApiPropertyOptional({
    example: 'Grand Hotel',
    description: 'Hotel or Portfolio name. Required for all bank sub-types.'
  })
  @IsString()
  @IsOptional()
  hotel_portfolio_name?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description:
      'Beneficiary name. Required for ACH, Domestic US Wire and International Wire.'
  })
  @IsString()
  @IsOptional()
  beneficiary_name?: string

  @ApiPropertyOptional({
    example: '123 Main Street, New York, NY 10001',
    description:
      'Beneficiary address. Optional for all bank sub-types (previously required for Domestic Wire and International Wire).'
  })
  @IsString()
  @IsOptional()
  beneficiary_address?: string

  @ApiPropertyOptional({
    example: '1234567890',
    description:
      'Bank account number. Required for all bank sub-types. Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  account_number?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Account holder name. Optional field.'
  })
  @IsString()
  @IsOptional()
  account_name?: string

  @ApiPropertyOptional({
    example: 'Chase Bank',
    description: 'Name of the bank. Required for all bank sub-types.'
  })
  @IsString()
  @IsOptional()
  bank_name?: string

  @ApiPropertyOptional({
    example: 'New York Branch',
    description: 'Bank branch name or location. Optional field.'
  })
  @IsString()
  @IsOptional()
  bank_branch?: string

  @ApiPropertyOptional({
    example: 'GB29NWBK60161331926819',
    description:
      'IBAN or Account Number. Required for International Wire. Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  iban_number?: string

  @ApiPropertyOptional({
    example: 'CHASUS33XXX',
    description:
      'SWIFT/BIC Code. Required for International Wire. Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  swift_bic_number?: string

  @ApiPropertyOptional({
    example: '021000021',
    description:
      'Routing number (9 digits). Required for ACH and Domestic US Wire. Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros. Stored exactly as submitted; the server does not pad or rewrite digits.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  @Length(9, 9, { message: 'Routing number must be 9 digits' })
  routing_number?: string

  @ApiPropertyOptional({
    example: '121000248',
    description:
      'Bank wiring routing number for wire transfers. Optional field, only applicable for Domestic Wire transfers. Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros. Stored exactly as submitted; the server does not pad or rewrite digits.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  bank_wiring_routing_number?: string

  @ApiPropertyOptional({
    example: 'checking',
    description:
      'Bank account type (free-form string, e.g. checking, savings). Required for ACH; use empty or omit for other sub-types when not applicable.'
  })
  @IsString()
  @IsOptional()
  bank_account_type?: string

  @ApiPropertyOptional({
    example: 'USD',
    description:
      'Currency code (e.g., USD, EUR, GBP). Optional for all bank sub-types (previously required for International Wire).'
  })
  @IsString()
  @IsOptional()
  currency?: string

  @ApiPropertyOptional({
    example: 'stripe@example.com',
    description:
      'Stripe account email. If provided, bank_type will be automatically set to stripe and all bank fields will be ignored. This is the only required field for stripe accounts.'
  })
  @IsString()
  @IsOptional()
  stripe_account_email?: string

  @ApiPropertyOptional({
    example: 'John Smith',
    description:
      'Contact person name for bank account inquiries. Optional field.'
  })
  @IsString()
  @IsOptional()
  contact_name?: string

  @ApiPropertyOptional({
    example: 'john.smith@example.com',
    description:
      'Contact email address for bank account inquiries. Optional field.'
  })
  @IsString()
  @IsOptional()
  email_address?: string

  @ApiPropertyOptional({
    example: '123 Bank Street, New York, NY 10001',
    description:
      'Bank physical address. Optional field, typically used for International Wire transfers.'
  })
  @IsString()
  @IsOptional()
  bank_address?: string

  @ApiPropertyOptional({
    example: 'Additional notes or comments about the bank account',
    description:
      'Comments or notes about the bank account details. Optional field.'
  })
  @IsString()
  @IsOptional()
  comments?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description:
      'Associated user ID for VNP tracking. This will be automatically set to the current user ID.'
  })
  @IsString()
  @IsOptional()
  associated_user_id?: string
}

export class UpdatePropertyBankDetailsDto extends PartialType(
  CreatePropertyBankDetailsDto
) {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsOptional()
  property_id?: string
}

export class BulkUpdateBankDetailsResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed across all sheets' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of bank details successfully updated/created'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      { row: 3, sheet: 'ACH', property: 'EXP123456', error: 'Property not found for this Expedia ID' },
      { row: 5, sheet: 'Domestic Wire', property: 'EXP789012', error: 'Missing required fields for domestic_wire: Routing Number' }
    ],
    description: 'List of errors encountered during bulk update. Property field contains Expedia ID. Sheet field indicates which tab the error came from (for multi-tab files).'
  })
  errors: Array<{
    row: number
    sheet?: string
    property: string
    error: string
  }>

  @ApiProperty({
    example: ['EXP123456', 'EXP234567', 'EXP345678'],
    description: 'List of successfully updated Expedia IDs'
  })
  successfulUpdates: string[]

  @ApiPropertyOptional({
    example: [
      { sheet: 'ACH', subType: 'ach', totalRows: 5, successCount: 4, failureCount: 1 },
      { sheet: 'Domestic Wire', subType: 'domestic_wire', totalRows: 3, successCount: 3, failureCount: 0 }
    ],
    description: 'Per-sheet breakdown of results (present when file has multiple tabs)'
  })
  sheetResults?: Array<{
    sheet: string
    subType: string
    totalRows: number
    successCount: number
    failureCount: number
  }>
}
