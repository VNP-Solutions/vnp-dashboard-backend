import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateAuditBatchDto {
  @ApiProperty({
    example: 'BATCH-001',
    description: 'Batch number (must be unique)'
  })
  @IsString()
  @IsNotEmpty()
  batch_no: string
}

export class UpdateAuditBatchDto extends PartialType(
  CreateAuditBatchDto
) {}

export class AuditBatchQueryDto {
  @ApiPropertyOptional({
    description: 'Search by batch number',
    example: 'BATCH-001'
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Sort field (batch_no, created_at, updated_at)',
    example: 'created_at'
  })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({
    description: 'Sort order (asc or desc)',
    example: 'desc'
  })
  @IsOptional()
  @IsString()
  sortOrder?: string
}

export class ReorderAuditBatchDto {
  @ApiProperty({
    example: 2,
    description: 'New order position for the audit batch'
  })
  @IsNotEmpty()
  newOrder: number
}

