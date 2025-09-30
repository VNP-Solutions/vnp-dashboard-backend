import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    ConfigModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    PrismaService,
    EmailUtil
  ],
  exports: [AuthService, JwtStrategy, PassportModule]
})
export class AuthModule {}
