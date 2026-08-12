---
sidebar_position: 3
title: Backups
---

# Backups

## Commands

| Command | Purpose |
| --- | --- |
| `yarn backup:db` | Production DB backup script |
| `yarn backup:prisma` | Prisma JSON backup |
| `yarn backup:full` | Full ejson-style backup |
| `yarn backup:restore` | Dump and restore helper |

Scripts live in `scripts/`. Backup output directories are gitignored (`/backups`).

## Other maintenance

| Command | Purpose |
| --- | --- |
| `yarn cleanup:orphans` | Remove orphaned records |
| `yarn fix:passwords` | Fix encrypted password issues |
| `yarn fix:expedia-ids` | Deduplicate Expedia IDs |
| `yarn remove:sales-agent` | Remove sales agent data helper |

See `scripts/README.md` for script-specific behavior and safety notes.

## Related

- [Migrations](./migrations)
- [Commands](../getting-started/commands)
