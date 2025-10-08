import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
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
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IPropertyBankDetailsService',
      useClass: PropertyBankDetailsService
    }
  ]
})
export class PropertyBankDetailsModule {}
