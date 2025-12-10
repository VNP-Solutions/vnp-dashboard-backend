import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { ConsolidatedReportController } from './consolidated-report.controller'
import { ConsolidatedReportRepository } from './consolidated-report.repository'
import { ConsolidatedReportService } from './consolidated-report.service'

@Module({
  controllers: [ConsolidatedReportController],
  providers: [
    {
      provide: 'IConsolidatedReportService',
      useClass: ConsolidatedReportService
    },
    {
      provide: 'IConsolidatedReportRepository',
      useClass: ConsolidatedReportRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IConsolidatedReportService',
      useClass: ConsolidatedReportService
    },
    {
      provide: 'IConsolidatedReportRepository',
      useClass: ConsolidatedReportRepository
    }
  ]
})
export class ConsolidatedReportModule {}
