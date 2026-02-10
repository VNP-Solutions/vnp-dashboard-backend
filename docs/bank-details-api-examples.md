# Bank Details API - Request & Response Examples

This document provides comprehensive request and response examples for all bank details API endpoints, including the latest changes with new fields and relaxed validation rules.

**Last Updated:** February 8, 2026

## Table of Contents
1. [Create Property Bank Details](#create-property-bank-details)
2. [Get Bank Details by Property ID](#get-bank-details-by-property-id)
3. [Update Bank Details](#update-bank-details)
4. [Bulk Update Bank Details](#bulk-update-bank-details)
5. [Complete Property Create](#complete-property-create)
6. [Complete Property Update](#complete-property-update)

---

## Create Property Bank Details

**Endpoint:** `POST /property-bank-details`  
**Permission Required:** `bank_details CREATE`

### New Fields (Added Feb 2026)
- `contact_name` (optional): Contact person name for bank account inquiries
- `email_address` (optional): Contact email address for bank account inquiries
- `bank_address` (optional): Bank physical address (typically for International Wire)
- `comments` (optional): Additional notes or comments about the bank account

### Relaxed Validation (Updated Feb 2026)
- `beneficiary_address`: Now optional for all bank sub-types
- `currency`: Now optional for all bank sub-types

### Example 1: ACH Bank Details

**Request:**
```json
{
  "property_id": "507f1f77bcf86cd799439015",
  "bank_type": "bank",
  "bank_sub_type": "ach",
  "hotel_portfolio_name": "Grand Hotel Portfolio",
  "beneficiary_name": "Grand Hotel LLC",
  "account_number": "1234567890",
  "bank_name": "Chase Bank",
  "routing_number": "021000021",
  "bank_account_type": "checking",
  "contact_name": "John Smith",
  "email_address": "john.smith@grandhotel.com",
  "comments": "Primary operating account"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bank details created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "bank_type": "bank",
    "bank_sub_type": "ach",
    "hotel_portfolio_name": "Grand Hotel Portfolio",
    "beneficiary_name": "Grand Hotel LLC",
    "account_number": "1234567890",
    "bank_name": "Chase Bank",
    "routing_number": "021000021",
    "bank_account_type": "checking",
    "contact_name": "John Smith",
    "email_address": "john.smith@grandhotel.com",
    "comments": "Primary operating account",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T10:30:00.000Z"
  }
}
```

### Example 2: Domestic Wire Bank Details

**Request:**
```json
{
  "property_id": "507f1f77bcf86cd799439015",
  "bank_type": "bank",
  "bank_sub_type": "domestic_wire",
  "hotel_portfolio_name": "Downtown Hotel",
  "beneficiary_name": "Downtown Hotel LLC",
  "beneficiary_address": "123 Main Street, New York, NY 10001",
  "account_number": "9876543210",
  "bank_name": "Bank of America",
  "routing_number": "026009593",
  "contact_name": "Jane Doe",
  "email_address": "jane.doe@downtownhotel.com",
  "bank_address": "100 Financial Center, New York, NY 10005",
  "comments": "Wire transfer account for large transactions"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bank details created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "bank_type": "bank",
    "bank_sub_type": "domestic_wire",
    "hotel_portfolio_name": "Downtown Hotel",
    "beneficiary_name": "Downtown Hotel LLC",
    "beneficiary_address": "123 Main Street, New York, NY 10001",
    "account_number": "9876543210",
    "bank_name": "Bank of America",
    "routing_number": "026009593",
    "contact_name": "Jane Doe",
    "email_address": "jane.doe@downtownhotel.com",
    "bank_address": "100 Financial Center, New York, NY 10005",
    "comments": "Wire transfer account for large transactions",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T10:30:00.000Z"
  }
}
```

### Example 3: International Wire Bank Details

**Request:**
```json
{
  "property_id": "507f1f77bcf86cd799439015",
  "bank_type": "bank",
  "bank_sub_type": "international_wire",
  "hotel_portfolio_name": "Global Resorts International",
  "beneficiary_name": "Global Resorts Ltd",
  "beneficiary_address": "456 Park Avenue, London, UK",
  "account_number": "GB29NWBK60161331926819",
  "bank_name": "HSBC Bank",
  "swift_bic_iban": "HSBCGB2LXXX",
  "currency": "GBP",
  "bank_address": "8 Canada Square, London E14 5HQ, UK",
  "contact_name": "Michael Brown",
  "email_address": "michael.brown@globalresorts.com",
  "comments": "International wire account for European bookings"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bank details created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "bank_type": "bank",
    "bank_sub_type": "international_wire",
    "hotel_portfolio_name": "Global Resorts International",
    "beneficiary_name": "Global Resorts Ltd",
    "beneficiary_address": "456 Park Avenue, London, UK",
    "account_number": "GB29NWBK60161331926819",
    "bank_name": "HSBC Bank",
    "swift_bic_iban": "HSBCGB2LXXX",
    "currency": "GBP",
    "bank_address": "8 Canada Square, London E14 5HQ, UK",
    "contact_name": "Michael Brown",
    "email_address": "michael.brown@globalresorts.com",
    "comments": "International wire account for European bookings",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T10:30:00.000Z"
  }
}
```

### Example 4: Stripe Payment Details

**Request:**
```json
{
  "property_id": "507f1f77bcf86cd799439015",
  "bank_type": "stripe",
  "stripe_account_email": "payments@hotel.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bank details created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439014",
    "bank_type": "stripe",
    "stripe_account_email": "payments@hotel.com",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T10:30:00.000Z"
  }
}
```

---

## Get Bank Details by Property ID

**Endpoint:** `GET /property-bank-details/property/:propertyId`  
**Permission Required:** `bank_details READ`

### Example Request

**URL:** `GET /property-bank-details/property/507f1f77bcf86cd799439015`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bank details retrieved successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "bank_type": "bank",
    "bank_sub_type": "international_wire",
    "hotel_portfolio_name": "Luxury Hotels International",
    "beneficiary_name": "Luxury Hotels LLC",
    "beneficiary_address": "456 Park Avenue, New York, NY 10022",
    "account_number": "9876543210",
    "bank_name": "Bank of America",
    "swift_bic_iban": "BOFAUS3NXXX",
    "currency": "USD",
    "bank_address": "100 Financial Center, New York, NY 10005",
    "contact_name": "Jane Doe",
    "email_address": "jane.doe@luxuryhotels.com",
    "comments": "International wire account for Europe bookings",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T10:30:00.000Z"
  }
}
```

---

## Update Bank Details

**Endpoint:** `PATCH /property-bank-details/property/:propertyId`  
**Permission Required:** `bank_details UPDATE`

### Example 1: Update Contact Information Only

**Request:**
```json
{
  "contact_name": "Sarah Williams",
  "email_address": "sarah.williams@grandhotel.com",
  "comments": "Updated contact person - Sarah is now the primary accounting contact"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bank details updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "bank_type": "bank",
    "bank_sub_type": "ach",
    "hotel_portfolio_name": "Grand Hotel Portfolio",
    "beneficiary_name": "Grand Hotel LLC",
    "account_number": "1234567890",
    "bank_name": "Chase Bank",
    "routing_number": "021000021",
    "bank_account_type": "checking",
    "contact_name": "Sarah Williams",
    "email_address": "sarah.williams@grandhotel.com",
    "comments": "Updated contact person - Sarah is now the primary accounting contact",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T15:45:00.000Z"
  }
}
```

### Example 2: Update Bank Account Details

**Request:**
```json
{
  "bank_name": "Wells Fargo",
  "routing_number": "121000248",
  "account_number": "9876543210",
  "beneficiary_name": "Grand Hotel Operations LLC",
  "comments": "Changed to new bank effective March 2026"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bank details updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "bank_type": "bank",
    "bank_sub_type": "ach",
    "hotel_portfolio_name": "Grand Hotel Portfolio",
    "beneficiary_name": "Grand Hotel Operations LLC",
    "account_number": "9876543210",
    "bank_name": "Wells Fargo",
    "routing_number": "121000248",
    "bank_account_type": "checking",
    "contact_name": "Sarah Williams",
    "email_address": "sarah.williams@grandhotel.com",
    "comments": "Changed to new bank effective March 2026",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T16:20:00.000Z"
  }
}
```

### Example 3: Change Bank Sub-Type (ACH to Domestic Wire)

**Request:**
```json
{
  "bank_sub_type": "domestic_wire",
  "beneficiary_address": "789 Business Blvd, Chicago, IL 60601",
  "bank_account_type": null,
  "comments": "Switching to domestic wire for faster processing"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bank details updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "bank_type": "bank",
    "bank_sub_type": "domestic_wire",
    "hotel_portfolio_name": "Grand Hotel Portfolio",
    "beneficiary_name": "Grand Hotel Operations LLC",
    "beneficiary_address": "789 Business Blvd, Chicago, IL 60601",
    "account_number": "9876543210",
    "bank_name": "Wells Fargo",
    "routing_number": "121000248",
    "contact_name": "Sarah Williams",
    "email_address": "sarah.williams@grandhotel.com",
    "comments": "Switching to domestic wire for faster processing",
    "associated_user_id": "507f1f77bcf86cd799439020",
    "property_id": "507f1f77bcf86cd799439015",
    "created_at": "2026-02-08T10:30:00.000Z",
    "updated_at": "2026-02-08T17:10:00.000Z"
  }
}
```

---

## Bulk Update Bank Details

**Endpoint:** `POST /property-bank-details/bulk-update`  
**Permission Required:** `bank_details UPDATE` + Password Verification

### Key Changes (Updated Feb 2026)
- **Property Identifier:** Now uses **Expedia ID** instead of Property Name
- **Bank Sub-type Detection:** Auto-detected from sheet columns (no longer needs explicit column)
- **New Optional Fields:** Contact Name, Email Address, Bank Address, Comments
- **Relaxed Validation:** beneficiary_address and currency are now optional
- **Bank Account Type:** Accepts "Checking" or "Saving" (case insensitive) and normalizes to "checking" or "savings"

### Detection Logic
The system automatically detects the bank sub-type based on column headers:
- If sheet contains `SWIFT/BIC Code` or `IBAN` columns → **International Wire**
- If sheet contains `Bank Wiring Routing Number` column → **Domestic Wire**
- If sheet contains `Bank Account Type` column (without `Bank Wiring Routing Number`) → **ACH**
- Otherwise → **Domestic Wire** (default)

**Important:** Both ACH and Domestic Wire sheets may have `Bank Account Type`. The key differentiator is the presence of `Bank Wiring Routing Number` for Domestic Wire.

### Example Request

**Multipart Form Data:**
- `file`: Excel file (.xlsx or .xls)
- `password`: User password for verification

**Excel Sheet Example (ACH):**

| Expedia ID | Hotel Or Portfolio Name | Pay To The Order Of | Bank Name | Bank Routing Number | Bank Account Number | Bank Account Type | Contact Name | Email Address | Comments |
|------------|------------------------|---------------------|-----------|--------------------|--------------------|------------------|--------------|---------------|----------|
| EXP234567 | Grand Plaza Hotel | Grand Plaza LLC | Chase Bank | 021000021 | 1234567890 | Checking | John Smith | john@hotel.com | Primary account |
| EXP345678 | Royal Suites | Royal Suites Inc | Wells Fargo | 121000248 | 9876543210 | Saving | Jane Doe | jane@royal.com | Operating account |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bulk update completed. Processed 10 rows: 8 successful, 2 failed. Email notifications sent to users with property access.",
  "data": {
    "totalRows": 10,
    "successCount": 8,
    "failureCount": 2,
    "errors": [
      {
        "row": 3,
        "property": "EXP123456",
        "error": "Property not found for Expedia ID: EXP123456"
      },
      {
        "row": 7,
        "property": "EXP789012",
        "error": "Missing required fields for ach: Bank Account Type"
      }
    ],
    "successfulUpdates": [
      "EXP234567",
      "EXP345678",
      "EXP456789",
      "EXP567890",
      "EXP678901",
      "EXP789013",
      "EXP890123",
      "EXP901234"
    ]
  }
}
```

### Excel Sheet Examples by Bank Sub-Type

#### ACH Sheet
**Required Columns:** Expedia ID, Hotel Or Portfolio Name, Pay To The Order Of, Bank Name, Bank Routing Number, Bank Account Number, Bank Account Type  
**Optional Columns:** Contact Name, Email Address, Comments

| Expedia ID* | Hotel Or Portfolio Name* | Pay To The Order Of* | Bank Name* | Bank Routing Number* | Bank Account Number* | Bank Account Type* | Contact Name | Email Address | Comments |
|-------------|-------------------------|---------------------|------------|---------------------|---------------------|------------------|--------------|---------------|----------|
| EXP123456 | Grand Hotel | Grand Hotel LLC | Chase | 021000021 | 1234567890 | Checking | John Smith | john@hotel.com | Main account |

#### Domestic Wire Sheet
**Required Columns:** Expedia ID, Hotel Or Portfolio Name, Pay To The Order Of, Bank Name, Bank Routing Number, Bank Account Number  
**Optional Columns:** Bank Wiring Routing Number, Bank Account Type, Contact Name, Email Address, Comments  
**Note:** Bank Account Type is present but ignored for Domestic Wire (only used for ACH)

| Expedia ID* | Hotel Or Portfolio Name* | Pay To The Order Of* | Bank Name* | Bank Routing Number* | Bank Wiring Routing Number | Bank Account Number* | Bank Account Type | Contact Name | Email Address | Comments |
|-------------|-------------------------|---------------------|------------|---------------------|---------------------------|---------------------|------------------|--------------|---------------|----------|
| EXP234567 | Plaza Hotel | Plaza LLC | Wells Fargo | 121000248 | 121000248 | 9876543210 | Checking | Jane Doe | jane@plaza.com | Wire account |

#### International Wire Sheet
**Required Columns:** Expedia ID, Hotel Or Portfolio Name, Beneficiary Name, Bank Name, IBAN or Account Number, SWIFT/BIC Code  
**Optional Columns:** Beneficiary Address, Bank Address, Currency, Contact Name, Email Address, Comments

| Expedia ID* | Hotel Or Portfolio Name* | Beneficiary Name* | Beneficiary Address | Bank Name* | Bank Address | IBAN or Account Number* | SWIFT/BIC Code* | Contact Name | Email Address | Comments |
|-------------|-------------------------|------------------|---------------------|------------|--------------|------------------------|----------------|--------------|---------------|----------|
| EXP345678 | Royal Hotel | Royal Ltd | 456 Park Ave, London | HSBC | 8 Canada Sq, London | GB29NWBK60161331926819 | HSBCGB2LXXX | Michael | michael@royal.com | EU bookings |

---

## Complete Property Create

**Endpoint:** `POST /property/complete-create`  
**Permission Required:** `property UPDATE` (Internal users only)

### Example 1: Property with ACH Bank Details

**Request:**
```json
{
  "property": {
    "name": "Grand Plaza Hotel",
    "address": "123 Main Street, New York, NY 10001",
    "currency_id": "507f1f77bcf86cd799439020",
    "card_descriptor": "GRAND PLAZA NY",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439012"
  },
  "credentials": {
    "expedia": {
      "expedia_id": "EXP123456",
      "username": "grandplaza@expedia.com",
      "password": "ExpediaPass123!"
    }
  },
  "bank_details": {
    "bank_type": "bank",
    "bank_sub_type": "ach",
    "hotel_portfolio_name": "Grand Plaza Hotel",
    "beneficiary_name": "Grand Plaza LLC",
    "account_number": "1234567890",
    "bank_name": "Chase Bank",
    "routing_number": "021000021",
    "bank_account_type": "checking",
    "contact_name": "John Smith",
    "email_address": "accounting@grandplaza.com",
    "comments": "Primary operating account"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Property created successfully with credentials and bank details",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "name": "Grand Plaza Hotel",
    "address": "123 Main Street, New York, NY 10001",
    "currency_id": "507f1f77bcf86cd799439020",
    "card_descriptor": "GRAND PLAZA NY",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439012",
    "created_at": "2026-02-08T10:00:00.000Z",
    "updated_at": "2026-02-08T10:00:00.000Z",
    "credentials": {
      "id": "507f1f77bcf86cd799439031",
      "expedia_id": "EXP123456",
      "property_id": "507f1f77bcf86cd799439030"
    },
    "bank_details": {
      "id": "507f1f77bcf86cd799439032",
      "bank_type": "bank",
      "bank_sub_type": "ach",
      "hotel_portfolio_name": "Grand Plaza Hotel",
      "beneficiary_name": "Grand Plaza LLC",
      "account_number": "1234567890",
      "bank_name": "Chase Bank",
      "routing_number": "021000021",
      "bank_account_type": "checking",
      "contact_name": "John Smith",
      "email_address": "accounting@grandplaza.com",
      "comments": "Primary operating account",
      "property_id": "507f1f77bcf86cd799439030"
    }
  }
}
```

### Example 2: Property with International Wire

**Request:**
```json
{
  "property": {
    "name": "Royal Suites London",
    "address": "456 Park Lane, London, UK",
    "currency_id": "507f1f77bcf86cd799439021",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439013"
  },
  "credentials": {
    "expedia": {
      "expedia_id": "EXP789012",
      "username": "royalsuites@expedia.com",
      "password": "ExpediaPass456!"
    },
    "booking": {
      "hotel_id": "BKG456789",
      "username": "royal@booking.com",
      "password": "BookingPass123!"
    }
  },
  "bank_details": {
    "bank_type": "bank",
    "bank_sub_type": "international_wire",
    "hotel_portfolio_name": "Royal Suites International",
    "beneficiary_name": "Royal Suites Ltd",
    "beneficiary_address": "456 Park Lane, London W1K 1PS, UK",
    "account_number": "GB29NWBK60161331926819",
    "bank_name": "HSBC Bank",
    "swift_bic_iban": "HSBCGB2LXXX",
    "currency": "GBP",
    "bank_address": "8 Canada Square, London E14 5HQ, UK",
    "contact_name": "Sarah Williams",
    "email_address": "finance@royalsuites.co.uk",
    "comments": "For European bookings and payments"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Property created successfully with credentials and bank details",
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "name": "Royal Suites London",
    "address": "456 Park Lane, London, UK",
    "currency_id": "507f1f77bcf86cd799439021",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439013",
    "created_at": "2026-02-08T11:00:00.000Z",
    "updated_at": "2026-02-08T11:00:00.000Z",
    "credentials": {
      "id": "507f1f77bcf86cd799439041",
      "expedia_id": "EXP789012",
      "booking_id": "BKG456789",
      "property_id": "507f1f77bcf86cd799439040"
    },
    "bank_details": {
      "id": "507f1f77bcf86cd799439042",
      "bank_type": "bank",
      "bank_sub_type": "international_wire",
      "hotel_portfolio_name": "Royal Suites International",
      "beneficiary_name": "Royal Suites Ltd",
      "beneficiary_address": "456 Park Lane, London W1K 1PS, UK",
      "account_number": "GB29NWBK60161331926819",
      "bank_name": "HSBC Bank",
      "swift_bic_iban": "HSBCGB2LXXX",
      "currency": "GBP",
      "bank_address": "8 Canada Square, London E14 5HQ, UK",
      "contact_name": "Sarah Williams",
      "email_address": "finance@royalsuites.co.uk",
      "comments": "For European bookings and payments",
      "property_id": "507f1f77bcf86cd799439040"
    }
  }
}
```

---

## Complete Property Update

**Endpoint:** `PATCH /property/:id/complete-update`  
**Permission Required:** `property UPDATE` (Property owner only)

### Example 1: Update Bank Details Only

**Request:**
```json
{
  "bank_details": {
    "contact_name": "Jane Doe",
    "email_address": "jane.doe@hotel.com",
    "comments": "Updated contact person - Jane is now handling all bank inquiries"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Property updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "name": "Grand Plaza Hotel",
    "address": "123 Main Street, New York, NY 10001",
    "currency_id": "507f1f77bcf86cd799439020",
    "card_descriptor": "GRAND PLAZA NY",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439012",
    "created_at": "2026-02-08T10:00:00.000Z",
    "updated_at": "2026-02-08T14:30:00.000Z",
    "credentials": {
      "id": "507f1f77bcf86cd799439031",
      "expedia_id": "EXP123456",
      "property_id": "507f1f77bcf86cd799439030"
    },
    "bank_details": {
      "id": "507f1f77bcf86cd799439032",
      "bank_type": "bank",
      "bank_sub_type": "ach",
      "hotel_portfolio_name": "Grand Plaza Hotel",
      "beneficiary_name": "Grand Plaza LLC",
      "account_number": "1234567890",
      "bank_name": "Chase Bank",
      "routing_number": "021000021",
      "bank_account_type": "checking",
      "contact_name": "Jane Doe",
      "email_address": "jane.doe@hotel.com",
      "comments": "Updated contact person - Jane is now handling all bank inquiries",
      "property_id": "507f1f77bcf86cd799439030"
    }
  }
}
```

### Example 2: Update Property, Credentials, and Bank Details

**Request:**
```json
{
  "property": {
    "name": "Grand Plaza Hotel & Suites",
    "address": "123 Main Street, Suite 100, New York, NY 10001",
    "card_descriptor": "GRAND PLAZA SUITES"
  },
  "credentials": {
    "expedia": {
      "expedia_id": "EXP123456",
      "username": "grandplaza.new@expedia.com",
      "password": "NewExpediaPass123!"
    },
    "agoda": {
      "hotel_id": "AGD789012",
      "username": "grandplaza@agoda.com",
      "password": "AgodaPass456!"
    }
  },
  "bank_details": {
    "bank_sub_type": "domestic_wire",
    "bank_name": "Wells Fargo",
    "routing_number": "121000248",
    "account_number": "9876543210",
    "beneficiary_name": "Grand Plaza Operations LLC",
    "beneficiary_address": "123 Main Street, New York, NY 10001",
    "contact_name": "Michael Johnson",
    "email_address": "michael.j@grandplaza.com",
    "bank_address": "420 Montgomery Street, San Francisco, CA 94104",
    "comments": "Switched to Wells Fargo effective March 2026"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Property updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "name": "Grand Plaza Hotel & Suites",
    "address": "123 Main Street, Suite 100, New York, NY 10001",
    "currency_id": "507f1f77bcf86cd799439020",
    "card_descriptor": "GRAND PLAZA SUITES",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439012",
    "created_at": "2026-02-08T10:00:00.000Z",
    "updated_at": "2026-02-08T15:30:00.000Z",
    "credentials": {
      "id": "507f1f77bcf86cd799439031",
      "expedia_id": "EXP123456",
      "agoda_id": "AGD789012",
      "property_id": "507f1f77bcf86cd799439030"
    },
    "bank_details": {
      "id": "507f1f77bcf86cd799439032",
      "bank_type": "bank",
      "bank_sub_type": "domestic_wire",
      "hotel_portfolio_name": "Grand Plaza Hotel",
      "beneficiary_name": "Grand Plaza Operations LLC",
      "beneficiary_address": "123 Main Street, New York, NY 10001",
      "account_number": "9876543210",
      "bank_name": "Wells Fargo",
      "routing_number": "121000248",
      "contact_name": "Michael Johnson",
      "email_address": "michael.j@grandplaza.com",
      "bank_address": "420 Montgomery Street, San Francisco, CA 94104",
      "comments": "Switched to Wells Fargo effective March 2026",
      "property_id": "507f1f77bcf86cd799439030"
    }
  }
}
```

### Example 3: Change Bank Sub-Type

**Request:**
```json
{
  "bank_details": {
    "bank_sub_type": "international_wire",
    "swift_bic_iban": "CHASUS33XXX",
    "currency": "USD",
    "bank_address": "270 Park Avenue, New York, NY 10017",
    "routing_number": null,
    "bank_account_type": null,
    "comments": "Switching to international wire for better global coverage"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Property updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "name": "Grand Plaza Hotel & Suites",
    "address": "123 Main Street, Suite 100, New York, NY 10001",
    "currency_id": "507f1f77bcf86cd799439020",
    "card_descriptor": "GRAND PLAZA SUITES",
    "is_active": true,
    "portfolio_id": "507f1f77bcf86cd799439012",
    "created_at": "2026-02-08T10:00:00.000Z",
    "updated_at": "2026-02-08T16:45:00.000Z",
    "credentials": {
      "id": "507f1f77bcf86cd799439031",
      "expedia_id": "EXP123456",
      "agoda_id": "AGD789012",
      "property_id": "507f1f77bcf86cd799439030"
    },
    "bank_details": {
      "id": "507f1f77bcf86cd799439032",
      "bank_type": "bank",
      "bank_sub_type": "international_wire",
      "hotel_portfolio_name": "Grand Plaza Hotel",
      "beneficiary_name": "Grand Plaza Operations LLC",
      "beneficiary_address": "123 Main Street, New York, NY 10001",
      "account_number": "9876543210",
      "bank_name": "Wells Fargo",
      "swift_bic_iban": "CHASUS33XXX",
      "currency": "USD",
      "bank_address": "270 Park Avenue, New York, NY 10017",
      "contact_name": "Michael Johnson",
      "email_address": "michael.j@grandplaza.com",
      "comments": "Switching to international wire for better global coverage",
      "property_id": "507f1f77bcf86cd799439030"
    }
  }
}
```

---

## Common Error Responses

### 400 Bad Request - Missing Required Fields
```json
{
  "success": false,
  "message": "Validation failed",
  "error": [
    "Missing required fields for ach: Bank Account Type",
    "Missing required fields for ach: Routing Number"
  ]
}
```

### 400 Bad Request - Invalid Password (Bulk Update)
```json
{
  "success": false,
  "message": "Invalid password",
  "error": ["The password you provided is incorrect"]
}
```

### 403 Forbidden - Insufficient Permissions
```json
{
  "success": false,
  "message": "Forbidden",
  "error": ["You do not have permission to perform this action"]
}
```

### 404 Not Found - Property Not Found
```json
{
  "success": false,
  "message": "Not Found",
  "error": ["Property not found for Expedia ID: EXP123456"]
}
```

### 409 Conflict - Bank Details Already Exist
```json
{
  "success": false,
  "message": "Conflict",
  "error": ["Bank details already exist for this property"]
}
```

---

## Notes

1. **All timestamps** are in ISO 8601 format (UTC)
2. **Password Verification** is required for bulk update operations
3. **Email Notifications** are sent to all users with access to affected properties after bulk updates
4. **Bank Account Type Normalization**: "Checking" or "Saving" (case insensitive) are normalized to "checking" or "savings"
5. **Property Identification**: Bulk updates now use **Expedia ID** instead of Property Name
6. **Auto-Detection**: Bank sub-type is automatically detected from Excel sheet columns
7. **New Optional Fields**: contact_name, email_address, bank_address, comments (added Feb 2026)
8. **Relaxed Validation**: beneficiary_address and currency are now optional for all sub-types (updated Feb 2026)
