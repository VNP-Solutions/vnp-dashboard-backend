---
sidebar_position: 9
title: Bank Details Modules
---

# Bank Details Modules

**Paths:**

- `src/modules/property-bank-details/`
- `src/modules/portfolio-bank-details/`

## Purpose

Store and update ACH / domestic wire / international wire details. Sensitive fields are encrypted at rest.

## Permissions

`bank_details_permission` (separate from portfolio/property CRUD).

## Notable behaviors

- Encryption via `EncryptionUtil` using JWT secret-derived keys
- Bulk update via Excel with field mapping (see deep dive)
- Secure reads may require password

## Live API

Swagger tags for portfolio/property bank details — [`/api/docs`](pathname:///api/docs).

## Related

- [Bank details deep dive](../deep-dives/bank-details)
- [Property](./property)
- [Portfolio](./portfolio)
