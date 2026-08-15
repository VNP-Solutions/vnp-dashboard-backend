---
sidebar_position: 1
title: Seeding
---

# Seeding

## Commands

| Command | Purpose |
| --- | --- |
| `yarn seed` | Base seed data |
| `yarn seed:test` | Test roles + users for permission scenarios |
| `yarn seed:portfolios` | Portfolio sample data |
| `yarn seed:properties` | Property sample data |
| `yarn seed:audits` | Audit sample data |

Scripts live under `prisma/` (e.g. `seed.ts`, `seed-test-users.ts`).

## Testing docs

After `yarn seed:test`, use guides in the archive folder:

- `docs/QUICK_TEST_REFERENCE.md`
- `docs/TESTING_GUIDE.md`

:::caution
Do not commit real production credentials into seed files. Use dedicated test passwords only in non-production environments.
:::

## Related

- [Commands](../getting-started/commands)
- [Permissions](../architecture/permissions)
