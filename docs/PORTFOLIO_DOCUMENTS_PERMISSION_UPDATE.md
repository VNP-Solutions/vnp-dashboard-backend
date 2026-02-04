# Portfolio Documents Permission Update

## Overview

Updated the portfolio documents (contract URLs) access permissions to allow users with appropriate portfolio permissions to view documents while maintaining strict upload controls.

## Changes Made

### Previous Permissions

- **View Documents**: Only Super Admin
- **Upload Documents**: Only Super Admin
- **Update Documents**: Only Super Admin
- **Delete Documents**: Only Super Admin

### Updated Permissions

- **View Documents**:
  - Super Admin (unchanged)
  - Users with portfolio `permission_level` = `update` or `all` AND `access_level` = `partial` or `all` (NEW)
- **Upload Documents**: Only Super Admin (unchanged)
- **Update Documents**: Only Super Admin (unchanged)
- **Delete Documents**: Only Super Admin (unchanged)

## Technical Implementation

### Files Modified

1. **src/modules/contract-url/contract-url.service.ts**
   - Added `canViewContractUrls()` private method to check viewing permissions
   - Updated `findAll()` to use the new permission check
   - Updated `findAllForExport()` to use the new permission check
   - Updated `findOne()` to use the new permission check
   - Updated `findByPortfolio()` to use the new permission check
   - Imported `AccessLevel` and `PermissionLevel` enums

2. **src/modules/contract-url/contract-url.controller.ts**
   - Updated API documentation to reflect the new permission requirements
   - Updated error response descriptions for all GET endpoints

### Permission Logic

The new `canViewContractUrls()` method checks:

```typescript
private canViewContractUrls(user: IUserWithPermissions): boolean {
  // Super admin can always view
  if (isUserSuperAdmin(user)) {
    return true
  }

  const portfolioPermission = user.role.portfolio_permission

  if (!portfolioPermission) {
    return false
  }

  // Check permission level: must be 'update' or 'all'
  const hasUpdatePermission =
    portfolioPermission.permission_level === PermissionLevel.update ||
    portfolioPermission.permission_level === PermissionLevel.all

  // Check access level: must be 'partial' or 'all'
  const hasPartialAccess =
    portfolioPermission.access_level === AccessLevel.partial ||
    portfolioPermission.access_level === AccessLevel.all

  return hasUpdatePermission && hasPartialAccess
}
```

### Affected Endpoints

All GET endpoints for contract URLs now allow access to users meeting the new criteria:

- `GET /contract-url` - Get all contract URLs with pagination
- `GET /contract-url/export/all` - Export all contract URLs
- `GET /contract-url/portfolio/:portfolioId` - Get contract URLs for a specific portfolio
- `GET /contract-url/:id` - Get a specific contract URL

### User Type Considerations

The new permissions work for **both internal and external users** as long as they have:

- Portfolio permission level: `update` or `all`
- Portfolio access level: `partial` or `all`

The user's internal/external status (`is_external` field on UserRole) does **not** affect document viewing permissions.

## Testing Recommendations

1. **Super Admin**: Should still have full access to view and upload documents
2. **User with portfolio `update` + `partial`**: Should be able to view documents but not upload/update/delete
3. **User with portfolio `view` permission**: Should NOT be able to view documents
4. **User with portfolio `update` + `none` access**: Should NOT be able to view documents
5. **User without portfolio permission**: Should NOT be able to view documents

## API Documentation

Updated error messages in Swagger documentation to:

- `403 Forbidden - Only Super Admin or users with portfolio update permission and partial access can view contracts`

This provides clear guidance to API consumers about the permission requirements.

## Related Files

- Permission interface: `src/common/interfaces/permission.interface.ts`
- Permission utility: `src/common/utils/permission.util.ts`
- Permission service: `src/common/services/permission.service.ts`

## Notes

- Upload, update, and delete operations remain restricted to Super Admin only
- Users can only view documents for portfolios they have access to (respects resource-level permissions)
- The change maintains backward compatibility - Super Admin permissions remain unchanged
