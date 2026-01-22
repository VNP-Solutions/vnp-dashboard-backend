# Timezone Fix Summary

## Problem
All date values created or imported in the system were showing different dates when opened in different countries due to timezone inconsistencies. Dates were being stored and retrieved without proper timezone normalization.

## Root Cause
1. Dates sent from the frontend were being interpreted in the server's local timezone
2. Dates from Excel imports (mm/dd/yyyy format and Excel serial dates) were created in local timezone
3. API responses returned Date objects without explicit UTC formatting, causing clients to interpret them differently based on their local timezone

## Solution Overview
Implemented a comprehensive timezone normalization strategy:
1. **Incoming dates**: Normalize all incoming date strings to UTC before storing
2. **Outgoing dates**: Serialize all Date objects to ISO 8601 UTC format in API responses
3. **Bulk imports**: Fix date parsing in Excel import functions to use UTC

## Files Modified

### 1. New Files Created

#### `src/common/utils/date.util.ts`
- Utility functions for date/timezone normalization
- `normalizeToUTC()`: Converts date strings to UTC Date objects
- `normalizeDateTransform()`: Class-transformer transformer for DTOs
- `toISOStringUTC()`: Converts Date to ISO string with UTC timezone
- Helper functions for date validation and UTC operations

#### `src/common/interceptors/date-serialization.interceptor.ts`
- Global interceptor that automatically converts all Date objects in API responses to ISO 8601 UTC strings
- Recursively processes nested objects and arrays
- Ensures consistent date formatting regardless of client timezone

### 2. Modified Files

#### `src/main.ts`
- Added global `DateSerializationInterceptor` to ensure all API responses return dates in UTC format
- Import and apply the interceptor after validation pipes

#### `src/modules/audit/audit.dto.ts`
- Updated `start_date` and `end_date` fields in `CreateAuditDto`:
  - Changed type from `string` to `Date`
  - Added `@Transform(({ value }) => normalizeDateTransform(value))` decorator
- Imported `normalizeDateTransform` from date utility

#### `src/modules/property/property.dto.ts`
- Updated `next_due_date` field in `CreatePropertyDto`:
  - Changed type from `string` to `Date`
  - Added `@Transform(({ value }) => normalizeDateTransform(value))` decorator
- Added `Transform` to imports from `class-transformer`
- Imported `normalizeDateTransform` from date utility

#### `src/modules/task/task.dto.ts`
- Updated `due_date` field in `CreateTaskDto` and `TaskQueryDto`:
  - Changed type from `string` to `Date`
  - Added `@Transform(({ value }) => normalizeDateTransform(value))` decorator
- Added `Transform` to imports from `class-transformer`
- Imported `normalizeDateTransform` from date utility

#### `src/modules/audit/audit.service.ts`
- Updated `parseDate()` function in both `bulkImport()` and `bulkUpdate()`:
  - Changed `new Date(year, month - 1, day)` to `new Date(Date.UTC(year, month - 1, day, 0, 0, 0))`
  - Changed Excel epoch from `new Date(1899, 11, 30)` to `new Date(Date.UTC(1899, 11, 30))`
- Fixed type issues: Changed `.toISOString()` calls to direct Date assignments (since DTOs now expect Date objects)

#### `src/modules/property/property.service.ts`
- Updated `parseDate()` function in both `bulkImport()` and `bulkUpdate()`:
  - Changed `new Date(year, month - 1, day)` to `new Date(Date.UTC(year, month - 1, day, 0, 0, 0))`
  - Changed Excel epoch from `new Date(1899, 11, 30)` to `new Date(Date.UTC(1899, 11, 30))`
- Fixed type issues: Changed `.toISOString()` calls to direct Date assignments

## How It Works

### Incoming Dates (Frontend → Backend)
1. Frontend sends dates as ISO strings (e.g., "2024-01-15" or "2024-01-15T10:30:00Z")
2. DTO's `@Transform` decorator calls `normalizeDateTransform()`
3. Date strings are parsed and normalized to UTC:
   - Date-only strings (YYYY-MM-DD) → UTC midnight (00:00:00)
   - ISO strings with time → Exact UTC time
4. Date objects stored in MongoDB in UTC format

### Bulk Import Dates (Excel → Backend)
1. Excel dates parsed in `parseDate()` helper function
2. mm/dd/yyyy format → `new Date(Date.UTC(year, month - 1, day, 0, 0, 0))`
3. Excel serial dates → Converted from UTC epoch
4. Resulting Date objects stored in MongoDB in UTC

### Outgoing Dates (Backend → Frontend)
1. Data retrieved from MongoDB (Date objects in UTC)
2. `DateSerializationInterceptor` automatically processes all responses
3. All Date objects converted to ISO 8601 strings with 'Z' suffix (e.g., "2024-01-15T00:00:00.000Z")
4. Frontend receives consistent UTC dates regardless of server or client timezone

## Testing Recommendations

### Manual Testing

1. **Create/Update Operations**:
   - Create an audit with start_date and end_date
   - Create a property with next_due_date
   - Create a task with due_date
   - Verify dates are stored and returned in UTC format (with 'Z' suffix)

2. **Bulk Import**:
   - Import an Excel file with dates in mm/dd/yyyy format
   - Import an Excel file with Excel serial dates
   - Verify all dates are stored and returned in UTC format

3. **Cross-Timezone Verification**:
   - Change your system timezone or use a VPN/proxy in a different country
   - Access the API and verify dates show the same values
   - Check that date-only values (e.g., "2024-01-15") don't shift to previous/next day

### API Testing

Example cURL commands to verify date format:

```bash
# Create an audit
curl -X POST http://localhost:3000/api/audit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "...",
    "audit_status_id": "...",
    "start_date": "2024-01-15",
    "end_date": "2024-01-20"
  }'

# Get all audits - verify dates have "Z" suffix
curl -X GET http://localhost:3000/api/audit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response format:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "start_date": "2024-01-15T00:00:00.000Z",
      "end_date": "2024-01-20T00:00:00.000Z",
      ...
    }
  ]
}
```

## Benefits

1. **Consistency**: Same date displayed regardless of user's location
2. **Predictability**: No date shifting when accessed from different timezones
3. **Excel Compatibility**: Bulk imports work correctly worldwide
4. **ISO Standards**: All dates follow ISO 8601 standard with UTC timezone
5. **Frontend Simplicity**: Frontend receives simple UTC strings, no complex timezone handling needed

## Important Notes

- All dates are now stored in UTC in MongoDB
- All API responses return dates with 'Z' suffix (UTC timezone indicator)
- Date-only values (without time) are stored as midnight UTC (00:00:00)
- The solution handles both date-only strings and full ISO datetime strings
- No database migration required - existing dates will be serialized to UTC on next retrieval

## Deployment

1. Run `yarn build` to verify no TypeScript errors
2. Deploy the updated backend code
3. Test with frontend to ensure dates display correctly
4. Monitor for any date-related issues in production

The fix is backward compatible - existing data will work correctly once retrieved through the new serialization interceptor.
