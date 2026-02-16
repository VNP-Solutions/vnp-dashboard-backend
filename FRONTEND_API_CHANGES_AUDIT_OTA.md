# Frontend API Changes: Audit OTA Type Migration

## Overview

The `type_of_ota` field in the Audit model has been changed from a **single value** to an **array of values**. This allows audits to be associated with multiple OTA types simultaneously (e.g., an audit can be for both Expedia and Agoda).

**Migration Date:** [Current Date]  
**Backend Version:** [Your Version]

---

## Breaking Changes Summary

### 1. Audit Data Structure Change

**BEFORE:**
```json
{
  "id": "65f8a7b2c3d4e5f6g7h8i9j0",
  "type_of_ota": "expedia",
  "property_id": "...",
  "amount_collectable": 5000.50
}
```

**AFTER:**
```json
{
  "id": "65f8a7b2c3d4e5f6g7h8i9j0",
  "type_of_ota": ["expedia", "agoda"],
  "property_id": "...",
  "amount_collectable": 5000.50
}
```

**Possible values for array items:**
- `"expedia"`
- `"agoda"`
- `"booking"`

**Array characteristics:**
- Can be empty: `[]`
- Can contain 1-3 unique values (no duplicates)
- Values are strings (enum)

---

## API Endpoint Changes

### 1. GET `/api/audit` - Get All Audits

**Response Change:**
```typescript
// OLD
interface Audit {
  type_of_ota?: "expedia" | "agoda" | "booking" | null
}

// NEW
interface Audit {
  type_of_ota: ("expedia" | "agoda" | "booking")[]  // Array, defaults to []
}
```

**Filtering:**
The `type_of_ota` query parameter now searches within the array:

```typescript
// Filter for audits that include "expedia" in their OTA types
GET /api/audit?type_of_ota=expedia

// This will match audits with:
// - ["expedia"]
// - ["expedia", "agoda"]
// - ["expedia", "booking"]
// - ["expedia", "agoda", "booking"]
```

### 2. POST `/api/audit` - Create Audit

**Request Body Change:**

**OLD:**
```json
{
  "property_id": "65f8a7b2...",
  "audit_status_id": "65f8a7b2...",
  "type_of_ota": "expedia",
  "amount_collectable": 5000.50
}
```

**NEW:**
```json
{
  "property_id": "65f8a7b2...",
  "audit_status_id": "65f8a7b2...",
  "type_of_ota": ["expedia", "agoda"],
  "amount_collectable": 5000.50
}
```

**Validation:**
- Array is optional, defaults to `[]`
- Duplicates are automatically removed by backend
- Values must be valid OTA types

**Examples:**
```typescript
// Single OTA type
{ "type_of_ota": ["expedia"] }

// Multiple OTA types
{ "type_of_ota": ["expedia", "agoda", "booking"] }

// Empty (no OTA types)
{ "type_of_ota": [] }

// Backend will remove duplicates automatically
{ "type_of_ota": ["expedia", "expedia"] }  // Becomes ["expedia"]
```

### 3. PATCH `/api/audit/:id` - Update Audit

Same changes as Create - `type_of_ota` is now an array.

**Example:**
```json
{
  "type_of_ota": ["booking"]
}
```

### 4. POST `/api/audit/bulk-import` - Bulk Import from Excel

**Excel Column Format:**

**OTA Type Column (formerly single value):**

**OLD:**
```
OTA
----
expedia
agoda
booking
```

**NEW (comma-separated for multiple):**
```
OTA
----
expedia
expedia, agoda
booking, agoda
agoda, booking, expedia
```

The backend will:
- Split comma-separated values
- Trim whitespace
- Remove duplicates
- Parse each value

### 5. POST `/api/audit/bulk-update` - Bulk Update from Excel

Same Excel format changes as Bulk Import.

### 6. GET `/api/audit/global-stats` - Global Statistics

**Response Change:**

The statistics now handle audits with multiple OTA types:

**Behavior:**
- An audit with `["expedia", "agoda"]` contributes to BOTH `expedia` and `agoda` totals
- The `total` amount counts each audit only once
- Individual OTA totals may sum to more than the total

**Example:**
```json
{
  "amount_collectable": {
    "total": 10000,      // Total across all audits (each counted once)
    "expedia": 7000,     // May include audits with multiple OTAs
    "agoda": 5000,       // May include audits with multiple OTAs
    "booking": 3000      // May include audits with multiple OTAs
  }
}
```

**Note:** `expedia + agoda + booking` may be > `total` because audits with multiple OTAs are counted in each category.

### 7. GET `/api/global-report` - Global Report

**Response Changes:**

**OLD:**
```json
{
  "data": [
    {
      "auditId": "...",
      "otaType": "expedia",
      "otaId": "EXP-12345",
      "otaUsername": "user@expedia.com",
      "otaPassword": "pass123"
    }
  ]
}
```

**NEW:**
```json
{
  "data": [
    {
      "auditId": "...",
      "otaType": "expedia, agoda",
      "otaId": "expedia: EXP-12345; agoda: AGO-67890",
      "otaUsername": "expedia: user@exp.com; agoda: user@ago.com",
      "otaPassword": "expedia: pass123; agoda: pass456"
    }
  ]
}
```

