# Bank Details Bulk Update - Field Mapping Guide

This document maps the client-provided Excel fields for bulk updating property bank details across three different bank sub-types: ACH, Domestic Wire, and International Wire.

---

## 🔵 ACH Sheet Mapping

| Client Field | System Field | Status |
|-------------|--------------|--------|
| Property ID* | `property_id` | 🔍 Identifier |
| Hotel Or Portfolio Name* | `hotel_portfolio_name` | ✅ **REQUIRED** |
| Pay To The Order Of* | `beneficiary_name` | ✅ **REQUIRED** |
| Bank Name* | `bank_name` | ✅ **REQUIRED** |
| Bank Routing Number* | `routing_number` | ✅ **REQUIRED** (min 9 digits) |
| Bank Account Number* | `account_number` | ✅ **REQUIRED** |
| Bank Account Type* | `bank_account_type` | ✅ **REQUIRED** (checking/savings) |
| Contact Name* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Email Address* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Comments | ❌ Not in system | ⚠️ Extra field - will be ignored |

**✅ Status: ALL REQUIRED FIELDS PRESENT**

---

## 🟡 Domestic Wire Sheet Mapping

| Client Field | System Field | Status |
|-------------|--------------|--------|
| Property ID* | `property_id` | 🔍 Identifier |
| Hotel Or Portfolio Name* | `hotel_portfolio_name` | ✅ **REQUIRED** |
| Pay To The Order Of* | `beneficiary_name` | ✅ **REQUIRED** |
| Bank Name* | `bank_name` | ✅ **REQUIRED** |
| Bank Routing Number* | `routing_number` | ✅ **REQUIRED** (min 9 digits) |
| Bank Wiring Routing Number | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Bank Account Number* | `account_number` | ✅ **REQUIRED** |
| Bank Account Type* | `bank_account_type` | ⚠️ **NOT REQUIRED** (only for ACH) |
| Contact Name* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Email Address* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Comments | ❌ Not in system | ⚠️ Extra field - will be ignored |
| **❌ MISSING** | **`beneficiary_address`** | **❌ REQUIRED - NOT PROVIDED!** |

**❌ Status: MISSING REQUIRED FIELD `beneficiary_address`**

---

## 🟢 International Wire Sheet Mapping

| Client Field | System Field | Status |
|-------------|--------------|--------|
| Property ID* | `property_id` | 🔍 Identifier |
| Hotel Or Portfolio Name* | `hotel_portfolio_name` | ✅ **REQUIRED** |
| Beneficiary Name* | `beneficiary_name` | ✅ **REQUIRED** |
| Beneficiary Address* | `beneficiary_address` | ✅ **REQUIRED** |
| Bank Name* | `bank_name` | ✅ **REQUIRED** |
| Bank Address* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| IBAN or Account Number* | `account_number` | ✅ **REQUIRED** |
| SWIFT/BIC Code* | `swift_bic_iban` | ✅ **REQUIRED** |
| Contact Name* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Email Address* | ❌ Not in system | ⚠️ Extra field - will be ignored |
| Comments | ❌ Not in system | ⚠️ Extra field - will be ignored |
| **❌ MISSING** | **`currency`** | **❌ REQUIRED - NOT PROVIDED!** |

**❌ Status: MISSING REQUIRED FIELD `currency`**

---

## 🎯 Differentiating Factors Between Sheets

Since the client is **NOT providing bank_sub_type** in the sheets, the system can differentiate based on these **unique fields**:

| Unique Field | Indicates Type |
|-------------|----------------|
| **`Bank Account Type`** present | → **ACH** |
| **`SWIFT/BIC Code`** or **`IBAN`** present | → **International Wire** |
| **`Beneficiary Address`** present + NO SWIFT/IBAN | → **Domestic Wire** |
| **`Bank Wiring Routing Number`** present | → **Domestic Wire** |

### Recommended Detection Logic:

```
1. If sheet has "SWIFT/BIC Code" → International Wire
2. Else if sheet has "Bank Account Type" → ACH  
3. Else if sheet has "Beneficiary Address" or "Bank Wiring Routing Number" → Domestic Wire
```

---

## 🚨 Required Changes from Client

### ❌ Domestic Wire Sheet

**ADD:** `Beneficiary Address*` (mandatory field)

### ❌ International Wire Sheet

**ADD:** `Currency*` (mandatory field - e.g., USD, EUR, GBP)

### ⚠️ Domestic Wire Sheet

**REMOVE:** `Bank Account Type*` (not required for Domestic Wire, only for ACH)

---

## System Validation Rules

### ACH Required Fields (6 total)
1. `hotel_portfolio_name`
2. `account_number`
3. `bank_name`
4. `beneficiary_name`
5. `routing_number` (minimum 9 digits)
6. `bank_account_type` (checking or savings)

### Domestic Wire Required Fields (6 total)
1. `hotel_portfolio_name`
2. `account_number`
3. `bank_name`
4. `beneficiary_name`
5. `beneficiary_address`
6. `routing_number` (minimum 9 digits)

### International Wire Required Fields (6 total)
1. `hotel_portfolio_name`
2. `account_number`
3. `bank_name`
4. `beneficiary_name`
5. `beneficiary_address`
6. `swift_bic_iban`
7. `currency`

---

## Notes

- Fields marked with `*` in the client sheets indicate they consider them required
- `Contact Name`, `Email Address`, and `Comments` are extra fields that will be ignored by the system
- The system uses the `associated_user_id` field automatically from the authenticated user
- All updates require proper permission checks via `bank_details_permission`
