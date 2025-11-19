import { Module, forwardRef } from '@nestjs/common'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyModule } from '../property/property.module'
import { PropertyPendingActionController } from './property-pending-action.controller'
import { PropertyPendingActionRepository } from './property-pending-action.repository'
import { PropertyPendingActionService } from './property-pending-action.service'

@Module({
  imports: [forwardRef(() => PropertyModule), PortfolioModule],
  controllers: [PropertyPendingActionController],
  providers: [
    {
      provide: 'IPropertyPendingActionRepository',
      useClass: PropertyPendingActionRepository
    },
    {
      provide: 'IPropertyPendingActionService',
      useClass: PropertyPendingActionService
    },
    PrismaService
  ],
  exports: ['IPropertyPendingActionService', 'IPropertyPendingActionRepository']
})
export class PropertyPendingActionModule {}
