---
sidebar_position: 10
title: API Key Module
---

# API Key Module

**Path:** `src/modules/api-key/`

## Purpose

Super-admin managed API keys for external integrations. Keys are portfolio-scoped.

## Controllers

| Controller | Auth |
| --- | --- |
| `api-key.controller.ts` | JWT + permissions (admin) |
| `external-api.controller.ts` | `ApiKeyAuthGuard` + `@Public()` for JWT bypass |

External clients send header `x-api-key` (documented in Swagger security scheme).

## Live API

Swagger — [`/api/docs`](pathname:///api/docs).

## Related

- [Authentication](../architecture/auth)
