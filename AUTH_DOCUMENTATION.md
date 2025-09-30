# Authentication & Authorization System Documentation

## Overview

This application implements a comprehensive authentication and authorization system using NestJS, Passport, JWT, and MongoDB (via Prisma). The system includes OTP-based login, user invitation, password reset, and role-based access control.

## Features

✅ **OTP-Based Login** - 6-digit OTP with 5-minute validity
✅ **User Invitation System** - Invite users with temporary passwords (7-day validity)
✅ **Password Reset** - OTP-verified password reset
✅ **JWT Authentication** - Access and refresh tokens
✅ **Role-Based Access Control** - Granular permissions per role
✅ **Email Notifications** - Automated emails for OTP, invitations, and password resets
✅ **Password Encryption** - Bcrypt-based password hashing
✅ **Validation** - Built-in NestJS validation pipes with class-validator

## Setup

### 1. Install Dependencies

All required dependencies have been installed. If you need to reinstall:

```bash
yarn install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Application
APP_NAME=VNP Backend
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=mongodb://localhost:27017/vnp_database

# JWT
JWT_ACCESS_SECRET=your-access-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_ACCESS_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=14d

# AWS S3
S3_BUCKET_NAME=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_URL=https://your-bucket.s3.amazonaws.com

# SMTP Email (Gmail)
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Invitation
INVITATION_REDIRECT_URL=http://localhost:3001/login
```

### 3. Database Migration

Generate Prisma client and push schema to database:

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Admin User

Run the seed script to create the default admin user:

```bash
yarn seed
```

**Admin Credentials:**

- Email: `naeemhasan28@gmail.com`
- Password: `AluVaj!1*`

## Password Requirements

Passwords must meet the following criteria:

- 8-32 characters in length
- At least one letter (a-z or A-Z)
- At least one number (0-9)
- At least one special character (!@#$%^&\*()\_+-=[]{};':"\\|,.<>/?)

The regex is configured in `src/config/configuration.ts`.

## API Endpoints

### 1. Request Login OTP

**POST** `/auth/login/request-otp`

Request an OTP to be sent to the user's email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OTP sent to your email",
  "data": null
}
```

### 2. Verify Login OTP

**POST** `/auth/login/verify-otp`

Verify the OTP and receive access/refresh tokens.

**Request Body:**

```json
{
  "email": "user@example.com",
  "otp": 123456
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "Super Admin"
    }
  }
}
```

### 3. Invite User

**POST** `/auth/invite`

Invite a new user with a temporary password.

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "role_id": "507f1f77bcf86cd799439011",
  "first_name": "Jane",
  "last_name": "Smith",
  "language": "en",
  "portfolio_ids": ["507f1f77bcf86cd799439012"],
  "property_ids": ["507f1f77bcf86cd799439013"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Invitation sent successfully. Temporary password is valid for 7 days.",
  "data": null
}
```

### 4. Verify Invitation

**POST** `/auth/verify-invitation`

Verify the invitation and set a new password.

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "temp_password": "TempPass123!",
  "new_password": "NewSecure123!"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Invitation verified successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439014",
      "email": "newuser@example.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "role": "User"
    }
  }
}
```

### 5. Request Password Reset

**POST** `/auth/password/request-reset`

Request an OTP for password reset.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "If the email exists, an OTP has been sent",
  "data": null
}
```

### 6. Reset Password

**POST** `/auth/password/reset`

Reset password using OTP.

**Request Body:**

```json
{
  "email": "user@example.com",
  "otp": 123456,
  "new_password": "NewSecure123!"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null
}
```

### 7. Refresh Access Token

**POST** `/auth/refresh`

Get a new access token using a refresh token.

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Access token refreshed successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Using Authentication in Controllers

### Protect Routes (Authenticated Only)

By default, all routes are protected by the JWT guard. The user must include a valid access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Example:

```typescript
import { Controller, Get } from '@nestjs/common'

@Controller('protected')
export class ProtectedController {
  @Get()
  getProtectedData() {
    return { message: 'This requires authentication' }
  }
}
```

### Public Routes (No Authentication)

To make a route or entire controller public, use the `@Public()` decorator:

```typescript
import { Controller, Get } from '@nestjs/common'
import { Public } from './modules/auth/decorators/public.decorator'

@Controller('public')
@Public()
export class PublicController {
  @Get()
  getPublicData() {
    return { message: 'This is public' }
  }
}
```

### Access Current User

Use the `@CurrentUser()` decorator to access the authenticated user:

```typescript
import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from './modules/auth/decorators/current-user.decorator'

@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      role: user.role
    }
  }
}
```

## Response Format

All API responses follow a standardized format:

