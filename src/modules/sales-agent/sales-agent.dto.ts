import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateSalesAgentDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the sales agent' })
  @IsString()
  @IsNotEmpty()
  full_name: string

  @ApiProperty({ example: '123 Main St, New York, NY 10001', description: 'Address of the sales agent' })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiProperty({ example: '+1234567890', description: 'Phone number of the sales agent' })
  @IsString()
  @IsNotEmpty()
  phone: string

  @ApiProperty({ example: 'john.doe@example.com', description: 'Email address of the sales agent' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: 5.5, description: 'Commission percentage for the sales agent' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  commission: number

  @ApiPropertyOptional({
    example: ['https://s3.amazonaws.com/docs/contract.pdf'],
    description: 'List of document URLs for the sales agent',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  documents?: string[]
}

export class UpdateSalesAgentDto extends PartialType(CreateSalesAgentDto) {}

export class SalesAgentQueryDto extends QueryDto {}
