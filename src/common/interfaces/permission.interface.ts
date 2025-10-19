import { AccessLevel, PermissionLevel } from '@prisma/client'

// Re-export Prisma enums for convenience
export { AccessLevel, PermissionLevel }

/**
 * Permission Level defines what CRUD operations a user can perform:
 * - all: Full CRUD (Create, Read, Update, Delete) ✓✓✓✓
 * - update: CRU (Create, Read, Update) - no Delete ✓✓✓✗
 * - view: R (Read only) ✗✓✗✗
 */

/**
 * Access Level defines which resources a user can access:
 * - all: Access all resources in the system
 * - partial: Access only assigned resources (see UserAccessedProperty)
 * - none: No access to any resources
 */

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete'
}

/**
 * Module Type represents different system modules.
 * Each module can have its own permission configuration.
 * Note: Both 'user' and 'user_role' modules are controlled by USER permission
 */
export enum ModuleType {
  PORTFOLIO = 'portfolio',
  PROPERTY = 'property',
  AUDIT = 'audit',
  USER = 'user',
  SYSTEM_SETTINGS = 'system_settings'
}

export interface IPermission {
  permission_level: PermissionLevel
  access_level: AccessLevel
}

export interface IUserWithPermissions {
  id: string
  email: string
  user_role_id: string
  role: {
    id: string
    name: string
    portfolio_permission: IPermission | null
    property_permission: IPermission | null
    audit_permission: IPermission | null
    user_permission: IPermission | null
    system_settings_permission: IPermission | null
  }
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}
