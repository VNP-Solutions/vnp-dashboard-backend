import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '../../../config/config.service'
import { matchesSecret } from '../../../common/guards/service-token.guard'

const TAG = '[ExternalRawSecretGuard]'

/**
 * Guard for external communication endpoints.
 * Validates that the Bearer token exactly matches JWT_COMMUNICATION_SECRET.
 */
@Injectable()
export class ExternalRawSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, any>>()
    const route = `${request.method} ${request.url}`

    console.log(`${TAG} Checking auth for: ${route}`)

    const authHeader = request.headers?.['authorization'] as string | undefined
    console.log(`${TAG} Authorization header present: ${!!authHeader}`)

    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(
        `${TAG} REJECTED — missing or malformed Authorization header`
      )
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    // NEVER log this value, nor its length. The credential presented here is the raw
    // JWT_COMMUNICATION_SECRET, the estate's master service credential, and a length narrows a
    // guess. Anyone holding it can mint service tokens the payout service treats as unscoped.
    const token = authHeader.substring(7).trim()
    const secret = this.configService.jwt.communicationSecret

    if (!secret) {
      console.error(`${TAG} REJECTED — JWT_COMMUNICATION_SECRET is not set`)
      throw new UnauthorizedException(
        'Communication secret is not configured on this server'
      )
    }

    if (!matchesSecret(token, secret)) {
      throw new UnauthorizedException('Invalid communication secret')
    }

    return true
  }
}
