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

### 7. POST `/api/global-report` - Global Report

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

**NEW (Separate Fields Approach):**
```json
{
  "data": [
    {
      "auditId": "...",
      "otaType": ["expedia", "agoda"],
      "expediaId": "EXP-12345",
      "expediaUsername": "user@exp.com",
      "expediaPassword": "pass123",
      "agodaId": "AGO-67890",
      "agodaUsername": "user@ago.com",
      "agodaPassword": "pass456",
      "bookingId": null,
      "bookingUsername": null,
      "bookingPassword": null,
      "portfolioName": "...",
      "propertyName": "...",
      "serviceType": "...",
      "billingType": "..."
    }
  ]
}
```

**Why This Change:**
- An audit can now have multiple OTA types (e.g., both Expedia and Agoda for the same property)
- Separate fields for each OTA make filtering, sorting, and data manipulation much easier
- Each OTA credential is in its own column, creating a more structured and maintainable table
- Filtering becomes simpler (filter by `expediaId` instead of parsing concatenated strings)
- Better export experience: clean columns in CSV/Excel instead of concatenated values

**Display Format:**
- `otaType`: Display as array/tags (e.g., badges for "expedia", "agoda")
- Individual OTA fields: Display in separate columns
- Null values: Show as empty cells or "-"

**Filtering (NEW Capabilities):**
```typescript
// Filter by OTA type (array contains check)
{
  "filters": [
    {
      "column": "otaType",
      "operator": "eq",      // Array contains this value
      "value": "expedia"
    }
  ]
}

// Filter by specific Expedia ID
{
  "filters": [
    {
      "column": "expediaId",
      "operator": "contains",
      "value": "EXP-12345"
    }
  ]
}

// Filter by Agoda username
{
  "filters": [
    {
      "column": "agodaUsername",
      "operator": "eq",
      "value": "user@agoda.com"
    }
  ]
}

// Filter by Booking password
{
  "filters": [
    {
      "column": "bookingPassword",
      "operator": "contains",
      "value": "pass"
    }
  ]
}

// Legacy: Filter by OTA ID (searches across all OTA types - for backward compatibility)
{
  "filters": [
    {
      "column": "otaId",
      "operator": "contains",
      "value": "12345"
    }
  ]
}
```

**NEW Filter Endpoints:**

Individual endpoints for each OTA type to populate filter dropdowns:

