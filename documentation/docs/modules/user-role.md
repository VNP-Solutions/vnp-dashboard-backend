---
sidebar_position: 6
title: User Role Module
---

# User Role Module

**Path:** `src/modules/user-role/`

## Purpose

Define role templates with per-module `permission_level` and `access_level`, plus flags such as `is_external` and `can_access_mis`.

## Permissions

Typically gated by `system_settings_permission` / admin flows (see controller decorators in Swagger).

## Notable fields

| Field | Meaning |
| --- | --- |
| `is_external` | External client vs internal staff |
| `can_access_mis` | Global report / MIS access |
| `is_active` | Inactive roles deny all checks |
| `*_permission` | Module permission objects |

## Live API

Swagger tag **User Role** — [`/api/docs`](pathname:///api/docs).

## Related

- [Permissions](../architecture/permissions)
- [Invitation hierarchy](../deep-dives/invitation-hierarchy)
