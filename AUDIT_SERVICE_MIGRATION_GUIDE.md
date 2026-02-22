# Audit OTA Type Migration - Service Layer Updates

## Changes Required in audit.service.ts

### 1. Filter handling in `findAll` method (line ~188-189)

**OLD:**
```typescript
if (query.type_of_ota) {
  additionalFilters.type_of_ota = query.type_of_ota
}
```

**NEW:**
```typescript
if (query.type_of_ota) {
  // Since type_of_ota is now an array, use "has" operator to check if array contains value
  additionalFilters.type_of_ota = { has: query.type_of_ota }
}
```

### 2. Filter handling in `findAllForExport` method (line ~452-453)

Same change as above for the export function.

### 3. Bulk update OTA type parsing (line ~1226-1239)

**OLD:**
```typescript
// Extract OTA type (if provided)
const otaTypeValue = findHeaderValue(row, [
  'OTA',
  'OTA Type',
  'Ota Type',
  'Ota type',
  'type_of_ota'
])
if (otaTypeValue) {
  const typeOfOta = parseOtaType(otaTypeValue)
  if (typeOfOta) {
    updateData.type_of_ota = typeOfOta
  }
}
```

**NEW:**
```typescript
// Extract OTA type (if provided) - can be comma-separated values
const otaTypeValue = findHeaderValue(row, [
  'OTA',
  'OTA Type',
  'Ota Type',
  'Ota type',
  'type_of_ota'
])
if (otaTypeValue) {
  // Handle comma-separated multiple OTA types
  const otaTypesArray = otaTypeValue.split(',').map(s => s.trim()).filter(s => s)
  const parsedOtaTypes: OtaType[] = []
  
  for (const otaStr of otaTypesArray) {
    const typeOfOta = parseOtaType(otaStr)
    if (typeOfOta && !parsedOtaTypes.includes(typeOfOta)) {
      parsedOtaTypes.push(typeOfOta)
    }
  }
  
  if (parsedOtaTypes.length > 0) {
    updateData.type_of_ota = parsedOtaTypes
  }
}
```

### 4. Bulk import OTA type parsing (line ~1825-1833)

**OLD:**
```typescript
// Extract OTA type
const otaTypeValue = findHeaderValue(row, [
  'OTA',
  'OTA Type',
  'Ota Type',
  'Ota type',
  'type_of_ota'
])
const typeOfOta = otaTypeValue ? parseOtaType(otaTypeValue) : null
```

**NEW:**
```typescript
// Extract OTA type - can be comma-separated values
const otaTypeValue = findHeaderValue(row, [
  'OTA',
  'OTA Type',
  'Ota Type',
  'Ota type',
  'type_of_ota'
])

let typeOfOtaArray: OtaType[] = []
if (otaTypeValue) {
  const otaTypesArray = otaTypeValue.split(',').map(s => s.trim()).filter(s => s)
  for (const otaStr of otaTypesArray) {
    const parsedType = parseOtaType(otaStr)
    if (parsedType && !typeOfOtaArray.includes(parsedType)) {
      typeOfOtaArray.push(parsedType)
    }
  }
}
```

And update the audit creation data (line ~1992-2002):

**OLD:**
```typescript
// Create audit data
const auditData: CreateAuditDto = {
  property_id: property.id,
  audit_status_id: auditStatus.id,
  start_date: startDate ? startDate.toISOString() : undefined,
  end_date: endDate ? endDate.toISOString() : undefined,
  type_of_ota: typeOfOta || undefined,
  amount_collectable: amountCollectable,
  amount_confirmed: amountConfirmed,
  report_url: reportUrl,
  batch_id: batchId
}
```

**NEW:**
```typescript
// Create audit data
const auditData: CreateAuditDto = {
  property_id: property.id,
  audit_status_id: auditStatus.id,
  start_date: startDate ? startDate.toISOString() : undefined,
  end_date: endDate ? endDate.toISOString() : undefined,
  type_of_ota: typeOfOtaArray.length > 0 ? typeOfOtaArray : undefined,
  amount_collectable: amountCollectable,
  amount_confirmed: amountConfirmed,
  report_url: reportUrl,
  batch_id: batchId
}
```

And update the success log (line ~2007):

**OLD:**
```typescript
const auditDescription = `${expediaId} - ${typeOfOta ? typeOfOta : 'Unknown OTA'} Audit`
```

