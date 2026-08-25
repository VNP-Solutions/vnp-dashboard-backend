import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType
} from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ArrayMinSize,
  ValidateNested
} from 'class-validator'
import { RejectNumericBankIdentifier } from '../../common/decorators/bank-identifier.decorator'
import { QueryDto } from '../../common/dto/query.dto'
import {
  AgodaCredentialsDto,
  ExpediaCredentialsDto,
  OtaCredentialsDto,
  PatchExpediaCredentialsDto
} from '../property-credentials/property-credentials.dto'
import { IsObject } from 'class-validator'
export type AccessType = 'owned' | 'shared'

export class CreatePropertyDto {
  @ApiProperty({
    example: 'Grand Hotel',
    description: 'Property name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: '123 Main Street, New York, NY 10001',
    description: 'Property address'
  })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Currency ID'
  })
  @IsString()
  @IsNotEmpty()
  currency_id: string

  @ApiPropertyOptional({
    example: 'GRAND HOTEL NY',
    description: 'Card descriptor for payment processing (optional)'
  })
  @IsString()
  @IsOptional()
  card_descriptor?: string

  @ApiProperty({
    example: true,
    description: 'Whether property is active'
  })
  @IsBoolean()
  @IsOptional()
  is_active: boolean

  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'Portfolio ID'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiPropertyOptional({
    example: 'external-property-123',
    description: 'Optional external parent property identifier'
  })
  @IsString()
  @IsOptional()
  parent_id?: string

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
    description:
      'Array of Portfolio IDs where this property should be visible (optional)',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  show_in_portfolio?: string[]
}

// Exclude is_active from UpdatePropertyDto - use dedicated deactivate API instead
export class UpdatePropertyDto extends PartialType(
  OmitType(CreatePropertyDto, ['is_active'] as const)
) {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439013',
    description: 'Previous Portfolio ID (used for tracking transfer history)'
  })
  @IsString()
  @IsOptional()
  previous_portfolio_id?: string
}

export class TransferPropertyDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'New Portfolio ID to transfer the property to'
  })
  @IsString()
  @IsNotEmpty()
  new_portfolio_id: string

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({
    example: 'Transferring to consolidate portfolio management',
    description:
      'Reason for transferring the property (required for non-super admin users, optional for super admin)'
  })
  @IsString()
  @IsOptional()
  reason?: string
}

export class BulkTransferPropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of Property IDs to transfer',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  property_ids: string[]

  @ApiProperty({
    example: '507f1f77bcf86cd799439013',
    description: 'Target Portfolio ID to transfer all properties to'
  })
  @IsString()
  @IsNotEmpty()
  new_portfolio_id: string

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class PropertyQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by bank type (bank/stripe/All)',
    example: 'bank'
  })
  @IsOptional()
  @IsString()
  bank_type?: string

  @ApiPropertyOptional({
    description:
      'Filter by bank sub type (ach/domestic_wire/international_wire/all)',
    example: 'ach'
  })
  @IsOptional()
  @IsString()
  bank_sub_type?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false/All)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_active?: string

  @ApiPropertyOptional({
    description: 'Filter by credential type (full/expedia/booking/agoda/all)',
    example: 'full'
  })
  @IsOptional()
  @IsString()
  credential_type?: string
}

export class ExternalPropertyQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by bank sub type (ach/domestic_wire/international_wire/all)',
    example: 'ach'
  })
  @IsOptional()
  @IsString()
  bank_sub_type?: string

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false/all)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_active?: string

  @ApiPropertyOptional({
    description: 'Filter by credential type (full/expedia/booking/agoda/all)',
    example: 'full'
  })
  @IsOptional()
  @IsString()
  credential_type?: string

  @ApiPropertyOptional({
    description:
      'When true, returns all matching properties and ignores page and limit',
    example: false,
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  send_all?: boolean
}

/**
 * Same query as {@link PropertyQueryDto} with an additional file type for spreadsheet download.
 */
export class PropertyFileExportQueryDto extends PropertyQueryDto {
  @ApiProperty({
    description: 'Download format: xlsx (Excel) or csv',
    enum: ['xlsx', 'csv'],
    example: 'xlsx'
  })
  @IsIn(['xlsx', 'csv'])
  @IsNotEmpty()
  @IsString()
  fileType: 'xlsx' | 'csv'

  @ApiPropertyOptional({
    description:
      'Optional spreadsheet column headers to include. Unknown values are ignored. ' +
      '`Expedia ID*` is always included. When omitted, all columns are exported.',
    type: [String],
    example: ['Expedia ID*', 'Property Name*', 'Portfolio*', 'Status']
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined
    return Array.isArray(value) ? value : [value]
  })
  @IsArray()
  @IsString({ each: true })
  columns?: string[]
}

export class SharePropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
    description: 'Array of Portfolio IDs to share this property with',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  portfolio_ids: string[]
}