```typescript
// Get Expedia credentials only
GET /api/global-report/expedia-ids       → { data: string[] }
GET /api/global-report/expedia-usernames → { data: string[] }
GET /api/global-report/expedia-passwords → { data: string[] }

// Get Agoda credentials only
GET /api/global-report/agoda-ids         → { data: string[] }
GET /api/global-report/agoda-usernames   → { data: string[] }
GET /api/global-report/agoda-passwords   → { data: string[] }

// Get Booking credentials only
GET /api/global-report/booking-ids       → { data: string[] }
GET /api/global-report/booking-usernames → { data: string[] }
GET /api/global-report/booking-passwords → { data: string[] }

// Existing combined endpoints (still available)
GET /api/global-report/ota-ids       → { data: [{ otaId: string, otaType: string }] }
GET /api/global-report/ota-usernames → { data: [{ username: string, otaType: string }] }
GET /api/global-report/ota-passwords → { data: [{ password: string, otaType: string }] }
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

// NEW: Global Report Row interface
export interface GlobalReportRow {
  auditId: string
  portfolioName: string
  propertyName: string
  serviceType: string | null
  billingType: string | null
  otaType: string[]  // Array of OTA types
  
  // Expedia credentials
  expediaId: string | null
  expediaUsername: string | null
  expediaPassword: string | null
  
  // Agoda credentials
  agodaId: string | null
  agodaUsername: string | null
  agodaPassword: string | null
  
  // Booking credentials
  bookingId: string | null
  bookingUsername: string | null
  bookingPassword: string | null
  
  auditStatus: string | null
  startDate: Date | null
  endDate: Date | null
  nextDueDate: Date | null
  currency: string
  amountCollectable: number | null
  amountConfirmed: number | null
  portfolioContactEmail: string | null
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

**Display separate OTA credential columns:**

```tsx
// React example for Global Report table
function GlobalReportTable({ data }: { data: GlobalReportRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Portfolio</th>
          <th>Property</th>
          <th>OTA Types</th>
          <th>Expedia ID</th>
          <th>Expedia User</th>
          <th>Expedia Pass</th>
          <th>Agoda ID</th>
          <th>Agoda User</th>
          <th>Agoda Pass</th>
          <th>Booking ID</th>
          <th>Booking User</th>
          <th>Booking Pass</th>
          <th>Status</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.auditId}>
            <td>{row.portfolioName}</td>
            <td>{row.propertyName}</td>
            <td>
              {row.otaType.map(ota => (
                <span key={ota} className="badge">{ota}</span>
              ))}
            </td>
            <td>{row.expediaId || '-'}</td>
            <td>{row.expediaUsername || '-'}</td>
            <td>{row.expediaPassword || '-'}</td>
            <td>{row.agodaId || '-'}</td>
            <td>{row.agodaUsername || '-'}</td>
            <td>{row.agodaPassword || '-'}</td>
            <td>{row.bookingId || '-'}</td>
            <td>{row.bookingUsername || '-'}</td>
            <td>{row.bookingPassword || '-'}</td>
            <td>{row.auditStatus}</td>
            <td>${row.amountCollectable}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

**Responsive Design (Grouped View for Mobile):**

```tsx
// For smaller screens, group OTA credentials in collapsible sections
function GlobalReportCard({ row }: { row: GlobalReportRow }) {
  return (
    <div className="report-card">
      <h4>{row.propertyName}</h4>
      <p>{row.portfolioName}</p>
      
      {/* OTA Type badges */}
      <div className="ota-types">
        {row.otaType.map(ota => <span key={ota} className="badge">{ota}</span>)}
      </div>
      
      {/* Collapsible Expedia section */}
      {row.expediaId && (
        <details>
          <summary>Expedia Credentials</summary>
          <div>
            <p>ID: {row.expediaId}</p>
            <p>Username: {row.expediaUsername}</p>
            <p>Password: {row.expediaPassword}</p>
          </div>
        </details>
      )}
      
      {/* Collapsible Agoda section */}
      {row.agodaId && (
        <details>
          <summary>Agoda Credentials</summary>
          <div>
            <p>ID: {row.agodaId}</p>
            <p>Username: {row.agodaUsername}</p>
            <p>Password: {row.agodaPassword}</p>
          </div>
        </details>
      )}
      
      {/* Collapsible Booking section */}
      {row.bookingId && (
        <details>
          <summary>Booking Credentials</summary>
          <div>
            <p>ID: {row.bookingId}</p>
            <p>Username: {row.bookingUsername}</p>
            <p>Password: {row.bookingPassword}</p>
          </div>
        </details>
      )}
      
      <p>Status: {row.auditStatus}</p>
      <p>Amount: ${row.amountCollectable}</p>
    </div>
  )
}
```

**Filter dropdowns for individual OTA types:**

```tsx
// Use the new specific endpoints to populate filters
function GlobalReportFilters() {
  const [expediaIds, setExpediaIds] = useState<string[]>([])
  const [agodaIds, setAgodaIds] = useState<string[]>([])
  const [bookingIds, setBookingIds] = useState<string[]>([])
  
  useEffect(() => {
    // Load filter options from new endpoints
    fetch('/api/global-report/expedia-ids')
      .then(res => res.json())
      .then(data => setExpediaIds(data.data))
    
    fetch('/api/global-report/agoda-ids')
      .then(res => res.json())
      .then(data => setAgodaIds(data.data))
    
    fetch('/api/global-report/booking-ids')
      .then(res => res.json())
      .then(data => setBookingIds(data.data))
  }, [])
  
  return (
    <div className="filters">
      {/* Expedia filters */}
      <div className="filter-group">
        <h4>Expedia</h4>
        <select name="expediaId">
          <option value="">All IDs</option>
          {expediaIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
      
      {/* Agoda filters */}
      <div className="filter-group">
        <h4>Agoda</h4>
        <select name="agodaId">
          <option value="">All IDs</option>
          {agodaIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
      
      {/* Booking filters */}
      <div className="filter-group">
        <h4>Booking</h4>
        <select name="bookingId">
          <option value="">All IDs</option>
          {bookingIds.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
    </div>
  )
}
```

---

## Global Report - Detailed Frontend Implementation

### Overview of Changes

The Global Report now displays OTA credentials in **separate columns** for each OTA type (Expedia, Agoda, Booking) instead of concatenated values. This provides:
- Better filtering capabilities
- Easier sorting
- Cleaner CSV/Excel exports
- More structured data display

### Updated Data Structure

```typescript
// OLD: Concatenated approach
interface OldReportRow {
  otaType: string  // "expedia, agoda"
  otaId: string    // "expedia: EXP-123; agoda: AGO-456"
  otaUsername: string
  otaPassword: string
}

// NEW: Separate fields approach
interface GlobalReportRow {
  auditId: string
  portfolioName: string
  propertyName: string
  serviceType: string | null
  billingType: string | null
  
  otaType: string[]  // ["expedia", "agoda"]
  
  // Expedia credentials (separate fields)
  expediaId: string | null
  expediaUsername: string | null
  expediaPassword: string | null
  
  // Agoda credentials (separate fields)
  agodaId: string | null
  agodaUsername: string | null
  agodaPassword: string | null
  
  // Booking credentials (separate fields)
  bookingId: string | null
  bookingUsername: string | null
  bookingPassword: string | null
  
  auditStatus: string | null
  startDate: Date | null
  endDate: Date | null
  nextDueDate: Date | null
  currency: string
  amountCollectable: number | null
  amountConfirmed: number | null
  portfolioContactEmail: string | null
}
```

### Implementation Guide

#### 1. Create TypeScript Types

```typescript
// types/global-report.types.ts

export enum OtaType {
  EXPEDIA = 'expedia',
  AGODA = 'agoda',
  BOOKING = 'booking'
}

export interface GlobalReportRow {
  auditId: string
  portfolioName: string
  propertyName: string
  serviceType: string | null
  billingType: string | null
  otaType: OtaType[]
  
  // Expedia
  expediaId: string | null
  expediaUsername: string | null
  expediaPassword: string | null
  
  // Agoda
  agodaId: string | null
  agodaUsername: string | null
  agodaPassword: string | null
  
  // Booking
  bookingId: string | null
  bookingUsername: string | null
  bookingPassword: string | null
  
  auditStatus: string | null
  startDate: Date | null
  endDate: Date | null
  nextDueDate: Date | null
  currency: string
  amountCollectable: number | null
  amountConfirmed: number | null
  portfolioContactEmail: string | null
}

export interface GlobalReportResponse {
  success: boolean
  message: string
  data: GlobalReportRow[]
  metadata: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface OtaCredentialFilter {
  expediaIds: string[]
  agodaIds: string[]
  bookingIds: string[]
  expediaUsernames: string[]
  agodaUsernames: string[]
  bookingUsernames: string[]
}
```

#### 2. Fetch Filter Options

```typescript
// hooks/useGlobalReportFilters.ts

import { useState, useEffect } from 'react'
import { OtaCredentialFilter } from '@/types/global-report.types'

export const useGlobalReportFilters = () => {
  const [filters, setFilters] = useState<OtaCredentialFilter>({
    expediaIds: [],
    agodaIds: [],
    bookingIds: [],
    expediaUsernames: [],
    agodaUsernames: [],
    bookingUsernames: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoading(true)
        
        // Fetch all filter options in parallel
        const [
          expediaIdsRes,
          agodaIdsRes,
          bookingIdsRes,
          expediaUsernamesRes,
          agodaUsernamesRes,
          bookingUsernamesRes
        ] = await Promise.all([
          fetch('/api/global-report/expedia-ids'),
          fetch('/api/global-report/agoda-ids'),
          fetch('/api/global-report/booking-ids'),
          fetch('/api/global-report/expedia-usernames'),
          fetch('/api/global-report/agoda-usernames'),
          fetch('/api/global-report/booking-usernames')
        ])

        const [
          expediaIds,
          agodaIds,
          bookingIds,
          expediaUsernames,
          agodaUsernames,
          bookingUsernames
        ] = await Promise.all([
          expediaIdsRes.json(),
          agodaIdsRes.json(),
          bookingIdsRes.json(),
          expediaUsernamesRes.json(),
          agodaUsernamesRes.json(),
          bookingUsernamesRes.json()
        ])

        setFilters({
          expediaIds: expediaIds.data,
          agodaIds: agodaIds.data,
          bookingIds: bookingIds.data,
          expediaUsernames: expediaUsernames.data,
          agodaUsernames: agodaUsernames.data,
          bookingUsernames: bookingUsernames.data
        })
      } catch (error) {
        console.error('Failed to load filters:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFilters()
  }, [])

  return { filters, loading }
}
```

#### 3. Build Filter UI

```tsx
// components/GlobalReportFilters.tsx

import React, { useState } from 'react'
import { useGlobalReportFilters } from '@/hooks/useGlobalReportFilters'

interface FilterState {
  otaType: string[]
  expediaId: string
  agodaId: string
  bookingId: string
  expediaUsername: string
  agodaUsername: string
  bookingUsername: string
}

export const GlobalReportFilters: React.FC<{
  onFilterChange: (filters: FilterState) => void
}> = ({ onFilterChange }) => {
  const { filters, loading } = useGlobalReportFilters()
  const [selectedFilters, setSelectedFilters] = useState<FilterState>({
    otaType: [],
    expediaId: '',
    agodaId: '',
    bookingId: '',
    expediaUsername: '',
    agodaUsername: '',
    bookingUsername: ''
  })

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...selectedFilters, [key]: value }
    setSelectedFilters(newFilters)
    onFilterChange(newFilters)
  }

  if (loading) {
    return <div>Loading filters...</div>
  }

  return (
    <div className="global-report-filters">
      {/* OTA Type Multi-Select */}
      <div className="filter-group">
        <label>OTA Types</label>
        <select
          multiple
          value={selectedFilters.otaType}
          onChange={(e) => {
            const values = Array.from(
              e.target.selectedOptions,
              (option) => option.value
            )
            handleFilterChange('otaType', values)
          }}
        >
          <option value="expedia">Expedia</option>
          <option value="agoda">Agoda</option>
          <option value="booking">Booking</option>
        </select>
      </div>

      {/* Expedia Filters */}
      <div className="filter-section">
        <h3>Expedia</h3>
        <div className="filter-group">
          <label>Expedia ID</label>
          <select
            value={selectedFilters.expediaId}
            onChange={(e) => handleFilterChange('expediaId', e.target.value)}
          >
            <option value="">All</option>
            {filters.expediaIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Expedia Username</label>
          <select
            value={selectedFilters.expediaUsername}
            onChange={(e) => handleFilterChange('expediaUsername', e.target.value)}
          >
            <option value="">All</option>
            {filters.expediaUsernames.map((username) => (
              <option key={username} value={username}>
                {username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Agoda Filters */}
      <div className="filter-section">
        <h3>Agoda</h3>
        <div className="filter-group">
          <label>Agoda ID</label>
          <select
            value={selectedFilters.agodaId}
            onChange={(e) => handleFilterChange('agodaId', e.target.value)}
          >
            <option value="">All</option>
            {filters.agodaIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Agoda Username</label>
          <select
            value={selectedFilters.agodaUsername}
            onChange={(e) => handleFilterChange('agodaUsername', e.target.value)}
          >
            <option value="">All</option>
            {filters.agodaUsernames.map((username) => (
              <option key={username} value={username}>
                {username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Booking Filters */}
      <div className="filter-section">
        <h3>Booking.com</h3>
        <div className="filter-group">
          <label>Booking ID</label>
          <select
            value={selectedFilters.bookingId}
            onChange={(e) => handleFilterChange('bookingId', e.target.value)}
          >
            <option value="">All</option>
            {filters.bookingIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Booking Username</label>
          <select
            value={selectedFilters.bookingUsername}
            onChange={(e) => handleFilterChange('bookingUsername', e.target.value)}
          >
            <option value="">All</option>
            {filters.bookingUsernames.map((username) => (
              <option key={username} value={username}>
                {username}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
```

#### 4. Display Report Table (Desktop)

```tsx
// components/GlobalReportTable.tsx

import React from 'react'
import { GlobalReportRow, OtaType } from '@/types/global-report.types'

export const GlobalReportTable: React.FC<{
  data: GlobalReportRow[]
}> = ({ data }) => {
  return (
    <div className="table-responsive">
      <table className="global-report-table">
        <thead>
          <tr>
            <th>Portfolio</th>
            <th>Property</th>
            <th>Service Type</th>
            <th>OTA Types</th>
            {/* Expedia Columns */}
            <th>Expedia ID</th>
            <th>Expedia Username</th>
            <th>Expedia Password</th>
            {/* Agoda Columns */}
            <th>Agoda ID</th>
            <th>Agoda Username</th>
            <th>Agoda Password</th>
            {/* Booking Columns */}
            <th>Booking ID</th>
            <th>Booking Username</th>
            <th>Booking Password</th>
            {/* Other Columns */}
            <th>Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.auditId}>
              <td>{row.portfolioName}</td>
              <td>{row.propertyName}</td>
              <td>{row.serviceType || '-'}</td>
              <td>
                <div className="ota-badges">
                  {row.otaType.map((ota) => (
                    <span key={ota} className={`badge badge-${ota}`}>
                      {ota}
                    </span>
                  ))}
                </div>
              </td>
              {/* Expedia */}
              <td>{row.expediaId || '-'}</td>
              <td>{row.expediaUsername || '-'}</td>
              <td>
                {row.expediaPassword ? (
                  <span className="password-field">
                    {row.expediaPassword}
                  </span>
                ) : (
                  '-'
                )}
              </td>
              {/* Agoda */}
              <td>{row.agodaId || '-'}</td>
              <td>{row.agodaUsername || '-'}</td>
              <td>
                {row.agodaPassword ? (
                  <span className="password-field">
                    {row.agodaPassword}
                  </span>
                ) : (
                  '-'
                )}
              </td>
              {/* Booking */}
              <td>{row.bookingId || '-'}</td>
              <td>{row.bookingUsername || '-'}</td>
              <td>
                {row.bookingPassword ? (
                  <span className="password-field">
                    {row.bookingPassword}
                  </span>
                ) : (
                  '-'
                )}
              </td>
              {/* Other */}
              <td>{row.auditStatus || '-'}</td>
              <td>
                {row.currency} {row.amountCollectable?.toFixed(2) || '0.00'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

#### 5. Responsive Card View (Mobile)

```tsx
// components/GlobalReportCard.tsx

import React, { useState } from 'react'
import { GlobalReportRow } from '@/types/global-report.types'

export const GlobalReportCard: React.FC<{
  row: GlobalReportRow
}> = ({ row }) => {
  const [expandedOta, setExpandedOta] = useState<string | null>(null)

  const toggleOta = (ota: string) => {
    setExpandedOta(expandedOta === ota ? null : ota)
  }

  return (
    <div className="report-card">
      {/* Header */}
      <div className="card-header">
        <h3>{row.propertyName}</h3>
        <p className="text-muted">{row.portfolioName}</p>
      </div>

      {/* OTA Type Badges */}
      <div className="ota-badges">
        {row.otaType.map((ota) => (
          <span key={ota} className={`badge badge-${ota}`}>
            {ota}
          </span>
        ))}
      </div>

      {/* Basic Info */}
      <div className="card-info">
        <div className="info-row">
          <span className="label">Service Type:</span>
          <span className="value">{row.serviceType || '-'}</span>
        </div>
        <div className="info-row">
          <span className="label">Status:</span>
          <span className="value">{row.auditStatus || '-'}</span>
        </div>
        <div className="info-row">
          <span className="label">Amount:</span>
          <span className="value">
            {row.currency} {row.amountCollectable?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>

      {/* Collapsible OTA Credentials */}
      {row.expediaId && (
        <div className="ota-section">
          <button
            className="ota-toggle"
            onClick={() => toggleOta('expedia')}
          >
            <span>Expedia Credentials</span>
            <span>{expandedOta === 'expedia' ? '▼' : '▶'}</span>
          </button>
          {expandedOta === 'expedia' && (
            <div className="ota-details">
              <div className="detail-row">
                <span className="label">ID:</span>
                <span className="value">{row.expediaId}</span>
              </div>
              <div className="detail-row">
                <span className="label">Username:</span>
                <span className="value">{row.expediaUsername || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Password:</span>
                <span className="value password-field">
                  {row.expediaPassword || '-'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {row.agodaId && (
        <div className="ota-section">
          <button
            className="ota-toggle"
            onClick={() => toggleOta('agoda')}
          >
            <span>Agoda Credentials</span>
            <span>{expandedOta === 'agoda' ? '▼' : '▶'}</span>
          </button>
          {expandedOta === 'agoda' && (
            <div className="ota-details">
              <div className="detail-row">
                <span className="label">ID:</span>
                <span className="value">{row.agodaId}</span>
              </div>
              <div className="detail-row">
                <span className="label">Username:</span>
                <span className="value">{row.agodaUsername || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Password:</span>
                <span className="value password-field">
                  {row.agodaPassword || '-'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {row.bookingId && (
        <div className="ota-section">
          <button
            className="ota-toggle"
            onClick={() => toggleOta('booking')}
          >
            <span>Booking Credentials</span>
            <span>{expandedOta === 'booking' ? '▼' : '▶'}</span>
          </button>
          {expandedOta === 'booking' && (
            <div className="ota-details">
              <div className="detail-row">
                <span className="label">ID:</span>
                <span className="value">{row.bookingId}</span>
              </div>
              <div className="detail-row">
                <span className="label">Username:</span>
                <span className="value">{row.bookingUsername || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Password:</span>
                <span className="value password-field">
                  {row.bookingPassword || '-'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

#### 6. CSV/Excel Export Handling

```typescript
// utils/globalReportExport.ts

import { GlobalReportRow } from '@/types/global-report.types'

export const exportToCSV = (data: GlobalReportRow[]) => {
  // Headers
  const headers = [
    'Audit ID',
    'Portfolio',
    'Property',
    'Service Type',
    'Billing Type',
    'OTA Types',
    'Expedia ID',
    'Expedia Username',
    'Expedia Password',
    'Agoda ID',
    'Agoda Username',
    'Agoda Password',
    'Booking ID',
    'Booking Username',
    'Booking Password',
    'Status',
    'Start Date',
    'End Date',
    'Currency',
    'Amount Collectable',
    'Amount Confirmed'
  ]

  // Convert data to CSV rows
  const rows = data.map((row) => [
    row.auditId,
    row.portfolioName,
    row.propertyName,
    row.serviceType || '',
    row.billingType || '',
    row.otaType.join(', '),
    row.expediaId || '',
    row.expediaUsername || '',
    row.expediaPassword || '',
    row.agodaId || '',
    row.agodaUsername || '',
    row.agodaPassword || '',
    row.bookingId || '',
    row.bookingUsername || '',
    row.bookingPassword || '',
    row.auditStatus || '',
    row.startDate || '',
    row.endDate || '',
    row.currency,
    row.amountCollectable || '',
    row.amountConfirmed || ''
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n')

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `global-report-${new Date().toISOString()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Or use the backend export endpoint
export const exportFromBackend = async (filters: any) => {
  const response = await fetch('/api/global-report/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      format: 'xlsx', // or 'csv'
      filters: filters
    })
  })

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `global-report-${new Date().toISOString()}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
```

#### 7. Main Report Component

```tsx
// pages/GlobalReport.tsx

import React, { useState, useEffect } from 'react'
import { GlobalReportFilters } from '@/components/GlobalReportFilters'
import { GlobalReportTable } from '@/components/GlobalReportTable'
import { GlobalReportCard } from '@/components/GlobalReportCard'
import { GlobalReportResponse } from '@/types/global-report.types'
import { exportFromBackend } from '@/utils/globalReportExport'

export const GlobalReportPage: React.FC = () => {
  const [data, setData] = useState<GlobalReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch report data
  const fetchReport = async (currentFilters: any, currentPage: number) => {
    setLoading(true)
    try {
      const response = await fetch('/api/global-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: convertFiltersToAPIFormat(currentFilters),
          page: currentPage,
          limit: 50
        })
      })
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  // Convert UI filters to API filter format
  const convertFiltersToAPIFormat = (uiFilters: any) => {
    const apiFilters = []

    if (uiFilters.otaType?.length > 0) {
      apiFilters.push({
        column: 'otaType',
        operator: 'in',
        value: uiFilters.otaType
      })
    }

    if (uiFilters.expediaId) {
      apiFilters.push({
        column: 'expediaId',
        operator: 'eq',
        value: uiFilters.expediaId
      })
    }

    if (uiFilters.agodaId) {
      apiFilters.push({
        column: 'agodaId',
        operator: 'eq',
        value: uiFilters.agodaId
      })
    }

    if (uiFilters.bookingId) {
      apiFilters.push({
        column: 'bookingId',
        operator: 'eq',
        value: uiFilters.bookingId
      })
    }

    // Add username filters...
    if (uiFilters.expediaUsername) {
      apiFilters.push({
        column: 'expediaUsername',
        operator: 'eq',
        value: uiFilters.expediaUsername
      })
    }

    return apiFilters
  }

  // Handle filter changes
  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
    setPage(1)
    fetchReport(newFilters, 1)
  }

  // Initial load
  useEffect(() => {
    fetchReport(filters, page)
  }, [])

  // Handle export
  const handleExport = () => {
    exportFromBackend(convertFiltersToAPIFormat(filters))
  }

  return (
    <div className="global-report-page">
      <div className="page-header">
        <h1>Global Report</h1>
        <button onClick={handleExport} className="btn-export">
          Export to Excel
        </button>
      </div>

      {/* Filters */}
      <GlobalReportFilters onFilterChange={handleFilterChange} />

      {/* Loading State */}
      {loading && <div className="loading">Loading...</div>}

      {/* Data Display */}
      {data && (
        <>
          {/* Desktop View: Table */}
          {!isMobile && <GlobalReportTable data={data.data} />}

          {/* Mobile View: Cards */}
          {isMobile && (
            <div className="report-cards">
              {data.data.map((row) => (
                <GlobalReportCard key={row.auditId} row={row} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1)
                fetchReport(filters, page - 1)
              }}
            >
              Previous
            </button>
            <span>
              Page {page} of {data.metadata.totalPages}
            </span>
            <button
              disabled={page === data.metadata.totalPages}
              onClick={() => {
                setPage(page + 1)
                fetchReport(filters, page + 1)
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

### Styling Recommendations

```css
/* styles/global-report.css */

/* Table Styles */
.global-report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.global-report-table th {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
}

.global-report-table td {
  border: 1px solid #ddd;
  padding: 10px 8px;
}

/* OTA Badges */
.ota-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge-expedia {
  background-color: #0066cc;
  color: white;
}

.badge-agoda {
  background-color: #d9181d;
  color: white;
}

.badge-booking {
  background-color: #003580;
  color: white;
}

/* Password Field */
.password-field {
  font-family: monospace;
  background-color: #f9f9f9;
  padding: 2px 6px;
  border-radius: 3px;
}

/* Card Styles (Mobile) */
.report-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
}

.card-header .text-muted {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.ota-section {
  margin-top: 12px;
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.ota-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  padding: 8px 0;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.ota-details {
  margin-top: 8px;
  padding-left: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.detail-row .label {
  color: #666;
  font-size: 14px;
}

.detail-row .value {
  font-size: 14px;
  font-weight: 500;
}

/* Filter Styles */
.global-report-filters {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.filter-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.filter-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.filter-group {
  margin-bottom: 12px;
}

.filter-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 500;
}

.filter-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .global-report-table {
    display: none;
  }
}
```

### Testing Checklist for Global Report

- [ ] Verify all 9 OTA credential columns display correctly in desktop view
- [ ] Test filtering by each OTA type
- [ ] Test filtering by Expedia ID
- [ ] Test filtering by Agoda username
- [ ] Test filtering by Booking password
- [ ] Test combining multiple filters
- [ ] Test pagination with filters applied
- [ ] Test CSV export includes all OTA columns
- [ ] Test Excel export includes all OTA columns
- [ ] Test mobile card view shows collapsible OTA sections
- [ ] Test password fields are properly masked/displayed
- [ ] Test null values display as "-" or empty
- [ ] Test OTA type badges render correctly
- [ ] Test responsive design switches between table and card views
- [ ] Test loading states and error handling

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

#### Audit Module
- [ ] Update TypeScript interfaces (type_of_ota as array)
- [ ] Update list/table displays (show badges/tags)
- [ ] Update filter components (single select still works)
- [ ] Update create/edit forms (add multi-select)
- [ ] Update Excel import/export handling
- [ ] Update global stats display
- [ ] Test all CRUD operations
- [ ] Test filtering
- [ ] Test bulk operations

#### Global Report Module
- [ ] Create `GlobalReportRow` TypeScript interface
- [ ] Create `OtaCredentialFilter` interface
- [ ] Build `useGlobalReportFilters` hook
- [ ] Build `GlobalReportFilters` component with:
  - [ ] OTA type multi-select
  - [ ] Expedia ID/username filters
  - [ ] Agoda ID/username filters
  - [ ] Booking ID/username filters
- [ ] Build `GlobalReportTable` component (desktop):
  - [ ] Add 9 new OTA credential columns
  - [ ] Display OTA type badges
  - [ ] Handle null values ("-")
  - [ ] Add password masking/visibility
- [ ] Build `GlobalReportCard` component (mobile):
  - [ ] Collapsible OTA sections
  - [ ] Expedia, Agoda, Booking credentials
- [ ] Build main `GlobalReportPage` component:
  - [ ] Integrate filters
  - [ ] Fetch report data with filters
  - [ ] Handle pagination
  - [ ] Switch between table/card views (responsive)
- [ ] Update export functionality:
  - [ ] Verify CSV includes all OTA columns
  - [ ] Verify Excel includes all OTA columns
- [ ] Add CSS styling for:
  - [ ] Table layout (9 new columns)
  - [ ] OTA badges (Expedia, Agoda, Booking colors)
  - [ ] Card view (mobile)
  - [ ] Filter sections
- [ ] Test global report thoroughly:
  - [ ] Test all filter combinations
  - [ ] Test pagination with filters
  - [ ] Test export formats
  - [ ] Test mobile responsive view
  - [ ] Test password field display

#### Documentation
- [ ] Update user documentation
- [ ] Create migration guide for team
- [ ] Document new filter capabilities

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

## Quick Reference: Global Report API Endpoints

### Main Report Endpoint
```typescript
POST /api/global-report
Body: {
  filters: ColumnFilter[]
  sort: SortConfig[]
  page: number
  limit: number
  excludeArchived?: boolean
}

Response: {
  success: boolean
  data: GlobalReportRow[]
  metadata: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### Filter Data Endpoints

#### Combined Endpoints (Grouped by OTA)
```typescript
GET /api/global-report/ota-ids
Response: { data: [{ otaId: string, otaType: string }] }

GET /api/global-report/ota-usernames
Response: { data: [{ username: string, otaType: string }] }

GET /api/global-report/ota-passwords
Response: { data: [{ password: string, otaType: string }] }
```

#### Individual OTA Endpoints (Flat Arrays)
```typescript
// Expedia
GET /api/global-report/expedia-ids
GET /api/global-report/expedia-usernames
GET /api/global-report/expedia-passwords

// Agoda
GET /api/global-report/agoda-ids
GET /api/global-report/agoda-usernames
GET /api/global-report/agoda-passwords

// Booking
GET /api/global-report/booking-ids
GET /api/global-report/booking-usernames
GET /api/global-report/booking-passwords

// All return: { data: string[] }
```

### Export Endpoint
```typescript
POST /api/global-report/export
Body: {
  format: 'csv' | 'xlsx'
  filters: ColumnFilter[]
  sort?: SortConfig[]
  columns?: string[]  // Optional: specific columns to include
}

Response: File download (binary)
```

### Filter Format Examples

#### Filter by OTA Type
```json
{
  "column": "otaType",
  "operator": "eq",
  "value": "expedia"
}
```

#### Filter by Expedia ID
```json
{
  "column": "expediaId",
  "operator": "contains",
  "value": "EXP-12345"
}
```

#### Filter by Multiple OTA Types
```json
{
  "column": "otaType",
  "operator": "in",
  "value": ["expedia", "agoda"]
}
```

#### Filter by Agoda Username
```json
{
  "column": "agodaUsername",
  "operator": "eq",
  "value": "user@agoda.com"
}
```

#### Filter by Date Range
```json
{
  "column": "startDate",
  "operator": "between",
  "value": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  }
}
```

### Available Filter Operators by Column Type

**OTA Type (Array):**
- `eq` - Array contains specific value
- `in` - Array contains any of the values
- `isNull` - Array is empty
- `isNotNull` - Array is not empty

**OTA Credentials (String):**
- `eq` - Exact match
- `contains` - Partial match
- `in` - Match any of values
- `startsWith` - Starts with value
- `endsWith` - Ends with value
- `isNull` - Field is null
- `isNotNull` - Field is not null

**Dates:**
- `eq`, `gt`, `gte`, `lt`, `lte`
- `between` - { from, to }
- `isNull`, `isNotNull`

**Numbers:**
- `eq`, `gt`, `gte`, `lt`, `lte`
- `between` - { from, to }
- `isNull`, `isNotNull`

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
