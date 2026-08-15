---
sidebar_position: 5
title: Query Builder
---

# Query Builder

Utility: `src/common/utils/query-builder.ts` (and related helpers).

## Capabilities

- **Nested search** — dot notation like `portfolio.name`
- **Operator filters** — `filters[field][operator]=value` (`contains`, `in`, `gte`, `lte`, `gt`, `lt`, `not`, …)
- **Multi-field sort** — `sortBy=field1,field2&sortOrder=asc,desc`
- **Pagination** — page/limit → `PaginatedResult<T>`

## Usage pattern

1. Define `nestedFieldMap` for searchable relations
2. `QueryBuilder.buildFilters()` → Prisma `where`
3. `QueryBuilder.buildOrderBy()` → Prisma `orderBy`
4. Return `buildPaginatedResult()`

## Tips

- Map nested fields explicitly to avoid invalid Prisma paths
- ID fields are validated as ObjectIds where appropriate
- Global report uses related aggregation builders for complex filters (including OTA arrays)

## Related

- [Module Pattern](./module-pattern)
- [Global Report](../modules/global-report)
