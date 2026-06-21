import { Module } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '../../config/config.service'
import { Configuration } from '../../config/configuration'
import { AuditModule } from '../audit/audit.module'
import { ExternalCommunicationController } from './external-communication.controller'
import { ExternalCommunicationService } from './external-communication.service'
import { ExternalJwtGuard } from './guards/external-jwt.guard'
import { ExternalRawSecretGuard } from './guards/external-raw-secret.guard'
import { AuditImportConsumer } from './sqs/audit-import.consumer'

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      inject: [NestConfigService],
      useFactory: (configService: NestConfigService<Configuration>) => ({
        secret:
          configService.get('jwt.communicationSecret', { infer: true }) ?? '',
        signOptions: { expiresIn: '24h' }
      })
    })
  ],
  controllers: [ExternalCommunicationController],
  providers: [
    ExternalCommunicationService,
    ExternalRawSecretGuard,
    ExternalJwtGuard,
    AuditImportConsumer,
    ConfigService
  ]
})
export class ExternalCommunicationModule {}
