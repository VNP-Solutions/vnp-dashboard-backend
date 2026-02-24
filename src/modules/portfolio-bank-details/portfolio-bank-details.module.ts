import { Module, forwardRef } from '@nestjs/common'
import { PortfolioBankDetailsController } from './portfolio-bank-details.controller'
import { PortfolioBankDetailsService } from './portfolio-bank-details.service'
import { PortfolioBankDetailsRepository } from './portfolio-bank-details.repository'
import { PrismaService } from '../prisma/prisma.service'
import { PermissionService } from '../../common/services/permission.service'
import { PortfolioModule } from '../portfolio/portfolio.module'

@Module({
  imports: [forwardRef(() => PortfolioModule)],
  controllers: [PortfolioBankDetailsController],
  providers: [
    {
      provide: 'IPortfolioBankDetailsService',
      useClass: PortfolioBankDetailsService
    },
    {
      provide: 'IPortfolioBankDetailsRepository',
      useClass: PortfolioBankDetailsRepository
    },
    PrismaService,
    PermissionService
  ],
  exports: [
    {
      provide: 'IPortfolioBankDetailsService',
      useClass: PortfolioBankDetailsService
    },
    {
      provide: 'IPortfolioBankDetailsRepository',
      useClass: PortfolioBankDetailsRepository
    }
  ]
})
export class PortfolioBankDetailsModule {}
