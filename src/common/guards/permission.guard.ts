import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  PERMISSION_KEY,
  PermissionMetadata
} from '../decorators/require-permission.decorator'
import { IUserWithPermissions } from '../interfaces/permission.interface'
import { PermissionService } from '../services/permission.service'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService
  ) {}

  /**
   * MUST be async and MUST await requirePermission.
   *
   * This used to call the synchronous `checkPermission`, whose partial-access branch returns
   * `{ allowed: true }` unconditionally with a comment saying the real check happens "in async
   * requirePermission". The guard never called that method, so `useResourceId: true` on
   * `@RequirePermission` was inert for every controller relying on the guard alone: a user with
   * partial access passed the check for ANY resource id, including other tenants' resources. On the
   * audit payout routes that meant previewing and dispatching another hotel's money.
   *
   * `requirePermission` already contains the correct logic (it resolves audit -> property_id -> the
   * user's accessible property list via checkPartialAccess). It only ever needed to be awaited.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<PermissionMetadata>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    )

    if (!permission) {
      return true
    }

    const request = context.switchToHttp().getRequest<{
      user: IUserWithPermissions
      params: { id?: string; portfolioId?: string }
    }>()
    const user = request.user

    if (!user) {
      throw new ForbiddenException('User not authenticated')
    }

    let resourceId: string | undefined

    if (permission.useResourceId) {
      resourceId = request.params?.id || request.params?.portfolioId
    }

    // Throws ForbiddenException on both the coarse permission check and, for partial access with a
    // resource id, the resource-ownership check.
    await this.permissionService.requirePermission(
      user,
      permission.module,
      permission.action,
      resourceId
    )

    return true
  }
}