export class UnsharePropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'],
    description: 'Array of Portfolio IDs to remove access from',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  portfolio_ids: string[]
}

export class BulkImportResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of properties successfully imported'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      { row: 3, property: 'Test Property', error: 'Property already exists' }
    ],
    description: 'List of errors encountered during import'
  })
  errors: Array<{
    row: number
    property: string
    error: string
  }>

  @ApiProperty({
    example: ['Property A', 'Property B'],
    description: 'List of successfully imported property names'
  })
  successfulImports: string[]
}

export class SyncBulkUpsertPropertyResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({ example: 4, description: 'Number of properties created' })
  createdCount: number

  @ApiProperty({ example: 4, description: 'Number of properties updated' })
  updatedCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      {
        row: 3,
        parent_id: 'property-parent-123',
        error: 'Expedia ID is required'
      }
    ],
    description: 'List of errors encountered during sync bulk upsert'
  })
  errors: Array<{
    row: number
    parent_id: string
    error: string
  }>

  @ApiProperty({
    example: [
      { parent_id: 'property-parent-123', action: 'created' },
      { parent_id: 'property-parent-456', action: 'updated' }
    ],
    description: 'List of successfully upserted properties'
  })
  successfulUpserts: Array<{
    parent_id: string
    action: 'created' | 'updated'
  }>
}

export class SyncBulkDeletePropertyItemDto {
  @ApiProperty({
    example: 'property-parent-123',
    description: 'External property identifier (DBMS property id)'
  })
  @IsString()
  @IsNotEmpty()
  parent_id: string
}

export class SyncBulkDeletePropertyDto {
  @ApiProperty({
    type: [SyncBulkDeletePropertyItemDto],
    description: 'Properties to delete by Parent ID'
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncBulkDeletePropertyItemDto)
  items: SyncBulkDeletePropertyItemDto[]
}

export class SyncBulkDeletePropertyResultDto {
  @ApiProperty({ example: 10, description: 'Total number of items processed' })
  totalCount: number

  @ApiProperty({ example: 8, description: 'Number of properties deleted' })
  deletedCount: number

  @ApiProperty({ example: 2, description: 'Number of items that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      {
        parent_id: 'property-parent-123',
        error: 'Property not found with parent_id: property-parent-123'
      }
    ],
    description: 'List of errors encountered during sync bulk delete'
  })
  errors: Array<{
    parent_id: string
    error: string
  }>

  @ApiProperty({
    example: [{ parent_id: 'property-parent-123' }],
    description: 'List of successfully deleted properties'
  })
  successfulDeletes: Array<{
    parent_id: string
  }>
}

export class SyncBulkUpsertPropertyItemDto {
  @ApiProperty({
    example: 2,
    description:
      'Source row number used in the sync report (e.g. spreadsheet row)'
  })
  row: number

  @ApiProperty({
    example: 'property-parent-123',
    description: 'External property identifier (upsert key)'
  })
  parent_id: string

  @ApiProperty({ example: 'Grand Hotel', description: 'Property name' })
  name: string

  @ApiProperty({
    example: '123 Main Street, New York, NY 10001',
    description: 'Property address'
  })
  address: string

  @ApiProperty({ example: 'USD', description: 'Currency code' })
  currency: string

  @ApiPropertyOptional({
    example: 'GRAND HOTEL NY',
    description: 'Card descriptor for payment processing'
  })
  card_descriptor?: string

  @ApiProperty({
    example: 'portfolio-parent-123',
    description: 'External portfolio parent ID used to resolve portfolio_id'
  })
  portfolio_parent_id: string

  @ApiProperty({ example: true, description: 'Whether property is active' })
  is_active: boolean

  @ApiProperty({
    example: 'EXP123456',
    description: 'Expedia property ID (required)'
  })
  expedia_id: string

