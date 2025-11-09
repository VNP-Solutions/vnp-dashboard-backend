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
