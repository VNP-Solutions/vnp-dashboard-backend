# Role Invitation Hierarchy System

## Overview

The role invitation system implements a **hierarchical permission-based access control** that determines which roles a user can assign when inviting new users. This ensures that users cannot invite others with permissions higher than their own.

---

## Core Rules

### 1. Internal vs External User Restriction

| Inviter Type      | Can Invite Internal | Can Invite External |
| ----------------- | ------------------- | ------------------- |
| **Internal User** | ✓ Yes               | ✓ Yes               |
| **External User** | ✗ No                | ✓ Yes               |

**Rule:** Internal users can invite both internal and external users. External users can **only** invite external users.

### 2. Permission Hierarchy

For **each module**, the inviter's permissions must be **equal to or higher** than the target role's permissions.

### 3. Partial Access Resource Constraint ⭐ NEW

If the inviter has **partial access** to Portfolio or Property modules, they can **only** assign access to portfolios/properties **they have access to**.

| Inviter's Access Level | Can Assign                      |
| ---------------------- | ------------------------------- |
| **Portfolio: ALL**     | Any portfolio                   |
| **Portfolio: PARTIAL** | Only portfolios they can access |
| **Property: ALL**      | Any property                    |
| **Property: PARTIAL**  | Only properties they can access |

**Example:** If User A has partial access to Portfolio X and Y, they can only invite User B with access to Portfolio X, Y, or both—not Portfolio Z.

#### Permission Level Hierarchy (What actions can be performed)

```
all (highest)    → Full CRUD: Create, Read, Update, Delete
  ↓
update           → CRU: Create, Read, Update (no Delete)
  ↓
view (lowest)    → R: Read only
```

#### Access Level Hierarchy (Which resources can be accessed)

```
all (highest)    → Access all resources in the system
  ↓
partial          → Access only assigned/invited resources
  ↓
none (lowest)    → No access to any resources
```

---

## Permission Comparison Logic

For a user to invite a role, **BOTH** conditions must be met for **ALL modules**:

1. **Permission Level:** `inviter.permission_level >= target_role.permission_level`
2. **Access Level:** `inviter.access_level >= target_role.access_level`

### Modules Checked:

- Portfolio Permission
- Property Permission
- Audit Permission
- User Permission
- System Settings Permission
- Bank Details Permission

---

## Examples

### Example 1: Internal User with Full Permissions

**Inviter Role:**

```json
{
  "name": "Super Admin",
  "is_external": false,
  "portfolio_permission": { "permission_level": "all", "access_level": "all" },
  "property_permission": { "permission_level": "all", "access_level": "all" },
  "audit_permission": { "permission_level": "all", "access_level": "all" },
  "user_permission": { "permission_level": "all", "access_level": "all" },
  "system_settings_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "bank_details_permission": {
    "permission_level": "all",
    "access_level": "all"
  }
}
```

**Can Invite:** ✅ **ALL roles** (internal and external) - Super Admin has the highest permissions across all modules.

---

### Example 2: Internal Manager with Partial Access

**Inviter Role:**

```json
{
  "name": "Portfolio Manager",
  "is_external": false,
  "portfolio_permission": {
    "permission_level": "all",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "audit_permission": { "permission_level": "view", "access_level": "none" },
  "user_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "all"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "partial"
  }
}
```

**Can Invite:**

✅ **Roles with equal or lower permissions in ALL modules:**

```json
{
  "name": "Team Member",
  "is_external": false,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "audit_permission": { "permission_level": "view", "access_level": "none" },
  "user_permission": { "permission_level": "view", "access_level": "partial" },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "none"
  }
}
```

❌ **CANNOT Invite:**

```json
{
  "name": "Super Admin",
  "portfolio_permission": { "permission_level": "all", "access_level": "all" } // access_level "all" > inviter's "partial"
  // ... other permissions
}
```

**Reason:** Super Admin has `access_level: all` for portfolio, which is higher than the inviter's `access_level: partial`.

---

### Example 3: External User

**Inviter Role:**

```json
{
  "name": "External Auditor",
  "is_external": true,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "audit_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "user_permission": { "permission_level": "view", "access_level": "partial" },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "none"
  }
}
```

**Can Invite:**

✅ **External roles with equal or lower permissions:**

```json
{
  "name": "External Viewer",
  "is_external": true,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "audit_permission": { "permission_level": "view", "access_level": "partial" },
  "user_permission": { "permission_level": "view", "access_level": "none" },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "none"
  }
}
```

❌ **CANNOT Invite:**

- Any internal users (blocked by Rule 1)
- Any external roles with higher permissions

---

## API Usage

### Get All Roles (No Filtering)

**Request:**

```http
GET /user-role
Authorization: Bearer <token>
```

**Response:** Returns all roles the user has access to (all roles if user has USER module READ permission).

---

### Get Only Invitable Roles (Filtered)

**Request:**

```http
GET /user-role?invitable_only=true
Authorization: Bearer <token>
```

**Response:** Returns only roles the current user can assign when inviting new users, filtered based on:

1. Internal/external restriction
2. Permission hierarchy for all modules

**Example Response:**

```json
[
  {
    "id": "role123",
    "name": "Team Member",
    "description": "Basic team member role",
    "is_external": false,
    "is_active": true,
    "order": 3,
    "portfolio_permission": {
      "permission_level": "view",
      "access_level": "partial"
    },
    "property_permission": {
      "permission_level": "view",
      "access_level": "partial"
    }
    // ... other permissions
  },
  {
    "id": "role456",
    "name": "External Viewer",
    "description": "Read-only external access",
    "is_external": true,
    "is_active": true,
    "order": 5,
    "portfolio_permission": {
      "permission_level": "view",
      "access_level": "none"
    }
    // ... other permissions
  }
]
```

