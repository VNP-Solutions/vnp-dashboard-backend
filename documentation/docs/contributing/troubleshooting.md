---
sidebar_position: 2
title: Troubleshooting
---

# Troubleshooting

## JWT / 401 on every request

- Missing or expired token — refresh or log in again
- Route not marked `@Public()` when it should be
- Static `/docs` should never require JWT; if it does, ServeStatic is misconfigured

## Permission denied with valid JWT

- Check both `permission_level` and `access_level`
- Partial access needs correct `UserAccessedProperty` assignment
- Wrong module name in `@RequirePermission`

## Prisma errors

| Code | Meaning |
| --- | --- |
| P2002 | Unique constraint |
| P2025 | Record not found |
| P2003 | Foreign key |

Handled by `HttpExceptionFilter`.

## Schema out of sync

```bash
yarn push
yarn generate
```

This project uses **db push**, not migration deploy, for day-to-day schema sync.

## Circular dependency at startup

Use `forwardRef()` between interdependent modules.

## Docs 404 at /docs

```bash
yarn docs:build
yarn build:app
node dist/main
```

Ensure `public/docs/index.html` exists. Run from repo root so `process.cwd()` resolves correctly.

## Swagger vs developer docs

| URL | Content |
| --- | --- |
| `/docs` | Docusaurus (this site) |
| `/api/docs` | Swagger UI |

## Related

- [Environment](../getting-started/environment)
- [Authentication](../architecture/auth)
