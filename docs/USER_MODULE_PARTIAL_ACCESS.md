# USER Module - Partial Access Level

## Overview

The **USER module** with `access_level: partial` provides scoped access control based on user invitation relationships. This allows users to manage their own "team" of invited users.

## Partial Access Behavior

When a user has **`user_permission.access_level = partial`**, they have the following capabilities:

### 1. **View/Read Users** (Requires `permission_level: view`, `update`, or `all`)
- Can **ONLY** see users they invited (where `invited_by_id` equals their user ID)
- Cannot see users invited by others
- Cannot see all users in the system

### 2. **Invite/Create Users** (Requires `permission_level: update` or `all`)
- Can **invite new users** to the system
- Invited users are automatically linked via `invited_by_id` field
- Those invited users become part of their accessible user list
- Can assign roles and access permissions during invitation

### 3. **Update Users** (Requires `permission_level: update` or `all`)
- Can update users they invited
- Cannot update users invited by others

### 4. **Delete Users** (Requires `permission_level: all`)
- Can delete users they invited
- Cannot delete users invited by others
- Super admin users cannot be deleted

---

## Permission Level Requirements

| Action | VIEW | UPDATE | ALL |
|--------|------|--------|-----|
| **List users they invited** | ✓ | ✓ | ✓ |
| **Read user details** | ✓ | ✓ | ✓ |
| **Invite new users** | ✗ | ✓ | ✓ |
| **Update users** | ✗ | ✓ | ✓ |
| **Delete users** | ✗ | ✗ | ✓ |

---

## Implementation Details

### Database Relationship
```prisma
model User {
  id             String   @id
  invited_by_id  String?  @db.ObjectId
  invitedBy      User?    @relation("UserInvitedBy", fields: [invited_by_id], references: [id])
  invitedUsers   User[]   @relation("UserInvitedBy")
  // ... other fields
}
```

### How Access is Determined

The `PermissionService.getAccessibleResourceIds()` method handles USER module partial access:

```typescript
// USER module partial access: user can only see users they invited
if (module === ModuleType.USER) {
  const invitedUsers = await this.prisma.user.findMany({
    where: { invited_by_id: user.id },
    select: { id: true }
  })
  return invitedUsers.map(u => u.id)
}
```

For individual resource checks:

```typescript
// USER module partial access: check if the resource user was invited by current user
if (module === ModuleType.USER) {
  const targetUser = await this.prisma.user.findUnique({
    where: { id: resourceId },
    select: { invited_by_id: true }
  })
  return targetUser?.invited_by_id === user.id
}
```

---

## API Endpoints

### 1. Invite User
**POST** `/auth/invite`

**Permission Required:** `user_permission.permission_level = update` or `all`

**Behavior:**
- Creates new user with `invited_by_id` set to current user's ID
- Automatically adds the invited user to the inviter's accessible users list
- Sends invitation email with temporary password

```json
{
  "email": "newuser@example.com",
  "role_id": "507f1f77bcf86cd799439011",
  "first_name": "John",
  "last_name": "Doe",
  "language": "en",
  "portfolio_ids": ["..."],  // Optional
  "property_ids": ["..."]    // Optional
}
```

### 2. List Users
**GET** `/users`

**Permission Required:** `user_permission.access_level = partial` + `permission_level = view/update/all`

**Behavior:**
- Returns only users where `invited_by_id = current_user.id`
- Supports pagination, search, filters, and sorting

### 3. Get User by ID
**GET** `/users/:id`

**Permission Required:** `user_permission.access_level = partial` + `permission_level = view/update/all`

**Behavior:**
- Only succeeds if target user was invited by current user
- Otherwise returns 403 Forbidden

### 4. Update User
**PATCH** `/users/:id`

**Permission Required:** `user_permission.access_level = partial` + `permission_level = update/all` + Super Admin

**Behavior:**
- Only super admins can update users
- Partial access doesn't apply (super admins have ALL access by default)

### 5. Delete User
**POST** `/users/:id/delete`

**Permission Required:** `user_permission.access_level = partial` + `permission_level = all` + Super Admin

**Behavior:**
- Only super admins can delete users
- Partial access doesn't apply (super admins have ALL access by default)

---

## Comparison with Other Modules

| Module | Partial Access Mechanism |
|--------|--------------------------|
| **USER** | Based on `invited_by_id` relationship |
| **PORTFOLIO** | Based on `UserAccessedProperty.portfolio_id` array |
| **PROPERTY** | Based on `UserAccessedProperty.property_id` array |
| **BANK_DETAILS** | Maps to PROPERTY access (same as PROPERTY) |
| **SYSTEM_SETTINGS** | Partial behaves same as ALL (no restrictions) |
| **AUDIT** | Partial not supported (behaves as NONE) |

---

## Example Use Cases

### Use Case 1: Department Manager
**Role Configuration:**
```json
{
  "name": "Department Manager",
  "user_permission": {
    "permission_level": "update",
    "access_level": "partial"
  }
}
```

**Capabilities:**
- ✓ Invite team members to their department
- ✓ View all team members they invited
- ✓ Update team member profiles (if super admin)
- ✗ Cannot see users invited by other managers
- ✗ Cannot delete users (needs `permission_level: all`)

### Use Case 2: Team Lead
**Role Configuration:**
```json
{
  "name": "Team Lead",
  "user_permission": {
    "permission_level": "view",
    "access_level": "partial"
  }
}
```

**Capabilities:**
- ✗ Cannot invite new users (needs `permission_level: update` or `all`)
- ✓ View users they previously invited (read-only)
- ✗ Cannot update or delete users

### Use Case 3: Super Admin with Partial (Not Common)
**Role Configuration:**
```json
{
  "name": "Scoped Admin",
  "user_permission": {
    "permission_level": "all",
    "access_level": "partial"
  }
}
```

**Capabilities:**
- ✓ Invite new users
- ✓ View users they invited
- ✓ Update users they invited
- ✓ Delete users they invited
- ✗ Cannot see/manage users invited by others

---

## Important Notes

1. **Super Admin Override:** Actual super admin users (with `access_level: all`) can manage ALL users, not just those they invited.

2. **Automatic Linking:** When a user with partial access invites someone, the `invited_by_id` is automatically set, creating the access relationship.

3. **No Manual Access Management:** Unlike PORTFOLIO/PROPERTY modules, you cannot manually add/revoke user access. It's purely based on the invitation relationship.

4. **Cascade Behavior:** If a user with partial access is deleted, their invited users are NOT automatically deleted (they still exist in the system).

5. **Role Changes:** If a user's role changes from partial to all/none, their invitation relationships remain in the database but are no longer used for access control.

---

## Summary

**Partial access for USER module** creates a natural hierarchy where each user manages their own "team" based on who they invited. This is perfect for:
- Department-based organizations
- Multi-tenant systems where each tenant admin manages their users
- Hierarchical teams where managers invite and manage their direct reports
