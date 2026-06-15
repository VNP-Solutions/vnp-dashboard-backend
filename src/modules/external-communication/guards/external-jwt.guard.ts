import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '../../../config/config.service'

/**
 * Guard for external API endpoints.
 * Validates the Bearer token as a JWT signed with JWT_COMMUNICATION_SECRET.
 */
@Injectable()
export class ExternalJwtGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, any>>()
    const authHeader = request.headers?.['authorization'] as string | undefined

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header'
      )
    }

    const token = authHeader.substring(7).trim()
    const secret = this.configService.jwt.communicationSecret

    if (!secret) {
      throw new UnauthorizedException(
        'Communication secret is not configured on this server'
      )
    }

    try {
      const payload = this.jwtService.verify(token)
      request['externalAuthPayload'] = payload
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired communication token')
    }
  }
}
