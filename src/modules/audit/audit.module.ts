import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
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
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IAuditService',
      useClass: AuditService
    }
  ]
})
export class AuditModule {}
