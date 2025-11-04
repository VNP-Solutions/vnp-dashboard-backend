import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { ContractUrlController } from './contract-url.controller'
import { ContractUrlRepository } from './contract-url.repository'
import { ContractUrlService } from './contract-url.service'

@Module({
  controllers: [ContractUrlController],
  providers: [
    {
      provide: 'IContractUrlService',
      useClass: ContractUrlService
    },
    {
      provide: 'IContractUrlRepository',
      useClass: ContractUrlRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IContractUrlService',
      useClass: ContractUrlService
    }
  ]
})
export class ContractUrlModule {}