**Display Format:**
- `otaType`: Comma-separated list
- `otaId`, `otaUsername`, `otaPassword`: Semicolon-separated with OTA type prefix

**Filtering:**
```typescript
// Filter by OTA type (matches if array contains value)
{
  "filters": [
    {
      "column": "otaType",
      "operator": "eq",      // Array contains this value
      "value": "expedia"
    }
  ]
}

// Filter by multiple OTA types
{
  "filters": [
    {
      "column": "otaType",
      "operator": "in",       // Array contains any of these values
      "value": ["expedia", "agoda"]
    }
  ]
}
```

**Note:** `otaType` is no longer sortable (sorting by array fields is complex).

---

## Frontend Implementation Guide

### 1. Update TypeScript Interfaces

```typescript
// Update your Audit interface
export interface Audit {
  id: string
  property_id: string
  audit_status_id: string
  type_of_ota: OtaType[]  // Changed from OtaType | null to OtaType[]
  amount_collectable?: number
  amount_confirmed?: number
  // ... other fields
}

export enum OtaType {
  EXPEDIA = 'expedia',
  AGODA = 'agoda',
  BOOKING = 'booking'
}
```

### 2. Display OTA Types

**List View (showing multiple OTAs):**

```tsx
// React example
function AuditRow({ audit }: { audit: Audit }) {
  return (
    <tr>
      <td>{audit.property.name}</td>
      <td>
        {audit.type_of_ota.length > 0 ? (
          audit.type_of_ota.map(ota => (
            <span key={ota} className="badge badge-primary">
              {ota}
            </span>
          ))
        ) : (
          <span className="text-muted">No OTA</span>
        )}
      </td>
      <td>${audit.amount_collectable}</td>
    </tr>
  )
}
```

**Alternative (comma-separated):**

```tsx
<td>{audit.type_of_ota.join(', ') || 'No OTA'}</td>
```

### 3. Filter by OTA Type

**Single Select Filter:**

```typescript
// API call with filter
const fetchAudits = async (otaType?: string) => {
  const params = new URLSearchParams()
  if (otaType) {
    params.append('type_of_ota', otaType)
  }
  
  const response = await fetch(`/api/audit?${params}`)
  return response.json()
}
```

**Multi-Select Filter (if implementing advanced filtering):**

```typescript
// For APIs that support "in" operator
const fetchAudits = async (otaTypes: string[]) => {
  const response = await fetch('/api/audit', {
    method: 'POST',
    body: JSON.stringify({
      filters: {
        type_of_ota: { in: otaTypes }
      }
    })
  })
  return response.json()
}
```

### 4. Create/Update Audit Forms

**Multi-Select Component:**

```tsx
import { MultiSelect } from 'your-ui-library'

function AuditForm() {
  const [selectedOtas, setSelectedOtas] = useState<OtaType[]>([])

  const otaOptions = [
    { value: 'expedia', label: 'Expedia' },
    { value: 'agoda', label: 'Agoda' },
    { value: 'booking', label: 'Booking.com' }
  ]

  const handleSubmit = async () => {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type_of_ota: selectedOtas,  // Array
        // ... other fields
      })
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <MultiSelect
        options={otaOptions}
        value={selectedOtas}
        onChange={setSelectedOtas}
        placeholder="Select OTA Types"
        maxSelections={3}
      />
      {/* Other form fields */}
    </form>
  )
}
```

### 5. Handle Bulk Import/Update Excel

**Excel Template Update:**

Users can now enter comma-separated values in the OTA column:

```
Property Name | OTA                    | Amount
Hotel A       | expedia                | 1000
Hotel B       | expedia, agoda         | 2000
Hotel C       | booking, agoda         | 1500
Hotel D       |                        | 3000
```

**Frontend Excel parsing (if applicable):**

```typescript
function parseExcelOtaColumn(cell: string): OtaType[] {
  if (!cell || cell.trim() === '') return []
  
  return cell
    .split(',')
    .map(ota => ota.trim().toLowerCase())
    .filter((ota): ota is OtaType => 
      ['expedia', 'agoda', 'booking'].includes(ota)
    )
    .filter((ota, index, self) => 
      self.indexOf(ota) === index  // Remove duplicates
    )
}
```

### 6. Global Stats Dashboard

**Update stats display logic:**

```tsx
function GlobalStats({ stats }: { stats: GlobalStatsResponse }) {
  return (
    <div>
      <h3>Total Amount: ${stats.amount_collectable.total}</h3>
      <div className="ota-breakdown">
        <div>
          <span>Expedia:</span>
          <span>${stats.amount_collectable.expedia}</span>
        </div>
        <div>
          <span>Agoda:</span>
          <span>${stats.amount_collectable.agoda}</span>
        </div>
        <div>
          <span>Booking:</span>
          <span>${stats.amount_collectable.booking}</span>
        </div>
      </div>
      <p className="note">
        * Note: Audits with multiple OTAs are counted in each category
      </p>
    </div>
  )
}
```

