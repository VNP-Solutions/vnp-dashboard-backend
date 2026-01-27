import {
  AccessLevel,
  IPermission,
  IUserWithPermissions,
  PermissionAction,
  PermissionLevel
} from '../interfaces/permission.interface'

/**
 * Permission Utility Helper
 *
 * Permission Level (What actions can be performed):
 * - ALL: Full CRUD (Create, Read, Update, Delete)
 * - UPDATE: CRU (Create, Read, Update) - no Delete
 * - VIEW: R (Read only)
 *
 * Access Level (Which resources can be accessed):
 * - ALL: Access all resources in the system
 * - PARTIAL: Access only assigned resources (from UserAccessedProperty)
 * - NONE: No access to any resources
 */

/**
 * Check if a permission level allows a specific action
 */
export function canPerformAction(
  permissionLevel: PermissionLevel,
  action: PermissionAction
): boolean {
  const permissionMatrix: Record<
    PermissionLevel,
    Record<PermissionAction, boolean>
  > = {
    [PermissionLevel.all]: {
      [PermissionAction.CREATE]: true,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: true,
      [PermissionAction.DELETE]: true
    },
    [PermissionLevel.update]: {
      [PermissionAction.CREATE]: true,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: true,
      [PermissionAction.DELETE]: false
    },
    [PermissionLevel.view]: {
      [PermissionAction.CREATE]: false,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: false,
      [PermissionAction.DELETE]: false
    }
  }

  return permissionMatrix[permissionLevel]?.[action] ?? false
}

/**
 * Check if a permission allows any access
 */
export function hasAnyAccess(permission: IPermission | null): boolean {
  if (!permission) return false
  return permission.access_level !== AccessLevel.none
}

/**
 * Check if a permission allows full access to all resources
 */
export function hasFullAccess(permission: IPermission | null): boolean {
  if (!permission) return false
  return permission.access_level === AccessLevel.all
}

/**
 * Check if a permission requires partial access check (resource-level)
 */
export function requiresPartialCheck(permission: IPermission | null): boolean {
  if (!permission) return false
  return permission.access_level === AccessLevel.partial
}

/**
 * Get allowed actions for a permission level
 */
export function getAllowedActions(
  permissionLevel: PermissionLevel
): PermissionAction[] {
  const actions: PermissionAction[] = []

  if (canPerformAction(permissionLevel, PermissionAction.CREATE)) {
    actions.push(PermissionAction.CREATE)
  }
  if (canPerformAction(permissionLevel, PermissionAction.READ)) {
    actions.push(PermissionAction.READ)
  }
  if (canPerformAction(permissionLevel, PermissionAction.UPDATE)) {
    actions.push(PermissionAction.UPDATE)
  }
  if (canPerformAction(permissionLevel, PermissionAction.DELETE)) {
    actions.push(PermissionAction.DELETE)
  }

  return actions
}

/**
 * Check if permission allows create operations
 */
export function canCreate(permission: IPermission | null): boolean {
  if (!permission || !hasAnyAccess(permission)) return false
  return canPerformAction(permission.permission_level, PermissionAction.CREATE)
}

/**
 * Check if permission allows read operations
 */
export function canRead(permission: IPermission | null): boolean {
  if (!permission || !hasAnyAccess(permission)) return false
  return canPerformAction(permission.permission_level, PermissionAction.READ)
}

/**
 * Check if permission allows update operations
 */
export function canUpdate(permission: IPermission | null): boolean {
  if (!permission || !hasAnyAccess(permission)) return false
  return canPerformAction(permission.permission_level, PermissionAction.UPDATE)
}

/**
 * Check if permission allows delete operations
 */
export function canDelete(permission: IPermission | null): boolean {
  if (!permission || !hasAnyAccess(permission)) return false
  return canPerformAction(permission.permission_level, PermissionAction.DELETE)
}

/**
 * Get human-readable permission description
 */
export function getPermissionDescription(
  permission: IPermission | null
): string {
  if (!permission) return 'No permission'

  const level = permission.permission_level
  const access = permission.access_level

  const levelDesc = {
    [PermissionLevel.all]: 'Full CRUD',
    [PermissionLevel.update]: 'Create, Read, Update',
    [PermissionLevel.view]: 'Read only'
  }

  const accessDesc = {
    [AccessLevel.all]: 'all resources',
    [AccessLevel.partial]: 'assigned resources only',
    [AccessLevel.none]: 'no resources'
  }

  return `${levelDesc[level]} on ${accessDesc[access]}`
}

/**
 * Validate permission configuration
 */
export function isValidPermission(permission: IPermission | null): boolean {
  if (!permission) return false

  const validLevels = Object.values(PermissionLevel)
  const validAccess = Object.values(AccessLevel)

  return (
    validLevels.includes(permission.permission_level) &&
    validAccess.includes(permission.access_level)
  )
}

