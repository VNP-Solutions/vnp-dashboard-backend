import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { BankType, BankSubType, BankAccountType } from '@prisma/client'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreatePropertyBankDetailsDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiProperty({
    enum: BankType,
    example: BankType.bank,
    description:
      'Type of bank account (bank or stripe). Note: This will be automatically determined based on whether stripe_account_email is provided.',
    default: BankType.bank
  })
  @IsEnum(BankType)
  @IsNotEmpty()
  bank_type: BankType

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
    description:
      'Hotel or Portfolio name. Required for all bank sub-types.'
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
      'Beneficiary address. Required for Domestic US Wire and International Wire.'
  })
  @IsString()
  @IsOptional()
  beneficiary_address?: string

  @ApiPropertyOptional({
    example: '1234567890',
    description:
      'Bank account number. Required for all bank sub-types.'
  })
  @IsString()
  @IsOptional()
  account_number?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description:
      'Account holder name. Optional field.'
  })
  @IsString()
  @IsOptional()
  account_name?: string

  @ApiPropertyOptional({
    example: 'Chase Bank',
    description:
      'Name of the bank. Required for all bank sub-types.'
  })
  @IsString()
  @IsOptional()
  bank_name?: string

  @ApiPropertyOptional({
    example: 'New York Branch',
    description:
      'Bank branch name or location. Optional field.'
  })
  @IsString()
  @IsOptional()
  bank_branch?: string

  @ApiPropertyOptional({
    example: 'CHASUS33XXX',
    description:
      'SWIFT or BIC or IBAN code. Required for International Wire.'
  })
  @IsString()
  @IsOptional()
  swift_bic_iban?: string

  @ApiPropertyOptional({
    example: '021000021',
    description:
      'Routing number. Required for ACH and Domestic US Wire.'
  })
  @IsString()
  @IsOptional()
  routing_number?: string

  @ApiPropertyOptional({
    enum: BankAccountType,
    example: BankAccountType.checking,
    description:
      'Bank account type (checking or savings). Required for ACH.'
  })
  @IsEnum(BankAccountType)
  @IsOptional()
  bank_account_type?: BankAccountType

  @ApiPropertyOptional({
    example: 'USD',
    description:
      'Currency code (e.g., USD, EUR, GBP). Required for International Wire.'
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
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of bank details successfully updated'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      { row: 3, property: 'Test Property', error: 'Property not found' }
    ],
    description: 'List of errors encountered during bulk update'
  })
  errors: Array<{
    row: number
    property: string
    error: string
  }>

  @ApiProperty({
    example: ['Property A', 'Property B'],
    description: 'List of successfully updated property names'
  })
  successfulUpdates: string[]
}