  @ApiPropertyOptional({ example: 'hotel@expedia.com' })
  expedia_username?: string

  @ApiPropertyOptional()
  expedia_password?: string

  @ApiPropertyOptional({ example: 'AGD123456' })
  agoda_id?: string

  @ApiPropertyOptional({ example: 'hotel@agoda.com' })
  agoda_username?: string

  @ApiPropertyOptional()
  agoda_password?: string

  @ApiPropertyOptional({ example: 'BKG123456' })
  booking_id?: string

  @ApiPropertyOptional({ example: 'hotel@booking.com' })
  booking_username?: string

  @ApiPropertyOptional()
  booking_password?: string
}

/// Wrapper for the sync-bulk-upsert endpoint. When `batchId` is present the
/// endpoint returns 202 immediately and processes the items in the
/// background, POSTing the result back to `callbackUrl` (the DBMS). When
/// `batchId` is absent the endpoint behaves synchronously as before.
export class SyncBulkUpsertRequestDto {
  @ApiProperty({
    type: [SyncBulkUpsertPropertyItemDto],
    description: 'Properties to upsert'
  })
  items: SyncBulkUpsertPropertyItemDto[]

  @ApiProperty({
    required: false,
    description:
      'If present, process asynchronously and call back with the result'
  })
  batchId?: string

  @ApiProperty({
    required: false,
    description:
      'DBMS endpoint to POST the result back to (required when batchId is set)'
  })
  callbackUrl?: string
}

export class BulkUpdateResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({
    example: 8,
    description: 'Number of properties successfully updated'
  })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [
      {
        row: 3,
        expediaId: 'EXP-12345',
        error: 'Property not found'
      }
    ],
    description: 'List of errors encountered during update'
  })
  errors: Array<{
    row: number
    expediaId: string
    error: string
  }>

  @ApiProperty({
    example: ['EXP-12345', 'EXP-67890'],
    description: 'List of successfully updated Expedia IDs'
  })
  successfulUpdates: string[]
}

export class PropertyStatsResponseDto {
  @ApiProperty({
    example: 50000,
    description: 'Total amount collectable from all audits for this property'
  })
  total_amount_collectable: number

  @ApiProperty({
    example: 45000,
    description: 'Total amount confirmed from all audits for this property'
  })
  total_amount_confirmed: number

  @ApiProperty({
    description: 'Property details including credentials and currency'
  })
  property: {
    id: string
    name: string
    address: string
    card_descriptor: string | null
    is_active: boolean
    portfolio_id: string
    currency_id: string
    currency: {
      id: string
      code: string
      name: string
      symbol: string | null
    }
    credentials: {
      expedia_id: string | null
      agoda_id: string | null
      booking_id: string | null
    } | null
  }
}

export class GetPropertiesByPortfoliosDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
    description:
      'Array of Portfolio IDs to get properties from (owned by or shown in those portfolios). If empty array is provided, returns all properties accessible to the user.',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  portfolio_ids: string[]
}

export class DeletePropertyDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class SecurePropertyDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification to access full bank details'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class GetPropertiesByIdsSecureDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of Property IDs to retrieve with full bank details',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  property_ids: string[]

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'Current user password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class GetPropertiesBankDetailsSecureDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'Current user password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description:
      'Filter by portfolio: only properties owned by this portfolio (excludes properties shown in via show_in_portfolio)'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description:
      'Search by property name or portfolio name (case-insensitive partial match)'
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    enum: ['all', 'ach', 'domestic_wire', 'international_wire'],
    default: 'all',
    description:
      'Deprecated for property filtering on this endpoint. All matching properties are returned regardless of bank sub-type.'
  })
  @IsOptional()
  @IsIn(['all', 'ach', 'domestic_wire', 'international_wire'])
  bank_sub_type?: string
}

