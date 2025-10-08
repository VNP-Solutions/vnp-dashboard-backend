import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { BankType } from '@prisma/client'
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
    description: 'Type of bank account (bank or stripe)',
    default: BankType.bank
  })
  @IsEnum(BankType)
  @IsNotEmpty()
  bank_type: BankType

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
    description: 'SWIFT/BIC code'
  })
  @IsString()
  @IsOptional()
  swift_code?: string

  @ApiPropertyOptional({
    example: '021000021',
    description: 'Routing number (US banks)'
  })
  @IsString()
  @IsOptional()
  routing_number?: string

  @ApiPropertyOptional({
    example: 'stripe@example.com',
    description: 'Stripe account email (for Stripe accounts)'
  })
  @IsString()
  @IsOptional()
  stripe_account_email?: string
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