---

## Implementation Details

### Hierarchy Utility Functions

```typescript
// Get numeric hierarchy value for permission levels
getPermissionLevelHierarchyValue(level: PermissionLevel): number
// all = 3, update = 2, view = 1

// Get numeric hierarchy value for access levels
getAccessLevelHierarchyValue(level: AccessLevel): number
// all = 3, partial = 2, none = 1

// Compare two permissions
isPermissionEqualOrHigher(
  permission1: IPermission,
  permission2: IPermission
): boolean

// Check if user can invite a specific role
canInviteRole(
  inviterUser: IUserWithPermissions,
  targetRole: Role
): boolean
```

### Filter Logic in Service

```typescript
async findAll(user: IUserWithPermissions, invitableOnly?: boolean) {
  // Get all roles
  const allRoles = await this.userRoleRepository.findAll()

  // If invitable_only=true, filter based on hierarchy
  if (invitableOnly === true) {
    return allRoles.filter(role => canInviteRole(user, role))
  }

  return allRoles
}
```

---

## Use Cases

### Use Case 1: Role Selection in Invite Form

**Frontend Implementation:**

```javascript
// Fetch only invitable roles for dropdown
const response = await fetch('/user-role?invitable_only=true', {
  headers: { Authorization: `Bearer ${token}` }
})
const invitableRoles = await response.json()

// Populate role selection dropdown
const roleDropdown = invitableRoles.map(role => ({
  value: role.id,
  label: role.name,
  description: role.description
}))
```

**Benefits:**

- Users only see roles they can actually assign
- Prevents frontend validation errors
- Improves UX by reducing confusion

---

### Use Case 2: Department Manager Inviting Team

**Scenario:** A Portfolio Manager wants to invite a new team member.

**Step 1:** Manager selects "Invite User" and fetches available roles

```http
GET /user-role?invitable_only=true
```

**Step 2:** Backend filters roles based on manager's permissions

- ✅ Shows: "Team Member" (lower permissions)
- ✅ Shows: "External Viewer" (manager is internal, can invite external)
- ❌ Hides: "Super Admin" (higher permissions)
- ❌ Hides: "Another Portfolio Manager" (equal but some permissions higher)

**Step 3:** Manager selects role and completes invitation

```http
POST /auth/invite
{
  "email": "newuser@example.com",
  "role_id": "team_member_role_id",
  "first_name": "John",
  "last_name": "Doe",
  "language": "en"
}
```

---

### Use Case 3: External User Inviting Collaborator

**Scenario:** An External Auditor wants to invite a colleague.

**Constraints:**

- ❌ Cannot invite internal users
- ✅ Can only invite external users with equal or lower permissions

**Available Roles:**

```http
GET /user-role?invitable_only=true
```

Response includes only external roles with permissions ≤ External Auditor's permissions.

---

## Validation Flow

### Frontend Validation (Optional but Recommended)

1. Fetch invitable roles: `GET /user-role?invitable_only=true`
2. Display only these roles in the invite form
3. User selects a role from the filtered list
4. If role requires partial access, only show portfolios/properties the inviter has access to

### Backend Validation (Fully Implemented ✅)

When the invite request is submitted:

```http
POST /auth/invite
{
  "email": "newuser@example.com",
  "role_id": "selected_role_id",
  "first_name": "John",
  "last_name": "Doe",
  "language": "en",
  "portfolio_ids": ["portfolio1", "portfolio2"],  // Optional
  "property_ids": ["property1", "property2"]      // Optional
}
```

**Backend validates:**

1. ✅ Inviter has CREATE permission for USER module (permission_level: 'update' or 'all')
2. ✅ Selected role is invitable by current user (using `canInviteRole()`)
   - Checks internal/external restriction
   - Checks permission hierarchy for ALL modules
3. ✅ If inviter has partial portfolio access, validates all `portfolio_ids` are accessible to inviter
4. ✅ If inviter has partial property access, validates all `property_ids` are accessible to inviter
5. ❌ Rejects if any validation fails with specific error message

---

## Testing Scenarios

### Test 1: Super Admin

- Should see all roles when `invitable_only=true`

### Test 2: Internal Manager with Partial Access

- Should see only roles with ≤ permissions
- Should see both internal and external roles

### Test 3: External User

- Should NOT see any internal roles
- Should only see external roles with ≤ permissions

### Test 4: User with VIEW Permission Level

- Should NOT see roles requiring CREATE/UPDATE/DELETE
- Should only see roles with VIEW permission

### Test 5: Edge Case - Null Permissions

- Roles with null permissions for a module should be invitable (null = no restriction)

---

## Summary

The role invitation hierarchy system ensures:

1. ✅ **Security:** Users cannot escalate privileges by inviting users with higher permissions
2. ✅ **Flexibility:** Supports complex permission structures with multiple modules
3. ✅ **Clarity:** Clear hierarchy (all > update > view, all > partial > none)
4. ✅ **Separation:** Internal users can manage both internal and external, but external users are restricted
5. ✅ **API Efficiency:** Single query parameter (`invitable_only`) provides filtered results

This creates a robust, hierarchical permission system that scales with organizational complexity while maintaining security and usability.
