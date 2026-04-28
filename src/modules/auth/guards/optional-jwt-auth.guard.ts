import {
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ExtractJwt } from 'passport-jwt'

/**
 * Allows the request when no Bearer token is present.
 * When a token is present, validates it the same way as {@link JwtAuthGuard}.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request)
    if (!token) {
      return true
    }
    return super.canActivate(context) as Promise<boolean>
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      if (info?.message === 'No auth token') {
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      throw (
        err ||
        new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      )
    }

    return user
  }
}
