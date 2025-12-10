import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateConsolidatedReportDto {
  @ApiProperty({
    example: 'https://example.com/reports/consolidated-report.pdf',
    description: 'Consolidated report URL'
  })
  @IsUrl()
  @IsNotEmpty()
  url: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string
}

export class BulkReportItemDto {
  @ApiProperty({
    example: 'https://example.com/reports/consolidated-report.pdf',
    description: 'Consolidated report URL'
  })
  @IsUrl()
  @IsNotEmpty()
  url: string
}

export class BulkCreateConsolidatedReportDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiProperty({
    type: [BulkReportItemDto],
    description: 'Array of consolidated reports to create',
    example: [
      { url: 'https://example.com/reports/report1.pdf' },
      { url: 'https://example.com/reports/report2.pdf' }
    ]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkReportItemDto)
  reports: BulkReportItemDto[]
}

export class BulkCreateResultDto {
  @ApiProperty({ example: 3, description: 'Total reports in request' })
  totalReports: number

  @ApiProperty({ example: 2, description: 'Successfully created reports count' })
  successCount: number

  @ApiProperty({ example: 1, description: 'Failed reports count' })
  failureCount: number

  @ApiProperty({
    type: [Object],
    description: 'Array of error details for failed reports'
  })
  errors: { index: number; url: string; error: string }[]

  @ApiProperty({
    type: [String],
    description: 'Array of successfully created report IDs'
  })
  successfulReportIds: string[]
}

export class UpdateConsolidatedReportDto extends PartialType(
  CreateConsolidatedReportDto
) {
  @ApiPropertyOptional({
    example: 'https://example.com/reports/updated-report.pdf',
    description: 'Consolidated report URL'
  })
  @IsUrl()
  @IsOptional()
  url?: string
}

export class BulkDeleteConsolidatedReportDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID to verify reports belong to'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiProperty({
    type: [String],
    description: 'Array of consolidated report IDs to delete',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  report_ids: string[]
}

export class BulkDeleteResultDto {
  @ApiProperty({ example: 3, description: 'Total reports in request' })
  totalReports: number

  @ApiProperty({ example: 2, description: 'Successfully deleted reports count' })
  successCount: number

  @ApiProperty({ example: 1, description: 'Failed deletions count' })
  failureCount: number

  @ApiProperty({
    type: [Object],
    description: 'Array of error details for failed deletions'
  })
  errors: { report_id: string; error: string }[]

  @ApiProperty({
    type: [String],
    description: 'Array of successfully deleted report IDs'
  })
  deletedReportIds: string[]
}

export class ConsolidatedReportQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string
}
