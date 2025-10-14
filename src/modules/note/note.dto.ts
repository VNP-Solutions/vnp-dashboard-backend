import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateNoteDto {
  @ApiProperty({
    example: 'Remember to update property credentials',
    description: 'Note text content'
  })
  @IsString()
  @IsNotEmpty()
  text: string

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the note is marked as done',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  is_done?: boolean

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID this note belongs to'
  })
  @IsString()
  @IsOptional()
  portfolio_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439012',
    description: 'Property ID this note belongs to'
  })
  @IsString()
  @IsOptional()
  property_id?: string
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}

export class NoteQueryDto {
  @ApiPropertyOptional({
    description: 'Search by note text',
    example: 'credentials'
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Filter by done status (true/false)',
    example: 'false'
  })
  @IsOptional()
  @IsString()
  is_done?: string

  @ApiPropertyOptional({
    description: 'Sort order (asc/desc)',
    example: 'desc',
    default: 'desc'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc'
}

export class DeleteAllNotesDto {
  @ApiPropertyOptional({
    description: 'Portfolio ID to filter notes for deletion',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Property ID to filter notes for deletion',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Done status to filter notes for deletion (true/false)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_done?: string
}
