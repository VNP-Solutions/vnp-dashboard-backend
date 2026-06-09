import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { AuditModule } from '../audit/audit.module'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyModule } from '../property/property.module'
import { ApiKeyController } from './api-key.controller'
import { ApiKeyRepository } from './api-key.repository'
import { ApiKeyService } from './api-key.service'
import { ExternalApiController } from './external-api.controller'
import { ExternalApiService } from './external-api.service'
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard'

@Module({
  imports: [PropertyModule, AuditModule],
  controllers: [ApiKeyController, ExternalApiController],
  providers: [
    {
      provide: 'IApiKeyService',
      useClass: ApiKeyService
    },
    {
      provide: 'IApiKeyRepository',
      useClass: ApiKeyRepository
    },
    ExternalApiService,
    ApiKeyAuthGuard,
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
