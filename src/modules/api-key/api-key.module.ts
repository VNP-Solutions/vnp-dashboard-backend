import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { ApiKeyController } from './api-key.controller'
import { ApiKeyRepository } from './api-key.repository'
import { ApiKeyService } from './api-key.service'

@Module({
  controllers: [ApiKeyController],
  providers: [
    {
      provide: 'IApiKeyService',
      useClass: ApiKeyService
    },
    {
      provide: 'IApiKeyRepository',
      useClass: ApiKeyRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IApiKeyService',
      useClass: ApiKeyService
    },
    {
      provide: 'IApiKeyRepository',
      useClass: ApiKeyRepository
    }
  ]
})
export class ApiKeyModule {}
