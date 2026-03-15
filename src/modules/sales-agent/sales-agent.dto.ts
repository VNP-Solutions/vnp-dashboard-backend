import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateSalesAgentDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the sales agent' })
  @IsString()
  @IsNotEmpty()
  full_name: string

  @ApiProperty({ example: '123 Main St, New York, NY 10001', description: 'Address of the sales agent' })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiProperty({ example: '+1234567890', description: 'Phone number of the sales agent' })
  @IsString()
  @IsNotEmpty()
  phone: string

  @ApiProperty({ example: 'john.doe@example.com', description: 'Email address of the sales agent' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: 5.5, description: 'Commission percentage for the sales agent' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  commission: number

  @ApiPropertyOptional({
    example: ['https://s3.amazonaws.com/docs/contract.pdf'],
    description: 'List of document URLs for the sales agent',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  documents?: string[]
}

export class UpdateSalesAgentDto extends PartialType(CreateSalesAgentDto) {}

export class SalesAgentQueryDto extends QueryDto {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Filter sales agents assigned to a specific portfolio'
  })
  @IsString()
  @IsOptional()
  portfolio_id?: string

  @ApiPropertyOptional({
    example: 'John',
    description: 'Search by full name, email, or phone (case-insensitive)'
  })
  @IsString()
  @IsOptional()
  declare search?: string

  @ApiPropertyOptional({
    example: 'created_at',
    description: 'Field to sort by',
    enum: ['full_name', 'commission', 'created_at']
  })
  @IsString()
  @IsOptional()
  declare sortBy?: string

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort direction',
    enum: ['asc', 'desc']
  })
  @IsString()
  @IsOptional()
  declare sortOrder?: 'asc' | 'desc'
}

export class SalesAgentReportQueryDto {
  @ApiProperty({
    example: '2024-01-01',
    description: 'Start of date range (ISO date string) — filters audits whose start_date >= from'
  })
  @IsDateString()
  @IsNotEmpty()
  from: string

  @ApiProperty({
    example: '2024-12-31',
    description: 'End of date range (ISO date string) — filters audits whose end_date <= to'
  })
  @IsDateString()
  @IsNotEmpty()
  to: string

  @ApiPropertyOptional({
    example: 'xlsx',
    description: 'Export format: ?format=xlsx or ?format=csv (default: xlsx)',
    enum: ['csv', 'xlsx']
  })
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx' = 'xlsx'
}
