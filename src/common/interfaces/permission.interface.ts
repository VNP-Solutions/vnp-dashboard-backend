export enum PermissionLevel {
  ALL = 'all',
  UPDATE = 'update',
  VIEW = 'view'
}

export enum AccessLevel {
  ALL = 'all',
  PARTIAL = 'partial',
  NONE = 'none'
}

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete'
}

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
  userAccessedProperties?: {
    portfolio_id: string[]
    property_id: string[]
  }
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}
