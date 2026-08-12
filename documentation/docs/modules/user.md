---
sidebar_position: 5
title: User Module
---

# User Module

**Path:** `src/modules/user/`

## Purpose

User listing, invitations, role assignment, and portfolio/property access management for partial-access users.

## Permissions

`user_permission`.

## Notable behaviors

- Invitation validation respects role hierarchy — [Invitation hierarchy](../deep-dives/invitation-hierarchy)
- Access assignment updates `UserAccessedProperty`
- Cascading cleanup of OTPs, notes, tasks, and access records on delete

## Live API

Swagger tag **Users** — [`/api/docs`](pathname:///api/docs).

## Related

- [User Role](./user-role)
- [Permissions](../architecture/permissions)
