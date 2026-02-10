# Bank Details Bulk Update - Field Mapping Guide

This document maps the client-provided Excel fields for bulk updating property bank details across three different bank sub-types: ACH, Domestic Wire, and International Wire.

---

## Overview

- Properties are identified by **Expedia ID** (not Property Name)
- Bank sub-type is **auto-detected** from sheet columns (no Bank Sub Type column needed)
- Three separate sheets for three sub-types
- Bank Account Type accepts: Checking, Saving, checking, savings

## Detection Logic

The system auto-detects bank sub-type based on column presence:

1. **If sheet has SWIFT/BIC/IBAN columns** → International Wire
2. **Else if sheet has Bank Account Type column** → ACH  
3. **Otherwise** → Domestic Wire

---

## 🔵 ACH Sheet Mapping

| Client Field | System Field | Status |
|-------------|--------------|--------|
| Expedia ID* | Find property via `credentials.expedia_id` | 🔍 Identifier |
| Hotel Or Portfolio Name* | `hotel_portfolio_name` | ✅ **REQUIRED** |
| Pay To The Order Of* | `beneficiary_name` | ✅ **REQUIRED** |
| Bank Name* | `bank_name` | ✅ **REQUIRED** |
| Bank Routing Number* | `routing_number` | ✅ **REQUIRED** (min 9 digits) |
| Bank Account Number* | `account_number` | ✅ **REQUIRED** |
| Bank Account Type* | `bank_account_type` | ✅ **REQUIRED** (Checking/Saving accepted) |
| Contact Name* | `contact_name` | ✅ Optional |
| Email Address* | `email_address` | ✅ Optional |
| Comments | `comments` | ✅ Optional |

**✅ Status: ALL SYSTEM REQUIREMENTS MET**

**Required Fields for ACH:**
- hotel_portfolio_name
- beneficiary_name
- bank_name
- routing_number (minimum 9 digits)
- account_number
- bank_account_type

---

## 🟡 Domestic Wire Sheet Mapping

| Client Field | System Field | Status |
|-------------|--------------|--------|
| Expedia ID* | Find property via `credentials.expedia_id` | 🔍 Identifier |
| Hotel Or Portfolio Name* | `hotel_portfolio_name` | ✅ **REQUIRED** |
| Pay To The Order Of* | `beneficiary_name` | ✅ **REQUIRED** |
| Bank Name* | `bank_name` | ✅ **REQUIRED** |
| Bank Routing Number* | `routing_number` | ✅ **REQUIRED** (min 9 digits) |
| Bank Wiring Routing Number | Not stored | ⚠️ Ignored |
| Bank Account Number* | `account_number` | ✅ **REQUIRED** |
| Bank Account Type* | Not needed | ⚠️ Ignored (only for ACH) |
| Contact Name* | `contact_name` | ✅ Optional |
| Email Address* | `email_address` | ✅ Optional |
| Comments | `comments` | ✅ Optional |

**✅ Status: ALL SYSTEM REQUIREMENTS MET**

**Required Fields for Domestic Wire:**
- hotel_portfolio_name
- beneficiary_name
- bank_name
- routing_number (minimum 9 digits)
- account_number

**Optional Fields:**
- beneficiary_address (now optional)

---

## 🟢 International Wire Sheet Mapping

| Client Field | System Field | Status |
|-------------|--------------|--------|
| Expedia ID* | Find property via `credentials.expedia_id` | 🔍 Identifier |
| Hotel Or Portfolio Name* | `hotel_portfolio_name` | ✅ **REQUIRED** |
| Beneficiary Name* | `beneficiary_name` | ✅ **REQUIRED** |
| Beneficiary Address* | `beneficiary_address` | ✅ Optional |
| Bank Name* | `bank_name` | ✅ **REQUIRED** |
| Bank Address* | `bank_address` | ✅ Optional |
| IBAN or Account Number* | `account_number` | ✅ **REQUIRED** |
| SWIFT/BIC Code* | `swift_bic_iban` | ✅ **REQUIRED** |
| Contact Name* | `contact_name` | ✅ Optional |
| Email Address* | `email_address` | ✅ Optional |
| Comments | `comments` | ✅ Optional |

**✅ Status: ALL SYSTEM REQUIREMENTS MET**

**Required Fields for International Wire:**
- hotel_portfolio_name
- beneficiary_name
- bank_name
- account_number
- swift_bic_iban

**Optional Fields:**
- beneficiary_address (now optional)
- currency (now optional)
- bank_address (new field)

---

## 🎯 Sheet Differentiation

Since **bank_sub_type is NOT in the sheets**, the system differentiates based on unique column presence:

| Detection Rule | Indicates Type |
|----------------|----------------|
| Has **SWIFT/BIC Code** or **IBAN** columns | → **International Wire** |
| Has **Bank Account Type** column | → **ACH** |
| Otherwise (has routing number but no SWIFT/Account Type) | → **Domestic Wire** |

### Detection Algorithm

```typescript
1. Check headers for "swift", "bic", or "iban" → International Wire
2. Else check for "bank account type" → ACH  
3. Else → Domestic Wire (default)
```

---

## 📝 Important Notes

### Bank Account Type Normalization

The system accepts both formats and normalizes them:
- **"Checking"** or **"checking"** → `checking`
- **"Saving"** or **"savings"** → `savings`

### Property Identification

- **OLD**: Used Property Name (MongoDB ID lookup)
- **NEW**: Uses Expedia ID (from `property.credentials.expedia_id`)
- Properties **must have** `credentials.expedia_id` populated for bulk update to work

### New Optional Fields

Four new fields have been added:
- `contact_name` - Contact person name
- `email_address` - Contact email
- `bank_address` - Bank physical address (useful for International Wire)
- `comments` - Notes/comments about the bank account

### Relaxed Validation

The following fields are now **OPTIONAL** (previously required):
- **Domestic Wire**: `beneficiary_address` 
- **International Wire**: `beneficiary_address`, `currency`

---

## System Validation Rules

### ACH Required Fields (6 total)
1. hotel_portfolio_name
2. account_number
3. bank_name
4. beneficiary_name
5. routing_number (minimum 9 digits)
6. bank_account_type (checking or savings)

### Domestic Wire Required Fields (5 total)
1. hotel_portfolio_name
2. account_number
3. bank_name
4. beneficiary_name
5. routing_number (minimum 9 digits)

### International Wire Required Fields (5 total)
1. hotel_portfolio_name
2. account_number
3. bank_name
4. beneficiary_name
5. swift_bic_iban

---

## Migration Notes

- Existing bank details records will have NULL values for new fields (contact_name, email_address, bank_address, comments)
- No data migration needed - all new fields are optional
- Properties must have credentials.expedia_id populated for bulk update to work
