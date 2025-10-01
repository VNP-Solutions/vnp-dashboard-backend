import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateCurrencyDto {
  @ApiProperty({
    example: 'USD',
    description: 'Currency code (ISO 4217)'
  })
  @IsString()
  @IsNotEmpty()
  code: string

  @ApiProperty({
    example: 'United States Dollar',
    description: 'Currency name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({
    example: '$',
    description: 'Currency symbol'
  })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiProperty({ example: true, description: 'Whether currency is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateCurrencyDto extends PartialType(CreateCurrencyDto) {}
