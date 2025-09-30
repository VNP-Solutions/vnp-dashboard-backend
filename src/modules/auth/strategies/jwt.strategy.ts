import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Configuration } from '../../../config/configuration'
import { JwtPayload } from '../auth.interface'
import { AuthRepository } from '../auth.repository'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService<Configuration>,
    private authRepository: AuthRepository
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.accessSecret', { infer: true })!
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.authRepository.findUserByEmail(payload.email)

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return {
      id: (user as unknown as { id: string }).id,
      email: (user as unknown as { email: string }).email,
      role_id: (user as unknown as { user_role_id: string }).user_role_id,
      role: (user as unknown as { role: unknown }).role
    }
  }
}
