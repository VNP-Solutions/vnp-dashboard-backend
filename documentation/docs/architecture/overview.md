---
sidebar_position: 1
title: Overview
---

# Architecture Overview

## Stack

| Layer | Technology |
| --- | --- |
| Framework | NestJS 11 |
| ORM | Prisma |
| Database | MongoDB |
| Auth | Passport JWT + OTP email |
| Validation | class-validator / class-transformer |
| API docs | Swagger at `/api/docs` |
| Dev docs | Docusaurus at `/docs` |
| Files | AWS S3 |

## Request flow

```
Client
  → /docs/*          (ServeStatic — public HTML)
  → /api/docs        (Swagger UI)
  → /api/<module>    (global prefix)
       → JwtAuthGuard (unless @Public())
       → PermissionGuard / RestrictedPropertySensitiveDataGuard
       → Controller → Service → Repository → Prisma → MongoDB
       → ResponseInterceptor → { success, message, data, metadata? }
```

## Layers

1. **Controllers** — HTTP, Swagger decorators, route params
2. **Services** — business logic and permission checks
3. **Repositories** — Prisma queries
4. **DTOs** — validation + `@ApiProperty`
5. **Common** — guards, filters, interceptors, QueryBuilder, encryption

## Further reading

- [Module Pattern](./module-pattern)
- [Authentication](./auth)
- [Permissions](./permissions)
- [Query Builder](./query-builder)
