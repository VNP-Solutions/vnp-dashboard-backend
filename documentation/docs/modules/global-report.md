---
sidebar_position: 7
title: Global Report Module
---

# Global Report Module

**Path:** `src/modules/global-report/`

## Purpose

Configurable MIS reporting across audits/properties with column filters, sorting, pagination, and export.

## Access

Typically requires `can_access_mis` on the role (or super admin). JWT required.

## Notable behaviors

- OTA credentials exposed as **separate columns** per OTA type (expedia/agoda/booking)
- `otaType` filter uses array contains / in operators
- `otaType` is not sortable
- Dedicated filter option endpoints per OTA field

See [OTA Amounts](../deep-dives/ota-amounts) for the data shape.

## Live API

Swagger tag **Global Report** — [`/api/docs`](pathname:///api/docs).

## Related

- [Audit](./audit)
- [OTA Amounts](../deep-dives/ota-amounts)
