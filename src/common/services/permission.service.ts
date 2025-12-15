import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../modules/prisma/prisma.service'
import {
  AccessLevel,
  IPermission,
  IUserWithPermissions,
  ModuleType,
  PermissionAction,
  PermissionCheckResult,
  PermissionLevel
} from '../interfaces/permission.interface'

/**
 * Permission Service
 *
 * Handles all permission checks for the application.
 *
 * Permission System:
 * - Permission Level: Defines CRUD operations (ALL, UPDATE, VIEW)
 * - Access Level: Defines resource scope (ALL, PARTIAL, NONE)
 *
 * Permission Level Mapping:
 * - ALL: Create ✓ | Read ✓ | Update ✓ | Delete ✓
 * - UPDATE: Create ✓ | Read ✓ | Update ✓ | Delete ✗
 * - VIEW: Create ✗ | Read ✓ | Update ✗ | Delete ✗
 *
 * Access Level Mapping:
 * - ALL: Access all resources in the system
 * - PARTIAL: Access only assigned resources (UserAccessedProperty)
 * - NONE: No access to any resources
 */
@Injectable()
export class PermissionService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  private readonly permissionMatrix: Record<
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

    if (permission.access_level === AccessLevel.none) {
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

    if (permission.access_level === AccessLevel.all) {
      return { allowed: true }
    }

    if (permission.access_level === AccessLevel.partial) {
      // If no resourceId provided, this is likely a CREATE or LIST operation
      if (!resourceId) {
        // CREATE operations: Allowed, and created resource will be auto-assigned to user
        // LIST operations: Allowed, but service layer must filter results
        return { allowed: true }
      }

      // For specific resource operations (READ/:id, UPDATE/:id, DELETE/:id)
      // Check if user has access to this specific resource
      // Note: This is synchronous, but calls async method - consider making this async
      return { allowed: true } // Will be checked in async requirePermission
    }

    return { allowed: false, reason: 'Unknown permission configuration' }
  }

  async requirePermission(
    user: IUserWithPermissions,
    module: ModuleType,
    action: PermissionAction,
    resourceId?: string
  ): Promise<void> {
    const result = this.checkPermission(user, module, action, resourceId)

    if (!result.allowed) {
      throw new ForbiddenException(
        result.reason || 'You do not have permission to perform this action'
      )
    }

    // Additional check for partial access with resourceId
    const permission = this.getModulePermission(user, module)
    if (
      permission &&
      permission.access_level === AccessLevel.partial &&
      resourceId
    ) {
      const hasAccess = await this.checkPartialAccess(user, module, resourceId)
      if (!hasAccess) {
        throw new ForbiddenException(
          `Access denied: Resource not in user's accessible ${module}s`
        )
      }
    }
  }

  async canAccessResource(
    user: IUserWithPermissions,
    module: ModuleType,
    resourceId: string
  ): Promise<boolean> {
    const permission = this.getModulePermission(user, module)

    if (!permission || permission.access_level === AccessLevel.none) {
      return false
    }

    if (permission.access_level === AccessLevel.all) {
      return true
    }

    return this.checkPartialAccess(user, module, resourceId)
  }

  async getAccessibleResourceIds(
    user: IUserWithPermissions,
    module: ModuleType
  ): Promise<string[] | 'all'> {
    const permission = this.getModulePermission(user, module)

    if (!permission || permission.access_level === AccessLevel.none) {
      return []
    }

    if (permission.access_level === AccessLevel.all) {
      return 'all'
    }

    // For PARTIAL access, check UserAccessedProperty from DB
    if (permission.access_level === AccessLevel.partial) {
      const userAccessedProperties =
        await this.prisma.userAccessedProperty.findFirst({
          where: { user_id: user.id },
          select: {
            portfolio_id: true,
            property_id: true
          }
        })

      if (!userAccessedProperties) {
        return []
      }

      // PORTFOLIO, PROPERTY, and BANK_DETAILS support partial access via UserAccessedProperty
      if (module === ModuleType.PORTFOLIO) {
        return userAccessedProperties.portfolio_id || []
      }

      if (module === ModuleType.PROPERTY) {
        return userAccessedProperties.property_id || []
      }

      // BANK_DETAILS partial access maps to PROPERTY access
      // User can only access bank details for properties they have access to
      if (module === ModuleType.BANK_DETAILS) {
        return userAccessedProperties.property_id || []
      }

      // Other modules (AUDIT, USER, SYSTEM_SETTINGS) don't support partial access
      // If a user has PARTIAL access to these modules, treat as no access
      return []
    }

    return []
  }

  private getModulePermission(
    user: IUserWithPermissions,
    module: ModuleType
  ): IPermission | null {
    switch (module) {
      case ModuleType.PORTFOLIO:
        return user.role.portfolio_permission
      case ModuleType.PROPERTY:
        return user.role.property_permission
      case ModuleType.AUDIT:
        return user.role.audit_permission
      case ModuleType.USER:
        return user.role.user_permission
      case ModuleType.SYSTEM_SETTINGS:
        return user.role.system_settings_permission
      case ModuleType.BANK_DETAILS:
        return user.role.bank_details_permission
      default:
        return null
    }
  }

  /**
   * Validate if a module supports partial access
   * PORTFOLIO, PROPERTY, and BANK_DETAILS have resource-level access control via UserAccessedProperty
   * Note: BANK_DETAILS partial access maps to PROPERTY access (user can only access bank details for properties they have access to)
   */
  moduleSupportsPartialAccess(module: ModuleType): boolean {
    return (
      module === ModuleType.PORTFOLIO ||
      module === ModuleType.PROPERTY ||
      module === ModuleType.BANK_DETAILS
    )
  }

  /**
   * Validate role configuration and return warnings
   * Helps identify potentially problematic permission setups
   */
  validateRoleConfiguration(role: {
    portfolio_permission: IPermission | null
    property_permission: IPermission | null
    audit_permission: IPermission | null
    user_permission: IPermission | null
    system_settings_permission: IPermission | null
    bank_details_permission: IPermission | null
  }): string[] {
    const warnings: string[] = []

    const checkPermission = (
      permission: IPermission | null,
      moduleName: string,
      module: ModuleType
    ) => {
      if (!permission) return

      // Warn about PARTIAL access on modules that don't support it
      if (
        permission.access_level === AccessLevel.partial &&
        !this.moduleSupportsPartialAccess(module)
      ) {
        warnings.push(
          `${moduleName}: PARTIAL access_level is not supported. Only PORTFOLIO, PROPERTY, and BANK_DETAILS support partial access. This will behave as NO ACCESS.`
        )
      }

      // Warn about potential CREATE issues with PARTIAL access
      if (
        permission.access_level === AccessLevel.partial &&
        (permission.permission_level === PermissionLevel.all ||
          permission.permission_level === PermissionLevel.update)
      ) {
        warnings.push(
          `${moduleName}: Users can CREATE resources and will automatically gain access to them through UserAccessedProperty.`
        )
      }
    }

    checkPermission(
      role.portfolio_permission,
      'Portfolio',
      ModuleType.PORTFOLIO
    )
    checkPermission(role.property_permission, 'Property', ModuleType.PROPERTY)
    checkPermission(role.audit_permission, 'Audit', ModuleType.AUDIT)
    checkPermission(role.user_permission, 'User', ModuleType.USER)
    checkPermission(
      role.system_settings_permission,
      'System Settings',
      ModuleType.SYSTEM_SETTINGS
    )
    checkPermission(
      role.bank_details_permission,
      'Bank Details',
      ModuleType.BANK_DETAILS
    )

    return warnings
  }

  /**
   * Grant resource access to a user with partial access level
   * Automatically adds the resource to the user's UserAccessedProperty record
   */
  async grantResourceAccess(
    userId: string,
    module: ModuleType,
    resourceId: string
  ): Promise<void> {
    // Only PORTFOLIO and PROPERTY support partial access
    if (!this.moduleSupportsPartialAccess(module)) {
      return
    }

    // Check if user access record exists
    const existingAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId }
    })

    if (existingAccess) {
      // Update existing record
      if (module === ModuleType.PORTFOLIO) {
        const portfolioIds = existingAccess.portfolio_id || []
        if (!portfolioIds.includes(resourceId)) {
          await this.prisma.userAccessedProperty.update({
            where: { id: existingAccess.id },
            data: {
              portfolio_id: [...portfolioIds, resourceId]
            }
          })
        }
      } else if (module === ModuleType.PROPERTY) {
        const propertyIds = existingAccess.property_id || []
        if (!propertyIds.includes(resourceId)) {
          await this.prisma.userAccessedProperty.update({
            where: { id: existingAccess.id },
            data: {
              property_id: [...propertyIds, resourceId]
            }
          })
        }
      }
    } else {
      // Create new record
      const data: any = {
        user_id: userId,
        portfolio_id: module === ModuleType.PORTFOLIO ? [resourceId] : [],
        property_id: module === ModuleType.PROPERTY ? [resourceId] : []
      }
      await this.prisma.userAccessedProperty.create({ data })
    }
  }

  private async checkPartialAccess(
    user: IUserWithPermissions,
    module: ModuleType,
    resourceId: string
  ): Promise<boolean> {
    const userAccessedProperties =
      await this.prisma.userAccessedProperty.findFirst({
        where: { user_id: user.id },
        select: {
          portfolio_id: true,
          property_id: true
        }
      })

    if (!userAccessedProperties) {
      return false
    }

    // PORTFOLIO, PROPERTY, and BANK_DETAILS support resource-level access control
    if (module === ModuleType.PORTFOLIO) {
      const portfolioIds = userAccessedProperties.portfolio_id || []
      return portfolioIds.includes(resourceId)
    }

    if (module === ModuleType.PROPERTY) {
      const propertyIds = userAccessedProperties.property_id || []
      return propertyIds.includes(resourceId)
    }

    // BANK_DETAILS partial access maps to PROPERTY access
    // resourceId here is the property_id that the bank details belong to
    if (module === ModuleType.BANK_DETAILS) {
      const propertyIds = userAccessedProperties.property_id || []
      return propertyIds.includes(resourceId)
    }

    // Other modules (AUDIT, USER, SYSTEM_SETTINGS) don't support partial access
    // For these modules, PARTIAL access_level should not be used
    // If someone tries to use PARTIAL for these modules, deny access
    return false
  }

  /**
   * Update user access after a property transfer.
   *
   * Logic:
   * 1. For users with partial portfolio + partial property access:
   *    - If the property is transferred to a portfolio the user has access to → keep property access
   *    - If the property is transferred to a portfolio the user doesn't have access to → remove property access
   *
   * 2. For users with none portfolio + partial property access:
   *    - Keep property access regardless of destination portfolio
   *
   * @param propertyId - The ID of the transferred property
   * @param newPortfolioId - The ID of the new portfolio
   */
  async updateUserAccessAfterPropertyTransfer(
    propertyId: string,
    newPortfolioId: string
  ): Promise<void> {
    // Find all users who have access to this property
    const usersWithPropertyAccess =
      await this.prisma.userAccessedProperty.findMany({
        where: {
          property_id: { has: propertyId }
        },
        include: {
          user: {
            include: {
              role: true
            }
          }
        }
      })

    for (const userAccess of usersWithPropertyAccess) {
      const user = userAccess.user
      const role = user.role

      // Get portfolio permission for this user
      const portfolioPermission = role.portfolio_permission
      const propertyPermission = role.property_permission

      // Skip if user doesn't have partial property access (shouldn't happen, but safety check)
      if (propertyPermission?.access_level !== AccessLevel.partial) {
        continue
      }

      // Case 1: User has NO portfolio access (none) + partial property access
      // Keep property access regardless of destination portfolio
      if (portfolioPermission?.access_level === AccessLevel.none) {
        // No action needed - user keeps property access
        continue
      }

      // Case 2: User has ALL portfolio access
      // Keep property access (they can access all portfolios anyway)
      if (portfolioPermission?.access_level === AccessLevel.all) {
        // No action needed - user keeps property access
        continue
      }

      // Case 3: User has PARTIAL portfolio access + partial property access
      // Check if the new portfolio is in the user's accessible portfolios
      if (portfolioPermission?.access_level === AccessLevel.partial) {
        const accessiblePortfolios = userAccess.portfolio_id || []
        const hasAccessToNewPortfolio =
          accessiblePortfolios.includes(newPortfolioId)

        if (!hasAccessToNewPortfolio) {
          // Remove property access since user doesn't have access to the new portfolio
          const updatedPropertyIds = (userAccess.property_id || []).filter(
            (id) => id !== propertyId
          )

          await this.prisma.userAccessedProperty.update({
            where: { id: userAccess.id },
            data: {
              property_id: updatedPropertyIds
            }
          })
        }
        // If user has access to the new portfolio, keep the property access (no action needed)
      }
    }
  }
}
