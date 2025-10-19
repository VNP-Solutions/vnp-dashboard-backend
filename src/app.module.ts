import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { PermissionGuard } from './common/guards/permission.guard'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggerMiddleware } from './common/middlewares/logger.middleware'
import { PermissionService } from './common/services/permission.service'
import { ConfigService } from './config/config.service'
import configuration from './config/configuration'
import { validate } from './config/validation'
import { AuditStatusModule } from './modules/audit-status/audit-status.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { CurrencyModule } from './modules/currency/currency.module'
import { EmailModule } from './modules/email/email.module'
import { FileUploadModule } from './modules/file-upload/file-upload.module'
import { NoteModule } from './modules/note/note.module'
import { PortfolioModule } from './modules/portfolio/portfolio.module'
import { PrismaService } from './modules/prisma/prisma.service'
import { PropertyBankDetailsModule } from './modules/property-bank-details/property-bank-details.module'
import { PropertyBatchModule } from './modules/property-batch/property-batch.module'
import { PropertyCredentialsModule } from './modules/property-credentials/property-credentials.module'
import { PropertyModule } from './modules/property/property.module'
import { ServiceTypeModule } from './modules/service-type/service-type.module'
import { TaskModule } from './modules/task/task.module'
import { UserRoleModule } from './modules/user-role/user-role.module'
import { UserModule } from './modules/user/user.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      cache: true
    }),
    AuthModule,
    AuditModule,
    AuditStatusModule,
    CurrencyModule,
    EmailModule,
    FileUploadModule,
    NoteModule,
    PortfolioModule,
    TaskModule,
    PropertyBankDetailsModule,
    PropertyBatchModule,
    PropertyCredentialsModule,
    PropertyModule,
    ServiceTypeModule,
    UserModule,
    UserRoleModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ConfigService,
    PrismaService,
    PermissionService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ],
  exports: [ConfigService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
