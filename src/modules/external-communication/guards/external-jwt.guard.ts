import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '../../../config/config.service'

const TAG = '[ExternalJwtGuard]'

/**
 * Guard that validates a Bearer JWT signed with JWT_COMMUNICATION_SECRET.
 * Used for endpoints that require a pre-generated communication token.
 */
@Injectable()
export class ExternalJwtGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

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

    const token = authHeader.substring(7).trim()
    console.log(`${TAG} Received token: ${token}`)

    const secret = this.configService.jwt.communicationSecret
    console.log(`${TAG} Communication secret configured: ${!!secret}`)

    if (!secret) {
      console.error(`${TAG} REJECTED — JWT_COMMUNICATION_SECRET is not set`)
      throw new UnauthorizedException(
        'Communication secret is not configured on this server'
      )
    }

    try {
      const payload = this.jwtService.verify(token, { secret })
      console.log(
        `${TAG} ACCEPTED — JWT valid. Payload: ${JSON.stringify(payload)}`
      )
      request['externalAuthPayload'] = payload
      return true
    } catch (err) {
      console.warn(
        `${TAG} REJECTED — JWT verification failed: ${(err as Error).message}`
      )
      throw new UnauthorizedException('Invalid or expired communication token')
    }
  }
}
