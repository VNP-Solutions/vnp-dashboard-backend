import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GlobalReportController } from './global-report.controller'
import { GlobalReportRepository } from './global-report.repository'
import { GlobalReportService } from './global-report.service'

@Module({
  controllers: [GlobalReportController],
  providers: [
    {
      provide: 'IGlobalReportService',
      useClass: GlobalReportService
    },
    {
      provide: 'IGlobalReportRepository',
      useClass: GlobalReportRepository
    },
    PrismaService
  ],
  exports: [
    {
      provide: 'IGlobalReportService',
      useClass: GlobalReportService
    }
  ]
})
export class GlobalReportModule {}
