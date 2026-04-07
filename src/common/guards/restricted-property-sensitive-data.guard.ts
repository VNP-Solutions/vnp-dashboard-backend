import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DENY_RESTRICTED_PROPERTY_SENSITIVE_DATA_PROFILE_KEY } from '../decorators/deny-restricted-property-sensitive-data.decorator'
import type { IUserWithPermissions } from '../interfaces/permission.interface'
import { isRestrictedPropertyCredentialsAndBankDetailsProfile } from '../utils/permission.util'

@Injectable()
export class RestrictedPropertySensitiveDataGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const deny = this.reflector.getAllAndOverride<boolean>(
      DENY_RESTRICTED_PROPERTY_SENSITIVE_DATA_PROFILE_KEY,
      [context.getHandler(), context.getClass()]
    )

    if (!deny) {
      return true
    }

    const request = context.switchToHttp().getRequest<{ user?: IUserWithPermissions }>()
    const user = request.user

    if (user?.role && isRestrictedPropertyCredentialsAndBankDetailsProfile(user.role)) {
      throw new BadRequestException(
        'This role profile cannot access property credentials or bank details for this property.'
      )
    }

    return true
  }
}
