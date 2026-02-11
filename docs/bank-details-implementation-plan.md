# Bank Details Update - Implementation Plan

## Overview

Update the bank details system to:

1. Use Expedia ID instead of Property MongoDB ID as unique identifier
2. Add new fields: contact_name, email_address, bank_address, comments
3. Detect bank sub-type from sheet headers (no bank_sub_type column in sheets)
4. Make beneficiary_address optional for Domestic Wire
5. Make currency optional for International Wire
6. Update all bank details APIs (create, update, bulk update, complete property APIs)
7. Handle case normalization for bank account type (Checking/Saving → checking/savings)

## Architecture Changes

### Database Schema Changes

**File: `prisma/schema.prisma`**

Add four new optional fields to `PropertyBankDetails` model:

```prisma
model PropertyBankDetails {
  // ... existing fields ...
  contact_name         String?  // NEW: Contact person name
  email_address        String?  // NEW: Contact email
  bank_address         String?  // NEW: Bank address for International Wire
  comments             String?  // NEW: Comments/notes about bank details
  // ... existing fields ...
}
```

After schema changes, run:
- `yarn push` to update MongoDB
- `yarn generate` to regenerate Prisma client

### Field Mapping Strategy

**Current vs New Identifier:**
- OLD: Property MongoDB ID (`property.id`)
- NEW: Expedia ID (`property.credentials.expedia_id`)

**Sheet Detection Logic:**
Identify bank sub-type by unique column presence:

```typescript
function detectBankSubType(headers: string[]): BankSubType {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
  
  // Check for SWIFT/BIC Code → International Wire
  if (normalizedHeaders.some(h => 
    h.includes('swift') || h.includes('bic') || h.includes('iban')
  )) {
    return BankSubType.international_wire
  }
  
  // Check for Bank Account Type → ACH
  if (normalizedHeaders.some(h => h.includes('bank account type'))) {
    return BankSubType.ach
  }
  
  // Default → Domestic Wire
  return BankSubType.domestic_wire
}
```

**Field Mappings:**

ACH Sheet:
- Expedia ID → Find property via `property.credentials.expedia_id`
- Hotel Or Portfolio Name → `hotel_portfolio_name`
- Pay To The Order Of → `beneficiary_name`
- Bank Name → `bank_name`
- Bank Routing Number → `routing_number`
- Bank Account Number → `account_number`
- Bank Account Type → `bank_account_type` (normalize: Checking/Saving → checking/savings)
- Contact Name → `contact_name` (NEW)
- Email Address → `email_address` (NEW)
- Comments → `comments` (NEW)

Domestic Wire Sheet:
- Expedia ID → Find property
- Hotel Or Portfolio Name → `hotel_portfolio_name`
- Pay To The Order Of → `beneficiary_name`
- Bank Name → `bank_name`
- Bank Routing Number → `routing_number`
- Bank Wiring Routing Number → Ignored
- Bank Account Number → `account_number`
- Bank Account Type → Ignored (not needed for Domestic Wire)
- Contact Name → `contact_name` (NEW)
- Email Address → `email_address` (NEW)
- Comments → `comments` (NEW)

International Wire Sheet:
- Expedia ID → Find property
- Hotel Or Portfolio Name → `hotel_portfolio_name`
- Beneficiary Name → `beneficiary_name`
- Beneficiary Address → `beneficiary_address` (OPTIONAL NOW)
- Bank Name → `bank_name`
- Bank Address → `bank_address` (NEW)
- IBAN or Account Number → `account_number`
- SWIFT/BIC Code → `swift_bic_iban`
- Contact Name → `contact_name` (NEW)
- Email Address → `email_address` (NEW)
- Comments → `comments` (NEW)
- Currency → `currency` (OPTIONAL NOW)

## Implementation Steps

### 1. Update Prisma Schema ✅ COMPLETED

Add new optional fields to PropertyBankDetails model:
- `contact_name String?`
- `email_address String?`
- `bank_address String?`
- `comments String?`

### 2. Update DTOs

**File: `src/modules/property-bank-details/property-bank-details.dto.ts`**