/**
 * Check if a user is a super admin
 * Super admin has all permission levels set to 'all' and access level set to 'all' for all modules
 */
export function isSuperAdmin(permission: IPermission | null): boolean {
  if (!permission) return false

  return (
    permission.permission_level === PermissionLevel.all &&
    permission.access_level === AccessLevel.all
  )
}

/**
 * Check if a user has super admin privileges across all modules
 * Super admin must have permission_level 'all' and access_level 'all' for every module
 */
export function isUserSuperAdmin(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false

  const { role } = user

  // Check all module permissions
  const allPermissions = [
    role.portfolio_permission,
    role.property_permission,
    role.audit_permission,
    role.user_permission,
    role.system_settings_permission
  ]

  // User must have all permissions set with 'all' level and 'all' access
  return allPermissions.every(permission => isSuperAdmin(permission))
}

/**
 * Check if a user is a portfolio manager
 * Portfolio manager has 'all' permission level for portfolio permission
 * Can have either 'all' or 'partial' access level
 */
export function isPortfolioManager(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false

  const portfolioPermission = user.role.portfolio_permission
  if (!portfolioPermission) return false

  // Must have 'all' permission level
  return (
    portfolioPermission.permission_level === PermissionLevel.all &&
    (portfolioPermission.access_level === AccessLevel.all ||
      portfolioPermission.access_level === AccessLevel.partial)
  )
}

/**
 * Check if a user is a portfolio manager for a specific portfolio
 * Checks if user has 'all' permission level and either:
 * - Has 'all' access level (can access all portfolios), OR
 * - Has 'partial' access level AND the portfolio ID is in their accessible list
 */
export function isPortfolioManagerFor(
  user: IUserWithPermissions,
  portfolioId: string,
  accessiblePortfolioIds: string[] | 'all'
): boolean {
  if (!user || !user.role) return false

  const portfolioPermission = user.role.portfolio_permission
  if (!portfolioPermission) return false

  // Must have 'all' permission level
  if (portfolioPermission.permission_level !== PermissionLevel.all) {
    return false
  }

  // Check access level
  if (portfolioPermission.access_level === AccessLevel.all) {
    return true
  }

  if (portfolioPermission.access_level === AccessLevel.partial) {
    // For partial access, check if portfolio ID is in accessible list
    if (accessiblePortfolioIds === 'all') {
      return true
    }
    return (
      Array.isArray(accessiblePortfolioIds) &&
      accessiblePortfolioIds.includes(portfolioId)
    )
  }

  return false
}

/**
 * Check if a user is a property manager
 * Property manager has 'all' permission level for property permission
 * Can have either 'all' or 'partial' access level
 */
export function isPropertyManager(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false

  const propertyPermission = user.role.property_permission
  if (!propertyPermission) return false

  // Must have 'all' permission level
  return (
    propertyPermission.permission_level === PermissionLevel.all &&
    (propertyPermission.access_level === AccessLevel.all ||
      propertyPermission.access_level === AccessLevel.partial)
  )
}

/**
 * Check if a user is a property manager for a specific property
 * Checks if user has 'all' permission level and either:
 * - Has 'all' access level (can access all properties), OR
 * - Has 'partial' access level AND the property ID is in their accessible list
 */
export function isPropertyManagerFor(
  user: IUserWithPermissions,
  propertyId: string,
  accessiblePropertyIds: string[] | 'all'
): boolean {
  if (!user || !user.role) return false

  const propertyPermission = user.role.property_permission
  if (!propertyPermission) return false

  // Must have 'all' permission level
  if (propertyPermission.permission_level !== PermissionLevel.all) {
    return false
  }

  // Check access level
  if (propertyPermission.access_level === AccessLevel.all) {
    return true
  }

  if (propertyPermission.access_level === AccessLevel.partial) {
    // For partial access, check if property ID is in accessible list
    if (accessiblePropertyIds === 'all') {
      return true
    }
    return (
      Array.isArray(accessiblePropertyIds) &&
      accessiblePropertyIds.includes(propertyId)
    )
  }

  return false
}

/**
 * Check if a user has an external role
 * External users typically have limited access and represent clients or external stakeholders
 */
export function isExternalUser(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false
  return user.role.is_external === true
}

/**
 * Check if a user has an internal role
 * Internal users are typically staff members with broader system access
 */
export function isInternalUser(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false
  return user.role.is_external === false
}

/**
 * Check if a user can access global report
 * Super admins and users with can_access_mis=true can access
 */
export function canAccessGlobalReport(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false
  return isUserSuperAdmin(user) || user.role.can_access_mis === true
}

