# Permission Security Audit Results

## Module Analysis

### ✅ Portfolio Module - **SECURE**

**Controller**: `portfolio.controller.ts`

- ✅ Uses `@RequirePermission` decorators correctly
- ✅ `useResourceId: true` for specific resource operations (GET/:id, PATCH/:id, DELETE/:id)
- ✅ `useResourceId: false` for CREATE and LIST operations

**Service**: `portfolio.service.ts`

```typescript
async findAll(user: IUserWithPermissions) {
  const accessibleIds = this.permissionService.getAccessibleResourceIds(
    user,
    ModuleType.PORTFOLIO
  )

  if (accessibleIds === 'all') {
    return this.portfolioRepository.findAll()  // ✅ Returns all
  }

  if (accessibleIds.length === 0) {
    return []  // ✅ Returns empty
  }

  return this.portfolioRepository.findAll(accessibleIds)  // ✅ Filters by IDs
}
```

**Security Status**: ✅ **SECURE**

- Properly filters list results based on access level
- Permission guard checks resource access for specific operations
- Supports both `all` and `partial` access levels

---

### ⚠️ UserRole Module - **NEEDS FIX**

**Controller**: `user-role.controller.ts`

- ✅ Uses `@RequirePermission` decorators correctly
- ✅ `useResourceId: true` for specific resource operations
- ✅ Guards are properly configured

**Service**: `user-role.service.ts`

```typescript
async findAll(_user: IUserWithPermissions) {
  return this.userRoleRepository.findAll()  // ❌ Always returns all!
}
```

**Security Issue**: ⚠️ **BYPASSES ACCESS LEVEL**

- Does NOT check user's access level
- Always returns all roles regardless of permission
- Even users with `access_level: none` can see all roles via LIST endpoint

**Impact**:

- User with `user_permission: { permission_level: 'view', access_level: 'none' }` can:
  - ❌ Call GET /user-role and see all roles (should return empty)
- User with `user_permission: { permission_level: 'view', access_level: 'partial' }` can:
  - ❌ Call GET /user-role and see all roles (should return empty per audit)

**Why This Happens**:

1. Controller has permission check: `@RequirePermission(ModuleType.USER_ROLE, PermissionAction.READ)`
2. This checks if user has READ permission (permission_level check) ✅
3. But for LIST (no resourceId), it only checks permission_level, not access_level
4. Service doesn't filter based on access_level

---

### ✅ Auth Module - **SECURE**

**Controller**: `auth.controller.ts`

- ✅ Marked as `@Public()` - correct for authentication endpoints
- ✅ No permission checks needed

**Security Status**: ✅ **SECURE** (intentionally public)

---

### ✅ App Controller - **SECURE**

**Controller**: `app.controller.ts`

- ✅ Marked as `@Public()` - correct for health check
- ✅ No sensitive data exposed

**Security Status**: ✅ **SECURE** (intentionally public)

---

## Issues Found

### 🔴 Critical Issue: UserRole List Endpoint Bypasses Access Level

**File**: `src/modules/user-role/user-role.service.ts`
**Method**: `findAll()`

**Current Code**:

```typescript
async findAll(_user: IUserWithPermissions) {
  return this.userRoleRepository.findAll()
}
```

**Problem**:

- Ignores `access_level` completely
- Returns all roles even if user has `access_level: none` or `partial`

**Expected Behavior**:
Per our access level audit, USER_ROLE module doesn't support partial access, so:

- `access_level: all` → Return all roles ✅
- `access_level: partial` → Return empty array (no partial support) ❌
- `access_level: none` → Return empty array ❌

**Fix Required**:

```typescript
async findAll(user: IUserWithPermissions) {
  const accessibleIds = this.permissionService.getAccessibleResourceIds(
    user,
    ModuleType.USER_ROLE
  )

  // USER_ROLE doesn't support partial access
  // So accessibleIds will be either 'all' or []
  if (accessibleIds === 'all') {
    return this.userRoleRepository.findAll()
  }

  // access_level is 'partial' or 'none' - no roles accessible
  return []
}
```

---

## Security Recommendations

### 1. **Fix UserRole Service Immediately** 🔴 HIGH PRIORITY

The `findAll()` method in `user-role.service.ts` MUST check access level.

### 2. **Establish Service-Level Filtering Pattern** 📋

**Every service with a `findAll()` method MUST**:

1. Call `permissionService.getAccessibleResourceIds(user, module)`
2. Handle three cases:
   - `'all'` → Return all resources
   - `string[]` → Filter by IDs (for modules supporting partial access)
   - `[]` (empty) → Return empty array

### 3. **Guard vs Service Responsibility** 🛡️

**Permission Guard** (Controller Level):

- ✅ Checks `permission_level` (Can user perform this action?)
- ✅ Checks `access_level` for specific resources (useResourceId: true)
- ❌ Does NOT filter list results (no resourceId provided)

**Service** (Business Logic Level):

- ✅ MUST filter list results based on `access_level`
- ✅ MUST use `getAccessibleResourceIds()` for filtering

### 4. **Modules That Don't Support Partial Access**

For modules like USER_ROLE, AUDIT, SYSTEM_SETTINGS:

- `access_level: all` → Full access
- `access_level: partial` → **NO ACCESS** (return empty)
- `access_level: none` → **NO ACCESS** (return empty)

This is already handled correctly by `getAccessibleResourceIds()`, services just need to use it.

---

## Testing Checklist

### For Each Module with LIST Endpoint:

- [ ] **Portfolio Module**
  - [x] User with `access_level: all` can see all portfolios
  - [x] User with `access_level: partial` sees only assigned portfolios
  - [x] User with `access_level: none` sees empty array
- [ ] **UserRole Module**
  - [ ] User with `access_level: all` can see all roles
  - [ ] User with `access_level: partial` sees empty array (no partial support)
  - [ ] User with `access_level: none` sees empty array

### For Each Module with Specific Resource Endpoints (GET/:id, PATCH/:id, DELETE/:id):

- [ ] **Portfolio Module**
  - [x] User with `access_level: all` can access any portfolio
  - [x] User with `access_level: partial` can access only assigned portfolios
  - [x] User with `access_level: none` cannot access any portfolio
- [ ] **UserRole Module**
  - [x] Permission guard checks work (useResourceId: true)
  - [x] User with `access_level: none` cannot access any role

---

## Summary

| Module        | Controller | Service Filtering | Status            |
| ------------- | ---------- | ----------------- | ----------------- |
| **Portfolio** | ✅ Correct | ✅ Correct        | ✅ **SECURE**     |
| **UserRole**  | ✅ Correct | ❌ **Missing**    | ⚠️ **FIX NEEDED** |
| **Auth**      | ✅ Public  | N/A               | ✅ **SECURE**     |
| **App**       | ✅ Public  | N/A               | ✅ **SECURE**     |

**Critical Fix Required**: UserRole module's `findAll()` service method must implement access level filtering.