**NEW:**
```typescript
const auditDescription = `${expediaId} - ${typeOfOtaArray.length > 0 ? typeOfOtaArray.join(', ') : 'Unknown OTA'} Audit`
```

And update the console log (line ~2012):

**OLD:**
```typescript
`✅ Row ${rowNumber} SUCCESS: Created audit for Expedia ID '${expediaId}' (${typeOfOta || 'Unknown OTA'})`
```

**NEW:**
```typescript
`✅ Row ${rowNumber} SUCCESS: Created audit for Expedia ID '${expediaId}' (${typeOfOtaArray.join(', ') || 'Unknown OTA'})`
```

### 5. Global stats aggregation (line ~2140-2194)

**OLD:**
```typescript
// Get aggregate data for amount collectable and confirmed by OTA type
const auditAggregates = await this.prisma.audit.groupBy({
  by: ['type_of_ota'],
  where: whereClause,
  _sum: {
    amount_collectable: true,
    amount_confirmed: true
  }
})

// ... processing code ...

// Process aggregated data
auditAggregates.forEach(aggregate => {
  const collectableAmount = aggregate._sum.amount_collectable || 0
  const confirmedAmount = aggregate._sum.amount_confirmed || 0

  amountCollectable.total += collectableAmount
  amountConfirmed.total += confirmedAmount

  if (aggregate.type_of_ota === 'expedia') {
    amountCollectable.expedia += collectableAmount
    amountConfirmed.expedia += confirmedAmount
  } else if (aggregate.type_of_ota === 'booking') {
    amountCollectable.booking += collectableAmount
    amountConfirmed.booking += confirmedAmount
  } else if (aggregate.type_of_ota === 'agoda') {
    amountCollectable.agoda += collectableAmount
    amountConfirmed.agoda += confirmedAmount
  }
})
```

**NEW:**
```typescript
// Since type_of_ota is now an array, we need to fetch all audits and process them
const audits = await this.prisma.audit.findMany({
  where: whereClause,
  select: {
    type_of_ota: true,
    amount_collectable: true,
    amount_confirmed: true
  }
})

// Process each audit and count amounts by OTA type
// Note: An audit with multiple OTA types contributes to each OTA's total
audits.forEach(audit => {
  const collectableAmount = audit.amount_collectable || 0
  const confirmedAmount = audit.amount_confirmed || 0

  // Add to total (each audit counted once for total)
  amountCollectable.total += collectableAmount
  amountConfirmed.total += confirmedAmount

  // Add to each OTA type's total if present in the array
  if (audit.type_of_ota && Array.isArray(audit.type_of_ota)) {
    audit.type_of_ota.forEach(ota => {
      if (ota === 'expedia') {
        amountCollectable.expedia += collectableAmount
        amountConfirmed.expedia += confirmedAmount
      } else if (ota === 'booking') {
        amountCollectable.booking += collectableAmount
        amountConfirmed.booking += confirmedAmount
      } else if (ota === 'agoda') {
        amountCollectable.agoda += collectableAmount
        amountConfirmed.agoda += confirmedAmount
      }
    })
  }
})
```

### 6. Email notification audit name generation (line ~2325-2327 and ~2543-2545)

**OLD:**
```typescript
// Generate audit name (type_of_ota + " Audit")
const auditName = audit.type_of_ota
  ? `${audit.type_of_ota.charAt(0).toUpperCase() + audit.type_of_ota.slice(1)} Audit`
  : 'Audit'
```

**NEW:**
```typescript
// Generate audit name from type_of_ota array
const auditName = audit.type_of_ota && audit.type_of_ota.length > 0
  ? audit.type_of_ota.map((ota: string) => 
      `${ota.charAt(0).toUpperCase() + ota.slice(1)}`
    ).join(' + ') + ' Audit'
  : 'Audit'
```

Apply this change in both:
- `sendAuditStatusChangeNotification` method (around line 2325)
- `sendReportUrlUpdateNotification` method (around line 2543)

## Testing Recommendations

After implementing these changes:

1. Test create audit with single OTA type: `["expedia"]`
2. Test create audit with multiple OTA types: `["expedia", "agoda"]`
3. Test create audit with empty array: `[]`
4. Test filtering by OTA type (should use `has` operator)
5. Test bulk import with comma-separated OTA types
6. Test bulk update with comma-separated OTA types
7. Test global stats calculation with mixed single and multiple OTA audits
8. Test email notifications with multiple OTA types
