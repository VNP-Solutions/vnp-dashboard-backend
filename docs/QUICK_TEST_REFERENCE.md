# Quick Test Reference

## 🚀 Quick Start

### 1. Run the Seed
```bash
yarn seed:test
```

### 2. Start the Server
```bash
yarn start:dev
```

### 3. Common Password
**All accounts use:** `AluVaj!1*`

---

## 👥 Quick Account Reference

### Super Admin
```
Email: superadmin@vnp.com
Password: AluVaj!1*
Role: Super Admin (Internal)
✅ Can invite: Everyone (all 9 roles)
```

### Portfolio Managers
```
Email: pm.marriott@vnp.com
Password: AluVaj!1*
Role: Portfolio Manager (Internal)
✅ Can invite: Team Member, Viewer, External roles
❌ Cannot invite: Super Admin, other Portfolio Managers

Email: pm.hilton@vnp.com
Password: AluVaj!1*
Role: Portfolio Manager (Internal)
✅ Can invite: Team Member, Viewer, External roles
```

### Property Managers
```
Email: propmanager.nyc@vnp.com
Password: AluVaj!1*
Role: Property Manager (Internal)
❌ Cannot invite: No user management permission (view only)

Email: propmanager.london@vnp.com
Password: AluVaj!1*
Role: Property Manager (Internal)
❌ Cannot invite: No user management permission
```

### Auditors
```
Email: auditor1@vnp.com
Password: AluVaj!1*
Role: Auditor (Internal)
❌ Cannot invite: No user management permission

Email: auditor2@vnp.com
Password: AluVaj!1*
Role: Auditor (Internal)
❌ Cannot invite: No user management permission
```

### Team Members
```
Email: teammember1@vnp.com
Password: AluVaj!1*
Role: Team Member (Internal)
✅ Can invite: Viewer only

Email: teammember2@vnp.com
Password: AluVaj!1*
Role: Team Member (Internal)
✅ Can invite: Viewer only
```

### Viewers
```
Email: viewer1@vnp.com
Password: AluVaj!1*
Role: Viewer (Internal)
❌ Cannot invite: No user management permission
```

### External Users
```
Email: ext.auditor1@external.com
Password: AluVaj!1*
Role: External Auditor (External)
✅ Can invite: External Collaborator, External Viewer
❌ Cannot invite: Any internal roles

Email: ext.auditor2@external.com
Password: AluVaj!1*
Role: External Auditor (External)
✅ Can invite: External Collaborator, External Viewer

Email: ext.collab1@external.com
Password: AluVaj!1*
Role: External Collaborator (External)
✅ Can invite: External Viewer only

Email: ext.viewer1@external.com
Password: AluVaj!1*
Role: External Viewer (External)
❌ Cannot invite: No user management permission
```

---

## 🧪 Quick Test Scenarios

### Test 1: Super Admin Full Access
```bash
# Login
Email: superadmin@vnp.com
Password: AluVaj!1*

# Expected:
✅ Should see all 9 roles
✅ Can invite any role (internal or external)
```

### Test 2: Portfolio Manager Partial Access
```bash
# Login
Email: pm.marriott@vnp.com
Password: AluVaj!1*

# Expected:
✅ Should see: Team Member, Viewer, External roles
❌ Should NOT see: Super Admin, Portfolio Manager, Property Manager, Auditor
✅ Can invite team members with access to Marriott portfolio only
❌ Cannot grant access to Hilton portfolio
```

### Test 3: External User Restrictions
```bash
# Login
Email: ext.auditor1@external.com
Password: AluVaj!1*

# Expected:
✅ Should see: External Collaborator, External Viewer
❌ Should NOT see: Any internal roles
✅ Can invite external users
❌ Cannot invite internal users
```

### Test 4: Permission Hierarchy
```bash
# Login
Email: teammember1@vnp.com
Password: AluVaj!1*

# Expected:
✅ Should see: Viewer only
❌ Should NOT see: Any roles with higher permissions
✅ Can invite: Viewer
❌ Cannot invite: Team Member, Auditor, etc.
```

### Test 5: No User Management Permission
```bash
# Login
Email: propmanager.nyc@vnp.com
Password: AluVaj!1*

# Try to invite a user
# Expected:
❌ Should fail: "Insufficient permissions to invite users"
✅ Can view roles (has VIEW permission on User module)
```

---

## 📊 Role Hierarchy Quick Reference

### Permission Level (What you can do)
```
all (highest)    → Create, Read, Update, Delete
update           → Create, Read, Update
view (lowest)    → Read only
```

### Access Level (What you can see)
```
all (highest)    → All resources in system
partial          → Only assigned resources
none (lowest)    → No access
```

### Internal vs External
```
Internal users → Can invite: Internal + External
External users → Can invite: External only
```

---

## 🔍 API Endpoints

### Login & Get Token
```bash
# Send OTP
POST http://localhost:3000/api/auth/send-otp
{
  "email": "superadmin@vnp.com"
}

# Verify OTP (returns JWT)
POST http://localhost:3000/api/auth/verify-otp
{
  "email": "superadmin@vnp.com",
  "otp": <OTP_FROM_EMAIL>
}
```

### Get Roles
```bash
# Get all roles
GET http://localhost:3000/api/user-role
Authorization: Bearer <JWT_TOKEN>

# Get invitable roles only
GET http://localhost:3000/api/user-role?invitable_only=true
Authorization: Bearer <JWT_TOKEN>
```

### Invite User
```bash
POST http://localhost:3000/api/auth/invite
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "email": "new.user@test.com",
  "role_id": "<ROLE_ID>",
  "first_name": "New",
  "last_name": "User",
  "language": "en",
  "portfolio_ids": ["<PORTFOLIO_ID>"],  // Optional
  "property_ids": ["<PROPERTY_ID>"]     // Optional
}
```

---

## ✅ Success Criteria

A successful test should verify:

- [ ] Super Admin can invite all 9 roles
- [ ] Portfolio Manager can only invite lower-level roles
- [ ] Portfolio Manager can only assign portfolios they have access to
- [ ] External users can only invite external users
- [ ] Users with VIEW permission cannot invite
- [ ] Users can only invite roles with equal or lower permissions
- [ ] Appropriate error messages for invalid attempts

---

## 📚 Full Documentation

See [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) for detailed test scenarios.

---

**Last Updated:** 2025-01-18
