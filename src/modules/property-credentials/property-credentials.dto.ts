import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

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

export class ExpediaCredentialsDto {
  @ApiProperty({
    example: 'EXP123456',
    description: 'Expedia ID'
  })
  @IsString()
  @IsNotEmpty()
  id: string

  @ApiProperty({
    example: 'hotel_user@example.com',
    description: 'Expedia username'
  })
  @IsString()
  @IsNotEmpty()
  username: string

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Expedia password (will be encrypted)'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class CreatePropertyCredentialsDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiProperty({
    description: 'Expedia credentials (required)',
    type: ExpediaCredentialsDto
  })
  @IsNotEmpty()
  expedia: ExpediaCredentialsDto

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

export class PropertyCredentialsResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  property_id: string

  @ApiProperty()
  expedia: ExpediaCredentialsDto

  @ApiPropertyOptional()
  agoda?: OtaCredentialsDto

  @ApiPropertyOptional()
  booking?: OtaCredentialsDto

  @ApiProperty()
  created_at: Date

  @ApiProperty()
  updated_at: Date
}
