import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyRepository } from '../property/property.repository'
import { PropertyCredentialsController } from './property-credentials.controller'
import { PropertyCredentialsRepository } from './property-credentials.repository'
import { PropertyCredentialsService } from './property-credentials.service'

@Module({
  controllers: [PropertyCredentialsController],
  providers: [
    {
      provide: 'IPropertyCredentialsService',
      useClass: PropertyCredentialsService
    },
    {
      provide: 'IPropertyCredentialsRepository',
      useClass: PropertyCredentialsRepository
    },
    {
      provide: 'IPropertyRepository',
      useClass: PropertyRepository
    },
    PrismaService
  ],
  exports: [
    {
      provide: 'IPropertyCredentialsService',
      useClass: PropertyCredentialsService
    }
  ]
})
export class PropertyCredentialsModule {}
