import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ValidationArguments,
  registerDecorator,
  ValidationOptions
} from 'class-validator'

// Custom validator to ensure username and password are provided together
function UsernamePasswordTogether(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'usernamePasswordTogether',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(_value: any, args: ValidationArguments) {
          const obj = args.object as any
          const hasUsername = obj.username !== undefined && obj.username !== null && obj.username !== ''
          const hasPassword = obj.password !== undefined && obj.password !== null && obj.password !== ''
          // Both must be present or both must be absent
          return hasUsername === hasPassword
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any
          const hasUsername = obj.username !== undefined && obj.username !== null && obj.username !== ''
          if (hasUsername) {
            return 'Password is required when username is provided'
          }
          return 'Username is required when password is provided'
        }
      }
    })
  }
}

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
    description: 'OTA username (must be provided with password)'
  })
  @IsString()
  @IsOptional()
  @UsernamePasswordTogether({ message: 'Username and password must be provided together' })
  username?: string

  @ApiPropertyOptional({
    example: 'SecurePassword123!',
    description: 'OTA password (will be encrypted, must be provided with username)'
  })
  @IsString()
  @IsOptional()
  password?: string
}

export class ExpediaCredentialsDto {
  @ApiProperty({
    example: 'EXP123456',
    description: 'Expedia ID (required)'
  })
  @IsString()
  @IsNotEmpty()
  id: string

  @ApiPropertyOptional({
    example: 'hotel_user@example.com',
    description: 'Expedia username (optional, but must be provided with password)'
  })
  @IsString()
  @IsOptional()
  @UsernamePasswordTogether({ message: 'Username and password must be provided together' })
  username?: string

  @ApiPropertyOptional({
    example: 'SecurePassword123!',
    description: 'Expedia password (will be encrypted, optional but must be provided with username)'
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

export class BulkUpdateCredentialsDto {
  @ApiPropertyOptional({
    description: 'Expedia credentials to update',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  expedia?: OtaCredentialsDto

  @ApiPropertyOptional({
    description: 'Agoda credentials to update',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  agoda?: OtaCredentialsDto

  @ApiPropertyOptional({
    description: 'Booking.com credentials to update',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  booking?: OtaCredentialsDto
}

export class BulkUpdatePropertyCredentialsDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of property IDs to update'
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  property_ids: string[]

  @ApiProperty({
    description: 'Credentials to apply to all specified properties',
    type: BulkUpdateCredentialsDto
  })
  @ValidateNested()
  @Type(() => BulkUpdateCredentialsDto)
  @IsNotEmpty()
  credentials: BulkUpdateCredentialsDto
}

export class BulkUpdatePropertyCredentialsResponseDto {
  @ApiProperty({ example: 5, description: 'Number of properties successfully updated' })
  updated_count: number

  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'IDs of properties that were updated'
  })
  updated_property_ids: string[]

  @ApiProperty({
    example: 2,
    description: 'Number of properties that were skipped (not found or no credentials)'
  })
  skipped_count: number

  @ApiProperty({
    example: ['507f1f77bcf86cd799439013'],
    description: 'IDs of properties that were skipped'
  })
  skipped_property_ids: string[]
}