/**
 * Check if a user can perform bulk transfer operations
 * Bulk transfer is allowed for:
 * - Super admins (regardless of internal/external status)
 * - Internal users with property permission 'all' and access 'partial' or 'all'
 * - Internal users with portfolio permission 'all' and access 'partial' or 'all'
 */
export function canPerformBulkTransfer(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false

  // Super admin can always perform bulk transfer
  if (isUserSuperAdmin(user)) return true

  // Must be internal user
  if (!isInternalUser(user)) return false

  // Check if user is a property manager or portfolio manager
  return isPropertyManager(user) || isPortfolioManager(user)
}

/**
 * Check if a user can request a single property transfer
 * Requirements:
 * - Must be internal user
 * - Property permission level must be 'update' or 'all'
 * - Property access level must be 'partial' or 'all'
 * - Super admins bypass these checks
 */
export function canRequestPropertyTransfer(
  user: IUserWithPermissions
): boolean {
  if (!user || !user.role) return false

  // Super admin can always request transfer
  if (isUserSuperAdmin(user)) return true

  // Must be internal user
  if (!isInternalUser(user)) return false

  const propertyPermission = user.role.property_permission
  if (!propertyPermission) return false

  // Check permission level: must be 'update' or 'all'
  const hasRequiredPermissionLevel =
    propertyPermission.permission_level === PermissionLevel.all ||
    propertyPermission.permission_level === PermissionLevel.update

  if (!hasRequiredPermissionLevel) return false

  // Check access level: must be 'partial' or 'all'
  const hasRequiredAccessLevel =
    propertyPermission.access_level === AccessLevel.all ||
    propertyPermission.access_level === AccessLevel.partial

  return hasRequiredAccessLevel
}

/**
 * Check if a user can request bulk property transfer
 * Requirements:
 * - Must be internal user
 * - Property permission level must be 'all'
 * - Property access level must be 'partial' or 'all'
 * - Super admins bypass these checks
 */
export function canRequestBulkPropertyTransfer(
  user: IUserWithPermissions
): boolean {
  if (!user || !user.role) return false

  // Super admin can always request bulk transfer
  if (isUserSuperAdmin(user)) return true

  // Must be internal user
  if (!isInternalUser(user)) return false

  const propertyPermission = user.role.property_permission
  if (!propertyPermission) return false

  // Check permission level: must be 'all'
  if (propertyPermission.permission_level !== PermissionLevel.all) {
    return false
  }

  // Check access level: must be 'partial' or 'all'
  const hasRequiredAccessLevel =
    propertyPermission.access_level === AccessLevel.all ||
    propertyPermission.access_level === AccessLevel.partial

  return hasRequiredAccessLevel
}

/**
 * Check if a user can request property deletion
 * Requirements:
 * - Property permission level must be 'update' or 'all'
 * - Property access level must be 'partial' or 'all'
 * - Both internal and external users can request (no user type restriction)
 * - Super admins bypass these checks
 */
export function canRequestPropertyDelete(user: IUserWithPermissions): boolean {
  if (!user || !user.role) return false

  // Super admin can always request deletion
  if (isUserSuperAdmin(user)) return true

  const propertyPermission = user.role.property_permission
  if (!propertyPermission) return false

  // Check permission level: must be 'update' or 'all'
  const hasRequiredPermissionLevel =
    propertyPermission.permission_level === PermissionLevel.all ||
    propertyPermission.permission_level === PermissionLevel.update

  if (!hasRequiredPermissionLevel) return false

  // Check access level: must be 'partial' or 'all'
  const hasRequiredAccessLevel =
    propertyPermission.access_level === AccessLevel.all ||
    propertyPermission.access_level === AccessLevel.partial

  return hasRequiredAccessLevel
}

/**
 * Get the bank details permission for a user
 */
export function getBankDetailsPermission(
  user: IUserWithPermissions
): IPermission | null {
  if (!user || !user.role) return null
  return user.role.bank_details_permission
}

/**
 * Check if a user can read bank details
 * User must have bank_details_permission with READ capability and access_level != none
 */
export function canReadBankDetails(user: IUserWithPermissions): boolean {
  const permission = getBankDetailsPermission(user)
  return canRead(permission)
}

/**
 * Check if a user can create bank details
 * User must have bank_details_permission with CREATE capability and access_level != none
 */
export function canCreateBankDetails(user: IUserWithPermissions): boolean {
  const permission = getBankDetailsPermission(user)
  return canCreate(permission)
}

/**
 * Check if a user can update bank details
 * User must have bank_details_permission with UPDATE capability and access_level != none
 */
export function canUpdateBankDetails(user: IUserWithPermissions): boolean {
  const permission = getBankDetailsPermission(user)
  return canUpdate(permission)
}

