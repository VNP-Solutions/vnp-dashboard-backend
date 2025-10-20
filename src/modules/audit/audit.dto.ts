import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OtaType } from '@prisma/client'
import { Transform } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateAuditDto {
  @ApiPropertyOptional({
    enum: OtaType,
    example: OtaType.expedia,
    description: 'Type of OTA (expedia, agoda, booking)'
  })
  @IsEnum(OtaType)
  @IsOptional()
  type_of_ota?: OtaType

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Audit status ID'
  })
  @IsString()
  @IsNotEmpty()
  audit_status_id: string

  @ApiPropertyOptional({
    example: 5000,
    description: 'Amount collectable'
  })
  @IsNumber()
  @IsOptional()
  amount_collectable?: number

  @ApiPropertyOptional({
    example: 4500,
    description: 'Amount confirmed'
  })
  @IsNumber()
  @IsOptional()
  amount_confirmed?: number

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: 'Audit start date'
  })
  @IsDateString()
  @IsNotEmpty()
  start_date: string

  @ApiProperty({
    example: '2024-01-31T23:59:59Z',
    description: 'Audit end date'
  })
  @IsDateString()
  @IsNotEmpty()
  end_date: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiPropertyOptional({
    example: 'https://example.com/report.pdf',
    description: 'Report URL'
  })
  @IsString()
  @IsOptional()
  report_url?: string
}

export class UpdateAuditDto extends PartialType(CreateAuditDto) {}

export class AuditQueryDto extends QueryDto {
  @ApiPropertyOptional({
    enum: OtaType,
    description: 'Filter by OTA type (expedia, agoda, booking)',
    example: OtaType.expedia
  })
  @IsOptional()
  @IsString()
  type_of_ota?: string

  @ApiPropertyOptional({
    description: 'Filter by audit status ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  audit_status_id?: string

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Filter by Expedia ID from property credentials',
    example: 'EXP123456'
  })
  @IsOptional()
  @IsString()
  expedia_id?: string

  @ApiPropertyOptional({
    description:
      'Filter by archived status (true/false/All/empty string to ignore filter)',
    example: 'false'
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value.toString()
    if (typeof value === 'string') return value
    return value
  })
  is_archived?: string
}

export class BulkUpdateAuditDto extends PartialType(CreateAuditDto) {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of audit IDs to update'
  })
  @IsNotEmpty()
  audit_ids: string[]
}

export class BulkArchiveAuditDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of audit IDs to archive'
  })
  @IsArray()
  @IsNotEmpty()
  audit_ids: string[]
}
