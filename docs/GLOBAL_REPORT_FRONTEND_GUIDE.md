# Global Report API - Frontend Implementation Guide

This comprehensive guide provides everything needed to implement the Global Report feature in the frontend using React, TypeScript, and shadcn/ui components.

---

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Data Types & Interfaces](#data-types--interfaces)
4. [API Integration](#api-integration)
5. [Reusable Components Architecture](#reusable-components-architecture)
6. [shadcn/ui Component Recommendations](#shadcnui-component-recommendations)
7. [Filter System Implementation](#filter-system-implementation)
8. [Sorting Implementation](#sorting-implementation)
9. [Pagination Implementation](#pagination-implementation)
10. [Export Feature Implementation](#export-feature-implementation)
11. [State Management](#state-management)
12. [Complete Implementation Example](#complete-implementation-example)

---

## Overview

The Global Report API provides audit-based reporting with Excel-like filtering capabilities. It allows Super Admins to:

- View all audits across portfolios and properties in a single table
- Filter on any column using various operators (equals, contains, greater than, date ranges, etc.)
- Sort by multiple columns
- Export filtered data to CSV or Excel

### Key Features

- **Metadata-driven UI**: Column definitions come from the API, enabling dynamic filter/sort controls
- **Excel-like filtering**: 16 different filter operators based on column data types
- **Multi-column sorting**: Sort by multiple fields simultaneously
- **Pagination**: Server-side pagination with configurable page size (max 100)
- **Export**: Download filtered results as CSV or XLSX

---

## API Endpoints

### Base URL

```
/api/global-report
```

### 1. Get Column Metadata

Retrieve column definitions for building the filter UI dynamically.

```http
GET /api/global-report/columns
```

**Response:**

```json
{
  "success": true,
  "data": {
    "columns": [
      {
        "key": "portfolioName",
        "label": "Portfolio",
        "dataType": "string",
        "filterable": true,
        "sortable": true,
        "allowedOperators": ["eq", "neq", "in", "nin", "contains", "startsWith", "isNull", "isNotNull"],
        "enumValues": null
      },
      {
        "key": "otaType",
        "label": "OTA Type",
        "dataType": "enum",
        "filterable": true,
        "sortable": true,
        "allowedOperators": ["eq", "neq", "in", "nin", "isNull", "isNotNull"],
        "enumValues": ["expedia", "agoda", "booking"]
      },
      {
        "key": "startDate",
        "label": "Start Date",
        "dataType": "date",
        "filterable": true,
        "sortable": true,
        "allowedOperators": ["eq", "before", "after", "between", "isNull", "isNotNull"]
      },
      {
        "key": "amountCollectable",
        "label": "Amount Collectable",
        "dataType": "number",
        "filterable": true,
        "sortable": true,
        "allowedOperators": ["eq", "neq", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"]
      }
      // ... more columns
    ]
  }
}
```

### 2. Query Report Data

Fetch paginated report data with filters and sorting.

```http
POST /api/global-report
Content-Type: application/json
```

**Request Body:**

```json
{
  "page": 1,
  "limit": 25,
  "filters": [
    { "column": "portfolioName", "operator": "contains", "value": "Marriott" },
    { "column": "amountCollectable", "operator": "gte", "value": 1000 },
    { "column": "startDate", "operator": "between", "value": { "from": "2024-01-01", "to": "2024-12-31" } },
    { "column": "otaType", "operator": "in", "value": ["expedia", "booking"] }
  ],
  "sort": [
    { "column": "startDate", "order": "desc" },
    { "column": "portfolioName", "order": "asc" }
  ],
  "includeArchived": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "auditId": "507f1f77bcf86cd799439011",
        "portfolioName": "Marriott International",
        "propertyName": "Marriott Downtown",
        "otaType": "expedia",
        "billingType": "VCC",
        "auditStatus": "Reported to Property",
        "startDate": "2024-06-01T00:00:00.000Z",
        "endDate": "2024-06-30T00:00:00.000Z",
        "nextDueDate": "2024-07-15T00:00:00.000Z",
        "currency": "USD",
        "currencySymbol": "$",
        "amountCollectable": 5000,
        "amountConfirmed": null,
        "portfolioContactEmail": "contact@marriott.com",
        "serviceType": "VCC",
        "expediaId": "12345",
        "expediaUsername": "marriott_user",
        "agodaId": null,
        "bookingId": null,
        "bankType": "bank",
        "isArchived": false,
        "propertyId": "507f1f77bcf86cd799439022",
        "portfolioId": "507f1f77bcf86cd799439033",
        "propertyIsActive": true,
        "reportUrl": null,
        "auditCreatedAt": "2024-06-01T10:00:00.000Z",
        "auditUpdatedAt": "2024-06-15T14:30:00.000Z"
      }
      // ... more rows
    ],
    "metadata": {
      "totalDocuments": 1500,
      "currentPage": 1,
      "totalPages": 60,
      "pageSize": 25
    }
  }
}
```

### 3. Export Report Data

Export filtered data to CSV or Excel.

```http
POST /api/global-report/export
Content-Type: application/json
```

**Request Body:**

```json
{
  "format": "xlsx",
  "filters": [
    { "column": "portfolioName", "operator": "contains", "value": "Marriott" }
  ],
  "sort": [
    { "column": "startDate", "order": "desc" }
  ],
  "columns": ["portfolioName", "propertyName", "otaType", "amountCollectable", "startDate"],
  "includeArchived": false
}
```

**Response:** Binary file download (CSV or XLSX)

---

## Data Types & Interfaces

### TypeScript Interfaces

Create these interfaces in your frontend codebase:

```typescript
// types/global-report.ts

// ============== Column Metadata ==============

export type ColumnDataType = 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'objectId'

export type FilterOperator =
  | 'eq'        // Equals
  | 'neq'       // Not equals
  | 'in'        // In array
  | 'nin'       // Not in array
  | 'contains'  // String contains (case-insensitive)
  | 'startsWith'// String starts with
  | 'endsWith'  // String ends with
  | 'gt'        // Greater than
  | 'gte'       // Greater than or equal
  | 'lt'        // Less than
  | 'lte'       // Less than or equal
  | 'before'    // Date before
  | 'after'     // Date after
  | 'between'   // Range (date or number)
  | 'isNull'    // Is null/undefined
  | 'isNotNull' // Is not null/undefined

export interface ColumnMetadata {
  key: string
  label: string
  dataType: ColumnDataType
  filterable: boolean
  sortable: boolean
  allowedOperators: FilterOperator[]
  enumValues?: string[]
}

export interface ColumnsMetadataResponse {
  columns: ColumnMetadata[]
}

// ============== Filter & Sort ==============

export interface ColumnFilter {
  column: string
  operator: FilterOperator
  value: any // string | number | boolean | string[] | { from: string; to: string }
}

export interface SortConfig {
  column: string
  order: 'asc' | 'desc'
}

// ============== Request DTOs ==============

export interface GlobalReportQueryRequest {
  page?: number
  limit?: number
  filters?: ColumnFilter[]
  sort?: SortConfig[]
  includeArchived?: boolean
}

export interface GlobalReportExportRequest extends GlobalReportQueryRequest {
  format: 'csv' | 'xlsx'
  columns?: string[] // Subset of columns to export
}

// ============== Response DTOs ==============

export interface ReportRow {
  auditId: string
  otaType: string | null
  billingType: string | null
  startDate: string | null
  endDate: string | null
  amountCollectable: number | null
  amountConfirmed: number | null
  isArchived: boolean
  auditStatus: string | null
  batchNo: string | null
  propertyId: string
  propertyName: string
  propertyAddress: string | null
  propertyIsActive: boolean
  nextDueDate: string | null
  currency: string
  currencySymbol: string | null
  portfolioId: string
  portfolioName: string
  portfolioContactEmail: string | null
  serviceType: string | null
  expediaId: string | null
  expediaUsername: string | null
  agodaId: string | null
  agodaUsername: string | null
  bookingId: string | null
  bookingUsername: string | null
  bankType: string | null
  reportUrl: string | null
  auditCreatedAt: string
  auditUpdatedAt: string
}

export interface PaginationMetadata {
  totalDocuments: number
  currentPage: number
  totalPages: number
  pageSize: number
}

export interface GlobalReportResponse {
  data: ReportRow[]
  metadata: PaginationMetadata
}

// ============== UI State ==============

export interface ActiveFilter extends ColumnFilter {
  id: string // Unique ID for React key
}

export interface GlobalReportState {
  columns: ColumnMetadata[]
  data: ReportRow[]
  metadata: PaginationMetadata | null
  filters: ActiveFilter[]
  sort: SortConfig[]
  page: number
  limit: number
  includeArchived: boolean
  isLoading: boolean
  isExporting: boolean
  error: string | null
}
```

---

## API Integration

### API Service Layer

Create a dedicated service for Global Report API calls:

```typescript
// services/global-report.service.ts

import axios from 'axios'
import type {
  ColumnsMetadataResponse,
  GlobalReportQueryRequest,
  GlobalReportExportRequest,
  GlobalReportResponse
} from '@/types/global-report'

const API_BASE = '/api/global-report'

export const globalReportService = {
  /**
   * Fetch column metadata for building dynamic filter UI
   */
  async getColumns(): Promise<ColumnsMetadataResponse> {
    const response = await axios.get(`${API_BASE}/columns`)
    return response.data.data
  },

  /**
   * Query report data with filters, sort, and pagination
   */
  async getReport(request: GlobalReportQueryRequest): Promise<GlobalReportResponse> {
    const response = await axios.post(API_BASE, request)
    return response.data.data
  },

  /**
   * Export report data to file
   */
  async exportReport(request: GlobalReportExportRequest): Promise<Blob> {
    const response = await axios.post(`${API_BASE}/export`, request, {
      responseType: 'blob'
    })
    return response.data
  }
}

// Helper to trigger file download
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
```

### React Query Integration (Recommended)

```typescript
// hooks/use-global-report.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { globalReportService, downloadFile } from '@/services/global-report.service'
import type {
  GlobalReportQueryRequest,
  GlobalReportExportRequest
} from '@/types/global-report'

// Query keys
export const globalReportKeys = {
  all: ['global-report'] as const,
  columns: () => [...globalReportKeys.all, 'columns'] as const,
  report: (params: GlobalReportQueryRequest) => [...globalReportKeys.all, 'report', params] as const
}

/**
 * Fetch column metadata (cached indefinitely as it rarely changes)
 */
export function useGlobalReportColumns() {
  return useQuery({
    queryKey: globalReportKeys.columns(),
    queryFn: globalReportService.getColumns,
    staleTime: Infinity, // Columns don't change during session
    gcTime: Infinity
  })
}

/**
 * Fetch report data with filters, sort, and pagination
 */
export function useGlobalReportData(params: GlobalReportQueryRequest) {
  return useQuery({
    queryKey: globalReportKeys.report(params),
    queryFn: () => globalReportService.getReport(params),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  })
}

/**
 * Export mutation
 */
export function useGlobalReportExport() {
  return useMutation({
    mutationFn: async (request: GlobalReportExportRequest) => {
      const blob = await globalReportService.exportReport(request)
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `global-report-${timestamp}.${request.format}`
      downloadFile(blob, filename)
    }
  })
}
```

---

## Reusable Components Architecture

The key to a maintainable implementation is creating reusable components that work with the column metadata.

### Component Hierarchy

```
GlobalReportPage
├── GlobalReportToolbar
│   ├── FilterBuilder (reusable)
│   │   ├── FilterRow (reusable)
│   │   │   ├── ColumnSelect
│   │   │   ├── OperatorSelect (dynamic based on column)
│   │   │   └── ValueInput (dynamic based on dataType + operator)
│   │   │       ├── TextInput (string)
│   │   │       ├── NumberInput (number)
│   │   │       ├── DatePicker (date)
│   │   │       ├── DateRangePicker (date + between)
│   │   │       ├── NumberRangePicker (number + between)
│   │   │       ├── MultiSelect (enum + in/nin)
│   │   │       ├── SingleSelect (enum + eq/neq)
│   │   │       └── BooleanToggle (boolean)
│   │   └── AddFilterButton
│   ├── SortBuilder (reusable)
│   └── ExportButton
├── GlobalReportTable
│   ├── TableHeader (with sort indicators)
│   └── TableBody
└── GlobalReportPagination
```

### Base Filter Value Input Component

This is the most important reusable component - it renders the appropriate input based on column metadata:

```typescript
// components/global-report/filter-value-input.tsx

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ColumnMetadata, FilterOperator } from '@/types/global-report'

interface FilterValueInputProps {
  column: ColumnMetadata
  operator: FilterOperator
  value: any
  onChange: (value: any) => void
}

export function FilterValueInput({
  column,
  operator,
  value,
  onChange
}: FilterValueInputProps) {
  // No value input needed for null checks
  if (operator === 'isNull' || operator === 'isNotNull') {
    return <span className="text-muted-foreground text-sm italic">No value needed</span>
  }

  // Determine input type based on column dataType and operator
  const { dataType, enumValues } = column

  // ENUM type handling
  if (dataType === 'enum' && enumValues) {
    // Multi-select for 'in' and 'nin' operators
    if (operator === 'in' || operator === 'nin') {
      return (
        <EnumMultiSelect
          options={enumValues}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )
    }
    // Single select for 'eq' and 'neq'
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select value" />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map(opt => (
            <SelectItem key={opt} value={opt}>
              {formatEnumLabel(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // BOOLEAN type
  if (dataType === 'boolean') {
    return (
      <Select value={String(value)} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  // DATE type
  if (dataType === 'date') {
    // Date range for 'between'
    if (operator === 'between') {
      return (
        <DateRangeInput
          value={value || { from: '', to: '' }}
          onChange={onChange}
        />
      )
    }
    // Single date picker
    return (
      <DateInput
        value={value}
        onChange={onChange}
      />
    )
  }

  // NUMBER type
  if (dataType === 'number') {
    // Number range for 'between'
    if (operator === 'between') {
      return (
        <NumberRangeInput
          value={value || { from: '', to: '' }}
          onChange={onChange}
        />
      )
    }
    // Single number input
    return (
      <Input
        type="number"
        placeholder="Enter number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-[150px]"
      />
    )
  }

  // STRING type (default)
  // Multi-value input for 'in' and 'nin'
  if (operator === 'in' || operator === 'nin') {
    return (
      <Input
        placeholder="value1, value2, ..."
        value={Array.isArray(value) ? value.join(', ') : value || ''}
        onChange={(e) => {
          const vals = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
          onChange(vals.length > 0 ? vals : null)
        }}
        className="w-[200px]"
      />
    )
  }

  // Default text input
  return (
    <Input
      placeholder="Enter value"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-[180px]"
    />
  )
}

// ============== Helper Components ==============

function EnumMultiSelect({
  options,
  value,
  onChange
}: {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  // Use shadcn Command/Combobox for multi-select
  // See: https://ui.shadcn.com/docs/components/combobox
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-start">
          {value.length > 0 ? `${value.length} selected` : 'Select values...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2">
        <div className="space-y-2">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...value, opt])
                  } else {
                    onChange(value.filter(v => v !== opt))
                  }
                }}
              />
              <span>{formatEnumLabel(opt)}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DateInput({
  value,
  onChange
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const date = value ? new Date(value) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[180px] justify-start text-left font-normal',
            !date && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : 'Pick a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? d.toISOString() : null)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function DateRangeInput({
  value,
  onChange
}: {
  value: { from: string; to: string }
  onChange: (value: { from: string; to: string }) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <DateInput
        value={value.from}
        onChange={(from) => onChange({ ...value, from: from || '' })}
      />
      <span className="text-muted-foreground">to</span>
      <DateInput
        value={value.to}
        onChange={(to) => onChange({ ...value, to: to || '' })}
      />
    </div>
  )
}

function NumberRangeInput({
  value,
  onChange
}: {
  value: { from: number | string; to: number | string }
  onChange: (value: { from: number; to: number }) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder="From"
        value={value.from}
        onChange={(e) => onChange({
          ...value,
          from: e.target.value ? Number(e.target.value) : 0
        } as any)}
        className="w-[100px]"
      />
      <span className="text-muted-foreground">to</span>
      <Input
        type="number"
        placeholder="To"
        value={value.to}
        onChange={(e) => onChange({
          ...value,
          to: e.target.value ? Number(e.target.value) : 0
        } as any)}
        className="w-[100px]"
      />
    </div>
  )
}

// Format enum values for display
function formatEnumLabel(value: string): string {
  // Convert snake_case or lowercase to Title Case
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
```

---

## shadcn/ui Component Recommendations

### Required Components

Install these shadcn/ui components:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add command
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tooltip
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add card
npx shadcn-ui@latest add separator
```

### Component Usage Map

| Feature | shadcn Components |
|---------|-------------------|
| **Data Table** | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead` |
| **Column Filters** | `Popover`, `Command`, `Select`, `Input`, `Calendar` |
| **Filter Chips** | `Badge` with close button |
| **Sort Dropdown** | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` |
| **Pagination** | `Button` group with page numbers |
| **Export Dialog** | `Dialog`, `DialogTrigger`, `DialogContent`, `Select`, `Button` |
| **Loading States** | `Skeleton` |
| **Tooltips** | `Tooltip`, `TooltipTrigger`, `TooltipContent` |
| **Column Visibility** | `DropdownMenu` with checkboxes |
| **Filter Builder** | `Card`, `Popover`, `Button`, `Select` |

---

## Filter System Implementation

### Operator Labels and Descriptions

```typescript
// lib/filter-operators.ts

import type { FilterOperator, ColumnDataType } from '@/types/global-report'

export interface OperatorInfo {
  value: FilterOperator
  label: string
  description: string
}

// All available operators with human-readable labels
export const OPERATOR_INFO: Record<FilterOperator, OperatorInfo> = {
  eq: { value: 'eq', label: 'Equals', description: 'Exact match' },
  neq: { value: 'neq', label: 'Not equals', description: 'Does not equal' },
  in: { value: 'in', label: 'Is one of', description: 'Matches any value in list' },
  nin: { value: 'nin', label: 'Is not one of', description: 'Does not match any value in list' },
  contains: { value: 'contains', label: 'Contains', description: 'Text contains (case-insensitive)' },
  startsWith: { value: 'startsWith', label: 'Starts with', description: 'Text starts with' },
  endsWith: { value: 'endsWith', label: 'Ends with', description: 'Text ends with' },
  gt: { value: 'gt', label: 'Greater than', description: 'Value is greater than' },
  gte: { value: 'gte', label: 'Greater or equal', description: 'Value is greater than or equal' },
  lt: { value: 'lt', label: 'Less than', description: 'Value is less than' },
  lte: { value: 'lte', label: 'Less or equal', description: 'Value is less than or equal' },
  before: { value: 'before', label: 'Before', description: 'Date is before' },
  after: { value: 'after', label: 'After', description: 'Date is after' },
  between: { value: 'between', label: 'Between', description: 'Value is in range' },
  isNull: { value: 'isNull', label: 'Is empty', description: 'Value is null or empty' },
  isNotNull: { value: 'isNotNull', label: 'Is not empty', description: 'Value exists' }
}

// Get operators for a specific column
export function getOperatorsForColumn(column: ColumnMetadata): OperatorInfo[] {
  return column.allowedOperators.map(op => OPERATOR_INFO[op])
}

// Get default operator for a data type
export function getDefaultOperator(dataType: ColumnDataType): FilterOperator {
  switch (dataType) {
    case 'string':
      return 'contains'
    case 'number':
      return 'eq'
    case 'date':
      return 'after'
    case 'boolean':
      return 'eq'
    case 'enum':
      return 'eq'
    case 'objectId':
      return 'eq'
    default:
      return 'eq'
  }
}
```

### Filter Row Component

```typescript
// components/global-report/filter-row.tsx

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { FilterValueInput } from './filter-value-input'
import { getOperatorsForColumn, OPERATOR_INFO, getDefaultOperator } from '@/lib/filter-operators'
import type { ColumnMetadata, ActiveFilter, FilterOperator } from '@/types/global-report'

interface FilterRowProps {
  filter: ActiveFilter
  columns: ColumnMetadata[]
  onChange: (filter: ActiveFilter) => void
  onRemove: () => void
}

export function FilterRow({ filter, columns, onChange, onRemove }: FilterRowProps) {
  const selectedColumn = columns.find(c => c.key === filter.column)
  const availableOperators = selectedColumn ? getOperatorsForColumn(selectedColumn) : []

  const handleColumnChange = (columnKey: string) => {
    const column = columns.find(c => c.key === columnKey)
    if (column) {
      onChange({
        ...filter,
        column: columnKey,
        operator: getDefaultOperator(column.dataType),
        value: null
      })
    }
  }

  const handleOperatorChange = (operator: FilterOperator) => {
    // Reset value when operator changes to prevent invalid states
    let newValue = filter.value
    if (operator === 'between' && typeof filter.value !== 'object') {
      newValue = { from: '', to: '' }
    } else if ((operator === 'in' || operator === 'nin') && !Array.isArray(filter.value)) {
      newValue = []
    } else if (operator === 'isNull' || operator === 'isNotNull') {
      newValue = null
    }
    onChange({ ...filter, operator, value: newValue })
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      {/* Column Select */}
      <Select value={filter.column} onValueChange={handleColumnChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {columns.filter(c => c.filterable).map(col => (
            <SelectItem key={col.key} value={col.key}>
              {col.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select
        value={filter.operator}
        onValueChange={(v) => handleOperatorChange(v as FilterOperator)}
        disabled={!selectedColumn}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {availableOperators.map(op => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      {selectedColumn && (
        <FilterValueInput
          column={selectedColumn}
          operator={filter.operator}
          value={filter.value}
          onChange={(value) => onChange({ ...filter, value })}
        />
      )}

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

### Filter Builder Component

```typescript
// components/global-report/filter-builder.tsx

import React from 'react'
import { Plus, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { FilterRow } from './filter-row'
import { getDefaultOperator, OPERATOR_INFO } from '@/lib/filter-operators'
import type { ColumnMetadata, ActiveFilter } from '@/types/global-report'
import { nanoid } from 'nanoid'

interface FilterBuilderProps {
  columns: ColumnMetadata[]
  filters: ActiveFilter[]
  onChange: (filters: ActiveFilter[]) => void
}

export function FilterBuilder({ columns, filters, onChange }: FilterBuilderProps) {
  const addFilter = () => {
    const firstFilterableColumn = columns.find(c => c.filterable)
    if (firstFilterableColumn) {
      const newFilter: ActiveFilter = {
        id: nanoid(),
        column: firstFilterableColumn.key,
        operator: getDefaultOperator(firstFilterableColumn.dataType),
        value: null
      }
      onChange([...filters, newFilter])
    }
  }

  const updateFilter = (id: string, updatedFilter: ActiveFilter) => {
    onChange(filters.map(f => f.id === id ? updatedFilter : f))
  }

  const removeFilter = (id: string) => {
    onChange(filters.filter(f => f.id !== id))
  }

  const clearAllFilters = () => {
    onChange([])
  }

  const getFilterSummary = (filter: ActiveFilter): string => {
    const column = columns.find(c => c.key === filter.column)
    const operatorLabel = OPERATOR_INFO[filter.operator]?.label || filter.operator

    if (filter.operator === 'isNull' || filter.operator === 'isNotNull') {
      return `${column?.label} ${operatorLabel}`
    }

    let valueStr = ''
    if (Array.isArray(filter.value)) {
      valueStr = filter.value.join(', ')
    } else if (typeof filter.value === 'object' && filter.value?.from !== undefined) {
      valueStr = `${filter.value.from} - ${filter.value.to}`
    } else {
      valueStr = String(filter.value ?? '')
    }

    return `${column?.label} ${operatorLabel.toLowerCase()} "${valueStr}"`
  }

  return (
    <div className="space-y-3">
      {/* Active Filters Display */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <Badge
              key={filter.id}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              <span className="max-w-[200px] truncate text-xs">
                {getFilterSummary(filter)}
              </span>
              <button
                onClick={() => removeFilter(filter.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Filter Builder Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            {filters.length > 0 ? `Filters (${filters.length})` : 'Add Filter'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="space-y-3">
            <div className="font-medium">Filters</div>

            {filters.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No filters applied. Click "Add filter" to start.
              </p>
            )}

            {/* Filter Rows */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filters.map(filter => (
                <FilterRow
                  key={filter.id}
                  filter={filter}
                  columns={columns}
                  onChange={(updated) => updateFilter(filter.id, updated)}
                  onRemove={() => removeFilter(filter.id)}
                />
              ))}
            </div>

            {/* Add Filter Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={addFilter}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add filter
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

---

## Sorting Implementation

### Sort Builder Component

```typescript
// components/global-report/sort-builder.tsx

import React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ColumnMetadata, SortConfig } from '@/types/global-report'

interface SortBuilderProps {
  columns: ColumnMetadata[]
  sort: SortConfig[]
  onChange: (sort: SortConfig[]) => void
}

export function SortBuilder({ columns, sort, onChange }: SortBuilderProps) {
  const sortableColumns = columns.filter(c => c.sortable)

  const toggleSort = (columnKey: string) => {
    const existingIndex = sort.findIndex(s => s.column === columnKey)

    if (existingIndex === -1) {
      // Add new sort (default: desc)
      onChange([...sort, { column: columnKey, order: 'desc' }])
    } else {
      const existing = sort[existingIndex]
      if (existing.order === 'desc') {
        // Change to asc
        const newSort = [...sort]
        newSort[existingIndex] = { ...existing, order: 'asc' }
        onChange(newSort)
      } else {
        // Remove sort
        onChange(sort.filter((_, i) => i !== existingIndex))
      }
    }
  }

  const getSortIcon = (columnKey: string) => {
    const existing = sort.find(s => s.column === columnKey)
    if (!existing) return <ArrowUpDown className="h-4 w-4" />
    return existing.order === 'asc'
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />
  }

  const getSortLabel = () => {
    if (sort.length === 0) return 'Sort'
    if (sort.length === 1) {
      const col = columns.find(c => c.key === sort[0].column)
      return `Sort: ${col?.label}`
    }
    return `Sort (${sort.length})`
  }

  const clearSort = () => onChange([])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {getSortLabel()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {sortableColumns.map(col => (
          <DropdownMenuItem
            key={col.key}
            onClick={() => toggleSort(col.key)}
            className="flex items-center justify-between"
          >
            <span>{col.label}</span>
            {getSortIcon(col.key)}
          </DropdownMenuItem>
        ))}
        {sort.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearSort} className="text-muted-foreground">
              <X className="mr-2 h-4 w-4" />
              Clear sort
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Table Header with Sort

```typescript
// components/global-report/sortable-header.tsx

import React from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'
import type { ColumnMetadata, SortConfig } from '@/types/global-report'

interface SortableHeaderProps {
  column: ColumnMetadata
  sort: SortConfig[]
  onSort: (columnKey: string) => void
}

export function SortableHeader({ column, sort, onSort }: SortableHeaderProps) {
  const currentSort = sort.find(s => s.column === column.key)
  const sortIndex = sort.findIndex(s => s.column === column.key)

  if (!column.sortable) {
    return <TableHead>{column.label}</TableHead>
  }

  return (
    <TableHead>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => onSort(column.key)}
      >
        {column.label}
        {currentSort ? (
          <span className="ml-2 flex items-center">
            {currentSort.order === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
            {sort.length > 1 && (
              <span className="ml-1 text-xs text-muted-foreground">
                {sortIndex + 1}
              </span>
            )}
          </span>
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </TableHead>
  )
}
```

---

## Pagination Implementation

```typescript
// components/global-report/pagination.tsx

import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { PaginationMetadata } from '@/types/global-report'

interface PaginationProps {
  metadata: PaginationMetadata
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function Pagination({
  metadata,
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  const { totalDocuments, currentPage, totalPages, pageSize } = metadata

  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalDocuments)

  return (
    <div className="flex items-center justify-between px-2 py-4">
      {/* Record Count */}
      <div className="text-sm text-muted-foreground">
        Showing {startRecord} to {endRecord} of {totalDocuments.toLocaleString()} records
      </div>

      <div className="flex items-center gap-4">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page Info */}
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## Export Feature Implementation

```typescript
// components/global-report/export-dialog.tsx

import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ColumnMetadata, ActiveFilter, SortConfig } from '@/types/global-report'

interface ExportDialogProps {
  columns: ColumnMetadata[]
  filters: ActiveFilter[]
  sort: SortConfig[]
  includeArchived: boolean
  totalRecords: number
  isExporting: boolean
  onExport: (format: 'csv' | 'xlsx', selectedColumns: string[]) => void
}

export function ExportDialog({
  columns,
  filters,
  sort,
  includeArchived,
  totalRecords,
  isExporting,
  onExport
}: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.map(c => c.key)
  )

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  const selectAll = () => setSelectedColumns(columns.map(c => c.key))
  const deselectAll = () => setSelectedColumns([])

  const handleExport = () => {
    onExport(format, selectedColumns)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            Export {totalRecords.toLocaleString()} records with current filters applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'xlsx')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Columns to Export</Label>
              <div className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={deselectAll}>
                  Deselect all
                </Button>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-3">
              {columns.map(col => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`export-col-${col.key}`}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <Label
                    htmlFor={`export-col-${col.key}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedColumns.length} of {columns.length} columns selected
            </p>
          </div>

          {/* Filter Summary */}
          {filters.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <strong>{filters.length}</strong> filter(s) will be applied
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedColumns.length === 0 || isExporting}
          >
            {isExporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## State Management

### Using Zustand (Recommended)

```typescript
// store/global-report-store.ts

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  ColumnMetadata,
  ReportRow,
  PaginationMetadata,
  ActiveFilter,
  SortConfig
} from '@/types/global-report'
import { getDefaultOperator } from '@/lib/filter-operators'

interface GlobalReportState {
  // Data
  columns: ColumnMetadata[]
  data: ReportRow[]
  metadata: PaginationMetadata | null

  // Query params
  filters: ActiveFilter[]
  sort: SortConfig[]
  page: number
  limit: number
  includeArchived: boolean

  // UI state
  isLoading: boolean
  isExporting: boolean
  error: string | null

  // Actions
  setColumns: (columns: ColumnMetadata[]) => void
  setData: (data: ReportRow[], metadata: PaginationMetadata) => void
  setLoading: (loading: boolean) => void
  setExporting: (exporting: boolean) => void
  setError: (error: string | null) => void

  // Filter actions
  addFilter: () => void
  updateFilter: (id: string, filter: ActiveFilter) => void
  removeFilter: (id: string) => void
  clearFilters: () => void

  // Sort actions
  toggleSort: (columnKey: string) => void
  clearSort: () => void

  // Pagination actions
  setPage: (page: number) => void
  setLimit: (limit: number) => void

  // Other actions
  setIncludeArchived: (include: boolean) => void
  reset: () => void
}

const initialState = {
  columns: [],
  data: [],
  metadata: null,
  filters: [],
  sort: [],
  page: 1,
  limit: 25,
  includeArchived: false,
  isLoading: false,
  isExporting: false,
  error: null
}

export const useGlobalReportStore = create<GlobalReportState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setColumns: (columns) => set({ columns }),

      setData: (data, metadata) => set({ data, metadata, error: null }),

      setLoading: (isLoading) => set({ isLoading }),

      setExporting: (isExporting) => set({ isExporting }),

      setError: (error) => set({ error }),

      addFilter: () => {
        const { columns, filters } = get()
        const firstFilterable = columns.find(c => c.filterable)
        if (firstFilterable) {
          const newFilter: ActiveFilter = {
            id: nanoid(),
            column: firstFilterable.key,
            operator: getDefaultOperator(firstFilterable.dataType),
            value: null
          }
          set({ filters: [...filters, newFilter], page: 1 })
        }
      },

      updateFilter: (id, filter) => {
        const { filters } = get()
        set({
          filters: filters.map(f => f.id === id ? filter : f),
          page: 1
        })
      },

      removeFilter: (id) => {
        const { filters } = get()
        set({ filters: filters.filter(f => f.id !== id), page: 1 })
      },

      clearFilters: () => set({ filters: [], page: 1 }),

      toggleSort: (columnKey) => {
        const { sort } = get()
        const existingIndex = sort.findIndex(s => s.column === columnKey)

        if (existingIndex === -1) {
          set({ sort: [...sort, { column: columnKey, order: 'desc' }] })
        } else {
          const existing = sort[existingIndex]
          if (existing.order === 'desc') {
            const newSort = [...sort]
            newSort[existingIndex] = { ...existing, order: 'asc' }
            set({ sort: newSort })
          } else {
            set({ sort: sort.filter((_, i) => i !== existingIndex) })
          }
        }
      },

      clearSort: () => set({ sort: [] }),

      setPage: (page) => set({ page }),

      setLimit: (limit) => set({ limit, page: 1 }),

      setIncludeArchived: (includeArchived) => set({ includeArchived, page: 1 }),

      reset: () => set(initialState)
    }),
    { name: 'global-report-store' }
  )
)
```

---

## Complete Implementation Example

### Main Page Component

```typescript
// pages/global-report/index.tsx

'use client'

import React, { useEffect } from 'react'
import { useGlobalReportStore } from '@/store/global-report-store'
import {
  useGlobalReportColumns,
  useGlobalReportData,
  useGlobalReportExport
} from '@/hooks/use-global-report'
import { FilterBuilder } from '@/components/global-report/filter-builder'
import { SortBuilder } from '@/components/global-report/sort-builder'
import { ExportDialog } from '@/components/global-report/export-dialog'
import { GlobalReportTable } from '@/components/global-report/table'
import { Pagination } from '@/components/global-report/pagination'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default function GlobalReportPage() {
  // Store
  const {
    columns,
    filters,
    sort,
    page,
    limit,
    includeArchived,
    isExporting,
    setColumns,
    setData,
    setLoading,
    setExporting,
    setError,
    updateFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    clearSort,
    setPage,
    setLimit,
    setIncludeArchived
  } = useGlobalReportStore()

  // Fetch columns metadata
  const columnsQuery = useGlobalReportColumns()

  // Fetch report data
  const reportQuery = useGlobalReportData({
    page,
    limit,
    filters: filters.map(({ id, ...rest }) => rest), // Remove 'id' for API
    sort,
    includeArchived
  })

  // Export mutation
  const exportMutation = useGlobalReportExport()

  // Sync columns to store
  useEffect(() => {
    if (columnsQuery.data?.columns) {
      setColumns(columnsQuery.data.columns)
    }
  }, [columnsQuery.data, setColumns])

  // Sync report data to store
  useEffect(() => {
    if (reportQuery.data) {
      setData(reportQuery.data.data, reportQuery.data.metadata)
    }
    setLoading(reportQuery.isLoading)
    if (reportQuery.error) {
      setError((reportQuery.error as Error).message)
    }
  }, [reportQuery.data, reportQuery.isLoading, reportQuery.error, setData, setLoading, setError])

  // Handle export
  const handleExport = async (format: 'csv' | 'xlsx', selectedColumns: string[]) => {
    setExporting(true)
    try {
      await exportMutation.mutateAsync({
        format,
        filters: filters.map(({ id, ...rest }) => rest),
        sort,
        columns: selectedColumns,
        includeArchived
      })
    } finally {
      setExporting(false)
    }
  }

  // Loading state
  if (columnsQuery.isLoading) {
    return (
      <div className="container py-6 space-y-4">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  // Error state
  if (columnsQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load report configuration. Please try again.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4">
            <FilterBuilder
              columns={columns}
              filters={filters}
              onChange={(newFilters) => {
                // Sync with store
                clearFilters()
                newFilters.forEach(f => {
                  const { id, ...rest } = f
                  // Re-add filters through store
                })
                // Or implement bulk update in store
              }}
            />
            <SortBuilder
              columns={columns}
              sort={sort}
              onChange={(newSort) => {
                clearSort()
                newSort.forEach(s => toggleSort(s.column))
              }}
            />
            <ExportDialog
              columns={columns}
              filters={filters}
              sort={sort}
              includeArchived={includeArchived}
              totalRecords={reportQuery.data?.metadata.totalDocuments || 0}
              isExporting={isExporting}
              onExport={handleExport}
            />
          </div>

          {/* Table */}
          <GlobalReportTable
            columns={columns}
            data={reportQuery.data?.data || []}
            sort={sort}
            onSort={toggleSort}
            isLoading={reportQuery.isLoading}
          />

          {/* Pagination */}
          {reportQuery.data?.metadata && (
            <Pagination
              metadata={reportQuery.data.metadata}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### Data Table Component

```typescript
// components/global-report/table.tsx

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from './sortable-header'
import type { ColumnMetadata, ReportRow, SortConfig } from '@/types/global-report'
import { format } from 'date-fns'

interface GlobalReportTableProps {
  columns: ColumnMetadata[]
  data: ReportRow[]
  sort: SortConfig[]
  onSort: (columnKey: string) => void
  isLoading: boolean
}

// Define which columns to show in the table
const VISIBLE_COLUMNS = [
  'portfolioName',
  'propertyName',
  'serviceType',
  'billingType',
  'otaType',
  'auditStatus',
  'startDate',
  'endDate',
  'currency',
  'amountCollectable',
  'amountConfirmed'
]

export function GlobalReportTable({
  columns,
  data,
  sort,
  onSort,
  isLoading
}: GlobalReportTableProps) {
  const visibleColumns = columns.filter(c => VISIBLE_COLUMNS.includes(c.key))

  // Format cell value based on column type
  const formatCellValue = (row: ReportRow, column: ColumnMetadata) => {
    const value = (row as any)[column.key]

    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">-</span>
    }

    switch (column.dataType) {
      case 'date':
        try {
          return format(new Date(value), 'MMM d, yyyy')
        } catch {
          return value
        }

      case 'number':
        if (column.key.includes('amount')) {
          // Format as currency
          const currency = row.currency || 'USD'
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0
          }).format(value)
        }
        return value.toLocaleString()

      case 'boolean':
        return value ? 'Yes' : 'No'

      case 'enum':
        // Style certain enums with badges
        if (column.key === 'otaType') {
          const colors: Record<string, string> = {
            expedia: 'bg-blue-100 text-blue-800',
            agoda: 'bg-purple-100 text-purple-800',
            booking: 'bg-green-100 text-green-800'
          }
          return (
            <Badge variant="secondary" className={colors[value] || ''}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </Badge>
          )
        }
        if (column.key === 'billingType') {
          return <Badge variant="outline">{value}</Badge>
        }
        return value

      default:
        // Truncate long strings
        if (typeof value === 'string' && value.length > 50) {
          return (
            <span title={value}>
              {value.substring(0, 50)}...
            </span>
          )
        }
        return value
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No results found. Try adjusting your filters.
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map(column => (
              <SortableHeader
                key={column.key}
                column={column}
                sort={sort}
                onSort={onSort}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={row.auditId || index}>
              {visibleColumns.map(column => (
                <TableCell key={column.key}>
                  {formatCellValue(row, column)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

## Summary

### Key Implementation Points

1. **Metadata-Driven UI**: Always fetch column metadata first and use it to dynamically build filter/sort controls
2. **Reusable Filter Components**: The `FilterValueInput` component handles all data types automatically
3. **Type Safety**: Use TypeScript interfaces for all API requests/responses
4. **State Management**: Use Zustand or React Query for managing complex filter/sort state
5. **Performance**: Use React Query's caching to avoid unnecessary API calls

### File Structure

```
src/
├── types/
│   └── global-report.ts          # TypeScript interfaces
├── services/
│   └── global-report.service.ts  # API service layer
├── hooks/
│   └── use-global-report.ts      # React Query hooks
├── store/
│   └── global-report-store.ts    # Zustand store
├── lib/
│   └── filter-operators.ts       # Operator utilities
├── components/
│   └── global-report/
│       ├── filter-builder.tsx
│       ├── filter-row.tsx
│       ├── filter-value-input.tsx
│       ├── sort-builder.tsx
│       ├── sortable-header.tsx
│       ├── pagination.tsx
│       ├── export-dialog.tsx
│       └── table.tsx
└── pages/
    └── global-report/
        └── index.tsx             # Main page
```

### Required Dependencies

```bash
npm install @tanstack/react-query zustand nanoid date-fns axios
```

### shadcn/ui Components

```bash
npx shadcn-ui@latest add button input select popover calendar table badge command dropdown-menu dialog tooltip skeleton card separator checkbox label alert
```

---

## API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/global-report/columns` | GET | Get column metadata for UI |
| `/api/global-report` | POST | Query paginated data with filters/sort |
| `/api/global-report/export` | POST | Export filtered data to CSV/XLSX |

### Filter Operators by Data Type

| Data Type | Operators |
|-----------|-----------|
| `string` | eq, neq, in, nin, contains, startsWith, isNull, isNotNull |
| `number` | eq, neq, gt, gte, lt, lte, between, isNull, isNotNull |
| `date` | eq, before, after, between, isNull, isNotNull |
| `boolean` | eq |
| `enum` | eq, neq, in, nin, isNull, isNotNull |
| `objectId` | eq, in |

---

This documentation provides everything needed to implement the Global Report feature in the frontend. The key is to leverage the column metadata from the API to build a dynamic, reusable filter system that works with any column configuration.
