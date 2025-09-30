import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { PortfolioController } from './portfolio.controller'
import { PortfolioRepository } from './portfolio.repository'
import { PortfolioService } from './portfolio.service'

@Module({
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    PortfolioRepository,
    PermissionService,
    PrismaService
  ],
  exports: [PortfolioService]
})
export class PortfolioModule {}
