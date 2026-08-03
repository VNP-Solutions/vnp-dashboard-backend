import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '../../config/config.service'
import { PermissionService } from '../../common/services/permission.service'
import { EmailUtil } from '../../common/utils/email.util'
import { AuditBatchRepository } from '../audit-batch/audit-batch.repository'
import { AuditStatusRepository } from '../audit-status/audit-status.repository'
import { AuthModule } from '../auth/auth.module'
import { FileUploadService } from '../file-upload/file-upload.service'
import { PendingActionRepository } from '../pending-action/pending-action.repository'
import { PrismaService } from '../prisma/prisma.service'
import { PortfolioRepository } from '../portfolio/portfolio.repository'
import { PropertyRepository } from '../property/property.repository'
import { AuditController } from './audit.controller'
import { AuditRepository } from './audit.repository'
import { AuditService } from './audit.service'
import { PayoutClient } from './payout.client'
import { PayoutConfirmTokenService } from './payout-confirm-token.service'
import { InternalAuditController } from './internal-audit.controller'
import { InternalApiKeyGuard } from './internal-api-key.guard'
import { PayoutHistoryController } from './payout-history.controller'

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [AuditController, InternalAuditController, PayoutHistoryController],
  providers: [
    {
      provide: 'IAuditService',
      useClass: AuditService
    },
    {
      provide: 'IAuditRepository',
      useClass: AuditRepository
    },
    {
      provide: 'IAuditStatusRepository',
      useClass: AuditStatusRepository
    },
    {
      provide: 'IPropertyRepository',
      useClass: PropertyRepository
    },
    {
      provide: 'IPortfolioRepository',
      useClass: PortfolioRepository
    },
    {
      provide: 'IAuditBatchRepository',
      useClass: AuditBatchRepository
    },
    {
      provide: 'IPendingActionRepository',
      useClass: PendingActionRepository
    },
    {
      provide: 'IFileUploadService',
      useClass: FileUploadService
    },
    PermissionService,
    PrismaService,
    EmailUtil,
    ConfigService,
    PayoutClient,
    PayoutConfirmTokenService,
    InternalApiKeyGuard
  ],
  exports: [
    {
      provide: 'IAuditService',
      useClass: AuditService
    }
  ]
})
export class AuditModule {}
