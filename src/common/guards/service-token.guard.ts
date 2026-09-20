import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'crypto'
import { Configuration } from '../../config/configuration'

/** Constant-time compare; `===` on a secret leaks its prefix through response timing. */
export function matchesSecret(
  provided: unknown,
  expected: string | undefined
): boolean {
  if (typeof provided !== 'string' || !expected) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Configuration>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const expected = this.config.get('serviceToken', { infer: true })

    if (!matchesSecret(req.headers['x-service-token'], expected)) {
      throw new UnauthorizedException('Invalid or missing service token')
    }

    return true
  }
}
