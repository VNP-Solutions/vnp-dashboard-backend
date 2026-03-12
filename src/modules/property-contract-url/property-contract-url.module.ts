import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyContractUrlController } from './property-contract-url.controller'
import { PropertyContractUrlRepository } from './property-contract-url.repository'
import { PropertyContractUrlService } from './property-contract-url.service'

@Module({
  controllers: [PropertyContractUrlController],
  providers: [
    {
      provide: 'IPropertyContractUrlService',
      useClass: PropertyContractUrlService
    },
    {
      provide: 'IPropertyContractUrlRepository',
      useClass: PropertyContractUrlRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IPropertyContractUrlService',
      useClass: PropertyContractUrlService
    }
  ]
})
export class PropertyContractUrlModule {}
