import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import { ConfigService } from '../../../config/config.service'
import {
  COMMUNICATION_AUDIENCE,
  REQUIRED_AUDIENCE_KEY
} from './communication-audience'

/**
 * Validates a Bearer JWT signed with JWT_COMMUNICATION_SECRET.
 *
 * Signature alone is not enough: the same secret signs the browser tokens handed out by
 * `/external/user-generate-token`, so a token minted for a browser is rejected here, and a route
 * may name the audience it accepts with `@RequireAudience()`.
 */
@Injectable()
export class ExternalJwtGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, any>>()
    const authHeader = request.headers?.['authorization'] as string | undefined

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const secret = this.configService.jwt.communicationSecret

    if (!secret) {
      throw new UnauthorizedException(
        'Communication secret is not configured on this server'
      )
    }

    let payload: Record<string, unknown>
    try {
      payload = this.jwtService.verify(authHeader.substring(7).trim(), {
        secret,
        // Pinned: an unpinned verify would accept whatever `alg` the token names.
        algorithms: ['HS256']
      })
    } catch {
      throw new UnauthorizedException('Invalid or expired communication token')
    }

    const audience = payload?.aud
    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_AUDIENCE_KEY,
      [context.getHandler(), context.getClass()]
    )

    if (audience === COMMUNICATION_AUDIENCE.browser) {
      throw new UnauthorizedException(
        'This token was issued for browser use and cannot call service endpoints'
      )
    }

    if (required && audience !== required) {
      throw new UnauthorizedException(
        'This token was not issued for this endpoint'
      )
    }

    request['externalAuthPayload'] = payload
    return true
  }
}
