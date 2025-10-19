import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'

export class SendEmailDto {
  @ApiProperty({
    example: 'recipient@example.com',
    description: 'Recipient email address'
  })
  @IsEmail()
  @IsNotEmpty()
  to: string

  @ApiProperty({
    example: 'Important Update',
    description: 'Email subject'
  })
  @IsString()
  @IsNotEmpty()
  subject: string

  @ApiProperty({
    example: 'Dear recipient,\n\nThis is an important update...',
    description: 'Email body content (plain text)'
  })
  @IsString()
  @IsNotEmpty()
  body: string

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether to include sender information at the end of the email body (defaults to true)'
  })
  @IsBoolean()
  @IsOptional()
  send_sender_data?: boolean
}
