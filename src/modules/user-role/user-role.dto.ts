import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import {
  AccessLevel,
  PermissionLevel
} from '../../common/interfaces/permission.interface'

export class PermissionDto {
  @ApiProperty({
    enum: PermissionLevel,
    example: PermissionLevel.all,
    description: 'Permission level'
  })
  @IsEnum(PermissionLevel)
  @IsNotEmpty()
  permission_level: PermissionLevel

  @ApiProperty({
    enum: AccessLevel,
    example: AccessLevel.all,
    description: 'Access level'
  })
  @IsEnum(AccessLevel)
  @IsNotEmpty()
  access_level: AccessLevel
}

export class CreateUserRoleDto {
  @ApiProperty({
    example: 'Super Admin',
    description: 'Role name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: 'Full system access with all permissions',
    description: 'Role description'
  })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({
    example: false,
    description: 'Whether the role is for external users'
  })
  @IsBoolean()
  @IsNotEmpty()
  is_external: boolean

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the role is active',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean

  @ApiPropertyOptional({
    type: PermissionDto,
    description: 'Portfolio permission settings'
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  portfolio_permission?: PermissionDto

  @ApiPropertyOptional({
    type: PermissionDto,
    description: 'Property permission settings'
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  property_permission?: PermissionDto

  @ApiPropertyOptional({
    type: PermissionDto,
    description: 'Audit permission settings'
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  audit_permission?: PermissionDto

  @ApiPropertyOptional({
    type: PermissionDto,
    description: 'User permission settings'
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  user_permission?: PermissionDto

  @ApiPropertyOptional({
    type: PermissionDto,
    description: 'System settings permission settings'
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  system_settings_permission?: PermissionDto
}

export class UpdateUserRoleDto extends PartialType(CreateUserRoleDto) {}
