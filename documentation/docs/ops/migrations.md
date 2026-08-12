---
sidebar_position: 2
title: Migrations
---

# Migrations

## Day-to-day schema sync

This project primarily uses:

```bash
yarn push       # prisma db push
yarn generate   # prisma generate
```

not long-lived migration deploy workflows for MongoDB day-to-day work.

## One-off data migration scripts

| Script | Command |
| --- | --- |
| Bank details schema | `yarn migrate:bank-details` |
| Bank account type string | `yarn migrate:bank-account-type-string` |
| Production direct | `yarn migrate:production` |
| Audit OTA to array | `yarn migrate:audit-ota` |
| Verify OTA migration | `yarn verify:audit-ota` |
| Validate migration | `yarn validate:migration` |
| Backfill report data | `yarn backfill:report-data` |

Archive write-ups: `docs/PRODUCTION_MIGRATION_GUIDE.md`, `docs/MIGRATION_COMPLETION_SUMMARY.md`, root `MIGRATION_SUMMARY.md`.

## Safety

- Backup first — see [Backups](./backups)
- Run verify scripts after data migrations
- Prefer staging dry-runs before production

## Related

- [Environment](../getting-started/environment)
- [OTA Amounts](../deep-dives/ota-amounts)
