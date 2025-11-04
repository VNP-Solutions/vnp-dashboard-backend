import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { ContractUrlRepository } from '../contract-url/contract-url.repository'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceTypeRepository } from '../service-type/service-type.repository'
import { PortfolioController } from './portfolio.controller'
import { PortfolioRepository } from './portfolio.repository'
import { PortfolioService } from './portfolio.service'

@Module({
  controllers: [PortfolioController],
  providers: [
    {
      provide: 'IPortfolioService',
      useClass: PortfolioService
    },
    {
      provide: 'IPortfolioRepository',
      useClass: PortfolioRepository
    },
    {
      provide: 'IServiceTypeRepository',
      useClass: ServiceTypeRepository
    },
    {
      provide: 'IContractUrlRepository',
      useClass: ContractUrlRepository
    },
    PermissionService,
    PrismaService,
    EmailUtil
  ],
  exports: [
    {
      provide: 'IPortfolioService',
      useClass: PortfolioService
    }
  ]
})
export class PortfolioModule {}
