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
