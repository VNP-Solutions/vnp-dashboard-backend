import { Module, forwardRef } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { AuthModule } from '../auth/auth.module'
import { CurrencyRepository } from '../currency/currency.repository'
import { PortfolioRepository } from '../portfolio/portfolio.repository'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyBankDetailsRepository } from '../property-bank-details/property-bank-details.repository'
import { PropertyCredentialsRepository } from '../property-credentials/property-credentials.repository'
import { PendingActionModule } from '../pending-action/pending-action.module'
import { PropertyController } from './property.controller'
import { PropertyRepository } from './property.repository'
import { PropertyService } from './property.service'

@Module({
  imports: [AuthModule, forwardRef(() => PendingActionModule)],
  controllers: [PropertyController],
  providers: [
    {
      provide: 'IPropertyService',
      useClass: PropertyService
    },
    {
      provide: 'IPropertyRepository',
      useClass: PropertyRepository
    },
    {
      provide: 'IPortfolioRepository',
      useClass: PortfolioRepository
    },
    {
      provide: 'ICurrencyRepository',
      useClass: CurrencyRepository
    },
    {
      provide: 'IPropertyCredentialsRepository',
      useClass: PropertyCredentialsRepository
    },
    {
      provide: 'IPropertyBankDetailsRepository',
      useClass: PropertyBankDetailsRepository
    },
    PermissionService,
    PrismaService,
    EmailUtil
  ],
  exports: ['IPropertyService', 'IPropertyRepository']
})
export class PropertyModule {}
