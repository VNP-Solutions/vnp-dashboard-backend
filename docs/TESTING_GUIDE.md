# Testing Guide - User Invitation & Permission System

This guide provides step-by-step instructions for testing the user invitation system, role hierarchy, and permission constraints.

---

## 📋 Prerequisites

### 1. Setup Test Data

Run the test seed script to create roles and users:

```bash
# Run the test seed
yarn ts-node prisma/seed-test-users.ts

# Or if you have a seed script configured
npm run seed:test
```

### 2. Common Password

**All test accounts use the same password:**
```
AluVaj!1*
```

---

## 👥 Test Accounts

### Internal Users

| Account | Email | Role | Purpose |
|---------|-------|------|---------|
| Super Admin | `superadmin@vnp.com` | Super Admin | Full system access, can invite anyone |
| Marriott Manager | `pm.marriott@vnp.com` | Portfolio Manager | Manage Marriott portfolio, invite lower roles |
| Hilton Manager | `pm.hilton@vnp.com` | Portfolio Manager | Manage Hilton portfolio, invite lower roles |
| NYC Property Manager | `propmanager.nyc@vnp.com` | Property Manager | Manage NYC properties, limited user access |
| London Property Manager | `propmanager.london@vnp.com` | Property Manager | Manage London properties, limited user access |
| Internal Auditor 1 | `auditor1@vnp.com` | Auditor | Audit access to first 2 portfolios |
| Internal Auditor 2 | `auditor2@vnp.com` | Auditor | Audit access to middle portfolios |
| Team Member 1 | `teammember1@vnp.com` | Team Member | View access, Marriott portfolio |
| Team Member 2 | `teammember2@vnp.com` | Team Member | View access, Marriott portfolio |
| Viewer 1 | `viewer1@vnp.com` | Viewer | Read-only access, limited scope |

### External Users

| Account | Email | Role | Purpose |
|---------|-------|------|---------|
| External Auditor 1 | `ext.auditor1@external.com` | External Auditor | Audit work, can invite other external users |
| External Auditor 2 | `ext.auditor2@external.com` | External Auditor | Audit work, limited invitation rights |
| External Collaborator 1 | `ext.collab1@external.com` | External Collaborator | Limited access, can invite external viewers |
| External Viewer 1 | `ext.viewer1@external.com` | External Viewer | Read-only, minimal invitation rights |

---

## 🎯 Testing Scenarios

### Scenario 1: Super Admin Invitation Test

**Objective:** Verify Super Admin can invite any role (internal or external)

**Steps:**

1. **Login as Super Admin**
   - Email: `superadmin@vnp.com`
   - Password: `AluVaj!1*`

2. **Get All Roles**
   ```http
   GET /user-role
   Authorization: Bearer <super_admin_token>
   ```
   - ✅ Should return ALL roles (9 roles)

3. **Get Invitable Roles**
   ```http
   GET /user-role?invitable_only=true
   Authorization: Bearer <super_admin_token>
   ```
   - ✅ Should return ALL 9 roles (Super Admin has highest permissions)

4. **Invite External User**
   ```http
   POST /auth/invite
   Authorization: Bearer <super_admin_token>
   Content-Type: application/json

   {
     "email": "new.external@test.com",
     "role_id": "<external_auditor_role_id>",
     "first_name": "New",
     "last_name": "External",
     "language": "en"
   }
   ```
   - ✅ Should succeed (Super Admin can invite external users)

5. **Invite Internal User**
   ```http
   POST /auth/invite
   Authorization: Bearer <super_admin_token>

   {
     "email": "new.manager@test.com",
     "role_id": "<portfolio_manager_role_id>",
     "first_name": "New",
     "last_name": "Manager",
     "language": "en"
   }
   ```
   - ✅ Should succeed (Super Admin can invite internal users)

**Expected Results:**
- ✅ Super Admin sees all roles
- ✅ Super Admin can invite any role (internal or external)
- ✅ No permission errors

---

### Scenario 2: Portfolio Manager Partial Access Test

**Objective:** Verify Portfolio Manager with partial access can only assign resources they have access to

**Steps:**

