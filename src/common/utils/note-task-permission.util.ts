import { ForbiddenException } from '@nestjs/common'
import type { IUserWithPermissions } from '../interfaces/permission.interface'
import {
  AccessLevel,
  PermissionLevel
} from '../interfaces/permission.interface'

function assertInternalUser(user: IUserWithPermissions): void {
  if (user.role.is_external) {
    throw new ForbiddenException(
      'Notes and tasks are only accessible by internal users'
    )
  }
}

/** Portfolio-scoped notes/tasks: view permission + partial access on portfolio module */
export function assertPortfolioNotesTasksPolicy(
  user: IUserWithPermissions
): void {
  assertInternalUser(user)
  const p = user.role.portfolio_permission
  if (
    !p ||
    p.permission_level !== PermissionLevel.view ||
    p.access_level !== AccessLevel.partial
  ) {
    throw new ForbiddenException(
      'Portfolio notes and tasks require portfolio permission level view and partial access'
    )
  }
}

/** Property-scoped notes/tasks: view permission + partial access on property module */
export function assertPropertyNotesTasksPolicy(
  user: IUserWithPermissions
): void {
  assertInternalUser(user)
  const p = user.role.property_permission
  if (
    !p ||
    p.permission_level !== PermissionLevel.view ||
    p.access_level !== AccessLevel.partial
  ) {
    throw new ForbiddenException(
      'Property notes and tasks require property permission level view and partial access'
    )
  }
}

/** Audit-scoped notes/tasks: view permission + partial access on audit module */
export function assertAuditNotesTasksPolicy(
  user: IUserWithPermissions
): void {
  assertInternalUser(user)
  const p = user.role.audit_permission
  if (
    !p ||
    p.permission_level !== PermissionLevel.view ||
    p.access_level !== AccessLevel.partial
  ) {
    throw new ForbiddenException(
      'Audit notes and tasks require audit permission level view and partial access'
    )
  }
}

export function canUsePortfolioNotesTasks(user: IUserWithPermissions): boolean {
  if (user.role.is_external) return false
  const p = user.role.portfolio_permission
  return (
    !!p &&
    p.permission_level === PermissionLevel.view &&
    p.access_level === AccessLevel.partial
  )
}

export function canUsePropertyNotesTasks(user: IUserWithPermissions): boolean {
  if (user.role.is_external) return false
  const p = user.role.property_permission
  return (
    !!p &&
    p.permission_level === PermissionLevel.view &&
    p.access_level === AccessLevel.partial
  )
}

export function canUseAuditNotesTasks(user: IUserWithPermissions): boolean {
  if (user.role.is_external) return false
  const p = user.role.audit_permission
  return (
    !!p &&
    p.permission_level === PermissionLevel.view &&
    p.access_level === AccessLevel.partial
  )
}
