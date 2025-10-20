import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

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

  @ApiProperty({
    example: 'GRAND HOTEL NY',
    description: 'Card descriptor for payment processing'
  })
  @IsString()
  @IsNotEmpty()
  card_descriptor: string

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
    example: '507f1f77bcf86cd799439013',
    description: 'Property Batch ID (optional)'
  })
  @IsString()
  @IsOptional()
  batch_id?: string

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
}

export class PropertyQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by batch ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439013'
  })
  @IsOptional()
  @IsString()
  batch_id?: string

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
}
