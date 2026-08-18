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
   * Has to stay async.
   *
   * This used to call the sync `checkPermission`, which always allows partial access and
   * leaves the ownership check to `requirePermission`. Nothing ever called that method, so
   * `useResourceId` did nothing and a partial-access user passed for any resource id,
   * including another hotel's payouts.
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