1. **Login as Marriott Manager**
   - Email: `pm.marriott@vnp.com`
   - Password: `AluVaj!1*`

2. **Get Invitable Roles**
   ```http
   GET /user-role?invitable_only=true
   Authorization: Bearer <marriott_manager_token>
   ```
   - ✅ Should NOT show Super Admin role (higher permissions)
   - ✅ Should NOT show other Portfolio Managers (equal level, some permissions may be higher)
   - ✅ Should show Team Member, Viewer, External roles

3. **Try to Invite User with Partial Access (Valid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <marriott_manager_token>

   {
     "email": "marriott.team@test.com",
     "role_id": "<team_member_role_id>",
     "first_name": "Marriott",
     "last_name": "Team",
     "language": "en",
     "portfolio_ids": ["<marriott_portfolio_id>"],
     "property_ids": ["<marriott_property_id>"]
   }
   ```
   - ✅ Should succeed (assigning resources manager has access to)

4. **Try to Invite User with Different Portfolio (Invalid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <marriott_manager_token>

   {
     "email": "hilton.team@test.com",
     "role_id": "<team_member_role_id>",
     "first_name": "Hilton",
     "last_name": "Team",
     "language": "en",
     "portfolio_ids": ["<hilton_portfolio_id>"],  // Manager doesn't have access
     "property_ids": ["<hilton_property_id>"]
   }
   ```
   - ❌ Should FAIL with error: "Cannot grant access to portfolios you don't have access to"

**Expected Results:**
- ✅ Manager can only invite roles with equal or lower permissions
- ✅ Manager can only assign portfolios/properties they have access to
- ❌ Manager cannot assign resources outside their access

---

### Scenario 3: External User Invitation Test

**Objective:** Verify external users can only invite other external users

**Steps:**

1. **Login as External Auditor**
   - Email: `ext.auditor1@external.com`
   - Password: `AluVaj!1*`

2. **Get Invitable Roles**
   ```http
   GET /user-role?invitable_only=true
   Authorization: Bearer <external_auditor_token>
   ```
   - ❌ Should NOT show any internal roles
   - ✅ Should only show external roles with ≤ permissions
   - ✅ Should see External Collaborator, External Viewer

3. **Try to Invite External User (Valid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <external_auditor_token>

   {
     "email": "new.external@test.com",
     "role_id": "<external_viewer_role_id>",
     "first_name": "New",
     "last_name": "External",
     "language": "en",
     "portfolio_ids": ["<portfolio_id_they_have_access_to>"],
     "property_ids": ["<property_id_they_have_access_to>"]
   }
   ```
   - ✅ Should succeed

4. **Try to Invite Internal User (Invalid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <external_auditor_token>

   {
     "email": "new.internal@test.com",
     "role_id": "<team_member_role_id>",  // Internal role
     "first_name": "New",
     "last_name": "Internal",
     "language": "en"
   }
   ```
   - ❌ Should FAIL with error: "External users cannot invite internal users"

**Expected Results:**
- ✅ External users only see external roles
- ✅ External users can only invite external users
- ❌ External users cannot invite internal users

---

### Scenario 4: Permission Hierarchy Test

**Objective:** Verify users cannot invite roles with higher permissions

**Steps:**

1. **Login as Team Member**
   - Email: `teammember1@vnp.com`
   - Password: `AluVaj!1*`

2. **Get Invitable Roles**
   ```http
   GET /user-role?invitable_only=true
   Authorization: Bearer <team_member_token>
   ```
   - ✅ Should only show Viewer role (lower permissions)
   - ❌ Should NOT show Auditor, Property Manager, etc.

3. **Try to Invite Viewer (Valid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <team_member_token>

   {
     "email": "new.viewer@test.com",
     "role_id": "<viewer_role_id>",
     "first_name": "New",
     "last_name": "Viewer",
     "language": "en",
     "portfolio_ids": ["<marriott_portfolio_id>"],
     "property_ids": ["<marriott_property_id>"]
   }
   ```
   - ✅ Should succeed (Viewer has lower permissions)

4. **Try to Invite Auditor (Invalid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <team_member_token>

   {
     "email": "new.auditor@test.com",
     "role_id": "<auditor_role_id>",  // Higher permissions
     "first_name": "New",
     "last_name": "Auditor",
     "language": "en"
   }
   ```
   - ❌ Should FAIL with error: "Cannot invite role with higher permissions"

**Expected Results:**
- ✅ Users can only invite roles with equal or lower permissions
- ❌ Users cannot invite roles with higher permissions

---

### Scenario 5: Property Manager Constraints Test

**Objective:** Verify Property Manager has limited user management capabilities

**Steps:**

1. **Login as Property Manager**
   - Email: `propmanager.nyc@vnp.com`
   - Password: `AluVaj!1*`

2. **Check User Permissions**
   - View role: Property Manager
   - User permission level: `view`
   - User access level: `none`

3. **Try to Invite User (Invalid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <property_manager_token>

   {
     "email": "new.user@test.com",
     "role_id": "<viewer_role_id>",
     "first_name": "New",
     "last_name": "User",
     "language": "en"
   }
   ```
   - ❌ Should FAIL with error: "Insufficient permissions to invite users"

4. **Get Roles (Should Work)**
   ```http
   GET /user-role
   Authorization: Bearer <property_manager_token>
   ```
   - ✅ Should succeed (Property Manager has VIEW permission on User module)

**Expected Results:**
- ✅ Property Manager can view roles
- ❌ Property Manager cannot invite users (no CREATE permission)

---

### Scenario 6: Cross-Portfolio Access Test

**Objective:** Verify users cannot access resources outside their assigned portfolios

**Steps:**

1. **Login as Marriott Manager**
   - Email: `pm.marriott@vnp.com`
   - Password: `AluVaj!1*`

2. **Try to Access Hilton Portfolio**
   ```http
   GET /portfolio/<hilton_portfolio_id>
   Authorization: Bearer <marriott_manager_token>
   ```
   - ❌ Should FAIL or return empty (manager doesn't have access)

3. **Access Marriott Portfolio (Valid)**
   ```http
   GET /portfolio/<marriott_portfolio_id>
   Authorization: Bearer <marriott_manager_token>
   ```
   - ✅ Should succeed

**Expected Results:**
- ✅ Users can only access assigned portfolios
- ❌ Users cannot access unassigned portfolios

---

### Scenario 7: External User Partial Access Test

**Objective:** Verify external users can only invite with resources they have access to

**Steps:**

1. **Login as External Auditor**
   - Email: `ext.auditor1@external.com`
   - Password: `AluVaj!1*`

2. **Check User's Access**
   ```http
   GET /user/me
   Authorization: Bearer <external_auditor_token>
   ```
   - Note the `portfolio_ids` and `property_ids` in response

3. **Try to Invite with Valid Access (Valid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <external_auditor_token>

   {
     "email": "new.external@test.com",
     "role_id": "<external_viewer_role_id>",
     "first_name": "New",
     "last_name": "External",
     "language": "en",
     "portfolio_ids": ["<portfolio_id_from_step2>"],  // User has access
     "property_ids": ["<property_id_from_step2>"]     // User has access
   }
   ```
   - ✅ Should succeed

4. **Try to Invite with Invalid Access (Invalid)**
   ```http
   POST /auth/invite
   Authorization: Bearer <external_auditor_token>

   {
     "email": "another.external@test.com",
     "role_id": "<external_viewer_role_id>",
     "first_name": "Another",
     "last_name": "External",
     "language": "en",
     "portfolio_ids": ["<different_portfolio_id>"],  // User doesn't have access
     "property_ids": ["<different_property_id>"]
   }
   ```
   - ❌ Should FAIL with error about resource access

**Expected Results:**
- ✅ External users can only assign resources they have access to
- ❌ External users cannot assign resources outside their access

---

## 🔍 Quick Test Commands

### Using cURL

```bash
# Login and get token
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@vnp.com"}'

# Verify OTP and get JWT
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@vnp.com", "otp": <OTP_FROM_EMAIL>}'

# Get roles
curl -X GET http://localhost:3000/api/user-role?invitable_only=true \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Invite user
curl -X POST http://localhost:3000/api/auth/invite \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role_id": "<ROLE_ID>",
    "first_name": "Test",
    "last_name": "User",
    "language": "en"
  }'
```

### Using Swagger UI

1. Open browser: `http://localhost:3000/api/docs`
2. Click "Authorize" button
3. Enter JWT token (format: `Bearer <token>`)
4. Test endpoints from UI

---

## 🧪 Verification Checklist

### Role Hierarchy

- [ ] Super Admin sees all 9 roles
- [ ] Super Admin can invite all roles
- [ ] Portfolio Manager cannot invite Super Admin
- [ ] Portfolio Manager cannot invite other Portfolio Managers
- [ ] Team Member can only invite Viewer
- [ ] External users only see external roles

### Internal/External Separation

- [ ] Internal users can invite internal users
- [ ] Internal users can invite external users
- [ ] External users CANNOT invite internal users
- [ ] External users can invite external users

### Partial Access Constraints

- [ ] Users with partial portfolio access can only assign their portfolios
- [ ] Users with partial property access can only assign their properties
- [ ] Attempting to assign unassigned resources fails with error

### Permission Levels

- [ ] Users with VIEW permission cannot CREATE users
- [ ] Users with UPDATE permission can CREATE users
- [ ] Users with ALL permission can DELETE users

### Access Levels

- [ ] Users with ALL access can see all resources
- [ ] Users with PARTIAL access only see assigned resources
- [ ] Users with NONE access cannot see resources

---

## 📝 Test Data Summary

### Roles Created (9 total)

**Internal Roles (6):**
1. Super Admin - All permissions, All access
2. Portfolio Manager - Most permissions, Partial access
3. Property Manager - Property focus, No user management
4. Auditor - Audit focus, View only elsewhere
5. Team Member - View permissions, Partial access
6. Viewer - Read-only, Partial access

**External Roles (3):**
1. External Auditor - Audit update, Partial access
2. External Collaborator - View permissions, Partial access
3. External Viewer - Read-only, None/Partial access

### Users Created (14 total)

**Internal Users (10):**
- 1 Super Admin
- 2 Portfolio Managers (Marriott, Hilton)
- 2 Property Managers (NYC, London)
- 2 Internal Auditors
- 2 Team Members
- 1 Viewer

**External Users (4):**
- 2 External Auditors
- 1 External Collaborator
- 1 External Viewer

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot invite role with higher permissions"

**Cause:** Attempting to invite a role with permissions higher than your own.

**Solution:**
- Check your role permissions
- Check target role permissions
- Use `GET /user-role?invitable_only=true` to see valid roles

### Issue: "Cannot grant access to portfolios you don't have access to"

**Cause:** Attempting to assign portfolio_ids you don't have access to.

**Solution:**
- Check your UserAccessedProperty records
- Only assign portfolios/properties you have access to
- Leave portfolio_ids/property_ids empty if role has ALL access

### Issue: "External users cannot invite internal users"

**Cause:** External user attempting to invite internal role.

**Solution:**
- External users can only invite external roles
- Check `is_external` flag on target role

### Issue: "Insufficient permissions to invite users"

**Cause:** User lacks CREATE permission on User module.

**Solution:**
- User must have `user_permission.permission_level` of 'update' or 'all'
- Users with 'view' permission cannot invite others

---

## 📚 Additional Resources

- [Role Invitation Hierarchy](ROLE_INVITATION_HIERARCHY.md) - Detailed hierarchy rules
- [Invitation Validation Examples](INVITATION_VALIDATION_EXAMPLES.md) - Validation scenarios
- [API Documentation](http://localhost:3000/api/docs) - Interactive Swagger docs

---

## ✅ Success Criteria

A complete test pass should verify:

1. ✅ All 14 users can login with common password
2. ✅ Each user sees appropriate roles based on hierarchy
3. ✅ Users can only invite roles they have permission for
4. ✅ External users cannot invite internal users
5. ✅ Partial access constraints are enforced
6. ✅ Permission level hierarchy is respected
7. ✅ Access level hierarchy is respected
8. ✅ Appropriate error messages for invalid attempts

---

**Last Updated:** 2025-01-18
