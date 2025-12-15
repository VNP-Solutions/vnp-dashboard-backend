Summary of Changes

1. Prisma Schema (prisma/schema.prisma)
   Added bank_details_permission field to UserRole model
   Added BankDetailsPermission type definition
2. Permission Interface (src/common/interfaces/permission.interface.ts)
   Added BANK_DETAILS = 'bank_details' to ModuleType enum
   Added bank_details_permission: IPermission | null to IUserWithPermissions.role
3. User Role DTO (src/modules/user-role/user-role.dto.ts)
   Added bank_details_permission field to CreateUserRoleDto
4. Permission Service (src/common/services/permission.service.ts)
   Added BANK_DETAILS case to getModulePermission()
   Updated moduleSupportsPartialAccess() to include BANK_DETAILS
   Updated getAccessibleResourceIds() to handle BANK_DETAILS (maps to property IDs)
   Updated checkPartialAccess() to handle BANK_DETAILS
   Updated validateRoleConfiguration() to include bank_details_permission
5. Permission Utility (src/common/utils/permission.util.ts)
   Added helper functions: getBankDetailsPermission, canReadBankDetails, canCreateBankDetails, canUpdateBankDetails, canDeleteBankDetails, hasAnyBankDetailsAccess, hasFullBankDetailsAccess, hasPartialBankDetailsAccess
6. User Role Service (src/modules/user-role/user-role.service.ts)
   Updated create() and update() methods to include bank_details_permission in validation
7. Property Bank Details Controller (src/modules/property-bank-details/property-bank-details.controller.ts)
   Changed all @RequirePermission decorators from ModuleType.PROPERTY to ModuleType.BANK_DETAILS
8. Property Bank Details Service (src/modules/property-bank-details/property-bank-details.service.ts)
   Replaced old checkEditPermission with new checkBankDetailsPermission that uses PermissionService
   Updated create(), update(), and bulkUpdate() to use the new permission system
9. Property Service (src/modules/property/property.service.ts)
   Updated imports to include canCreateBankDetails, canReadBankDetails, canUpdateBankDetails
   completeCreate: Skips bank_details if user lacks CREATE permission (silently)
   completeUpdate: Skips bank_details if user lacks UPDATE permission (silently)
   findAll, findAllForExport, getPropertiesByPortfolios, findOne: Sets bankDetails: null if user lacks READ permission
   bulkImport: Skips bank details creation if user lacks CREATE permission (silently)
10. Update bulk update property api and so the template will be updated also
