---
sidebar_position: 3
title: Invitation Hierarchy
---

# Invitation Hierarchy

When inviting users, the inviter cannot grant a role stronger than their own.

## Internal vs external

| Inviter | Can invite internal | Can invite external |
| --- | --- | --- |
| Internal (`is_external: false`) | Yes | Yes |
| External (`is_external: true`) | No | Yes |

## Permission comparison

For **every** module permission on the target role:

1. Inviter `permission_level` ≥ target `permission_level`
2. Inviter `access_level` ≥ target `access_level`

Modules checked include portfolio, property, audit, user, system settings, and bank details.

## Partial access constraint

If the inviter has `access_level: partial` for portfolio/property, they may only assign access to portfolios/properties **they already can access**.

## Hierarchy ladders

**Permission level:** `all` > `update` > `view`  
**Access level:** `all` > `partial` > `none`

## More examples

See archive file `docs/ROLE_INVITATION_HIERARCHY.md` and `docs/INVITATION_VALIDATION_EXAMPLES.md`.

## Related

- [User module](../modules/user)
- [Permissions](../architecture/permissions)
- [User Role](../modules/user-role)
