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

export class ReorderAuditStatusDto {
  @ApiProperty({
    example: 2,
    description: 'New order position for the audit status'
  })
  @IsNotEmpty()
  newOrder: number
}

export class DeleteAuditStatusDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'User password for verification (required for deletion)'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}
