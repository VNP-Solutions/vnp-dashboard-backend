---
sidebar_position: 1
title: Local Setup
---

# Local Setup

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20+ |
| Yarn | 1.x |
| MongoDB | Accessible via `DATABASE_URL` |

## Clone and install

```bash
git clone <repository-url>
cd vnp-dashboard-backend
yarn install
```

`postinstall` installs Docusaurus dependencies in `documentation/`.

## Environment

Copy or create `.env` in the project root. See [Environment Variables](./environment).

## Prisma

```bash
yarn generate   # Generate Prisma client
yarn push       # Push schema to MongoDB (this project uses db push, not migrate deploy)
```

Optional seed data:

```bash
yarn seed
yarn seed:test   # Test roles and users for permission scenarios
```

## Run the API

```bash
yarn start:dev
```

Default logs include:

- API: `http://localhost:<port>`
- Developer docs: `http://localhost:<port>/docs`
- Swagger: `http://localhost:<port>/api/docs`

## Documentation commands

```bash
yarn docs:dev     # Live docs on http://localhost:3002/docs/
yarn docs:build   # Build into public/docs/
```

## Production locally

```bash
yarn build        # docs + nest build
node dist/main
```

Or `yarn start:prod` which runs `yarn build && node dist/main`.
