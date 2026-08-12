---
sidebar_position: 2
title: Module Pattern
---

# Module Pattern

Each feature under `src/modules/{name}/` follows:

```
module/
├── {name}.module.ts        # DI providers
├── {name}.controller.ts    # HTTP endpoints
├── {name}.service.ts       # Business logic
├── {name}.repository.ts    # Prisma data access
├── {name}.dto.ts           # Create / Update / Query DTOs
└── {name}.interface.ts     # Service/repository interfaces
```

## Interface-based DI

Providers use string tokens:

```typescript
{ provide: 'IPropertyService', useClass: PropertyService }
{ provide: 'IPropertyRepository', useClass: PropertyRepository }

constructor(
  @Inject('IPropertyService') private service: IPropertyService
) {}
```

## Responsibilities

| Layer | Does | Does not |
| --- | --- | --- |
| Controller | HTTP, validation pipes, Swagger | Business rules |
| Service | Permissions, workflows, orchestration | Raw Prisma queries |
| Repository | Prisma CRUD / queries | HTTP exceptions for business rules |

## Circular dependencies

Use `forwardRef()` when modules reference each other (e.g. Property ↔ PendingAction).

## Adding a module

1. Generate files following the pattern above
2. Register in `AppModule` imports
3. Add `@ApiTags`, `@RequirePermission` as needed
4. Document in Swagger and this docs site
