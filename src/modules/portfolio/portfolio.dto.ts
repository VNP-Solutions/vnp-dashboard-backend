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
