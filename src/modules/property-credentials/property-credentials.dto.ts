import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class OtaCredentialsDto {
  @ApiPropertyOptional({
    example: 'EXP123456',
    description: 'OTA ID'
  })
  @IsString()
  @IsOptional()
  id?: string

  @ApiPropertyOptional({
    example: 'hotel_user@example.com',
    description: 'OTA username'
  })
  @IsString()
  @IsOptional()
  username?: string

  @ApiPropertyOptional({
    example: 'SecurePassword123!',
    description: 'OTA password (will be encrypted)'
  })
  @IsString()
  @IsOptional()
  password?: string
}

export class CreatePropertyCredentialsDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiPropertyOptional({
    description: 'Expedia credentials',
    type: OtaCredentialsDto
  })
  @IsOptional()
  expedia?: OtaCredentialsDto

  @ApiPropertyOptional({
    description: 'Agoda credentials',
    type: OtaCredentialsDto
  })
  @IsOptional()
  agoda?: OtaCredentialsDto

  @ApiPropertyOptional({
    description: 'Booking.com credentials',
    type: OtaCredentialsDto
  })
  @IsOptional()
  booking?: OtaCredentialsDto
}

export class UpdatePropertyCredentialsDto extends PartialType(
  CreatePropertyCredentialsDto
) {}

export class PropertyCredentialsQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by property ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  property_id?: string
}

export class PropertyCredentialsResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  property_id: string

  @ApiPropertyOptional()
  expedia?: OtaCredentialsDto

  @ApiPropertyOptional()
  agoda?: OtaCredentialsDto

  @ApiPropertyOptional()
  booking?: OtaCredentialsDto

  @ApiProperty()
  created_at: Date

  @ApiProperty()
  updated_at: Date
}
