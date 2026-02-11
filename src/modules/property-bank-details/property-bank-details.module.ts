import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyRepository } from '../property/property.repository'
import { PropertyBankDetailsController } from './property-bank-details.controller'
import { PropertyBankDetailsRepository } from './property-bank-details.repository'
import { PropertyBankDetailsService } from './property-bank-details.service'

@Module({
  controllers: [PropertyBankDetailsController],
  providers: [
    {
      provide: 'IPropertyBankDetailsService',
      useClass: PropertyBankDetailsService
    },
    {
      provide: 'IPropertyBankDetailsRepository',
      useClass: PropertyBankDetailsRepository
    },
    {
      provide: 'IPropertyRepository',
      useClass: PropertyRepository
    },
    PermissionService,
    PrismaService,
    EmailUtil
  ],
  exports: [
    {
      provide: 'IPropertyBankDetailsService',
      useClass: PropertyBankDetailsService
    }
  ]
})
export class PropertyBankDetailsModule {}
