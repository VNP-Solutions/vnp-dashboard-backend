import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { Configuration } from '../../config/configuration'
import { ConfigService } from '../../config/config.service'
import { AuditRepository } from '../audit/audit.repository'
import { AuditStatusRepository } from '../audit-status/audit-status.repository'
import { PropertyRepository } from '../property/property.repository'
import { PrismaService } from '../prisma/prisma.service'
import { ExternalCommunicationController } from './external-communication.controller'
import { ExternalCommunicationService } from './external-communication.service'
import { ExternalJwtGuard } from './guards/external-jwt.guard'
import { ExternalRawSecretGuard } from './guards/external-raw-secret.guard'
import { AuditImportConsumer } from './sqs/audit-import.consumer'

@Module({
  imports: [
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
    { provide: 'IAuditRepository', useClass: AuditRepository },
    { provide: 'IAuditStatusRepository', useClass: AuditStatusRepository },
    { provide: 'IPropertyRepository', useClass: PropertyRepository },
    PrismaService,
    ConfigService
  ]
})
export class ExternalCommunicationModule {}
