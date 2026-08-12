---
sidebar_position: 3
title: Commands
---

# Commands

Run from the **project root** with Yarn.

## Application

| Command | Description |
| --- | --- |
| `yarn start:dev` | Nest watch mode |
| `yarn start:debug` | Debug + watch |
| `yarn build` | Build docs into `public/docs/` then `nest build` |
| `yarn build:app` | Nest build only |
| `yarn start:prod` | Full build + `node dist/main` |
| `yarn lint` | ESLint with auto-fix |
| `yarn format` | Prettier on `src/**/*.ts` |

## Documentation

| Command | Description |
| --- | --- |
| `yarn docs:install` | Install Docusaurus deps |
| `yarn docs:dev` | Docs dev server (port 3002) |
| `yarn docs:build` | Build docs → `public/docs/` |

## Database

| Command | Description |
| --- | --- |
| `yarn generate` | Prisma client generate |
| `yarn push` | Push schema to MongoDB |
| `yarn migrate` | `prisma migrate dev` (rarely used; project prefers `push`) |
| `yarn studio` | Prisma Studio |
| `yarn seed` | Seed initial data |
| `yarn seed:test` | Seed test roles/users |
| `yarn seed:portfolios` / `seed:properties` / `seed:audits` | Domain-specific seeds |

## Maintenance scripts

See [Ops](../ops/seeding) for backups, migrations, and cleanup scripts (`backup:*`, `migrate:*`, `fix:*`, etc.).
