import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { PermissionGuard } from './common/guards/permission.guard'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { PermissionService } from './common/services/permission.service'
import { ConfigService } from './config/config.service'
import configuration from './config/configuration'
import { validate } from './config/validation'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { PortfolioModule } from './modules/portfolio/portfolio.module'
import { UserRoleModule } from './modules/user-role/user-role.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      cache: true
    }),
    AuthModule,
    PortfolioModule,
    UserRoleModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ConfigService,
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
export class AppModule {}
