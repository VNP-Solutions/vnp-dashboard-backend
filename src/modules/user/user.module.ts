import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { AuthModule } from '../auth/auth.module'
import { PrismaService } from '../prisma/prisma.service'
import { UserController } from './user.controller'
import { UserRepository } from './user.repository'
import { UserService } from './user.service'

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [UserController],
  providers: [
    {
      provide: 'IUserService',
      useClass: UserService
    },
    {
      provide: 'IUserRepository',
      useClass: UserRepository
    },
    PermissionService,
    PrismaService,
    EmailUtil
  ],
  exports: [
    {
      provide: 'IUserService',
      useClass: UserService
    }
  ]
})
export class UserModule {}