Add four new optional fields to `CreatePropertyBankDetailsDto` and `UpdatePropertyBankDetailsDto`:
- `contact_name?: string` with `@ApiPropertyOptional` decorator
- `email_address?: string` with `@ApiPropertyOptional` decorator  
- `bank_address?: string` with `@ApiPropertyOptional` decorator (for International Wire)
- `comments?: string` with `@ApiPropertyOptional` decorator

**File: `src/modules/property/property.dto.ts`**

Update `CompleteBankDetailsDto` (line 436) with same four new fields.

### 3. Update Repository

**File: `src/modules/property-bank-details/property-bank-details.repository.ts`**

In `create()` and `update()` methods: Add handling for new fields

```typescript
// In create and update methods
if (data.contact_name) {
  createData.contact_name = data.contact_name
}
if (data.email_address) {
  createData.email_address = data.email_address
}
if (data.bank_address) {
  createData.bank_address = data.bank_address
}
if (data.comments) {
  createData.comments = data.comments
}
```

### 4. Update Validation Logic

**File: `src/modules/property-bank-details/property-bank-details.service.ts`**

**In `validateAndNormalizeBankDetails()` method (line 42):**

1. Update validation for Domestic Wire (line 114-129):
   - REMOVE required validation for `beneficiary_address` (make it optional)
   - Keep beneficiary_name and routing_number as required

2. Update validation for International Wire (line 131-145):
   - REMOVE required validation for `currency` (make it optional)
   - REMOVE required validation for `beneficiary_address` (make it optional)
   - Keep beneficiary_name and swift_bic_iban as required

Updated required fields:

ACH:
- hotel_portfolio_name
- account_number
- bank_name
- beneficiary_name
- routing_number (min 9 digits)
- bank_account_type

Domestic Wire:
- hotel_portfolio_name
- account_number
- bank_name
- beneficiary_name
- routing_number (min 9 digits)

International Wire:
- hotel_portfolio_name
- account_number
- bank_name
- beneficiary_name
- swift_bic_iban

**In `bulkUpdate()` method (line 327):**

Major refactoring needed:

1. Add sheet type detection before processing rows
2. Add helper method to detect bank sub-type
3. Replace property lookup to use Expedia ID
4. Update field extraction to include new fields
5. Set bank_sub_type automatically
6. Handle Bank Account Type normalization
7. Add new fields to updateData
8. Update merged data validation

### 5. Update Complete Property APIs

**File: `src/modules/property/property.repository.ts`**

In `completeCreate()` and `completeUpdate()` methods, ensure new bank detail fields are passed through.

### 6. Update API Documentation

**File: `src/modules/property-bank-details/property-bank-details.controller.ts`**

Update `@ApiOperation` descriptions to mention new fields and Expedia ID usage.

### 7. Update Documentation

**File: `docs/bank-details-bulk-update-field-mapping.md`**

Major updates:
1. Change "Property ID" to "Expedia ID" throughout
2. Update field mappings to include contact_name, email_address, bank_address, comments
3. Update required fields sections to reflect relaxed validation
4. Update "Differentiating Factors" section with detection logic
5. Add note about Bank Account Type normalization

## Testing Considerations

After implementation, test:

1. **Schema Migration**: Verify new fields exist in PropertyBankDetails collection
2. **Create Bank Details API**: Test with new optional fields
3. **Update Bank Details API**: Test updating new fields
4. **Bulk Update with ACH sheet**: Verify detection and field mapping
5. **Bulk Update with Domestic Wire sheet**: Verify detection and optional beneficiary_address
6. **Bulk Update with International Wire sheet**: Verify detection and optional currency/beneficiary_address
7. **Expedia ID lookup**: Test property lookup by Expedia ID
8. **Bank Account Type normalization**: Test "Checking"/"Saving" → "checking"/"savings"
9. **Complete Property Create/Update**: Test with new bank detail fields

## Migration Notes

- Existing bank details records will have NULL values for new fields (contact_name, email_address, bank_address, comments)
- No data migration needed - fields are optional
- Properties must have credentials.expedia_id populated for bulk update to work
