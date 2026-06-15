import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class BulkAuditImportBodyDto {
  @ApiProperty({
    description:
      'QA Panel ID to associate with this import job. Passed through to the callback API when the import completes.',
    example: '6a2fbcbd4e6bed36e9c31654'
  })
  @IsString()
  @IsNotEmpty()
  qa_panel_id: string

  @ApiProperty({
    description:
      'Email address to associate with this import job. Carried through the SQS message and included in the import report.',
    example: 'user@example.com'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string
}

export class GenerateTokenResponseDto {
  @ApiProperty({
    description:
      'Signed JWT to use as Bearer token for all other /external/* endpoints',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiZXh0ZXJuYWwtY29tbXVuaWNhdGlvbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDg2NDAwfQ.signature'
  })
  token: string

  @ApiProperty({
    description: 'Token lifetime (fixed at 24 hours)',
    example: '24h'
  })
  expiresIn: string
}

export class BulkAuditImportAcceptedDto {
  @ApiProperty({
    description:
      'Unique identifier for the background import job. Use this to correlate the callback when the job finishes.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  })
  jobId: string

  @ApiProperty({
    description: 'Human-readable confirmation that the import is queued',
    example: 'Import is on Processing'
  })
  message: string
}

export class AuditImportRowError {
  @ApiProperty({
    description:
      'Excel row number (1-based; row 1 is the header, so data rows start at 2)',
    example: 3
  })
  row: number

  @ApiProperty({
    description:
      'Expedia ID extracted from the row (or "Unknown" if the column was missing)',
    example: '12345678'
  })
  expediaId: string

  @ApiProperty({
    description: 'Human-readable description of why this row failed',
    example: 'Property not found with this Expedia ID'
  })
  reason: string
}

export class AuditImportReport {
  @ApiProperty({
    description: 'The job ID that was returned in the 202 response',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  })
  jobId: string

  @ApiProperty({
    description: 'QA Panel ID that was provided in the original import request',
    example: '6a2fbcbd4e6bed36e9c31654'
  })
  qaPanelId: string

  @ApiProperty({
    description:
      'Email address that was provided in the original import request',
    example: 'user@example.com'
  })
  email: string

  @ApiProperty({
    description: 'Total number of data rows found in the spreadsheet',
    example: 100
  })
  totalRows: number

  @ApiProperty({
    description: 'Number of rows successfully imported as audits',
    example: 95
  })
  successCount: number

  @ApiProperty({
    description: 'Number of rows that failed to import',
    example: 5
  })
  failureCount: number

  @ApiProperty({
    description: 'Per-row error details for every row that failed',
    type: [AuditImportRowError]
  })
  errors: AuditImportRowError[]

  @ApiPropertyOptional({
    description:
      'Human-readable label for each audit that was created successfully',
    type: [String],
    example: ['12345678 - expedia, agoda Audit', '87654321 - booking Audit']
  })
  successfulImports: string[]
}
