import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PendingActionType } from '@prisma/client'
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreatePendingActionDto {
  @ApiProperty({
    description: 'Resource type (property, portfolio, or audit)'
  })
  @IsString()
  @IsNotEmpty()
  resource_type: string

  @ApiPropertyOptional({
    description: 'Property ID for property-related actions'
  })
  @IsString()
  @IsOptional()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Portfolio ID for portfolio-related actions'
  })
  @IsString()
  @IsOptional()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Audit ID for audit-related actions'
  })
  @IsString()
  @IsOptional()
  audit_id?: string

  @ApiProperty({
    enum: PendingActionType,
    description: 'Type of action requested'
  })
  @IsEnum(PendingActionType)
  @IsNotEmpty()
  action_type: PendingActionType

  @ApiPropertyOptional({
    description: 'Transfer data with portfolio information for transfer actions'
  })
  @IsOptional()
  transfer_data?: {
    new_portfolio_id: string
    portfolio_from?: {
      id: string
      name: string
    }
    portfolio_to?: {
      id: string
      name: string
    }
  }

  @ApiPropertyOptional({
    description: 'Audit update data for audit update actions'
  })
  @IsOptional()
  audit_update_data?: {
    amount_confirmed: number
  }

  @ApiPropertyOptional({
    description: 'Reason for the action request (optional, provided by non-super admin users)'
  })
  @IsString()
  @IsOptional()
  reason?: string
}

export class PendingActionQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'PENDING'
  })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({
    description: 'Filter by action type',
    example: 'PROPERTY_TRANSFER'
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

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Filter by audit ID'
  })
  @IsOptional()
  @IsString()
  audit_id?: string

  @ApiPropertyOptional({
    description: 'Filter by resource type'
  })
  @IsOptional()
  @IsString()
  resource_type?: string
}

export class ApprovePendingActionDto {
  @ApiPropertyOptional({
    description: 'Rejection reason (required when rejecting)'
  })
  @IsOptional()
  @IsString()
  rejection_reason?: string
}
