import { Module, forwardRef } from '@nestjs/common'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyModule } from '../property/property.module'
import { PendingActionController } from './pending-action.controller'
import { PendingActionRepository } from './pending-action.repository'
import { PendingActionService } from './pending-action.service'

@Module({
  imports: [forwardRef(() => PropertyModule), PortfolioModule],
  controllers: [PendingActionController],
  providers: [
    {
      provide: 'IPendingActionRepository',
      useClass: PendingActionRepository
    },
    {
      provide: 'IPendingActionService',
      useClass: PendingActionService
    },
    PrismaService
  ],
  exports: ['IPendingActionService', 'IPendingActionRepository']
})
export class PendingActionModule {}
