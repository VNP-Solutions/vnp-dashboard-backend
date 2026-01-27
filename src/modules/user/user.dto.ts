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

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'newuser@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsOptional()
  email?: string

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

export class AssignUserRoleDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'New user role ID'
  })
  @IsString()
  @IsNotEmpty()
  role_id: string

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439011'],
    description:
      'Array of portfolio IDs user can access (required when new role has partial portfolio access)'
  })
  @IsArray()
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439012'],
    description:
      'Array of property IDs user can access (required when new role has partial property access)'
  })
  @IsArray()
  @IsOptional()
  property_ids?: string[]
}

export class ManageUserAccessDto {
  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of portfolio IDs to add/revoke'
  })
  @IsArray()
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    description: 'Array of property IDs to add/revoke'
  })
  @IsArray()
  @IsOptional()
  property_ids?: string[]
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

export class DeleteUserDto {
  @ApiProperty({
    example: 'Password@123',
    description: 'Current user password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class UserProfileResponseDto {
  @ApiProperty({
    example: {
      id: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: {
        id: '507f1f77bcf86cd799439012',
        name: 'Admin',
        description: 'Administrator role with full access',
        is_external: false,
        can_access_mis: true,
        portfolio_permission: { permission_level: 'all', access_level: 'all' },
        property_permission: { permission_level: 'all', access_level: 'all' },
        audit_permission: { permission_level: 'all', access_level: 'all' },
        user_permission: { permission_level: 'all', access_level: 'all' },
        system_settings_permission: {
          permission_level: 'all',
          access_level: 'all'
        }
      }
    },
    description: 'User information'
  })
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    role: {
      id: string
      name: string
      description: string
      is_external: boolean
      can_access_mis: boolean
      portfolio_permission: any
      property_permission: any
      audit_permission: any
      user_permission: any
      system_settings_permission: any
    }
  }
}
