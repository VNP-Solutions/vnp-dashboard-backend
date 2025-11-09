# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VNP Dashboard Backend is a NestJS-based REST API for managing property portfolios, audits, and user access control. It uses MongoDB with Prisma ORM and implements a sophisticated permission system with resource-level access control.

## Development Commands

```bash
# Install dependencies
yarn install

# Development
yarn start:dev              # Watch mode with hot reload
yarn start:debug            # Debug mode with watch

# Build & Production
yarn build                  # Compile TypeScript
yarn start:prod             # Build and run production

# Database
yarn generate               # Generate Prisma client after schema changes
yarn push                   # Push Prisma schema to MongoDB (no migrations)
yarn seed                   # Seed database with initial data

# Code Quality
yarn lint                   # ESLint with auto-fix
yarn format                 # Prettier formatting
```

## Architecture Patterns

### Module Structure

Each feature module follows this standard pattern:

```
module/
├── {name}.module.ts        # Module with DI configuration
├── {name}.controller.ts    # HTTP endpoints
├── {name}.service.ts       # Business logic
├── {name}.repository.ts    # Data access layer (Prisma)
├── {name}.dto.ts          # DTOs with validation
└── {name}.interface.ts    # TypeScript interfaces
```

**Interface-Based Dependency Injection**: All services and repositories use string token injection to depend on interfaces, not implementations:

```typescript
// In module providers
{ provide: 'IPropertyService', useClass: PropertyService }
{ provide: 'IPropertyRepository', useClass: PropertyRepository }

// In constructor
constructor(
  @Inject('IPropertyService') private service: IPropertyService,
  @Inject('IPropertyRepository') private repo: IPropertyRepository
)
```

### Repository Pattern

- **Repositories** handle all Prisma queries and return typed results
- **Services** contain business logic and permission checks
- **Controllers** handle HTTP concerns and validation
- Use Prisma's typed payloads for relation includes:

```typescript
type PropertyWithRelations = Prisma.PropertyGetPayload<{
  include: {
    portfolio: true
    credentials: true
    // ... other relations
  }
}>
```

### DTOs and Validation

- Use `class-validator` decorators for validation
- Use `@ApiProperty()` from `@nestjs/swagger` for documentation
- Separate DTOs for Create, Update, and Query operations
- Query DTOs extend base pagination/filtering types

### Advanced Query Building

The `QueryBuilder` utility (in `src/common/utils/query-builder.ts`) provides:

- **Nested field search**: Use dot notation like `portfolio.name` for searching relations
- **Operator-based filtering**: `filters[field][operator]=value` (contains, in, gte, lte, gt, lt, not)
- **Multi-field sorting**: `sortBy=field1,field2&sortOrder=asc,desc`
- **Field mapping**: Define `nestedFieldMap` for complex nested paths

When implementing new query endpoints:
1. Use `QueryBuilder.buildFilters()` for where clauses
2. Use `QueryBuilder.buildOrderBy()` for sorting
3. Define nested field mappings for searchable relations
4. Return `PaginatedResult<T>` type

## Permission System

Two-dimensional permission model:

1. **Permission Level** (CRUD operations):
   - `all` → CREATE, READ, UPDATE, DELETE
   - `update` → CREATE, READ, UPDATE
   - `view` → READ only

2. **Access Level** (resource scope):
   - `all` → All resources in system
   - `partial` → Only assigned resources (via UserAccessedProperty)
   - `none` → No access

**Module-based permissions** on UserRole:
- portfolio_permission
- property_permission
- audit_permission
- user_permission
- system_settings_permission

**Permission checking pattern**:

```typescript
// In services, inject PermissionService
constructor(
  @Inject('IPermissionService') private permissionService: IPermissionService
)

// Check permissions before operations
await this.permissionService.checkPermission({
  user,
  module: 'property',      // or 'portfolio', 'audit', 'user', 'system_settings'
  action: 'read',          // or 'create', 'update', 'delete'
  resourceId: propertyId   // Optional, for partial access validation
})
```

**Important**: Property and Portfolio modules support partial access. When a user with partial access creates a resource, automatically grant them access via UserAccessedProperty.

## Authentication & Authorization

### JWT Authentication Flow

1. User invitations: Super admin creates user with temporary password
2. Email sent with temp password (valid 7 days)
3. User verifies temp password and sets new password
4. Login via OTP: Email → OTP sent → OTP verified → JWT issued

### Guards

- **JwtAuthGuard**: Applied globally, validates JWT tokens
  - Skip with `@Public()` decorator for public routes
  - Handles token expiration and invalid token errors

- **PermissionGuard**: Applied via `@RequirePermission()` decorator
  - Format: `@RequirePermission({ module: 'property', action: 'create' })`
  - Checks both permission level and access level
  - Validates resource-level access for partial permissions

### Password Requirements

Regex pattern in DTOs: `/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,32}$/`
- 8-32 characters
- At least one letter
- At least one number
- At least one special character

## Database (Prisma + MongoDB)

### Schema Management

**IMPORTANT**: This project uses `prisma db push`, not migrations:

