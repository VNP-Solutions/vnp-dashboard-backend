import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'

export class CreateTaskDto {
  @ApiProperty({
    example: 'Update property credentials',
    description: 'Task title'
  })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiPropertyOptional({
    example: 'Need to update Expedia and Agoda credentials',
    description: 'Task description'
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the task is marked as done',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  is_done?: boolean

  @ApiPropertyOptional({
    example: '2025-10-20T00:00:00.000Z',
    description: 'Task due date'
  })
  @IsDateString()
  @IsOptional()
  due_date?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID this task belongs to'
  })
  @IsString()
  @IsOptional()
  portfolio_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439012',
    description: 'Property ID this task belongs to'
  })
  @IsString()
  @IsOptional()
  property_id?: string
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class TaskQueryDto {
  @ApiPropertyOptional({
    description: 'Search by task title or description',
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
    description: 'Filter by due date',
    example: '2025-10-20T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  due_date?: string

  @ApiPropertyOptional({
    description: 'Sort field (created_at/due_date)',
    example: 'created_at',
    default: 'created_at'
  })
  @IsOptional()
  @IsString()
  sortBy?: 'created_at' | 'due_date'

  @ApiPropertyOptional({
    description: 'Sort order (asc/desc)',
    example: 'desc',
    default: 'desc'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc'
}

export class DeleteAllTasksDto {
  @ApiPropertyOptional({
    description: 'Portfolio ID to filter tasks for deletion',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Property ID to filter tasks for deletion',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Done status to filter tasks for deletion (true/false)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_done?: string
}
