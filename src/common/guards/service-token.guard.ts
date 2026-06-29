import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException
  } from '@nestjs/common'
  import { ConfigService } from '@nestjs/config'
  import { Configuration } from '../../config/configuration'
  
  @Injectable()
  export class ServiceTokenGuard implements CanActivate {
    constructor(private readonly config: ConfigService<Configuration>) {}
  
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest()
      const token = req.headers['x-service-token']
      const expected = this.config.get('serviceToken', { infer: true })
      if (!expected || token !== expected) {
        throw new UnauthorizedException('Invalid or missing service token')
      }
      return true
    }
  }