import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { AuditStatusController } from './audit-status.controller'
import { AuditStatusRepository } from './audit-status.repository'
import { AuditStatusService } from './audit-status.service'

@Module({
  controllers: [AuditStatusController],
  providers: [
    {
      provide: 'IAuditStatusService',
      useClass: AuditStatusService
    },
    {
      provide: 'IAuditStatusRepository',
      useClass: AuditStatusRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IAuditStatusService',
      useClass: AuditStatusService
    }
  ]
})
export class AuditStatusModule {}
