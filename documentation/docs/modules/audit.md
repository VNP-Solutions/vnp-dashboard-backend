---
sidebar_position: 4
title: Audit Module
---

# Audit Module

**Path:** `src/modules/audit/`

Related: `audit-status`, `audit-batch`.

## Purpose

Audit CRUD, archive/unarchive, bulk import/update, report uploads, confirmed amounts, batches, and global stats.

## Permissions

`audit_permission`.

## Notable behaviors

- **`type_of_ota` is an array** (`expedia` | `agoda` | `booking`) — see [OTA Amounts](../deep-dives/ota-amounts)
- Per-OTA confirmed amounts with role-based update rules — [Amount Confirmed](../deep-dives/amount-confirmed)
- Bulk Excel uses comma-separated OTA values
- Multiple report URLs supported
- Password required for deletes

## Live API

Swagger tag **Audit** — [`/api/docs`](pathname:///api/docs).

## Related

- [Global Report](./global-report)
- [OTA Amounts](../deep-dives/ota-amounts)
