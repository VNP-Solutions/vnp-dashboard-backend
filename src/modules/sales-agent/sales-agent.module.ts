import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { SalesAgentController } from './sales-agent.controller'
import { SalesAgentRepository } from './sales-agent.repository'
import { SalesAgentService } from './sales-agent.service'

@Module({
  controllers: [SalesAgentController],
  providers: [
    {
      provide: 'ISalesAgentService',
      useClass: SalesAgentService
    },
    {
      provide: 'ISalesAgentRepository',
      useClass: SalesAgentRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'ISalesAgentService',
      useClass: SalesAgentService
    },
    {
      provide: 'ISalesAgentRepository',
      useClass: SalesAgentRepository
    }
  ]
})
export class SalesAgentModule {}
