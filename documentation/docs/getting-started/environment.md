---
sidebar_position: 2
title: Environment Variables
---

# Environment Variables

Required in `.env` (never commit secrets):

```bash
# Database
DATABASE_URL="mongodb+srv://..."

# JWT
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="14d"

# S3
S3_BUCKET_NAME="..."
S3_REGION="..."
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET_URL="..."

# Email
SMTP_EMAIL="..."
SMTP_PASSWORD="..."

# Frontend
INVITATION_REDIRECT_URL="https://..."
```

Configuration is loaded via Nest `ConfigModule` and validated in `src/config/validation.ts`. App port and other settings come from `src/config/configuration.ts` / `ConfigService`.

## Notes

- JWT secrets are also used as encryption keys for OTA credentials and bank details (`EncryptionUtil`).
- `INVITATION_REDIRECT_URL` points to the frontend invitation verification page.
- After changing Prisma schema: `yarn push` then `yarn generate`.
