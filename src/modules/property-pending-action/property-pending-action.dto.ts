import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PropertyActionType } from '@prisma/client'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreatePropertyPendingActionDto {
  @ApiProperty({
    description: 'Property ID for the pending action'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string

  @ApiProperty({
    enum: PropertyActionType,
    description: 'Type of action requested (DELETE or TRANSFER)'
  })
  @IsEnum(PropertyActionType)
  @IsNotEmpty()
  action_type: PropertyActionType

  @ApiPropertyOptional({
    description: 'Transfer data with new_portfolio_id for transfer actions'
  })
  @IsOptional()
  transfer_data?: { new_portfolio_id: string }
}

export class PropertyPendingActionQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'PENDING'
  })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({
    description: 'Filter by action type',
    example: 'DELETE'
  })
  @IsOptional()
  @IsString()
  action_type?: string

  @ApiPropertyOptional({
    description: 'Filter by requested user ID'
  })
  @IsOptional()
  @IsString()
  requested_user_id?: string

  @ApiPropertyOptional({
    description: 'Filter by property ID'
  })
  @IsOptional()
  @IsString()
  property_id?: string
}

export class ApprovePropertyPendingActionDto {
  @ApiPropertyOptional({
    description: 'Rejection reason (required when rejecting)'
  })
  @IsOptional()
  @IsString()
  rejection_reason?: string
}
