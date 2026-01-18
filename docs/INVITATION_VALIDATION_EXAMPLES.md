# User Invitation Validation - Detailed Examples

## Overview

This document provides detailed examples of the invitation validation system, including both successful and failed scenarios for resource access constraints.

---

## Scenario 1: Partial Portfolio Access - Valid Invitation

### Inviter: Portfolio Manager

**Permissions:**

```json
{
  "name": "Portfolio Manager",
  "is_external": false,
  "portfolio_permission": {
    "permission_level": "all",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "all",
    "access_level": "partial"
  },
  "user_permission": { "permission_level": "update", "access_level": "partial" }
}
```

**Accessible Resources:**

- Portfolios: `["portfolio-A", "portfolio-B"]`
- Properties: `["property-1", "property-2", "property-3"]`

### Invitation Request ✅ VALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "newteam@example.com",
  "role_id": "team_member_role_id",
  "first_name": "New",
  "last_name": "Member",
  "language": "en",
  "portfolio_ids": ["portfolio-A"],
  "property_ids": ["property-1", "property-2"]
}
```

**Result:** ✅ **SUCCESS** - All assigned portfolios and properties are in inviter's accessible list.

---

## Scenario 2: Partial Portfolio Access - Invalid Invitation

### Same Inviter as Scenario 1

**Accessible Resources:**

- Portfolios: `["portfolio-A", "portfolio-B"]`
- Properties: `["property-1", "property-2", "property-3"]`

### Invitation Request ❌ INVALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "newteam@example.com",
  "role_id": "team_member_role_id",
  "first_name": "New",
  "last_name": "Member",
  "language": "en",
  "portfolio_ids": ["portfolio-A", "portfolio-C"],  // portfolio-C not accessible!
  "property_ids": ["property-1"]
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "You cannot assign access to portfolios you don't have access to: portfolio-C",
  "statusCode": 403
}
```

**Result:** ❌ **REJECTED** - `portfolio-C` is not in inviter's accessible portfolios.

---

## Scenario 3: Partial Property Access - Invalid Invitation

### Same Inviter as Scenario 1

**Accessible Resources:**

- Portfolios: `["portfolio-A", "portfolio-B"]`
- Properties: `["property-1", "property-2", "property-3"]`

### Invitation Request ❌ INVALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "newteam@example.com",
  "role_id": "team_member_role_id",
  "first_name": "New",
  "last_name": "Member",
  "language": "en",
  "portfolio_ids": ["portfolio-A"],
  "property_ids": ["property-1", "property-4", "property-5"]  // property-4 and property-5 not accessible!
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "You cannot assign access to properties you don't have access to: property-4, property-5",
  "statusCode": 403
}
```

**Result:** ❌ **REJECTED** - `property-4` and `property-5` are not in inviter's accessible properties.

---

## Scenario 4: Full Access - Can Assign Any Resources

### Inviter: Super Admin

**Permissions:**

```json
{
  "name": "Super Admin",
  "is_external": false,
  "portfolio_permission": { "permission_level": "all", "access_level": "all" },
  "property_permission": { "permission_level": "all", "access_level": "all" },
  "user_permission": { "permission_level": "all", "access_level": "all" }
}
```

**Accessible Resources:**

- Portfolios: `'all'` (all portfolios in system)
- Properties: `'all'` (all properties in system)

### Invitation Request ✅ VALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "newuser@example.com",
  "role_id": "any_role_id",
  "first_name": "Any",
  "last_name": "User",
  "language": "en",
  "portfolio_ids": ["portfolio-X", "portfolio-Y", "portfolio-Z"],
  "property_ids": ["property-A", "property-B", "property-C"]
}
```

**Result:** ✅ **SUCCESS** - Super Admin with `access_level: "all"` can assign any portfolios/properties.

---

## Scenario 5: Role Hierarchy Violation

### Inviter: Team Lead

**Permissions:**

```json
{
  "name": "Team Lead",
  "is_external": false,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "user_permission": { "permission_level": "update", "access_level": "partial" }
}
```

### Target Role: Portfolio Manager (Higher Permissions)

```json
{
  "name": "Portfolio Manager",
  "portfolio_permission": {
    "permission_level": "all",
    "access_level": "partial"
  }
  // Target has "all" permission level for portfolio, inviter only has "view"
}
```

### Invitation Request ❌ INVALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "newmanager@example.com",
  "role_id": "portfolio_manager_role_id",
  "first_name": "New",
  "last_name": "Manager",
  "language": "en"
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "You cannot invite users with this role. The role has permissions equal to or higher than yours, or you cannot invite this user type (internal/external).",
  "statusCode": 403
}
```

**Result:** ❌ **REJECTED** - Target role has higher portfolio permission level (`all` > `view`).

---

## Scenario 6: External User Inviting Internal User

### Inviter: External Auditor

**Permissions:**

```json
{
  "name": "External Auditor",
  "is_external": true,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "user_permission": { "permission_level": "update", "access_level": "partial" }
}
```

### Target Role: Internal Team Member

```json
{
  "name": "Team Member",
  "is_external": false
}
```

### Invitation Request ❌ INVALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "internal@example.com",
  "role_id": "team_member_role_id",
  "first_name": "Internal",
  "last_name": "User",
  "language": "en"
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "You cannot invite users with this role. The role has permissions equal to or higher than yours, or you cannot invite this user type (internal/external).",
  "statusCode": 403
}
```

