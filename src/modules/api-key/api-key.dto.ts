import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateApiKeyDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID the API key will be bound to'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the API key is active (defaults to true)',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class ApiKeyPortfolioDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID'
  })
  id: string

  @ApiProperty({
    example: 'Drury Hotels',
    description: 'Portfolio name'
  })
  name: string

  @ApiProperty({
    example: true,
    description: 'Whether the portfolio is active'
  })
  is_active: boolean
}

export class ApiKeyResponseDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'API key record ID'
  })
  id: string

  @ApiProperty({
    example: 'vnp_a1b2c3d4e5f6789012345678abcdef90',
    description: 'The API key value (auto-generated on create)'
  })
  api_key: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID the API key is bound to'
  })
  portfolio_id: string

  @ApiProperty({
    type: ApiKeyPortfolioDto,
    description: 'Populated portfolio details'
  })
  portfolio: ApiKeyPortfolioDto

  @ApiProperty({
    example: true,
    description: 'Whether the API key is active'
  })
  is_active: boolean

  @ApiProperty({
    example: '2026-06-08T10:00:00.000Z',
    description: 'Creation timestamp'
  })
  created_at: Date

  @ApiProperty({
    example: '2026-06-08T10:00:00.000Z',
    description: 'Last update timestamp'
  })
  updated_at: Date
}

export class DeleteApiKeyResponseDto {
  @ApiProperty({
    example: 'API key deleted successfully',
    description: 'Success message'
  })
  message: string
}
