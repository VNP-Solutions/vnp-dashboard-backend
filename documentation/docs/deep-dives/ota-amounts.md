---
sidebar_position: 1
title: OTA Amounts
---

# OTA Amounts

## Multi-OTA on audits

`type_of_ota` is an **array** of `expedia` | `agoda` | `booking` (unique values, can be empty).

```typescript
type_of_ota: OtaType[]  // not a single enum value
```

### Filtering

`GET /api/audit?type_of_ota=expedia` matches audits whose array **contains** that value.

### Bulk Excel

OTA column accepts comma-separated values: `expedia, agoda`.

### Global stats

Audits with multiple OTAs contribute to **each** OTA bucket; `total` counts each audit once. Sum of OTA buckets may exceed `total`.

## Global report columns

Separate credential columns per OTA:

- `expediaId`, `expediaUsername`, `expediaPassword`
- `agodaId`, `agodaUsername`, `agodaPassword`
- `bookingId`, `bookingUsername`, `bookingPassword`
- `otaType: string[]`

`otaType` supports `eq` / `in` / null checks; it is **not sortable**.

## Frontend implications

Use `.includes()` not `===` for OTA checks. See frontend docs for UI patterns.

## Related

- [Audit module](../modules/audit)
- [Global Report](../modules/global-report)
- [Amount Confirmed](./amount-confirmed)
