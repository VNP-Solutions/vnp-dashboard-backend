---
sidebar_position: 1
title: Auth Module
---

# Auth Module

**Path:** `src/modules/auth/`

## Purpose

OTP login, token refresh, invitation verification, password reset, and password verification for sensitive operations.

## Key pieces

| File | Role |
| --- | --- |
| `auth.controller.ts` | Public auth endpoints (`@Public()`) |
| `auth.service.ts` | OTP, JWT issuance, invitations |
| Guards | `JwtAuthGuard`, `OptionalJwtAuthGuard` |
| `@Public()` | Skip global JWT |

## Notable behaviors

- Temp passwords for invitations (time-limited)
- Access + refresh tokens with configurable expiry
- `verifyPassword` used by other modules for delete/transfer

## Live API

See Swagger tag **Authentication** at [`/api/docs`](pathname:///api/docs).

## Related

- [Architecture: Auth](../architecture/auth)
- [Invitation hierarchy](../deep-dives/invitation-hierarchy)
