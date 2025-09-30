# Authentication System - Quick Start Guide

## ✅ What's Been Implemented

A complete authentication and authorization system has been created with the following features:

### Core Features

- ✅ OTP-based login (6-digit, 5-minute validity)
- ✅ User invitation system (temporary password, 7-day validity)
- ✅ Password reset with OTP verification
- ✅ Access and refresh JWT tokens
- ✅ Password encryption (bcrypt)
- ✅ Email notifications (OTP, invitations, password reset)
- ✅ Structured response format
- ✅ Global exception handling
- ✅ Validation pipes with class-validator
- ✅ Public/Protected route decorators
- ✅ Admin user seed file

### Password Requirements

- 8-32 characters
- At least one letter
- At least one number
- At least one special character

## 🚀 Getting Started

### 1. Environment Setup

Create a `.env` file in the root directory:

```env
# Application
APP_NAME=VNP Backend
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=mongodb://localhost:27017/vnp_database

# JWT (Generate your own secrets!)
JWT_ACCESS_SECRET=your-secure-access-secret-key
JWT_REFRESH_SECRET=your-secure-refresh-secret-key
JWT_ACCESS_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=14d

# AWS S3 (for future features)
S3_BUCKET_NAME=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_URL=https://your-bucket.s3.amazonaws.com

# SMTP Email (Gmail example)
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password

# Invitation redirect (your frontend URL)
INVITATION_REDIRECT_URL=http://localhost:3001/login
```

### 2. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed admin user
yarn seed
```

### 3. Run the Application

```bash
# Development mode
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

## 🔐 Default Admin Credentials

After running the seed command, you can login with:

- **Email**: `naeemhasan28@gmail.com`
- **Password**: `AluVaj!1*`

## 📝 Quick API Test

### 1. Request Login OTP

```bash
POST http://localhost:3000/auth/login/request-otp
Content-Type: application/json

{
  "email": "naeemhasan28@gmail.com"
}
```

### 2. Check your email for the OTP (6 digits)

### 3. Verify OTP and Login

```bash
POST http://localhost:3000/auth/login/verify-otp
Content-Type: application/json

{
  "email": "naeemhasan28@gmail.com",
  "otp": 123456
}
```

You'll receive:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUz...",
    "refresh_token": "eyJhbGciOiJIUz...",
    "user": {
      "id": "...",
      "email": "naeemhasan28@gmail.com",
      "first_name": "Admin",
      "last_name": "User",
      "role": "Super Admin"
    }
  }
}
```

### 4. Use the Access Token

For protected routes, include the access token in the Authorization header:

```bash
GET http://localhost:3000/protected-route
Authorization: Bearer eyJhbGciOiJIUz...
```

## 📁 Project Structure

```
src/
├── common/
│   ├── utils/
│   │   ├── encryption.util.ts    # Password hashing, OTP generation
│   │   └── email.util.ts         # Email sending
│   ├── interceptors/
│   │   └── response.interceptor.ts  # Standardized responses
│   └── filters/
│       └── http-exception.filter.ts  # Error handling
├── config/
│   └── configuration.ts          # Password regex & config
└── modules/
    └── auth/
        ├── decorators/
        │   ├── public.decorator.ts      # @Public()
        │   └── current-user.decorator.ts # @CurrentUser()
        ├── guards/
        │   └── jwt-auth.guard.ts
        ├── strategies/
        │   └── jwt.strategy.ts
        ├── auth.controller.ts    # Auth endpoints
        ├── auth.service.ts       # Business logic
        ├── auth.repository.ts    # Database operations
        ├── auth.dto.ts           # Validation DTOs
        └── auth.module.ts
```

## 🎯 Using Auth in Your Controllers

### Protected Route (Default)

```typescript
import { Controller, Get } from '@nestjs/common'
import { CurrentUser } from './modules/auth/decorators/current-user.decorator'

@Controller('protected')
export class ProtectedController {
  @Get()
  getData(@CurrentUser() user: any) {
    return {
      message: 'This is protected',
      user: user.email
    }
  }
}
```

### Public Route

```typescript
import { Controller, Get } from '@nestjs/common'
import { Public } from './modules/auth/decorators/public.decorator'

@Controller('public')
@Public() // Make entire controller public
export class PublicController {
  @Get()
  getData() {
    return { message: 'This is public' }
  }
}
```

## 🔧 Available Utilities

### Encryption Utility

```typescript
import { EncryptionUtil } from './common/utils/encryption.util'

// Hash password
const hashed = await EncryptionUtil.hashPassword('password123')

// Compare password
const isMatch = await EncryptionUtil.comparePassword('password123', hashed)

// Generate OTP
const otp = EncryptionUtil.generateOtp() // 6-digit number

// Generate temp password
const tempPass = EncryptionUtil.generateTempPassword()
```

### Email Utility (Injectable)

```typescript
import { EmailUtil } from './common/utils/email.util'

constructor(private emailUtil: EmailUtil) {}

// Send OTP
await this.emailUtil.sendOtpEmail('user@example.com', 123456)

// Send invitation
await this.emailUtil.sendInvitationEmail('user@example.com', 'TempPass123!', 'Admin')

// Send password reset OTP
await this.emailUtil.sendPasswordResetOtpEmail('user@example.com', 123456)
```

## 📚 API Endpoints

| Method | Endpoint                       | Description          | Auth Required |
| ------ | ------------------------------ | -------------------- | ------------- |
| POST   | `/auth/login/request-otp`      | Request login OTP    | No            |
| POST   | `/auth/login/verify-otp`       | Verify OTP & login   | No            |
| POST   | `/auth/invite`                 | Invite new user      | Yes\*         |
| POST   | `/auth/verify-invitation`      | Verify invitation    | No            |
| POST   | `/auth/password/request-reset` | Request reset OTP    | No            |
| POST   | `/auth/password/reset`         | Reset password       | No            |
| POST   | `/auth/refresh`                | Refresh access token | No            |

\*Note: `/auth/invite` should be protected in production - add role-based guards

## 🔐 Response Format

All responses follow this structure:

**Success:**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    /* ... */
  },
  "metadata": {
    /* optional */
  }
}
```

**Error:**

```json
{
  "success": false,
  "message": "Error message",
  "error": ["Validation error 1", "Validation error 2"],
  "data": null
}
```

## ⚠️ Important Notes

1. **Gmail SMTP**: Use App Passwords, not your regular password
   - Go to Google Account → Security → 2-Step Verification → App Passwords

2. **JWT Secrets**: Generate strong, random secrets for production:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Database**: Ensure MongoDB is running before starting the app

4. **HTTPS**: Always use HTTPS in production

5. **Rate Limiting**: Consider adding rate limiting for OTP endpoints

## 📖 Full Documentation

For complete documentation, see [AUTH_DOCUMENTATION.md](./AUTH_DOCUMENTATION.md)

## 🐛 Troubleshooting

### Build Errors

```bash
yarn build
```

If successful, you're good to go!

### Email Not Sending

- Check SMTP credentials
- For Gmail, use App Password
- Check spam folder

### Database Errors

```bash
npx prisma generate
npx prisma db push
```

### Token Errors

- Verify JWT secrets in `.env`
- Check token format: `Bearer <token>`
- Ensure token hasn't expired

## 🎉 Next Steps

1. ✅ Set up your `.env` file
2. ✅ Run database migrations
3. ✅ Seed the admin user
4. ✅ Start the application
5. ✅ Test the login flow
6. ✅ Integrate with your frontend
7. 🔄 Add role-based permissions as needed
8. 🔄 Implement OAuth2 if needed (structure is ready)

Happy coding! 🚀
