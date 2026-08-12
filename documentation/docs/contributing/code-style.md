---
sidebar_position: 1
title: Code Style
---

# Code Style

## Conventions

- Interface-based injection with string tokens (`'IPropertyService'`)
- Validate permissions in **services** before mutations
- Use `@ApiOperation` / `@ApiResponse` / `@ApiTags` for Swagger
- Transform Prisma errors to HTTP exceptions in services
- Prefer explicit return types; async/await over promise chains
- Use Prisma-generated enums, not raw string literals for enum fields

## Formatting

```bash
yarn format
yarn lint
```

Prettier + ESLint are configured at the repo root.

## DTOs

- `class-validator` decorators
- Separate Create / Update / Query DTOs
- `@ApiProperty` / `@ApiPropertyOptional` for Swagger

## Related

- [Module Pattern](../architecture/module-pattern)
- [Troubleshooting](./troubleshooting)
