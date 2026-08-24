import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  SyncActionEntityType,
  SyncActionScope,
  SyncActionType
} from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class SyncActionLogItemDto {
  @ApiPropertyOptional({ description: 'Historical DBMS entity id' })
  @IsOptional()
  @IsString()
  id?: string

  @ApiProperty({ description: 'Snapshotted entity name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({ description: 'Whether this item succeeded overall' })
  @IsOptional()
  @IsBoolean()
  success?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dbms?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dashboard?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scraper?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from_portfolio_id?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from_portfolio_name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to_portfolio_id?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to_portfolio_name?: string
}

export class CreateSyncActionLogDto {
  @ApiProperty({ enum: SyncActionScope })
  @IsEnum(SyncActionScope)
  scope: SyncActionScope

  @ApiProperty({ enum: SyncActionEntityType })
  @IsEnum(SyncActionEntityType)
  entity_type: SyncActionEntityType

  @ApiProperty({ enum: SyncActionType })
  @IsEnum(SyncActionType)
  action: SyncActionType

  @ApiPropertyOptional({ description: 'Historical DBMS entity id (single)' })
  @IsOptional()
  @IsString()
  entity_id?: string

  @ApiPropertyOptional({ description: 'Snapshotted entity name (single)' })
  @IsOptional()
  @IsString()
  entity_name?: string

  @ApiProperty({ type: [SyncActionLogItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncActionLogItemDto)
  items: SyncActionLogItemDto[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  total_count?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  success_count?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  failed_count?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  performed_by_email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  performed_by_name?: string

  @ApiPropertyOptional({ description: 'Snapshotted DBMS role name' })
  @IsOptional()
  @IsString()
  performed_by_role?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  job_id?: string
}

export class SyncActionLogQueryDto extends QueryDto {
  @ApiPropertyOptional({ enum: SyncActionScope })
  @IsOptional()
  @IsString()
  scope?: string

  @ApiPropertyOptional({ enum: SyncActionEntityType })
  @IsOptional()
  @IsString()
  entity_type?: string

  @ApiPropertyOptional({ enum: SyncActionType })
  @IsOptional()
  @IsString()
  action?: string
}