### 7. Global Report Table

**Handle concatenated values:**

```tsx
function GlobalReportRow({ row }: { row: ReportRow }) {
  return (
    <tr>
      <td>{row.portfolioName}</td>
      <td>{row.propertyName}</td>
      <td>
        {/* OTA Type is comma-separated */}
        {row.otaType || '-'}
      </td>
      <td>
        {/* OTA ID is semicolon-separated with prefixes */}
        {row.otaId ? (
          <div className="multiline">
            {row.otaId.split('; ').map((id, i) => (
              <div key={i}>{id}</div>
            ))}
          </div>
        ) : '-'}
      </td>
    </tr>
  )
}
```

---

## Migration Checklist

### Backend (Already Done ✅)
- [x] Update Prisma schema
- [x] Run migration script
- [x] Update DTOs
- [x] Update service layer
- [x] Update filtering logic
- [x] Update bulk operations
- [x] Update global stats calculation
- [x] Update global report module
- [x] Test all endpoints

### Frontend (Your Tasks)
- [ ] Update TypeScript interfaces
- [ ] Update list/table displays
- [ ] Update filter components
- [ ] Update create/edit forms (add multi-select)
- [ ] Update Excel import/export handling
- [ ] Update global stats display
- [ ] Update global report table
- [ ] Add user guidance (tooltips, help text)
- [ ] Test all CRUD operations
- [ ] Test filtering
- [ ] Test bulk operations
- [ ] Update user documentation

---

## Testing Scenarios

### Test Case 1: Create Audit with Single OTA
```json
POST /api/audit
{
  "type_of_ota": ["expedia"],
  "property_id": "...",
  "audit_status_id": "..."
}
```
**Expected:** Success, audit created with OTA array containing one value.

### Test Case 2: Create Audit with Multiple OTAs
```json
POST /api/audit
{
  "type_of_ota": ["expedia", "agoda", "booking"],
  "property_id": "...",
  "audit_status_id": "..."
}
```
**Expected:** Success, audit created with all three OTA types.

### Test Case 3: Create Audit with Duplicates
```json
POST /api/audit
{
  "type_of_ota": ["expedia", "expedia", "agoda"],
  "property_id": "...",
  "audit_status_id": "..."
}
```
**Expected:** Success, duplicates removed automatically → `["expedia", "agoda"]`.

### Test Case 4: Create Audit with Empty Array
```json
POST /api/audit
{
  "type_of_ota": [],
  "property_id": "...",
  "audit_status_id": "..."
}
```
**Expected:** Success, audit created with no OTA types.

### Test Case 5: Filter by OTA Type
```
GET /api/audit?type_of_ota=expedia
```
**Expected:** Returns all audits where `type_of_ota` array contains "expedia".

### Test Case 6: Update Audit OTA Types
```json
PATCH /api/audit/65f8a7b2...
{
  "type_of_ota": ["booking"]
}
```
**Expected:** Success, OTA types updated to contain only "booking".

### Test Case 7: Bulk Import with Comma-Separated
**Excel row:**
```
Property | OTA              | Amount
Hotel A  | expedia, agoda   | 1000
```
**Expected:** Success, audit created with `type_of_ota: ["expedia", "agoda"]`.

### Test Case 8: Global Stats with Mixed OTAs
**Data:**
- Audit 1: `["expedia"]` - $1000
- Audit 2: `["expedia", "agoda"]` - $2000

**Expected Stats:**
```json
{
  "amount_collectable": {
    "total": 3000,      // 1000 + 2000
    "expedia": 3000,    // 1000 + 2000 (both audits)
    "agoda": 2000,      // 2000 (only Audit 2)
    "booking": 0
  }
}
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Treating as Single Value
**Problem:**
```typescript
// OLD CODE - Will break
if (audit.type_of_ota === 'expedia') { ... }
```

**Solution:**
```typescript
// NEW CODE
if (audit.type_of_ota.includes('expedia')) { ... }
```

### Pitfall 2: Not Handling Empty Arrays
**Problem:**
```typescript
const otaType = audit.type_of_ota[0]  // Could be undefined
```

**Solution:**
```typescript
const otaType = audit.type_of_ota[0] || 'Unknown'
// OR
const hasOta = audit.type_of_ota.length > 0
```

### Pitfall 3: Filter Not Working
**Problem:** Using old filter format
```typescript
params.append('type_of_ota', 'expedia')  // Still works!
```

**Explanation:** The backend now uses the `has` operator, so this still works. The filter checks if the array contains the value.

### Pitfall 4: Duplicate Handling in Forms
**Problem:** User can select same OTA twice in UI

**Solution:** Backend removes duplicates automatically, but prevent in UI:
```typescript
const handleOtaChange = (newOtas: OtaType[]) => {
  const unique = [...new Set(newOtas)]
  setSelectedOtas(unique)
}
```

---

## Support & Questions

For questions or issues related to this migration:
1. Check this documentation first
2. Review the test cases above
3. Contact the backend team
4. Check the API logs for detailed error messages

**Backend Migration Date:** [Date]  
**Documentation Version:** 1.0  
**Last Updated:** [Date]
