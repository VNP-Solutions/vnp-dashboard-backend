import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

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
  @IsNotEmpty()
  is_active: boolean

  @ApiProperty({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Next due date for payment or audit'
  })
  @IsDateString()
  @IsNotEmpty()
  next_due_date: string

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
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

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
