import {
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic) {
      return true
    }

    return super.canActivate(context)
  }

  handleRequest(err: any, user: any, info: any) {
    // Handle specific JWT authentication errors with 401 status
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        // throw new UnauthorizedException(
        //   'Access token has expired. Please refresh your token.'
        // )
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      if (info?.name === 'JsonWebTokenError') {
        // throw new UnauthorizedException(
        //   'Invalid access token. Please authenticate again.'
        // )
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      if (info?.name === 'NotBeforeError') {
        // throw new UnauthorizedException('Access token is not yet valid.')
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      if (info?.message === 'No auth token') {
        // throw new UnauthorizedException(
        //   'No access token provided. Please authenticate.'
        // )
        throw new UnauthorizedException(
          'Please logout and login again, the session is expired!'
        )
      }

      // Generic authentication error
      throw (
        err ||
        new UnauthorizedException(
          // 'Authentication failed. Please provide a valid access token.'
          'Please logout and login again, the session is expired!'
        )
      )
    }

    return user
  }
}