export class SecurePropertyListDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification to access full bank details'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class BulkDeletePropertyDto {
  @ApiProperty({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of Property IDs to delete',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  property_ids: string[]

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class DeactivatePropertyDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({
    example: 'Property no longer operational due to renovations',
    description:
      'Reason for deactivating the property (required for internal users, optional for super admin)'
  })
  @IsString()
  @IsOptional()
  reason?: string
}

export class ActivatePropertyDto {
  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({
    example: 'Property is ready for operations again',
    description:
      'Reason for activating the property (required for internal users, optional for super admin)'
  })
  @IsString()
  @IsOptional()
  reason?: string
}

export class CompletePropertyCredentialsDto {
  @ApiProperty({
    description:
      'Expedia credentials (required - only expedia id is required; username and password are optional but must be provided together)',
    type: ExpediaCredentialsDto
  })
  @ValidateNested()
  @Type(() => ExpediaCredentialsDto)
  @IsNotEmpty()
  expedia: ExpediaCredentialsDto

  @ApiPropertyOptional({
    description:
      'Agoda credentials (optional, username can be provided without password)',
    type: AgodaCredentialsDto
  })
  @ValidateNested()
  @Type(() => AgodaCredentialsDto)
  @IsOptional()
  agoda?: AgodaCredentialsDto

  @ApiPropertyOptional({
    description:
      'Booking.com credentials (optional, username and password must be provided together)',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  booking?: OtaCredentialsDto
}

/** Same as {@link CompletePropertyCredentialsDto}, but Expedia `id` is optional when credentials already exist in DB (enforced in PropertyService.completeUpdate). */
export class CompletePropertyCredentialsUpdateDto {
  @ApiProperty({
    description:
      'Expedia credentials (Expedia id required only when none is stored yet; username and password optional but must be provided together)',
    type: PatchExpediaCredentialsDto
  })
  @ValidateNested()
  @Type(() => PatchExpediaCredentialsDto)
  @IsNotEmpty()
  expedia: PatchExpediaCredentialsDto

  @ApiPropertyOptional({
    description:
      'Agoda credentials (optional, username can be provided without password)',
    type: AgodaCredentialsDto
  })
  @ValidateNested()
  @Type(() => AgodaCredentialsDto)
  @IsOptional()
  agoda?: AgodaCredentialsDto

  @ApiPropertyOptional({
    description:
      'Booking.com credentials (optional, username and password must be provided together)',
    type: OtaCredentialsDto
  })
  @ValidateNested()
  @Type(() => OtaCredentialsDto)
  @IsOptional()
  booking?: OtaCredentialsDto
}

export class CompleteBankDetailsDto {
  @ApiProperty({
    enum: ['bank', 'stripe', 'none'],
    example: 'bank',
    description:
      'Type of bank account (bank, stripe, or none). Use "none" to remove existing bank details.',
    default: 'bank'
  })
  @IsString()
  @IsNotEmpty()
  bank_type: string

  @ApiPropertyOptional({
    enum: ['ach', 'domestic_wire', 'international_wire'],
    example: 'ach',
    description: 'Bank sub-type when bank_type is "bank"'
  })
  @IsString()
  @IsOptional()
  bank_sub_type?: string

  @ApiPropertyOptional({
    example: 'Grand Hotel',
    description: 'Hotel or Portfolio name'
  })
  @IsString()
  @IsOptional()
  hotel_portfolio_name?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Beneficiary name'
  })
  @IsString()
  @IsOptional()
  beneficiary_name?: string

  @ApiPropertyOptional({
    example: '123 Main Street, New York, NY 10001',
    description: 'Beneficiary address'
  })
  @IsString()
  @IsOptional()
  beneficiary_address?: string

  @ApiPropertyOptional({
    example: '1234567890',
    description:
      'Bank account number. Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  account_number?: string

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Account holder name'
  })
  @IsString()
  @IsOptional()
  account_name?: string

  @ApiPropertyOptional({
    example: 'Chase Bank',
    description: 'Name of the bank'
  })
  @IsString()
  @IsOptional()
  bank_name?: string

  @ApiPropertyOptional({
    example: 'New York Branch',
    description: 'Bank branch name or location'
  })
  @IsString()
  @IsOptional()
  bank_branch?: string

  @ApiPropertyOptional({
    example: 'GB29NWBK60161331926819',
    description:
      'IBAN or Account Number (for International Wire). Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  iban_number?: string

  @ApiPropertyOptional({
    example: 'CHASUS33XXX',
    description:
      'SWIFT/BIC Code (for International Wire). Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  swift_bic_number?: string

  @ApiPropertyOptional({
    example: '021000021',
    description:
      'Routing number (9 digits). Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros. Stored exactly as submitted; the server does not pad or rewrite digits.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  @Length(9, 9, { message: 'Routing number must be 9 digits' })
  routing_number?: string

  @ApiPropertyOptional({
    example: '121000248',
    description:
      'Bank wiring routing number for wire transfers (optional, Domestic Wire). Must be a quoted JSON string — bare numeric JSON cannot preserve leading zeros. Stored exactly as submitted; the server does not pad or rewrite digits.'
  })
  @RejectNumericBankIdentifier()
  @IsString()
  @IsOptional()
  bank_wiring_routing_number?: string

  @ApiPropertyOptional({
    example: 'checking',
    description: 'Bank account type (free-form string)'
  })
  @IsString()
  @IsOptional()
  bank_account_type?: string

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency code'
  })
  @IsString()
  @IsOptional()
  currency?: string

  @ApiPropertyOptional({
    example: 'stripe@example.com',
    description: 'Stripe account email'
  })
  @IsString()
  @IsOptional()
  stripe_account_email?: string

  @ApiPropertyOptional({
    example: 'John Smith',
    description: 'Contact person name for bank account inquiries'
  })
  @IsString()
  @IsOptional()
  contact_name?: string

  @ApiPropertyOptional({
    example: 'john.smith@example.com',
    description: 'Contact email address for bank account inquiries'
  })
  @IsString()
  @IsOptional()
  email_address?: string

  @ApiPropertyOptional({
    example: '123 Bank Street, New York, NY 10001',
    description: 'Bank physical address (for International Wire)'
  })
  @IsString()
  @IsOptional()
  bank_address?: string

  @ApiPropertyOptional({
    example: 'Additional notes about the bank account',
    description: 'Comments or notes about the bank account details'
  })
  @IsString()
  @IsOptional()
  comments?: string
}

export class CompleteCreatePropertyDto {
  @ApiProperty({
    description: 'Property data',
    type: CreatePropertyDto
  })
  @ValidateNested()
  @Type(() => CreatePropertyDto)
  @IsNotEmpty()
  property: CreatePropertyDto

  @ApiProperty({
    description:
      'Property credentials (required - expedia id is the only required field)',
    type: CompletePropertyCredentialsDto
  })
  @ValidateNested()
  @Type(() => CompletePropertyCredentialsDto)
  @IsNotEmpty()
  credentials: CompletePropertyCredentialsDto

  @ApiPropertyOptional({
    description: 'Property bank details (optional)',
    type: CompleteBankDetailsDto
  })
  @ValidateNested()
  @Type(() => CompleteBankDetailsDto)
  @IsOptional()
  bank_details?: CompleteBankDetailsDto
}

export class CompleteUpdatePropertyDto {
  @ApiPropertyOptional({
    description: 'Property data to update',
    type: UpdatePropertyDto
  })
  @ValidateNested()
  @Type(() => UpdatePropertyDto)
  @IsOptional()
  property?: UpdatePropertyDto

  @ApiPropertyOptional({
    description: 'Property credentials to update (optional)',
    type: CompletePropertyCredentialsUpdateDto
  })
  @ValidateNested()
  @Type(() => CompletePropertyCredentialsUpdateDto)
  @IsOptional()
  credentials?: CompletePropertyCredentialsUpdateDto

  @ApiPropertyOptional({
    description: 'Property bank details to update (optional)',
    type: CompleteBankDetailsDto
  })
  @ValidateNested()
  @Type(() => CompleteBankDetailsDto)
  @IsOptional()
  bank_details?: CompleteBankDetailsDto
}

export class SyncUpsertPropertyCurrencyDto {
  @ApiProperty({ example: 'USD', description: 'Currency code (ISO 4217)' })
  @IsString()
  @IsNotEmpty()
  code: string

  @ApiProperty({
    example: 'United States Dollar',
    description: 'Currency name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({ example: '$', description: 'Currency symbol' })
  @IsString()
  @IsOptional()
  symbol?: string
}

export class SyncUpsertPropertyCredentialsDto {
  @ApiProperty({
    example: 'EXP123456',
    description: 'Expedia property ID (required for property creation)'
  })
  @IsString()
  @IsNotEmpty()
  expedia_id: string

  @ApiPropertyOptional({ example: 'hotel@expedia.com' })
  @IsOptional()
  @IsString()
  expedia_username?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expedia_password?: string | null

  @ApiPropertyOptional({ example: 'AGD123456' })
  @IsOptional()
  @IsString()
  agoda_id?: string | null

  @ApiPropertyOptional({ example: 'hotel@agoda.com' })
  @IsOptional()
  @IsString()
  agoda_username?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agoda_password?: string | null

  @ApiPropertyOptional({ example: 'BKG123456' })
  @IsOptional()
  @IsString()
  booking_id?: string | null

  @ApiPropertyOptional({ example: 'hotel@booking.com' })
  @IsOptional()
  @IsString()
  booking_username?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  booking_password?: string | null
}

/**
 * Processor name per OTA, as DBMS still sends it.
 *
 * ACCEPTED AND IGNORED, deliberately. The payout service no longer reads a property-level processor:
 * the processor is a property of the RESERVATION, and one OTA's bookings can split across rails, so
 * a single column per OTA could never describe it. The columns were dropped from Property.
 *
 * The field stays on the DTO because the global ValidationPipe runs with `forbidNonWhitelisted`.
 * Removing it outright turns every DBMS sync payload that still carries `processors` into a 400,
 * which would break property sync for a producer we do not control and cannot deploy in lockstep.
 * It can come out once DBMS has stopped sending it.
 *
 * @deprecated Nothing reads this. See the payout service's report_data rail selection.
 */
export class SyncUpsertProcessorsDto {
  @ApiPropertyOptional({ example: 'Stripe' })
  @IsOptional()
  @IsString()
  expedia?: string | null

  @ApiPropertyOptional({ example: 'QuantumPay' })
  @IsOptional()
  @IsString()
  booking?: string | null

  @ApiPropertyOptional({ example: 'Stripe' })
  @IsOptional()
  @IsString()
  agoda?: string | null
}

export class SyncUpsertPropertyDto {
  @ApiProperty({ example: 'Grand Hotel', description: 'Property name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: '123 Main Street, New York, NY 10001',
    description: 'Property address'
  })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiProperty({
    type: SyncUpsertPropertyCurrencyDto,
    description: 'Currency details (matched by code, created if missing)'
  })
  @ValidateNested()
  @Type(() => SyncUpsertPropertyCurrencyDto)
  currency: SyncUpsertPropertyCurrencyDto

  @ApiPropertyOptional({
    example: 'GRAND HOTEL NY',
    description: 'Card descriptor for payment processing'
  })
  @IsString()
  @IsOptional()
  card_descriptor?: string

  @ApiProperty({
    example: 'portfolio-parent-123',
    description: 'External portfolio parent ID used to resolve portfolio_id'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_parent_id: string

  @ApiProperty({ example: true, description: 'Whether property is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean

  @ApiProperty({
    type: SyncUpsertPropertyCredentialsDto,
    description: 'OTA credentials for the property'
  })
  @ValidateNested()
  @Type(() => SyncUpsertPropertyCredentialsDto)
  credentials: SyncUpsertPropertyCredentialsDto

  /** @deprecated Accepted so existing DBMS payloads keep validating. Never stored, never read. */
  @ApiPropertyOptional({
    type: SyncUpsertProcessorsDto,
    deprecated: true,
    description: 'Deprecated. Accepted for backwards compatibility and ignored; the payout rail is now derived per reservation.'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncUpsertProcessorsDto)
  processors?: SyncUpsertProcessorsDto
}

export class SyncCreatePropertyDto {
  @ApiProperty()
  @IsString()
  name: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  portfolio_name?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sub_portfolio_name?: string | null

  @ApiPropertyOptional() @IsOptional() expedia_id?: number | string | null
  @ApiPropertyOptional() @IsOptional() booking_id?: number | string | null
  @ApiPropertyOptional() @IsOptional() agoda_id?: number | string | null

  @ApiPropertyOptional() @IsOptional() @IsString() expedia_status?:
    | string
    | null
  @ApiPropertyOptional() @IsOptional() @IsString() booking_status?:
    | string
    | null
  @ApiPropertyOptional() @IsOptional() @IsString() agoda_status?: string | null
}

export class SyncByOtaPropertyDto {
  @ApiPropertyOptional() @IsOptional() expedia_id?: number | string | null
  @ApiPropertyOptional() @IsOptional() booking_id?: number | string | null
  @ApiPropertyOptional() @IsOptional() agoda_id?: number | string | null

  @ApiProperty({ type: Object })
  @IsObject()
  data: Record<string, any>
}

export class SyncBulkCreatePropertyDto {
  @ApiProperty({ type: [SyncCreatePropertyDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCreatePropertyDto)
  items: SyncCreatePropertyDto[]
}