**Success Response:**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    /* response data */
  },
  "metadata": {
    /* optional metadata */
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Error message",
  "error": ["Detailed error 1", "Detailed error 2"],
  "data": null
}
```

## Architecture

### File Structure

```
src/
├── common/
│   ├── utils/
│   │   ├── encryption.util.ts       # Password hashing & OTP generation
│   │   └── email.util.ts            # Email sending utilities
│   ├── interceptors/
│   │   └── response.interceptor.ts  # Standardized response format
│   └── filters/
│       └── http-exception.filter.ts # Global exception handling
├── config/
│   ├── configuration.ts             # App configuration with password regex
│   └── ...
└── modules/
    ├── auth/
    │   ├── decorators/
    │   │   ├── public.decorator.ts      # @Public() decorator
    │   │   └── current-user.decorator.ts # @CurrentUser() decorator
    │   ├── guards/
    │   │   └── jwt-auth.guard.ts        # JWT authentication guard
    │   ├── strategies/
    │   │   └── jwt.strategy.ts          # Passport JWT strategy
    │   ├── auth.controller.ts           # Auth endpoints
    │   ├── auth.service.ts              # Business logic
    │   ├── auth.repository.ts           # Database operations
    │   ├── auth.dto.ts                  # Data transfer objects
    │   ├── auth.interface.ts            # TypeScript interfaces
    │   └── auth.module.ts               # Module definition
    └── ...
```

### Design Patterns

**Repository Pattern**: Database operations are separated into repository files
**Service Pattern**: Business logic is handled in service files
**DTO Pattern**: Request/response validation using DTOs with class-validator
**Guard Pattern**: Route protection using NestJS guards
**Decorator Pattern**: Custom decorators for route metadata

## Utilities

### Encryption Utility (`src/common/utils/encryption.util.ts`)

```typescript
import { EncryptionUtil } from './common/utils/encryption.util'

// Hash a password
const hashedPassword = await EncryptionUtil.hashPassword('MyPassword123!')

// Compare password
const isMatch = await EncryptionUtil.comparePassword(
  'MyPassword123!',
  hashedPassword
)

// Generate 6-digit OTP
const otp = EncryptionUtil.generateOtp() // 123456

// Generate temporary password
const tempPassword = EncryptionUtil.generateTempPassword() // 'Abc123!xyz'
```

### Email Utility (`src/common/utils/email.util.ts`)

The `EmailUtil` is injectable and automatically configured:

```typescript
import { EmailUtil } from './common/utils/email.util'

constructor(private emailUtil: EmailUtil) {}

// Send OTP email
await this.emailUtil.sendOtpEmail('user@example.com', 123456)

// Send invitation email
await this.emailUtil.sendInvitationEmail('user@example.com', 'TempPass123!', 'Admin')

// Send password reset OTP
await this.emailUtil.sendPasswordResetOtpEmail('user@example.com', 123456)
```

## Database Models

### User

- `email` - Unique user email
- `password` - Encrypted password
- `temp_password` - Temporary password for invitations
- `is_verified` - Whether user has completed invitation
- `user_role_id` - Reference to UserRole
- `first_name`, `last_name`, `language` - User details

### UserRole

- `name` - Role name (unique)
- `description` - Role description
- `is_external` - External/internal user flag
- `portfolio_permission`, `property_permission`, etc. - JSON permission objects

### Otp

- `user_id` - Reference to User
- `otp` - 6-digit OTP
- `is_used` - Whether OTP has been used
- `expires_at` - OTP expiration timestamp

### UserAccessedProperty

- `user_id` - Reference to User
- `portfolio_id` - Array of accessible portfolio IDs
- `property_id` - Array of accessible property IDs

## Security Considerations

1. **Password Encryption**: All passwords are hashed using bcrypt with 10 salt rounds
2. **OTP Expiry**: OTPs expire after 5 minutes
3. **Temp Password Expiry**: Temporary passwords expire after 7 days
4. **JWT Tokens**: Separate access and refresh tokens with configurable expiry
5. **Validation**: All inputs are validated using class-validator
6. **Error Messages**: Generic error messages to prevent user enumeration
7. **HTTPS**: Always use HTTPS in production
8. **Environment Variables**: Sensitive data stored in environment variables

## Testing

To test the authentication system:

1. Start the application:

```bash
yarn start:dev
```

2. Use the seeded admin credentials or invite a new user

3. Test endpoints using Postman, cURL, or your frontend

Example cURL request:

```bash
# Request OTP
curl -X POST http://localhost:3000/auth/login/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "naeemhasan28@gmail.com"}'

# Verify OTP (use OTP from email)
curl -X POST http://localhost:3000/auth/login/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "naeemhasan28@gmail.com", "otp": 123456}'
```

## Troubleshooting

### Email Not Sending

1. Verify SMTP credentials in `.env`
2. For Gmail, use an App Password (not your account password)
3. Enable "Less secure app access" or use OAuth2

### JWT Token Issues

1. Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set
2. Check token expiry settings
3. Ensure Bearer token is included in Authorization header

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Ensure MongoDB is running
3. Run `npx prisma generate` after schema changes

## Future Enhancements

- OAuth2 integration (Google, GitHub, etc.) - Already prepared with Passport
- Two-factor authentication (2FA)
- Rate limiting for OTP requests
- Password history to prevent reuse
- Session management
- Audit logging for security events

## Support

For issues or questions, refer to:

- NestJS Documentation: https://docs.nestjs.com
- Passport Documentation: http://www.passportjs.org
- Prisma Documentation: https://www.prisma.io/docs
