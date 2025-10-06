import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateUserDto {
  @ApiProperty({
    example: 'newuser@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'User role ID'
  })
  @IsString()
  @IsNotEmpty()
  role_id: string

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  first_name: string

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  last_name: string

  @ApiProperty({ example: 'en', description: 'Preferred language code' })
  @IsString()
  @IsNotEmpty()
  language: string

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439011'],
    description: 'Array of portfolio IDs user can access'
  })
  @IsArray()
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439012'],
    description: 'Array of property IDs user can access'
  })
  @IsArray()
  @IsOptional()
  property_ids?: string[]
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'User display image URL'
  })
  @IsString()
  @IsOptional()
  display_image?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact phone number'
  })
  @IsString()
  @IsOptional()
  contact_number?: string
}

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsString()
  @IsOptional()
  first_name?: string

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsOptional()
  last_name?: string

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code'
  })
  @IsString()
  @IsOptional()
  language?: string

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'User display image URL'
  })
  @IsString()
  @IsOptional()
  display_image?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact phone number'
  })
  @IsString()
  @IsOptional()
  contact_number?: string
}

export class UpdateUserRoleDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'New user role ID'
  })
  @IsString()
  @IsNotEmpty()
  role_id: string
}

export class UserQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user role ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  user_role_id?: string

  @ApiPropertyOptional({
    description: 'Filter by verified status (true/false/All)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_verified?: string
}
