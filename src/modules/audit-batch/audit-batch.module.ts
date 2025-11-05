import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuditBatchController } from './audit-batch.controller'
import { AuditBatchRepository } from './audit-batch.repository'
import { AuditBatchService } from './audit-batch.service'

@Module({
  controllers: [AuditBatchController],
  providers: [
    {
      provide: 'IAuditBatchService',
      useClass: AuditBatchService
    },
    {
      provide: 'IAuditBatchRepository',
      useClass: AuditBatchRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IAuditBatchService',
      useClass: AuditBatchService
    }
  ]
})
export class AuditBatchModule {}
