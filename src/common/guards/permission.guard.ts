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
   * Has to stay async, so the guard can do the ownership check itself.
   *
   * It used to call the sync `checkPermission`, which returns `allowed: true` for partial access
   * with a resourceId and defers the real check to `requirePermission`. That gap has never been
   * reachable: no route sets `useResourceId`, so `resourceId` is always undefined here, and
   * ownership is enforced by the service layer, which calls `requirePermission` directly.
   *
   * Calling it here closes the gap in advance, so the first route to set `useResourceId: true`
   * gets the check it is asking for instead of silently allowing everything.
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

    // Throws if the user lacks the permission, or has partial access and doesn't own the resource.
    await this.permissionService.requirePermission(
      user,
      permission.module,
      permission.action,
      resourceId
    )

    return true
  }
}
