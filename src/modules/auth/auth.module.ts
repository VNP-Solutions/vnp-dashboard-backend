import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    ConfigModule
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: 'IAuthService',
      useClass: AuthService
    },
    {
      provide: 'IAuthRepository',
      useClass: AuthRepository
    },
    JwtStrategy,
    PrismaService,
    EmailUtil,
    PermissionService,
    OptionalJwtAuthGuard
  ],
  exports: [
    {
      provide: 'IAuthService',
      useClass: AuthService
    },
    {
      provide: 'IAuthRepository',
      useClass: AuthRepository
    },
    JwtStrategy,
    PassportModule,
    OptionalJwtAuthGuard
  ]
})
export class AuthModule {}
