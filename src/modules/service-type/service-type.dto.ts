import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator'

export class CreateServiceTypeDto {
  @ApiProperty({
    example: 'OTA',
    description: 'Service type name'
  })
  @IsString()
  @IsNotEmpty()
  type: string

  @ApiProperty({
    example: true,
    description: 'Whether service type is active'
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateServiceTypeDto extends PartialType(CreateServiceTypeDto) {}
