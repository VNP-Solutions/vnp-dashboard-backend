---
sidebar_position: 4
title: Bank Details Deep Dive
---

# Bank Details Deep Dive

## Types

Bank details support multiple wire styles (ACH, domestic wire, international wire) with different field sets. Bulk Excel templates map columns per sub-type.

## Encryption

Sensitive account fields are encrypted with `EncryptionUtil` before storage and decrypted for authorized reads.

## Permissions

Separate `bank_details_permission` — portfolio/property `all` does **not** automatically grant bank access.

## Bulk update

Dedicated bulk endpoints accept Excel files and return per-row success/failure. Field mapping notes live in `docs/bank-details-bulk-update-field-mapping.md`.

## Implementation notes archive

| File | Topic |
| --- | --- |
| `docs/bank-details-api-examples.md` | Request examples |
| `docs/bank-details-implementation-plan.md` | Design notes |
| `docs/bank-details-update-summary.md` | Change summary |

## Related

- [Bank details modules](../modules/bank-details)
- [Property](../modules/property)
- [Portfolio](../modules/portfolio)
