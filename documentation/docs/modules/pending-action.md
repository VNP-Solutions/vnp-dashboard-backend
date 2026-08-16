---
sidebar_position: 8
title: Pending Action Module
---

# Pending Action Module

**Path:** `src/modules/pending-action/`

## Purpose

Approval queue for sensitive property/portfolio actions (delete, transfer, bulk transfer, activations).

## Flow

1. User requests action → `PENDING` record
2. Super admin approves or rejects
3. On approve → execute action, status `APPROVED`
4. On reject → store reason, status `REJECTED`

## Enums

- `PropertyActionType`: `DELETE`, `TRANSFER`, `BULK_TRANSFER` (and related portfolio actions where used)
- `PropertyActionStatus`: `PENDING`, `APPROVED`, `REJECTED`

## Access

Primarily super-admin workflows.

## Live API

Swagger — [`/api/docs`](pathname:///api/docs).

## Related

- [Property](./property)
- [Portfolio](./portfolio)
