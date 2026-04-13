import { ForbiddenException } from '@nestjs/common'
import type { IUserWithPermissions } from '../interfaces/permission.interface'
import {
  AccessLevel,
  PermissionAction
} from '../interfaces/permission.interface'
import { canPerformAction } from './permission.util'

function assertInternalUser(user: IUserWithPermissions): void {
  if (user.role.is_external) {
    throw new ForbiddenException(
      'Notes and tasks are only accessible by internal users'
    )
  }
}

/** Minimum: internal user + portfolio module access with read (view/update/all level + any access except none). */
export function assertPortfolioNotesTasksPolicy(
  user: IUserWithPermissions
): void {
  assertInternalUser(user)
  const p = user.role.portfolio_permission
  if (
    !p ||
    p.access_level === AccessLevel.none ||
    !canPerformAction(p.permission_level, PermissionAction.READ)
  ) {
    throw new ForbiddenException(
      'Insufficient portfolio permission for notes and tasks'
    )
  }
}

/** Minimum: internal user + property module access with read (view/update/all level + any access except none). */
export function assertPropertyNotesTasksPolicy(
  user: IUserWithPermissions
): void {
  assertInternalUser(user)
  const p = user.role.property_permission
  if (
    !p ||
    p.access_level === AccessLevel.none ||
    !canPerformAction(p.permission_level, PermissionAction.READ)
  ) {
    throw new ForbiddenException(
      'Insufficient property permission for notes and tasks'
    )
  }
}

/** Minimum: internal user + audit module access with read (view/update/all level + any access except none). */
export function assertAuditNotesTasksPolicy(
  user: IUserWithPermissions
): void {
  assertInternalUser(user)
  const p = user.role.audit_permission
  if (
    !p ||
    p.access_level === AccessLevel.none ||
    !canPerformAction(p.permission_level, PermissionAction.READ)
  ) {
    throw new ForbiddenException(
      'Insufficient audit permission for notes and tasks'
    )
  }
}

export function canUsePortfolioNotesTasks(user: IUserWithPermissions): boolean {
  if (user.role.is_external) return false
  const p = user.role.portfolio_permission
  return (
    !!p &&
    p.access_level !== AccessLevel.none &&
    canPerformAction(p.permission_level, PermissionAction.READ)
  )
}

export function canUsePropertyNotesTasks(user: IUserWithPermissions): boolean {
  if (user.role.is_external) return false
  const p = user.role.property_permission
  return (
    !!p &&
    p.access_level !== AccessLevel.none &&
    canPerformAction(p.permission_level, PermissionAction.READ)
  )
}

export function canUseAuditNotesTasks(user: IUserWithPermissions): boolean {
  if (user.role.is_external) return false
  const p = user.role.audit_permission
  return (
    !!p &&
    p.access_level !== AccessLevel.none &&
    canPerformAction(p.permission_level, PermissionAction.READ)
  )
}

/**
 * OR-clauses for list/delete queries: portfolio-, property-, and audit-scoped rows the user may see.
 * Handles full module access (access_level `all`) where IDs are returned as `'all'`.
 */
export function addNotesTasksScopeOrFilters(
  permissionFilters: any[],
  user: IUserWithPermissions,
  portfolioIds: string[] | 'all',
  propertyIds: string[] | 'all'
): void {
  if (canUsePortfolioNotesTasks(user)) {
    if (portfolioIds === 'all') {
      permissionFilters.push({ portfolio_id: { not: null } })
    } else if (Array.isArray(portfolioIds) && portfolioIds.length > 0) {
      permissionFilters.push({ portfolio_id: { in: portfolioIds } })
    }
  }

  if (canUsePropertyNotesTasks(user)) {
    if (propertyIds === 'all') {
      permissionFilters.push({ property_id: { not: null } })
    } else if (Array.isArray(propertyIds) && propertyIds.length > 0) {
      permissionFilters.push({ property_id: { in: propertyIds } })
    }
  }

  if (canUseAuditNotesTasks(user)) {
    if (propertyIds === 'all') {
      permissionFilters.push({ audit_id: { not: null } })
    } else if (Array.isArray(propertyIds) && propertyIds.length > 0) {
      permissionFilters.push({
        audit: {
          property_id: { in: propertyIds }
        }
      })
    }
  }
}