```bash
# After modifying schema.prisma
yarn push      # Push schema to database
yarn generate  # Regenerate Prisma client
```

### Key Models & Relationships

**Core entities**:
- `User` → has role → `UserRole`
- `Portfolio` → has service type → `ServiceType`
- `Property` → belongs to portfolio, has credentials, bank details, audits
- `Audit` → belongs to property, has status, optional batch
- `PropertyPendingAction` → approval workflow for deletions/transfers

**Permission tracking**:
- `UserAccessedProperty` → tracks portfolio_id[] and property_id[] for partial access users

**Reference data**:
- `ServiceType`, `AuditStatus`, `Currency`, `AuditBatch`

### Important Enums

```typescript
enum PropertyActionType { DELETE, TRANSFER, BULK_TRANSFER }
enum PropertyActionStatus { PENDING, APPROVED, REJECTED }
enum PermissionLevel { all, update, view }
enum AccessLevel { all, partial, none }
enum OtaType { expedia, agoda, booking }
```

### Cascading Deletes

- Portfolio deletion → cascades to Properties
- Property deletion → cascades to Credentials, BankDetails, Audits, Notes, Tasks
- User deletion → cascades to OTPs, Notes, Tasks, UserAccessedProperty
- Set approval_user_id to null on PropertyPendingAction when approver is deleted

## Common Utilities

### Exception Handling

`HttpExceptionFilter` (in `src/common/filters/`) handles:
- NestJS HttpException
- Prisma errors (P2002: unique, P2025: not found, P2003: foreign key)
- Generic errors with pattern matching
- Returns standardized error response

### Response Format

All endpoints return this structure (via `ResponseInterceptor`):

```typescript
{
  success: boolean
  message: string
  data?: T
  metadata?: { page, limit, total, totalPages }  // For paginated results
  error?: string[]
}
```

### Encryption Utility

Use `EncryptionUtil` (in `src/common/utils/encryption.ts`) for:
- Encrypting OTA credentials before storage
- Encrypting bank account details
- Uses JWT access secret as encryption key

### Email Service

`EmailService` sends:
- Invitation emails with temporary passwords
- OTP emails with expiration time
- Configure SMTP in environment variables

## Module-Specific Patterns

### Property Module

**Transfer operations** require password validation:
```typescript
// Inject IAuthRepository for password verification
await this.authRepository.verifyPassword(userId, password)
```

**Bulk operations** should:
- Track success/failure separately
- Return detailed results with counts
- Use transactions for atomicity when needed

### PropertyPendingAction Module

Approval workflow for sensitive operations:
1. User requests action (DELETE, TRANSFER, BULK_TRANSFER)
2. Creates PENDING PropertyPendingAction record
3. Super admin approves/rejects
4. On approval: execute action and update status to APPROVED
5. On rejection: store rejection_reason and update status to REJECTED

### Audit Module

**OTA type mapping** (in `src/common/utils/audit.ts`):
- Case-insensitive status checks: `isPendingAudit()`, `isCompletedAudit()`, etc.
- OTA type from audit name: "Expedia Audit" → `OtaType.expedia`

**Batch operations**:
- AuditBatch has order field for sequencing
- Audits can belong to batch for grouping

### File Upload Module

S3 integration pattern:
```typescript
@UseInterceptors(FileInterceptor('file'))
uploadFile(@UploadedFile() file: Express.Multer.File) {
  // FileUploadService handles S3 upload
  return this.fileUploadService.uploadFile(file, 'folder-name')
}
```

## Environment Variables

Required in `.env`:

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

## Code Style & Conventions

- Use interface-based injection with string tokens (e.g., `'IPropertyService'`)
- Always validate user permissions in services before operations
- Use `@ApiOperation()` and `@ApiResponse()` decorators for Swagger documentation
- Handle Prisma errors in repositories, transform to HTTP exceptions in services
- Use TypeScript strict mode, enable all type checking
- Prefer explicit return types on methods
- Use async/await, not promise chains

## Swagger Documentation

Access API docs at: `http://localhost:3000/api/docs`

Tag endpoints by module:
```typescript
@ApiTags('Property')
@Controller('property')
export class PropertyController { }
```

Document all endpoints:
```typescript
@ApiOperation({ summary: 'Get all properties' })
@ApiResponse({ status: 200, description: 'Properties retrieved successfully' })
@Get()
async findAll() { }
```

## Testing Considerations

When adding tests:
- Mock all repository interfaces
- Test permission checks independently
- Verify validation rules in DTOs
- Test query builder with various filter combinations
- Mock PrismaService for repository tests

## Common Pitfalls

1. **Circular dependencies**: Use `forwardRef()` when modules reference each other (e.g., PropertyModule ↔ PropertyPendingActionModule)

2. **Partial access validation**: Don't forget to check resource ownership for users with partial access level

3. **Prisma type assertions**: When using dynamic includes, cast result with `as unknown as YourType` to satisfy TypeScript

4. **Password validation**: Sensitive operations (transfer, delete) require password verification via AuthRepository

5. **Enum values**: Always use Prisma-generated enums, not string literals

6. **Query builder nested fields**: Define nestedFieldMap for searchable relations to avoid errors