**Result:** ❌ **REJECTED** - External users cannot invite internal users.

---

## Scenario 7: Valid Multi-Level Constraint

### Inviter: Department Manager

**Permissions:**

```json
{
  "name": "Department Manager",
  "is_external": false,
  "portfolio_permission": {
    "permission_level": "all",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "all",
    "access_level": "partial"
  },
  "user_permission": { "permission_level": "update", "access_level": "partial" }
}
```

**Accessible Resources:**

- Portfolios: `["portfolio-A", "portfolio-B", "portfolio-C"]`
- Properties: `["prop-1", "prop-2", "prop-3", "prop-4"]`

### Target Role: Team Member (Lower Permissions)

```json
{
  "name": "Team Member",
  "is_external": false,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "user_permission": { "permission_level": "view", "access_level": "none" }
}
```

### Invitation Request ✅ VALID

```http
POST /auth/invite
Content-Type: application/json
Authorization: Bearer <inviter_token>

{
  "email": "member@example.com",
  "role_id": "team_member_role_id",
  "first_name": "Team",
  "last_name": "Member",
  "language": "en",
  "portfolio_ids": ["portfolio-A", "portfolio-B"],
  "property_ids": ["prop-1", "prop-3"]
}
```

**Validation Checks:**

1. ✅ **Internal/External:** Both are internal
2. ✅ **Portfolio Permission:** inviter `all/partial` >= target `view/partial`
3. ✅ **Property Permission:** inviter `all/partial` >= target `update/partial`
4. ✅ **User Permission:** inviter `update/partial` >= target `view/none`
5. ✅ **Portfolio Access:** All assigned portfolios are in inviter's accessible list
6. ✅ **Property Access:** All assigned properties are in inviter's accessible list

**Result:** ✅ **SUCCESS** - All validations passed.

---

## Summary Table

| Scenario | Inviter Access | Assigned Resources             | Role Hierarchy  | Internal/External | Result      |
| -------- | -------------- | ------------------------------ | --------------- | ----------------- | ----------- |
| 1        | Partial        | Within accessible              | Valid           | Valid             | ✅ Success  |
| 2        | Partial        | Outside accessible (portfolio) | Valid           | Valid             | ❌ Rejected |
| 3        | Partial        | Outside accessible (property)  | Valid           | Valid             | ❌ Rejected |
| 4        | All            | Any                            | Valid           | Valid             | ✅ Success  |
| 5        | Partial        | N/A                            | Invalid (lower) | Valid             | ❌ Rejected |
| 6        | Partial        | N/A                            | Valid           | Invalid           | ❌ Rejected |
| 7        | Partial        | Within accessible              | Valid           | Valid             | ✅ Success  |

---

## Error Messages Reference

| Error Condition          | HTTP Status | Error Message                                                                                                                                              |
| ------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission level too low | 403         | "You do not have permission to invite users. Only users with CREATE permission (all or update) can invite."                                                |
| Role hierarchy violation | 403         | "You cannot invite users with this role. The role has permissions equal to or higher than yours, or you cannot invite this user type (internal/external)." |
| Invalid portfolio access | 403         | "You cannot assign access to portfolios you don't have access to: [list]"                                                                                  |
| Invalid property access  | 403         | "You cannot assign access to properties you don't have access to: [list]"                                                                                  |
| Email already exists     | 409         | "User with this email already exists"                                                                                                                      |
| Role not found           | 400         | "Selected role not found"                                                                                                                                  |

---

## Best Practices

### For Frontend Developers

1. **Fetch Invitable Roles:**

   ```javascript
   const roles = await fetch('/user-role?invitable_only=true')
   ```

2. **Fetch Accessible Resources (for partial access users):**

   ```javascript
   const portfolios = await fetch('/portfolio') // Returns only accessible portfolios
   const properties = await fetch('/property') // Returns only accessible properties
   ```

3. **Validate Before Submit:**
   - Only show accessible resources in selection dropdowns
   - Disable role options that are not invitable
   - Provide clear feedback on why certain options are unavailable

### For Backend Developers

1. **Always validate role hierarchy** using `canInviteRole()`
2. **Always validate resource access** for partial access users
3. **Return specific error messages** to help users understand what went wrong
4. **Log validation failures** for security auditing

### For System Administrators

1. **Design roles carefully** to establish clear hierarchies
2. **Grant partial access judiciously** - it limits what users can delegate
3. **Monitor invitation patterns** to detect potential security issues
4. **Educate users** on their limitations based on their role

---

## Testing Checklist

- [ ] Internal user can invite both internal and external users
- [ ] External user can only invite external users
- [ ] User cannot invite role with higher permissions
- [ ] User with partial portfolio access cannot assign inaccessible portfolios
- [ ] User with partial property access cannot assign inaccessible properties
- [ ] User with full access can assign any portfolios/properties
- [ ] Appropriate error messages for each validation failure
- [ ] Validation works for edge cases (empty arrays, null values, etc.)
