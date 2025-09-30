import { PartialType } from '@nestjs/mapped-types'
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'

export class CreatePortfolioDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  service_type_id: string

  @IsBoolean()
  @IsNotEmpty()
  is_contract_signed: boolean

  @IsString()
  @IsOptional()
  contract_url?: string

  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean

  @IsString()
  @IsEmail()
  @IsOptional()
  contact_email?: string

  @IsBoolean()
  @IsNotEmpty()
  is_commissionable: boolean
}

export class UpdatePortfolioDto extends PartialType(CreatePortfolioDto) {}
