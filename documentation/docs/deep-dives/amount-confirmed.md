---
sidebar_position: 2
title: Amount Confirmed
---

# Amount Confirmed

Per-OTA confirmed amount fields on Audit:

| Field | OTA |
| --- | --- |
| `expedia_amount_confirmed` | Expedia |
| `agoda_amount_confirmed` | Agoda |
| `booking_amount_confirmed` | Booking |

## Who can update

| User type | Direct update | Restriction |
| --- | --- | --- |
| Super admin | Yes | Anytime |
| Internal user | Yes | **Once** per OTA field; after set, only super admin can change |
| External user | No | Must request change (approval / pending flow) |

## API

- Direct update: `PATCH /api/audit/:id` with one or more `*_amount_confirmed` fields
- Dedicated helpers may exist (see Swagger and `updateAuditAmountConfirmed` patterns)

Requires audit `update` permission. Internal-only for direct PATCH of these fields.

Archive of detailed request/response examples: `docs/AUDIT_AMOUNT_CONFIRMED_API.md` in the repo.

## Related

- [OTA Amounts](./ota-amounts)
- [Audit module](../modules/audit)
- [Pending Action](../modules/pending-action)
