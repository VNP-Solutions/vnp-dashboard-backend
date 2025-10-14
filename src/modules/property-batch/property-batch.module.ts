import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyBatchController } from './property-batch.controller'
import { PropertyBatchRepository } from './property-batch.repository'
import { PropertyBatchService } from './property-batch.service'

@Module({
  controllers: [PropertyBatchController],
  providers: [
    {
      provide: 'IPropertyBatchService',
      useClass: PropertyBatchService
    },
    {
      provide: 'IPropertyBatchRepository',
      useClass: PropertyBatchRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IPropertyBatchService',
      useClass: PropertyBatchService
    }
  ]
})
export class PropertyBatchModule {}
