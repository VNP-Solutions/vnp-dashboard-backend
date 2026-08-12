---
sidebar_position: 4
title: Permissions
---

# Permissions

Two-dimensional model on each `UserRole` module permission:

## Permission level (CRUD)

| Level | Allowed |
| --- | --- |
| `view` | READ |
| `update` | CREATE, READ, UPDATE |
| `all` | CREATE, READ, UPDATE, DELETE |

## Access level (scope)

| Level | Scope |
| --- | --- |
| `none` | No access |
| `partial` | Only assigned resources (`UserAccessedProperty`) |
| `all` | All resources |

Both dimensions must allow the operation.

## Modules on UserRole

- `portfolio_permission`
- `property_permission`
- `audit_permission`
- `user_permission`
- `system_settings_permission`
- `bank_details_permission` (where applicable)

## Checking in services

```typescript
await this.permissionService.checkPermission({
  user,
  module: 'property',
  action: 'read',
  resourceId: propertyId // for partial access
})
```

Controller decorator pattern:

```typescript
@RequirePermission({ module: 'property', action: 'create' })
```

## Partial access

When a user with `access_level: partial` creates a portfolio/property, grant them access via `UserAccessedProperty` (`portfolio_id[]` / `property_id[]`).

## Super admin

All modules at `permission_level: all` and `access_level: all`. Can approve pending actions and bypass some one-time field restrictions.

## Related

- [Invitation hierarchy](../deep-dives/invitation-hierarchy)
- [User module](../modules/user)
- [User role module](../modules/user-role)
