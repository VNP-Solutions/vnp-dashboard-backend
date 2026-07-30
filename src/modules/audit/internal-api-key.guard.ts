import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'

/**
 * Simple service-to-service guard: validates the x-api-key header against INTERNAL_API_KEY.
 * Used by the internal read endpoints the payout backend calls (shared secret, not a portfolio key).
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
    const provided = req.headers['x-api-key']
    const expected = this.config.internalApiKey
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing internal API key')
    }
    return true
  }
}
