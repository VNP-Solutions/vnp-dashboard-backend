---
sidebar_position: 3
title: Authentication
---

# Authentication

## Flows

### Invitation + password setup

1. Super admin invites user (temporary password, valid ~7 days)
2. Email sent with temp password
3. User verifies temp password and sets a new password
4. User can then log in via OTP

### OTP login

1. Request OTP with email → `POST /api/auth/...`
2. Verify OTP → JWT `access_token` + `refresh_token` issued
3. Refresh via refresh token endpoint when access expires

Exact paths are listed in [Swagger](pathname:///api/docs) under **Authentication**.

## Guards

| Guard | Scope | Behavior |
| --- | --- | --- |
| `JwtAuthGuard` | Global `APP_GUARD` | Requires JWT unless `@Public()` |
| `PermissionGuard` | Global + `@RequirePermission` | Module/action checks |
| `RestrictedPropertySensitiveDataGuard` | Global | Sensitive property field restrictions |
| `ApiKeyAuthGuard` | External API controller | `x-api-key` header |
| `OptionalJwtAuthGuard` | Selected routes | Auth optional |

Public routes use:

```typescript
import { Public } from './decorators/public.decorator'

@Public()
@Get('health')
health() { ... }
```

## Password rules

DTO regex: 8–32 chars, at least one letter, one number, one special character (`@$!%*#?&`).

## Sensitive operations

Transfers, deletes, and some activations require password verification via `AuthRepository.verifyPassword()`.

## Related

- [Permissions](./permissions)
- [Auth module](../modules/auth)
- [Invitation hierarchy](../deep-dives/invitation-hierarchy)
