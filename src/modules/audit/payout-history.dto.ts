import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator'

/**
 * Filters for the payout history list, summary and export.
 *
 * Every field is optional and every field is validated: these values are forwarded to the payout
 * service, so an unvalidated string here becomes an unvalidated string on the money service's query.
 *
 * `page_size` is capped at 200 to match the upstream cap exactly. Allowing more here would let the
 * dashboard ask for a page the payout service silently truncates, and the operator would page
 * through a total that never resolves.
 */
export class PayoutHistoryQueryDto {
  @ApiPropertyOptional({ example: 1, description: '1-based page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ example: 50, description: 'Rows per page, capped at 200 upstream' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page_size?: number

  @ApiPropertyOptional({
    example: 'sent',
    description:
      'Journal status of the payout leg, e.g. requested, processing, sent, paid, failed, returned. ' +
      'Note the two rails end differently: Rail A finishes at `paid`, Rail B at `sent`.'
  })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({
    description:
      "Scope the results to a single property, by the PAYOUT SERVICE's hotel id. Operator-facing " +
      'callers rarely hold this; a dashboard page should send property_id instead.'
  })
  @IsOptional()
  @IsString()
  hotel_id?: string

  @ApiPropertyOptional({
    description:
      'Scope the results to a single property, by the DASHBOARD property id. This is the id every ' +
      'dashboard page already has in hand. It is resolved to a hotel through the property mapping ' +
      'and intersected with the caller\'s own access, so it can never widen what they may see.'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({ example: 'usd', description: 'ISO 4217 code, lowercase' })
  @IsOptional()
  @IsString()
  currency?: string

  @ApiPropertyOptional({ example: '2026-07-01', description: 'Inclusive lower bound on creation date' })
  @IsOptional()
  @IsISO8601()
  date_from?: string

  @ApiPropertyOptional({ example: '2026-07-31', description: 'Inclusive upper bound on creation date' })
  @IsOptional()
  @IsISO8601()
  date_to?: string
}
