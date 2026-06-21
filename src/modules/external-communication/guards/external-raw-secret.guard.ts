import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '../../../config/config.service'

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

    const match = token === secret
    console.log(`${TAG} Token matches secret: ${match}`)

    if (!match) {
      console.warn(
        `${TAG} REJECTED — token mismatch. Expected secret length: ${secret.length}, received token length: ${token.length}`
      )
      throw new UnauthorizedException('Invalid communication secret')
    }

    console.log(`${TAG} ACCEPTED — auth passed for: ${route}`)
    return true
  }
}
