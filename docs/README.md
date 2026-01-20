# VNP Dashboard Backend - Documentation

This folder contains comprehensive documentation for the VNP Dashboard Backend, including testing guides, role hierarchy rules, and validation examples.

## 📚 Documentation Index

### Getting Started

1. **[QUICK_TEST_REFERENCE.md](./QUICK_TEST_REFERENCE.md)** ⭐ **START HERE**
   - Quick reference for all test accounts
   - Fast test scenarios
   - Common password and credentials
   - API endpoint examples

2. **[TESTING_GUIDE.md](./TESTING_GUIDE.md)**
   - Comprehensive testing guide
   - 7 detailed test scenarios
   - Step-by-step instructions
   - Expected results and validation

### Core Concepts

3. **[ROLE_INVITATION_HIERARCHY.md](./ROLE_INVITATION_HIERARCHY.md)**
   - Complete role hierarchy rules
   - Internal vs external user restrictions
   - Permission level hierarchy
   - Access level hierarchy
   - Partial access constraints

4. **[INVITATION_VALIDATION_EXAMPLES.md](./INVITATION_VALIDATION_EXAMPLES.md)**
   - Real-world validation examples
   - Edge cases and constraints
   - Partial access resource validation
   - Error scenarios

## 🚀 Quick Start

### 1. Setup Test Data

Run the test seed script to create roles and users:

```bash
yarn seed:test
```

This creates:
- **9 User Roles** (6 internal, 3 external)
- **14 Test Users** with various permission levels
- **Partial Access** configurations for realistic testing

### 2. Common Password

All test accounts use the same password:
```
AluVaj!1*
```

### 3. Start Testing

1. Start the server: `yarn start:dev`
2. Open Swagger: `http://localhost:3000/api/docs`
3. Login with any test account
4. Follow the test scenarios in [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## 👥 Key Test Accounts

### Super Admin
- **Email:** `superadmin@vnp.com`
- **Role:** Super Admin
- **Can Invite:** Everyone (all 9 roles)
- **Purpose:** Test full system access

### Portfolio Manager
- **Email:** `pm.marriott@vnp.com`
- **Role:** Portfolio Manager
- **Can Invite:** Team Member, Viewer, External roles
- **Purpose:** Test partial access and hierarchy constraints

### External Auditor
- **Email:** `ext.auditor1@external.com`
- **Role:** External Auditor
- **Can Invite:** External Collaborator, External Viewer
- **Purpose:** Test external user restrictions

See [QUICK_TEST_REFERENCE.md](./QUICK_TEST_REFERENCE.md) for all 14 test accounts.

## 🧪 Test Scenarios

### Quick Tests

1. **Super Admin Full Access** - Invite any role
2. **Portfolio Manager Partial Access** - Only assign accessible resources
3. **External User Restrictions** - Cannot invite internal users
4. **Permission Hierarchy** - Cannot invite higher permissions
5. **No User Management** - Users with VIEW permission cannot invite

### Detailed Tests

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for:
- 7 comprehensive test scenarios
- Step-by-step instructions
- Expected results
- Common issues and solutions

## 📊 Role Hierarchy

### Permission Levels (What you can do)
```
all (highest)    → Create, Read, Update, Delete
update           → Create, Read, Update
view (lowest)    → Read only
```

### Access Levels (What you can see)
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

## 🔍 Key Features

### ✅ Implemented

- Role hierarchy enforcement
- Internal/External user separation
- Partial access resource constraints
- Permission level validation
- Access level validation
- User invitation restrictions

### 🎯 Testing Coverage

- Super Admin capabilities
- Portfolio Manager constraints
- External user limitations
- Permission hierarchy
- Resource-level access control
- Cross-portfolio access prevention
- Error handling and validation

## 📖 Additional Resources

### API Documentation
- Swagger UI: `http://localhost:3000/api/docs`
- Interactive API testing

### Seed Scripts
- Main seed: `yarn seed` (Portfolios, Properties, Audits)
- Test users: `yarn seed:test` (Roles, Users, Permissions)

### Code Documentation
- Main project README: [`../README.md`](../README.md)
- Architecture patterns: [`../CLAUDE.md`](../CLAUDE.md)

## 🐛 Troubleshooting

### Common Issues

**Issue:** "Cannot invite role with higher permissions"
- **Solution:** Check your role permissions vs target role permissions
- **Reference:** [ROLE_INVITATION_HIERARCHY.md](./ROLE_INVITATION_HIERARCHY.md)

**Issue:** "Cannot grant access to portfolios you don't have access to"
- **Solution:** Only assign portfolios/properties you have access to
- **Reference:** [INVITATION_VALIDATION_EXAMPLES.md](./INVITATION_VALIDATION_EXAMPLES.md)

**Issue:** "External users cannot invite internal users"
- **Solution:** External users can only invite external roles
- **Reference:** [ROLE_INVITATION_HIERARCHY.md](./ROLE_INVITATION_HIERARCHY.md)

**Issue:** "Insufficient permissions to invite users"
- **Solution:** User must have CREATE permission on User module
- **Reference:** [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## 📝 Documentation Updates

- **Created:** 2025-01-18
- **Last Updated:** 2025-01-18
- **Version:** 1.0.0

## 🤝 Contributing

When adding new features or changes:
1. Update this README with new documentation
2. Add test scenarios to TESTING_GUIDE.md
3. Update validation examples in INVITATION_VALIDATION_EXAMPLES.md
4. Document any hierarchy changes in ROLE_INVITATION_HIERARCHY.md

---

**For questions or issues, refer to the main project documentation.**
