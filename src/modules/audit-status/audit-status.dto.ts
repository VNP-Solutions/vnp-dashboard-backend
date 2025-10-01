import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class CreateAuditStatusDto {
  @ApiProperty({
    example: 'Pending Review',
    description: 'Audit status name'
  })
  @IsString()
  @IsNotEmpty()
  status: string
}

export class UpdateAuditStatusDto extends PartialType(CreateAuditStatusDto) {}
