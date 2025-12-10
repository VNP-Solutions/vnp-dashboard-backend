import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator'
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

export class ConsolidatedReportQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string
}
