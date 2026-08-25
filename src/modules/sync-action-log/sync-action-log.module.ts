import { Module } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { Configuration } from '../../config/configuration'
import { ConfigService } from '../../config/config.service'
import { PrismaService } from '../prisma/prisma.service'
import { ExternalJwtGuard } from '../portfolio/guards/external-jwt.guard'
import { SyncActionLogController } from './sync-action-log.controller'
import { SyncActionLogRepository } from './sync-action-log.repository'
import { SyncActionLogService } from './sync-action-log.service'

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [NestConfigService],
      useFactory: (configService: NestConfigService<Configuration>) => ({
        secret:
          configService.get('jwt.communicationSecret', { infer: true }) ?? ''
      })
    })
  ],
  controllers: [SyncActionLogController],
  providers: [
    {
      provide: 'ISyncActionLogRepository',
      useClass: SyncActionLogRepository
    },
    {
      provide: 'ISyncActionLogService',
      useClass: SyncActionLogService
    },
    ExternalJwtGuard,
    ConfigService,
    PrismaService
  ],
  exports: ['ISyncActionLogService', 'ISyncActionLogRepository']
})
export class SyncActionLogModule {}
