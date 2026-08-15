---
sidebar_position: 2
title: Portfolio Module
---

# Portfolio Module

**Path:** `src/modules/portfolio/`

## Purpose

CRUD for portfolios, activation, documents/contract URLs, bank details linkage, bulk import/update, stats, and secure password-gated reads.

## Permissions

`portfolio_permission` — create/read/update/delete with all/partial/none access.

## Notable behaviors

- Delete may require password and empty property list
- Activation/deactivation can create pending actions for non-super-admins
- Cascading delete of properties when portfolio is deleted
- Partial-access users get `UserAccessedProperty` entries on create

## Related modules

- `contract-url`, `portfolio-bank-details`, `sales-agent`, `pending-action`

## Live API

Swagger tag **Portfolio** — [`/api/docs`](pathname:///api/docs).

## Related

- [Property](./property)
- [Permissions](../architecture/permissions)
- [Bank details](../deep-dives/bank-details)
