import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { AuditBatchRepository } from '../audit-batch/audit-batch.repository'
import { AuditStatusRepository } from '../audit-status/audit-status.repository'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyRepository } from '../property/property.repository'
import { AuditController } from './audit.controller'
import { AuditRepository } from './audit.repository'
import { AuditService } from './audit.service'

@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: 'IAuditService',
      useClass: AuditService
    },
    {
      provide: 'IAuditRepository',
      useClass: AuditRepository
    },
    {
      provide: 'IAuditStatusRepository',
      useClass: AuditStatusRepository
    },
    {
      provide: 'IPropertyRepository',
      useClass: PropertyRepository
    },
    {
      provide: 'IAuditBatchRepository',
      useClass: AuditBatchRepository
    },
    PermissionService,
    PrismaService,
    EmailUtil
  ],
  exports: [
    {
      provide: 'IAuditService',
      useClass: AuditService
    }
  ]
})
export class AuditModule {}
