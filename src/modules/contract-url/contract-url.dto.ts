import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateContractUrlDto {
  @ApiProperty({
    example: 'https://example.com/contracts/portfolio-contract.pdf',
    description: 'Contract document URL'
  })
  @IsUrl()
  @IsNotEmpty()
  url: string

  @ApiPropertyOptional({
    example: 'Master Service Agreement 2024',
    description: 'Description of the contract'
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiProperty({ example: true, description: 'Whether contract URL is active' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class UpdateContractUrlDto extends PartialType(CreateContractUrlDto) {
  @ApiPropertyOptional({
    example: 'https://example.com/contracts/updated-contract.pdf',
    description: 'Contract document URL'
  })
  @IsUrl()
  @IsOptional()
  url?: string

  @ApiPropertyOptional({
    example: 'Updated contract description',
    description: 'Description of the contract'
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Whether contract URL is active'
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class ContractUrlQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439011'
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
}
