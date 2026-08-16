---
sidebar_position: 3
title: Property Module
---

# Property Module

**Path:** `src/modules/property/`

## Purpose

Property CRUD, credentials, sharing across portfolios, transfers, bulk ops, exports, and consolidated reports access rules.

## Permissions

`property_permission` (+ `bank_details_permission` for financial fields).

## Notable behaviors

- **Shared properties** — `show_in_portfolio[]`; shared access is view-only (`access_type: shared`)
- **Transfers** — password required; may go through pending actions
- **Delete** — audits must be archived first
- **Bulk import/update** — Excel via dedicated endpoints; return success/failure counts
- Related: `property-credentials`, `property-bank-details`, `property-contract-url`, `consolidated-report`

## Live API

Swagger tag **Property** — [`/api/docs`](pathname:///api/docs).

## Related

- [Portfolio](./portfolio)
- [Pending Action](./pending-action)
- [Bank details](./bank-details)
