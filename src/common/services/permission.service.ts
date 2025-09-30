import { ForbiddenException, Injectable } from '@nestjs/common'
import {
  AccessLevel,
  IPermission,
  IUserWithPermissions,
  ModuleType,
  PermissionAction,
  PermissionCheckResult,
  PermissionLevel
} from '../interfaces/permission.interface'

@Injectable()
export class PermissionService {
  private readonly permissionMatrix: Record<
    PermissionLevel,
    Record<PermissionAction, boolean>
  > = {
    [PermissionLevel.ALL]: {
      [PermissionAction.CREATE]: true,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: true,
      [PermissionAction.DELETE]: true
    },
    [PermissionLevel.UPDATE]: {
      [PermissionAction.CREATE]: false,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: true,
      [PermissionAction.DELETE]: false
    },
    [PermissionLevel.VIEW]: {
      [PermissionAction.CREATE]: false,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: false,
      [PermissionAction.DELETE]: false
    }
  }

  checkPermission(
    user: IUserWithPermissions,
    module: ModuleType,
    action: PermissionAction,
    resourceId?: string
  ): PermissionCheckResult {
    const permission = this.getModulePermission(user, module)

    if (!permission) {
      return {
        allowed: false,
        reason: `No permission found for module: ${module}`
      }
    }

    if (permission.access_level === AccessLevel.NONE) {
      return {
        allowed: false,
        reason: `Access denied: No access to ${module} module`
      }
    }

    const hasActionPermission =
      this.permissionMatrix[permission.permission_level][action]

    if (!hasActionPermission) {
      return {
        allowed: false,
        reason: `Action '${action}' not allowed with permission level '${permission.permission_level}'`
      }
    }

    if (permission.access_level === AccessLevel.ALL) {
      return { allowed: true }
    }

    if (permission.access_level === AccessLevel.PARTIAL) {
      if (!resourceId) {
        return { allowed: true }
      }

      const hasAccess = this.checkPartialAccess(user, module, resourceId)
      if (!hasAccess) {
        return {
          allowed: false,
          reason: `Access denied: Resource not in user's accessible ${module}s`
        }
      }

      return { allowed: true }
    }

    return { allowed: false, reason: 'Unknown permission configuration' }
  }

  requirePermission(
    user: IUserWithPermissions,
    module: ModuleType,
    action: PermissionAction,
    resourceId?: string
  ): void {
    const result = this.checkPermission(user, module, action, resourceId)

    if (!result.allowed) {
      throw new ForbiddenException(
        result.reason || 'You do not have permission to perform this action'
      )
    }
  }

  canAccessResource(
    user: IUserWithPermissions,
    module: ModuleType,
    resourceId: string
  ): boolean {
    const permission = this.getModulePermission(user, module)

    if (!permission || permission.access_level === AccessLevel.NONE) {
      return false
    }

    if (permission.access_level === AccessLevel.ALL) {
      return true
    }

    return this.checkPartialAccess(user, module, resourceId)
  }

  getAccessibleResourceIds(
    user: IUserWithPermissions,
    module: ModuleType
  ): string[] | 'all' {
    const permission = this.getModulePermission(user, module)

    if (!permission || permission.access_level === AccessLevel.NONE) {
      return []
    }

    if (permission.access_level === AccessLevel.ALL) {
      return 'all'
    }

    if (module === ModuleType.PORTFOLIO) {
      return user.userAccessedProperties?.portfolio_id || []
    }

    if (module === ModuleType.PROPERTY) {
      return user.userAccessedProperties?.property_id || []
    }

    return []
  }

  private getModulePermission(
    user: IUserWithPermissions,
    module: ModuleType
  ): IPermission | null {
    switch (module) {
      case ModuleType.PORTFOLIO:
        return user.role.portfolioPermission
      case ModuleType.PROPERTY:
        return user.role.propertyPermission
      case ModuleType.AUDIT:
        return user.role.auditPermission
      case ModuleType.USER:
        return user.role.userPermission
      case ModuleType.SYSTEM_SETTINGS:
        return user.role.systemSettingsPermission
      default:
        return null
    }
  }

  private checkPartialAccess(
    user: IUserWithPermissions,
    module: ModuleType,
    resourceId: string
  ): boolean {
    if (!user.userAccessedProperties) {
      return false
    }

    if (module === ModuleType.PORTFOLIO) {
      return user.userAccessedProperties.portfolio_id.includes(resourceId)
    }

    if (module === ModuleType.PROPERTY) {
      return user.userAccessedProperties.property_id.includes(resourceId)
    }

    return false
  }
}
