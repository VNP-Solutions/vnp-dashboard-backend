---
slug: /
sidebar_position: 1
title: Introduction
---

# VNP Backend Documentation

Welcome to the developer documentation for **VNP Dashboard Backend** — a NestJS REST API for property portfolios, audits, users, and role-based access control.

## What this API does

- Portfolio and property management with bank details and credentials
- Audit tracking with multi-OTA amounts and batches
- JWT + OTP authentication and invitation flows
- Two-dimensional permission model (permission level + access level)
- Global reports, pending actions, API keys, and file uploads to S3

## Related repositories

| Repository | Purpose |
| --- | --- |
| **vnp-dashboard-backend** (this repo) | NestJS API + Prisma + MongoDB |
| **vnp-dashboard-new** | Next.js frontend dashboard |

## Documentation URLs

| Site | Path | Purpose |
| --- | --- | --- |
| Developer docs (this site) | `/docs` | Architecture, modules, ops guides |
| Swagger UI | [`/api/docs`](pathname:///api/docs) | Interactive API reference |
| OpenAPI JSON | [`/api/docs.json`](pathname:///api/docs.json) | Machine-readable OpenAPI |

Docs are **public** (no JWT). API routes under `/api/*` remain authenticated unless marked `@Public()`.

## How docs are served

Docusaurus builds to static HTML/CSS/JS in `public/docs/`. Nest serves that folder via `@nestjs/serve-static` at `/docs` in the same process as the API.

## How to use this documentation

1. [Local Setup](./getting-started/setup) — run the API locally
2. [Architecture Overview](./architecture/overview) — stack and request flow
3. [Permissions](./architecture/permissions) — before changing gated endpoints
4. [Modules](./modules/auth) — feature-specific guides
5. [Swagger](pathname:///api/docs) — try endpoints interactively

## Tech stack at a glance

- **Framework:** NestJS 11
- **Database:** MongoDB via Prisma
- **Auth:** Passport JWT, OTP email login
- **Docs:** Swagger (`@nestjs/swagger`) + this Docusaurus site
- **Storage:** AWS S3 for file uploads