/**
 * Check if a user can delete bank details
 * User must have bank_details_permission with DELETE capability and access_level != none
 */
export function canDeleteBankDetails(user: IUserWithPermissions): boolean {
  const permission = getBankDetailsPermission(user)
  return canDelete(permission)
}

/**
 * Check if a user has any bank details permission (access_level != none)
 */
export function hasAnyBankDetailsAccess(user: IUserWithPermissions): boolean {
  const permission = getBankDetailsPermission(user)
  return hasAnyAccess(permission)
}

/**
 * Check if a user has full access to all bank details (access_level == all)
 */
export function hasFullBankDetailsAccess(user: IUserWithPermissions): boolean {
  const permission = getBankDetailsPermission(user)
  return hasFullAccess(permission)
}

/**
 * Check if a user has partial access to bank details (access_level == partial)
 * Partial access means user can only access bank details for properties they have access to
 */
export function hasPartialBankDetailsAccess(
  user: IUserWithPermissions
): boolean {
  const permission = getBankDetailsPermission(user)
  return requiresPartialCheck(permission)
}

/**
 * Get permission level hierarchy value (higher = more permissions)
 * all (3) > update (2) > view (1)
 */
export function getPermissionLevelHierarchyValue(
  level: PermissionLevel | undefined | null
): number {
  if (!level) return 0

  const hierarchy: Record<PermissionLevel, number> = {
    [PermissionLevel.all]: 3,
    [PermissionLevel.update]: 2,
    [PermissionLevel.view]: 1
  }

  return hierarchy[level] ?? 0
}

/**
 * Get access level hierarchy value (higher = more access)
 * all (3) > partial (2) > none (1)
 */
export function getAccessLevelHierarchyValue(
  level: AccessLevel | undefined | null
): number {
  if (!level) return 0

  const hierarchy: Record<AccessLevel, number> = {
    [AccessLevel.all]: 3,
    [AccessLevel.partial]: 2,
    [AccessLevel.none]: 1
  }

  return hierarchy[level] ?? 0
}

/**
 * Compare two permissions and check if permission1 is >= permission2 in hierarchy
 * Returns true if permission1 has equal or higher privileges than permission2
 */
export function isPermissionEqualOrHigher(
  permission1: IPermission | null | undefined,
  permission2: IPermission | null | undefined
): boolean {
  // If permission2 is null, always return true (no permission to beat)
  if (!permission2) return true

  // If permission1 is null but permission2 exists, return false
  if (!permission1) return false

  const level1 = getPermissionLevelHierarchyValue(permission1.permission_level)
  const level2 = getPermissionLevelHierarchyValue(permission2.permission_level)

  const access1 = getAccessLevelHierarchyValue(permission1.access_level)
  const access2 = getAccessLevelHierarchyValue(permission2.access_level)

  // Both permission level AND access level must be equal or higher
  return level1 >= level2 && access1 >= access2
}

/**
 * Check if a user can invite another user with a specific role
 *
 * Rules:
 * 1. Internal users can invite both internal and external users
 * 2. External users can only invite external users
 * 3. For each module permission, inviter's permission must be >= target role's permission
 */
export function canInviteRole(
  inviterUser: IUserWithPermissions,
  targetRole: {
    is_external: boolean
    portfolio_permission: IPermission | null
    property_permission: IPermission | null
    audit_permission: IPermission | null
    user_permission: IPermission | null
    system_settings_permission: IPermission | null
    bank_details_permission: IPermission | null
  }
): boolean {
  if (!inviterUser || !inviterUser.role || !targetRole) return false

  const inviterRole = inviterUser.role

  // Rule 1 & 2: Check internal/external restriction
  if (inviterRole.is_external && !targetRole.is_external) {
    // External users cannot invite internal users
    return false
  }

  // Rule 3: Check permission hierarchy for all modules
  const permissionChecks = [
    {
      name: 'portfolio',
      inviter: inviterRole.portfolio_permission,
      target: targetRole.portfolio_permission
    },
    {
      name: 'property',
      inviter: inviterRole.property_permission,
      target: targetRole.property_permission
    },
    {
      name: 'audit',
      inviter: inviterRole.audit_permission,
      target: targetRole.audit_permission
    },
    {
      name: 'user',
      inviter: inviterRole.user_permission,
      target: targetRole.user_permission
    },
    {
      name: 'system_settings',
      inviter: inviterRole.system_settings_permission,
      target: targetRole.system_settings_permission
    },
    {
      name: 'bank_details',
      inviter: inviterRole.bank_details_permission,
      target: targetRole.bank_details_permission
    }
  ]

  // For each module, inviter's permission must be >= target's permission
  for (const check of permissionChecks) {
    if (!isPermissionEqualOrHigher(check.inviter, check.target)) {
      return false
    }
  }

  return true
}
